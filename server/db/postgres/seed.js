// server/db/postgres/seed.js
// Enterprise PostgreSQL Reseed & Foundation Seeder for SwiftTrack Kenya Logistics Platform
const { getPool, closePool } = require('./pool.js');
const { withTransaction } = require('./transactions.js');
const { hashPassword } = require('../../utils/security.js');
const { AUTHORIZATION_MATRIX } = require('../../config/permissions.js');

/**
 * Resets sequence for a PostgreSQL table to MAX(id) + 1.
 */
async function resetSequence(client, tableName, idCol = 'id') {
    try {
        await client.query(`
            SELECT setval(
                pg_get_serial_sequence('${tableName}', '${idCol}'),
                COALESCE((SELECT MAX(${idCol}) FROM ${tableName}), 0) + 1,
                false
            );
        `);
    } catch {
        // Table might not use a serial sequence
    }
}

/**
 * Cleanly truncates all application tables while respecting immutability triggers.
 */
async function truncateAllTables(client) {
    console.log('[PostgreSQL Seed] Purging existing records and corrupted test data...');

    // Disable triggers that prevent updates/deletions during administrative maintenance
    const immutableTriggers = [
        { table: 'audit_logs', trigger: 'trg_prevent_audit_logs_delete' },
        { table: 'audit_logs', trigger: 'trg_prevent_audit_logs_update' },
        { table: 'proof_of_delivery', trigger: 'trg_prevent_pod_mutation' },
        { table: 'scan_events', trigger: 'trg_prevent_scan_events_mutation' },
        { table: 'tracking_events', trigger: 'trg_tracking_events_immutable' }
    ];

    for (const item of immutableTriggers) {
        try {
            await client.query(`ALTER TABLE ${item.table} DISABLE TRIGGER ALL;`);
        } catch {
            // Trigger or table might not exist
        }
    }

    const tablesToTruncate = [
        'notification_logs', 'notification_outbox', 'offline_sync_logs',
        'cod_settlements', 'delivery_attempts', 'proof_of_delivery', 'delivery_items', 'deliveries',
        'handoffs', 'discrepancies', 'hub_receiving_items', 'hub_receiving_sessions',
        'manifest_items', 'manifests', 'run_checkpoints', 'transport_runs', 'route_legs', 'routes',
        'tracking_events', 'scan_events', 'parcels', 'shipment_legs', 'shipments',
        'logistics_pricing_tariffs', 'idempotency_keys',
        'sale_items', 'sales', 'held_sales', 'payment_refunds', 'payment_callbacks', 'payment_intents',
        'payment_audit_trail', 'payments', 'refund_requests', 'refunds', 'expenses', 'cash_drawer_movements', 'pos_shifts',
        'order_status_history', 'order_internal_notes', 'order_items', 'orders',
        'customer_notes', 'customer_addresses', 'customer_product_prices', 'customers',
        'stock_write_offs', 'stocktake_items', 'stocktakes', 'stock_adjustments', 'stock_receipt_items', 'stock_receipts',
        'stock_transfer_items', 'stock_transfers', 'inventory_movements', 'inventory_serials', 'inventory_batches', 'variant_inventory', 'inventory',
        'supplier_return_items', 'supplier_returns', 'supplier_payments', 'supplier_invoices', 'purchase_order_items', 'purchase_orders',
        'purchase_requisition_items', 'purchase_requisitions', 'procurement_audit_trail', 'supplier_contacts', 'supplier_products', 'suppliers',
        'promotions', 'product_bulk_pricing', 'branch_product_prices', 'product_variants', 'products', 'brands', 'categories',
        'driver_incident_logs', 'driver_status_history', 'drivers', 'vehicle_fuel_logs', 'vehicle_maintenance_records', 'vehicle_mileage_logs', 'vehicles',
        'user_sessions', 'login_history', 'revoked_tokens', 'password_reset_tokens', 'users', 'role_permissions',
        'warehouses', 'branches', 'company_settings', 'audit_logs'
    ];

    for (const tbl of tablesToTruncate) {
        try {
            await client.query(`TRUNCATE TABLE ${tbl} RESTART IDENTITY CASCADE;`);
        } catch (err) {
            console.warn(`[Truncate Notice] Skipping ${tbl}:`, err.message);
        }
    }

    for (const item of immutableTriggers) {
        try {
            await client.query(`ALTER TABLE ${item.table} ENABLE TRIGGER ALL;`);
        } catch {
            // Trigger or table might not exist
        }
    }

    console.log('[PostgreSQL Seed] [OK] Database cleanly wiped of all corrupted/test data.');
}

/**
 * Seeds a complete, coherent logistics and POS enterprise dataset.
 */
