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

    // 3. Ensure headquarters branch exists
    let branch = await dbAdapter.get("SELECT id FROM branches ORDER BY id ASC LIMIT 1");
    if (!branch) {
        const branchRes = await dbAdapter.run(`
            INSERT INTO branches (name, code, city, address, phone, email, is_active)
            VALUES ('Nairobi Headquarters', 'NRB-HQ', 'Nairobi', 'Enterprise Road, Industrial Area', '+254700000000', 'hq@swifttrack.co.ke', true)
        `);
        branch = { id: branchRes.insertId };
    }

    // 4. Create or update superadmin user
    const existing = await dbAdapter.get("SELECT id FROM users WHERE username = 'superadmin'");

    if (existing) {
        await dbAdapter.run(`
            UPDATE users
            SET password_hash = ?,
                must_change_password = true,
                token_version = token_version + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [passwordHash, existing.id]);

        console.log('✅ Superadmin user credentials successfully reset.');
    } else {
        await dbAdapter.run(`
            INSERT INTO users (
                username, email, password_hash, full_name, phone,
                role_id, branch_id, must_change_password, is_active
            ) VALUES ('superadmin', 'admin@swifttrack.co.ke', ?, 'System Administrator', '+254700000000', ?, ?, true, true)
        `, [passwordHash, superAdminRole.id, branch.id]);

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
