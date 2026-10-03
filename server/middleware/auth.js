// server/middleware/auth.js
// Enterprise Security & Identity Layer: JWT Authentication, Sessions & RBAC
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../utils/env.js');
const dbAdapter = require('../db/dbAdapter.js');
const userRepository = require('../repositories/userRepository.js');
const sessionRepository = require('../repositories/sessionRepository.js');
const { SCOPES, AUTHORIZATION_MATRIX, checkPermission } = require('../config/permissions.js');

/**
 * Validates the Authorization Bearer token, checks revocation, verifies session and token versions,
 * and enforces mandatory first-login password changes.
 */
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication required: No token provided' });
    }

    const secret = getJwtSecret();

    let decoded;
    try {
        decoded = jwt.verify(token, secret);
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
    }

    try {
        // 1. Revocation Blacklist Check via SessionRepository
        if (decoded.jti) {
            const isRevoked = await sessionRepository.isTokenRevoked(decoded.jti);
            if (isRevoked) {
                return res.status(401).json({ error: 'Token has been revoked or signed out. Please log in again.' });
            }
        }

        // 2. Fetch fresh user record from DB via UserRepository
        const user = await userRepository.findById(decoded.id);

        if (!user || !user.is_active) {
            return res.status(403).json({ error: 'User account is inactive or no longer exists' });
        }

        // 3. Admin Force Logout / Password Change Token Version Invalidation
        if (decoded.tokenVersion !== undefined && Number(decoded.tokenVersion) < Number(user.token_version)) {
            return res.status(401).json({ error: 'Session has been terminated by an administrator or password change. Please log in again.' });
        }

        // 4. Session Validation (if token contains sessionId)
        if (decoded.sessionId) {
            const session = await sessionRepository.findSessionById(decoded.sessionId);
            if (session) {
                if (!session.is_active || session.is_expired) {
                    return res.status(401).json({ error: 'Session has expired or was terminated. Please log in again.' });
                }
                // Refresh session activity timestamp
                try {
                    await sessionRepository.touchSession(decoded.sessionId);
                } catch {}
            }
        }

        // 5. First-Login Mandatory Password Change Enforcement
        if (user.must_change_password) {
            const allowedPaths = [
                '/api/auth/change-password',
                '/api/auth/me',
                '/api/auth/logout',
                '/api/auth/config',
                '/api/v1/auth/change-password',
                '/api/v1/auth/me',
                '/api/v1/auth/logout',
                '/api/v1/auth/config'
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
        const permissions = await userRepository.getPermissionsByRoleName(user.role_name);

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
    } catch (err) {
        console.error('[Auth Middleware Error]', err);
        return res.status(500).json({ error: 'Authentication internal error' });
    }
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

// Whitelist of valid table names to prevent SQL injection in dynamic entity queries
const VALID_ENTITY_TABLES = new Set([
    'shipments', 'parcels', 'shipment_legs', 'transport_runs', 'manifests',
    'scan_events', 'deliveries', 'cod_settlements', 'stock_transfers',
    'orders', 'inventory', 'refund_requests', 'expenses', 'procurement_orders',
    'pos_shifts', 'products', 'branches', 'hubs', 'users'
]);

/**
 * Canonical unified authorization middleware based on the Role x Resource x Action x Branch matrix
 */
function authorize(resource, action, options = {}) {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // 1. Role-level baseline check
        const baselineCheck = checkPermission(req.user, resource, action, {});
        if (!baselineCheck.granted && baselineCheck.scope === SCOPES.DENIED) {
            return res.status(403).json({
                error: baselineCheck.reason,
                code: 'FORBIDDEN_AUTHORIZATION',
                resource,
                action,
                scope: baselineCheck.scope
            });
        }

        const context = {};
        let targetBranchId = req.query.branch_id || req.params.branchId || req.params.branch_id || (req.body && req.body.branch_id);
        let entityOwnerUserId = null;
        let entityDriverId = null;

        const entityId = (options.idParam && req.params[options.idParam])
            || (!options.idParam && req.params.id)
            || (options.idBody && req.body && req.body[options.idBody]);

        if (options.entityTable && entityId) {
            if (!VALID_ENTITY_TABLES.has(options.entityTable)) {
                return res.status(500).json({ error: `Security exception: Invalid entityTable '${options.entityTable}' in authorize middleware.` });
            }
            try {
                let entity = await dbAdapter.get(`SELECT * FROM ${options.entityTable} WHERE id = ?`, [entityId]);
                if (!entity) {
                    try {
                        const { db: sqliteDb } = require('../db/database.js');
                        entity = sqliteDb.prepare(`SELECT * FROM ${options.entityTable} WHERE id = ?`).get(entityId);
                    } catch {}
                }
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
                const trf = await dbAdapter.get('SELECT source_branch_id, target_branch_id FROM stock_transfers WHERE id = ?', [entityId]);
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
            const driverRec = await dbAdapter.get('SELECT id FROM drivers WHERE user_id = ?', [req.user.id]);
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

        // Separation of duties / self-approval prevention
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
