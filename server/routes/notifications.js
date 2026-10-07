// server/routes/notifications.js
const express = require('express');
const router = express.Router();
const dbAdapter = require('../db/dbAdapter.js');
const { authenticateToken } = require('../middleware/auth.js');

// GET /api/notifications - List notifications for current user/branch
router.get('/', authenticateToken, async (req, res) => {
    try {
        const branchId = req.user.branchId;
        const userId = req.user.id;

        let query = `
            SELECT n.*, b.name as branch_name
            FROM notifications n
            LEFT JOIN branches b ON n.branch_id = b.id
            WHERE (n.user_id = ? OR (n.user_id IS NULL AND (n.branch_id = ? OR n.branch_id IS NULL)))
            ORDER BY n.id DESC LIMIT 50
        `;

        const notifications = await dbAdapter.all(query, [userId, branchId]);
        const unreadCount = notifications.filter(n => !n.is_read || n.is_read === 0 || n.is_read === 'false').length;

        res.json({
            unread_count: unreadCount,
            notifications
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/notifications/:id/read - Mark notification as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
    try {
        const notifId = Number(req.params.id);
        await dbAdapter.run('UPDATE notifications SET is_read = true WHERE id = ?', [notifId]);
        res.json({ message: 'Marked as read' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/notifications/read-all - Mark all as read
router.post('/read-all', authenticateToken, async (req, res) => {
    try {
        const branchId = req.user.branchId;
        const userId = req.user.id;

        await dbAdapter.run(`
            UPDATE notifications
            SET is_read = true
            WHERE is_read = false AND (user_id = ? OR (user_id IS NULL AND (branch_id = ? OR branch_id IS NULL)))
        `, [userId, branchId]);

        res.json({ message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
