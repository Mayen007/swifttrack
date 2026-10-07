// server/routes/expenses.js
const express = require('express');
const router = express.Router();
const dbAdapter = require('../db/dbAdapter.js');
const { authenticateToken, requireRole, enforceBranchIsolation, authorize } = require('../middleware/auth.js');
const { logAuditEvent } = require('../middleware/audit.js');

// GET /api/expenses - List expenses (Branch scoped or all for Super Admin)
router.get('/', authenticateToken, authorize('expenses', 'create'), async (req, res, next) => {
    try {
        let query = `
            SELECT e.*, b.name as branch_name,
                   u_cr.full_name as created_by_name,
                   u_ap.full_name as approved_by_name
            FROM expenses e
            JOIN branches b ON e.branch_id = b.id
            JOIN users u_cr ON e.created_by_user_id = u_cr.id
            LEFT JOIN users u_ap ON e.approved_by_user_id = u_ap.id
        `;
        const params = [];

        if (req.effectiveBranchId) {
            query += ' WHERE e.branch_id = ?';
            params.push(req.effectiveBranchId);
        }

        if (req.query.status) {
            query += req.effectiveBranchId ? ' AND e.status = ?' : ' WHERE e.status = ?';
            params.push(req.query.status);
        }

        query += ' ORDER BY e.id DESC';

        const expenses = await dbAdapter.all(query, params);
        res.json(expenses);
    } catch (err) {
        next(err);
    }
});

// POST /api/expenses - Submit branch expense
router.post('/', authenticateToken, authorize('expenses', 'create'), async (req, res, next) => {
    try {
        const branchId = req.user.branchId || (req.body.branch_id ? Number(req.body.branch_id) : 1);

        if (req.user.roleName !== 'SUPER_ADMIN' && branchId !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Cannot create expenses for another branch.' });
        }

        const { category, description, amount, payee, payment_method } = req.body;
        if (!category || !description || !amount || !payee) {
            return res.status(400).json({ error: 'Category, description, amount, and payee are required.' });
        }

        const expNumber = `EXP-${Date.now().toString().slice(-6)}`;
        const amt = Number(amount);
        const isAutoApproved = req.user.roleName === 'SUPER_ADMIN' || (req.user.roleName === 'BRANCH_MANAGER' && amt <= 10000);
        const status = isAutoApproved ? 'APPROVED' : 'PENDING_APPROVAL';
        const approvedBy = isAutoApproved ? req.user.id : null;
        let newExpenseId = null;

        await dbAdapter.withTransaction(async (tx) => {
            const insResult = await tx.run(`
                INSERT INTO expenses (
                    expense_number, branch_id, category, description,
                    amount, payee, payment_method, status,
                    created_by_user_id, approved_by_user_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                expNumber, branchId, category, description.trim(),
                amt, payee.trim(), payment_method || 'CASH', status,
                req.user.id, approvedBy
            ]);

            newExpenseId = insResult.insertId;

            logAuditEvent({
                userId: req.user.id,
                role: req.user.roleName,
                action: 'CREATE_EXPENSE',
                resource: 'EXPENSE',
                resourceId: expNumber,
                branchId,
                newValue: { category, amount: amt, payee, status },
                reason: 'Submitted operational expense'
            });
        });

        res.status(201).json({
            id: newExpenseId,
            expense_number: expNumber,
            status,
            message: 'Expense recorded successfully.'
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/expenses/:id/approve - Approve expense (Branch Manager / Super Admin)
router.post('/:id/approve', authenticateToken, authorize('expenses', 'approve', { entityTable: 'expenses', idParam: 'id', preventSelfApproval: true, ownerColumn: 'created_by_user_id' }), async (req, res, next) => {
    try {
        const expenseId = Number(req.params.id);
        const exp = req.targetEntity || await dbAdapter.get('SELECT * FROM expenses WHERE id = ?', [expenseId]);

        if (!exp) return res.status(404).json({ error: 'Expense not found' });
        if (req.user.roleName !== 'SUPER_ADMIN' && exp.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Cannot approve expenses for another branch.' });
        }

        // Separation of duties: Creator cannot approve their own expense voucher
        if (Number(exp.created_by_user_id) === Number(req.user.id) && req.user.roleName !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Forbidden: Separation of duties violation. You cannot approve your own expense voucher.' });
        }

        await dbAdapter.run(`
            UPDATE expenses
            SET status = 'APPROVED', approved_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [req.user.id, expenseId]);

        logAuditEvent({
            userId: req.user.id,
            role: req.user.roleName,
            action: 'APPROVE_EXPENSE',
            resource: 'EXPENSE',
            resourceId: exp.expense_number,
            branchId: exp.branch_id,
            reason: 'Approved operational branch expense'
        });

        res.json({ message: 'Expense approved successfully.' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
