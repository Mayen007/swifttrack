// tests/verify-system.js
// Comprehensive automated test suite validating all 15 phases, security, branch isolation, and transactions
const assert = require('node:assert');
const { db } = require('../server/db/database.js');
const app = require('../server/server.js');

let server;
const PORT = 4999;
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

async function runTests() {
    console.log('================================================================');
    console.log('🧪 RUNNING SWIFTTRACK KENYA LOGISTICS + POS VERIFICATION SUITE');
    console.log('================================================================\n');

    server = app.listen(PORT);

    try {
        // -------------------------------------------------------------
        // TEST 1: Authentication & Roles Verification
        // -------------------------------------------------------------
        console.log('▶ TEST 1: Authentication for all 5 roles...');

        const loginAdmin = await request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: 'superadmin', password: 'Password123!' })
        });
        assert.strictEqual(loginAdmin.status, 200, 'Super admin login failed');
        assert.strictEqual(loginAdmin.data.user.roleName, 'SUPER_ADMIN');
        const adminToken = loginAdmin.data.token;
        console.log('  ✔ Super Admin login verified');

        const loginMgrNrb = await request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: 'manager.nairobi', password: 'Password123!' })
        });
        assert.strictEqual(loginMgrNrb.status, 200, 'Nairobi Manager login failed');
        assert.strictEqual(loginMgrNrb.data.user.branchId, 1);
        const mgrNrbToken = loginMgrNrb.data.token;
        console.log('  ✔ Nairobi Branch Manager login verified (Branch ID: 1)');

        const loginMgrMsa = await request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: 'manager.mombasa', password: 'Password123!' })
        });
        assert.strictEqual(loginMgrMsa.status, 200, 'Mombasa Manager login failed');
        assert.strictEqual(loginMgrMsa.data.user.branchId, 2);
        const mgrMsaToken = loginMgrMsa.data.token;
        console.log('  ✔ Mombasa Branch Manager login verified (Branch ID: 2)');

        const loginCashier = await request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: 'cashier.nairobi', password: 'Password123!' })
        });
        assert.strictEqual(loginCashier.status, 200, 'Cashier login failed');
        assert.strictEqual(loginCashier.data.user.roleName, 'CASHIER');
        const cashierToken = loginCashier.data.token;
        console.log('  ✔ Cashier login verified');

        const loginDispatcher = await request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: 'dispatcher.nairobi', password: 'Password123!' })
        });
        assert.strictEqual(loginDispatcher.status, 200, 'Dispatcher login failed');
        assert.strictEqual(loginDispatcher.data.user.roleName, 'DISPATCHER');
        const dispatcherToken = loginDispatcher.data.token;
        console.log('  ✔ Dispatcher login verified');

        const loginDriver = await request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: 'driver.nairobi', password: 'Password123!' })
        });
        assert.strictEqual(loginDriver.status, 200, 'Driver login failed');
        assert.strictEqual(loginDriver.data.user.roleName, 'DRIVER');
        const driverToken = loginDriver.data.token;
        console.log('  ✔ Driver login verified');

        // Invalid login test
        const badLogin = await request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: 'superadmin', password: 'WrongPassword' })
        });
        assert.strictEqual(badLogin.status, 401, 'Bad credentials did not return 401');
        console.log('  ✔ Invalid credentials rejection verified (401)\n');

        // -------------------------------------------------------------
        // TEST 2: Strict Branch Isolation (CRITICAL)
        // -------------------------------------------------------------
        console.log('▶ TEST 2: Strict Branch Isolation Enforcement...');

        // Nairobi Manager attempts to access Mombasa branch details directly
        const crossBranchAccess = await request('/api/branches/2', {
            headers: { Authorization: `Bearer ${mgrNrbToken}` }
        });
        assert.strictEqual(crossBranchAccess.status, 403, 'Cross branch access was not blocked with 403 Forbidden!');
        console.log('  ✔ Nairobi Manager attempting to access Mombasa Branch details blocked with 403 Forbidden');

        // Nairobi Manager attempts to query Mombasa inventory with ?branch_id=2
        const crossBranchInventory = await request('/api/inventory?branch_id=2', {
            headers: { Authorization: `Bearer ${mgrNrbToken}` }
        });
        assert.strictEqual(crossBranchInventory.status, 403, 'Cross branch inventory query was not blocked with 403!');
        console.log('  ✔ Nairobi Manager attempting ?branch_id=2 inventory query blocked with 403 Forbidden');

        // Nairobi Manager attempts to query Mombasa orders with ?branch_id=2
        const crossBranchOrders = await request('/api/orders?branch_id=2', {
            headers: { Authorization: `Bearer ${mgrNrbToken}` }
        });
        assert.strictEqual(crossBranchOrders.status, 403, 'Cross branch orders query was not blocked with 403!');
        console.log('  ✔ Nairobi Manager attempting ?branch_id=2 orders query blocked with 403 Forbidden');

        // Super Admin querying Mombasa branch details -> ALLOWED (200)
        const adminBranchAccess = await request('/api/branches/2', {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        assert.strictEqual(adminBranchAccess.status, 200, 'Super admin cross branch access failed');
        console.log('  ✔ Super Admin company-wide access to Mombasa Branch verified (200 OK)\n');

        // -------------------------------------------------------------
        // TEST 3: RBAC Action Authorization Guards
        // -------------------------------------------------------------
        console.log('▶ TEST 3: Role-Based Action Authorization...');

        // Cashier attempting to directly adjust inventory
        const cashierAdjust = await request('/api/inventory/adjust', {
            method: 'POST',
            headers: { Authorization: `Bearer ${cashierToken}` },
            body: JSON.stringify({ warehouse_id: 1, product_id: 1, adjustment_type: 'DEDUCT', quantity: 5, reason: 'Unauthorized test' })
        });
        assert.strictEqual(cashierAdjust.status, 403, 'Cashier was erroneously allowed to adjust inventory!');
        console.log('  ✔ Cashier blocked from adjusting stock (403 Forbidden)');

        // Dispatcher attempting POS checkout
        const dispatcherCheckout = await request('/api/pos/checkout', {
            method: 'POST',
            headers: { Authorization: `Bearer ${dispatcherToken}` },
            body: JSON.stringify({ items: [{ product_id: 1, quantity: 1 }], payment_method: 'CASH' })
        });
        assert.strictEqual(dispatcherCheckout.status, 403, 'Dispatcher was erroneously allowed to checkout POS sale!');
        console.log('  ✔ Dispatcher blocked from POS checkout (403 Forbidden)');

        // Cashier attempting to approve refund
        const cashierApprove = await request('/api/refunds/1/approve', {
            method: 'POST',
            headers: { Authorization: `Bearer ${cashierToken}` }
        });
        assert.strictEqual(cashierApprove.status, 403, 'Cashier was erroneously allowed to approve a refund!');
        console.log('  ✔ Cashier blocked from approving refunds (403 Forbidden)\n');

        // -------------------------------------------------------------
        // TEST 4: POS Sale, Atomic Stock Deduction & Inventory Movements
        // -------------------------------------------------------------
        console.log('▶ TEST 4: POS Checkout, Stock Deduction & Ledger Creation...');

        // Check stock of Product 1 (Heavy Duty Box) before checkout
        const stockBefore = db.prepare('SELECT quantity_on_hand FROM inventory WHERE warehouse_id = 1 AND product_id = 1').get().quantity_on_hand;

        const posSale = await request('/api/pos/checkout', {
            method: 'POST',
            headers: { Authorization: `Bearer ${cashierToken}` },
            body: JSON.stringify({
                customer_id: 1,
                items: [{ product_id: 1, quantity: 3, unit_price: 180.0, discount_amount: 0 }],
                payment_method: 'MPESA',
                mpesa_phone: '+254722000004',
                mpesa_receipt: 'RKB88390XX'
            })
        });

        assert.strictEqual(posSale.status, 201, 'POS sale checkout failed');
        assert.strictEqual(posSale.data.success, true);
        const saleNumber = posSale.data.sale.sale_number;
        console.log(`  ✔ POS sale completed successfully: ${saleNumber}`);

        // Verify stock deducted
        const stockAfter = db.prepare('SELECT quantity_on_hand FROM inventory WHERE warehouse_id = 1 AND product_id = 1').get().quantity_on_hand;
        assert.strictEqual(stockAfter, stockBefore - 3, 'Stock was not decremented correctly');
        console.log(`  ✔ Stock accurately decremented from ${stockBefore} to ${stockAfter}`);

        // Verify immutable inventory_movements record exists
        const movement = db.prepare('SELECT * FROM inventory_movements WHERE reference_id = ?').get(saleNumber);
        assert.ok(movement, 'No inventory_movements record was created for the sale');
        assert.strictEqual(movement.movement_type, 'SALE_DEDUCTION');
        assert.strictEqual(movement.quantity_change, -3);
        console.log('  ✔ Immutable stock movement ledger entry verified (SALE_DEDUCTION -3)\n');

        // -------------------------------------------------------------
        // TEST 5: Refund Workflow (Cashier Request -> Manager Approval -> Restock)
        // -------------------------------------------------------------
        console.log('▶ TEST 5: Refund Approval Workflow & Inventory Restock...');

        // Cashier submits refund request
        const refundReq = await request('/api/refunds/request', {
            method: 'POST',
            headers: { Authorization: `Bearer ${cashierToken}` },
            body: JSON.stringify({
                sale_number: saleNumber,
                amount: 540.0,
                reason: 'Customer returned 3 items in mint condition'
            })
        });
        assert.strictEqual(refundReq.status, 201, 'Refund request failed');
        const reqNumber = refundReq.data.refund_request_number;
        console.log(`  ✔ Cashier submitted refund request: ${reqNumber} (Status: PENDING_APPROVAL)`);

        // Find request ID
        const reqDb = db.prepare('SELECT id FROM refund_requests WHERE refund_request_number = ?').get(reqNumber);

        // Branch Manager Nairobi approves the refund
        const approveRefund = await request(`/api/refunds/${reqDb.id}/approve`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${mgrNrbToken}` }
        });
        assert.strictEqual(approveRefund.status, 200, 'Manager refund approval failed');
        console.log(`  ✔ Branch Manager approved refund ${reqNumber}`);

        // Verify stock restored
        const stockRestored = db.prepare('SELECT quantity_on_hand FROM inventory WHERE warehouse_id = 1 AND product_id = 1').get().quantity_on_hand;
        assert.strictEqual(stockRestored, stockAfter + 3, 'Stock was not restored upon refund approval');
        console.log(`  ✔ Inventory automatically restocked back to ${stockRestored}`);

        // Verify movement ledger has SALE_RETURN
        const returnMovement = db.prepare("SELECT * FROM inventory_movements WHERE movement_type = 'SALE_RETURN' AND reason LIKE ?").get(`%${reqNumber}%`);
        assert.ok(returnMovement, 'SALE_RETURN movement record was not recorded');
        console.log('  ✔ Stock movement ledger verified for SALE_RETURN\n');

        // -------------------------------------------------------------
        // TEST 6: Logistics Dispatch & Mobile Driver Proof of Delivery
        // -------------------------------------------------------------
        console.log('▶ TEST 6: Logistics Dispatch & Mobile Driver Proof of Delivery...');

        // Create a new delivery order
        const orderRes = await request('/api/orders', {
            method: 'POST',
            headers: { Authorization: `Bearer ${cashierToken}` },
            body: JSON.stringify({
                customer_id: 2,
                items: [{ product_id: 3, quantity: 2 }], // Industrial stretch film
                delivery_address: 'Riverside Drive, Delta Chambers Block C',
                delivery_city: 'Nairobi',
                recipient_name: 'Daniel Kigo',
                recipient_phone: '+254 722 991 122',
                priority: 'URGENT'
            })
        });
        assert.strictEqual(orderRes.status, 201, 'Order creation failed');
        const orderId = orderRes.data.id;
        const deliveryNo = orderRes.data.delivery_number;
        console.log(`  ✔ Created Delivery Order #${orderRes.data.order_number} (Delivery: ${deliveryNo})`);

        // Find delivery ID
        const delivDb = db.prepare('SELECT id FROM deliveries WHERE delivery_number = ?').get(deliveryNo);

        // Dispatcher assigns Driver 1 (Joseph Kiprop)
        const assignRes = await request('/api/dispatch/assign', {
            method: 'POST',
            headers: { Authorization: `Bearer ${dispatcherToken}` },
            body: JSON.stringify({
                delivery_id: delivDb.id,
                driver_id: 1, // Joseph Kiprop
                vehicle_id: 2,
                priority: 'URGENT'
            })
        });
        assert.strictEqual(assignRes.status, 200, 'Dispatcher assignment failed');
        console.log(`  ✔ Dispatcher assigned Delivery ${deliveryNo} to Driver 1`);

        // Driver checks his assigned deliveries
        const driverDeliveries = await request('/api/deliveries/my', {
            headers: { Authorization: `Bearer ${driverToken}` }
        });
        assert.strictEqual(driverDeliveries.status, 200);
        const myJob = driverDeliveries.data.active_deliveries.find(d => d.id === delivDb.id);
        assert.ok(myJob, 'Assigned delivery not visible in driver portal');
        console.log('  ✔ Driver confirmed job in mobile portal');

        // Driver starts delivery
        const startRes = await request(`/api/deliveries/${delivDb.id}/start`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${driverToken}` },
            body: JSON.stringify({ latitude: -1.3032, longitude: 36.8456 })
        });
        assert.strictEqual(startRes.status, 200);
        console.log('  ✔ Driver started delivery (Status: IN_TRANSIT)');

        // Driver completes Proof of Delivery with signature, OTP, and GPS
        const podRes = await request(`/api/deliveries/${delivDb.id}/pod`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${driverToken}` },
            body: JSON.stringify({
                recipient_name: 'Daniel Kigo',
                recipient_phone: '+254 722 991 122',
                otp_code: '9182',
                signature_data: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0xMCAxMCBMMTAwIDEwMCIgc3Ryb2tlPSJibGFjayIvPjwvc3ZnPg==',
                latitude: -1.2721,
                longitude: 36.8122,
                notes: 'Signed and confirmed'
            })
        });
        assert.strictEqual(podRes.status, 200);
        console.log('  ✔ Driver submitted Proof of Delivery (Signature, OTP, GPS tagged)');

        // Verify delivery and order completed
        const finalDeliv = db.prepare('SELECT status FROM deliveries WHERE id = ?').get(delivDb.id);
        assert.strictEqual(finalDeliv.status, 'DELIVERED');
        const finalOrder = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId);
        assert.strictEqual(finalOrder.status, 'DELIVERED');
        console.log('  ✔ Delivery and Order statuses accurately updated to DELIVERED\n');

        // -------------------------------------------------------------
        // TEST 7: Audit Log Immutability & Trigger Verification
        // -------------------------------------------------------------
        console.log('▶ TEST 7: Audit Log Immutability & SQL Triggers...');

        // Verify audit logs were written
        const auditEntries = db.prepare('SELECT count(*) as count FROM audit_logs').get().count;
        assert.ok(auditEntries >= 5, `Expected >= 5 audit entries, found ${auditEntries}`);
        console.log(`  ✔ Verified ${auditEntries} immutable audit log entries recorded`);

        // Test Trigger: Attempt UPDATE on audit_logs
        let updateBlocked = false;
        try {
            db.prepare("UPDATE audit_logs SET reason = 'Tampered Reason' WHERE id = 1").run();
        } catch (err) {
            updateBlocked = true;
            assert.ok(err.message.includes('append-only'), 'Expected append-only violation message');
        }
        assert.strictEqual(updateBlocked, true, 'Database trigger failed to block UPDATE on audit_logs!');
        console.log('  ✔ Database trigger blocked UPDATE on audit_logs with error');

        // Test Trigger: Attempt DELETE on audit_logs
        let deleteBlocked = false;
        try {
            db.prepare('DELETE FROM audit_logs WHERE id = 1').run();
        } catch (err) {
            deleteBlocked = true;
            assert.ok(err.message.includes('append-only'), 'Expected append-only violation message');
        }
        assert.strictEqual(deleteBlocked, true, 'Database trigger failed to block DELETE on audit_logs!');
        console.log('  ✔ Database trigger blocked DELETE on audit_logs with error\n');

        // -------------------------------------------------------------
        // TEST 8: Dynamic Cryptographic Salt Hashing & Transparent Salt Upgrade
        // -------------------------------------------------------------
        console.log('▶ TEST 8: Dynamic Cryptographic Salt Hashing & Transparent Upgrade...');

        const crypto = require('node:crypto');
        const { hashPassword, verifyPassword } = require('../server/utils/security.js');

        // Verify hash format has dynamic salt:derivedKey
        const newHash = hashPassword('SecureTestPass2026!');
        assert.ok(newHash.includes(':'), 'Dynamic salt hash must contain colon separator');
        const [saltHex, derivedKeyHex] = newHash.split(':');
        assert.strictEqual(saltHex.length, 32, 'Salt should be 16 bytes (32 hex characters)');
        assert.strictEqual(derivedKeyHex.length, 128, 'Derived key should be 64 bytes (128 hex characters)');
        const verifyRes = verifyPassword('SecureTestPass2026!', newHash);
        assert.strictEqual(verifyRes.isValid, true, 'Password verification failed on new dynamic hash');
        assert.strictEqual(verifyRes.needsUpgrade, false, 'Dynamic hash should not need upgrade');
        console.log('  ✔ Dynamic per-user salt hashing verified (16-byte random salt + 64-byte scrypt)');

        // Setup legacy user with old static salt
        const legacySalt = 'swifttrack_secure_salt_2026';
        const legacyHash = crypto.scryptSync('OldStaticPass123!', legacySalt, 64).toString('hex');
        const existingLegacyUser = db.prepare('SELECT id FROM users WHERE username = ?').get('test.legacy.user');
        let legacyUserId;
        if (!existingLegacyUser) {
            const ins = db.prepare(`
                INSERT INTO users (branch_id, role_id, username, email, full_name, phone, password_hash, is_active)
                VALUES (1, 4, 'test.legacy.user', 'legacy@swifttrack.co.ke', 'Legacy Salt Test User', '+254 700 999 888', ?, 1)
            `).run(legacyHash);
            legacyUserId = ins.lastInsertRowid;
        } else {
            legacyUserId = existingLegacyUser.id;
            db.prepare('UPDATE users SET password_hash = ?, is_active = 1 WHERE id = ?').run(legacyHash, legacyUserId);
        }

        // Verify login succeeds with legacy hash
        const legacyLoginRes = await request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: 'test.legacy.user', password: 'OldStaticPass123!' })
        });
        assert.strictEqual(legacyLoginRes.status, 200, 'Legacy user login failed');

        // Check DB to verify password_hash was transparently upgraded to dynamic salt format
        const upgradedUser = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(legacyUserId);
        assert.ok(upgradedUser.password_hash.includes(':'), 'Password hash was not transparently upgraded to dynamic salt');
        assert.notStrictEqual(upgradedUser.password_hash, legacyHash, 'Password hash should have been replaced with upgraded hash');
        console.log('  ✔ Transparent zero-downtime password upgrade verified upon login');

        // Deactivate test user (foreign key in audit_logs prevents hard deletion)
        db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(legacyUserId);
        console.log('  ✔ Temporary test user deactivated (audit integrity preserved)\n');

        // -------------------------------------------------------------
        // TEST 9: Production HTTP Security Headers & Auth Config
        // -------------------------------------------------------------
        console.log('▶ TEST 9: Enterprise Security Headers & Auth Configuration...');

        const healthRes = await request('/api/health');
        assert.strictEqual(healthRes.status, 200);
        assert.strictEqual(healthRes.headers.get('x-frame-options'), 'SAMEORIGIN');
        assert.strictEqual(healthRes.headers.get('x-content-type-options'), 'nosniff');
        assert.ok(healthRes.headers.get('content-security-policy'), 'CSP header missing');
        assert.strictEqual(healthRes.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');

        // Verify HSTS specifically active in production mode
        const prevEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        const prodHealth = await request('/api/health');
        assert.ok(prodHealth.headers.get('strict-transport-security'), 'HSTS header should be present in production');
        process.env.NODE_ENV = prevEnv;

        console.log('  ✔ Enterprise security headers verified (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)');

        const configRes = await request('/api/auth/config');
        assert.strictEqual(configRes.status, 200);
        assert.strictEqual(configRes.data.currency, 'KES');
        assert.strictEqual(configRes.data.etimsEnabled, true);
        console.log(`  ✔ Public config verified (Currency: ${configRes.data.currency}, eTIMS: ${configRes.data.etimsEnabled}, DemoMode: ${configRes.data.demoMode})\n`);

        // -------------------------------------------------------------
        // TEST 10: Production Demo Mode Enforcement Guard
        // -------------------------------------------------------------
        console.log('▶ TEST 10: Production Demo Mode Hard-Disable Guard...');

        const originalDemoMode = process.env.DEMO_MODE;
        const originalNodeEnv = process.env.NODE_ENV;

        try {
            // Emulate production mode with DEMO_MODE disabled
            process.env.DEMO_MODE = 'false';
            process.env.NODE_ENV = 'production';

            const prodSwitchRes = await request('/api/auth/demo-switch', {
                method: 'POST',
                body: JSON.stringify({ role: 'SUPER_ADMIN' })
            });

            assert.strictEqual(prodSwitchRes.status, 403, 'Demo switch should return 403 in production mode');
            assert.ok(prodSwitchRes.data.error.includes('disabled in production mode'), 'Error message should explain demo switching is disabled');
            console.log('  ✔ Demo switch correctly rejected with 403 Forbidden when DEMO_MODE=false');
        } finally {
            process.env.DEMO_MODE = originalDemoMode;
            process.env.NODE_ENV = originalNodeEnv;
        }
        console.log('  ✔ Production mode environment guard verified\n');

        // -------------------------------------------------------------
        // TEST 11: Enterprise Database Backup Engine
        // -------------------------------------------------------------
        console.log('▶ TEST 11: Enterprise Database Snapshot Backup...');

        const { createBackup } = require('../server/db/backup.js');
        const fs = require('node:fs');

        const backupResult = createBackup();
        assert.ok(fs.existsSync(backupResult.path), 'Backup snapshot file was not created on disk');
        assert.ok(backupResult.size > 0, 'Backup snapshot file is empty');
        assert.strictEqual(backupResult.sha256.length, 64, 'Backup SHA-256 checksum is invalid');
        console.log(`  ✔ Point-in-time snapshot backup verified (${backupResult.filename}, ${backupResult.size} bytes)`);
        console.log(`  ✔ SHA-256 integrity checksum: ${backupResult.sha256}\n`);

        // -------------------------------------------------------------
        // TEST 12: Inter-Branch Stock Transfer Lifecycle
        // -------------------------------------------------------------
        console.log('▶ TEST 12: Inter-Branch Stock Transfer Lifecycle (Nairobi -> Mombasa)...');

        const nrbStockBefore = db.prepare('SELECT quantity_on_hand FROM inventory WHERE warehouse_id = 1 AND product_id = 1').get()?.quantity_on_hand || 0;
        const msaStockBefore = db.prepare('SELECT quantity_on_hand FROM inventory WHERE warehouse_id = 3 AND product_id = 1').get()?.quantity_on_hand || 0;

        // 1. Nairobi Manager requests transfer of 5 units to Mombasa
        const trfReq = await request('/api/inventory/transfers', {
            method: 'POST',
            headers: { Authorization: `Bearer ${mgrNrbToken}` },
            body: JSON.stringify({
                source_branch_id: 1,
                source_warehouse_id: 1,
                target_branch_id: 2,
                target_warehouse_id: 3,
                items: [{ product_id: 1, quantity: 5 }],
                notes: 'Automated test inter-branch rebalance'
            })
        });
        assert.strictEqual(trfReq.status, 201, 'Transfer creation failed');
        assert.strictEqual(trfReq.data.status, 'PENDING_APPROVAL');
        const transferId = trfReq.data.id;
        const transferNo = trfReq.data.transfer_number;
        console.log(`  ✔ Transfer request created: ${transferNo} (ID: ${transferId}, Status: PENDING_APPROVAL)`);

        // 2. Nairobi Manager approves transfer
        const trfApprove = await request(`/api/inventory/transfers/${transferId}/status`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${mgrNrbToken}` },
            body: JSON.stringify({ action: 'APPROVE' })
        });
        assert.strictEqual(trfApprove.status, 200, 'Transfer approval failed');
        console.log('  ✔ Transfer approved (Status: APPROVED)');

        // 3. Dispatch transfer (stock deducted at source)
        const trfDispatch = await request(`/api/inventory/transfers/${transferId}/status`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${mgrNrbToken}` },
            body: JSON.stringify({ action: 'DISPATCH' })
        });
        assert.strictEqual(trfDispatch.status, 200, 'Transfer dispatch failed');
        const nrbStockAfterDispatch = db.prepare('SELECT quantity_on_hand FROM inventory WHERE warehouse_id = 1 AND product_id = 1').get().quantity_on_hand;
        assert.strictEqual(nrbStockAfterDispatch, nrbStockBefore - 5, 'Source stock was not decremented on dispatch');
        console.log(`  ✔ Transfer dispatched: Source inventory decremented from ${nrbStockBefore} to ${nrbStockAfterDispatch} (TRANSFER_OUT)`);

        // 4. Mombasa Manager receives transfer (stock added at destination)
        const trfReceive = await request(`/api/inventory/transfers/${transferId}/status`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${mgrMsaToken}` },
            body: JSON.stringify({ action: 'RECEIVE' })
        });
        assert.strictEqual(trfReceive.status, 200, 'Transfer receive failed');
        const msaStockAfterReceive = db.prepare('SELECT quantity_on_hand FROM inventory WHERE warehouse_id = 3 AND product_id = 1').get().quantity_on_hand;
        assert.strictEqual(msaStockAfterReceive, msaStockBefore + 5, 'Target stock was not incremented on receive');
        console.log(`  ✔ Transfer received: Target inventory incremented from ${msaStockBefore} to ${msaStockAfterReceive} (TRANSFER_IN)`);

        // 5. Verify movements ledger records
        const trfOutMovement = db.prepare("SELECT * FROM inventory_movements WHERE reference_id = ? AND movement_type = 'TRANSFER_OUT'").get(transferNo);
        assert.ok(trfOutMovement, 'TRANSFER_OUT movement ledger entry missing');
        const trfInMovement = db.prepare("SELECT * FROM inventory_movements WHERE reference_id = ? AND movement_type = 'TRANSFER_IN'").get(transferNo);
        assert.ok(trfInMovement, 'TRANSFER_IN movement ledger entry missing');
        console.log('  ✔ Verified dual-hub ledger entries (TRANSFER_OUT & TRANSFER_IN)\n');

        // -------------------------------------------------------------
        // TEST 13: POS Catalog & Pricing Schema Integrity
        // -------------------------------------------------------------
        console.log('▶ TEST 13: POS Product Catalog & Pricing Integrity Check...');

        // 1. GET /api/products as Cashier
        const prodsRes = await request('/api/products', {
            headers: { Authorization: `Bearer ${cashierToken}` }
        });
        assert.strictEqual(prodsRes.status, 200, 'Products listing failed');
        assert.ok(Array.isArray(prodsRes.data) && prodsRes.data.length > 0, 'No products returned');
        const firstProd = prodsRes.data[0];
        assert.ok(firstProd.price !== undefined && firstProd.price > 0, `Product price missing or 0: ${firstProd.price}`);
        assert.ok(firstProd.selling_price !== undefined && firstProd.selling_price > 0, `Product selling_price missing or 0: ${firstProd.selling_price}`);
        assert.ok(firstProd.category, `Product category missing: ${firstProd.category}`);
        assert.ok(firstProd.category_name, `Product category_name missing: ${firstProd.category_name}`);
        console.log(`  ✔ Verified /api/products returns dual price/selling_price (${firstProd.price}) and category (${firstProd.category})`);

        // 2. GET /api/pos/products as Cashier
        const posProdsRes = await request('/api/pos/products', {
            headers: { Authorization: `Bearer ${cashierToken}` }
        });
        assert.strictEqual(posProdsRes.status, 200, 'POS products listing failed');
        assert.ok(Array.isArray(posProdsRes.data) && posProdsRes.data.length > 0, 'No POS products returned');
        const posFirstProd = posProdsRes.data[0];
        assert.ok(posFirstProd.price !== undefined && posFirstProd.price > 0, `POS product price missing or 0: ${posFirstProd.price}`);
        assert.ok(posFirstProd.selling_price !== undefined && posFirstProd.selling_price > 0, `POS product selling_price missing or 0: ${posFirstProd.selling_price}`);
        assert.ok(posFirstProd.category, `POS product category missing: ${posFirstProd.category}`);
        console.log(`  ✔ Verified /api/pos/products returns dual price/selling_price (${posFirstProd.price}) and category (${posFirstProd.category})`);

        // 3. Barcode lookup
        const barcodeProdRes = await request(`/api/products/barcode/${firstProd.barcode}`, {
            headers: { Authorization: `Bearer ${cashierToken}` }
        });
        assert.strictEqual(barcodeProdRes.status, 200, 'Barcode lookup failed');
        assert.ok(barcodeProdRes.data.price !== undefined && barcodeProdRes.data.price > 0, 'Barcode price missing or 0');
        assert.ok(barcodeProdRes.data.category, 'Barcode category missing');
        console.log(`  ✔ Verified /api/products/barcode/:barcode returns price (${barcodeProdRes.data.price}) and category (${barcodeProdRes.data.category})\n`);

        // -------------------------------------------------------------
        // TEST 14: Notification Counter & Read/Unread Lifecycle
        // -------------------------------------------------------------
        console.log('▶ TEST 14: Notification Counter & Read/Unread Lifecycle...');

        // 1. GET /api/notifications as Cashier
        const notifsRes = await request('/api/notifications', {
            headers: { Authorization: `Bearer ${cashierToken}` }
        });
        assert.strictEqual(notifsRes.status, 200, 'Notifications listing failed');
        assert.strictEqual(typeof notifsRes.data.unread_count, 'number', 'unread_count is not a number');
        assert.ok(Array.isArray(notifsRes.data.notifications), 'notifications is not an array');
        const initialUnread = notifsRes.data.unread_count;
        console.log(`  ✔ Verified notification listing (Total: ${notifsRes.data.notifications.length}, Unread: ${initialUnread})`);

        // 2. Mark one notification as read if available
        const unreadItem = notifsRes.data.notifications.find(n => !n.is_read);
        if (unreadItem) {
            const markOneRes = await request(`/api/notifications/${unreadItem.id}/read`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${cashierToken}` }
            });
            assert.strictEqual(markOneRes.status, 200, 'Marking notification read failed');

            const afterOneRes = await request('/api/notifications', {
                headers: { Authorization: `Bearer ${cashierToken}` }
            });
            assert.strictEqual(afterOneRes.data.unread_count, initialUnread - 1, 'Unread count did not decrement after marking single notification read');
            console.log(`  ✔ Verified single notification read decrement (${initialUnread} -> ${afterOneRes.data.unread_count})`);
        }

        // 3. Mark all notifications as read
        const markAllRes = await request('/api/notifications/read-all', {
            method: 'POST',
            headers: { Authorization: `Bearer ${cashierToken}` }
        });
        assert.strictEqual(markAllRes.status, 200, 'Mark all read failed');

        const afterAllRes = await request('/api/notifications', {
            headers: { Authorization: `Bearer ${cashierToken}` }
        });
        assert.strictEqual(afterAllRes.data.unread_count, 0, 'Unread count is not 0 after read-all');
        console.log('  ✔ Verified read-all clears notification counter to 0\n');

        console.log('================================================================');
        console.log('🎉 ALL 14 SYSTEM VERIFICATION TESTS PASSED SUCCESSFULLY!');
        console.log('================================================================\n');

    } catch (error) {
        console.error('❌ Test suite failed:', error);
        process.exit(1);
    } finally {
        if (server) server.close();
    }
}

if (require.main === module) {
    runTests();
}

module.exports = runTests;
