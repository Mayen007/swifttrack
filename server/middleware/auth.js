// server/middleware/auth.js
const jwt = require('jsonwebtoken');
const { db } = require('../db/database.js');
const { getJwtSecret } = require('../utils/env.js');

/**
 * Validates the Authorization Bearer token, checks revocation, verifies session and token versions,
 * and enforces mandatory first-login password changes.
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication required: No token provided' });
    }

    const secret = getJwtSecret();

    jwt.verify(token, secret, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
        }

        // 1. Revocation Blacklist Check
        if (decoded.jti) {
            const revoked = db.prepare('SELECT id FROM revoked_tokens WHERE jti = ?').get(decoded.jti);
            if (revoked) {
                return res.status(401).json({ error: 'Token has been revoked or signed out. Please log in again.' });
            }
        }

        // 2. Fetch fresh user record from DB
        const user = db.prepare(`
            SELECT u.id, u.username, u.email, u.full_name, u.phone, u.branch_id, u.is_active,
                   u.token_version, u.must_change_password, u.two_factor_enabled,
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

        // 3. Admin Force Logout / Password Change Token Version Invalidation
        if (decoded.tokenVersion !== undefined && Number(decoded.tokenVersion) < Number(user.token_version)) {
            return res.status(401).json({ error: 'Session has been terminated by an administrator or password change. Please log in again.' });
        }

        // 4. Session Validation (if token contains sessionId)
        if (decoded.sessionId) {
            const session = db.prepare(`
                SELECT is_active, datetime(expires_at) <= datetime(CURRENT_TIMESTAMP) as is_expired
                FROM user_sessions
                WHERE id = ?
            `).get(decoded.sessionId);

            if (session) {
                if (!session.is_active || session.is_expired) {
                    return res.status(401).json({ error: 'Session has expired or was terminated. Please log in again.' });
                }
                // Refresh session activity timestamp
                try {
                    db.prepare('UPDATE user_sessions SET last_activity_at = CURRENT_TIMESTAMP WHERE id = ?').run(decoded.sessionId);
                } catch {}
            }
        }

        // 5. First-Login Mandatory Password Change Enforcement
        if (user.must_change_password === 1) {
            // Allow only self password change, user profile fetch, logout, and public config
            const allowedPaths = [
                '/api/auth/change-password',
                '/api/auth/me',
                '/api/auth/logout',
                '/api/auth/config'
            ];
            const isAllowedPath = allowedPaths.some(p => req.originalUrl?.startsWith(p) || req.baseUrl?.startsWith(p));

            if (!isAllowedPath) {
                return res.status(403).json({
                    error: 'Mandatory password change required. You must establish a new password before accessing system tools.',
                    code: 'PASSWORD_CHANGE_REQUIRED',
                    mustChangePassword: true
                });
            }
        }

        // 6. Fetch permissions granted to this role
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
            mustChangePassword: Boolean(user.must_change_password),
            twoFactorEnabled: Boolean(user.two_factor_enabled),
            sessionId: decoded.sessionId || null,
            jti: decoded.jti || null,
            tokenVersion: user.token_version,
            permissions
        };

        next();
    });
}

const { SCOPES, AUTHORIZATION_MATRIX, checkPermission } = require('../config/permissions.js');

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
                error: `Forbidden: Action requires one of the following roles: [${allowedRoles.join(', ')}]. Your current role is '${req.user.roleDisplayName || req.user.roleName}'.`
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
        if (!req.user.permissions || !req.user.permissions.includes(permissionCode)) {
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
    const attemptedBranchId = req.query.branch_id || req.params.branchId || req.params.branch_id || (req.body && req.body.branch_id);

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

/**
 * Canonical unified authorization middleware based on the Role x Resource x Action x Branch matrix
 *
 * @param {string} resource - e.g. 'pos', 'inventory', 'dispatch', 'delivery', 'users', 'reports', 'expenses', 'branches', 'audit'
 * @param {string} action - e.g. 'create', 'view', 'refund_approve', 'adjust_approve', etc.
 * @param {object} [options]
 * @param {string} [options.entityTable] - DB table name to query for record-level branch/ownership checks
 * @param {string} [options.idParam='id'] - req.params parameter holding entity ID
 * @param {string} [options.idBody] - req.body parameter holding entity ID
 * @param {string} [options.branchColumn='branch_id'] - column on entity indicating branch
 * @param {string} [options.ownerColumn] - column on entity indicating user ownership
 * @param {string} [options.driverColumn='driver_id'] - column on entity indicating driver ID
 * @param {boolean} [options.isTransfer=false] - whether this is an inter-branch transfer
 * @param {boolean} [options.preventSelfApproval=false] - prevent approving own request (separation of duties)
 */
