// server/routes/inventory.js
const express = require('express');
const router = express.Router();
const { db } = require('../db/database.js');
const { authenticateToken, requireRole, enforceBranchIsolation, authorize } = require('../middleware/auth.js');
const { logAuditEvent } = require('../middleware/audit.js');

// GET /api/inventory - Stock matrix (Branch-scoped or company-wide for Super Admin)
router.get('/', authenticateToken, authorize('inventory', 'view'), (req, res) => {
    let query = `
        SELECT i.*, p.sku, p.barcode, p.name as product_name, p.unit, p.selling_price, p.cost_price,
               p.min_stock_alert, c.name as category_name,
               w.name as warehouse_name, w.code as warehouse_code,
               b.name as branch_name, b.code as branch_code
        FROM inventory i
        JOIN products p ON i.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        JOIN warehouses w ON i.warehouse_id = w.id
        JOIN branches b ON i.branch_id = b.id
    `;
    const params = [];

    if (req.effectiveBranchId) {
        query += ' WHERE i.branch_id = ?';
        params.push(req.effectiveBranchId);
    }

    if (req.query.warehouse_id) {
        query += req.effectiveBranchId ? ' AND i.warehouse_id = ?' : ' WHERE i.warehouse_id = ?';
        params.push(Number(req.query.warehouse_id));
    }

    if (req.query.low_stock === 'true') {
        query += (req.effectiveBranchId || req.query.warehouse_id) ? ' AND i.quantity_on_hand <= p.min_stock_alert' : ' WHERE i.quantity_on_hand <= p.min_stock_alert';
    }

    query += ' ORDER BY b.name ASC, w.name ASC, p.name ASC';

    const stock = db.prepare(query).all(...params);
    res.json(stock);
});

// GET /api/inventory/movements - Immutable stock movement ledger
router.get('/movements', authenticateToken, authorize('inventory', 'view'), (req, res) => {
    let query = `
        SELECT im.*, p.sku, p.name as product_name, p.unit,
               w.name as warehouse_name, b.name as branch_name,
               u.full_name as user_full_name, u.username
        FROM inventory_movements im
        JOIN products p ON im.product_id = p.id
        JOIN warehouses w ON im.warehouse_id = w.id
        JOIN branches b ON im.branch_id = b.id
        LEFT JOIN users u ON im.user_id = u.id
    `;
    const params = [];

    if (req.effectiveBranchId) {
        query += ' WHERE im.branch_id = ?';
        params.push(req.effectiveBranchId);
    }

    if (req.query.product_id) {
        query += req.effectiveBranchId ? ' AND im.product_id = ?' : ' WHERE im.product_id = ?';
        params.push(Number(req.query.product_id));
    }

    query += ' ORDER BY im.id DESC LIMIT 100';

    const movements = db.prepare(query).all(...params);
    res.json(movements);
});

