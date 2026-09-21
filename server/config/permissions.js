// server/config/permissions.js
/**
 * Canonical Role x Resource x Action x Branch Access Control Matrix
 *
 * Scopes:
 * - 'GLOBAL': Granted across all branches without restriction (Super Admin).
 * - 'OWN_BRANCH': Granted only if target resource's branch_id matches operator's branch_id.
 * - 'OWN_RECORD': Granted only if the target record belongs specifically to the operator (e.g. driver's own delivery).
 * - false: Strictly denied (Vertical or Negative Authorization Block).
 */

const SCOPES = {
    GLOBAL: 'GLOBAL',
    OWN_BRANCH: 'OWN_BRANCH',
    OWN_RECORD: 'OWN_RECORD',
    DENIED: false
};

const AUTHORIZATION_MATRIX = {
    SUPER_ADMIN: {
        pos: {
            create: SCOPES.GLOBAL,
            view: SCOPES.GLOBAL,
            hold: SCOPES.GLOBAL,
            refund_request: SCOPES.GLOBAL,
            refund_approve: SCOPES.GLOBAL
        },
        inventory: {
            view: SCOPES.GLOBAL,
            create: SCOPES.GLOBAL,
            adjust: SCOPES.GLOBAL,
            adjust_request: SCOPES.GLOBAL,
            adjust_approve: SCOPES.GLOBAL,
            transfer_request: SCOPES.GLOBAL,
            transfer_status: SCOPES.GLOBAL,
            receive_stock: SCOPES.GLOBAL,
            stocktake: SCOPES.GLOBAL,
            write_off: SCOPES.GLOBAL,
            batch_manage: SCOPES.GLOBAL,
            serial_manage: SCOPES.GLOBAL
        },
        dispatch: {
            view: SCOPES.GLOBAL,
            create: SCOPES.GLOBAL,
            assign: SCOPES.GLOBAL,
            update: SCOPES.GLOBAL
        },
        delivery: {
            view_own: SCOPES.GLOBAL,
            start: SCOPES.GLOBAL,
            pod_submit: SCOPES.GLOBAL,
            problem: SCOPES.GLOBAL
        },
        users: {
            view: SCOPES.GLOBAL,
            create: SCOPES.GLOBAL,
            edit: SCOPES.GLOBAL,
            manage: SCOPES.GLOBAL
        },
        reports: {
            financial_all: SCOPES.GLOBAL,
            financial_own: SCOPES.GLOBAL,
            shift_own: SCOPES.GLOBAL
        },
        expenses: {
            create: SCOPES.GLOBAL,
            approve: SCOPES.GLOBAL
        },
        branches: {
            view: SCOPES.GLOBAL,
            create: SCOPES.GLOBAL,
            manage: SCOPES.GLOBAL
        },
        audit: {
            view_all: SCOPES.GLOBAL,
            view_own: SCOPES.GLOBAL,
            failed_logins: SCOPES.GLOBAL
        },
        customers: {
            view: SCOPES.GLOBAL,
            create: SCOPES.GLOBAL,
            edit: SCOPES.GLOBAL,
            manage: SCOPES.GLOBAL
        }
    },

    BRANCH_MANAGER: {
        pos: {
            create: SCOPES.OWN_BRANCH,
            view: SCOPES.OWN_BRANCH,
            hold: SCOPES.OWN_BRANCH,
            refund_request: SCOPES.OWN_BRANCH,
            refund_approve: SCOPES.OWN_BRANCH
        },
        inventory: {
            view: SCOPES.OWN_BRANCH,
            create: SCOPES.OWN_BRANCH,
            adjust: SCOPES.OWN_BRANCH,
            adjust_request: SCOPES.OWN_BRANCH,
            adjust_approve: SCOPES.OWN_BRANCH,
            transfer_request: SCOPES.OWN_BRANCH,
            transfer_status: SCOPES.OWN_BRANCH,
            receive_stock: SCOPES.OWN_BRANCH,
            stocktake: SCOPES.OWN_BRANCH,
            write_off: SCOPES.OWN_BRANCH,
            batch_manage: SCOPES.OWN_BRANCH,
            serial_manage: SCOPES.OWN_BRANCH
        },
        dispatch: {
            view: SCOPES.OWN_BRANCH,
            create: SCOPES.OWN_BRANCH,
            assign: SCOPES.OWN_BRANCH,
            update: SCOPES.OWN_BRANCH
        },
        delivery: {
            view_own: SCOPES.OWN_BRANCH,
            start: SCOPES.OWN_BRANCH,
            pod_submit: SCOPES.OWN_BRANCH,
            problem: SCOPES.OWN_BRANCH
        },
        users: {
            view: SCOPES.OWN_BRANCH,
            create: SCOPES.OWN_BRANCH,
            edit: SCOPES.OWN_BRANCH,
            manage: SCOPES.OWN_BRANCH
        },
        reports: {
            financial_all: SCOPES.DENIED,
            financial_own: SCOPES.OWN_BRANCH,
            shift_own: SCOPES.OWN_BRANCH
        },
        expenses: {
            create: SCOPES.OWN_BRANCH,
            approve: SCOPES.OWN_BRANCH
        },
        branches: {
            view: SCOPES.GLOBAL,
            create: SCOPES.DENIED,
            manage: SCOPES.DENIED
        },
        audit: {
            view_all: SCOPES.DENIED,
            view_own: SCOPES.OWN_BRANCH,
            failed_logins: SCOPES.OWN_BRANCH
        },
        customers: {
            view: SCOPES.OWN_BRANCH,
            create: SCOPES.OWN_BRANCH,
            edit: SCOPES.OWN_BRANCH,
            manage: SCOPES.OWN_BRANCH
        }
    },

    DISPATCHER: {
        pos: {
            create: SCOPES.DENIED,
            view: SCOPES.DENIED,
            hold: SCOPES.DENIED,
            refund_request: SCOPES.DENIED,
            refund_approve: SCOPES.DENIED
        },
        inventory: {
            view: SCOPES.OWN_BRANCH,
            adjust_request: SCOPES.DENIED,
            adjust_approve: SCOPES.DENIED,
            transfer_request: SCOPES.DENIED,
            transfer_status: SCOPES.DENIED,
            receive_stock: SCOPES.DENIED,
            stocktake: SCOPES.DENIED,
            write_off: SCOPES.DENIED
        },
        dispatch: {
            view: SCOPES.OWN_BRANCH,
            create: SCOPES.OWN_BRANCH,
            assign: SCOPES.OWN_BRANCH,
            update: SCOPES.OWN_BRANCH
        },
        delivery: {
            view_own: SCOPES.OWN_BRANCH,
            start: SCOPES.OWN_BRANCH,
            pod_submit: SCOPES.OWN_BRANCH,
            problem: SCOPES.OWN_BRANCH
        },
        users: {
            view: SCOPES.DENIED,
            create: SCOPES.DENIED,
            edit: SCOPES.DENIED,
            manage: SCOPES.DENIED
        },
        reports: {
            financial_all: SCOPES.DENIED,
            financial_own: SCOPES.DENIED,
            shift_own: SCOPES.DENIED
        },
        expenses: {
            create: SCOPES.OWN_BRANCH,
            approve: SCOPES.DENIED
        },
        branches: {
            view: SCOPES.GLOBAL,
            create: SCOPES.DENIED,
            manage: SCOPES.DENIED
        },
        audit: {
            view_all: SCOPES.DENIED,
            view_own: SCOPES.DENIED,
            failed_logins: SCOPES.DENIED
        },
        customers: {
            view: SCOPES.OWN_BRANCH,
            create: SCOPES.OWN_BRANCH,
            edit: SCOPES.OWN_BRANCH,
            manage: SCOPES.DENIED
        }
    },

    CASHIER: {
        pos: {
            create: SCOPES.OWN_BRANCH,
            view: SCOPES.OWN_BRANCH,
            hold: SCOPES.OWN_BRANCH,
            refund_request: SCOPES.OWN_BRANCH,
            refund_approve: SCOPES.DENIED
        },
        inventory: {
            view: SCOPES.OWN_BRANCH,
            adjust_request: SCOPES.DENIED,
            adjust_approve: SCOPES.DENIED,
            transfer_request: SCOPES.DENIED,
            transfer_status: SCOPES.DENIED,
            receive_stock: SCOPES.DENIED,
            stocktake: SCOPES.DENIED,
            write_off: SCOPES.DENIED
        },
        dispatch: {
            view: SCOPES.DENIED,
            create: SCOPES.DENIED,
            assign: SCOPES.DENIED,
            update: SCOPES.DENIED
        },
        delivery: {
            view_own: SCOPES.DENIED,
            start: SCOPES.DENIED,
            pod_submit: SCOPES.DENIED,
            problem: SCOPES.DENIED
        },
        users: {
            view: SCOPES.DENIED,
            create: SCOPES.DENIED,
            edit: SCOPES.DENIED,
            manage: SCOPES.DENIED
        },
        reports: {
            financial_all: SCOPES.DENIED,
            financial_own: SCOPES.DENIED,
            shift_own: SCOPES.OWN_RECORD
        },
        expenses: {
            create: SCOPES.OWN_BRANCH,
            approve: SCOPES.DENIED
        },
        branches: {
            view: SCOPES.GLOBAL,
            create: SCOPES.DENIED,
            manage: SCOPES.DENIED
        },
        audit: {
            view_all: SCOPES.DENIED,
            view_own: SCOPES.DENIED,
            failed_logins: SCOPES.DENIED
        },
        customers: {
            view: SCOPES.OWN_BRANCH,
            create: SCOPES.OWN_BRANCH,
            edit: SCOPES.OWN_BRANCH,
            manage: SCOPES.DENIED
        }
    },

    DRIVER: {
        pos: {
            create: SCOPES.DENIED,
            view: SCOPES.DENIED,
            hold: SCOPES.DENIED,
            refund_request: SCOPES.DENIED,
            refund_approve: SCOPES.DENIED
        },
        inventory: {
            view: SCOPES.DENIED,
            adjust_request: SCOPES.DENIED,
            adjust_approve: SCOPES.DENIED,
            transfer_request: SCOPES.DENIED,
            transfer_status: SCOPES.DENIED,
            receive_stock: SCOPES.DENIED,
            stocktake: SCOPES.DENIED,
            write_off: SCOPES.DENIED
        },
        dispatch: {
            view: SCOPES.DENIED,
            create: SCOPES.DENIED,
            assign: SCOPES.DENIED,
            update: SCOPES.DENIED
        },
        delivery: {
            view_own: SCOPES.OWN_RECORD,
            start: SCOPES.OWN_RECORD,
            pod_submit: SCOPES.OWN_RECORD,
            problem: SCOPES.OWN_RECORD
        },
        users: {
            view: SCOPES.DENIED,
            create: SCOPES.DENIED,
            edit: SCOPES.DENIED,
            manage: SCOPES.DENIED
        },
        reports: {
            financial_all: SCOPES.DENIED,
            financial_own: SCOPES.DENIED,
            shift_own: SCOPES.DENIED
        },
        expenses: {
            create: SCOPES.OWN_BRANCH,
            approve: SCOPES.DENIED
        },
        branches: {
            view: SCOPES.GLOBAL,
            create: SCOPES.DENIED,
            manage: SCOPES.DENIED
        },
        audit: {
            view_all: SCOPES.DENIED,
            view_own: SCOPES.DENIED,
            failed_logins: SCOPES.DENIED
        },
        customers: {
            view: SCOPES.DENIED,
            create: SCOPES.DENIED,
            edit: SCOPES.DENIED,
            manage: SCOPES.DENIED
        }
    }
};