async function seedCleanEnterpriseData(pool = null, options = {}) {
    const shouldClean = options.clean !== false;
    console.log(`[PostgreSQL Seed] Starting clean enterprise seeding (Clean: ${shouldClean})...`);

    await withTransaction(async (client) => {
        if (shouldClean) {
            await truncateAllTables(client);
        }

        // 1. Company Settings
        console.log('  -> Seeding company settings...');
        await client.query(`
            INSERT INTO company_settings (
                id, company_name, registration_number, kra_pin, vat_rate, currency,
                phone, email, address, city, country, receipt_header, receipt_footer,
                etims_enabled, etims_branch_code
            ) VALUES (
                1, 'SwiftTrack Kenya Logistics Ltd', 'CPR/2021/88921', 'P051234567Z', 16.00, 'KES',
                '+254 700 123 456', 'info@swifttrack.co.ke', 'Enterprise Road, Industrial Area, Plot 42',
                'Nairobi', 'Kenya',
                '*** SWIFTTRACK KENYA LOGISTICS & POS ***\nYour Trusted Cross-Country Supply Partner',
                'Thank you for partnering with SwiftTrack Kenya!\neTIMS Certified Tax Invoice\nGoods once sold subject to return policy.',
                true, '00'
            )
            ON CONFLICT (id) DO UPDATE SET
                company_name = EXCLUDED.company_name,
                kra_pin = EXCLUDED.kra_pin,
                address = EXCLUDED.address;
        `);

        // 2. Authentic Regional Hub Branches
        console.log('  -> Seeding 4 authentic regional branches...');
        const branches = [
            {
                id: 1,
                code: 'NRB-HQ',
                name: 'Nairobi Central Hub',
                city: 'Nairobi',
                address: 'Enterprise Rd, Industrial Area',
                phone: '+254 711 111 001',
                email: 'nairobi@swifttrack.co.ke',
                is_hub: true,
                hub_type: 'HEADQUARTERS',
                latitude: -1.303205,
                longitude: 36.852994,
                max_parcels_capacity: 25000,
                contact_person: 'David Ochieng'
            },
            {
                id: 2,
                code: 'MSA-01',
                name: 'Mombasa Port & Coastal Branch',
                city: 'Mombasa',
                address: 'Moi Avenue, Port Reitz Logistics Park',
                phone: '+254 711 111 002',
                email: 'mombasa@swifttrack.co.ke',
                is_hub: true,
                hub_type: 'TRANSIT_HUB',
                latitude: -4.043477,
                longitude: 39.668206,
                max_parcels_capacity: 15000,
                contact_person: 'Hassan Mwadime'
            },
            {
                id: 3,
                code: 'KSM-01',
                name: 'Kisumu Lake Basin Branch',
                city: 'Kisumu',
                address: 'Oginga Odinga Street, Warehouse Complex',
                phone: '+254 711 111 003',
                email: 'kisumu@swifttrack.co.ke',
                is_hub: true,
                hub_type: 'REGIONAL_HUB',
                latitude: -0.091702,
                longitude: 34.767956,
                max_parcels_capacity: 10000,
                contact_person: 'Grace Adhiambo'
            },
            {
                id: 4,
                code: 'NAK-01',
                name: 'Nakuru Transit Hub & Depot',
                city: 'Nakuru',
                address: 'Commercial Street, Nakuru Industrial Area',
                phone: '+254 711 111 004',
                email: 'nakuru@swifttrack.co.ke',
                is_hub: true,
                hub_type: 'TRANSIT_HUB',
                latitude: -0.303099,
                longitude: 36.080026,
                max_parcels_capacity: 10000,
                contact_person: 'Peter Kipkorir'
            }
        ];

        for (const b of branches) {
            await client.query(`
                INSERT INTO branches (
                    id, code, name, city, address, phone, email, is_active,
                    is_hub, hub_type, latitude, longitude, max_parcels_capacity, contact_person
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (id) DO UPDATE SET
                    code = EXCLUDED.code,
                    name = EXCLUDED.name,
                    city = EXCLUDED.city,
                    address = EXCLUDED.address,
                    phone = EXCLUDED.phone,
                    email = EXCLUDED.email,
                    is_active = true,
                    is_hub = EXCLUDED.is_hub,
                    hub_type = EXCLUDED.hub_type,
                    latitude = EXCLUDED.latitude,
                    longitude = EXCLUDED.longitude,
                    max_parcels_capacity = EXCLUDED.max_parcels_capacity,
                    contact_person = EXCLUDED.contact_person;
            `, [
                b.id, b.code, b.name, b.city, b.address, b.phone, b.email,
                b.is_hub, b.hub_type, b.latitude, b.longitude, b.max_parcels_capacity, b.contact_person
            ]);
        }

        // 3. Attached Hub Warehouses
        console.log('  -> Seeding hub warehouses...');
        const warehouses = [
            { id: 1, branch_id: 1, code: 'W-NRB-MAIN', name: 'Nairobi Main Distribution Centre', location_desc: 'Block A, Loading Bay 1-4' },
            { id: 2, branch_id: 1, code: 'W-NRB-RET', name: 'Nairobi Retail & Rapid Dispatch Depot', location_desc: 'Front Hub Counter & Bay 5' },
            { id: 3, branch_id: 2, code: 'W-MSA-DEP', name: 'Mombasa Port Transit Warehouse', location_desc: 'Dock 3, Coastal Logistics Hub' },
            { id: 4, branch_id: 3, code: 'W-KSM-DEP', name: 'Kisumu Regional Distribution Depot', location_desc: 'Zone B, Lake Hub' },
            { id: 5, branch_id: 4, code: 'W-NAK-DEP', name: 'Nakuru Regional Distribution Depot', location_desc: 'Main Bay 1, Rift Hub' }
        ];

        for (const w of warehouses) {
            await client.query(`
                INSERT INTO warehouses (id, branch_id, code, name, location_desc, is_active)
                VALUES ($1, $2, $3, $4, $5, true)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    code = EXCLUDED.code,
                    location_desc = EXCLUDED.location_desc;
            `, [w.id, w.branch_id, w.code, w.name, w.location_desc]);
        }

        // 4. Roles & Permissions
        console.log('  -> Seeding roles and permissions matrix...');
        const roles = [
            { id: 1, name: 'SUPER_ADMIN', display_name: 'Super Administrator', description: 'Complete system-wide unrestricted access across all hubs and functions' },
            { id: 2, name: 'BRANCH_MANAGER', display_name: 'Branch Manager', description: 'Full operational control, approvals, staff & inventory management for assigned hub' },
            { id: 3, name: 'DISPATCHER', display_name: 'Logistics Dispatcher', description: 'Order fulfilment, delivery assignment, linehaul routing, driver tracking' },
            { id: 4, name: 'CASHIER', display_name: 'POS Cashier', description: 'Counter sales, parcel acceptance, M-Pesa verification and checkout' },
            { id: 5, name: 'DRIVER', display_name: 'Delivery Driver', description: 'Mobile delivery execution, status updates, electronic proof of delivery' }
        ];

        for (const r of roles) {
            await client.query(`
                INSERT INTO roles (id, name, display_name, description, is_system)
                VALUES ($1, $2, $3, $4, true)
                ON CONFLICT (id) DO UPDATE SET
                    display_name = EXCLUDED.display_name,
                    description = EXCLUDED.description;
            `, [r.id, r.name, r.display_name, r.description]);
        }

        const permissions = [
            { code: 'pos.view', module: 'pos', description: 'View POS counter, products, and held orders' },
            { code: 'pos.create', module: 'pos', description: 'Process counter sales and checkouts' },
            { code: 'pos.hold', module: 'pos', description: 'Hold and resume in-progress POS transactions' },
            { code: 'pos.refund_request', module: 'pos', description: 'Submit refund requests for completed sales' },
            { code: 'pos.refund_approve', module: 'pos', description: 'Approve or reject customer refund requests' },
            { code: 'pos:counter:book', module: 'pos', description: 'Counter parcel booking and acceptance' },
            { code: 'pos:counter:quote', module: 'pos', description: 'Calculate live shipping tariff quotes at counter' },
            { code: 'inventory.view', module: 'inventory', description: 'Inspect stock levels and catalog items' },
            { code: 'inventory.adjust_request', module: 'inventory', description: 'Request stock count adjustments' },
            { code: 'inventory.adjust_approve', module: 'inventory', description: 'Approve or reject inventory adjustments' },
            { code: 'inventory.transfer_request', module: 'inventory', description: 'Initiate inter-branch stock transfers' },
            { code: 'inventory.transfer_status', module: 'inventory', description: 'Update status of inter-branch transfers' },
            { code: 'dispatch.view', module: 'dispatch', description: 'View dispatch board and delivery queues' },
            { code: 'dispatch.create', module: 'dispatch', description: 'Create and schedule dispatches' },
            { code: 'dispatch.assign', module: 'dispatch', description: 'Assign drivers and vehicles to deliveries' },
            { code: 'dispatch.update', module: 'dispatch', description: 'Update dispatch and delivery statuses' },
            { code: 'delivery.view_own', module: 'delivery', description: 'View assigned deliveries' },
            { code: 'delivery.start', module: 'delivery', description: 'Start in-transit delivery route' },
            { code: 'delivery.pod_submit', module: 'delivery', description: 'Submit proof-of-delivery (OTP, signature)' },
            { code: 'delivery.problem', module: 'delivery', description: 'Flag delivery exceptions and problems' },
            { code: 'users.view', module: 'users', description: 'View staff members and credentials' },
            { code: 'users.create', module: 'users', description: 'Provision new operational staff accounts' },
            { code: 'users.edit', module: 'users', description: 'Modify staff profiles and role assignments' },
            { code: 'users.manage', module: 'users', description: 'Administrative actions: unlock, password reset, force logout' },
            { code: 'reports.financial_all', module: 'reports', description: 'View enterprise-wide financial statements' },
            { code: 'reports.financial_own', module: 'reports', description: 'View branch-specific sales and revenue reports' },
            { code: 'reports.shift_own', module: 'reports', description: 'View individual shift and cashier reconciliation' },
            { code: 'expenses.create', module: 'expenses', description: 'Log operational branch expenditures' },
            { code: 'expenses.approve', module: 'expenses', description: 'Approve or reject branch expense vouchers' },
            { code: 'branches.view', module: 'branches', description: 'View company regional branches' },
            { code: 'branches.create', module: 'branches', description: 'Create new branches and operational nodes' },
            { code: 'branches.manage', module: 'branches', description: 'Edit branch configuration and active status' },
            { code: 'shipments:create', module: 'shipments', description: 'Book parcel shipment bookings' },
            { code: 'shipments:view:all', module: 'shipments', description: 'View shipments network-wide' },
            { code: 'shipments:view:own', module: 'shipments', description: 'View shipments within assigned hub' },
            { code: 'shipments:cancel', module: 'shipments', description: 'Cancel un-dispatched shipments' },
            { code: 'shipments:status:update', module: 'shipments', description: 'Perform lifecycle state transitions' },
            { code: 'shipments:price:override', module: 'shipments', description: 'Apply discount or rating override' },
            { code: 'transport:runs:plan', module: 'transport', description: 'Plan linehaul transport runs and assign resources' },
            { code: 'transport:runs:dispatch', module: 'transport', description: 'Dispatch in-transit linehaul runs' },
            { code: 'transport:runs:arrive', module: 'transport', description: 'Record arrival and intake at destination hub' },
            { code: 'transport:runs:view', module: 'transport', description: 'View network linehaul schedule' },
            { code: 'custody:scan', module: 'custody', description: 'Execute barcode scan and intake' },
            { code: 'custody:handoff', module: 'custody', description: 'Record chain-of-custody handoffs' },
            { code: 'custody:receive_session', module: 'custody', description: 'Manage bulk hub receiving sessions' },
            { code: 'custody:discrepancy:flag', module: 'custody', description: 'Flag weight and damage discrepancies' },
            { code: 'custody:discrepancy:resolve', module: 'custody', description: 'Approve and resolve parcel discrepancies' },
            { code: 'lastmile:assign', module: 'lastmile', description: 'Assign packages to last-mile delivery routes' },
            { code: 'lastmile:pod:record', module: 'lastmile', description: 'Record proof of delivery with signature and GPS' },
            { code: 'lastmile:exceptions:manage', module: 'lastmile', description: 'Manage delivery exception workflows' },
            { code: 'cod:view', module: 'cod', description: 'View COD settlements and reconciliation records' },
            { code: 'cod:collect', module: 'cod', description: 'Record COD collection from recipient' },
            { code: 'cod:remit', module: 'cod', description: 'Remit collected COD funds to finance/depot' },
            { code: 'cod:reconcile', module: 'cod', description: 'Reconcile and sign off COD settlements' },
            { code: 'control_tower:view', module: 'control_tower', description: 'View operational control tower telemetry' },
            { code: 'control_tower:resolve', module: 'control_tower', description: 'Resolve bottleneck alerts in real-time' }
        ];

        for (const p of permissions) {
            await client.query(`
                INSERT INTO permissions (code, module, description)
                VALUES ($1, $2, $3)
                ON CONFLICT (code) DO UPDATE SET
                    description = EXCLUDED.description;
            `, [p.code, p.module, p.description]);
        }

        const permRows = await client.query('SELECT id, code FROM permissions');
        const permMap = new Map(permRows.rows.map(r => [r.code, r.id]));

        // Super Admin (Role 1): Grant all permissions
        for (const p of permRows.rows) {
            await client.query(`
                INSERT INTO role_permissions (role_id, permission_id)
                VALUES (1, $1)
                ON CONFLICT DO NOTHING;
            `, [p.id]);
        }

        // Branch Manager (Role 2): Grant all operational and management permissions
        const managerPerms = permRows.rows.filter(p => !['branches.create'].includes(p.code));
        for (const p of managerPerms) {
            await client.query(`
                INSERT INTO role_permissions (role_id, permission_id)
                VALUES (2, $1)
                ON CONFLICT DO NOTHING;
            `, [p.id]);
        }

        // Dispatcher (Role 3)
        const dispatcherPrefixes = ['dispatch', 'delivery', 'transport', 'custody', 'shipments', 'control_tower', 'branches.view', 'users.view', 'inventory.view'];
        const dispatcherPerms = permRows.rows.filter(p => dispatcherPrefixes.some(pref => p.code.startsWith(pref)));
        for (const p of dispatcherPerms) {
            await client.query(`
                INSERT INTO role_permissions (role_id, permission_id)
                VALUES (3, $1)
                ON CONFLICT DO NOTHING;
            `, [p.id]);
        }

        // Cashier (Role 4)
        const cashierPrefixes = ['pos', 'reports.shift_own', 'payments', 'shipments:create', 'shipments:view:own', 'inventory.view', 'cod:collect', 'cod:remit'];
        const cashierPerms = permRows.rows.filter(p => cashierPrefixes.some(pref => p.code.startsWith(pref)));
        for (const p of cashierPerms) {
            await client.query(`
                INSERT INTO role_permissions (role_id, permission_id)
                VALUES (4, $1)
                ON CONFLICT DO NOTHING;
            `, [p.id]);
        }

        // Driver (Role 5)
        const driverPrefixes = ['delivery.', 'custody:scan', 'custody:handoff', 'lastmile:', 'cod:collect'];
        const driverPerms = permRows.rows.filter(p => driverPrefixes.some(pref => p.code.startsWith(pref)));
        for (const p of driverPerms) {
            await client.query(`
                INSERT INTO role_permissions (role_id, permission_id)
                VALUES (5, $1)
                ON CONFLICT DO NOTHING;
            `, [p.id]);
        }

        // 5. Authentic Enterprise Staff Users (Password: Password123!)
        console.log('  -> Seeding authentic operational users (all Password123!)...');
        const defaultHash = hashPassword('Password123!');
        const staff = [
            // Super Admin
            { id: 1, branch_id: null, role_id: 1, username: 'superadmin', email: 'superadmin@swifttrack.co.ke', full_name: 'Grace Mutua (Chief Operations Officer)', phone: '+254 700 000 001' },
            // Nairobi Hub (Branch 1)
            { id: 2, branch_id: 1, role_id: 2, username: 'manager.nairobi', email: 'manager.nairobi@swifttrack.co.ke', full_name: 'David Ochieng (Nairobi Branch Manager)', phone: '+254 722 000 002' },
            { id: 3, branch_id: 1, role_id: 3, username: 'dispatcher.nairobi', email: 'dispatcher.nairobi@swifttrack.co.ke', full_name: 'Faith Wanjiku (Logistics Dispatcher)', phone: '+254 722 000 003' },
            { id: 4, branch_id: 1, role_id: 4, username: 'cashier.nairobi', email: 'cashier.nairobi@swifttrack.co.ke', full_name: 'Kevin Mutua (Senior Cashier)', phone: '+254 722 000 004' },
            { id: 5, branch_id: 1, role_id: 5, username: 'driver.nairobi', email: 'driver.nairobi@swifttrack.co.ke', full_name: 'Joseph Kiprop (Lead Delivery Driver)', phone: '+254 722 000 005' },
            // Mombasa Hub (Branch 2)
            { id: 6, branch_id: 2, role_id: 2, username: 'manager.mombasa', email: 'manager.mombasa@swifttrack.co.ke', full_name: 'Hassan Mwadime (Mombasa Branch Manager)', phone: '+254 722 000 006' },
            { id: 7, branch_id: 2, role_id: 3, username: 'dispatcher.mombasa', email: 'dispatcher.mombasa@swifttrack.co.ke', full_name: 'Fatuma Athman (Coastal Dispatcher)', phone: '+254 722 000 007' },
            { id: 8, branch_id: 2, role_id: 4, username: 'cashier.mombasa', email: 'cashier.mombasa@swifttrack.co.ke', full_name: 'Halima Bakari (Mombasa Cashier)', phone: '+254 722 000 008' },
            { id: 9, branch_id: 2, role_id: 5, username: 'driver.mombasa', email: 'driver.mombasa@swifttrack.co.ke', full_name: 'Ali Omar (Coast Fleet Driver)', phone: '+254 722 000 009' },
            // Kisumu Hub (Branch 3)
            { id: 10, branch_id: 3, role_id: 2, username: 'manager.kisumu', email: 'manager.kisumu@swifttrack.co.ke', full_name: 'Grace Adhiambo (Kisumu Branch Manager)', phone: '+254 722 000 010' },
            { id: 11, branch_id: 3, role_id: 3, username: 'dispatcher.kisumu', email: 'dispatcher.kisumu@swifttrack.co.ke', full_name: 'Mercy Achieng (Kisumu Dispatcher)', phone: '+254 722 000 011' },
            { id: 12, branch_id: 3, role_id: 4, username: 'cashier.kisumu', email: 'cashier.kisumu@swifttrack.co.ke', full_name: 'Erick Otieno (Lake Basin Cashier)', phone: '+254 722 000 012' },
            { id: 13, branch_id: 3, role_id: 5, username: 'driver.kisumu', email: 'driver.kisumu@swifttrack.co.ke', full_name: 'Francis Omondi (Lake Basin Fleet Driver)', phone: '+254 722 000 013' },
            // Nakuru Hub (Branch 4)
            { id: 14, branch_id: 4, role_id: 2, username: 'manager.nakuru', email: 'manager.nakuru@swifttrack.co.ke', full_name: 'Peter Kipkorir (Rift Valley Manager)', phone: '+254 722 000 014' },
            { id: 15, branch_id: 4, role_id: 3, username: 'dispatcher.nakuru', email: 'dispatcher.nakuru@swifttrack.co.ke', full_name: 'Brian Kiptoo (Nakuru Dispatcher)', phone: '+254 722 000 015' },
            { id: 16, branch_id: 4, role_id: 4, username: 'cashier.nakuru', email: 'cashier.nakuru@swifttrack.co.ke', full_name: 'Caroline Cherono (Nakuru Cashier)', phone: '+254 722 000 016' },
            { id: 17, branch_id: 4, role_id: 5, username: 'driver.nakuru', email: 'driver.nakuru@swifttrack.co.ke', full_name: 'Samuel Koech (Fleet Driver)', phone: '+254 722 000 017' }
        ];

        for (const u of staff) {
            await client.query(`
                INSERT INTO users (
                    id, branch_id, role_id, username, email, full_name, phone,
                    password_hash, is_active, token_version
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, 1)
                ON CONFLICT (id) DO UPDATE SET
                    username = EXCLUDED.username,
                    email = EXCLUDED.email,
                    full_name = EXCLUDED.full_name,
                    phone = EXCLUDED.phone,
                    password_hash = EXCLUDED.password_hash,
                    is_active = true;
            `, [u.id, u.branch_id, u.role_id, u.username, u.email, u.full_name, u.phone, defaultHash]);
        }

        // 6. Fleet Vehicles & Drivers
        console.log('  -> Seeding fleet vehicles and drivers...');
        const vehicles = [
            // Last-mile motorbikes
            { id: 1, branch_id: 1, reg: 'KMDF 412B', type: 'MOTORCYCLE', model: 'Honda Ace 125 Cargo', cap: 60 },
            { id: 2, branch_id: 2, reg: 'KMDJ 628C', type: 'MOTORCYCLE', model: 'Boxer BM 150 Cargo', cap: 60 },
            { id: 3, branch_id: 3, reg: 'KMDK 911D', type: 'MOTORCYCLE', model: 'TVS Star HLX Courier', cap: 60 },
            { id: 4, branch_id: 4, reg: 'KMDL 345E', type: 'MOTORCYCLE', model: 'Bajaj Boxer 150 Courier', cap: 60 },
            // Delivery Vans
            { id: 5, branch_id: 1, reg: 'KBZ 891L', type: 'VAN', model: 'Toyota HiAce High-Roof Cargo', cap: 1200 },
            { id: 6, branch_id: 2, reg: 'KDG 430Y', type: 'VAN', model: 'Nissan Caravan Diesel', cap: 1400 },
            // Heavy Commercial Trucks (Linehaul inter-hub)
            { id: 7, branch_id: 1, reg: 'KDG 554W', type: 'TRUCK', model: 'Isuzu FRR 90 (5-Tonne Cargo)', cap: 5000 },
            { id: 8, branch_id: 2, reg: 'KCJ 782P', type: 'TRUCK', model: 'Mitsubishi Fuso Fighter (10-Tonne)', cap: 10000 }
        ];

        for (const v of vehicles) {
            await client.query(`
                INSERT INTO vehicles (id, branch_id, registration_number, vehicle_type, model, max_capacity_kg, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, true)
                ON CONFLICT (id) DO UPDATE SET
                    registration_number = EXCLUDED.registration_number,
                    model = EXCLUDED.model,
                    max_capacity_kg = EXCLUDED.max_capacity_kg;
            `, [v.id, v.branch_id, v.reg, v.type, v.model, v.cap]);
        }

        const drivers = [
            { id: 1, user_id: 5, branch_id: 1, employee_code: 'DRV-0001', license: 'DL-NRB-2024-88', classes: 'B, C1', issue: '2023-01-15', expiry: '2027-08-15', ntsa: true, natId: '28911001', kra: 'A00911001Z', kin: 'Mary Kiprop', kinPhone: '+254 711 999 001', vehicle_id: 1, phone: '+254 722 000 005', status: 'AVAILABLE' },
            { id: 2, user_id: 9, branch_id: 2, employee_code: 'DRV-0002', license: 'DL-MSA-2024-42', classes: 'A2, B', issue: '2023-03-20', expiry: '2026-10-25', ntsa: true, natId: '28911002', kra: 'A00911002Z', kin: 'Fatuma Omar', kinPhone: '+254 711 999 002', vehicle_id: 2, phone: '+254 722 000 009', status: 'AVAILABLE' },
            { id: 3, user_id: 13, branch_id: 3, employee_code: 'DRV-0003', license: 'DL-KSM-2024-19', classes: 'B, C1, CE', issue: '2022-09-01', expiry: '2026-09-01', ntsa: true, natId: '28911003', kra: 'A00911003Z', kin: 'Beatrice Omondi', kinPhone: '+254 711 999 003', vehicle_id: 3, phone: '+254 722 000 013', status: 'AVAILABLE' },
            { id: 4, user_id: 17, branch_id: 4, employee_code: 'DRV-0004', license: 'DL-NAK-2024-33', classes: 'B, C1', issue: '2024-02-10', expiry: '2028-02-10', ntsa: true, natId: '28911004', kra: 'A00911004Z', kin: 'Faith Koech', kinPhone: '+254 711 999 004', vehicle_id: 4, phone: '+254 722 000 017', status: 'AVAILABLE' }
        ];

        for (const d of drivers) {
            await client.query(`
                INSERT INTO drivers (
                    id, user_id, branch_id, employee_code, license_number, license_classes,
                    license_issue_date, license_expiry_date, ntsa_verified, ntsa_verification_date,
                    national_id, kra_pin, emergency_contact_name, emergency_contact_phone,
                    emergency_contact_relation, employment_type, hire_date, blood_group,
                    vehicle_id, phone, status, rating
                ) VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, '2024-01-15',
                    $10, $11, $12, $13,
                    'Spouse', 'FULL_TIME', '2023-02-01', 'O+',
                    $14, $15, $16, 5.0
                )
                ON CONFLICT (id) DO UPDATE SET
                    employee_code = EXCLUDED.employee_code,
                    license_number = EXCLUDED.license_number,
                    license_classes = EXCLUDED.license_classes,
                    license_issue_date = EXCLUDED.license_issue_date,
                    license_expiry_date = EXCLUDED.license_expiry_date,
                    ntsa_verified = EXCLUDED.ntsa_verified,
                    vehicle_id = EXCLUDED.vehicle_id,
                    phone = EXCLUDED.phone,
                    status = EXCLUDED.status;
            `, [d.id, d.user_id, d.branch_id, d.employee_code, d.license, d.classes, d.issue, d.expiry, d.ntsa, d.natId, d.kra, d.kin, d.kinPhone, d.vehicle_id, d.phone, d.status]);
        }

        // 7. Customers
        console.log('  -> Seeding customers...');
        const customers = [
            { id: 1, branch_id: 1, cust_no: 'CUST-WALKIN', name: 'Walk-in Counter Customer', phone: '+254 700 000 000', email: 'counter@swifttrack.co.ke', addr: 'Front Hub Counter', city: 'Nairobi', notes: 'Retail walk-in booking and supplies purchase' },
            { id: 2, branch_id: 1, cust_no: 'CUST-0002', name: 'Alpha Apex Corporate Client Ltd', phone: '+254 722 991 122', email: 'cargo@alphaapex.co.ke', addr: 'Riverside Drive, Delta Chambers Block C', city: 'Nairobi', notes: 'Corporate Logistics Account' },
            { id: 3, branch_id: 1, cust_no: 'CUST-0003', name: 'Twiga Fresh Supply Chain Ltd', phone: '+254 711 330 088', email: 'logistics@twigafoods.com', addr: 'Tatu City Industrial Logistics Park', city: 'Nairobi', notes: 'FMCG Distribution' },
            { id: 4, branch_id: 1, cust_no: 'CUST-0004', name: 'Safaricom Enterprise Logistics', phone: '+254 722 003 456', email: 'enterprise.dispatch@safaricom.co.ke', addr: 'Waiyaki Way HQ Block B', city: 'Nairobi', notes: 'Enterprise Hardware Fulfillment' },
            { id: 5, branch_id: 2, cust_no: 'CUST-0005', name: 'Mombasa Coastal Marine Agency Ltd', phone: '+254 733 998 877', email: 'cargo@mombasashipping.co.ke', addr: 'Kilindini Port Gate 5', city: 'Mombasa', notes: 'Maritime clearance and cargo' },
            { id: 6, branch_id: 3, cust_no: 'CUST-0006', name: 'Lake Basin Farmers Cooperative Society', phone: '+254 734 112 233', email: 'lakebasin.agro@gmail.com', addr: 'Kisumu Port Road', city: 'Kisumu', notes: 'Western Kenya agricultural distribution' },
            { id: 7, branch_id: 4, cust_no: 'CUST-0007', name: 'Rift Valley Agricultural Machinery Depot', phone: '+254 723 556 677', email: 'rift.machinery@gmail.com', addr: 'Nakuru Industrial Area Commercial St', city: 'Nakuru', notes: 'Heavy spares & lubricants' }
        ];

        for (const c of customers) {
            await client.query(`
                INSERT INTO customers (id, branch_id, customer_number, full_name, phone, email, address, city, notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (id) DO UPDATE SET
                    full_name = EXCLUDED.full_name,
                    phone = EXCLUDED.phone,
                    address = EXCLUDED.address,
                    city = EXCLUDED.city;
            `, [c.id, c.branch_id, c.cust_no, c.name, c.phone, c.email, c.addr, c.city, c.notes]);
        }

        // 8. Categories, Brands, Suppliers & Packaging Products
        console.log('  -> Seeding product catalog & suppliers...');
        const categories = [
            { id: 1, code: 'CAT-BOX', name: 'Corrugated Packaging Cartons', desc: 'Heavy-duty fluted cardboard shipping boxes' },
            { id: 2, code: 'CAT-SEAL', name: 'Security & Tamper-Evident Seals', desc: 'Barcoded tamper seals and security tapes' },
            { id: 3, code: 'CAT-MAIL', name: 'Courier Satchels & Poly Mailers', desc: 'Waterproof tear-resistant courier satchels' },
            { id: 4, code: 'CAT-LBL', name: 'Thermal Barcode Labels & Ribbons', desc: 'Direct thermal shipping waybill labels' },
            { id: 5, code: 'CAT-SUP', name: 'Cushioning & Protective Wrap', desc: 'Air bubble rolls, pallet stretch film, strapping' }
        ];

        for (const cat of categories) {
            await client.query(`
                INSERT INTO categories (id, code, name, description, is_active)
                VALUES ($1, $2, $3, $4, true)
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;
            `, [cat.id, cat.code, cat.name, cat.desc]);
        }

        const brands = [
            { id: 1, code: 'BR-SWIFT', name: 'SwiftTrack Pro', desc: 'SwiftTrack Branded Supplies' },
            { id: 2, code: 'BR-SEAL', name: 'TamperGuard Kenya', desc: 'Industrial Security Solutions' },
            { id: 3, code: 'BR-BOX', name: 'Apex Fluted Box', desc: 'Corrugated Packaging Materials' },
            { id: 4, code: 'BR-POLY', name: 'FlexiMail Africa', desc: 'Co-extruded Poly Mailers' },
            { id: 5, code: 'BR-THERM', name: 'Zebra Thermal Consumables', desc: 'Thermal Waybill Label Rolls' }
        ];

        for (const b of brands) {
            await client.query(`
                INSERT INTO brands (id, code, name, description, is_active)
                VALUES ($1, $2, $3, $4, true)
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;
            `, [b.id, b.code, b.name, b.desc]);
        }

        const suppliers = [
            { id: 1, code: 'SUP-001', name: 'Kenya Box Manufacturers Ltd', contact: 'Robert Kariuki', email: 'robert@kenyaboxes.co.ke', phone: '+254 720 112 233', addr: 'Ruaraka Industrial Area', city: 'Nairobi' },
            { id: 2, code: 'SUP-002', name: 'TamperProof Africa Security Seals', contact: 'Alice Muthoni', email: 'alice@tamperproof.co.ke', phone: '+254 721 445 566', addr: 'Baba Dogo Road', city: 'Nairobi' },
            { id: 3, code: 'SUP-003', name: 'East Africa Paper Mills', contact: 'Samir Patel', email: 'samir@eapaper.co.ke', phone: '+254 733 889 900', addr: 'Changamwe Industrial Park', city: 'Mombasa' },
            { id: 4, code: 'SUP-004', name: 'Barcode & Thermal Tech Ltd', contact: 'Lucy Wambui', email: 'lucy@thermaltech.co.ke', phone: '+254 711 778 899', addr: 'Commercial Street', city: 'Nakuru' }
        ];

        for (const s of suppliers) {
            await client.query(`
                INSERT INTO suppliers (id, code, name, contact_person, email, phone, address, city, country, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Kenya', true)
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone;
            `, [s.id, s.code, s.name, s.contact, s.email, s.phone, s.addr, s.city]);
        }

        const products = [
            { id: 1, cat_id: 1, brand_id: 3, sup_id: 1, sku: 'BOX-SM-001', barcode: '616110001001', name: 'Standard Courier Carton Small (25x20x15cm)', desc: 'Small fluted corrugated box for parcels up to 5kg', uom: 'PCS', cost: 45.0, price: 90.0, min: 100, reorder: 500 },
            { id: 2, cat_id: 1, brand_id: 3, sup_id: 1, sku: 'BOX-MD-002', barcode: '616110001002', name: 'Standard Courier Carton Medium (35x30x25cm)', desc: 'Medium fluted box for parcels up to 15kg', uom: 'PCS', cost: 85.0, price: 160.0, min: 100, reorder: 500 },
            { id: 3, cat_id: 1, brand_id: 3, sup_id: 1, sku: 'BOX-LG-003', barcode: '616110001003', name: 'Heavy-Duty Freight Carton Large (50x40x40cm)', desc: 'Double wall fluted box for heavy shipments up to 35kg', uom: 'PCS', cost: 160.0, price: 290.0, min: 50, reorder: 250 },
            { id: 4, cat_id: 3, brand_id: 4, sup_id: 3, sku: 'MAIL-A4-010', barcode: '616110002001', name: 'A4 Waterproof Poly Flyer Satchel (Pack of 50)', desc: 'Self-adhesive tamper-proof document mailer', uom: 'PACK', cost: 350.0, price: 650.0, min: 30, reorder: 150 },
            { id: 5, cat_id: 3, brand_id: 4, sup_id: 3, sku: 'MAIL-A3-011', barcode: '616110002002', name: 'A3 Heavy-Duty Cargo Flyer Satchel (Pack of 50)', desc: 'Reinforced courier envelope with document pouch', uom: 'PACK', cost: 550.0, price: 980.0, min: 25, reorder: 100 },
            { id: 6, cat_id: 2, brand_id: 2, sup_id: 2, sku: 'SEAL-NUM-100', barcode: '616110003001', name: 'Numbered Pull-Tight Plastic Security Seals (100 pcs)', desc: 'Barcoded sequential security seals for courier bags', uom: 'PACK', cost: 450.0, price: 850.0, min: 20, reorder: 100 },
            { id: 7, cat_id: 2, brand_id: 2, sup_id: 2, sku: 'TAPE-SEC-050', barcode: '616110003002', name: 'Tamper-Evident Security Tape (50m x 48mm)', desc: 'VOID OPENED leaves clear residue on unsealed parcels', uom: 'ROLL', cost: 280.0, price: 520.0, min: 40, reorder: 200 },
            { id: 8, cat_id: 4, brand_id: 5, sup_id: 4, sku: 'LBL-4X6-500', barcode: '616110004001', name: 'Direct Thermal Waybill Labels 4x6" (500 labels/roll)', desc: 'Universal carrier waybill label roll for Zebra & Godex printers', uom: 'ROLL', cost: 420.0, price: 780.0, min: 50, reorder: 250 },
            { id: 9, cat_id: 5, brand_id: 1, sup_id: 1, sku: 'WRAP-BUB-100', barcode: '616110005001', name: 'Shock Absorbing Air Bubble Wrap (100m x 0.5m)', desc: 'Premium 10mm bubble roll for fragile goods protection', uom: 'ROLL', cost: 1200.0, price: 2100.0, min: 10, reorder: 50 },
            { id: 10, cat_id: 5, brand_id: 1, sup_id: 1, sku: 'FILM-STR-001', barcode: '616110005002', name: 'Industrial Pallet Stretch Film (23 micron x 500m)', desc: 'Clear high-stretch wrapping film for pallet stabilization', uom: 'ROLL', cost: 950.0, price: 1650.0, min: 20, reorder: 80 }
        ];

        for (const p of products) {
            await client.query(`
                INSERT INTO products (
                    id, category_id, brand_id, supplier_id, sku, barcode, name, description,
                    unit, cost_price, selling_price, min_stock_alert, reorder_quantity, is_active
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true)
                ON CONFLICT (id) DO UPDATE SET
                    sku = EXCLUDED.sku,
                    barcode = EXCLUDED.barcode,
                    name = EXCLUDED.name,
                    selling_price = EXCLUDED.selling_price;
            `, [p.id, p.cat_id, p.brand_id, p.sup_id, p.sku, p.barcode, p.name, p.desc, p.uom, p.cost, p.price, p.min, p.reorder]);
        }

        // 9. Initial Inventory Balances & Ledger
        console.log('  -> Seeding warehouse inventory balances...');
        const stockPlan = [
            { wh_id: 1, br_id: 1, qty: 350 }, // Nairobi Main
            { wh_id: 2, br_id: 1, qty: 150 }, // Nairobi Retail
            { wh_id: 3, br_id: 2, qty: 200 }, // Mombasa Transit
            { wh_id: 4, br_id: 3, qty: 120 }, // Kisumu Lake
            { wh_id: 5, br_id: 4, qty: 100 }  // Nakuru Depot
        ];

        for (const sp of stockPlan) {
            for (const p of products) {
                await client.query(`
                    INSERT INTO inventory (
                        branch_id, warehouse_id, product_id,
                        quantity_on_hand, quantity_reserved, quantity_available
                    ) VALUES ($1, $2, $3, $4, 0, $4)
                    ON CONFLICT (warehouse_id, product_id) DO UPDATE SET
                        quantity_on_hand = EXCLUDED.quantity_on_hand,
                        quantity_available = EXCLUDED.quantity_available;
                `, [sp.br_id, sp.wh_id, p.id, sp.qty]);

                await client.query(`
                    INSERT INTO inventory_movements (
                        branch_id, warehouse_id, product_id, movement_type,
                        quantity_change, previous_quantity, new_quantity,
                        reference_type, reference_id, reason, user_id
                    ) VALUES ($1, $2, $3, 'PURCHASE_RECEIPT', $4, 0, $4, 'INITIAL_SEED', 'INIT-2026', 'Opening Balance Stock In', 1);
                `, [sp.br_id, sp.wh_id, p.id, sp.qty]);
            }
        }

        // 10. Logistics Pricing Tariffs
        console.log('  -> Seeding logistics pricing tariffs...');
        await client.query(`
            INSERT INTO logistics_pricing_tariffs 
            (origin_hub_id, destination_hub_id, service_type, base_weight_kg, base_price, per_kg_above_base, cod_fee_percent, min_cod_fee, insurance_rate_percent, currency, is_active)
            VALUES 
                (NULL, NULL, 'STANDARD', 5.0, 350.0, 50.0, 2.0, 100.0, 1.0, 'KES', true),
                (NULL, NULL, 'EXPRESS', 5.0, 600.0, 80.0, 2.0, 100.0, 1.0, 'KES', true),
                (NULL, NULL, 'SAME_DAY', 5.0, 850.0, 120.0, 2.0, 100.0, 1.0, 'KES', true),
                (1, 2, 'STANDARD', 5.0, 500.0, 60.0, 2.0, 100.0, 1.0, 'KES', true),
                (1, 3, 'STANDARD', 5.0, 450.0, 55.0, 2.0, 100.0, 1.0, 'KES', true),
                (1, 4, 'STANDARD', 5.0, 350.0, 40.0, 2.0, 100.0, 1.0, 'KES', true)
            ON CONFLICT (origin_hub_id, destination_hub_id, service_type) DO UPDATE SET
                base_price = EXCLUDED.base_price,
                per_kg_above_base = EXCLUDED.per_kg_above_base;
        `);

        // 11. Transport Routes & Route Legs
        console.log('  -> Seeding transport routes and legs...');
        const routes = [
            { id: 1, code: 'RTE-NRB-MSA', name: 'Nairobi to Mombasa Linehaul Corridor', orig: 1, dest: 2, dist: 485.0, dur: 8.5 },
            { id: 2, code: 'RTE-NRB-KSM', name: 'Nairobi to Kisumu Western Corridor', orig: 1, dest: 3, dist: 350.0, dur: 6.0 },
            { id: 3, code: 'RTE-NRB-NAK', name: 'Nairobi to Nakuru Central Rift Corridor', orig: 1, dest: 4, dist: 160.0, dur: 2.5 }
        ];

        for (const r of routes) {
            await client.query(`
                INSERT INTO routes (id, code, name, origin_hub_id, destination_hub_id, distance_km, estimated_duration_hours, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, $7, true)
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, distance_km = EXCLUDED.distance_km;
            `, [r.id, r.code, r.name, r.orig, r.dest, r.dist, r.dur]);

            await client.query(`
                INSERT INTO route_legs (id, route_id, leg_sequence, origin_hub_id, destination_hub_id, distance_km, estimated_duration_hours, is_cross_border, is_active)
                VALUES ($1, $1, 1, $2, $3, $4, $5, false, true)
                ON CONFLICT (id) DO UPDATE SET distance_km = EXCLUDED.distance_km;
            `, [r.id, r.orig, r.dest, r.dist, r.dur]);
        }

        // 12. Notification Templates
        console.log('  -> Seeding notification templates...');
        const templates = [
            { code: 'SHIPMENT_BOOKED', name: 'Shipment Intake Notification', event: 'SHIPMENT_BOOKED', sms: 'Habari {{recipient_name}}, shipment {{tracking_number}} has been booked by {{sender_name}} to {{destination_city}}. Track online: https://swifttrack.co.ke/t/{{tracking_number}}', wa: 'SwiftTrack Update: Parcel {{tracking_number}} has been booked for delivery to {{recipient_name}}.', sub: 'Shipment Booked: {{tracking_number}}' },
            { code: 'IN_TRANSIT', name: 'Corridor Transit Milestone', event: 'IN_TRANSIT', sms: 'SwiftTrack: Shipment {{tracking_number}} is now in transit from {{origin_city}} to {{destination_city}}.', wa: 'SwiftTrack In-Transit: Parcel {{tracking_number}} dispatched on corridor linehaul.', sub: 'In Transit: {{tracking_number}}' },
            { code: 'OUT_FOR_DELIVERY', name: 'Out For Delivery Alert', event: 'OUT_FOR_DELIVERY', sms: 'SwiftTrack: Shipment {{tracking_number}} is out for delivery with driver {{driver_name}} ({{driver_phone}}). Your delivery verification OTP is {{pod_otp}}.', wa: 'SwiftTrack Last-Mile: Driver {{driver_name}} is approaching your address with shipment {{tracking_number}}. OTP: {{pod_otp}}', sub: 'Out for Delivery: {{tracking_number}}' },
            { code: 'DELIVERED', name: 'Proof of Delivery Completed', event: 'DELIVERED', sms: 'SwiftTrack: Shipment {{tracking_number}} has been delivered successfully to {{recipient_name}}. Thank you for choosing SwiftTrack Kenya!', wa: 'SwiftTrack Delivered: Parcel {{tracking_number}} delivered. Digital receipt attached.', sub: 'Delivery Complete: {{tracking_number}}' },
            { code: 'EXCEPTION', name: 'Delivery Exception Notice', event: 'EXCEPTION', sms: 'SwiftTrack: Delivery for {{tracking_number}} was rescheduled: {{exception_reason}}. Our team will re-attempt shortly.', wa: 'SwiftTrack Notice: Delivery attempt exception on {{tracking_number}}.', sub: 'Delivery Update: {{tracking_number}}' }
        ];

        for (const t of templates) {
            await client.query(`
                INSERT INTO notification_templates (code, name, event_type, sms_template, whatsapp_template, email_subject, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, true)
                ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, sms_template = EXCLUDED.sms_template;
            `, [t.code, t.name, t.event, t.sms, t.wa, t.sub]);
        }

        // 13. Coherent Operational Shipments & Parcels (Diverse Lifecycle Spectrum)
        console.log('  -> Seeding 12 authentic enterprise shipments across full lifecycle...');
        const shipmentsData = [
            {
                id: 1,
                tracking: 'STK-2026-NRB-0001',
                waybill: 'WB-2026-0001-NRB-MSA',
                orig: 1, dest: 2, curr: 1, loc: 'Nairobi Central Hub Staging',
                s_cust: 2, s_name: 'Alpha Apex Corporate Client Ltd', s_phone: '+254 722 991 122', s_addr: 'Riverside Drive Delta Chambers', s_city: 'Nairobi',
                r_cust: 5, r_name: 'Mombasa Coastal Marine Agency Ltd', r_phone: '+254 733 998 877', r_addr: 'Kilindini Port Gate 5', r_city: 'Mombasa',
                service: 'STANDARD', delivery: 'LAST_MILE', status: 'BOOKED',
                parcels: 2, weight: 12.5, base: 500.0, weight_chg: 450.0, tax: 152.0, total: 1102.0,
                pay_terms: 'PREPAID', pay_status: 'PAID', cod_amt: 0.0, cod_fee: 0.0
            },
            {
                id: 2,
                tracking: 'STK-2026-NRB-0002',
                waybill: 'WB-2026-0002-NRB-KSM',
                orig: 1, dest: 3, curr: 1, loc: 'Nairobi Central Hub Weighing Bay',
                s_cust: 3, s_name: 'Twiga Fresh Supply Chain Ltd', s_phone: '+254 711 330 088', s_addr: 'Tatu City Logistics Park', s_city: 'Nairobi',
                r_cust: 6, r_name: 'Lake Basin Farmers Cooperative Society', r_phone: '+254 734 112 233', r_addr: 'Kisumu Port Road Complex', r_city: 'Kisumu',
                service: 'EXPRESS', delivery: 'LAST_MILE', status: 'ACCEPTED',
                parcels: 1, weight: 6.0, base: 600.0, weight_chg: 80.0, tax: 108.8, total: 788.8,
                pay_terms: 'PREPAID', pay_status: 'PAID', cod_amt: 0.0, cod_fee: 0.0
            },
            {
                id: 3,
                tracking: 'STK-2026-NRB-0003',
                waybill: 'WB-2026-0003-NRB-MSA',
                orig: 1, dest: 2, curr: 1, loc: 'Nairobi Central Distribution Bay A',
                s_cust: 4, s_name: 'Safaricom Enterprise Logistics', s_phone: '+254 722 003 456', s_addr: 'Waiyaki Way HQ Block B', s_city: 'Nairobi',
                r_cust: 5, r_name: 'Mombasa Coastal Marine Agency Ltd', r_phone: '+254 733 998 877', r_addr: 'Kilindini Port Gate 5', r_city: 'Mombasa',
                service: 'STANDARD', delivery: 'LAST_MILE', status: 'AT_ORIGIN_HUB',
                parcels: 3, weight: 25.0, base: 500.0, weight_chg: 1200.0, tax: 272.0, total: 1972.0,
                pay_terms: 'PREPAID', pay_status: 'PAID', cod_amt: 0.0, cod_fee: 0.0
            },
            {
                id: 4,
                tracking: 'STK-2026-NRB-0004',
                waybill: 'WB-2026-0004-NRB-MSA',
                orig: 1, dest: 2, curr: null, loc: 'Highway A109 Near Mtito Andei',
                s_cust: 2, s_name: 'Alpha Apex Corporate Client Ltd', s_phone: '+254 722 991 122', s_addr: 'Riverside Drive Delta Chambers', s_city: 'Nairobi',
                r_cust: 5, r_name: 'Mombasa Coastal Marine Agency Ltd', r_phone: '+254 733 998 877', r_addr: 'Kilindini Port Gate 5', r_city: 'Mombasa',
                service: 'STANDARD', delivery: 'LAST_MILE', status: 'IN_TRANSIT',
                parcels: 4, weight: 45.0, base: 500.0, weight_chg: 2400.0, tax: 464.0, total: 3364.0,
                pay_terms: 'PREPAID', pay_status: 'PAID', cod_amt: 0.0, cod_fee: 0.0
            },
            {
                id: 5,
                tracking: 'STK-2026-MSA-0005',
                waybill: 'WB-2026-0005-MSA-NRB',
                orig: 2, dest: 1, curr: null, loc: 'Mombasa-Nairobi Linehaul Corridor (Voi)',
                s_cust: 5, s_name: 'Mombasa Coastal Marine Agency Ltd', s_phone: '+254 733 998 877', s_addr: 'Kilindini Port Gate 5', s_city: 'Mombasa',
                r_cust: 4, r_name: 'Safaricom Enterprise Logistics', r_phone: '+254 722 003 456', r_addr: 'Waiyaki Way HQ Block B', r_city: 'Nairobi',
                service: 'STANDARD', delivery: 'LAST_MILE', status: 'IN_TRANSIT',
                parcels: 2, weight: 18.0, base: 500.0, weight_chg: 780.0, tax: 204.8, total: 1484.8,
                pay_terms: 'PREPAID', pay_status: 'PAID', cod_amt: 0.0, cod_fee: 0.0
            },
            {
                id: 6,
                tracking: 'STK-2026-NRB-0006',
                waybill: 'WB-2026-0006-NRB-NRB',
                orig: 1, dest: 1, curr: 1, loc: 'Nairobi Last-Mile Dispatch Staging',
                s_cust: 1, s_name: 'Walk-in Counter Customer', s_phone: '+254 700 000 000', s_addr: 'Nairobi Central Counter', s_city: 'Nairobi',
                r_cust: null, r_name: 'Dr. Jane Mwangi', r_phone: '+254 721 889 900', r_addr: 'Kenyatta National Hospital Doctors Plaza 3rd Fl', r_city: 'Nairobi',
                service: 'SAME_DAY', delivery: 'LAST_MILE', status: 'READY_FOR_DELIVERY',
                parcels: 1, weight: 3.5, base: 850.0, weight_chg: 0.0, tax: 136.0, total: 986.0,
                pay_terms: 'PREPAID', pay_status: 'PAID', cod_amt: 0.0, cod_fee: 0.0
            },
            {
                id: 7,
                tracking: 'STK-2026-NRB-0007',
                waybill: 'WB-2026-0007-NRB-NRB',
                orig: 1, dest: 1, curr: 1, loc: 'Out for Delivery (Nairobi CBD Courier)',
                s_cust: 2, s_name: 'Alpha Apex Corporate Client Ltd', s_phone: '+254 722 991 122', s_addr: 'Riverside Drive Delta Chambers', s_city: 'Nairobi',
                r_cust: null, r_name: 'KenGen Stima Plaza Supply Office', r_phone: '+254 720 445 566', r_addr: 'Kolobot Road, Stima Plaza 2nd Floor', r_city: 'Nairobi',
                service: 'EXPRESS', delivery: 'LAST_MILE', status: 'OUT_FOR_DELIVERY',
                parcels: 1, weight: 2.0, base: 600.0, weight_chg: 0.0, tax: 96.0, total: 696.0,
                pay_terms: 'PREPAID', pay_status: 'PAID', cod_amt: 0.0, cod_fee: 0.0
            },
            {
                id: 8,
                tracking: 'STK-2026-MSA-0008',
                waybill: 'WB-2026-0008-MSA-MSA',
                orig: 2, dest: 2, curr: 2, loc: 'Out for Delivery (Mombasa Nyali Route)',
                s_cust: 5, s_name: 'Mombasa Coastal Marine Agency Ltd', s_phone: '+254 733 998 877', s_addr: 'Kilindini Port Gate 5', s_city: 'Mombasa',
                r_cust: null, r_name: 'Nyali Beach Resort Procurement', r_phone: '+254 733 112 244', r_addr: 'Moyo Avenue, Nyali Beachfront Block A', r_city: 'Mombasa',
                service: 'STANDARD', delivery: 'LAST_MILE', status: 'OUT_FOR_DELIVERY',
                parcels: 1, weight: 4.0, base: 350.0, weight_chg: 0.0, tax: 56.0, total: 406.0,
                pay_terms: 'PREPAID', pay_status: 'PAID', cod_amt: 0.0, cod_fee: 0.0
            },
            {
                id: 9,
                tracking: 'STK-2026-NRB-0009',
                waybill: 'WB-2026-0009-NRB-NAK',
                orig: 1, dest: 4, curr: 4, loc: 'Delivered at Recipient Premises',
                s_cust: 4, s_name: 'Safaricom Enterprise Logistics', s_phone: '+254 722 003 456', s_addr: 'Waiyaki Way HQ Block B', s_city: 'Nairobi',
                r_cust: 7, r_name: 'Rift Valley Agricultural Machinery Depot', r_phone: '+254 723 556 677', r_addr: 'Commercial Street Industrial Area', r_city: 'Nakuru',
                service: 'STANDARD', delivery: 'LAST_MILE', status: 'DELIVERED',
                parcels: 1, weight: 8.0, base: 350.0, weight_chg: 120.0, tax: 75.2, total: 545.2,
                pay_terms: 'PREPAID', pay_status: 'PAID', cod_amt: 0.0, cod_fee: 0.0
            },
            {
                id: 10,
                tracking: 'STK-2026-KSM-0010',
                waybill: 'WB-2026-0010-KSM-KSM',
                orig: 3, dest: 3, curr: 3, loc: 'Delivered at Recipient Counter',
                s_cust: 6, s_name: 'Lake Basin Farmers Cooperative Society', s_phone: '+254 734 112 233', s_addr: 'Kisumu Port Road Complex', s_city: 'Kisumu',
                r_cust: null, r_name: 'Grand Royal Swiss Hotel Receiving', r_phone: '+254 722 778 899', r_addr: 'Riat Hills Junction', r_city: 'Kisumu',
                service: 'STANDARD', delivery: 'LAST_MILE', status: 'DELIVERED',
                parcels: 1, weight: 5.0, base: 350.0, weight_chg: 0.0, tax: 56.0, total: 406.0,
                pay_terms: 'PREPAID', pay_status: 'PAID', cod_amt: 0.0, cod_fee: 0.0
            },
            {
                id: 11,
                tracking: 'STK-2026-NAK-0011',
                waybill: 'WB-2026-0011-NRB-NAK',
                orig: 1, dest: 4, curr: 4, loc: 'Delivered & Cash on Delivery Settled',
                s_cust: 3, s_name: 'Twiga Fresh Supply Chain Ltd', s_phone: '+254 711 330 088', s_addr: 'Tatu City Logistics Park', s_city: 'Nairobi',
                r_cust: null, r_name: 'Eldama Agri Supplies Centre', r_phone: '+254 711 556 677', r_addr: 'Nakuru Highway Bay 4', r_city: 'Nakuru',
                service: 'STANDARD', delivery: 'LAST_MILE', status: 'DELIVERED',
                parcels: 2, weight: 15.0, base: 350.0, weight_chg: 400.0, tax: 120.0, total: 870.0,
                pay_terms: 'COD', pay_status: 'PAID', cod_amt: 4500.0, cod_fee: 100.0
            },
            {
                id: 12,
                tracking: 'STK-2026-NRB-0012',
                waybill: 'WB-2026-0012-NRB-KSM',
                orig: 1, dest: 3, curr: 1, loc: 'Nairobi Hub Exception Bay (Customer Reschedule)',
                s_cust: 2, s_name: 'Alpha Apex Corporate Client Ltd', s_phone: '+254 722 991 122', s_addr: 'Riverside Drive Delta Chambers', s_city: 'Nairobi',
                r_cust: null, r_name: 'Dr. Kennedy Otieno', r_phone: '+254 733 445 566', r_addr: 'Milimani Estate Court 4B', r_city: 'Kisumu',
                service: 'EXPRESS', delivery: 'LAST_MILE', status: 'ON_HOLD',
                parcels: 1, weight: 7.5, base: 600.0, weight_chg: 200.0, tax: 128.0, total: 928.0,
                pay_terms: 'PREPAID', pay_status: 'PAID', cod_amt: 0.0, cod_fee: 0.0
            }
        ];

        for (const s of shipmentsData) {
            await client.query(`
                INSERT INTO shipments (
                    id, tracking_number, waybill_number,
                    origin_hub_id, destination_hub_id, current_hub_id, current_location_desc,
                    sender_customer_id, sender_name, sender_phone, sender_address, sender_city,
                    recipient_customer_id, recipient_name, recipient_phone, recipient_address, recipient_city,
                    service_type, delivery_type, status,
                    total_parcels, actual_weight_kg, chargeable_weight_kg,
                    base_rate, weight_charge, tax_amount, total_amount,
                    payment_terms, payment_status, cod_amount, cod_fee,
                    created_by_user_id
                ) VALUES (
                    $1, $2, $3,
                    $4, $5, $6, $7,
                    $8, $9, $10, $11, $12,
                    $13, $14, $15, $16, $17,
                    $18, $19, $20,
                    $21, $22, $22,
                    $23, $24, $25, $26,
                    $27, $28, $29, $30,
                    1
                )
                ON CONFLICT (id) DO UPDATE SET
                    tracking_number = EXCLUDED.tracking_number,
                    status = EXCLUDED.status,
                    current_location_desc = EXCLUDED.current_location_desc;
            `, [
                s.id, s.tracking, s.waybill,
                s.orig, s.dest, s.curr, s.loc,
                s.s_cust, s.s_name, s.s_phone, s.s_addr, s.s_city,
                s.r_cust, s.r_name, s.r_phone, s.r_addr, s.r_city,
                s.service, s.delivery, s.status,
                s.parcels, s.weight,
                s.base, s.weight_chg, s.tax, s.total,
                s.pay_terms, s.pay_status, s.cod_amt, s.cod_fee
            ]);

            // Add Parcels
            for (let pIdx = 1; pIdx <= s.parcels; pIdx++) {
                const pNum = `${s.tracking}-P0${pIdx}`;
                await client.query(`
                    INSERT INTO parcels (
                        shipment_id, parcel_number, parcel_index, weight_kg,
                        package_type, description, condition_at_intake
                    ) VALUES ($1, $2, $3, $4, 'BOX', 'Enterprise Logistics Freight', 'GOOD')
                    ON CONFLICT DO NOTHING;
                `, [s.id, pNum, pIdx, (s.weight / s.parcels).toFixed(2)]);
            }

            // Tracking Event
            await client.query(`
                INSERT INTO tracking_events (
                    shipment_id, event_code, event_name, hub_id, location_desc,
                    actor_id, actor_type, actor_name, description
                ) VALUES ($1, $2, $3, $4, $5, 1, 'STAFF', 'System Dispatcher', $6);
            `, [s.id, s.status, `Status Transition: ${s.status}`, s.orig, s.loc, `Parcel marked as ${s.status} at ${s.loc}`]);
        }

        // 14. Inter-Hub Linehaul Transport Runs & Manifests
        console.log('  -> Seeding linehaul transport runs and manifests...');
        await client.query(`
            INSERT INTO transport_runs (
                id, run_number, route_leg_id, origin_hub_id, destination_hub_id,
                driver_id, vehicle_id, dispatcher_user_id, status, scheduled_departure, actual_departure
            ) VALUES 
                (1, 'TR-2026-NRB-MSA-01', 1, 1, 2, 1, 7, 3, 'IN_TRANSIT', CURRENT_TIMESTAMP - INTERVAL '3 hours', CURRENT_TIMESTAMP - INTERVAL '2.5 hours'),
                (2, 'TR-2026-NRB-WST-01', 2, 1, 3, 2, 8, 3, 'PLANNED', CURRENT_TIMESTAMP + INTERVAL '4 hours', NULL)
            ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;
        `);

        await client.query(`
            INSERT INTO manifests (
                id, manifest_number, transport_run_id, origin_hub_id, destination_hub_id,
                status, total_shipments, total_parcels, total_weight_kg
            ) VALUES 
                (1, 'MNF-2026-0001', 1, 1, 2, 'DISPATCHED', 2, 6, 63.0)
            ON CONFLICT (id) DO NOTHING;
        `);

        await client.query(`
            INSERT INTO manifest_items (manifest_id, shipment_id, status)
            VALUES (1, 3, 'LOADED'), (1, 4, 'LOADED')
            ON CONFLICT DO NOTHING;
        `);

        // 15. Last-Mile Deliveries & Electronic Proof of Delivery
        console.log('  -> Seeding last-mile deliveries and proof of delivery...');
        const deliveriesData = [
            { id: 1, ship_id: 7, branch_id: 1, drv_id: 1, veh_id: 1, status: 'IN_TRANSIT', name: 'KenGen Stima Plaza Supply Office', phone: '+254 720 445 566', addr: 'Kolobot Road, Stima Plaza 2nd Floor', city: 'Nairobi', cod_exp: 0, cod_col: 0 },
            { id: 2, ship_id: 8, branch_id: 2, drv_id: 2, veh_id: 2, status: 'IN_TRANSIT', name: 'Nyali Beach Resort Procurement', phone: '+254 733 112 244', addr: 'Moyo Avenue, Nyali Beachfront Block A', city: 'Mombasa', cod_exp: 0, cod_col: 0 },
            { id: 3, ship_id: 9, branch_id: 4, drv_id: 4, veh_id: 4, status: 'DELIVERED', name: 'Rift Valley Agricultural Machinery Depot', phone: '+254 723 556 677', addr: 'Commercial Street Industrial Area', city: 'Nakuru', cod_exp: 0, cod_col: 0 },
            { id: 4, ship_id: 10, branch_id: 3, drv_id: 3, veh_id: 3, status: 'DELIVERED', name: 'Grand Royal Swiss Hotel Receiving', phone: '+254 722 778 899', addr: 'Riat Hills Junction', city: 'Kisumu', cod_exp: 0, cod_col: 0 },
            { id: 5, ship_id: 11, branch_id: 4, drv_id: 4, veh_id: 4, status: 'DELIVERED', name: 'Eldama Agri Supplies Centre', phone: '+254 711 556 677', addr: 'Nakuru Highway Bay 4', city: 'Nakuru', cod_exp: 4500.0, cod_col: 4500.0 }
        ];

        for (const d of deliveriesData) {
            await client.query(`
                INSERT INTO deliveries (
                    id, delivery_number, shipment_id, branch_id, hub_id,
                    driver_id, vehicle_id, dispatcher_user_id, status,
                    recipient_name, recipient_phone, destination_address, destination_city,
                    cod_amount_expected, cod_amount_collected
                ) VALUES (
                    $1, $2, $3, $4, $4,
                    $5, $6, 3, $7,
                    $8, $9, $10, $11,
                    $12, $13
                )
                ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;
            `, [
                d.id, `DEL-2026-000${d.id}`, d.ship_id, d.branch_id,
                d.drv_id, d.veh_id, d.status,
                d.name, d.phone, d.addr, d.city,
                d.cod_exp, d.cod_col
            ]);
        }

        // Proof of delivery for completed deliveries (3, 4, 5)
        const podList = [
            { del_id: 3, ship_id: 9, name: 'Peter Kipkorir', phone: '+254 723 556 677', lat: -0.303100, lon: 36.080000 },
            { del_id: 4, ship_id: 10, name: 'Bernard Ouma', phone: '+254 722 778 899', lat: -0.091700, lon: 34.767900 },
            { del_id: 5, ship_id: 11, name: 'James Cheruiyot', phone: '+254 711 556 677', lat: -0.302500, lon: 36.081200 }
        ];

        for (const pod of podList) {
            await client.query(`
                INSERT INTO proof_of_delivery (
                    delivery_id, shipment_id, recipient_name, recipient_phone,
                    otp_code, otp_verified, signature_data, latitude, longitude, notes
                ) VALUES (
                    $1, $2, $3, $4,
                    '9921', true, 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0xMCAxMCBMMjAwIDIwMCIgc3Ryb2tlPSIjMDAwIi8+PC9zdmc+',
                    $5, $6, 'Delivered and signed in person.'
                )
                ON CONFLICT (delivery_id) DO NOTHING;
            `, [pod.del_id, pod.ship_id, pod.name, pod.phone, pod.lat, pod.lon]);
        }

        // 16. COD Settlements
        console.log('  -> Seeding Cash on Delivery settlements...');
        await client.query(`
            INSERT INTO cod_settlements (
                id, settlement_number, shipment_id, delivery_id, hub_id, collector_id,
                expected_amount, collected_amount, remitted_amount, variance_amount, currency,
                status, collection_method, collection_reference, collected_at,
                remittance_method, remittance_reference, remitted_at, reconciled_by_user_id, reconciled_at
            ) VALUES (
                1, 'SET-2026-0001', 11, 5, 4, 17,
                4500.0, 4500.0, 4500.0, 0.0, 'KES',
                'RECONCILED', 'MPESA', 'QHD7291KL0', CURRENT_TIMESTAMP - INTERVAL '1 day',
                'MPESA_PAYBILL', 'PB-889102-NAK', CURRENT_TIMESTAMP - INTERVAL '1 day', 14, CURRENT_TIMESTAMP - INTERVAL '18 hours'
            )
            ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;
        `);

        // 17. POS Shifts, Orders, Sales & M-Pesa Payments
        console.log('  -> Seeding POS counter sales and M-Pesa payments...');
        await client.query(`
            INSERT INTO pos_shifts (id, branch_id, cashier_user_id, shift_number, opening_cash, status)
            VALUES 
                (1, 1, 4, 'SHF-2026-0001', 10000.0, 'OPEN'),
                (2, 2, 8, 'SHF-2026-0002', 5000.0, 'OPEN')
            ON CONFLICT (id) DO NOTHING;
        `);

        const posSales = [
            { id: 1, br_id: 1, cust_id: 1, cash_id: 4, sub: 900.0, tax: 144.0, total: 1044.0, ref: 'QAB81920L1', meth: 'MPESA' },
            { id: 2, br_id: 1, cust_id: 2, cash_id: 4, sub: 3200.0, tax: 512.0, total: 3712.0, ref: 'QAB81920L2', meth: 'MPESA' },
            { id: 3, br_id: 2, cust_id: 1, cash_id: 8, sub: 650.0, tax: 104.0, total: 754.0, ref: 'CASH-0001', meth: 'CASH' },
            { id: 4, br_id: 2, cust_id: 5, cash_id: 8, sub: 1960.0, tax: 313.6, total: 2273.6, ref: 'QAB81920L4', meth: 'MPESA' }
        ];

        for (const s of posSales) {
            await client.query(`
                INSERT INTO orders (
                    id, branch_id, order_number, customer_id, cashier_user_id,
                    order_type, status, subtotal, tax_amount, total_amount, payment_status
                ) VALUES (
                    $1, $2, $3, $4, $5,
                    'POS_WALKIN', 'COMPLETED', $6, $7, $8, 'PAID'
                )
                ON CONFLICT (id) DO NOTHING;
            `, [s.id, s.br_id, `ORD-2026-000${s.id}`, s.cust_id, s.cash_id, s.sub, s.tax, s.total]);

            await client.query(`
                INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, tax_rate, tax_amount, total_price)
                VALUES ($1, $1, 1, 10, 90.0, 16.0, 144.0, 1044.0)
                ON CONFLICT (id) DO NOTHING;
            `, [s.id]);

            await client.query(`
                INSERT INTO sales (
                    id, branch_id, order_id, sale_number, cashier_user_id, customer_id,
                    subtotal, tax_amount, total_amount, payment_status, shift_id
                ) VALUES (
                    $1, $2, $1, $3, $4, $5,
                    $6, $7, $8, 'PAID', $9
                )
                ON CONFLICT (id) DO NOTHING;
            `, [s.id, s.br_id, `REC-2026-000${s.id}`, s.cash_id, s.cust_id, s.sub, s.tax, s.total, s.br_id === 1 ? 1 : 2]);

            await client.query(`
                INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_cost, unit_price, tax_amount, total_price)
                VALUES ($1, $1, 1, 10, 45.0, 90.0, 144.0, 1044.0)
                ON CONFLICT (id) DO NOTHING;
            `, [s.id]);

            await client.query(`
                INSERT INTO payments (
                    id, branch_id, order_id, sale_id, payment_number,
                    payment_method, amount, mpesa_receipt_number, status, cashier_user_id
                ) VALUES (
                    $1, $2, $1, $1, $3,
                    $4, $5, $6, 'COMPLETED', $7
                )
                ON CONFLICT (id) DO NOTHING;
            `, [s.id, s.br_id, `PAY-2026-000${s.id}`, s.meth, s.total, s.ref, s.cash_id]);
        }

        // 18. Sequence Resets for All Serial Tables
        console.log('  -> Resetting all PostgreSQL serial sequences to MAX(id) + 1...');
        const serialTables = [
            'branches', 'warehouses', 'roles', 'permissions', 'users',
            'categories', 'brands', 'suppliers', 'products', 'product_variants',
            'inventory', 'inventory_movements', 'customers', 'orders', 'order_items',
            'sales', 'sale_items', 'held_sales', 'payments', 'pos_shifts',
            'vehicles', 'drivers', 'routes', 'route_legs', 'logistics_pricing_tariffs',
            'shipments', 'parcels', 'tracking_events', 'scan_events',
            'transport_runs', 'manifests', 'manifest_items', 'deliveries', 'delivery_items',
            'proof_of_delivery', 'cod_settlements', 'notification_templates'
        ];

        for (const tbl of serialTables) {
            await resetSequence(client, tbl);
        }
    });

    console.log('\n============================================================');
    console.log('[PostgreSQL Seed] [SUCCESS] All enterprise logistics data successfully seeded!');
    console.log('  - 4 Regional Hubs (Nairobi, Mombasa, Kisumu, Nakuru)');
    console.log('  - 17 Operational Staff accounts with Password123!');
    console.log('  - 8 Fleet Vehicles & 4 Drivers');
    console.log('  - 12 Complete Authentic Shipments across full lifecycle');
    console.log('  - Active Linehaul Transport Runs, Deliveries & POD');
    console.log('  - Clean POS Orders, Inventory Balances & Tariffs');
    console.log('============================================================\n');
}

// Backward compatibility alias
async function seedProductionBaseline(pool = null) {
    return seedCleanEnterpriseData(pool, { clean: true });
}

// CLI handler
if (require.main === module) {
    (async () => {
        try {
            await seedCleanEnterpriseData(null, { clean: true });
        } catch (err) {
            console.error('[PostgreSQL Seed Fatal Error]:', err);
            process.exit(1);
        } finally {
            await closePool();
        }
    })();
}

module.exports = {
    seedCleanEnterpriseData,
    seedProductionBaseline,
    resetSequence,
    truncateAllTables
};
