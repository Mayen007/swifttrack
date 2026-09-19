// server/routes/auth/sessions.js
// Session Management and Login History Audit Routes
const express = require('express');
const router = express.Router();
const { db } = require('../../db/database.js');
const { authenticateToken } = require('../../middleware/auth.js');

/**
 * List active sessions for current authenticated user
 */
router.get('/sessions', authenticateToken, (req, res) => {
    const sessions = db.prepare(`
        SELECT id, ip_address, user_agent, device_info, is_active, last_activity_at, created_at, expires_at,
               datetime(expires_at) <= datetime(CURRENT_TIMESTAMP) as is_expired
        FROM user_sessions
        WHERE user_id = ? AND is_active = 1
        ORDER BY last_activity_at DESC
    `).all(req.user.id);

    const formatted = sessions.map(s => ({
        ...s,
        isCurrent: s.id === req.user.sessionId
    }));

    res.json(formatted);
});

/**
 * Terminate a specific session by ID
 */
router.delete('/sessions/:id', authenticateToken, (req, res) => {
    const targetSessionId = req.params.id;

    db.prepare('UPDATE user_sessions SET is_active = 0 WHERE id = ? AND user_id = ?').run(targetSessionId, req.user.id);

    res.json({ message: 'Session terminated' });
});

/**
 * Terminate all sessions EXCEPT the current active session
 */
router.delete('/sessions', authenticateToken, (req, res) => {
    if (req.user.sessionId) {
        db.prepare('UPDATE user_sessions SET is_active = 0 WHERE user_id = ? AND id != ?').run(req.user.id, req.user.sessionId);
    } else {
        db.prepare('UPDATE user_sessions SET is_active = 0 WHERE user_id = ?').run(req.user.id);
    }

    res.json({ message: 'All other sessions have been terminated' });
});

/**
 * Audit: Retrieve recent login attempts for the authenticated user
 */
router.get('/login-history', authenticateToken, (req, res) => {
    const history = db.prepare(`
        SELECT id, username_attempted, status, failure_reason, ip_address, user_agent, created_at
        FROM login_history
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 25
    `).all(req.user.id);

    res.json(history);
});

module.exports = router;
