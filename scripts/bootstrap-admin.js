// scripts/bootstrap-admin.js
// Enterprise One-Time Administrative Bootstrap & Credential Provisioning (Section 15 Mandate)
const crypto = require('node:crypto');
require('../server/utils/env.js');
const dbAdapter = require('../server/db/dbAdapter.js');

const { hashPassword } = require('../server/utils/security.js');

async function bootstrapAdmin() {
    console.log('============================================================');
    console.log('  SWIFTTRACK: SECURE ADMINISTRATIVE BOOTSTRAP PROVISIONER');
    console.log('============================================================\n');

    const adminEmail = process.env.ADMIN_EMAIL?.trim();
    const adminFullName = process.env.ADMIN_FULL_NAME?.trim();
    const adminPhone = process.env.ADMIN_PHONE?.trim();
    if (!adminEmail || !adminFullName || !adminPhone) {
        throw new Error('Set ADMIN_FULL_NAME, ADMIN_EMAIL, and ADMIN_PHONE to the real administrator details.');
    }

    // 1. Generate or retrieve initial password
    let initialPassword = process.env.ADMIN_INITIAL_PASSWORD;
    let isGenerated = false;

    if (!initialPassword || initialPassword.trim().length < 12) {
        initialPassword = crypto.randomBytes(12).toString('base64url') + '!9A';
        isGenerated = true;
    }

    const passwordHash = hashPassword(initialPassword);

    // 2. Ensure roles exist
    const superAdminRole = await dbAdapter.get("SELECT id FROM roles WHERE name = 'SUPER_ADMIN'");
    if (!superAdminRole) {
        console.error('[Error] SUPER_ADMIN role does not exist. Please run database migrations first.');
        process.exit(1);
    }

    // 3. Create or update a global administrator without inventing tenant data.
    const existing = await dbAdapter.get("SELECT id FROM users WHERE username = 'superadmin'");

    if (existing) {
        await dbAdapter.run(`
            UPDATE users
            SET email = ?,
                full_name = ?,
                phone = ?,
                branch_id = NULL,
                password_hash = ?,
                must_change_password = true,
                token_version = token_version + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [adminEmail, adminFullName, adminPhone, passwordHash, existing.id]);

        console.log('✅ Superadmin user credentials successfully reset.');
    } else {
        await dbAdapter.run(`
            INSERT INTO users (
                username, email, password_hash, full_name, phone,
                role_id, branch_id, must_change_password, is_active
            ) VALUES ('superadmin', ?, ?, ?, ?, ?, NULL, true, true)
        `, [adminEmail, passwordHash, adminFullName, adminPhone, superAdminRole.id]);

        console.log('✅ Superadmin user successfully created.');
    }

    console.log('\n------------------------------------------------------------');
    console.log('ADMINISTRATIVE CREDENTIALS:');
    console.log('  Username:             superadmin');
    console.log(`  Temporary Password:   ${initialPassword}`);
    console.log('  Mandatory Rotation:   ENFORCED (must_change_password = true)');
    if (isGenerated) {
        console.log('  Note:                 This is a one-time generated password. Store it securely.');
    }
    console.log('------------------------------------------------------------\n');

    process.exit(0);
}

bootstrapAdmin().catch(err => {
    console.error('[Bootstrap Error]', err);
    process.exit(1);
});
