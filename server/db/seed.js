// server/db/seed.js
// Comprehensive seed data for SwiftTrack Kenya Logistics & POS Platform
const { db, initSchema } = require('./database.js');
const { hashPassword } = require('../utils/security.js');
const { seedAllBranchesDemoData } = require('./seedDemoBranches.js');

/**
 * Clean Production Database Bootstrap
 * Seeds ONLY foundation tables: company settings, branches, warehouses,
 * roles, permissions, baseline operational staff, product catalog,
 * inventory baseline, vehicles, drivers, and walk-in counter customer.
 * NEVER creates synthetic orders, mock sales, or fake telemetry.
 */
function initProductionBootstrap() {
    console.log('[Bootstrap] Initializing clean database schema...');
    initSchema();

    console.log('[Bootstrap] Seeding company settings...');
    const existingCompany = db.prepare('SELECT id FROM company_settings WHERE id = 1').get();
    if (!existingCompany) {
        db.prepare(`
            INSERT INTO company_settings (
                id, company_name, registration_number, kra_pin, vat_rate, currency,
                phone, email, address, city, country, receipt_header, receipt_footer,
                etims_enabled, etims_branch_code
            ) VALUES (
                1, 'SwiftTrack Kenya Logistics Ltd', 'CPR/2021/88921', 'P051234567Z', 16.0, 'KES',
                '+254 700 123 456', 'info@swifttrack.co.ke', 'Enterprise Road, Industrial Area, Plot 42',
                'Nairobi', 'Kenya',
                '*** SWIFTTRACK KENYA LOGISTICS & POS ***\nYour Trusted Cross-Country Supply Partner',
                'Thank you for partnering with SwiftTrack Kenya!\neTIMS Certified Tax Invoice\nGoods once sold subject to return policy.',
                1, '00'
            )
        `).run();
    }

    console.log('[Bootstrap] Seeding branches & warehouses...');
    const branches = [
        { id: 1, code: 'NRB-HQ', name: 'Nairobi Central Hub', city: 'Nairobi', address: 'Enterprise Rd, Industrial Area', phone: '+254 711 111 001', email: 'nairobi@swifttrack.co.ke' },
        { id: 2, code: 'MSA-01', name: 'Mombasa Port & Coastal Branch', city: 'Mombasa', address: 'Moi Avenue, Port Reitz Logistics Park', phone: '+254 711 111 002', email: 'mombasa@swifttrack.co.ke' },
        { id: 3, code: 'KSM-01', name: 'Kisumu Lake Basin Branch', city: 'Kisumu', address: 'Oginga Odinga Street, Warehouse Complex', phone: '+254 711 111 003', email: 'kisumu@swifttrack.co.ke' }
    ];

    for (const b of branches) {
        const exist = db.prepare('SELECT id FROM branches WHERE id = ?').get(b.id);
        if (!exist) {
            db.prepare(`
                INSERT INTO branches (id, code, name, city, address, phone, email, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            `).run(b.id, b.code, b.name, b.city, b.address, b.phone, b.email);
        }
    }

    // Warehouses
    const warehouses = [
        { id: 1, branch_id: 1, code: 'W-NRB-MAIN', name: 'Nairobi Main Distribution Centre', location_desc: 'Block A, Loading Bay 1-4' },
        { id: 2, branch_id: 1, code: 'W-NRB-RET', name: 'Nairobi Retail & Rapid Dispatch Depot', location_desc: 'Front Hub Counter & Bay 5' },
        { id: 3, branch_id: 2, code: 'W-MSA-DEP', name: 'Mombasa Port Transit Warehouse', location_desc: 'Dock 3, Coastal Logistics Hub' },
        { id: 4, branch_id: 3, code: 'W-KSM-DEP', name: 'Kisumu Regional Distribution Depot', location_desc: 'Zone B, Lake Hub' }
    ];

    for (const w of warehouses) {
        const exist = db.prepare('SELECT id FROM warehouses WHERE id = ?').get(w.id);
        if (!exist) {
            db.prepare(`
                INSERT INTO warehouses (id, branch_id, code, name, location_desc, is_active)
                VALUES (?, ?, ?, ?, ?, 1)
            `).run(w.id, w.branch_id, w.code, w.name, w.location_desc);
        }
    }

    console.log('[Bootstrap] Seeding roles & permissions...');
    const roles = [
        { id: 1, name: 'SUPER_ADMIN', display_name: 'Super Admin', description: 'Company-wide complete control over all operations, settings, and branches' },
        { id: 2, name: 'BRANCH_MANAGER', display_name: 'Branch Manager', description: 'Manages branch inventory, staff, approvals, expenses, and performance' },
        { id: 3, name: 'DISPATCHER', display_name: 'Dispatcher', description: 'Logistics operations, driver assignment, routing, and delivery tracking' },
        { id: 4, name: 'CASHIER', display_name: 'Cashier', description: 'POS terminal operator, fast customer checkout, returns, and payments' },
        { id: 5, name: 'DRIVER', display_name: 'Driver', description: 'Mobile delivery driver, proof-of-delivery capture, exception reporting' }
    ];

    for (const r of roles) {
        const exist = db.prepare('SELECT id FROM roles WHERE id = ?').get(r.id);
        if (!exist) {
            db.prepare('INSERT INTO roles (id, name, display_name, description) VALUES (?, ?, ?, ?)').run(r.id, r.name, r.display_name, r.description);
        }
    }

    // Granular Permissions
    const permissions = [
        { id: 1, code: 'company:settings', module: 'Company', description: 'Configure company-wide settings, tax, receipt' },
        { id: 2, code: 'branches:create', module: 'Branches', description: 'Create new branches' },
        { id: 3, code: 'branches:view:all', module: 'Branches', description: 'View all company branches' },
        { id: 4, code: 'branches:manage:all', module: 'Branches', description: 'Manage any branch in company' },
        { id: 5, code: 'branches:manage:own', module: 'Branches', description: 'Manage assigned branch operations' },
        { id: 6, code: 'users:create:all', module: 'Users', description: 'Create users across any branch' },
        { id: 7, code: 'users:create:own', module: 'Users', description: 'Create staff in assigned branch' },
        { id: 8, code: 'products:manage', module: 'Products', description: 'Create and edit product master catalog' },
        { id: 9, code: 'inventory:view:all', module: 'Inventory', description: 'View inventory across all branches' },
        { id: 10, code: 'inventory:view:own', module: 'Inventory', description: 'View assigned branch inventory' },
        { id: 11, code: 'inventory:adjust:request', module: 'Inventory', description: 'Request stock adjustment' },
        { id: 12, code: 'inventory:adjust:approve', module: 'Inventory', description: 'Approve stock adjustments' },
        { id: 13, code: 'inventory:transfer:request', module: 'Inventory', description: 'Request inter-branch stock transfer' },
        { id: 14, code: 'inventory:transfer:approve', module: 'Inventory', description: 'Approve inter-branch stock transfer' },
        { id: 15, code: 'pos:sale:create', module: 'POS', description: 'Create POS sales and customer checkout' },
        { id: 16, code: 'pos:payment:process', module: 'POS', description: 'Process payments via Cash, M-Pesa, Card' },
        { id: 17, code: 'refund:request', module: 'Sales', description: 'Request customer refund' },
        { id: 18, code: 'refund:approve', module: 'Sales', description: 'Approve customer refunds' },
        { id: 19, code: 'discount:approve', module: 'Sales', description: 'Approve large discounts > 10%' },
        { id: 20, code: 'delivery:create', module: 'Dispatch', description: 'Create delivery orders and manifests' },
        { id: 21, code: 'delivery:assign', module: 'Dispatch', description: 'Assign drivers and vehicles to deliveries' },
        { id: 22, code: 'delivery:update:all', module: 'Dispatch', description: 'Update status of any branch delivery' },
        { id: 23, code: 'delivery:update:own', module: 'Driver', description: 'Update status of assigned delivery' },
        { id: 24, code: 'delivery:pod:submit', module: 'Driver', description: 'Submit signature, OTP, photo proof of delivery' },
        { id: 25, code: 'reports:financial:all', module: 'Reports', description: 'View company-wide consolidated financial reports' },
        { id: 26, code: 'reports:financial:own', module: 'Reports', description: 'View branch financial and sales reports' },
        { id: 27, code: 'reports:shift:own', module: 'Reports', description: 'View cashier shift totals' },
        { id: 28, code: 'expenses:create', module: 'Expenses', description: 'Submit branch expenses' },
        { id: 29, code: 'expenses:approve', module: 'Expenses', description: 'Approve branch expenses' },
        { id: 30, code: 'audit:view:all', module: 'Audit', description: 'View company audit trail' },
        { id: 31, code: 'audit:view:own', module: 'Audit', description: 'View branch-scoped audit trail' }
    ];

    for (const p of permissions) {
        const exist = db.prepare('SELECT id FROM permissions WHERE id = ?').get(p.id);
        if (!exist) {
            db.prepare('INSERT INTO permissions (id, code, module, description) VALUES (?, ?, ?, ?)').run(p.id, p.code, p.module, p.description);
        }
    }

    // Role Permissions mapping
    const rolePermissionMappings = [
        { role_id: 1, perm_codes: permissions.map(p => p.code) },
        {
            role_id: 2,
            perm_codes: [
                'branches:manage:own', 'users:create:own', 'products:manage',
                'inventory:view:own', 'inventory:adjust:request', 'inventory:adjust:approve',
                'inventory:transfer:request', 'inventory:transfer:approve',
                'pos:sale:create', 'pos:payment:process', 'refund:request', 'refund:approve', 'discount:approve',
                'delivery:create', 'delivery:assign', 'delivery:update:all',
                'reports:financial:own', 'expenses:create', 'expenses:approve', 'audit:view:own'
            ]
        },
        {
            role_id: 3,
            perm_codes: [
                'inventory:view:own', 'delivery:create', 'delivery:assign', 'delivery:update:all'
            ]
        },
        {
            role_id: 4,
            perm_codes: [
                'inventory:view:own', 'pos:sale:create', 'pos:payment:process', 'refund:request', 'reports:shift:own'
            ]
        },
        {
            role_id: 5,
            perm_codes: [
                'delivery:update:own', 'delivery:pod:submit'
            ]
        }
    ];

    db.prepare('DELETE FROM role_permissions').run();
    for (const mapping of rolePermissionMappings) {
        for (const code of mapping.perm_codes) {
            const perm = db.prepare('SELECT id FROM permissions WHERE code = ?').get(code);
            if (perm) {
                db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)').run(mapping.role_id, perm.id);
            }
        }
    }

    console.log('[Bootstrap] Seeding operational users with dynamic cryptographic salt hashes...');
    const defaultPassword = 'Password123!';

    const users = [
        { id: 1, branch_id: null, role_id: 1, username: 'superadmin', email: 'superadmin@swifttrack.co.ke', full_name: 'Amina Kimani (Managing Director)', phone: '+254 722 000 001' },
        { id: 2, branch_id: 1, role_id: 2, username: 'manager.nairobi', email: 'manager.nairobi@swifttrack.co.ke', full_name: 'David Ochieng (Nairobi Branch Manager)', phone: '+254 722 000 002' },
        { id: 3, branch_id: 1, role_id: 3, username: 'dispatcher.nairobi', email: 'dispatcher.nairobi@swifttrack.co.ke', full_name: 'Faith Wanjiku (Logistics Dispatcher)', phone: '+254 722 000 003' },
        { id: 4, branch_id: 1, role_id: 4, username: 'cashier.nairobi', email: 'cashier.nairobi@swifttrack.co.ke', full_name: 'Kevin Mutua (Senior Cashier)', phone: '+254 722 000 004' },
        { id: 5, branch_id: 1, role_id: 5, username: 'driver.nairobi', email: 'driver.nairobi@swifttrack.co.ke', full_name: 'Joseph Kiprop (Lead Delivery Driver)', phone: '+254 722 000 005' },
        { id: 6, branch_id: 2, role_id: 2, username: 'manager.mombasa', email: 'manager.mombasa@swifttrack.co.ke', full_name: 'Hassan Mwadime (Mombasa Branch Manager)', phone: '+254 722 000 006' },
        { id: 7, branch_id: 2, role_id: 4, username: 'cashier.mombasa', email: 'cashier.mombasa@swifttrack.co.ke', full_name: 'Halima Bakari (Mombasa Cashier)', phone: '+254 722 000 007' },
        { id: 8, branch_id: 2, role_id: 5, username: 'driver.mombasa', email: 'driver.mombasa@swifttrack.co.ke', full_name: 'Ali Omar (Coast Fleet Driver)', phone: '+254 722 000 008' },
        { id: 9, branch_id: 3, role_id: 2, username: 'manager.kisumu', email: 'manager.kisumu@swifttrack.co.ke', full_name: 'Grace Adhiambo (Kisumu Branch Manager)', phone: '+254 722 000 009' },
        { id: 10, branch_id: 3, role_id: 5, username: 'driver.kisumu', email: 'driver.kisumu@swifttrack.co.ke', full_name: 'Francis Omondi (Lake Basin Fleet Driver)', phone: '+254 722 000 010' }
    ];

    for (const u of users) {
        const exist = db.prepare('SELECT id FROM users WHERE id = ?').get(u.id);
        if (!exist) {
            const dynamicHash = hashPassword(defaultPassword);
            db.prepare(`
                INSERT INTO users (id, branch_id, role_id, username, email, full_name, phone, password_hash, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
            `).run(u.id, u.branch_id, u.role_id, u.username, u.email, u.full_name, u.phone, dynamicHash);
        }
    }

    console.log('[Bootstrap] Seeding product categories & catalog...');
    const categories = [
        { id: 1, code: 'LOG-SUP', name: 'Logistics Packaging & Supplies', description: 'Boxes, strapping, stretch film, security seals, pallets' },
        { id: 2, code: 'BLD-MAT', name: 'Building & Construction Supplies', description: 'Cement bags, fasteners, steel mesh, protective gear' },
        { id: 3, code: 'ELE-ACC', name: 'Electronics & High-Value Cargo', description: 'Inverters, lithium backup batteries, barcode scanners, GPS tags' },
        { id: 4, code: 'FMCG-BEV', name: 'FMCG & Wholesale Beverages', description: 'Bulk cartons, bottled mineral water, non-perishable wholesale' },
        { id: 5, code: 'AUT-PRT', name: 'Automotive & Fleet Spares', description: 'Engine oil 20L drums, heavy-duty truck filters, hydraulic fluids' }
    ];

    for (const c of categories) {
        const exist = db.prepare('SELECT id FROM categories WHERE id = ?').get(c.id);
        if (!exist) {
            db.prepare('INSERT INTO categories (id, code, name, description, is_active) VALUES (?, ?, ?, ?, 1)').run(c.id, c.code, c.name, c.description);
        }
    }

    const products = [
        { id: 1, category_id: 1, sku: 'LOG-BX-01', barcode: '890123450001', name: 'Heavy Duty Corrugated Box (Large 60x40x40cm)', unit: 'PCS', cost: 120.0, price: 180.0, min: 50 },
        { id: 2, category_id: 1, sku: 'LOG-BX-02', barcode: '890123450002', name: 'Medium Dispatch Packing Carton (40x30x30cm)', unit: 'PCS', cost: 85.0, price: 130.0, min: 50 },
        { id: 3, category_id: 1, sku: 'LOG-FLM-01', barcode: '890123450003', name: 'Industrial Stretch Film Roll 500mm x 300m', unit: 'ROLL', cost: 950.0, price: 1450.0, min: 20 },
        { id: 4, category_id: 1, sku: 'LOG-TP-01', barcode: '890123450004', name: 'Reinforced Fragile Packaging Tape 48mm x 100m', unit: 'ROLL', cost: 180.0, price: 290.0, min: 30 },
        { id: 5, category_id: 1, sku: 'LOG-SL-01', barcode: '890123450005', name: 'Tamper-Evident Cargo Bolt Seals (Pack of 50)', unit: 'PACK', cost: 1800.0, price: 2600.0, min: 10 },
        { id: 6, category_id: 2, sku: 'BLD-CMT-01', barcode: '890123450006', name: 'Bamburi Portland Cement 32.5R (50kg Bag)', unit: 'BAG', cost: 720.0, price: 850.0, min: 40 },
        { id: 7, category_id: 2, sku: 'BLD-CMT-02', barcode: '890123450007', name: 'Savannah Blue Triangle Cement 42.5N (50kg)', unit: 'BAG', cost: 780.0, price: 920.0, min: 30 },
        { id: 8, category_id: 2, sku: 'BLD-ST-01', barcode: '890123450008', name: 'High Tensile Steel Binding Wire (25kg Roll)', unit: 'ROLL', cost: 3100.0, price: 3850.0, min: 15 },
        { id: 9, category_id: 2, sku: 'BLD-ST-02', barcode: '890123450009', name: 'Deformed High Yield Rebar D12 (12m Bar)', unit: 'BAR', cost: 1250.0, price: 1550.0, min: 50 },
        { id: 10, category_id: 2, sku: 'BLD-SAF-01', barcode: '890123450010', name: 'Heavy Duty Site Safety Helmet with Visor', unit: 'PCS', cost: 650.0, price: 950.0, min: 15 },
        { id: 11, category_id: 3, sku: 'ELE-INV-01', barcode: '890123450011', name: 'Pure Sine Wave Solar Inverter 3.5kVA 24V', unit: 'UNIT', cost: 38000.0, price: 46500.0, min: 5 },
        { id: 12, category_id: 3, sku: 'ELE-BAT-01', barcode: '890123450012', name: 'Lithium LiFePO4 Energy Battery Pack 48V 100Ah', unit: 'UNIT', cost: 95000.0, price: 118000.0, min: 3 },
        { id: 13, category_id: 3, sku: 'ELE-SCN-01', barcode: '890123450013', name: 'Wireless Industrial 2D Barcode & QR Scanner', unit: 'PCS', cost: 4200.0, price: 6500.0, min: 8 },
        { id: 14, category_id: 3, sku: 'ELE-GPS-01', barcode: '890123450014', name: 'Fleet Asset Magnetic GPS Tracker (4G LTE)', unit: 'PCS', cost: 3100.0, price: 4800.0, min: 10 },
        { id: 15, category_id: 3, sku: 'ELE-UPS-01', barcode: '890123450015', name: 'Line Interactive 1500VA Office Workstation UPS', unit: 'UNIT', cost: 11200.0, price: 14800.0, min: 5 },
        { id: 16, category_id: 4, sku: 'FMCG-WTR-01', barcode: '890123450016', name: 'Kilima Pure Natural Spring Water (Carton 24x500ml)', unit: 'CTN', cost: 480.0, price: 720.0, min: 40 },
        { id: 17, category_id: 4, sku: 'FMCG-WTR-02', barcode: '890123450017', name: 'Kilima Office Water Dispenser Bottle (18.9 Litre)', unit: 'BTL', cost: 250.0, price: 450.0, min: 30 },
        { id: 18, category_id: 4, sku: 'FMCG-RIC-01', barcode: '890123450018', name: 'Premium Mwea Pishori Grade A Rice (25kg Bag)', unit: 'BAG', cost: 3850.0, price: 4600.0, min: 20 },
        { id: 19, category_id: 4, sku: 'FMCG-OIL-01', barcode: '890123450019', name: 'Pure Refined Vegetable Cooking Oil (Jerrycan 20L)', unit: 'CAN', cost: 3950.0, price: 4650.0, min: 15 },
        { id: 20, category_id: 4, sku: 'FMCG-TEA-01', barcode: '890123450020', name: 'Export Quality Granulated Black Tea (10kg Carton)', unit: 'CTN', cost: 3200.0, price: 4100.0, min: 10 },
        { id: 21, category_id: 5, sku: 'AUT-OIL-01', barcode: '890123450021', name: 'Total Rubia Heavy Fleet Engine Oil 15W-40 (20L Drum)', unit: 'DRUM', cost: 8900.0, price: 11200.0, min: 10 },
        { id: 22, category_id: 5, sku: 'AUT-HYD-01', barcode: '890123450022', name: 'Hydraulic Oil ISO VG 68 Anti-Wear (20L Drum)', unit: 'DRUM', cost: 7400.0, price: 9500.0, min: 8 },
        { id: 23, category_id: 5, sku: 'AUT-FLT-01', barcode: '890123450023', name: 'Isuzu FRR / FSR Heavy Fleet Fuel Filter Cartridge', unit: 'PCS', cost: 1150.0, price: 1750.0, min: 15 },
        { id: 24, category_id: 5, sku: 'AUT-BRK-01', barcode: '890123450024', name: 'Commercial Vehicle Heavy Air Brake Fluid (5L Can)', unit: 'CAN', cost: 1850.0, price: 2650.0, min: 12 },
        { id: 25, category_id: 5, sku: 'AUT-TYR-01', barcode: '890123450025', name: 'Truck Heavy Radial Tyre 315/80R22.5 All-Position', unit: 'PCS', cost: 34000.0, price: 41500.0, min: 6 }
    ];

    for (const p of products) {
        const exist = db.prepare('SELECT id FROM products WHERE id = ?').get(p.id);
        if (!exist) {
            db.prepare(`
                INSERT INTO products (id, category_id, sku, barcode, name, description, unit, cost_price, selling_price, min_stock_alert, max_stock_alert, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1000, 1)
            `).run(p.id, p.category_id, p.sku, p.barcode, p.name, `${p.name} - Certified Supply`, p.unit, p.cost, p.price, p.min);
        }
    }

    console.log('[Bootstrap] Initializing warehouse inventory balances...');
    const stockDistribution = [
        { warehouse_id: 1, branch_id: 1, factor: 1.5 },
        { warehouse_id: 2, branch_id: 1, factor: 0.8 },
        { warehouse_id: 3, branch_id: 2, factor: 1.0 },
        { warehouse_id: 4, branch_id: 3, factor: 0.6 }
    ];

    for (const dist of stockDistribution) {
        for (const p of products) {
            const baseQty = Math.max(12, Math.round(p.min * 3 * dist.factor));
            const exist = db.prepare('SELECT id FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(dist.warehouse_id, p.id);
            if (!exist) {
                db.prepare(`
                    INSERT INTO inventory (branch_id, warehouse_id, product_id, quantity_on_hand, quantity_reserved, quantity_available)
                    VALUES (?, ?, ?, ?, 0, ?)
                `).run(dist.branch_id, dist.warehouse_id, p.id, baseQty, baseQty);

                db.prepare(`
                    INSERT INTO inventory_movements (
                        branch_id, warehouse_id, product_id, movement_type,
                        quantity_change, previous_quantity, new_quantity,
                        reference_type, reference_id, reason, user_id
                    ) VALUES (?, ?, ?, 'PURCHASE_RECEIPT', ?, 0, ?, 'INITIAL_SEED', 'INIT-2026', 'Opening Balance Stock In', 1)
                `).run(dist.branch_id, dist.warehouse_id, p.id, baseQty, baseQty);
            }
        }
    }

    console.log('[Bootstrap] Seeding fleet vehicles & drivers...');
    const vehicles = [
        { id: 1, branch_id: 1, reg: 'KMDF 412B', type: 'MOTORCYCLE', model: 'Honda Ace 125 Cargo', capacity: 60 },
        { id: 2, branch_id: 1, reg: 'KBZ 891L', type: 'VAN', model: 'Toyota HiAce High-Roof Cargo', capacity: 1200 },
        { id: 3, branch_id: 1, reg: 'KDG 554W', type: 'TRUCK', model: 'Isuzu FRR 90 (5-Tonne Cargo)', capacity: 5000 },
        { id: 4, branch_id: 2, reg: 'KDM 109Q', type: 'VAN', model: 'Nissan NV350 Commercial Van', capacity: 1100 },
        { id: 5, branch_id: 3, reg: 'KDB 782X', type: 'PICKUP', model: 'Toyota Hilux Single-Cab 4WD', capacity: 1000 }
    ];

    for (const v of vehicles) {
        const exist = db.prepare('SELECT id FROM vehicles WHERE id = ?').get(v.id);
        if (!exist) {
            db.prepare(`
                INSERT INTO vehicles (id, branch_id, registration_number, vehicle_type, model, max_capacity_kg, is_active)
                VALUES (?, ?, ?, ?, ?, ?, 1)
            `).run(v.id, v.branch_id, v.reg, v.type, v.model, v.capacity);
        }
    }

    const drivers = [
        { id: 1, user_id: 5, branch_id: 1, license: 'DL-NRB-88219', vehicle_id: 2, phone: '+254 722 000 005', status: 'AVAILABLE', lat: -1.3032, lng: 36.8456 },
        { id: 2, user_id: 8, branch_id: 2, license: 'DL-MSA-44102', vehicle_id: 4, phone: '+254 722 000 008', status: 'AVAILABLE', lat: -4.0435, lng: 39.6682 },
        { id: 3, user_id: 10, branch_id: 3, license: 'DL-KSM-99120', vehicle_id: 5, phone: '+254 722 000 010', status: 'AVAILABLE', lat: -0.0917, lng: 34.7680 }
    ];

    for (const d of drivers) {
        const exist = db.prepare('SELECT id FROM drivers WHERE id = ?').get(d.id);
        if (!exist) {
            db.prepare(`
                INSERT INTO drivers (id, user_id, branch_id, license_number, vehicle_id, phone, status, current_latitude, current_longitude, last_ping_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).run(d.id, d.user_id, d.branch_id, d.license, d.vehicle_id, d.phone, d.status, d.lat, d.lng);
        }
    }

    console.log('[Bootstrap] Seeding baseline customers (counter and corporate delivery)...');
    const walkInCustomer = db.prepare('SELECT id FROM customers WHERE id = 1').get();
    if (!walkInCustomer) {
        db.prepare(`
            INSERT INTO customers (id, branch_id, customer_number, full_name, phone, email, address, city, kra_pin)
            VALUES (1, NULL, 'CUST-0001', 'Walk-in Customer (General Counter)', '+254 700 000 000', 'walkin@swifttrack.co.ke', 'Counter Pickup', 'Nairobi', NULL)
        `).run();
    }
    const corporateCustomer = db.prepare('SELECT id FROM customers WHERE id = 2').get();
    if (!corporateCustomer) {
        db.prepare(`
            INSERT INTO customers (id, branch_id, customer_number, full_name, phone, email, address, city, kra_pin)
            VALUES (2, 1, 'CUST-0002', 'Alpha Apex Corporate Client Ltd', '+254 722 991 122', 'cargo@alphaapex.co.ke', 'Riverside Drive, Delta Chambers Block C', 'Nairobi', 'P059998881A')
        `).run();
    }

    console.log('[Bootstrap] Seeding system initialization audit log...');
    const auditExist = db.prepare('SELECT id FROM audit_logs WHERE id = 1').get();
    if (!auditExist) {
        db.prepare(`
            INSERT INTO audit_logs (
                id, user_id, role, action, resource, resource_id, branch_id,
                previous_value, new_value, reason, ip_address, user_agent
            ) VALUES (
                1, 1, 'SUPER_ADMIN', 'CREATE', 'COMPANY', '1', NULL,
                NULL, '{"company_name":"SwiftTrack Kenya Logistics Ltd","status":"ACTIVE"}',
                'Clean Enterprise System Provisioning & Bootstrap', '127.0.0.1', 'Node.js Production Bootstrap'
            )
        `).run();
    }

    console.log('✅ [Bootstrap] Clean production database bootstrap completed successfully.');
}

/**
 * Demo Simulation Seeder
 * Populates corporate customer profiles, sample operational transactions,
 * active deliveries, held sales, refund approvals, and 14-day telemetry.
 */
function seedDemoSimulation() {
    console.log('[Demo] Seeding commercial demo customers...');
    const demoCustomers = [
        { id: 2, branch_id: 1, no: 'CUST-0002', name: 'Safaricom Enterprise Operations', phone: '+254 722 110 099', email: 'procurement@safaricom.co.ke', address: 'Waiyaki Way, HQ 2, Westlands', city: 'Nairobi', pin: 'P051000111A' },
        { id: 3, branch_id: 1, no: 'CUST-0003', name: 'Twiga Foods Central Hub', phone: '+254 711 330 088', email: 'logistics@twigafoods.com', address: 'Tatu City Industrial Logistics Park', city: 'Nairobi', pin: 'P051000222B' },
        { id: 4, branch_id: 1, no: 'CUST-0004', name: 'Mama Sarah Hardware & Building Supplies', phone: '+254 723 445 566', email: 'mamasarah.hardware@gmail.com', address: 'Jogoo Road, Next to Posta', city: 'Nairobi', pin: 'A004556677Z' },
        { id: 5, branch_id: 2, no: 'CUST-0005', name: 'Mombasa Shipping & Marine Agency', phone: '+254 733 998 877', email: 'cargo@mombasashipping.co.ke', address: 'Kilindini Port Gate 5', city: 'Mombasa', pin: 'P051998877K' }
    ];

    for (const c of demoCustomers) {
        const exist = db.prepare('SELECT id FROM customers WHERE id = ?').get(c.id);
        if (!exist) {
            db.prepare(`
                INSERT INTO customers (id, branch_id, customer_number, full_name, phone, email, address, city, kra_pin)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(c.id, c.branch_id, c.no, c.name, c.phone, c.email, c.address, c.city, c.pin);
        }
    }

    console.log('[Demo] Seeding sample orders, sales, and deliveries...');
    const existingOrders = db.prepare('SELECT count(*) as cnt FROM orders').get();
    if (existingOrders.cnt === 0) {
        // Order 1: Walk-in POS Sale already completed
        db.prepare(`
            INSERT INTO orders (
                id, branch_id, order_number, customer_id, cashier_user_id, order_type,
                status, subtotal, discount_amount, tax_amount, total_amount, payment_status,
                delivery_required
            ) VALUES (
                1, 1, 'ORD-NRB-1001', 1, 4, 'POS_WALKIN',
                'COMPLETED', 2960.0, 0.0, 473.6, 3433.6, 'PAID', 0
            )
        `).run();

        db.prepare(`
            INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount_amount, tax_rate, tax_amount, total_price)
            VALUES (1, 1, 4, 180.0, 0, 16.0, 115.2, 720.0),
                   (1, 3, 1, 1450.0, 0, 16.0, 232.0, 1450.0),
                   (1, 4, 2, 290.0, 0, 16.0, 92.8, 580.0)
        `).run();

        db.prepare(`
            INSERT INTO sales (
                id, branch_id, order_id, sale_number, cashier_user_id, customer_id,
                subtotal, discount_amount, tax_amount, total_amount, payment_status, receipt_printed_at
            ) VALUES (
                1, 1, 1, 'SALE-NRB-1001', 4, 1,
                2960.0, 0.0, 473.6, 3433.6, 'PAID', CURRENT_TIMESTAMP
            )
        `).run();

        db.prepare(`
            INSERT INTO payments (
                branch_id, sale_id, order_id, payment_number, payment_method,
                amount, currency, reference_code, mpesa_receipt_number, mpesa_phone_number,
                status, cashier_user_id, notes
            ) VALUES (
                1, 1, 1, 'PAY-NRB-1001', 'MPESA',
                3433.6, 'KES', 'RKA8921KL', 'RKA8921KL', '+254 722 000 004',
                'COMPLETED', 4, 'M-Pesa STK push confirmed'
            )
        `).run();

        // Order 2: Delivery Order Ready for Dispatch
        db.prepare(`
            INSERT INTO orders (
                id, branch_id, order_number, customer_id, cashier_user_id, order_type,
                status, subtotal, discount_amount, tax_amount, total_amount, payment_status,
                delivery_required, delivery_address, delivery_city, recipient_name, recipient_phone, special_instructions
            ) VALUES (
                2, 1, 'ORD-NRB-1002', 3, 4, 'DELIVERY_ORDER',
                'READY_FOR_DISPATCH', 38250.0, 0.0, 6120.0, 44370.0, 'PAID',
                1, 'Twiga Foods Central Hub, Tatu City, Gate 2', 'Nairobi', 'Antony Mwangi', '+254 711 330 088', 'Gate pass required at entrance'
            )
        `).run();

        db.prepare(`
            INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount_amount, tax_rate, tax_amount, total_price)
            VALUES (2, 8, 5, 3850.0, 0, 16.0, 3080.0, 19250.0),
                   (2, 9, 10, 1550.0, 0, 16.0, 2480.0, 15500.0)
        `).run();

        db.prepare(`
            INSERT INTO deliveries (
                id, branch_id, delivery_number, order_id, driver_id, vehicle_id,
                dispatcher_user_id, status, priority, scheduled_pickup_at, estimated_delivery_at
            ) VALUES (
                1, 1, 'DEL-NRB-2001', 2, NULL, NULL,
                3, 'READY_FOR_DISPATCH', 'HIGH', CURRENT_TIMESTAMP, datetime('now', '+3 hours')
            )
        `).run();

        // Order 3: Active Delivery In Transit with Driver 1
        db.prepare(`
            INSERT INTO orders (
                id, branch_id, order_number, customer_id, cashier_user_id, order_type,
                status, subtotal, discount_amount, tax_amount, total_amount, payment_status,
                delivery_required, delivery_address, delivery_city, recipient_name, recipient_phone, special_instructions
            ) VALUES (
                3, 1, 'ORD-NRB-1003', 2, 4, 'DELIVERY_ORDER',
                'DISPATCHED', 46500.0, 0.0, 7440.0, 53940.0, 'PAID',
                1, 'Safaricom Enterprise HQ 2, Waiyaki Way', 'Nairobi', 'Sarah Jepkemoi', '+254 722 110 099', 'Deliver to IT Server Room 3rd Floor'
            )
        `).run();

        db.prepare(`
            INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount_amount, tax_rate, tax_amount, total_price)
            VALUES (3, 11, 1, 46500.0, 0, 16.0, 7440.0, 46500.0)
        `).run();

        db.prepare(`
            INSERT INTO deliveries (
                id, branch_id, delivery_number, order_id, driver_id, vehicle_id,
                dispatcher_user_id, status, priority, scheduled_pickup_at, estimated_delivery_at
            ) VALUES (
                2, 1, 'DEL-NRB-2002', 3, 1, 2,
                3, 'IN_TRANSIT', 'URGENT', datetime('now', '-1 hour'), datetime('now', '+1 hour')
            )
        `).run();

        db.prepare(`
            INSERT INTO delivery_status_history (delivery_id, status, notes, latitude, longitude, updated_by_user_id)
            VALUES (2, 'ASSIGNED', 'Assigned to Driver Joseph Kiprop with Van KBZ 891L', -1.3032, 36.8456, 3),
                   (2, 'PICKED_UP', 'Goods checked and loaded at Loading Bay 2', -1.3032, 36.8456, 5),
                   (2, 'IN_TRANSIT', 'En route via Expressway to Westlands', -1.2721, 36.8122, 5)
        `).run();

        // Sample Held Sale for POS quick test
        db.prepare(`
            INSERT INTO held_sales (
                id, branch_id, cashier_user_id, hold_reference, customer_name,
                customer_phone, cart_data_json, subtotal, total, notes
            ) VALUES (
                1, 1, 4, 'HOLD-NRB-401', 'Walk-in Customer (Fetching cash)',
                '+254 721 999 888',
                '[{"id":1,"name":"Heavy Duty Corrugated Box (Large 60x40x40cm)","sku":"LOG-BX-01","barcode":"890123450001","price":180,"qty":5},{"id":4,"name":"Reinforced Fragile Packaging Tape 48mm x 100m","sku":"LOG-TP-01","barcode":"890123450004","price":290,"qty":2}]',
                1480.0, 1716.8, 'Customer stepped out to M-Pesa agent'
            )
        `).run();

        // Sample Pending Refund Request for Branch Manager Approval
        db.prepare(`
            INSERT INTO refund_requests (
                id, refund_request_number, branch_id, sale_id, cashier_user_id,
                amount, reason, status
            ) VALUES (
                1, 'REF-REQ-001', 1, 1, 4,
                580.0, 'Customer purchased excess 2 rolls of packaging tape, unused packaging condition verified',
                'PENDING_APPROVAL'
            )
        `).run();

        // Sample Branch Expenses
        db.prepare(`
            INSERT INTO expenses (
                id, expense_number, branch_id, category, description, amount,
                payee, payment_method, status, created_by_user_id, approved_by_user_id
            ) VALUES (
                1, 'EXP-NRB-001', 1, 'FUEL', 'Diesel fuel refill for Fleet Van KBZ 891L', 6500.0,
                'Rubis Energy Industrial Area', 'MPESA', 'APPROVED', 2, 2
            ),
            (
                2, 'EXP-NRB-002', 1, 'PACKAGING', 'Bulk pallet strapping seals purchase', 4200.0,
                'Kenpoly Manufacturers Ltd', 'CASH', 'PENDING_APPROVAL', 4, NULL
            )
        `).run();

        // Sample Initial Notifications
        db.prepare(`
            INSERT INTO notifications (
                branch_id, user_id, type, title, message, reference_type, reference_id
            ) VALUES (
                1, 2, 'REFUND_REQUEST', 'Refund Approval Needed', 'Cashier Kevin Mutua submitted refund request REF-REQ-001 of KSh 580.00 for Sale #SALE-NRB-1001', 'REFUND', '1'
            ),
            (
                1, 3, 'NEW_ORDER', 'New Delivery Order Ready', 'Order ORD-NRB-1002 for Twiga Foods is prepared and awaiting driver assignment.', 'ORDER', '2'
            ),
            (
                1, 5, 'DELIVERY_ASSIGNED', 'New High Priority Delivery Assigned', 'You have been assigned Delivery DEL-NRB-2002 to Safaricom Enterprise HQ.', 'DELIVERY', '2'
            )
        `).run();
    }

    console.log('[Demo] Ensuring rich visual analytics telemetry across all branches...');
    seedAllBranchesDemoData();
    ensureRichChartTelemetry();
}

function ensureRichChartTelemetry() {
    const failureCount = db.prepare("SELECT count(*) as cnt FROM deliveries WHERE failure_reason IS NOT NULL").get().cnt;
    const dateCount = db.prepare("SELECT count(DISTINCT date(created_at)) as cnt FROM orders").get().cnt;

    if (failureCount >= 5 && dateCount >= 10) {
        return;
    }

    console.log('[Demo] Backfilling 14-day operational chart telemetry (orders, deliveries, COD, failure exceptions)...');

    const products = db.prepare('SELECT id, selling_price, cost_price FROM products').all();
    const customers = db.prepare('SELECT id, branch_id FROM customers').all();

    const daysMatrix = [
        { daysAgo: 13, nrb: 8, msa: 4, ksm: 3 },
        { daysAgo: 12, nrb: 10, msa: 5, ksm: 4 },
        { daysAgo: 11, nrb: 7, msa: 3, ksm: 2 },
        { daysAgo: 10, nrb: 12, msa: 6, ksm: 5 },
        { daysAgo: 9,  nrb: 14, msa: 7, ksm: 4 },
        { daysAgo: 8,  nrb: 9, msa: 5, ksm: 3 },
        { daysAgo: 7,  nrb: 16, msa: 8, ksm: 6 },
        { daysAgo: 6,  nrb: 18, msa: 9, ksm: 7 },
        { daysAgo: 5,  nrb: 15, msa: 8, ksm: 5 },
        { daysAgo: 4,  nrb: 13, msa: 7, ksm: 6 },
        { daysAgo: 3,  nrb: 20, msa: 11, ksm: 8 },
        { daysAgo: 2,  nrb: 22, msa: 12, ksm: 9 },
        { daysAgo: 1,  nrb: 19, msa: 10, ksm: 7 },
        { daysAgo: 0,  nrb: 14, msa: 6, ksm: 5 }
    ];

    const failureReasons = [
        'Customer Phone Unreachable',
        'Incorrect Delivery Address / Geotag',
        'Customer Refused Payment / Postponed',
        'Premises Gate Access Denied',
        'Severe Road Flooding / Traffic'
    ];

    let orderIndex = db.prepare('SELECT COALESCE(MAX(id), 0) as maxId FROM orders').get().maxId + 1;
    let saleIndex = db.prepare('SELECT COALESCE(MAX(id), 0) as maxId FROM sales').get().maxId + 1;
    let delIndex = db.prepare('SELECT COALESCE(MAX(id), 0) as maxId FROM deliveries').get().maxId + 1;
    let payIndex = db.prepare('SELECT COALESCE(MAX(id), 0) as maxId FROM payments').get().maxId + 1;

    for (const d of daysMatrix) {
        const dateOffsetStr = `-${d.daysAgo} days`;
        const branchCounts = [
            { branchId: 1, count: d.nrb, cashierId: 4, dispatcherId: 3, defaultDriverId: 1, vehicleId: 2 },
            { branchId: 2, count: d.msa, cashierId: 7, dispatcherId: 3, defaultDriverId: 2, vehicleId: 4 },
            { branchId: 3, count: d.ksm, cashierId: 4, dispatcherId: 3, defaultDriverId: 3, vehicleId: 5 }
        ];

        for (const b of branchCounts) {
            for (let i = 0; i < b.count; i++) {
                const currentOrderNum = `ORD-SIM-${b.branchId}-${d.daysAgo}-${i + 1}`;
                const existing = db.prepare('SELECT id FROM orders WHERE order_number = ?').get(currentOrderNum);
                if (existing) continue;

                const isDelivery = (i % 5 === 0 || i % 5 === 2);
                const orderType = isDelivery ? 'DELIVERY_ORDER' : 'POS_WALKIN';
                
                const p1 = products[(i + d.daysAgo * 3) % products.length];
                const p2 = products[(i * 2 + 1) % products.length];
                const qty1 = (i % 4) + 1;
                const qty2 = ((i + 1) % 3) + 1;

                const subtotal = (p1.selling_price * qty1) + (p2.selling_price * qty2);
                const tax = Math.round(subtotal * 0.16 * 100) / 100;
                const total = subtotal + tax;

                let status = 'COMPLETED';
                let deliveryStatus = 'DELIVERED';
                let failReason = null;
                let failNotes = null;
                let paymentStatus = 'PAID';

                if (d.daysAgo === 0) {
                    if (i % 4 === 0) {
                        status = 'READY_FOR_DISPATCH';
                        deliveryStatus = 'READY_FOR_DISPATCH';
                        paymentStatus = isDelivery ? 'UNPAID' : 'PAID';
                    } else if (i % 4 === 1) {
                        status = 'DISPATCHED';
                        deliveryStatus = 'IN_TRANSIT';
                        paymentStatus = isDelivery ? 'UNPAID' : 'PAID';
                    } else if (i % 4 === 2) {
                        status = 'DELIVERED';
                        deliveryStatus = 'DELIVERED';
                        paymentStatus = 'PAID';
                    }
                } else if (d.daysAgo <= 4 && (i === 0 || i === 3)) {
                    status = 'CANCELLED';
                    deliveryStatus = 'FAILED';
                    failReason = failureReasons[(d.daysAgo + b.branchId + i) % failureReasons.length];
                    failNotes = 'Delivery unfulfillable: ' + failReason;
                    paymentStatus = 'UNPAID';
                }

                if (isDelivery && !paymentStatus) {
                    paymentStatus = (i % 3 === 0) ? 'UNPAID' : 'PAID';
                }

                const custId = customers[(i + b.branchId) % customers.length]?.id || 1;

                db.prepare(`
                    INSERT INTO orders (
                        id, branch_id, order_number, customer_id, cashier_user_id, order_type,
                        status, subtotal, discount_amount, tax_amount, total_amount, payment_status,
                        delivery_required, delivery_address, delivery_city, recipient_name, recipient_phone,
                        created_at, updated_at
                    ) VALUES (
                        ?, ?, ?, ?, ?, ?,
                        ?, ?, 0.0, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        datetime('now', ?), datetime('now', ?)
                    )
                `).run(
                    orderIndex, b.branchId, currentOrderNum, custId, b.cashierId, orderType,
                    status, subtotal, tax, total, paymentStatus,
                    isDelivery ? 1 : 0, isDelivery ? 'Commercial District Block ' + (i + 1) : null,
                    b.branchId === 1 ? 'Nairobi' : (b.branchId === 2 ? 'Mombasa' : 'Kisumu'),
                    'Client Contact ' + (i + 1), '+254 700 ' + String(100000 + i),
                    dateOffsetStr, dateOffsetStr
                );

                db.prepare(`
                    INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount_amount, tax_rate, tax_amount, total_price)
                    VALUES (?, ?, ?, ?, 0, 16.0, ?, ?),
                           (?, ?, ?, ?, 0, 16.0, ?, ?)
                `).run(
                    orderIndex, p1.id, qty1, p1.selling_price, Math.round(p1.selling_price * qty1 * 0.16), p1.selling_price * qty1,
                    orderIndex, p2.id, qty2, p2.selling_price, Math.round(p2.selling_price * qty2 * 0.16), p2.selling_price * qty2
                );

                if (paymentStatus === 'PAID') {
                    const saleNum = `SALE-SIM-${b.branchId}-${d.daysAgo}-${i + 1}`;
                    db.prepare(`
                        INSERT INTO sales (
                            id, branch_id, order_id, sale_number, cashier_user_id, customer_id,
                            subtotal, discount_amount, tax_amount, total_amount, payment_status,
                            receipt_printed_at, created_at
                        ) VALUES (
                            ?, ?, ?, ?, ?, ?,
                            ?, 0.0, ?, ?, 'PAID',
                            datetime('now', ?), datetime('now', ?)
                        )
                    `).run(
                        saleIndex, b.branchId, orderIndex, saleNum, b.cashierId, custId,
                        subtotal, tax, total,
                        dateOffsetStr, dateOffsetStr
                    );

                    const payMethod = (i % 3 === 0) ? 'MPESA' : ((i % 3 === 1) ? 'CASH' : 'CARD');
                    db.prepare(`
                        INSERT INTO payments (
                            id, branch_id, sale_id, order_id, payment_number, payment_method,
                            amount, currency, reference_code, status, cashier_user_id, created_at
                        ) VALUES (
                            ?, ?, ?, ?, ?, ?,
                            ?, 'KES', ?, 'COMPLETED', ?, datetime('now', ?)
                        )
                    `).run(
                        payIndex, b.branchId, saleIndex, orderIndex, `PAY-SIM-${saleIndex}`, payMethod,
                        total, 'REF-' + (800000 + payIndex), b.cashierId, dateOffsetStr
                    );
                    payIndex++;
                    saleIndex++;
                }

                if (isDelivery) {
                    const delNum = `DEL-SIM-${b.branchId}-${d.daysAgo}-${i + 1}`;
                    db.prepare(`
                        INSERT INTO deliveries (
                            id, branch_id, delivery_number, order_id, driver_id, vehicle_id,
                            dispatcher_user_id, status, priority,
                            scheduled_pickup_at, estimated_delivery_at, actual_delivery_at,
                            failure_reason, failure_notes, created_at, updated_at
                        ) VALUES (
                            ?, ?, ?, ?, ?, ?,
                            ?, ?, ?,
                            datetime('now', ?), datetime('now', ?), ?,
                            ?, ?, datetime('now', ?), datetime('now', ?)
                        )
                    `).run(
                        delIndex, b.branchId, delNum, orderIndex, b.defaultDriverId, b.vehicleId,
                        b.dispatcherId, deliveryStatus, (i % 3 === 0 ? 'HIGH' : 'NORMAL'),
                        dateOffsetStr, dateOffsetStr, deliveryStatus === 'DELIVERED' ? new Date().toISOString() : null,
                        failReason, failNotes, dateOffsetStr, dateOffsetStr
                    );

                    db.prepare(`
                        INSERT INTO delivery_items (delivery_id, order_item_id, product_id, quantity)
                        VALUES (?, 1, ?, ?)
                    `).run(delIndex, p1.id, qty1);

                    delIndex++;
                }

                orderIndex++;
            }
        }
    }

    console.log('✅ [Demo] Operational visual analytics telemetry populated successfully.');
}

/**
 * Full Seed: Runs production bootstrap followed by demo simulation.
 */
function runSeed() {
    initProductionBootstrap();
    seedDemoSimulation();
}

/**
 * Clean Database Reset:
 * Automatically creates a snapshot backup first, clears existing tables,
 * and re-seeds cleanly with either production master data or demo simulation.
 */
function resetDatabase(isProd = false) {
    console.log('[Reset] Creating pre-reset snapshot backup...');
    const { createBackup } = require('./backup.js');
    try {
        createBackup();
    } catch (e) {
        console.warn('[Reset] Pre-reset backup warning:', e.message);
    }

    console.log('[Reset] Clearing database tables and triggers...');
    db.exec('PRAGMA foreign_keys = OFF;');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    for (const t of tables) {
        db.exec(`DROP TABLE IF EXISTS ${t.name};`);
    }
    const triggers = db.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all();
    for (const tr of triggers) {
        db.exec(`DROP TRIGGER IF EXISTS ${tr.name};`);
    }
    db.exec('PRAGMA foreign_keys = ON;');

    initSchema();
    if (isProd) {
        initProductionBootstrap();
        console.log('[Reset] Clean enterprise production bootstrap complete. Zero mock orders/sales.');
    } else {
        runSeed();
        console.log('[Reset] Demo simulation database reset complete.');
    }
}

if (require.main === module) {
    try {
        const isClean = process.argv.includes('--clean') || process.argv.includes('--reset');
        const isProd = process.argv.includes('--prod');

        if (isClean) {
            resetDatabase(isProd);
        } else if (isProd) {
            initProductionBootstrap();
        } else {
            runSeed();
        }
    } catch (err) {
        console.error('[Seed Error]:', err);
        process.exit(1);
    }
}

module.exports = {
    initProductionBootstrap,
    seedDemoSimulation,
    resetDatabase,
    runSeed,
    ensureRichChartTelemetry,
    seedAllBranchesDemoData,
    hashPassword
};