function authorize(resource, action, options = {}) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const context = {};
        let targetBranchId = req.query.branch_id || req.params.branchId || req.params.branch_id || (req.body && req.body.branch_id);
        let entityOwnerUserId = null;
        let entityDriverId = null;

        // If options.entityTable is provided and an ID is present in params or body
        const entityId = (options.idParam && req.params[options.idParam])
            || (!options.idParam && req.params.id)
            || (options.idBody && req.body && req.body[options.idBody]);

        if (options.entityTable && entityId) {
            try {
                const entity = db.prepare(`SELECT * FROM ${options.entityTable} WHERE id = ?`).get(entityId);
                if (!entity) {
                    return res.status(404).json({ error: `${options.entityTable} record not found.` });
                }
                req.targetEntity = entity;

                const bCol = options.branchColumn || 'branch_id';
                if (entity[bCol] !== undefined && entity[bCol] !== null) {
                    targetBranchId = entity[bCol];
                }

                if (options.ownerColumn && entity[options.ownerColumn] !== undefined) {
                    entityOwnerUserId = entity[options.ownerColumn];
                }

                const dCol = options.driverColumn || 'driver_id';
                if (entity[dCol] !== undefined) {
                    entityDriverId = entity[dCol];
                }
            } catch (err) {
                console.error(`Error resolving entity ${options.entityTable} #${entityId}:`, err);
            }
        }

        // Inter-branch transfers special handling
        if (options.isTransfer) {
            context.isTransfer = true;
            if (entityId) {
                const trf = db.prepare('SELECT source_branch_id, target_branch_id FROM stock_transfers WHERE id = ?').get(entityId);
                if (trf) {
                    context.sourceBranchId = trf.source_branch_id;
                    context.targetBranchId = trf.target_branch_id;
                    req.targetEntity = trf;
                }
            } else if (req.body && req.body.source_branch_id && req.body.target_branch_id) {
                context.sourceBranchId = req.body.source_branch_id;
                context.targetBranchId = req.body.target_branch_id;
            }
        }

        // Driver context
        if (req.user.roleName === 'DRIVER') {
            const driverRec = db.prepare('SELECT id FROM drivers WHERE user_id = ?').get(req.user.id);
            context.userDriverId = driverRec ? driverRec.id : null;
            if (entityDriverId) {
                context.driverId = entityDriverId;
            }
        }

        if (targetBranchId != null) context.branchId = targetBranchId;
        if (entityOwnerUserId != null) context.ownerUserId = entityOwnerUserId;

        // Perform matrix authorization check
        const authResult = checkPermission(req.user, resource, action, context);

        if (!authResult.granted) {
            return res.status(403).json({
                error: authResult.reason,
                code: 'FORBIDDEN_AUTHORIZATION',
                resource,
                action,
                scope: authResult.scope
            });
        }

        // Separation of duties / self-approval prevention (checked if role is fundamentally authorized)
        if (options.preventSelfApproval && req.user.roleName !== 'SUPER_ADMIN') {
            if (entityOwnerUserId && Number(entityOwnerUserId) === Number(req.user.id)) {
                return res.status(403).json({
                    error: 'Forbidden: Separation of duties violation. You cannot approve your own request.',
                    code: 'SELF_APPROVAL_PROHIBITED'
                });
            }
        }

        // Setup effective branch id on req for downstream route queries
        if (req.user.roleName === 'SUPER_ADMIN') {
            req.effectiveBranchId = targetBranchId ? Number(targetBranchId) : (req.query.branch_id ? Number(req.query.branch_id) : null);
        } else {
            req.effectiveBranchId = req.user.branchId;
        }

        next();
    };
}

module.exports = {
    authenticateToken,
    requireRole,
    requirePermission,
    enforceBranchIsolation,
    authorize,
    SCOPES,
    AUTHORIZATION_MATRIX,
    checkPermission,
    getJwtSecret,
    get JWT_SECRET() {
        return getJwtSecret();
    }
};
