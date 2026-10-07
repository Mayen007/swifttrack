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
            { id: 1, code: 'LOG-SUP', name: 'Logistics Packaging & Supplies', description: 'Boxes, strapping, stretch film, security seals, pallets' },
            { id: 2, code: 'BLD-MAT', name: 'Building & Construction Supplies', description: 'Cement bags, fasteners, steel mesh, protective gear' },
            { id: 3, code: 'ELE-ACC', name: 'Electronics & High-Value Cargo', description: 'Inverters, lithium backup batteries, barcode scanners, GPS tags' },
            { id: 4, code: 'FMCG-BEV', name: 'FMCG & Wholesale Beverages', description: 'Bulk cartons, bottled mineral water, non-perishable wholesale' },
            { id: 5, code: 'AUT-PRT', name: 'Automotive & Fleet Spares', description: 'Engine oil 20L drums, heavy-duty truck filters, hydraulic fluids' }
        ];

        for (const c of categories) {
            await client.query(`
                INSERT INTO categories (id, code, name, description, is_active)
                VALUES ($1, $2, $3, $4, true)
                ON CONFLICT (id) DO UPDATE SET
                    code = EXCLUDED.code,
                    name = EXCLUDED.name,
                    description = EXCLUDED.description;
            `, [c.id, c.code, c.name, c.description]);
        }

        // 8b. Brands
        const brands = [
            { id: 1, code: 'SWIFT-PACK', name: 'SwiftPack Commercial', description: 'Heavy-duty industrial packaging materials' },
            { id: 2, code: 'BAMBURI', name: 'Bamburi Cement Ltd', description: 'Premier Portland cement & structural aggregates' },
            { id: 3, code: 'SAVANNAH', name: 'Savannah Cement', description: 'Hydraulic and construction cements' },
            { id: 4, code: 'LUMEN-SOL', name: 'Lumen Solar & Power', description: 'Inverters, deep-cycle solar batteries & power conditioning' },
            { id: 5, code: 'KILIMA', name: 'Kilima Natural Springs', description: 'Certified pure spring water and beverages' },
            { id: 6, code: 'TOTAL-ERG', name: 'TotalEnergies Kenya', description: 'Commercial engine lubricants and fleet hydraulic fluids' },
            { id: 7, code: 'ISUZU-EA', name: 'Isuzu East Africa Spares', description: 'OEM commercial truck spares and service filters' }
        ];

        for (const b of brands) {
            await client.query(`
                INSERT INTO brands (id, code, name, description, is_active)
                VALUES ($1, $2, $3, $4, true)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    code = EXCLUDED.code,
                    description = EXCLUDED.description;
            `, [b.id, b.code, b.name, b.description]);
        }

        // 8c. Suppliers
        const suppliers = [
            { id: 1, code: 'SUP-BAMBURI', name: 'Bamburi Industrial Depot', contact_person: 'David Maina', email: 'orders@bamburi.co.ke', phone: '+254 722 100 001', lead_time_days: 2, payment_terms: 'NET30' },
            { id: 2, code: 'SUP-SWIFTPACK', name: 'SwiftPack Industries Kenya', contact_person: 'Grace Wambui', email: 'sales@swiftpack.co.ke', phone: '+254 722 100 002', lead_time_days: 1, payment_terms: 'NET15' },
            { id: 3, code: 'SUP-SOLARMAX', name: 'SolarMax Technologies East Africa', contact_person: 'Kevin Ochieng', email: 'wholesale@solarmax.ke', phone: '+254 722 100 003', lead_time_days: 4, payment_terms: 'NET45' },
            { id: 4, code: 'SUP-TOTAL', name: 'TotalEnergies Commercial Distribution', contact_person: 'Fatuma Hassan', email: 'logistics@totalenergies.co.ke', phone: '+254 722 100 004', lead_time_days: 3, payment_terms: 'NET30' }
        ];

        for (const s of suppliers) {
            await client.query(`
                INSERT INTO suppliers (id, code, name, contact_person, email, phone, lead_time_days, payment_terms, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
                ON CONFLICT (id) DO UPDATE SET
                    code = EXCLUDED.code,
                    name = EXCLUDED.name,
                    contact_person = EXCLUDED.contact_person,
                    email = EXCLUDED.email,
                    phone = EXCLUDED.phone;
            `, [s.id, s.code, s.name, s.contact_person, s.email, s.phone, s.lead_time_days, s.payment_terms]);
        }

        // 9. Products
        const products = [
            { id: 1, category_id: 1, brand_id: 1, supplier_id: 2, sku: 'LOG-BX-01', barcode: '890123450001', name: 'Heavy Duty Corrugated Box (Large 60x40x40cm)', unit: 'PCS', cost: 120.0, price: 180.0, wholesale: 150.0, min: 50, tax: 'STANDARD_16' },
            { id: 2, category_id: 1, brand_id: 1, supplier_id: 2, sku: 'LOG-BX-02', barcode: '890123450002', name: 'Medium Dispatch Packing Carton (40x30x30cm)', unit: 'PCS', cost: 85.0, price: 130.0, wholesale: 110.0, min: 50, tax: 'STANDARD_16' },
            { id: 3, category_id: 1, brand_id: 1, supplier_id: 2, sku: 'LOG-FLM-01', barcode: '890123450003', name: 'Industrial Stretch Film Roll 500mm x 300m', unit: 'ROLL', cost: 950.0, price: 1450.0, wholesale: 1250.0, min: 20, tax: 'STANDARD_16' },
            { id: 4, category_id: 1, brand_id: 1, supplier_id: 2, sku: 'LOG-TP-01', barcode: '890123450004', name: 'Reinforced Fragile Packaging Tape 48mm x 100m', unit: 'ROLL', cost: 180.0, price: 290.0, wholesale: 240.0, min: 30, tax: 'STANDARD_16' },
            { id: 5, category_id: 1, brand_id: 1, supplier_id: 2, sku: 'LOG-SL-01', barcode: '890123450005', name: 'Tamper-Evident Cargo Bolt Seals (Pack of 50)', unit: 'PACK', cost: 1800.0, price: 2600.0, wholesale: 2200.0, min: 10, tax: 'STANDARD_16' },
            { id: 6, category_id: 2, brand_id: 2, supplier_id: 1, sku: 'BLD-CMT-01', barcode: '890123450006', name: 'Bamburi Portland Cement 32.5R (50kg Bag)', unit: 'BAG', cost: 720.0, price: 850.0, wholesale: 780.0, min: 40, tax: 'STANDARD_16' },
            { id: 7, category_id: 2, brand_id: 3, supplier_id: 1, sku: 'BLD-CMT-02', barcode: '890123450007', name: 'Savannah Blue Triangle Cement 42.5N (50kg)', unit: 'BAG', cost: 780.0, price: 920.0, wholesale: 840.0, min: 30, tax: 'STANDARD_16' },
            { id: 8, category_id: 2, brand_id: 2, supplier_id: 1, sku: 'BLD-ST-01', barcode: '890123450008', name: 'High Tensile Steel Binding Wire (25kg Roll)', unit: 'ROLL', cost: 3100.0, price: 3850.0, wholesale: 3450.0, min: 15, tax: 'STANDARD_16' },
            { id: 9, category_id: 2, brand_id: 2, supplier_id: 1, sku: 'BLD-ST-02', barcode: '890123450009', name: 'Deformed High Yield Rebar D12 (12m Bar)', unit: 'BAR', cost: 1250.0, price: 1550.0, wholesale: 1380.0, min: 50, tax: 'STANDARD_16' },
            { id: 10, category_id: 2, brand_id: 1, supplier_id: 2, sku: 'BLD-SAF-01', barcode: '890123450010', name: 'Heavy Duty Site Safety Helmet with Visor', unit: 'PCS', cost: 650.0, price: 950.0, wholesale: 800.0, min: 15, tax: 'STANDARD_16' },
            { id: 11, category_id: 3, brand_id: 4, supplier_id: 3, sku: 'ELE-INV-01', barcode: '890123450011', name: 'Pure Sine Wave Solar Inverter 3.5kVA 24V', unit: 'UNIT', cost: 38000.0, price: 46500.0, wholesale: 42000.0, min: 5, tax: 'STANDARD_16' },
            { id: 12, category_id: 3, brand_id: 4, supplier_id: 3, sku: 'ELE-BAT-01', barcode: '890123450012', name: 'Lithium LiFePO4 Energy Battery Pack 48V 100Ah', unit: 'UNIT', cost: 95000.0, price: 118000.0, wholesale: 106000.0, min: 3, tax: 'STANDARD_16' },
            { id: 13, category_id: 3, brand_id: 1, supplier_id: 3, sku: 'ELE-SCN-01', barcode: '890123450013', name: 'Wireless Industrial 2D Barcode & QR Scanner', unit: 'PCS', cost: 4200.0, price: 6500.0, wholesale: 5400.0, min: 8, tax: 'STANDARD_16' },
            { id: 14, category_id: 3, brand_id: 1, supplier_id: 3, sku: 'ELE-GPS-01', barcode: '890123450014', name: 'Fleet Asset Magnetic GPS Tracker (4G LTE)', unit: 'PCS', cost: 3100.0, price: 4800.0, wholesale: 3900.0, min: 10, tax: 'STANDARD_16' },
            { id: 15, category_id: 3, brand_id: 4, supplier_id: 3, sku: 'ELE-UPS-01', barcode: '890123450015', name: 'Line Interactive 1500VA Office Workstation UPS', unit: 'UNIT', cost: 11200.0, price: 14800.0, wholesale: 12800.0, min: 5, tax: 'STANDARD_16' },
            { id: 16, category_id: 4, brand_id: 5, supplier_id: 4, sku: 'FMCG-WTR-01', barcode: '890123450016', name: 'Kilima Pure Natural Spring Water (Carton 24x500ml)', unit: 'CTN', cost: 480.0, price: 720.0, wholesale: 600.0, min: 40, tax: 'ZERO_RATED_0' },
            { id: 17, category_id: 4, brand_id: 5, supplier_id: 4, sku: 'FMCG-WTR-02', barcode: '890123450017', name: 'Kilima Office Water Dispenser Bottle (18.9 Litre)', unit: 'BTL', cost: 250.0, price: 450.0, wholesale: 350.0, min: 30, tax: 'ZERO_RATED_0' },
            { id: 18, category_id: 4, brand_id: 5, supplier_id: 4, sku: 'FMCG-RIC-01', barcode: '890123450018', name: 'Premium Mwea Pishori Grade A Rice (25kg Bag)', unit: 'BAG', cost: 3850.0, price: 4600.0, wholesale: 4150.0, min: 20, tax: 'ZERO_RATED_0' },
            { id: 19, category_id: 4, brand_id: 5, supplier_id: 4, sku: 'FMCG-OIL-01', barcode: '890123450019', name: 'Pure Refined Vegetable Cooking Oil (Jerrycan 20L)', unit: 'CAN', cost: 3950.0, price: 4650.0, wholesale: 4250.0, min: 15, tax: 'STANDARD_16' },
            { id: 20, category_id: 4, brand_id: 5, supplier_id: 4, sku: 'FMCG-TEA-01', barcode: '890123450020', name: 'Export Quality Granulated Black Tea (10kg Carton)', unit: 'CTN', cost: 3200.0, price: 4100.0, wholesale: 3650.0, min: 10, tax: 'ZERO_RATED_0' },
            { id: 21, category_id: 5, brand_id: 6, supplier_id: 4, sku: 'AUT-OIL-01', barcode: '890123450021', name: 'Total Rubia Heavy Fleet Engine Oil 15W-40 (20L Drum)', unit: 'DRUM', cost: 8900.0, price: 11200.0, wholesale: 9900.0, min: 10, tax: 'STANDARD_16' },
            { id: 22, category_id: 5, brand_id: 6, supplier_id: 4, sku: 'AUT-HYD-01', barcode: '890123450022', name: 'Hydraulic Oil ISO VG 68 Anti-Wear (20L Drum)', unit: 'DRUM', cost: 7400.0, price: 9500.0, wholesale: 8400.0, min: 8, tax: 'STANDARD_16' },
            { id: 23, category_id: 5, brand_id: 7, supplier_id: 4, sku: 'AUT-FLT-01', barcode: '890123450023', name: 'Isuzu FRR / FSR Heavy Fleet Fuel Filter Cartridge', unit: 'PCS', cost: 1150.0, price: 1750.0, wholesale: 1450.0, min: 15, tax: 'STANDARD_16' },
            { id: 24, category_id: 5, brand_id: 6, supplier_id: 4, sku: 'AUT-BRK-01', barcode: '890123450024', name: 'Commercial Vehicle Heavy Air Brake Fluid (5L Can)', unit: 'CAN', cost: 1850.0, price: 2650.0, wholesale: 2250.0, min: 12, tax: 'STANDARD_16' },
            { id: 25, category_id: 5, brand_id: 7, supplier_id: 4, sku: 'AUT-TYR-01', barcode: '890123450025', name: 'Truck Heavy Radial Tyre 315/80R22.5 All-Position', unit: 'PCS', cost: 34000.0, price: 41500.0, wholesale: 37500.0, min: 6, tax: 'STANDARD_16' }
        ];

        for (const p of products) {
            await client.query(`
                INSERT INTO products (
                    id, category_id, brand_id, supplier_id, sku, barcode, name, description,
                    unit, cost_price, selling_price, wholesale_price, tax_category, min_stock_alert,
                    max_stock_alert, reorder_threshold, reorder_quantity, images, is_active, is_archived
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 1000, $15, 50, '[]'::jsonb, true, false)
                ON CONFLICT (id) DO UPDATE SET
                    category_id = EXCLUDED.category_id,
                    brand_id = EXCLUDED.brand_id,
                    supplier_id = EXCLUDED.supplier_id,
                    sku = EXCLUDED.sku,
                    barcode = EXCLUDED.barcode,
                    name = EXCLUDED.name,
                    cost_price = EXCLUDED.cost_price,
                    selling_price = EXCLUDED.selling_price,
                    wholesale_price = EXCLUDED.wholesale_price,
                    tax_category = EXCLUDED.tax_category,
                    min_stock_alert = EXCLUDED.min_stock_alert,
                    reorder_threshold = EXCLUDED.reorder_threshold,
                    is_active = true,
                    is_archived = false;
            `, [
                p.id, p.category_id, p.brand_id, p.supplier_id, p.sku, p.barcode, p.name,
                `${p.name} - Certified Supply`, p.unit, p.cost, p.price, p.wholesale, p.tax, p.min, p.min
            ]);
        }

        // 9a. Product Variants
        const variants = [
            { id: 1, product_id: 1, sku: 'LOG-BX-01-SM', barcode: '890123450101', name: 'Corrugated Box Small 30x20x20cm', size: '30x20x20cm', color: 'Brown Kraft', model: 'Standard Wall', cost: 65.0, price: 95.0, wholesale: 80.0 },
            { id: 2, product_id: 1, sku: 'LOG-BX-01-MD', barcode: '890123450102', name: 'Corrugated Box Medium 40x30x30cm', size: '40x30x30cm', color: 'Brown Kraft', model: 'Double Wall', cost: 90.0, price: 140.0, wholesale: 115.0 },
            { id: 3, product_id: 1, sku: 'LOG-BX-01-LG', barcode: '890123450103', name: 'Corrugated Box Large 60x40x40cm', size: '60x40x40cm', color: 'Brown Kraft', model: 'Triple Heavy Wall', cost: 120.0, price: 180.0, wholesale: 150.0 },
            { id: 4, product_id: 10, sku: 'BLD-SAF-01-YEL', barcode: '890123451001', name: 'Site Helmet Visor Yellow/M', size: 'M (54-58cm)', color: 'High-Vis Yellow', model: 'Pro-Guard V2', cost: 650.0, price: 950.0, wholesale: 800.0 },
            { id: 5, product_id: 10, sku: 'BLD-SAF-01-WHT', barcode: '890123451002', name: 'Site Helmet Visor White/L', size: 'L (58-62cm)', color: 'Engineer White', model: 'Pro-Guard V2', cost: 680.0, price: 980.0, wholesale: 820.0 },
            { id: 6, product_id: 10, sku: 'BLD-SAF-01-BLU', barcode: '890123451003', name: 'Site Helmet Visor Blue/L', size: 'L (58-62cm)', color: 'Safety Blue', model: 'Pro-Guard V2', cost: 680.0, price: 980.0, wholesale: 820.0 }
        ];

        for (const v of variants) {
            await client.query(`
                INSERT INTO product_variants (
                    id, product_id, variant_sku, variant_barcode, variant_name, size, color, model,
                    cost_price_override, selling_price_override, wholesale_price_override, is_active
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
                ON CONFLICT (id) DO UPDATE SET
                    product_id = EXCLUDED.product_id,
                    variant_sku = EXCLUDED.variant_sku,
                    variant_barcode = EXCLUDED.variant_barcode,
                    variant_name = EXCLUDED.variant_name,
                    selling_price_override = EXCLUDED.selling_price_override,
                    wholesale_price_override = EXCLUDED.wholesale_price_override,
                    is_active = true;
            `, [v.id, v.product_id, v.sku, v.barcode, v.name, v.size, v.color, v.model, v.cost, v.price, v.wholesale]);
        }

        // 9b. Bulk Pricing
        const bulkPricing = [
            { product_id: 1, min_qty: 20, max_qty: 49, unit_price: 165.0, discount: 8.3 },
            { product_id: 1, min_qty: 50, max_qty: 99, unit_price: 150.0, discount: 16.6 },
            { product_id: 1, min_qty: 100, max_qty: null, unit_price: 135.0, discount: 25.0 },
            { product_id: 6, min_qty: 50, max_qty: 99, unit_price: 810.0, discount: 4.7 },
            { product_id: 6, min_qty: 100, max_qty: null, unit_price: 780.0, discount: 8.2 }
        ];

        for (const bp of bulkPricing) {
            await client.query(`
                INSERT INTO product_bulk_pricing (product_id, min_quantity, max_quantity, unit_price, discount_percent)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (product_id, variant_id, min_quantity) DO UPDATE SET
                    unit_price = EXCLUDED.unit_price,
                    discount_percent = EXCLUDED.discount_percent;
            `, [bp.product_id, bp.min_qty, bp.max_qty, bp.unit_price, bp.discount]);
        }

        // 9c. Branch-Specific Pricing
        const branchPrices = [
            { branch_id: 2, product_id: 6, selling_price: 820.0, wholesale_price: 760.0 },
            { branch_id: 3, product_id: 6, selling_price: 890.0, wholesale_price: 820.0 }
        ];

        for (const bp of branchPrices) {
            await client.query(`
                INSERT INTO branch_product_prices (branch_id, product_id, selling_price, wholesale_price)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (branch_id, product_id, variant_id) DO UPDATE SET
                    selling_price = EXCLUDED.selling_price,
                    wholesale_price = EXCLUDED.wholesale_price;
            `, [bp.branch_id, bp.product_id, bp.selling_price, bp.wholesale_price]);
        }

        // 9d. Promotions
        const now = new Date();
        const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const promotions = [
            {
                promo_code: 'LOGISTICS10',
                name: 'Packaging & Supplies Starter 10%',
                description: '10% discount on all corrugated packaging cartons and rolls',
                discount_type: 'PERCENTAGE',
                discount_value: 10.0,
                scope: 'CATEGORY',
                target_id: 1,
                min_spend: 1000.0,
                start_date: now.toISOString(),
                end_date: nextMonth.toISOString(),
                is_active: true
            },
            {
                promo_code: 'FLASHSALE500',
                name: 'Mega Order KES 500 Voucher',
                description: 'KES 500 flat discount on orders exceeding KES 10,000',
                discount_type: 'FIXED_AMOUNT',
                discount_value: 500.0,
                scope: 'ALL',
                target_id: null,
                min_spend: 10000.0,
                start_date: now.toISOString(),
                end_date: nextMonth.toISOString(),
                is_active: true
            }
        ];

        for (const pr of promotions) {
            await client.query(`
                INSERT INTO promotions (
                    promo_code, name, description, discount_type, discount_value, scope,
                    target_id, min_spend, start_date, end_date, is_active
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
                ON CONFLICT (promo_code) DO UPDATE SET
                    name = EXCLUDED.name,
                    discount_type = EXCLUDED.discount_type,
                    discount_value = EXCLUDED.discount_value,
                    scope = EXCLUDED.scope,
                    target_id = EXCLUDED.target_id,
                    min_spend = EXCLUDED.min_spend,
                    start_date = EXCLUDED.start_date,
                    end_date = EXCLUDED.end_date,
                    is_active = true;
            `, [
                pr.promo_code, pr.name, pr.description, pr.discount_type, pr.discount_value,
                pr.scope, pr.target_id, pr.min_spend, pr.start_date, pr.end_date
            ]);
        }

        // 9e. Warehouse Inventory Balances
        const stockDistribution = [
            { warehouse_id: 1, branch_id: 1, factor: 1.5 },
            { warehouse_id: 2, branch_id: 1, factor: 0.8 },
            { warehouse_id: 3, branch_id: 2, factor: 1.0 },
            { warehouse_id: 4, branch_id: 3, factor: 0.6 },
            { warehouse_id: 5, branch_id: 4, factor: 0.5 }
        ];

        for (const dist of stockDistribution) {
            for (const p of products) {
                const baseQty = Math.max(50, Math.round(p.min_stock * 3 * dist.factor));
                await client.query(`
                    INSERT INTO inventory (
                        branch_id, warehouse_id, product_id,
                        quantity_on_hand, quantity_reserved, quantity_available
                    ) VALUES ($1, $2, $3, $4, 0, $4)
                    ON CONFLICT (warehouse_id, product_id) DO UPDATE SET
                        quantity_on_hand = EXCLUDED.quantity_on_hand,
                        quantity_available = EXCLUDED.quantity_available;
                `, [dist.branch_id, dist.warehouse_id, p.id, baseQty]);

                const existMovement = await client.query(
                    "SELECT id FROM inventory_movements WHERE warehouse_id = $1 AND product_id = $2 AND reference_type = 'INITIAL_SEED'",
                    [dist.warehouse_id, p.id]
                );
                if (existMovement.rows.length === 0) {
                    await client.query(`
                        INSERT INTO inventory_movements (
                            branch_id, warehouse_id, product_id, movement_type,
                            quantity_change, previous_quantity, new_quantity,
                            reference_type, reference_id, reason, user_id
                        ) VALUES ($1, $2, $3, 'PURCHASE_RECEIPT', $4, 0, $4, 'INITIAL_SEED', 'INIT-2026', 'Opening Balance Stock In', 1)
                    `, [dist.branch_id, dist.warehouse_id, p.id, baseQty]);
                }
            }
        }

        // 10. Baseline Customers
        const baselineCustomers = [
            { id: 1, branch_id: 1, customer_number: 'CUST-WALKIN', full_name: 'Walk-in Counter Customer', phone: '+254 700 000 000', email: 'counter@swifttrack.co.ke', address: 'Counter Pickup', city: 'Nairobi', notes: 'Standard cash & carry retail counter sales' },
            { id: 2, branch_id: 1, customer_number: 'CUST-0002', full_name: 'Alpha Apex Corporate Client Ltd', phone: '+254 722 991 122', email: 'cargo@alphaapex.co.ke', address: 'Riverside Drive, Delta Chambers Block C', city: 'Nairobi', notes: 'Corporate Logistics Account' },
            { id: 3, branch_id: 1, customer_number: 'CUST-0003', full_name: 'Twiga Foods Central Hub', phone: '+254 711 330 088', email: 'logistics@twigafoods.com', address: 'Tatu City Industrial Logistics Park', city: 'Nairobi', notes: 'FMCG Distribution' },
            { id: 4, branch_id: 1, customer_number: 'CUST-0004', full_name: 'Mama Sarah Hardware & Building Supplies', phone: '+254 723 445 566', email: 'mamasarah.hardware@gmail.com', address: 'Jogoo Road, Next to Posta', city: 'Nairobi', notes: 'Retail merchant' },
            { id: 5, branch_id: 2, customer_number: 'CUST-0005', full_name: 'Mombasa Shipping & Marine Agency', phone: '+254 733 998 877', email: 'cargo@mombasashipping.co.ke', address: 'Kilindini Port Gate 5', city: 'Mombasa', notes: 'Maritime clearance' }
        ];

        for (const c of baselineCustomers) {
            await client.query(`
                INSERT INTO customers (
                    id, branch_id, customer_number, full_name, phone, email, address, city, notes
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (id) DO UPDATE SET
                    full_name = EXCLUDED.full_name,
                    phone = EXCLUDED.phone,
                    address = EXCLUDED.address,
                    city = EXCLUDED.city;
            `, [c.id, c.branch_id, c.customer_number, c.full_name, c.phone, c.email, c.address, c.city, c.notes]);
        }

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
            'categories', 'brands', 'suppliers', 'products', 'product_variants', 'price_rules',
            'inventory', 'inventory_movements',
            'customers', 'orders', 'order_items', 'sales', 'sale_items', 'held_sales',
            'payments', 'refund_requests', 'refunds', 'expenses',
            'stock_transfers', 'stock_transfer_items',
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
