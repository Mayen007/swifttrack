// server/middleware/auth.js
const jwt = require('jsonwebtoken');
const { db } = require('../db/database.js');

const JWT_SECRET = process.env.JWT_SECRET || 'swifttrack_jwt_super_secret_production_key_2026';

/**
 * Validates the Authorization Bearer token and hydrates user permissions
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication required: No token provided' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token. Please log in again.' });
        }

        // Fetch fresh user record from DB to verify user is active and get latest role/branch
        const user = db.prepare(`
            SELECT u.id, u.username, u.email, u.full_name, u.phone, u.branch_id, u.is_active,
                   r.name as role_name, r.display_name as role_display_name,
                   b.name as branch_name, b.code as branch_code
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN branches b ON u.branch_id = b.id
            WHERE u.id = ?
        `).get(decoded.id);

        if (!user || !user.is_active) {
            return res.status(403).json({ error: 'User account is inactive or no longer exists' });
        }

        // Fetch permissions granted to this role
        const permissionsRows = db.prepare(`
            SELECT p.code
            FROM role_permissions rp
            JOIN permissions p ON rp.permission_id = p.id
            JOIN roles r ON rp.role_id = r.id
            WHERE r.name = ?
        `).all(user.role_name);

        const permissions = permissionsRows.map(r => r.code);

        req.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.full_name,
            phone: user.phone,
            branchId: user.branch_id,
            branchName: user.branch_name,
            branchCode: user.branch_code,
            roleName: user.role_name,
            roleDisplayName: user.role_display_name,
            permissions
        };

        next();
    });
}

/**
 * Restricts route to specific roles
 * @param  {...string} allowedRoles
 */
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (!allowedRoles.includes(req.user.roleName)) {
            return res.status(403).json({
                error: `Forbidden: Action requires one of the following roles: [${allowedRoles.join(', ')}]. Your current role is '${req.user.roleDisplayName}'.`
            });
        }
        next();
    };
}

/**
 * Restricts route based on granular permission code
 * @param {string} permissionCode
 */
function requirePermission(permissionCode) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        // Super Admin bypasses individual permission checks
        if (req.user.roleName === 'SUPER_ADMIN') {
            return next();
        }
        if (!req.user.permissions.includes(permissionCode)) {
            return res.status(403).json({
                error: `Forbidden: Missing required permission '${permissionCode}'.`
            });
        }
        next();
    };
}

/**
 * Strictly enforces branch-level isolation
 * If non-Super Admin attempts to query or mutate a different branch, immediately reject with 403 Forbidden
 */
function enforceBranchIsolation(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    // Super Admin has global cross-branch authority
    if (req.user.roleName === 'SUPER_ADMIN') {
        // Can filter by branch_id if provided in query, otherwise null = all branches
        req.effectiveBranchId = req.query.branch_id ? Number(req.query.branch_id) : null;
        return next();
    }

    // For all operational branch roles (Branch Manager, Dispatcher, Cashier, Driver):
    const attemptedBranchId = req.query.branch_id || req.params.branchId || (req.body && req.body.branch_id);

    if (attemptedBranchId !== undefined && attemptedBranchId !== null && attemptedBranchId !== '') {
        if (Number(attemptedBranchId) !== Number(req.user.branchId)) {
            return res.status(403).json({
                error: `Forbidden: Cross-branch access denied. You are restricted to branch ${req.user.branchId} (${req.user.branchName || 'Assigned Branch'}). Attempted access to branch ${attemptedBranchId} is unauthorized.`,
                assignedBranchId: req.user.branchId,
                attemptedBranchId: Number(attemptedBranchId)
            });
        }
    }

    // For non-super admins, lock the query scope to their assigned branch
    req.effectiveBranchId = req.user.branchId;
    next();
}

module.exports = {
    authenticateToken,
    requireRole,
    requirePermission,
    enforceBranchIsolation,
    JWT_SECRET
};
