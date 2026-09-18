// server/routes/audit.js
const express = require('express');
const router = express.Router();
const { db } = require('../db/database.js');
const { authenticateToken, requireRole, enforceBranchIsolation } = require('../middleware/auth.js');

// GET /api/audit - View append-only audit trail
router.get('/', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), enforceBranchIsolation, (req, res) => {
    const { resource, action, date } = req.query;

    let query = `
        SELECT a.*, u.full_name as user_full_name, u.username,
               b.name as branch_name, b.code as branch_code
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
        LEFT JOIN branches b ON a.branch_id = b.id
    `;
    const params = [];
    const where = [];

    if (req.effectiveBranchId) {
        where.push('(a.branch_id = ? OR a.branch_id IS NULL)');
        params.push(req.effectiveBranchId);
    }

    if (resource) {
        where.push('a.resource = ?');
        params.push(resource);
    }

    if (action) {
        where.push('a.action = ?');
        params.push(action);
    }

    if (date) {
        where.push('date(a.created_at) = ?');
        params.push(date);
    }

    if (where.length > 0) {
        query += ' WHERE ' + where.join(' AND ');
    }

    query += ' ORDER BY a.id DESC LIMIT 150';

    const logs = db.prepare(query).all(...params);

    // Format JSON diffs safely
    const formatted = logs.map(l => {
        let prev = l.previous_value;
        let next = l.new_value;
        try { if (prev && typeof prev === 'string') prev = JSON.parse(prev); } catch (_) {}
        try { if (next && typeof next === 'string') next = JSON.parse(next); } catch (_) {}
        return {
            ...l,
            previous_value: prev,
            new_value: next
        };
    });

    res.json(formatted);
});

// GET /api/audit/failed-logins - View failed login attempt telemetry
router.get('/failed-logins', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), (req, res) => {
    let query = `
        SELECT lh.id, lh.user_id, lh.username_attempted, lh.status, lh.failure_reason,
               lh.ip_address, lh.user_agent, lh.created_at, lh.branch_id,
               b.name as branch_name, b.code as branch_code
        FROM login_history lh
        LEFT JOIN branches b ON lh.branch_id = b.id
        WHERE lh.status != 'SUCCESS'
    `;
    const params = [];

    if (req.user.roleName !== 'SUPER_ADMIN') {
        query += ' AND (lh.branch_id = ? OR lh.branch_id IS NULL)';
        params.push(req.user.branchId);
    }

    query += ' ORDER BY lh.created_at DESC LIMIT 100';

    const logs = db.prepare(query).all(...params);
    res.json(logs);
});

module.exports = router;

