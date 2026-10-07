// server/routes/inventory/transfers.js
// SwiftTrack Kenya: Inter-Branch Stock Transfers & In-Transit Lifecycle
const express = require('express');
const router = express.Router();
const dbAdapter = require('../../db/dbAdapter.js');
const { authenticateToken, authorize } = require('../../middleware/auth.js');
const { logAuditEvent } = require('../../middleware/audit.js');

/**
 * GET /api/v1/inventory/transfers
 */
router.get('/transfers', authenticateToken, authorize('inventory', 'view'), async (req, res, next) => {
  try {
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
    const transfers = await dbAdapter.all(query, params);

    const result = await Promise.all(transfers.map(async (t) => {
      const items = await dbAdapter.all(`
        SELECT sti.*, p.name as product_name, p.sku, p.unit
        FROM stock_transfer_items sti
        JOIN products p ON sti.product_id = p.id
        WHERE sti.stock_transfer_id = ?
      `, [t.id]);
      return {
        ...t,
        items
      };
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/inventory/transfers - Create transfer request
 */
router.post('/transfers', authenticateToken, authorize('inventory', 'transfer_request', { isTransfer: true }), async (req, res, next) => {
  try {
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

    await dbAdapter.withTransaction(async (tx) => {
      const trfResult = await tx.run(`
        INSERT INTO stock_transfers (
          transfer_number, source_branch_id, source_warehouse_id,
          target_branch_id, target_warehouse_id, status,
          requested_by_user_id, notes
        ) VALUES (?, ?, ?, ?, ?, 'PENDING_APPROVAL', ?, ?)
      `, [transferNo, source_branch_id, source_warehouse_id, target_branch_id, target_warehouse_id, req.user.id, notes || '']);

      newTransferId = trfResult.insertId;

      for (const item of items) {
        const q = Number(item.quantity_requested || item.quantity);
        await tx.run(`
          INSERT INTO stock_transfer_items (stock_transfer_id, product_id, quantity_requested, quantity_sent, quantity_received)
          VALUES (?, ?, ?, ?, 0)
        `, [newTransferId, item.product_id, q, q]);
      }

      await tx.run(`
        INSERT INTO notifications (branch_id, type, title, message, reference_type, reference_id)
        VALUES (?, 'TRANSFER_REQUEST', 'Inter-Branch Stock Transfer Request', ?, 'TRANSFER', ?)
      `, [source_branch_id, `Transfer ${transferNo} of ${items.length} items requested. Approval required.`, String(newTransferId)]);

      logAuditEvent({
        userId: req.user.id, role: req.user.roleName,
        action: 'REQUEST_TRANSFER', resource: 'STOCK_TRANSFER',
        resourceId: transferNo, branchId: source_branch_id,
        newValue: { transfer_number: transferNo, source_branch_id, target_branch_id, items_count: items.length },
        reason: 'Initiated inter-branch stock transfer'
      });
    });

    res.status(201).json({ id: newTransferId, transfer_number: transferNo, status: 'PENDING_APPROVAL' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/inventory/transfers/:id/status - Progress transfer state (APPROVE -> DISPATCH -> RECEIVE)
 */
router.post('/transfers/:id/status', authenticateToken, authorize('inventory', 'transfer_status', { isTransfer: true, idParam: 'id' }), async (req, res, next) => {
  try {
    const transferId = Number(req.params.id);
    const { action } = req.body; // 'APPROVE', 'DISPATCH', 'RECEIVE', 'REJECT'

    const transfer = await dbAdapter.get('SELECT * FROM stock_transfers WHERE id = ?', [transferId]);
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });

    const items = await dbAdapter.all('SELECT * FROM stock_transfer_items WHERE stock_transfer_id = ?', [transferId]);

    await dbAdapter.withTransaction(async (tx) => {
      if (action === 'APPROVE') {
        if (transfer.status !== 'PENDING_APPROVAL') throw new Error('Transfer is not pending approval');
        await tx.run("UPDATE stock_transfers SET status = 'APPROVED', approved_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [req.user.id, transferId]);
      } else if (action === 'DISPATCH') {
        if (!['PENDING_APPROVAL', 'APPROVED'].includes(transfer.status)) throw new Error('Transfer cannot be dispatched');
        for (const item of items) {
          let inv = await tx.get('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?', [transfer.source_warehouse_id, item.product_id]);
          if (!inv) {
            const insInv = await tx.run(`
              INSERT INTO inventory (branch_id, warehouse_id, product_id, quantity_on_hand, quantity_available, quantity_reserved, quantity_in_transit, quantity_damaged, quantity_expired)
              VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0)
            `, [transfer.source_branch_id, transfer.source_warehouse_id, item.product_id]);
            inv = await tx.get('SELECT * FROM inventory WHERE id = ?', [insInv.insertId]);
          }

          const qty = Number(item.quantity_requested);
          const prev = Number(inv.quantity_on_hand);
          const newOnHand = Math.max(0, prev - qty);
          const newAvailable = Math.max(0, newOnHand - (Number(inv.quantity_reserved) + Number(inv.quantity_damaged) + Number(inv.quantity_expired)));
          const newInTransit = Number(inv.quantity_in_transit) + qty;

          await tx.run(`
            UPDATE inventory
            SET quantity_on_hand = ?, quantity_available = ?, quantity_in_transit = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [newOnHand, newAvailable, newInTransit, inv.id]);

          await tx.run(`
            INSERT INTO inventory_movements (
              branch_id, warehouse_id, product_id, movement_type,
              quantity_change, previous_quantity, new_quantity,
              from_state, to_state, reference_type, reference_id,
              reason, user_id, created_at
            ) VALUES (?, ?, ?, 'TRANSFER_OUT', ?, ?, ?, 'AVAILABLE', 'IN_TRANSIT', 'TRANSFER', ?, ?, ?, CURRENT_TIMESTAMP)
          `, [
            transfer.source_branch_id, transfer.source_warehouse_id, item.product_id,
            -qty, prev, newOnHand, transfer.transfer_number,
            `Dispatched inter-branch transfer ${transfer.transfer_number}`, req.user.id
          ]);
        }
        await tx.run("UPDATE stock_transfers SET status = 'IN_TRANSIT', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [transferId]);
      } else if (action === 'RECEIVE') {
        if (transfer.status !== 'IN_TRANSIT') throw new Error('Transfer must be in transit to receive');
        const receivedItemsMap = new Map();
        if (Array.isArray(req.body.received_items)) {
          req.body.received_items.forEach(ri => receivedItemsMap.set(Number(ri.item_id || ri.id), ri));
        }

        for (const item of items) {
          const customItem = receivedItemsMap.get(item.id);
          const qtySent = Number(item.quantity_sent || item.quantity_requested);
          const qtyReceived = customItem ? Math.max(0, Number(customItem.quantity_received)) : qtySent;
          const discrepancy = Math.max(0, qtySent - qtyReceived);
          const discReason = customItem?.discrepancy_reason || (discrepancy > 0 ? 'Transit discrepancy / loss' : null);

          // Decrement in_transit on source for all sent units
          const srcInv = await tx.get('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?', [transfer.source_warehouse_id, item.product_id]);
          if (srcInv && Number(srcInv.quantity_in_transit) >= qtySent) {
            await tx.run('UPDATE inventory SET quantity_in_transit = quantity_in_transit - ? WHERE id = ?', [qtySent, srcInv.id]);
          }

          // Increment on_hand and available on target by received units
          let targetInv = await tx.get('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?', [transfer.target_warehouse_id, item.product_id]);
          if (!targetInv) {
            const insTarget = await tx.run(`
              INSERT INTO inventory (branch_id, warehouse_id, product_id, quantity_on_hand, quantity_available, quantity_reserved, quantity_in_transit, quantity_damaged, quantity_expired)
              VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0)
            `, [transfer.target_branch_id, transfer.target_warehouse_id, item.product_id]);
            targetInv = await tx.get('SELECT * FROM inventory WHERE id = ?', [insTarget.insertId]);
          }

          const prev = Number(targetInv.quantity_on_hand);
          const newOnHand = prev + qtyReceived;
          const newAvailable = Number(targetInv.quantity_available) + qtyReceived;

          await tx.run(`
            UPDATE inventory
            SET quantity_on_hand = ?, quantity_available = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [newOnHand, newAvailable, targetInv.id]);

          await tx.run(`
            UPDATE stock_transfer_items
            SET quantity_received = ?, quantity_discrepancy = ?, discrepancy_reason = ?
            WHERE id = ?
          `, [qtyReceived, discrepancy, discReason, item.id]);

          await tx.run(`
            INSERT INTO inventory_movements (
              branch_id, warehouse_id, product_id, movement_type,
              quantity_change, previous_quantity, new_quantity,
              from_state, to_state, reference_type, reference_id,
              reason, user_id, created_at
            ) VALUES (?, ?, ?, 'TRANSFER_IN', ?, ?, ?, 'IN_TRANSIT', 'AVAILABLE', 'TRANSFER', ?, ?, ?, CURRENT_TIMESTAMP)
          `, [
            transfer.target_branch_id, transfer.target_warehouse_id, item.product_id,
            qtyReceived, prev, newOnHand, transfer.transfer_number,
            `Received inter-branch transfer ${transfer.transfer_number}`, req.user.id
          ]);

          if (discrepancy > 0) {
            await tx.run(`
              INSERT INTO inventory_movements (
                branch_id, warehouse_id, product_id, movement_type,
                quantity_change, previous_quantity, new_quantity,
                from_state, to_state, reference_type, reference_id,
                reason, user_id, created_at
              ) VALUES (?, ?, ?, 'TRANSIT_LOSS', ?, ?, ?, 'IN_TRANSIT', 'EXTERNAL', 'TRANSFER', ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
              transfer.source_branch_id, transfer.source_warehouse_id, item.product_id,
              -discrepancy, qtySent, qtyReceived, transfer.transfer_number,
              `Transfer discrepancy: ${discReason}`, req.user.id
            ]);
          }
        }
        await tx.run("UPDATE stock_transfers SET status = 'RECEIVED', received_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [req.user.id, transferId]);
      } else if (action === 'REJECT') {
        await tx.run("UPDATE stock_transfers SET status = 'REJECTED', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [transferId]);
      }

      logAuditEvent({
        userId: req.user.id, role: req.user.roleName,
        action: `TRANSFER_${action}`, resource: 'STOCK_TRANSFER',
        resourceId: transfer.transfer_number, branchId: req.user.branchId,
        reason: `Transfer state transition to ${action}`
      });
    });

    res.json({ message: `Transfer status updated successfully (${action})` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
