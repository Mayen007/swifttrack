// server/routes/refunds.js
const express = require('express');
const router = express.Router();
const dbAdapter = require('../db/dbAdapter.js');
const { authenticateToken, requireRole, enforceBranchIsolation, authorize } = require('../middleware/auth.js');
const { logAuditEvent } = require('../middleware/audit.js');

// GET /api/refunds or /api/refunds/queue - List refund requests (Branch Manager sees own branch, Super Admin sees all)
router.get(['/', '/queue'], authenticateToken, authorize('pos', 'view'), async (req, res, next) => {
    try {
        let query = `
            SELECT rr.*, s.sale_number, s.total_amount as sale_total, s.created_at as sale_date,
                   c.full_name as customer_name,
                   req_u.full_name as requested_by_name,
                   app_u.full_name as approved_by_name,
                   b.name as branch_name
            FROM refund_requests rr
            JOIN sales s ON rr.sale_id = s.id
            JOIN customers c ON s.customer_id = c.id
            JOIN users req_u ON rr.cashier_user_id = req_u.id
            JOIN branches b ON rr.branch_id = b.id
            LEFT JOIN users app_u ON rr.approved_by_user_id = app_u.id
        `;
        const params = [];

        if (req.effectiveBranchId) {
            query += ' WHERE rr.branch_id = ?';
            params.push(req.effectiveBranchId);
        }

        if (req.query.status) {
            query += req.effectiveBranchId ? ' AND rr.status = ?' : ' WHERE rr.status = ?';
            params.push(req.query.status);
        }

        query += ' ORDER BY rr.id DESC';

        const queue = await dbAdapter.all(query, params);
        res.json(queue);
    } catch (err) {
        next(err);
    }
});

