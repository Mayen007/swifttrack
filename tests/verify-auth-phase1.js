// tests/verify-auth-phase1.js
// Automated verification suite for Phase 1 Authentication Hardening (15 Deliverables)
process.env.DISABLE_RATE_LIMIT = 'true';
process.env.AUTH_TEST_MODE = 'true';
const assert = require('node:assert');
const { db } = require('../server/db/database.js');
const app = require('../server/server.js');
const { validatePasswordStrength, sha256Hash } = require('../server/utils/security.js');
const { generateSecret, verifyTotp, generateRecoveryCodes, verifyRecoveryCode } = require('../server/utils/totp.js');

let server;
const PORT = 4998;
const BASE_URL = `http://localhost:${PORT}`;

async function request(endpoint, options = {}) {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });
    const status = res.status;
    const headers = res.headers;
    let data;
    try {
        data = await res.json();
    } catch {
        data = null;
    }
    return { status, headers, data };
}

async function runAuthTests() {
    console.log('================================================================');
    console.log('================================================================\n');

    server = app.listen(PORT);

    const testSuffix = Date.now();
    const lockoutUsername = `lockout_${testSuffix}`;
    const lockoutEmail = `lockout_${testSuffix}@swifttrack.co.ke`;
    const firstLoginUsername = `firstlogin_${testSuffix}`;
    const firstLoginEmail = `firstlogin_${testSuffix}@swifttrack.co.ke`;

    try {
        // -------------------------------------------------------------
        // TEST 1: Strong Password Policy Validation
        // -------------------------------------------------------------
        console.log('▶ TEST 1: Enforcing Strong Password Policy...');
        const weakShort = validatePasswordStrength('Short1!');
        assert.strictEqual(weakShort.isValid, false, 'Should reject passwords < 10 chars');

        const noUpper = validatePasswordStrength('lowercase123!@#');
        assert.strictEqual(noUpper.isValid, false, 'Should reject password without uppercase');

        const noDigit = validatePasswordStrength('NoDigitsHere!@#');
        assert.strictEqual(noDigit.isValid, false, 'Should reject password without digits');

        const noSpecial = validatePasswordStrength('NoSpecialChar1234');
        assert.strictEqual(noSpecial.isValid, false, 'Should reject password without special chars');

        const hasUsername = validatePasswordStrength('superadmin2026!A', { username: 'superadmin' });
        assert.strictEqual(hasUsername.isValid, false, 'Should reject password containing username');

        const blacklisted = validatePasswordStrength('password123', { username: 'john' });
        assert.strictEqual(blacklisted.isValid, false, 'Should reject blacklisted password');

        const strongPass = validatePasswordStrength('SecureP@ss#2026', { username: 'john', email: 'john@example.com' });
        assert.strictEqual(strongPass.isValid, true, 'Should accept strong compliant password');
        console.log('  ✔ Password strength validator correctly enforces all 7 corporate rules');

        // -------------------------------------------------------------
        // TEST 2: Credential Login, Session Tracking & JWT Payload
        // -------------------------------------------------------------
        console.log('\n▶ TEST 2: Standard Login & Session Creation...');
        const loginRes = await request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: 'superadmin', password: 'Password123!' })
        });
        assert.strictEqual(loginRes.status, 200, 'Super admin login failed');
        assert.ok(loginRes.data.token, 'Token not returned');
        assert.ok(loginRes.data.refreshToken, 'Refresh token not returned');
        assert.strictEqual(loginRes.data.user.username, 'superadmin');
        const adminToken = loginRes.data.token;
        const adminRefreshToken = loginRes.data.refreshToken;
        console.log('  ✔ Login returned short-lived access token + rotating refresh token');

        // Verify session recorded in user_sessions
        const sessionInDb = db.prepare('SELECT * FROM user_sessions WHERE user_id = 1 AND is_active = 1').all();
        assert.ok(sessionInDb.length > 0, 'Active session was not persisted in user_sessions');
        console.log(`  ✔ Active session stored in user_sessions (${sessionInDb.length} active)`);

        // -------------------------------------------------------------
        // TEST 3: Active Session Listing & Management
        // -------------------------------------------------------------
        console.log('\n▶ TEST 3: User Session Listing & Management...');
        const sessionsRes = await request('/api/auth/sessions', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        assert.strictEqual(sessionsRes.status, 200, 'Failed to fetch sessions');
        assert.ok(Array.isArray(sessionsRes.data), 'Sessions not an array');
        assert.ok(sessionsRes.data.some(s => s.isCurrent === true), 'Current session not flagged');
        console.log(`  ✔ GET /api/auth/sessions returns active sessions with isCurrent flag`);

        // -------------------------------------------------------------
        // TEST 4: Token Refresh & Single-Use Rotation
        // -------------------------------------------------------------
        console.log('\n▶ TEST 4: Token Refresh & Single-Use Rotation...');
        const refreshRes = await request('/api/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refreshToken: adminRefreshToken })
        });
        assert.strictEqual(refreshRes.status, 200, 'Refresh failed');
        assert.ok(refreshRes.data.token, 'New access token missing');
        assert.ok(refreshRes.data.refreshToken, 'New refresh token missing');
        assert.notStrictEqual(refreshRes.data.refreshToken, adminRefreshToken, 'Refresh token was not rotated!');
        const rotatedToken = refreshRes.data.token;
        const newRefreshToken = refreshRes.data.refreshToken;
        console.log('  ✔ POST /api/auth/refresh returned rotated refresh token and fresh access token');

        // Replaying old refresh token should be rejected
        const replayRes = await request('/api/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refreshToken: adminRefreshToken })
        });
        assert.strictEqual(replayRes.status, 401, 'Reused refresh token should be rejected');
        console.log('  ✔ Replayed previously used refresh token was blocked with 401');

        // -------------------------------------------------------------
        // TEST 5: Logout & Immediate Token Revocation
        // -------------------------------------------------------------
        console.log('\n▶ TEST 5: Logout & Immediate Token Revocation...');
        const logoutRes = await request('/api/auth/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${rotatedToken}` }
        });
        assert.strictEqual(logoutRes.status, 200, 'Logout failed');
        console.log('  ✔ POST /api/auth/logout completed successfully');

        // Verify revoked token cannot access protected routes
        const checkRevoked = await request('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${rotatedToken}` }
        });
        assert.strictEqual(checkRevoked.status, 401, 'Revoked token should be rejected with 401');
        console.log('  ✔ Revoked token is immediately blocked from accessing protected routes');

        // Log back in for remaining tests
        const reloginAdmin = await request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: 'superadmin', password: 'Password123!' })
        });
        const activeAdminToken = reloginAdmin.data.token;

        // -------------------------------------------------------------
        // TEST 6: Account Lockout after 5 Consecutive Failed Logins
        // -------------------------------------------------------------
        console.log('\n▶ TEST 6: Account Lockout after 5 Failed Password Attempts...');
        // Create test user
        const testUserRes = await request('/api/users', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${activeAdminToken}` },
            body: JSON.stringify({
                username: lockoutUsername,
                email: lockoutEmail,
                full_name: 'Lockout Test Operator',
                phone: '+254 700 999 888',
                password: 'InitialPassword#2026',
                role_id: 4, // Cashier
                branch_id: 1,
                must_change_password: 0
            })
        });
        assert.strictEqual(testUserRes.status, 201, 'Failed to create test user');
        const testUserId = testUserRes.data.id;

        // Perform 4 failed logins
        for (let i = 1; i <= 4; i++) {
            const failRes = await request('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username: lockoutUsername, password: 'WrongPassword#999' })
            });
            assert.strictEqual(failRes.status, 401, `Failed login attempt ${i} should return 401`);
            assert.strictEqual(failRes.data.remainingAttempts, 5 - i);
        }
        console.log('  ✔ 4 consecutive failed attempts properly decremented remaining attempts');

        // 5th failed login should lock account
        const lockRes = await request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: lockoutUsername, password: 'WrongPassword#999' })
        });
        assert.strictEqual(lockRes.status, 423, '5th failed attempt should trigger 423 Locked');
        assert.ok(lockRes.data.error.includes('locked'), 'Error message should state account is locked');
        console.log('  ✔ 5th failed attempt triggered HTTP 423 Locked');

        // 6th attempt even with CORRECT password must still be rejected while locked
        const tryCorrectWhileLocked = await request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: lockoutUsername, password: 'InitialPassword#2026' })
        });
        assert.strictEqual(tryCorrectWhileLocked.status, 423, 'Locked account must reject even valid credentials');
        console.log('  ✔ Locked account rejects login even with valid password');

        // Admin unlocks the account
        const unlockRes = await request(`/api/users/${testUserId}/unlock`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${activeAdminToken}` }
        });
        assert.strictEqual(unlockRes.status, 200, 'Admin unlock failed');
        console.log('  ✔ Admin successfully unlocked account via POST /api/users/:id/unlock');

        // Now login with correct credentials should succeed
        const loginAfterUnlock = await request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: lockoutUsername, password: 'InitialPassword#2026' })
        });
        assert.strictEqual(loginAfterUnlock.status, 200, 'Login after unlock should succeed');
        console.log('  ✔ User successfully authenticated after admin unlock');

        // -------------------------------------------------------------
        // TEST 7: Login History & Failed Login Auditing
        // -------------------------------------------------------------
        console.log('\n▶ TEST 7: Login History & Failed Login Audit Telemetry...');
        const failedLoginsRes = await request('/api/audit/failed-logins', {
            headers: { 'Authorization': `Bearer ${activeAdminToken}` }
        });
        assert.strictEqual(failedLoginsRes.status, 200, 'Failed to fetch failed logins');
        assert.ok(Array.isArray(failedLoginsRes.data), 'Failed logins not an array');
        assert.ok(failedLoginsRes.data.some(l => l.username_attempted === lockoutUsername), 'Lockout user missing in failed logins');
        console.log(`  ✔ GET /api/audit/failed-logins recorded ${failedLoginsRes.data.length} failed attempt records`);

        const userLoginHistory = await request('/api/auth/login-history', {
            headers: { 'Authorization': `Bearer ${activeAdminToken}` }
        });
        assert.strictEqual(userLoginHistory.status, 200, 'Failed to fetch user login history');
        assert.ok(Array.isArray(userLoginHistory.data), 'User history not an array');
        console.log(`  ✔ GET /api/auth/login-history returned ${userLoginHistory.data.length} personal login events`);

        // -------------------------------------------------------------
        // TEST 8: First-Login Password Change Enforcement
        // -------------------------------------------------------------
        console.log('\n▶ TEST 8: First-Login Password Change Enforcement...');
        // Create user with must_change_password = 1
        const newUserRes = await request('/api/users', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${activeAdminToken}` },
            body: JSON.stringify({
                username: firstLoginUsername,
                email: firstLoginEmail,
                full_name: 'First Login Staff',
                phone: '+254 700 111 222',
                password: 'TempPassword#2026',
                role_id: 4,
                branch_id: 1,
                must_change_password: 1
            })
        });
        assert.strictEqual(newUserRes.status, 201);
        const newStaffId = newUserRes.data.id;

        // Login as new user
        const newStaffLogin = await request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: firstLoginUsername, password: 'TempPassword#2026' })
        });
        assert.strictEqual(newStaffLogin.status, 200);
        assert.strictEqual(newStaffLogin.data.user.mustChangePassword, true);
        const newStaffToken = newStaffLogin.data.token;
        console.log('  ✔ Login reports mustChangePassword: true');

        // Operational endpoint access MUST be blocked with 403 PASSWORD_CHANGE_REQUIRED
        const blockedOp = await request('/api/products', {
            headers: { 'Authorization': `Bearer ${newStaffToken}` }
        });
        assert.strictEqual(blockedOp.status, 403);
        assert.strictEqual(blockedOp.data.code, 'PASSWORD_CHANGE_REQUIRED');
        console.log('  ✔ Access to operational routes blocked with 403 PASSWORD_CHANGE_REQUIRED');

        // User performs mandatory password change
        const changePwdRes = await request('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${newStaffToken}` },
            body: JSON.stringify({
                current_password: 'TempPassword#2026',
                new_password: 'NewStrongPassword#2026',
                confirm_password: 'NewStrongPassword#2026'
            })
        });
        assert.strictEqual(changePwdRes.status, 200, 'Password change failed');
        assert.ok(changePwdRes.data.token, 'New token missing after password change');
        const freshToken = changePwdRes.data.token;
        console.log('  ✔ POST /api/auth/change-password succeeded and issued new session token');

        // Now operational route should succeed
        const allowedOp = await request('/api/products', {
            headers: { 'Authorization': `Bearer ${freshToken}` }
        });
        assert.strictEqual(allowedOp.status, 200, 'Operational endpoint should now be accessible');
        console.log('  ✔ Operational routes now fully accessible after password change');

        // -------------------------------------------------------------
        // TEST 9: Admin Force Logout
        // -------------------------------------------------------------
        console.log('\n▶ TEST 9: Admin Force Logout (Token Invalidation)...');
        const forceLogoutRes = await request(`/api/users/${newStaffId}/force-logout`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${activeAdminToken}` }
        });
        assert.strictEqual(forceLogoutRes.status, 200, 'Admin force logout failed');
        console.log('  ✔ Admin triggered force logout on user');

        // The user's active token must now be rejected
        const checkTerminated = await request('/api/products', {
            headers: { 'Authorization': `Bearer ${freshToken}` }
        });
        assert.strictEqual(checkTerminated.status, 401, 'Terminated session token should return 401');
        console.log('  ✔ Previously valid token was rejected with 401 after Admin Force Logout');

        // -------------------------------------------------------------
        // TEST 10: Admin Password Reset
        // -------------------------------------------------------------
        console.log('\n▶ TEST 10: Admin Password Reset...');
        const adminResetRes = await request(`/api/users/${newStaffId}/reset-password`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${activeAdminToken}` },
            body: JSON.stringify({})
        });
        assert.strictEqual(adminResetRes.status, 200, 'Admin reset password failed');
        assert.ok(adminResetRes.data.temporaryPassword, 'Temporary password missing');
        const tempPassword = adminResetRes.data.temporaryPassword;
        console.log(`  ✔ Admin reset password generated temporary password: ${tempPassword}`);

        // Login with temporary password forces password change again
        const loginWithTemp = await request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: firstLoginUsername, password: tempPassword })
        });
        assert.strictEqual(loginWithTemp.status, 200);
        assert.strictEqual(loginWithTemp.data.user.mustChangePassword, true);
        console.log('  ✔ Login with admin temporary password flags mustChangePassword: true');

        // -------------------------------------------------------------
        // TEST 11: Self-Service Forgot & Reset Password Flow
        // -------------------------------------------------------------
        console.log('\n▶ TEST 11: Self-Service Forgot & Reset Password...');
        const forgotRes = await request('/api/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ identifier: firstLoginEmail })
        });
        assert.strictEqual(forgotRes.status, 200);
        assert.ok(forgotRes.data.resetToken, 'Reset token missing');
        const resetToken = forgotRes.data.resetToken;
        console.log('  ✔ POST /api/auth/forgot-password generated 15-minute reset token');

        const resetPwdRes = await request('/api/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({
                token: resetToken,
                new_password: 'RecoveredPassword#2026',
                confirm_password: 'RecoveredPassword#2026'
            })
        });
        assert.strictEqual(resetPwdRes.status, 200, 'Reset password failed');
        console.log('  ✔ POST /api/auth/reset-password succeeded');

        // Login with recovered password succeeds
        const loginRecovered = await request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: firstLoginUsername, password: 'RecoveredPassword#2026' })
        });
        assert.strictEqual(loginRecovered.status, 200);
        console.log('  ✔ Authenticated successfully with newly recovered password');

        // -------------------------------------------------------------
        // TEST 12: Two-Factor Authentication (TOTP & Recovery Code) Flow
        // -------------------------------------------------------------
        console.log('\n▶ TEST 12: Two-Factor Authentication (TOTP Setup, Login & Recovery Code)...');
        const staffToken = loginRecovered.data.token;

        // 1. Setup 2FA
        const setup2FaRes = await request('/api/auth/2fa/setup', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${staffToken}` }
        });
        assert.strictEqual(setup2FaRes.status, 200);
        assert.ok(setup2FaRes.data.secret, '2FA secret missing');
        assert.ok(setup2FaRes.data.otpAuthUri, 'otpauth URI missing');
        assert.ok(setup2FaRes.data.recoveryCodes.length === 8, '8 recovery codes expected');
        const totpSecret = setup2FaRes.data.secret;
        const hashedRecoveryCodes = setup2FaRes.data.hashedRecoveryCodes;
        const plainRecoveryCodes = setup2FaRes.data.recoveryCodes;
        console.log('  ✔ POST /api/auth/2fa/setup generated Base32 secret and 8 recovery codes');

        // Generate valid TOTP code using totp utility
        const { base32Decode } = require('../server/utils/totp.js');
        const secretBuf = base32Decode(totpSecret);
        const counter = Math.floor(Date.now() / 1000 / 30);
        const counterBuf = Buffer.alloc(8);
        counterBuf.writeBigInt64BE(BigInt(counter), 0);
        const crypto = require('node:crypto');
        const hmac = crypto.createHmac('sha1', secretBuf).update(counterBuf).digest();
        const offset = hmac[hmac.length - 1] & 0x0f;
        const codeNum = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
        const validCode = (codeNum % 1000000).toString().padStart(6, '0');

        // 2. Enable 2FA
        const enable2FaRes = await request('/api/auth/2fa/enable', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${staffToken}` },
            body: JSON.stringify({
                secret: totpSecret,
                code: validCode,
                hashedRecoveryCodes
            })
        });
        assert.strictEqual(enable2FaRes.status, 200, '2FA enable failed');
        console.log('  ✔ POST /api/auth/2fa/enable verified code and activated 2FA');

        // 3. Login challenge when 2FA is enabled
        const loginChallenge = await request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: firstLoginUsername, password: 'RecoveredPassword#2026' })
        });
        assert.strictEqual(loginChallenge.status, 200);
        assert.strictEqual(loginChallenge.data.require2FA, true);
        assert.ok(loginChallenge.data.tempToken, 'Temporary challenge token missing');
        const challengeToken = loginChallenge.data.tempToken;
        console.log('  ✔ Login returns require2FA: true with temporary challenge token');

        // 4. Verify 2FA challenge with backup recovery code
        const verifyRecoveryRes = await request('/api/auth/2fa/verify', {
            method: 'POST',
            body: JSON.stringify({
                tempToken: challengeToken,
                code: plainRecoveryCodes[0] // use first recovery code
            })
        });
        assert.strictEqual(verifyRecoveryRes.status, 200, 'Recovery code login failed');
        assert.strictEqual(verifyRecoveryRes.data.usedRecoveryCode, true);
        assert.ok(verifyRecoveryRes.data.token, 'Full session token missing');
        const authenticated2FaToken = verifyRecoveryRes.data.token;
        console.log('  ✔ POST /api/auth/2fa/verify succeeded with single-use backup recovery code');

        // 5. Disable 2FA
        const disable2FaRes = await request('/api/auth/2fa/disable', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authenticated2FaToken}` },
            body: JSON.stringify({
                password: 'RecoveredPassword#2026'
            })
        });
        assert.strictEqual(disable2FaRes.status, 200, 'Disable 2FA failed');
        console.log('  ✔ POST /api/auth/2fa/disable deactivated 2FA');

        // Clean up test users by deactivating them safely
        db.prepare('UPDATE users SET is_active = 0 WHERE id IN (?, ?)').run(testUserId, newStaffId);
        db.prepare('UPDATE user_sessions SET is_active = 0 WHERE user_id IN (?, ?)').run(testUserId, newStaffId);

        console.log('\n================================================================');
        console.log('🎉 ALL 12 PHASE 1 AUTHENTICATION TESTS PASSED WITH 100% SUCCESS!');
        console.log('================================================================\n');

    } catch (err) {
        console.error('\n❌ AUTH VERIFICATION SUITE FAILED:', err);
        process.exitCode = 1;
    } finally {
        if (server) {
            server.close();
        }
    }
}

runAuthTests();

