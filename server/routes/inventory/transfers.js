// server/routes/inventory/transfers.js
// SwiftTrack Kenya: Inter-Branch Stock Transfers & In-Transit Lifecycle
const express = require('express');
const router = express.Router();
const { db } = require('../../db/database.js');
const { authenticateToken, authorize } = require('../../middleware/auth.js');
const { logAuditEvent } = require('../../middleware/audit.js');
const {
  dispatchStock,
  receiveInTransit,
  getOrInitInventory,
  assertInventoryInvariant,
  logMovement
} = require('../../services/inventoryStateService.js');

/**
 * GET /api/v1/inventory/transfers
 */
router.get('/transfers', authenticateToken, authorize('inventory', 'view'), (req, res) => {
  let query = `
    SELECT st.*,
           sb.name as source_branch_name, tb.name as target_branch_name,
           sw.name as source_warehouse_name, tw.name as target_warehouse_name,
           req_u.full_name as requested_by_name, app_u.full_name as approved_by_name
    FROM stock_transfers st
    JOIN branches sb ON st.source_branch_id = sb.id
    JOIN branches tb ON st.target_branch_id = tb.id
    JOIN warehouses sw ON st.source_warehouse_id = sw.id
    JOIN warehouses tw ON st.target_warehouse_id = tw.id
    LEFT JOIN users req_u ON st.requested_by_user_id = req_u.id
    LEFT JOIN users app_u ON st.approved_by_user_id = app_u.id
    WHERE 1=1
  `;
  const params = [];

  if (req.effectiveBranchId) {
    query += ' AND (st.source_branch_id = ? OR st.target_branch_id = ?)';
    params.push(req.effectiveBranchId, req.effectiveBranchId);
  }

  query += ' ORDER BY st.id DESC LIMIT 100';
  const transfers = db.prepare(query).all(...params);

  const transferItemsStmt = db.prepare(`
    SELECT sti.*, p.name as product_name, p.sku, p.unit
    FROM stock_transfer_items sti
    JOIN products p ON sti.product_id = p.id
    WHERE sti.stock_transfer_id = ?
  `);

  const result = transfers.map(t => ({
    ...t,
    items: transferItemsStmt.all(t.id)
  }));

  res.json(result);
});

/**
 * POST /api/v1/inventory/transfers - Create transfer request
 */
router.post('/transfers', authenticateToken, authorize('inventory', 'transfer_request', { isTransfer: true }), (req, res) => {
  const { source_branch_id, source_warehouse_id, target_branch_id, target_warehouse_id, items, notes } = req.body;
  if (!source_branch_id || !source_warehouse_id || !target_branch_id || !target_warehouse_id || !items?.length) {
    return res.status(400).json({ error: 'Source and target branches/warehouses and items are required.' });
  }

  if (Number(source_branch_id) === Number(target_branch_id) && Number(source_warehouse_id) === Number(target_warehouse_id)) {
    return res.status(400).json({ error: 'Source and target warehouse must be distinct.' });
  }

  if (req.user.roleName !== 'SUPER_ADMIN') {
    if (Number(source_branch_id) !== Number(req.user.branchId) && Number(target_branch_id) !== Number(req.user.branchId)) {
      return res.status(403).json({ error: 'Forbidden: You can only initiate transfers involving your assigned branch.' });
    }
  }

  const transferNo = `TRF-${Date.now().toString().slice(-6)}`;
  let newTransferId;

  db.transaction(() => {
    const trfResult = db.prepare(`
      INSERT INTO stock_transfers (
        transfer_number, source_branch_id, source_warehouse_id,
        target_branch_id, target_warehouse_id, status,
        requested_by_user_id, notes
      ) VALUES (?, ?, ?, ?, ?, 'PENDING_APPROVAL', ?, ?)
    `).run(transferNo, source_branch_id, source_warehouse_id, target_branch_id, target_warehouse_id, req.user.id, notes || '');

    newTransferId = trfResult.lastInsertRowid;

    const insertItem = db.prepare(`
      INSERT INTO stock_transfer_items (stock_transfer_id, product_id, quantity_requested, quantity_sent, quantity_received)
      VALUES (?, ?, ?, ?, 0)
    `);

    for (const item of items) {
      const q = Number(item.quantity_requested || item.quantity);
      insertItem.run(newTransferId, item.product_id, q, q);
    }

    db.prepare(`
      INSERT INTO notifications (branch_id, type, title, message, reference_type, reference_id)
      VALUES (?, 'TRANSFER_REQUEST', 'Inter-Branch Stock Transfer Request', ?, 'TRANSFER', ?)
    `).run(source_branch_id, `Transfer ${transferNo} of ${items.length} items requested. Approval required.`, String(newTransferId));

    logAuditEvent({
      userId: req.user.id, role: req.user.roleName,
      action: 'REQUEST_TRANSFER', resource: 'STOCK_TRANSFER',
      resourceId: transferNo, branchId: source_branch_id,
      newValue: { transfer_number: transferNo, source_branch_id, target_branch_id, items_count: items.length },
      reason: 'Initiated inter-branch stock transfer'
    });
  })();

  res.status(201).json({ id: newTransferId, transfer_number: transferNo, status: 'PENDING_APPROVAL' });
});

/**
 * POST /api/v1/inventory/transfers/:id/status - Progress transfer state (APPROVE -> DISPATCH -> RECEIVE)
 */
