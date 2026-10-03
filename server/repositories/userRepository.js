// server/repositories/userRepository.js
// Enterprise Data Access Layer: Users, Roles, Credentials & Permissions
const dbAdapter = require('../db/dbAdapter.js');

class UserRepository {
    constructor() {
        this.dbAdapter = dbAdapter;
    }

    /**
     * Finds a user by ID with role, branch, and basic profile info.
     */
    async findById(id, tx = null) {
        const sql = `
            SELECT u.id, u.username, u.email, u.full_name, u.phone, u.branch_id, u.is_active,
                   u.token_version, u.must_change_password, u.two_factor_enabled,
                   r.name as role_name, r.display_name as role_display_name,
                   b.name as branch_name, b.code as branch_code
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN branches b ON u.branch_id = b.id
            WHERE u.id = ?
        `;
        return await dbAdapter.get(sql, [id], tx?.client);
    }

    /**
     * Finds a user by username for authentication.
     */
    async findByUsername(username, tx = null) {
        const sql = `
            SELECT u.id, u.username, u.email, u.password_hash, u.full_name, u.phone,
                   u.branch_id, u.is_active, u.token_version, u.must_change_password,
                   u.failed_login_attempts, u.locked_until,
                   u.two_factor_enabled, u.two_factor_secret,
                   r.name as role_name, r.display_name as role_display_name,
                   b.name as branch_name, b.code as branch_code
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN branches b ON u.branch_id = b.id
            WHERE LOWER(u.username) = LOWER(?)
        `;
        return await dbAdapter.get(sql, [username], tx?.client);
    }

    /**
     * Finds a user by username or email for authentication.
     */
    async findByUsernameOrEmail(identifier, tx = null) {
        const sql = `
            SELECT u.id, u.username, u.email, u.full_name, u.phone, u.branch_id, u.password_hash, u.is_active,
                   u.failed_login_attempts, u.locked_until, u.token_version, u.must_change_password,
                   (u.locked_until IS NOT NULL AND u.locked_until > CURRENT_TIMESTAMP) as is_locked,
                   u.two_factor_enabled, u.two_factor_secret, u.two_factor_recovery_codes,
                   u.password_changed_at, u.last_login_at,
                   r.name as role_name, r.display_name as role_display_name,
                   b.name as branch_name, b.code as branch_code, b.city as branch_city
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN branches b ON u.branch_id = b.id
            WHERE LOWER(u.username) = LOWER(?) OR LOWER(u.email) = LOWER(?)
        `;
        return await dbAdapter.get(sql, [identifier, identifier], tx?.client);
    }

    /**
     * Retrieves all permission codes assigned to a specific role name.
     */
    async getPermissionsByRoleName(roleName, tx = null) {
        const sql = `
            SELECT p.code
            FROM role_permissions rp
            JOIN permissions p ON rp.permission_id = p.id
            JOIN roles r ON rp.role_id = r.id
            WHERE r.name = ?
        `;
        const rows = await dbAdapter.all(sql, [roleName], tx?.client);
        return rows.map(r => r.code);
    }

    /**
     * Increments the token version to revoke all current active JWTs for this user.
     */
    async incrementTokenVersion(userId, tx = null) {
        const sql = `
            UPDATE users
            SET token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        return await dbAdapter.run(sql, [userId], tx?.client);
    }

    /**
     * Updates user password and resets must_change_password flag.
     */
    async updatePassword(userId, passwordHash, tx = null) {
        const sql = `
            UPDATE users
            SET password_hash = ?, must_change_password = false,
                token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        return await dbAdapter.run(sql, [passwordHash, userId], tx?.client);
    }

    /**
     * Updates the last login timestamp.
     */
    async updateLastLogin(userId, tx = null) {
        const sql = 'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?';
        return await dbAdapter.run(sql, [userId], tx?.client);
    }

    /**
     * Lists users with optional branch filtering.
     */
    async listUsers(filters = {}, tx = null) {
        let sql = `
            SELECT u.id, u.username, u.email, u.full_name, u.phone, u.branch_id, u.is_active,
                   u.must_change_password, u.two_factor_enabled, u.last_login_at, u.created_at,
                   r.name as role_name, r.display_name as role_display_name,
                   b.name as branch_name, b.code as branch_code
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN branches b ON u.branch_id = b.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.branchId) {
            sql += ' AND u.branch_id = ?';
            params.push(filters.branchId);
        }

        if (filters.isActive !== undefined) {
            sql += ' AND u.is_active = ?';
            params.push(filters.isActive);
        }

        sql += ' ORDER BY u.id ASC';
        return await dbAdapter.all(sql, params, tx?.client);
    }
}

module.exports = new UserRepository();