/**
 * Evaluates whether an operator has permission to perform an action on a resource
 * under the provided branch and entity context.
 *
 * @param {object} user - Authenticated user object from req.user
 * @param {string} resource - Resource name (e.g., 'pos', 'inventory', 'users')
 * @param {string} action - Action name (e.g., 'create', 'adjust_approve')
 * @param {object} context - Context containing target branchId, entityOwnerId, etc.
 * @returns {{ granted: boolean, scope: string, reason?: string }}
 */
function checkPermission(user, resource, action, context = {}) {
    if (!user) {
        return { granted: false, scope: SCOPES.DENIED, reason: 'Authentication required' };
    }

    const rolePermissions = AUTHORIZATION_MATRIX[user.roleName];
    if (!rolePermissions) {
        return {
            granted: false,
            scope: SCOPES.DENIED,
            reason: `Role '${user.roleName}' is not recognized in the authorization matrix.`
        };
    }

    const resourcePerms = rolePermissions[resource];
    if (!resourcePerms) {
        return {
            granted: false,
            scope: SCOPES.DENIED,
            reason: `Resource '${resource}' is not defined for role '${user.roleName}'.`
        };
    }

    const scope = resourcePerms[action];
    if (scope === undefined || scope === false || scope === SCOPES.DENIED) {
        return {
            granted: false,
            scope: SCOPES.DENIED,
            reason: `Vertical Privilege Escalation Blocked: Role '${user.roleDisplayName || user.roleName}' is not authorized to '${action}' on '${resource}'.`
        };
    }

    // 1. GLOBAL Scope: Super Admin bypasses branch constraints
    if (scope === SCOPES.GLOBAL || user.roleName === 'SUPER_ADMIN') {
        return { granted: true, scope: SCOPES.GLOBAL };
    }

    // 2. OWN_BRANCH Scope: Target resource branch must match operator branch
    if (scope === SCOPES.OWN_BRANCH) {
        const targetBranchId = context.branchId !== undefined && context.branchId !== null && context.branchId !== ''
            ? Number(context.branchId)
            : null;

        if (targetBranchId !== null && targetBranchId !== Number(user.branchId)) {
            return {
                granted: false,
                scope: SCOPES.OWN_BRANCH,
                reason: `Horizontal Privilege Escalation Blocked: Cross-branch access denied. Operator assigned to branch ${user.branchId} cannot '${action}' on ${resource} belonging to branch ${targetBranchId}.`
            };
        }

        // Special rule for transfers: operator must belong to either source or target branch
        if (context.isTransfer && context.sourceBranchId && context.targetBranchId) {
            const userBranch = Number(user.branchId);
            if (Number(context.sourceBranchId) !== userBranch && Number(context.targetBranchId) !== userBranch) {
                return {
                    granted: false,
                    scope: SCOPES.OWN_BRANCH,
                    reason: `Horizontal Privilege Escalation Blocked: You can only participate in stock transfers involving your branch ${user.branchId}.`
                };
            }
        }

        return { granted: true, scope: SCOPES.OWN_BRANCH };
    }

    // 3. OWN_RECORD Scope: e.g. Driver assigned to delivery or Cashier shift
    if (scope === SCOPES.OWN_RECORD) {
        if (context.driverId != null && context.userDriverId != null) {
            if (Number(context.driverId) !== Number(context.userDriverId)) {
                return {
                    granted: false,
                    scope: SCOPES.OWN_RECORD,
                    reason: `Horizontal Privilege Escalation Blocked: Driver can only access deliveries assigned to their own profile.`
                };
            }
        }
        if (context.ownerUserId != null && Number(context.ownerUserId) !== Number(user.id)) {
            return {
                granted: false,
                scope: SCOPES.OWN_RECORD,
                reason: `Access denied: Record belongs to another operator.`
            };
        }
        return { granted: true, scope: SCOPES.OWN_RECORD };
    }

    return { granted: false, scope: SCOPES.DENIED, reason: 'Unauthorized' };
}

module.exports = {
    SCOPES,
    AUTHORIZATION_MATRIX,
    checkPermission
};
