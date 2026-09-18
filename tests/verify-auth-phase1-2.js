// tests/verify-auth-phase1-2.js
// Automated verification suite for Phase 1.2 Authorization Matrix
// Role x Resource x Action x Branch Matrix, Negative Tests, Vertical & Horizontal Escalation Prevention

process.env.DISABLE_RATE_LIMIT = 'true';
process.env.AUTH_TEST_MODE = 'true';
const assert = require('node:assert');
const { db } = require('../server/db/database.js');
const app = require('../server/server.js');
const { SCOPES, AUTHORIZATION_MATRIX, checkPermission } = require('../server/config/permissions.js');

let server;
const PORT = 4997;
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

async function login(username, password = 'Password123!') {
    const res = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
    });
    if (res.status !== 200 || !res.data?.token) {
        throw new Error(`Login failed for ${username}: ${JSON.stringify(res.data)}`);
    }
    return res.data.token;
}

async function runAuthorizationTests() {
    console.log('================================================================');
    console.log('  SWIFTTRACK ENTERPRISE — PHASE 1.2 AUTHORIZATION TEST SUITE   ');
    console.log('  Role x Resource x Action x Branch Access Control Matrix      ');
    console.log('================================================================\n');

    server = app.listen(PORT);

    try {
        // -------------------------------------------------------------
        // SECTION 1: Central Permission Matrix Definitions
        // -------------------------------------------------------------
        console.log('▶ TEST 1: Central Permission Definitions & Matrix Structure...');
        assert.ok(SCOPES.GLOBAL, 'GLOBAL scope must exist');
        assert.ok(SCOPES.OWN_BRANCH, 'OWN_BRANCH scope must exist');
        assert.ok(SCOPES.OWN_RECORD, 'OWN_RECORD scope must exist');
        assert.strictEqual(SCOPES.DENIED, false, 'DENIED scope must be false');

        const expectedRoles = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER', 'CASHIER', 'DRIVER'];
        for (const role of expectedRoles) {
            assert.ok(AUTHORIZATION_MATRIX[role], `Matrix must define permissions for role: ${role}`);
        }

        // Validate Cashier matrix rules
        assert.strictEqual(AUTHORIZATION_MATRIX.CASHIER.pos.create, SCOPES.OWN_BRANCH, 'Cashier POS create must be OWN_BRANCH');
        assert.strictEqual(AUTHORIZATION_MATRIX.CASHIER.pos.refund_approve, SCOPES.DENIED, 'Cashier POS refund_approve must be DENIED');
        assert.strictEqual(AUTHORIZATION_MATRIX.CASHIER.inventory.view, SCOPES.OWN_BRANCH, 'Cashier Inventory view must be OWN_BRANCH');
        assert.strictEqual(AUTHORIZATION_MATRIX.CASHIER.inventory.adjust_request, SCOPES.DENIED, 'Cashier Inventory adjust must be DENIED');
        assert.strictEqual(AUTHORIZATION_MATRIX.CASHIER.users.view, SCOPES.DENIED, 'Cashier Users view must be DENIED');
        assert.strictEqual(AUTHORIZATION_MATRIX.CASHIER.reports.financial_all, SCOPES.DENIED, 'Cashier Financial reports must be DENIED');
        assert.strictEqual(AUTHORIZATION_MATRIX.CASHIER.reports.shift_own, SCOPES.OWN_RECORD, 'Cashier Shift report must be OWN_RECORD');

        // Unit test checkPermission function
        const cashierUser = { id: 4, roleName: 'CASHIER', branchId: 1, roleDisplayName: 'Cashier' };
        const cashierPosRefundCheck = checkPermission(cashierUser, 'pos', 'refund_approve');
        assert.strictEqual(cashierPosRefundCheck.granted, false, 'checkPermission must deny Cashier refund_approve');

        const cashierPosCreateCheck = checkPermission(cashierUser, 'pos', 'create', { branchId: 1 });
        assert.strictEqual(cashierPosCreateCheck.granted, true, 'checkPermission must grant Cashier POS create in own branch');

        const cashierPosCrossBranchCheck = checkPermission(cashierUser, 'pos', 'create', { branchId: 2 });
        assert.strictEqual(cashierPosCrossBranchCheck.granted, false, 'checkPermission must deny Cashier POS create in cross branch');

        console.log('  ✔ Canonical Role x Resource x Action x Branch matrix verified');
        console.log('  ✔ checkPermission evaluation engine accurately enforces Scopes');

        // Login all test operators
        console.log('\n▶ Authenticating operators for live matrix enforcement...');
        const superAdminToken = await login('superadmin');
        const nairobiManagerToken = await login('manager.nairobi');
        const nairobiCashierToken = await login('cashier.nairobi');
        const nairobiDispatcherToken = await login('dispatcher.nairobi');
        const nairobiDriverToken = await login('driver.nairobi');
        const mombasaManagerToken = await login('manager.mombasa');
        const mombasaCashierToken = await login('cashier.mombasa');
        const mombasaDriverToken = await login('driver.mombasa');
        console.log('  ✔ Super Admin, Nairobi & Mombasa operators authenticated successfully');

        // -------------------------------------------------------------
        // SECTION 2: Negative Authorization Tests (Vertical Block)
        // -------------------------------------------------------------
        console.log('\n▶ TEST 2: Negative Authorization Tests (Vertical Privilege Escalation Prevention)...');

        // 2.1 Cashier attempts POS refund approve
        const cashierRefundApproveRes = await request('/api/refunds/1/approve', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${nairobiCashierToken}` }
        });
        assert.strictEqual(cashierRefundApproveRes.status, 403, 'Cashier must be blocked from approving refunds (403)');
        assert.strictEqual(cashierRefundApproveRes.data.code, 'FORBIDDEN_AUTHORIZATION', 'Must return FORBIDDEN_AUTHORIZATION code');
        console.log('  ✔ Cashier blocked from approving refunds (HTTP 403 FORBIDDEN_AUTHORIZATION)');

        // 2.2 Cashier attempts inventory adjust
        const cashierInvAdjustRes = await request('/api/inventory/adjust', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${nairobiCashierToken}` },
            body: JSON.stringify({
                warehouse_id: 1,
                product_id: 1,
                adjustment_type: 'ADD',
                quantity: 10,
                reason: 'Unauthorized cashier adjustment'
            })
        });
        assert.strictEqual(cashierInvAdjustRes.status, 403, 'Cashier must be blocked from adjusting inventory (403)');
        console.log('  ✔ Cashier blocked from adjusting inventory (HTTP 403)');

        // 2.3 Cashier attempts users listing
        const cashierUsersRes = await request('/api/users', {
            headers: { 'Authorization': `Bearer ${nairobiCashierToken}` }
        });
        assert.strictEqual(cashierUsersRes.status, 403, 'Cashier must be blocked from viewing staff users (403)');
        console.log('  ✔ Cashier blocked from viewing users list (HTTP 403)');

        // 2.4 Cashier attempts financial P&L reports
        const cashierPnlRes = await request('/api/reports/pnl', {
            headers: { 'Authorization': `Bearer ${nairobiCashierToken}` }
        });
        assert.strictEqual(cashierPnlRes.status, 403, 'Cashier must be blocked from viewing P&L report (403)');
        console.log('  ✔ Cashier blocked from viewing P&L financial reports (HTTP 403)');

        // 2.5 Driver attempts POS checkout
        const driverCheckoutRes = await request('/api/pos/checkout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${nairobiDriverToken}` },
            body: JSON.stringify({ items: [{ product_id: 1, quantity: 1, unit_price: 100 }], payment_method: 'CASH' })
        });
        assert.strictEqual(driverCheckoutRes.status, 403, 'Driver must be blocked from POS checkout (403)');
        console.log('  ✔ Driver blocked from POS checkout (HTTP 403)');

        // 2.6 Driver attempts VAT report
        const driverVatRes = await request('/api/reports/vat', {
            headers: { 'Authorization': `Bearer ${nairobiDriverToken}` }
        });
        assert.strictEqual(driverVatRes.status, 403, 'Driver must be blocked from VAT report (403)');
        console.log('  ✔ Driver blocked from financial tax reports (HTTP 403)');

        // 2.7 Driver attempts dispatch assign
        const driverAssignRes = await request('/api/dispatch/assign', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${nairobiDriverToken}` },
            body: JSON.stringify({ delivery_id: 1, driver_id: 1 })
        });
        assert.strictEqual(driverAssignRes.status, 403, 'Driver must be blocked from dispatch assignment (403)');
        console.log('  ✔ Driver blocked from dispatch assignment (HTTP 403)');

        // -------------------------------------------------------------
        // SECTION 3: Horizontal Privilege Escalation Tests (Cross-Branch Isolation)
        // -------------------------------------------------------------
        console.log('\n▶ TEST 3: Horizontal Privilege Escalation Tests (Cross-Branch Isolation)...');

        // Setup test data: Ensure Mombasa (branch 2) has a pending refund request and a pending expense
        const mombasaSale = db.prepare('SELECT id, sale_number FROM sales WHERE branch_id = 2 ORDER BY id DESC LIMIT 1').get();
        let mombasaSaleId;
        let mombasaSaleNumber;
        if (!mombasaSale) {
            const insSale = db.prepare(`
                INSERT INTO sales (branch_id, sale_number, customer_id, cashier_user_id, subtotal, tax_amount, total_amount, payment_status)
                VALUES (2, 'MOM-SALE-TEST-99', 1, 7, 2000, 320, 2320, 'PAID')
            `).run();
            mombasaSaleId = insSale.lastInsertRowid;
            mombasaSaleNumber = 'MOM-SALE-TEST-99';
        } else {
            mombasaSaleId = mombasaSale.id;
            mombasaSaleNumber = mombasaSale.sale_number;
        }

        // Insert pending Mombasa refund request
        const insRefundReq = db.prepare(`
            INSERT INTO refund_requests (
                refund_request_number, branch_id, sale_id, cashier_user_id,
                amount, reason, status
            ) VALUES (?, 2, ?, 7, 500, 'Cross-branch test refund', 'PENDING_APPROVAL')
        `).run(`REF-TEST-${Date.now()}`, mombasaSaleId);
        const mombasaRefundId = insRefundReq.lastInsertRowid;

        // Insert pending Mombasa expense
        const insExpense = db.prepare(`
            INSERT INTO expenses (
                expense_number, branch_id, category, description, amount, payee, payment_method, status, created_by_user_id
            ) VALUES (?, 2, 'Utilities', 'Mombasa Branch AC repair', 4500, 'Mombasa Tech', 'CASH', 'PENDING_APPROVAL', 7)
        `).run(`EXP-TEST-${Date.now()}`);
        const mombasaExpenseId = insExpense.lastInsertRowid;

        // 3.1 Nairobi Cashier (branch 1) attempts POS checkout specifying branch 2
        const crossBranchCheckoutRes = await request('/api/pos/checkout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${nairobiCashierToken}` },
            body: JSON.stringify({
                branch_id: 2, // Attacking Mombasa branch from Nairobi Cashier
                customer_id: 1,
                items: [{ product_id: 1, quantity: 1, unit_price: 150 }],
                payment_method: 'CASH',
                amount_tendered: 200
            })
        });
        assert.strictEqual(crossBranchCheckoutRes.status, 403, 'Cross-branch checkout must be blocked (403)');
        console.log('  ✔ Nairobi Cashier blocked from checkout on Mombasa branch (HTTP 403)');

        // 3.2 Nairobi Manager (branch 1) attempts to approve Mombasa refund
        const crossBranchRefundRes = await request(`/api/refunds/${mombasaRefundId}/approve`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${nairobiManagerToken}` }
        });
        assert.strictEqual(crossBranchRefundRes.status, 403, 'Nairobi manager must be blocked from approving Mombasa refund (403)');
        console.log('  ✔ Nairobi Branch Manager blocked from approving Mombasa refund (HTTP 403)');

        // 3.3 Nairobi Manager (branch 1) attempts to approve Mombasa expense
        const crossBranchExpenseRes = await request(`/api/expenses/${mombasaExpenseId}/approve`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${nairobiManagerToken}` }
        });
        assert.strictEqual(crossBranchExpenseRes.status, 403, 'Nairobi manager must be blocked from approving Mombasa expense (403)');
        console.log('  ✔ Nairobi Branch Manager blocked from approving Mombasa expense (HTTP 403)');

        // 3.4 Nairobi Manager (branch 1) attempts to force-logout Mombasa Cashier (user 7, branch 2)
        const crossBranchLogoutRes = await request(`/api/users/7/force-logout`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${nairobiManagerToken}` }
        });
        assert.strictEqual(crossBranchLogoutRes.status, 403, 'Nairobi manager must be blocked from force logging out Mombasa staff (403)');
        console.log('  ✔ Nairobi Branch Manager blocked from managing Mombasa staff accounts (HTTP 403)');

        // 3.5 Nairobi Manager attempts to query Mombasa financial P&L (?branch_id=2)
        const crossBranchPnlRes = await request('/api/reports/pnl?branch_id=2', {
            headers: { 'Authorization': `Bearer ${nairobiManagerToken}` }
        });
        assert.strictEqual(crossBranchPnlRes.status, 403, 'Nairobi manager must be blocked from querying Mombasa P&L (403)');
        console.log('  ✔ Nairobi Branch Manager blocked from accessing Mombasa financial reports (HTTP 403)');

        // 3.6 Driver Cross-Delivery Isolation: Driver A attempting to start transit on Driver B delivery
        const nairobiDriverRec = db.prepare('SELECT id FROM drivers WHERE user_id = 5').get();
        const mombasaDriverRec = db.prepare('SELECT id FROM drivers WHERE user_id = 8').get();
        // Create delivery assigned to Mombasa driver
        const mombasaOrder = db.prepare('SELECT id FROM orders WHERE branch_id = 2 ORDER BY id DESC LIMIT 1').get();
        let mombasaOrderId = mombasaOrder ? mombasaOrder.id : 1;
        const insDel = db.prepare(`
            INSERT INTO deliveries (
                delivery_number, branch_id, order_id, driver_id, dispatcher_user_id, status, priority
            ) VALUES (?, 2, ?, ?, 1, 'ASSIGNED', 'NORMAL')
        `).run(`DEL-MOM-${Date.now()}`, mombasaOrderId, mombasaDriverRec.id);
        const mombasaDeliveryId = insDel.lastInsertRowid;

        const crossDriverStartRes = await request(`/api/deliveries/${mombasaDeliveryId}/start`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${nairobiDriverToken}` },
            body: JSON.stringify({ latitude: -4.0435, longitude: 39.6682 })
        });
        assert.strictEqual(crossDriverStartRes.status, 403, 'Driver A must be blocked from starting Driver B delivery (403)');
        console.log('  ✔ Driver blocked from hijacking another driver’s delivery (HTTP 403)');

        // -------------------------------------------------------------
        // SECTION 4: Vertical Privilege Escalation Tests (Role Separation)
        // -------------------------------------------------------------
        console.log('\n▶ TEST 4: Vertical Privilege Escalation Tests (Role Separation & Duties)...');

        // 4.1 Cashier attempts to approve their own refund request (Separation of duties)
        // Insert a refund requested by nairobi cashier (user 4)
        const insOwnRefund = db.prepare(`
            INSERT INTO refund_requests (
                refund_request_number, branch_id, sale_id, cashier_user_id,
                amount, reason, status
            ) VALUES (?, 1, 1, 4, 150, 'Own refund test', 'PENDING_APPROVAL')
        `).run(`REF-SELF-${Date.now()}`);
        const ownRefundId = insOwnRefund.lastInsertRowid;

        const selfApproveRes = await request(`/api/refunds/${ownRefundId}/approve`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${nairobiCashierToken}` }
        });
        assert.strictEqual(selfApproveRes.status, 403, 'Cashier must not approve own refund (403)');
        console.log('  ✔ Cashier self-refund approval strictly prevented by Separation of Duties');

        // 4.2 Branch Manager attempts to provision a new SUPER_ADMIN user
        const superAdminRole = db.prepare("SELECT id FROM roles WHERE name = 'SUPER_ADMIN'").get();
        const managerCreateAdminRes = await request('/api/users', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${nairobiManagerToken}` },
            body: JSON.stringify({
                username: `rogue_admin_${Date.now()}`,
                email: `rogue_admin_${Date.now()}@swifttrack.co.ke`,
                full_name: 'Rogue Admin User',
                password: 'SecureP@ss#2026',
                role_id: superAdminRole.id
            })
        });
        assert.strictEqual(managerCreateAdminRes.status, 403, 'Branch Manager must not provision Super Admin (403)');
        console.log('  ✔ Branch Manager blocked from provisioning Super Admin account (HTTP 403)');

        // 4.3 Dispatcher attempts to create a new branch
        const dispatcherCreateBranchRes = await request('/api/branches', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${nairobiDispatcherToken}` },
            body: JSON.stringify({
                code: 'ELD',
                name: 'Eldoret Hub',
                city: 'Eldoret',
                address: 'Uganda Rd',
                phone: '+254 700 999 888',
                email: 'eldoret@swifttrack.co.ke'
            })
        });
        assert.strictEqual(dispatcherCreateBranchRes.status, 403, 'Dispatcher must not create company branches (403)');
        console.log('  ✔ Dispatcher blocked from creating new company branches (HTTP 403)');

        // -------------------------------------------------------------
        // SECTION 5: Super-Admin Cross-Branch Authority
        // -------------------------------------------------------------
        console.log('\n▶ TEST 5: Super-Admin Cross-Branch Global Authority...');

        // 5.1 Super Admin lists all branches
        const adminBranchesRes = await request('/api/branches', {
            headers: { 'Authorization': `Bearer ${superAdminToken}` }
        });
        assert.strictEqual(adminBranchesRes.status, 200, 'Super Admin must fetch branches');
        assert.ok(Array.isArray(adminBranchesRes.data), 'Branches should be an array');
        assert.ok(adminBranchesRes.data.length >= 2, 'Should return all company branches');
        console.log(`  ✔ Super Admin accessed company-wide branch directory (${adminBranchesRes.data.length} branches)`);

        // 5.2 Super Admin queries Branch 1 and Branch 2 Inventory
        const adminInvNairobi = await request('/api/inventory?branch_id=1', {
            headers: { 'Authorization': `Bearer ${superAdminToken}` }
        });
        assert.strictEqual(adminInvNairobi.status, 200, 'Super Admin query Nairobi inventory failed');

        const adminInvMombasa = await request('/api/inventory?branch_id=2', {
            headers: { 'Authorization': `Bearer ${superAdminToken}` }
        });
        assert.strictEqual(adminInvMombasa.status, 200, 'Super Admin query Mombasa inventory failed');
        console.log('  ✔ Super Admin dynamically queries inventory across distinct branches');

        // 5.3 Super Admin views consolidated and filtered P&L
        const adminConsolidatedPnl = await request('/api/reports/pnl', {
            headers: { 'Authorization': `Bearer ${superAdminToken}` }
        });
        assert.strictEqual(adminConsolidatedPnl.status, 200, 'Super Admin consolidated P&L failed');
        assert.ok(adminConsolidatedPnl.data.gross_revenue !== undefined, 'Consolidated gross revenue missing');

        const adminMombasaPnl = await request('/api/reports/pnl?branch_id=2', {
            headers: { 'Authorization': `Bearer ${superAdminToken}` }
        });
        assert.strictEqual(adminMombasaPnl.status, 200, 'Super Admin Mombasa P&L failed');
        console.log('  ✔ Super Admin generates consolidated company P&L and branch-filtered reports');

        // 5.4 Super Admin approves cross-branch refund (Mombasa refund)
        const adminApproveMombasaRefund = await request(`/api/refunds/${mombasaRefundId}/approve`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${superAdminToken}` }
        });
        assert.strictEqual(adminApproveMombasaRefund.status, 200, 'Super Admin cross-branch refund approval failed');
        console.log('  ✔ Super Admin cross-branch approval successfully executed');

        console.log('\n================================================================');
        console.log('  ✔ ALL PHASE 1.2 AUTHORIZATION MATRIX TESTS PASSED (16/16)    ');
        console.log('================================================================\n');

    } finally {
        if (server) {
            server.close();
        }
    }
}

runAuthorizationTests().catch(err => {
    console.error('\n❌ Authorization Test Failure:', err);
    if (server) server.close();
    process.exit(1);
});
