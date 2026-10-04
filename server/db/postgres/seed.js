// server/db/postgres/seed.js
// Enterprise Seed System for PostgreSQL: Clean Production Bootstrap & Multi-Branch Demo Data
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
    } catch (err) {
        // Table might not use a serial sequence (e.g., custom primary key)
    }
}

/**
 * Seeds production baseline data into PostgreSQL.
 */
async function seedProductionBaseline(pool = null) {
    const activePool = pool || getPool();

    console.log('[PostgreSQL Seed] Initializing Production Foundation Bootstrap...');

    await withTransaction(async (client) => {
        // 1. Company Settings
        const existCompany = await client.query('SELECT id FROM company_settings WHERE id = 1');
        if (existCompany.rows.length === 0) {
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
                );
            `);
        }

        // 2. Branches
        const branches = [
            { id: 1, code: 'NRB-HQ', name: 'Nairobi Central Hub', city: 'Nairobi', address: 'Enterprise Rd, Industrial Area', phone: '+254 711 111 001', email: 'nairobi@swifttrack.co.ke' },
            { id: 2, code: 'MSA-01', name: 'Mombasa Port & Coastal Branch', city: 'Mombasa', address: 'Moi Avenue, Port Reitz Logistics Park', phone: '+254 711 111 002', email: 'mombasa@swifttrack.co.ke' },
            { id: 3, code: 'KSM-01', name: 'Kisumu Lake Basin Branch', city: 'Kisumu', address: 'Oginga Odinga Street, Warehouse Complex', phone: '+254 711 111 003', email: 'kisumu@swifttrack.co.ke' },
            { id: 4, code: 'NAK-01', name: 'Nakuru Transit Hub & Depot', city: 'Nakuru', address: 'Commercial Street, Nakuru Industrial Area', phone: '+254 711 111 004', email: 'nakuru@swifttrack.co.ke' }
        ];

        for (const b of branches) {
            await client.query(`
                INSERT INTO branches (id, code, name, city, address, phone, email, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, $7, true)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    code = EXCLUDED.code,
                    city = EXCLUDED.city,
                    address = EXCLUDED.address,
                    phone = EXCLUDED.phone,
                    email = EXCLUDED.email;
            `, [b.id, b.code, b.name, b.city, b.address, b.phone, b.email]);
        }

        // 3. Warehouses
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

        // 4. Roles
        const roles = [
            { id: 1, name: 'SUPER_ADMIN', display_name: 'Super Administrator', description: 'Complete system-wide unrestricted access across all hubs and functions' },
            { id: 2, name: 'BRANCH_MANAGER', display_name: 'Branch Manager', description: 'Full operational control, approvals, staff & inventory management for their assigned branch' },
            { id: 3, name: 'DISPATCHER', display_name: 'Logistics Dispatcher', description: 'Order fulfilment, delivery assignment, driver tracking and routing' },
            { id: 4, name: 'CASHIER', display_name: 'POS Cashier', description: 'Counter sales, M-Pesa receipt verification, order initiation and customer checkout' },
            { id: 5, name: 'DRIVER', display_name: 'Delivery Driver', description: 'Mobile delivery execution, status updates and proof-of-delivery capture' }
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

        // 5. Granular Permissions from Authorization Matrix & Stage 1-10 Logistics Features
        const permissions = [
            // Core POS & Retail
            { code: 'pos.view', module: 'pos', description: 'View POS counter, products, and held orders' },
            { code: 'pos.create', module: 'pos', description: 'Process counter sales and checkouts' },
            { code: 'pos.hold', module: 'pos', description: 'Hold and resume in-progress POS transactions' },
            { code: 'pos.refund_request', module: 'pos', description: 'Submit refund requests for completed sales' },
            { code: 'pos.refund_approve', module: 'pos', description: 'Approve or reject customer refund requests' },
            { code: 'pos:counter:book', module: 'pos', description: 'Counter parcel booking and acceptance' },
            { code: 'pos:counter:quote', module: 'pos', description: 'Calculate live shipping tariff quotes at counter' },
            // Inventory
            { code: 'inventory.view', module: 'inventory', description: 'Inspect stock levels and catalog items' },
            { code: 'inventory.adjust_request', module: 'inventory', description: 'Request stock count adjustments' },
            { code: 'inventory.adjust_approve', module: 'inventory', description: 'Approve or reject inventory adjustments' },
            { code: 'inventory.transfer_request', module: 'inventory', description: 'Initiate inter-branch stock transfers' },
            { code: 'inventory.transfer_status', module: 'inventory', description: 'Update status of inter-branch transfers' },
            // Dispatch & Delivery
            { code: 'dispatch.view', module: 'dispatch', description: 'View dispatch board and delivery queues' },
            { code: 'dispatch.create', module: 'dispatch', description: 'Create and schedule dispatches' },
            { code: 'dispatch.assign', module: 'dispatch', description: 'Assign drivers and vehicles to deliveries' },
            { code: 'dispatch.update', module: 'dispatch', description: 'Update dispatch and delivery statuses' },
            { code: 'delivery.view_own', module: 'delivery', description: 'View assigned deliveries' },
            { code: 'delivery.start', module: 'delivery', description: 'Start in-transit delivery route' },
            { code: 'delivery.pod_submit', module: 'delivery', description: 'Submit proof-of-delivery (OTP, signature)' },
            { code: 'delivery.problem', module: 'delivery', description: 'Flag delivery exceptions and problems' },
            // Staff & Auth
            { code: 'users.view', module: 'users', description: 'View staff members and credentials' },
            { code: 'users.create', module: 'users', description: 'Provision new operational staff accounts' },
            { code: 'users.edit', module: 'users', description: 'Modify staff profiles and role assignments' },
            { code: 'users.manage', module: 'users', description: 'Administrative actions: unlock, password reset, force logout' },
            // Financial & Audit
            { code: 'reports.financial_all', module: 'reports', description: 'View enterprise-wide financial statements' },
            { code: 'reports.financial_own', module: 'reports', description: 'View branch-specific sales and revenue reports' },
            { code: 'reports.shift_own', module: 'reports', description: 'View individual shift and cashier reconciliation' },
            { code: 'expenses.create', module: 'expenses', description: 'Log operational branch expenditures' },
            { code: 'expenses.approve', module: 'expenses', description: 'Approve or reject branch expense vouchers' },
            { code: 'branches.view', module: 'branches', description: 'View company regional branches' },
            { code: 'branches.create', module: 'branches', description: 'Create new regional branch or warehouse hub' },
            { code: 'branches.manage', module: 'branches', description: 'Configure branch parameters and operating hours' },
            { code: 'audit.view_all', module: 'audit', description: 'Inspect enterprise-wide immutable audit trail' },
            { code: 'audit.view_own', module: 'audit', description: 'Inspect branch-level audit logs' },
            { code: 'audit.failed_logins', module: 'audit', description: 'Inspect security failed login attempts' },
            // Stage 1-10 Logistics Permissions (with colon and dot aliases)
            { code: 'shipments:create', module: 'Shipments', description: 'Create new parcel shipment booking' },
            { code: 'shipments:view:all', module: 'Shipments', description: 'View shipments organization-wide' },
            { code: 'shipments:view:own', module: 'Shipments', description: 'View shipments within assigned hub' },
            { code: 'shipments:cancel', module: 'Shipments', description: 'Cancel un-dispatched shipments' },
            { code: 'shipments:status:update', module: 'Shipments', description: 'Perform lifecycle state transitions' },
            { code: 'shipments:price:override', module: 'Shipments', description: 'Apply discount or custom rating override' },
            { code: 'shipments:waybill:view', module: 'Shipments', description: 'Generate and print thermal barcode waybills' },
            { code: 'transport:view:all', module: 'Transport', description: 'View linehaul corridors network-wide' },
            { code: 'transport:view:own', module: 'Transport', description: 'View transport runs at local terminal' },
            { code: 'transport:create', module: 'Transport', description: 'Provision linehaul runs and route legs' },
            { code: 'transport:dispatch', module: 'Transport', description: 'Dispatch locked linehaul transport runs' },
            { code: 'transport:receive', module: 'Transport', description: 'Receive incoming linehaul runs at transit hubs' },
            { code: 'cod:view', module: 'COD', description: 'View COD settlement balances' },
            { code: 'cod:collect', module: 'COD', description: 'Collect cash-on-delivery payments from customers' },
            { code: 'cod:remit', module: 'COD', description: 'Remit collected COD funds to branch treasury' },
            { code: 'cod:reconcile', module: 'COD', description: 'Reconcile and close out COD settlements' },
            { code: 'control_tower:view', module: 'ControlTower', description: 'Monitor enterprise live map, SLA exceptions, and health' },
            { code: 'control_tower:resolve', module: 'ControlTower', description: 'Trigger automated recovery and re-routing' },
            { code: 'notifications:view', module: 'Notifications', description: 'View transactional SMS and WhatsApp notifications outbox' },
            { code: 'notifications:manage', module: 'Notifications', description: 'Manage notification channels and templates' },
            { code: 'notifications:resend', module: 'Notifications', description: 'Resend failed customer delivery alerts' }
        ];

        for (const p of permissions) {
            await client.query(`
                INSERT INTO permissions (code, module, description)
                VALUES ($1, $2, $3)
                ON CONFLICT (code) DO UPDATE SET
                    module = EXCLUDED.module,
                    description = EXCLUDED.description;
            `, [p.code, p.module, p.description]);
        }

        // 6. Role Permissions Mapping
        await client.query('DELETE FROM role_permissions');

        const roleRecords = await client.query('SELECT id, name FROM roles');
        const permRecords = await client.query('SELECT id, code FROM permissions');
        const permMap = new Map(permRecords.rows.map(p => [p.code, p.id]));

        for (const role of roleRecords.rows) {
            // Super Admin gets every permission in the system
            if (role.name === 'SUPER_ADMIN') {
                for (const perm of permRecords.rows) {
                    await client.query(`
                        INSERT INTO role_permissions (role_id, permission_id)
                        VALUES ($1, $2)
                        ON CONFLICT DO NOTHING;
                    `, [role.id, perm.id]);
                }
                continue;
            }

            const roleMatrix = AUTHORIZATION_MATRIX[role.name];
            if (!roleMatrix) continue;

            for (const [resource, actions] of Object.entries(roleMatrix)) {
                for (const [action, scope] of Object.entries(actions)) {
                    if (scope !== false) {
                        const candidates = [
                            `${resource}.${action}`,
                            `${resource}:${action}`,
                            `${resource}_${action}`,
                            `${resource}:${action}:own`,
                            `${resource}:${action}:all`,
                            `${resource}.view_own`,
                            `${resource}.view_all`
                        ];
                        for (const code of candidates) {
                            const permId = permMap.get(code);
                            if (permId) {
                                await client.query(`
                                    INSERT INTO role_permissions (role_id, permission_id)
                                    VALUES ($1, $2)
                                    ON CONFLICT DO NOTHING;
                                `, [role.id, permId]);
                            }
                        }
                    }
                }
            }

            // POS Counter Booking mapping for Cashier / Branch Manager
            if (role.name === 'CASHIER' || role.name === 'BRANCH_MANAGER') {
                for (const extra of ['pos:counter:book', 'pos:counter:quote', 'shipments:waybill:view', 'shipments:create', 'shipments:view:own', 'shipments:status:update']) {
                    const permId = permMap.get(extra);
                    if (permId) {
                        await client.query(`
                            INSERT INTO role_permissions (role_id, permission_id)
                            VALUES ($1, $2)
                            ON CONFLICT DO NOTHING;
                        `, [role.id, permId]);
                    }
                }
            }

            // Dispatcher logistics permissions
            if (role.name === 'DISPATCHER') {
                for (const extra of ['shipments:create', 'shipments:view:all', 'shipments:view:own', 'shipments:status:update', 'shipments:waybill:view', 'transport:view:all', 'transport:view:own', 'transport:create', 'transport:dispatch', 'transport:receive', 'control_tower:view', 'control_tower:resolve']) {
                    const permId = permMap.get(extra);
                    if (permId) {
                        await client.query(`
                            INSERT INTO role_permissions (role_id, permission_id)
                            VALUES ($1, $2)
                            ON CONFLICT DO NOTHING;
                        `, [role.id, permId]);
                    }
                }
            }

            // Driver delivery & POD permissions
            if (role.name === 'DRIVER') {
                for (const extra of ['delivery.view_own', 'delivery.start', 'delivery.pod_submit', 'delivery.problem', 'cod:collect', 'cod:remit', 'shipments:waybill:view']) {
                    const permId = permMap.get(extra);
                    if (permId) {
                        await client.query(`
                            INSERT INTO role_permissions (role_id, permission_id)
                            VALUES ($1, $2)
                            ON CONFLICT DO NOTHING;
                        `, [role.id, permId]);
                    }
                }
            }
        }

        // 7. Operational Baseline Staff Users
        const defaultPasswordHash = hashPassword('Password123!');

        const staffUsers = [
            { id: 1, branch_id: null, role_id: 1, username: 'superadmin', email: 'superadmin@swifttrack.co.ke', full_name: 'Grace Mutua (Chief Operations Officer)', phone: '+254 700 000 001' },
            { id: 2, branch_id: 1, role_id: 2, username: 'manager.nairobi', email: 'manager.nairobi@swifttrack.co.ke', full_name: 'David Ochieng (Nairobi Branch Manager)', phone: '+254 711 000 001' },
            { id: 3, branch_id: 1, role_id: 3, username: 'dispatcher.nairobi', email: 'dispatcher.nairobi@swifttrack.co.ke', full_name: 'Mercy Wanjiru (Logistics Lead)', phone: '+254 711 000 002' },
            { id: 4, branch_id: 1, role_id: 4, username: 'cashier.nairobi', email: 'cashier.nairobi@swifttrack.co.ke', full_name: 'Peter Kamau (Senior POS Cashier)', phone: '+254 711 000 003' },
            { id: 5, branch_id: 1, role_id: 5, username: 'driver.nairobi', email: 'driver.nairobi@swifttrack.co.ke', full_name: 'Joseph Kiprop (Lead Delivery Driver)', phone: '+254 711 000 004' },
            { id: 6, branch_id: 2, role_id: 2, username: 'manager.mombasa', email: 'manager.mombasa@swifttrack.co.ke', full_name: 'Fatuma Bakari (Mombasa Branch Manager)', phone: '+254 722 000 001' },
            { id: 7, branch_id: 3, role_id: 2, username: 'manager.kisumu', email: 'manager.kisumu@swifttrack.co.ke', full_name: 'Otieno Odhiambo (Kisumu Branch Manager)', phone: '+254 733 000 001' },
            { id: 8, branch_id: 4, role_id: 2, username: 'manager.nakuru', email: 'manager.nakuru@swifttrack.co.ke', full_name: 'Caroline Cherono (Nakuru Branch Manager)', phone: '+254 722 000 004' },
            { id: 9, branch_id: 2, role_id: 5, username: 'driver.mombasa', email: 'driver.mombasa@swifttrack.co.ke', full_name: 'Ali Hassan (Mombasa Coast Driver)', phone: '+254 722 000 005' }
        ];

        for (const u of staffUsers) {
            await client.query(`
                INSERT INTO users (
                    id, branch_id, role_id, username, email, full_name, phone,
                    password_hash, is_active, must_change_password, token_version
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, false, 1)
                ON CONFLICT (id) DO UPDATE SET
                    username = EXCLUDED.username,
                    full_name = EXCLUDED.full_name,
                    email = EXCLUDED.email,
                    phone = EXCLUDED.phone,
                    role_id = EXCLUDED.role_id,
                    branch_id = EXCLUDED.branch_id,
                    password_hash = EXCLUDED.password_hash,
                    must_change_password = false;
            `, [u.id, u.branch_id, u.role_id, u.username, u.email, u.full_name, u.phone, defaultPasswordHash]);
        }

        // 8. Categories
        const categories = [
            { id: 1, code: 'BEV', name: 'Beverages & Soft Drinks', description: 'Fast moving bottled juices, sodas and water' },
            { id: 2, code: 'DRY', name: 'Dry Foods & Grains', description: 'Packaged rice, maize flour, sugar and legumes' },
            { id: 3, code: 'HSH', name: 'Household & Cleaning', description: 'Detergents, soaps, sanitizers and paper products' },
            { id: 4, code: 'ELEC', name: 'Electronics & Accessories', description: 'Cables, power banks and solar accessories' }
        ];

        for (const c of categories) {
            await client.query(`
                INSERT INTO categories (id, code, name, description, is_active)
                VALUES ($1, $2, $3, $4, true)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description;
            `, [c.id, c.code, c.name, c.description]);
        }

        // 9. Products
        const products = [
            { id: 1, category_id: 1, sku: 'BEV-001', barcode: '616110100001', name: 'Brookside Fresh Milk 500ml', cost_price: 52.00, selling_price: 65.00, min_stock: 20, max_stock: 500 },
            { id: 2, category_id: 1, sku: 'BEV-002', barcode: '616110100002', name: 'Kericho Gold Tea Leaves 500g', cost_price: 240.00, selling_price: 310.00, min_stock: 15, max_stock: 300 },
            { id: 3, category_id: 2, sku: 'DRY-001', barcode: '616110200001', name: 'Daawat Aromatic Basmati Rice 2kg', cost_price: 360.00, selling_price: 450.00, min_stock: 25, max_stock: 600 },
            { id: 4, category_id: 2, sku: 'DRY-002', barcode: '616110200002', name: 'Pembe Premium Maize Flour 2kg', cost_price: 130.00, selling_price: 165.00, min_stock: 30, max_stock: 800 },
            { id: 5, category_id: 3, sku: 'HSH-001', barcode: '616110300001', name: 'Omo Hand Washing Powder 1kg', cost_price: 280.00, selling_price: 360.00, min_stock: 10, max_stock: 200 }
        ];

        for (const p of products) {
            await client.query(`
                INSERT INTO products (
                    id, category_id, sku, barcode, name, cost_price, selling_price,
                    min_stock_alert, max_stock_alert, is_active
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    cost_price = EXCLUDED.cost_price,
                    selling_price = EXCLUDED.selling_price;
            `, [p.id, p.category_id, p.sku, p.barcode, p.name, p.cost_price, p.selling_price, p.min_stock, p.max_stock]);
        }

        // 10. Walk-in Counter Customer
        await client.query(`
            INSERT INTO customers (
                id, branch_id, customer_number, full_name, phone, email, city, notes
            ) VALUES (
                1, 1, 'CUST-WALKIN', 'Walk-in Counter Customer', '+254 700 000 000',
                'counter@swifttrack.co.ke', 'Nairobi', 'Standard cash & carry retail counter sales'
            )
            ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;
        `);

        // 11. Vehicles & Drivers
        await client.query(`
            INSERT INTO vehicles (
                id, branch_id, registration_number, vehicle_type, model, max_capacity_kg, is_active
            ) VALUES 
                (1, 1, 'KMDF 123X', 'MOTORCYCLE', 'Boxer BM 150', 120, true),
                (2, 2, 'KDG 430Y', 'VAN', 'Toyota HiAce Logistics Van', 1500, true)
            ON CONFLICT (id) DO NOTHING;
        `);

        await client.query(`
            INSERT INTO drivers (
                id, user_id, branch_id, license_number, vehicle_id, phone, status
            ) VALUES 
                (1, 5, 1, 'DL-NRB-2024-88', 1, '+254 711 000 004', 'AVAILABLE'),
                (2, 9, 2, 'DL-MSA-2024-42', 2, '+254 722 000 005', 'AVAILABLE')
            ON CONFLICT (id) DO NOTHING;
        `);

        // 12. Baseline Logistics Pricing Tariffs
        await client.query(`
            INSERT INTO logistics_pricing_tariffs 
            (origin_hub_id, destination_hub_id, service_type, base_weight_kg, base_price, per_kg_above_base, cod_fee_percent, min_cod_fee, insurance_rate_percent, currency, is_active)
            SELECT NULL, NULL, 'STANDARD', 5.0, 350.0, 50.0, 2.0, 100.0, 1.0, 'KES', true
            WHERE NOT EXISTS (SELECT 1 FROM logistics_pricing_tariffs WHERE origin_hub_id IS NULL AND destination_hub_id IS NULL AND service_type = 'STANDARD');

            INSERT INTO logistics_pricing_tariffs 
            (origin_hub_id, destination_hub_id, service_type, base_weight_kg, base_price, per_kg_above_base, cod_fee_percent, min_cod_fee, insurance_rate_percent, currency, is_active)
            SELECT NULL, NULL, 'EXPRESS', 5.0, 600.0, 80.0, 2.0, 100.0, 1.0, 'KES', true
            WHERE NOT EXISTS (SELECT 1 FROM logistics_pricing_tariffs WHERE origin_hub_id IS NULL AND destination_hub_id IS NULL AND service_type = 'EXPRESS');

            INSERT INTO logistics_pricing_tariffs 
            (origin_hub_id, destination_hub_id, service_type, base_weight_kg, base_price, per_kg_above_base, cod_fee_percent, min_cod_fee, insurance_rate_percent, currency, is_active)
            SELECT NULL, NULL, 'SAME_DAY', 5.0, 850.0, 120.0, 2.0, 100.0, 1.0, 'KES', true
            WHERE NOT EXISTS (SELECT 1 FROM logistics_pricing_tariffs WHERE origin_hub_id IS NULL AND destination_hub_id IS NULL AND service_type = 'SAME_DAY');
        `);

        // 13. Reset all sequence values
        const serialTables = [
            'branches', 'warehouses', 'roles', 'permissions', 'users',
            'categories', 'products', 'inventory', 'customers',
            'orders', 'order_items', 'sales', 'sale_items', 'held_sales',
            'payments', 'refund_requests', 'refunds', 'expenses',
            'vehicles', 'drivers', 'deliveries', 'delivery_items',
            'proof_of_delivery', 'revoked_tokens', 'password_reset_tokens',
            'logistics_pricing_tariffs', 'offline_sync_logs'
        ];

        for (const tbl of serialTables) {
            await resetSequence(client, tbl);
        }
    });

    console.log('[PostgreSQL Seed] [OK] Production Foundation Bootstrap seeded successfully.');
}

// CLI handler
if (require.main === module) {
    const isProd = process.argv.includes('--prod');
    (async () => {
        try {
            await seedProductionBaseline();
        } catch (err) {
            console.error('[PostgreSQL Seed Error]', err.message);
            process.exit(1);
        } finally {
            await closePool();
        }
    })();
}

module.exports = {
    seedProductionBaseline,
    resetSequence
};
