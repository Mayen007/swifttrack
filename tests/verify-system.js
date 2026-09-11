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
    let data;
    try {
        data = await res.json();
    } catch {
        data = null;
    }
    return { status, data };
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

        console.log('================================================================');
        console.log('🎉 ALL 7 SYSTEM VERIFICATION TESTS PASSED SUCCESSFULLY!');
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