// POST /api/inventory/adjust - Submit stock adjustment request
router.post('/adjust', authenticateToken, authorize('inventory', 'adjust_request'), (req, res) => {
    const { warehouse_id, product_id, adjustment_type, quantity, reason, notes } = req.body;

    if (!warehouse_id || !product_id || !adjustment_type || !quantity || !reason) {
        return res.status(400).json({ error: 'Warehouse, product, adjustment_type (ADD/DEDUCT/WRITE_OFF), quantity, and reason are required.' });
    }

    const warehouse = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(warehouse_id);
    if (!warehouse) {
        return res.status(404).json({ error: 'Warehouse not found' });
    }

    // Branch isolation check: Manager cannot adjust stock in another branch
    if (req.user.roleName !== 'SUPER_ADMIN' && warehouse.branch_id !== req.user.branchId) {
        return res.status(403).json({ error: 'Forbidden: You can only adjust inventory within your assigned branch.' });
    }

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    if (!product) {
        return res.status(404).json({ error: 'Product not found' });
    }

    const adjNumber = `ADJ-${Date.now().toString().slice(-6)}`;
    const branchId = warehouse.branch_id;
    const qty = Math.abs(Number(quantity));

    // If Super Admin, execute immediately. If Branch Manager, mark APPROVED or PENDING_APPROVAL based on policy
    const isInstantApproval = req.user.roleName === 'SUPER_ADMIN' || (req.user.roleName === 'BRANCH_MANAGER' && qty <= 20);
    const status = isInstantApproval ? 'APPROVED' : 'PENDING_APPROVAL';
    const approvedBy = isInstantApproval ? req.user.id : null;

    db.transaction(() => {
        const result = db.prepare(`
            INSERT INTO stock_adjustments (
                adjustment_number, branch_id, warehouse_id, product_id,
                adjustment_type, quantity, reason, status, requested_by_user_id,
                approved_by_user_id, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            adjNumber, branchId, warehouse_id, product_id,
            adjustment_type, qty, reason.trim(), status, req.user.id,
            approvedBy, notes || ''
        );

        if (status === 'APPROVED') {
            // Find current inventory
            let inv = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(warehouse_id, product_id);
            if (!inv) {
                db.prepare(`
                    INSERT INTO inventory (branch_id, warehouse_id, product_id, quantity_on_hand, quantity_reserved, quantity_available)
                    VALUES (?, ?, ?, 0, 0, 0)
                `).run(branchId, warehouse_id, product_id);
                inv = { quantity_on_hand: 0, quantity_reserved: 0, quantity_available: 0 };
            }

            let change = 0;
            let mType = 'ADJUSTMENT_ADD';

            if (adjustment_type === 'ADD') {
                change = qty;
                mType = 'ADJUSTMENT_ADD';
            } else if (adjustment_type === 'DEDUCT') {
                change = -qty;
                mType = 'ADJUSTMENT_DEDUCT';
            } else if (adjustment_type === 'WRITE_OFF') {
                change = -qty;
                mType = 'DAMAGED_WRITE_OFF';
            }

            const previousQty = inv.quantity_on_hand;
            const newOnHand = Math.max(0, previousQty + change);
            const newAvailable = Math.max(0, newOnHand - inv.quantity_reserved);

            db.prepare(`
                UPDATE inventory
                SET quantity_on_hand = ?, quantity_available = ?, updated_at = CURRENT_TIMESTAMP
                WHERE warehouse_id = ? AND product_id = ?
            `).run(newOnHand, newAvailable, warehouse_id, product_id);

            // Log immutable stock movement
            db.prepare(`
                INSERT INTO inventory_movements (
                    branch_id, warehouse_id, product_id, movement_type,
                    quantity_change, previous_quantity, new_quantity,
                    reference_type, reference_id, reason, user_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ADJUSTMENT', ?, ?, ?)
            `).run(
                branchId, warehouse_id, product_id, mType,
                change, previousQty, newOnHand, adjNumber, reason, req.user.id
            );
        }

        logAuditEvent({
            userId: req.user.id,
            role: req.user.roleName,
            action: status === 'APPROVED' ? 'ADJUST_STOCK' : 'REQUEST_STOCK_ADJUSTMENT',
            resource: 'INVENTORY',
            resourceId: adjNumber,
            branchId,
            newValue: { adjustment_type, quantity: qty, status, reason },
            reason: `Stock adjustment: ${reason}`
        });
    })();

    res.status(201).json({
        adjustment_number: adjNumber,
        status,
        message: status === 'APPROVED' ? 'Stock adjusted successfully and ledger updated.' : 'Stock adjustment submitted for Super Admin review.'
    });
});

// GET /api/inventory/transfers - List inter-branch stock transfers
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
    `;
    const params = [];

    if (req.effectiveBranchId) {
        query += ' WHERE (st.source_branch_id = ? OR st.target_branch_id = ?)';
        params.push(req.effectiveBranchId, req.effectiveBranchId);
    }

    query += ' ORDER BY st.id DESC';

    const transfers = db.prepare(query).all(...params);

    // Attach items
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

// POST /api/inventory/transfers - Initiate inter-branch transfer request
router.post('/transfers', authenticateToken, authorize('inventory', 'transfer_request', { isTransfer: true }), (req, res) => {
    const { source_branch_id, source_warehouse_id, target_branch_id, target_warehouse_id, items, notes } = req.body;

    if (!source_branch_id || !source_warehouse_id || !target_branch_id || !target_warehouse_id || !items || !items.length) {
        return res.status(400).json({ error: 'Source and target branches/warehouses and items are required.' });
    }

    if (Number(source_branch_id) === Number(target_branch_id) && Number(source_warehouse_id) === Number(target_warehouse_id)) {
        return res.status(400).json({ error: 'Source and target warehouse must be distinct.' });
    }

    // Branch Manager can only request transfers involving their own branch
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
        `).run(
            transferNo, source_branch_id, source_warehouse_id,
            target_branch_id, target_warehouse_id, req.user.id, notes || ''
        );

        newTransferId = trfResult.lastInsertRowid;

        const insertItem = db.prepare(`
            INSERT INTO stock_transfer_items (stock_transfer_id, product_id, quantity_requested, quantity_sent, quantity_received)
            VALUES (?, ?, ?, ?, 0)
        `);

        for (const item of items) {
            insertItem.run(newTransferId, item.product_id, Number(item.quantity), Number(item.quantity));
        }

        // Notify managers
        db.prepare(`
            INSERT INTO notifications (branch_id, type, title, message, reference_type, reference_id)
            VALUES (?, 'TRANSFER_REQUEST', 'Inter-Branch Stock Transfer Request', ?, 'TRANSFER', ?)
        `).run(
            source_branch_id,
            `Transfer ${transferNo} of ${items.length} items requested to Target Branch. Approval required.`,
            String(newTransferId)
        );

        logAuditEvent({
            userId: req.user.id,
            role: req.user.roleName,
            action: 'REQUEST_TRANSFER',
            resource: 'STOCK_TRANSFER',
            resourceId: transferNo,
            branchId: req.user.branchId,
            newValue: { transfer_number: transferNo, source_branch_id, target_branch_id, items_count: items.length },
            reason: 'Initiated inter-branch stock transfer'
        });
    })();

    res.status(201).json({ id: newTransferId, transfer_number: transferNo, status: 'PENDING_APPROVAL' });
});

// POST /api/inventory/transfers/:id/status - Progress transfer state (APPROVED -> IN_TRANSIT -> RECEIVED)
router.post('/transfers/:id/status', authenticateToken, authorize('inventory', 'transfer_status', { isTransfer: true, idParam: 'id' }), (req, res) => {
    const transferId = Number(req.params.id);
    const { action } = req.body; // 'APPROVE', 'DISPATCH', 'RECEIVE', 'REJECT'

    const transfer = db.prepare('SELECT * FROM stock_transfers WHERE id = ?').get(transferId);
    if (!transfer) {
        return res.status(404).json({ error: 'Transfer not found' });
    }

    const items = db.prepare('SELECT * FROM stock_transfer_items WHERE stock_transfer_id = ?').all(transferId);

    db.transaction(() => {
        if (action === 'APPROVE') {
            if (transfer.status !== 'PENDING_APPROVAL') throw new Error('Transfer is not pending approval');
            db.prepare("UPDATE stock_transfers SET status = 'APPROVED', approved_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                .run(req.user.id, transferId);
        } else if (action === 'DISPATCH') {
            if (!['PENDING_APPROVAL', 'APPROVED'].includes(transfer.status)) throw new Error('Transfer cannot be dispatched');
            // Deduct stock from source warehouse
            for (const item of items) {
                const inv = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(transfer.source_warehouse_id, item.product_id);
                const prev = inv ? inv.quantity_on_hand : 0;
                const newOnHand = Math.max(0, prev - item.quantity_requested);
                const newAvailable = Math.max(0, newOnHand - (inv ? inv.quantity_reserved : 0));

                db.prepare('UPDATE inventory SET quantity_on_hand = ?, quantity_available = ? WHERE warehouse_id = ? AND product_id = ?')
                    .run(newOnHand, newAvailable, transfer.source_warehouse_id, item.product_id);

                db.prepare(`
                    INSERT INTO inventory_movements (
                        branch_id, warehouse_id, product_id, movement_type,
                        quantity_change, previous_quantity, new_quantity,
                        reference_type, reference_id, reason, user_id
                    ) VALUES (?, ?, ?, 'TRANSFER_OUT', ?, ?, ?, 'TRANSFER', ?, 'Dispatched inter-branch transfer', ?)
                `).run(
                    transfer.source_branch_id, transfer.source_warehouse_id, item.product_id,
                    -item.quantity_requested, prev, newOnHand, transfer.transfer_number, req.user.id
                );
            }
            db.prepare("UPDATE stock_transfers SET status = 'IN_TRANSIT', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(transferId);
        } else if (action === 'RECEIVE') {
            if (transfer.status !== 'IN_TRANSIT') throw new Error('Transfer must be in transit to receive');
            // Add stock to target warehouse
            for (const item of items) {
                let inv = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(transfer.target_warehouse_id, item.product_id);
                if (!inv) {
                    db.prepare('INSERT INTO inventory (branch_id, warehouse_id, product_id, quantity_on_hand, quantity_reserved, quantity_available) VALUES (?, ?, ?, 0, 0, 0)')
                        .run(transfer.target_branch_id, transfer.target_warehouse_id, item.product_id);
                    inv = { quantity_on_hand: 0, quantity_reserved: 0, quantity_available: 0 };
                }
                const prev = inv.quantity_on_hand;
                const newOnHand = prev + item.quantity_requested;
                const newAvailable = newOnHand - inv.quantity_reserved;

                db.prepare('UPDATE inventory SET quantity_on_hand = ?, quantity_available = ? WHERE warehouse_id = ? AND product_id = ?')
                    .run(newOnHand, newAvailable, transfer.target_warehouse_id, item.product_id);

                db.prepare('UPDATE stock_transfer_items SET quantity_received = ? WHERE id = ?')
                    .run(item.quantity_requested, item.id);

                db.prepare(`
                    INSERT INTO inventory_movements (
                        branch_id, warehouse_id, product_id, movement_type,
                        quantity_change, previous_quantity, new_quantity,
                        reference_type, reference_id, reason, user_id
                    ) VALUES (?, ?, ?, 'TRANSFER_IN', ?, ?, ?, 'TRANSFER', ?, 'Received inter-branch transfer', ?)
                `).run(
                    transfer.target_branch_id, transfer.target_warehouse_id, item.product_id,
                    item.quantity_requested, prev, newOnHand, transfer.transfer_number, req.user.id
                );
            }
            db.prepare("UPDATE stock_transfers SET status = 'RECEIVED', received_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                .run(req.user.id, transferId);
        }

        logAuditEvent({
            userId: req.user.id,
            role: req.user.roleName,
            action: `TRANSFER_${action}`,
            resource: 'STOCK_TRANSFER',
            resourceId: transfer.transfer_number,
            branchId: req.user.branchId,
            reason: `Transfer state transition to ${action}`
        });
    })();

    res.json({ message: `Transfer status updated successfully (${action})` });
});

module.exports = router;