// POST /api/refunds/request - Cashier or Branch Manager requests a refund
router.post('/request', authenticateToken, authorize('pos', 'refund_request'), async (req, res, next) => {
    try {
        const { sale_number, amount, reason } = req.body;

        if (!sale_number || !amount || !reason) {
            return res.status(400).json({ error: 'Sale number, amount, and reason are required.' });
        }

        const sale = await dbAdapter.get('SELECT * FROM sales WHERE sale_number = ?', [sale_number.trim()]);
        if (!sale) {
            return res.status(404).json({ error: 'Sale record not found.' });
        }

        // Branch isolation
        if (req.user.roleName !== 'SUPER_ADMIN' && sale.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Cannot request refunds for sales of another branch.' });
        }

        const refundAmt = Number(amount);
        if (refundAmt <= 0 || refundAmt > Number(sale.total_amount)) {
            return res.status(400).json({ error: `Refund amount must be between KSh 1.00 and original sale total of KSh ${sale.total_amount}.` });
        }

        const reqNumber = `REF-REQ-${Date.now().toString().slice(-6)}`;
        let newRequestId = null;

        await dbAdapter.withTransaction(async (tx) => {
            const insResult = await tx.run(`
                INSERT INTO refund_requests (
                    refund_request_number, branch_id, sale_id, cashier_user_id,
                    amount, reason, status
                ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL')
            `, [reqNumber, sale.branch_id, sale.id, req.user.id, refundAmt, reason.trim()]);

            newRequestId = insResult.insertId;

            // Notify Branch Manager
            await tx.run(`
                INSERT INTO notifications (branch_id, type, title, message, reference_type, reference_id)
                VALUES (?, 'REFUND_REQUEST', 'New Customer Refund Request', ?, 'REFUND', ?)
            `, [
                sale.branch_id,
                `Cashier ${req.user.fullName} requested refund of KSh ${refundAmt.toFixed(2)} for ${sale_number}. Reason: ${reason}`,
                reqNumber
            ]);

            logAuditEvent({
                userId: req.user.id,
                role: req.user.roleName,
                action: 'REQUEST_REFUND',
                resource: 'REFUND',
                resourceId: reqNumber,
                branchId: sale.branch_id,
                newValue: { sale_number, amount: refundAmt, reason },
                reason: 'Submitted customer refund request'
            });
        });

        res.status(201).json({
            id: newRequestId,
            refund_request_number: reqNumber,
            status: 'PENDING_APPROVAL',
            message: 'Refund request submitted and routed to Branch Manager approval inbox.'
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/refunds/:id/approve - Branch Manager or Super Admin approves refund
router.post('/:id/approve', authenticateToken, authorize('pos', 'refund_approve', { entityTable: 'refund_requests', preventSelfApproval: true, ownerColumn: 'cashier_user_id' }), async (req, res, next) => {
    try {
        const requestId = Number(req.params.id);
        const refundReq = req.targetEntity || await dbAdapter.get('SELECT * FROM refund_requests WHERE id = ?', [requestId]);

        if (!refundReq) return res.status(404).json({ error: 'Refund request not found.' });
        if (refundReq.status !== 'PENDING_APPROVAL') {
            return res.status(400).json({ error: `Refund request is already ${refundReq.status}.` });
        }

        // Branch isolation
        if (req.user.roleName !== 'SUPER_ADMIN' && refundReq.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Cannot approve refunds for another branch.' });
        }

        // Security rule: Cashier cannot approve their own refund even if given role bypass
        if (Number(refundReq.cashier_user_id) === Number(req.user.id) && req.user.roleName !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Forbidden: Separation of duties violation. You cannot approve your own refund request.' });
        }

        const sale = await dbAdapter.get('SELECT * FROM sales WHERE id = ?', [refundReq.sale_id]);
        const saleItems = await dbAdapter.all('SELECT * FROM sale_items WHERE sale_id = ?', [refundReq.sale_id]);
        const warehouse = await dbAdapter.get('SELECT id FROM warehouses WHERE branch_id = ? AND is_active = true ORDER BY id ASC', [refundReq.branch_id]);

        const refundNumber = `REF-${Date.now().toString().slice(-6)}`;

        await dbAdapter.withTransaction(async (tx) => {
            // 1. Mark request approved
            await tx.run(`
                UPDATE refund_requests
                SET status = 'APPROVED', approved_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [req.user.id, requestId]);

            // 2. Insert refunds record
            await tx.run(`
                INSERT INTO refunds (
                    refund_number, branch_id, refund_request_id, sale_id,
                    amount, payment_method, reason, processed_by_user_id
                ) VALUES (?, ?, ?, ?, ?, 'ORIGINAL_PAYMENT', ?, ?)
            `, [refundNumber, refundReq.branch_id, requestId, refundReq.sale_id, refundReq.amount, refundReq.reason, req.user.id]);

            // 3. Update sale status
            await tx.run("UPDATE sales SET payment_status = 'REFUNDED' WHERE id = ?", [refundReq.sale_id]);

            // 4. Return goods to inventory & log movement
            if (warehouse && saleItems.length > 0) {
                for (const sItem of saleItems) {
                    const curInv = await tx.get(
                        'SELECT quantity_on_hand, quantity_available FROM inventory WHERE warehouse_id = ? AND product_id = ?',
                        [warehouse.id, sItem.product_id]
                    );
                    const prevOnHand = curInv ? Number(curInv.quantity_on_hand) : 0;
                    const newOnHand = prevOnHand + Number(sItem.quantity);
                    const newAvailable = (curInv ? Number(curInv.quantity_available) : 0) + Number(sItem.quantity);

                    await tx.run(
                        'UPDATE inventory SET quantity_on_hand = ?, quantity_available = ? WHERE warehouse_id = ? AND product_id = ?',
                        [newOnHand, newAvailable, warehouse.id, sItem.product_id]
                    );

                    await tx.run(`
                        INSERT INTO inventory_movements (
                            branch_id, warehouse_id, product_id, movement_type,
                            quantity_change, previous_quantity, new_quantity,
                            reference_type, reference_id, reason, user_id
                        ) VALUES (?, ?, ?, 'SALE_RETURN', ?, ?, ?, 'REFUND', ?, ?, ?)
                    `, [
                        refundReq.branch_id, warehouse.id, sItem.product_id,
                        sItem.quantity, prevOnHand, newOnHand, refundReq.refund_request_number,
                        `Customer Return Refund [${refundReq.refund_request_number}]: ${refundReq.reason}`, req.user.id
                    ]);
                }
            }

            // Notify Cashier
            await tx.run(`
                INSERT INTO notifications (branch_id, user_id, type, title, message, reference_type, reference_id)
                VALUES (?, ?, 'REFUND_APPROVED', 'Refund Request Approved', ?, 'REFUND', ?)
            `, [
                refundReq.branch_id, refundReq.cashier_user_id,
                `Refund request ${refundReq.refund_request_number} for KSh ${refundReq.amount} was approved by ${req.user.fullName}.`,
                String(requestId)
            ]);

            logAuditEvent({
                userId: req.user.id,
                role: req.user.roleName,
                action: 'APPROVE_REFUND',
                resource: 'REFUND',
                resourceId: refundNumber,
                branchId: refundReq.branch_id,
                newValue: { refund_number: refundNumber, amount: refundReq.amount, approved_by: req.user.username },
                reason: 'Branch Manager approved customer refund'
            });
        });

        res.json({ message: 'Refund approved successfully. Stock returned to warehouse ledger.', refund_number: refundNumber });
    } catch (err) {
        next(err);
    }
});

// POST /api/refunds/:id/reject - Branch Manager rejects refund request
router.post('/:id/reject', authenticateToken, authorize('pos', 'refund_approve', { entityTable: 'refund_requests' }), async (req, res, next) => {
    try {
        const requestId = Number(req.params.id);
        const { rejection_reason } = req.body;

        const refundReq = await dbAdapter.get('SELECT * FROM refund_requests WHERE id = ?', [requestId]);
        if (!refundReq) return res.status(404).json({ error: 'Refund request not found.' });

        if (req.user.roleName !== 'SUPER_ADMIN' && refundReq.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Cannot reject refunds for another branch.' });
        }

        await dbAdapter.run(`
            UPDATE refund_requests
            SET status = 'REJECTED', rejection_reason = ?, approved_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [rejection_reason || 'Rejected by management', req.user.id, requestId]);

        logAuditEvent({
            userId: req.user.id,
            role: req.user.roleName,
            action: 'REJECT_REFUND',
            resource: 'REFUND',
            resourceId: refundReq.refund_request_number,
            branchId: refundReq.branch_id,
            reason: `Refund rejected: ${rejection_reason}`
        });

        res.json({ message: 'Refund request marked as rejected.' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