router.post('/transfers/:id/status', authenticateToken, authorize('inventory', 'transfer_status', { isTransfer: true, idParam: 'id' }), (req, res) => {
  const transferId = Number(req.params.id);
  const { action } = req.body; // 'APPROVE', 'DISPATCH', 'RECEIVE', 'REJECT'

  const transfer = db.prepare('SELECT * FROM stock_transfers WHERE id = ?').get(transferId);
  if (!transfer) return res.status(404).json({ error: 'Transfer not found' });

  const items = db.prepare('SELECT * FROM stock_transfer_items WHERE stock_transfer_id = ?').all(transferId);

  db.transaction(() => {
    if (action === 'APPROVE') {
      if (transfer.status !== 'PENDING_APPROVAL') throw new Error('Transfer is not pending approval');
      db.prepare("UPDATE stock_transfers SET status = 'APPROVED', approved_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(req.user.id, transferId);
    } else if (action === 'DISPATCH') {
      if (!['PENDING_APPROVAL', 'APPROVED'].includes(transfer.status)) throw new Error('Transfer cannot be dispatched');
      for (const item of items) {
        const inv = getOrInitInventory(transfer.source_warehouse_id, item.product_id, transfer.source_branch_id);
        const qty = item.quantity_requested;
        const prev = inv.quantity_on_hand;
        const newOnHand = Math.max(0, prev - qty);
        const newAvailable = Math.max(0, newOnHand - (inv.quantity_reserved + inv.quantity_damaged + inv.quantity_expired));
        const newInTransit = inv.quantity_in_transit + qty;

        db.prepare(`
          UPDATE inventory
          SET quantity_on_hand = ?, quantity_available = ?, quantity_in_transit = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(newOnHand, newAvailable, newInTransit, inv.id);

        assertInventoryInvariant({ ...inv, quantity_on_hand: newOnHand, quantity_available: newAvailable, quantity_in_transit: newInTransit }, 'transferDispatch');

        logMovement({
          branchId: transfer.source_branch_id, warehouseId: transfer.source_warehouse_id, productId: item.product_id,
          movementType: 'TRANSFER_OUT', quantityChange: -qty, prevQty: prev, newQty: newOnHand,
          fromState: 'AVAILABLE', toState: 'IN_TRANSIT', referenceType: 'TRANSFER', referenceId: transfer.transfer_number,
          reason: `Dispatched inter-branch transfer ${transfer.transfer_number}`, userId: req.user.id
        });
      }
      db.prepare("UPDATE stock_transfers SET status = 'IN_TRANSIT', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(transferId);
    } else if (action === 'RECEIVE') {
      if (transfer.status !== 'IN_TRANSIT') throw new Error('Transfer must be in transit to receive');
      const receivedItemsMap = new Map();
      if (Array.isArray(req.body.received_items)) {
        req.body.received_items.forEach(ri => receivedItemsMap.set(Number(ri.item_id || ri.id), ri));
      }

      for (const item of items) {
        const customItem = receivedItemsMap.get(item.id);
        const qtySent = item.quantity_sent || item.quantity_requested;
        const qtyReceived = customItem ? Math.max(0, Number(customItem.quantity_received)) : qtySent;
        const discrepancy = Math.max(0, qtySent - qtyReceived);
        const discReason = customItem?.discrepancy_reason || (discrepancy > 0 ? 'Transit discrepancy / loss' : null);

        // Decrement in_transit on source for all sent units
        const srcInv = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(transfer.source_warehouse_id, item.product_id);
        if (srcInv && srcInv.quantity_in_transit >= qtySent) {
          db.prepare('UPDATE inventory SET quantity_in_transit = quantity_in_transit - ? WHERE id = ?').run(qtySent, srcInv.id);
        }

        // Increment on_hand and available on target by received units
        const targetInv = getOrInitInventory(transfer.target_warehouse_id, item.product_id, transfer.target_branch_id);
        const prev = targetInv.quantity_on_hand;
        const newOnHand = prev + qtyReceived;
        const newAvailable = targetInv.quantity_available + qtyReceived;

        db.prepare(`
          UPDATE inventory
          SET quantity_on_hand = ?, quantity_available = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(newOnHand, newAvailable, targetInv.id);

        assertInventoryInvariant({ ...targetInv, quantity_on_hand: newOnHand, quantity_available: newAvailable }, 'transferReceive');

        db.prepare(`
          UPDATE stock_transfer_items
          SET quantity_received = ?, quantity_discrepancy = ?, discrepancy_reason = ?
          WHERE id = ?
        `).run(qtyReceived, discrepancy, discReason, item.id);

        logMovement({
          branchId: transfer.target_branch_id, warehouseId: transfer.target_warehouse_id, productId: item.product_id,
          movementType: 'TRANSFER_IN', quantityChange: qtyReceived, prevQty: prev, newQty: newOnHand,
          fromState: 'IN_TRANSIT', toState: 'AVAILABLE', referenceType: 'TRANSFER', referenceId: transfer.transfer_number,
          reason: `Received inter-branch transfer ${transfer.transfer_number}`, userId: req.user.id
        });

        if (discrepancy > 0) {
          logMovement({
            branchId: transfer.source_branch_id, warehouseId: transfer.source_warehouse_id, productId: item.product_id,
            movementType: 'TRANSIT_LOSS', quantityChange: -discrepancy, prevQty: qtySent, newQty: qtyReceived,
            fromState: 'IN_TRANSIT', toState: 'EXTERNAL', referenceType: 'TRANSFER', referenceId: transfer.transfer_number,
            reason: `Transfer discrepancy: ${discReason}`, userId: req.user.id
          });
        }
      }
      db.prepare("UPDATE stock_transfers SET status = 'RECEIVED', received_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(req.user.id, transferId);
    }

    logAuditEvent({
      userId: req.user.id, role: req.user.roleName,
      action: `TRANSFER_${action}`, resource: 'STOCK_TRANSFER',
      resourceId: transfer.transfer_number, branchId: req.user.branchId,
      reason: `Transfer state transition to ${action}`
    });
  })();

  res.json({ message: `Transfer status updated successfully (${action})` });
});

module.exports = router;
