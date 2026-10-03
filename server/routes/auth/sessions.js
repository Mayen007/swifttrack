// server/routes/auth/sessions.js
// Session Management and Login History Audit Routes
const express = require('express');
const router = express.Router();
const dbAdapter = require('../../db/dbAdapter.js');
const { authenticateToken } = require('../../middleware/auth.js');

/**
 * List active sessions for current authenticated user
 */
router.get('/sessions', authenticateToken, async (req, res) => {
    try {
        const sessions = await dbAdapter.all(`
            SELECT id, ip_address, user_agent, device_info, is_active, last_activity_at, created_at, expires_at,
                   (expires_at <= CURRENT_TIMESTAMP) as is_expired
            FROM user_sessions
            WHERE user_id = ? AND is_active = true
            ORDER BY last_activity_at DESC
        `, [req.user.id]);

        const formatted = sessions.map(s => ({
            ...s,
            isCurrent: s.id === req.user.sessionId
        }));

        res.json(formatted);
    } catch (err) {
        console.error('List sessions error:', err);
        res.status(500).json({ error: 'Failed to retrieve sessions' });
    }
});

/**
 * Terminate a specific session by ID
 */
router.delete('/sessions/:id', authenticateToken, async (req, res) => {
    const targetSessionId = req.params.id;

    try {
        await dbAdapter.run('UPDATE user_sessions SET is_active = false WHERE id = ? AND user_id = ?', [targetSessionId, req.user.id]);
        res.json({ message: 'Session terminated' });
    } catch (err) {
        console.error('Terminate session error:', err);
        res.status(500).json({ error: 'Failed to terminate session' });
    }
});

/**
 * Terminate all sessions EXCEPT the current active session
 */
router.delete('/sessions', authenticateToken, async (req, res) => {
    try {
        if (req.user.sessionId) {
            await dbAdapter.run('UPDATE user_sessions SET is_active = false WHERE user_id = ? AND id != ?', [req.user.id, req.user.sessionId]);
        } else {
            await dbAdapter.run('UPDATE user_sessions SET is_active = false WHERE user_id = ?', [req.user.id]);
        }

        res.json({ message: 'All other sessions have been terminated' });
    } catch (err) {
        console.error('Terminate sessions error:', err);
        res.status(500).json({ error: 'Failed to terminate sessions' });
    }
});

/**
 * Audit: Retrieve recent login attempts for the authenticated user
 */
router.get('/login-history', authenticateToken, async (req, res) => {
    try {
        const history = await dbAdapter.all(`
            SELECT id, username_attempted, status, failure_reason, ip_address, user_agent, created_at
            FROM login_history
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 25
        `, [req.user.id]);

        res.json(history);
    } catch (err) {
        console.error('Login history error:', err);
        res.status(500).json({ error: 'Failed to retrieve login history' });
    }
});

module.exports = router;
