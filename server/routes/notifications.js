// server/routes/notifications.js
const express = require('express');
const router = express.Router();
const { db } = require('../db/database.js');
const { authenticateToken } = require('../middleware/auth.js');

// GET /api/notifications - List notifications for current user/branch
router.get('/', authenticateToken, (req, res) => {
    const branchId = req.user.branchId;
    const userId = req.user.id;

    let query = `
        SELECT n.*, b.name as branch_name
        FROM notifications n
        LEFT JOIN branches b ON n.branch_id = b.id
        WHERE (n.user_id = ? OR (n.user_id IS NULL AND (n.branch_id = ? OR n.branch_id IS NULL)))
        ORDER BY n.id DESC LIMIT 50
    `;

    const notifications = db.prepare(query).all(userId, branchId);
    const unreadCount = notifications.filter(n => !n.is_read).length;

    res.json({
        unread_count: unreadCount,
        notifications
    });
});

// PATCH /api/notifications/:id/read - Mark notification as read
router.patch('/:id/read', authenticateToken, (req, res) => {
    const notifId = Number(req.params.id);
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(notifId);
    res.json({ message: 'Marked as read' });
});

// POST /api/notifications/read-all - Mark all as read
router.post('/read-all', authenticateToken, (req, res) => {
    const branchId = req.user.branchId;
    const userId = req.user.id;

    db.prepare(`
        UPDATE notifications
        SET is_read = 1
        WHERE is_read = 0 AND (user_id = ? OR (user_id IS NULL AND (branch_id = ? OR branch_id IS NULL)))
    `).run(userId, branchId);

    res.json({ message: 'All notifications marked as read' });
});

module.exports = router;
