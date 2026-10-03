// server/routes/audit.js
const express = require('express');
const router = express.Router();
const auditRepository = require('../repositories/auditRepository.js');
const { authenticateToken, authorize } = require('../middleware/auth.js');

// GET /api/audit - View append-only audit trail
router.get('/', authenticateToken, authorize('audit', 'view_own'), async (req, res) => {
    try {
        const { resource, action, date } = req.query;

        const filters = {
            branchId: req.effectiveBranchId,
            resource,
            action,
            date
        };

        const logs = await auditRepository.queryWithJoins(filters);

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
    } catch (err) {
        console.error('Audit query error:', err);
        res.status(500).json({ error: 'Failed to retrieve audit trail' });
    }
});

// GET /api/audit/failed-logins - View failed login attempt telemetry
router.get('/failed-logins', authenticateToken, authorize('audit', 'failed_logins'), async (req, res) => {
    try {
        const branchId = req.user.roleName !== 'SUPER_ADMIN' ? req.user.branchId : null;
        const logs = await auditRepository.queryFailedLogins({ branchId });
        res.json(logs);
    } catch (err) {
        console.error('Failed logins query error:', err);
        res.status(500).json({ error: 'Failed to retrieve failed login logs' });
    }
});

module.exports = router;

