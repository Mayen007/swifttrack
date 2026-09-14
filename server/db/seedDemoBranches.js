// server/db/seedDemoBranches.js
// Enterprise Multi-Branch Demo Data Seeder for SwiftTrack Kenya
// Seeds rich, authentic operational demo data across all active branches:
// Branch 1: Nairobi Central Hub (NRB-HQ)
// Branch 2: Mombasa Port & Coastal Branch (MSA-01)
// Branch 3: Kisumu Lake Basin Branch (KSM-01)
// Branch 4: Nakuru Depot (NAK1)

const { db } = require('./database.js');
const { hashPassword } = require('../utils/security.js');

function seedAllBranchesDemoData() {
    console.log('================================================================');
    console.log('🚀 SEEDING ENTERPRISE MULTI-BRANCH DEMO DATA ACROSS ALL BRANCHES');
    console.log('================================================================\n');

    // 1. Ensure all 4 branches exist
    const defaultBranches = [
        { id: 1, code: 'NRB-HQ', name: 'Nairobi Central Hub', city: 'Nairobi', address: 'Enterprise Rd, Industrial Area', phone: '+254 711 111 001', email: 'nairobi@swifttrack.co.ke' },
        { id: 2, code: 'MSA-01', name: 'Mombasa Port & Coastal Branch', city: 'Mombasa', address: 'Moi Avenue, Port Reitz Logistics Park', phone: '+254 711 111 002', email: 'mombasa@swifttrack.co.ke' },
        { id: 3, code: 'KSM-01', name: 'Kisumu Lake Basin Branch', city: 'Kisumu', address: 'Oginga Odinga Street, Warehouse Complex', phone: '+254 711 111 003', email: 'kisumu@swifttrack.co.ke' },
        { id: 4, code: 'NAK1', name: 'Nakuru Depot', city: 'Nakuru', address: 'Commercial Street, Nakuru Industrial Area', phone: '+254 711 111 004', email: 'nakuru@swifttrack.co.ke' }
    ];

    for (const b of defaultBranches) {
        const exist = db.prepare('SELECT id FROM branches WHERE id = ?').get(b.id);
        if (!exist) {
            db.prepare(`
                INSERT INTO branches (id, code, name, city, address, phone, email, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            `).run(b.id, b.code, b.name, b.city, b.address, b.phone, b.email);
            console.log(`  ✔ Provisioned branch: ${b.name} (${b.code})`);
        }
    }

    // 2. Ensure warehouses exist for each branch
    const defaultWarehouses = [
        { id: 1, branch_id: 1, code: 'W-NRB-MAIN', name: 'Nairobi Main Distribution Centre', location_desc: 'Block A, Loading Bay 1-4' },
        { id: 2, branch_id: 1, code: 'W-NRB-RET', name: 'Nairobi Retail & Rapid Dispatch Depot', location_desc: 'Front Hub Counter & Bay 5' },
        { id: 3, branch_id: 2, code: 'W-MSA-DEP', name: 'Mombasa Port Transit Warehouse', location_desc: 'Dock 3, Coastal Logistics Hub' },
        { id: 4, branch_id: 3, code: 'W-KSM-DEP', name: 'Kisumu Regional Distribution Depot', location_desc: 'Zone B, Lake Hub' },
        { id: 5, branch_id: 4, code: 'W-NAK1-01', name: 'Nakuru Regional Distribution Depot', location_desc: 'Main Bay 1, Rift Hub' }
    ];

    for (const w of defaultWarehouses) {
        const exist = db.prepare('SELECT id FROM warehouses WHERE id = ?').get(w.id);
        if (!exist) {
            db.prepare(`
                INSERT INTO warehouses (id, branch_id, code, name, location_desc, is_active)
                VALUES (?, ?, ?, ?, ?, 1)
            `).run(w.id, w.branch_id, w.code, w.name, w.location_desc);
            console.log(`  ✔ Provisioned warehouse: ${w.name} (${w.code})`);
        }
    }

    // 3. Ensure branch operational staff (Managers, Cashiers, Dispatchers, Drivers)
    const defaultPassword = 'Password123!';
    const staff = [
        // Nairobi (Branch 1)
        { id: 2, branch_id: 1, role_id: 2, username: 'manager.nairobi', email: 'manager.nairobi@swifttrack.co.ke', full_name: 'David Ochieng (Nairobi Branch Manager)', phone: '+254 722 000 002' },
        { id: 3, branch_id: 1, role_id: 3, username: 'dispatcher.nairobi', email: 'dispatcher.nairobi@swifttrack.co.ke', full_name: 'Faith Wanjiku (Logistics Dispatcher)', phone: '+254 722 000 003' },
        { id: 4, branch_id: 1, role_id: 4, username: 'cashier.nairobi', email: 'cashier.nairobi@swifttrack.co.ke', full_name: 'Kevin Mutua (Senior Cashier)', phone: '+254 722 000 004' },
        { id: 5, branch_id: 1, role_id: 5, username: 'driver.nairobi', email: 'driver.nairobi@swifttrack.co.ke', full_name: 'Joseph Kiprop (Lead Delivery Driver)', phone: '+254 722 000 005' },

        // Mombasa (Branch 2)
        { id: 6, branch_id: 2, role_id: 2, username: 'manager.mombasa', email: 'manager.mombasa@swifttrack.co.ke', full_name: 'Hassan Mwadime (Mombasa Branch Manager)', phone: '+254 722 000 006' },
        { id: 7, branch_id: 2, role_id: 4, username: 'cashier.mombasa', email: 'cashier.mombasa@swifttrack.co.ke', full_name: 'Halima Bakari (Mombasa Cashier)', phone: '+254 722 000 007' },
        { id: 8, branch_id: 2, role_id: 5, username: 'driver.mombasa', email: 'driver.mombasa@swifttrack.co.ke', full_name: 'Ali Omar (Coast Fleet Driver)', phone: '+254 722 000 008' },
        { id: 12, branch_id: 2, role_id: 3, username: 'dispatcher.mombasa', email: 'dispatcher.mombasa@swifttrack.co.ke', full_name: 'Fatuma Athman (Coastal Dispatcher)', phone: '+254 722 000 012' },

        // Kisumu (Branch 3)
        { id: 9, branch_id: 3, role_id: 2, username: 'manager.kisumu', email: 'manager.kisumu@swifttrack.co.ke', full_name: 'Grace Adhiambo (Kisumu Branch Manager)', phone: '+254 722 000 009' },
        { id: 10, branch_id: 3, role_id: 5, username: 'driver.kisumu', email: 'driver.kisumu@swifttrack.co.ke', full_name: 'Francis Omondi (Lake Basin Fleet Driver)', phone: '+254 722 000 010' },
        { id: 13, branch_id: 3, role_id: 4, username: 'cashier.kisumu', email: 'cashier.kisumu@swifttrack.co.ke', full_name: 'Erick Otieno (Lake Basin Cashier)', phone: '+254 722 000 013' },
        { id: 14, branch_id: 3, role_id: 3, username: 'dispatcher.kisumu', email: 'dispatcher.kisumu@swifttrack.co.ke', full_name: 'Mercy Achieng (Kisumu Dispatcher)', phone: '+254 722 000 014' },

        // Nakuru (Branch 4)
        { id: 15, branch_id: 4, role_id: 2, username: 'manager.nakuru', email: 'manager.nakuru@swifttrack.co.ke', full_name: 'Peter Kipkorir (Rift Valley Manager)', phone: '+254 722 000 015' },
        { id: 16, branch_id: 4, role_id: 4, username: 'cashier.nakuru', email: 'cashier.nakuru@swifttrack.co.ke', full_name: 'Caroline Cherono (Nakuru Cashier)', phone: '+254 722 000 016' },
        { id: 17, branch_id: 4, role_id: 3, username: 'dispatcher.nakuru', email: 'dispatcher.nakuru@swifttrack.co.ke', full_name: 'Brian Kiptoo (Nakuru Dispatcher)', phone: '+254 722 000 017' },
        { id: 18, branch_id: 4, role_id: 5, username: 'driver.nakuru', email: 'driver.nakuru@swifttrack.co.ke', full_name: 'Samuel Koech (Fleet Driver)', phone: '+254 722 000 018' }
    ];

    for (const u of staff) {
        const exist = db.prepare('SELECT id FROM users WHERE id = ? OR username = ?').get(u.id, u.username);
        if (!exist) {
            const dynamicHash = hashPassword(defaultPassword);
            db.prepare(`
                INSERT INTO users (id, branch_id, role_id, username, email, full_name, phone, password_hash, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
            `).run(u.id, u.branch_id, u.role_id, u.username, u.email, u.full_name, u.phone, dynamicHash);
            console.log(`  ✔ Provisioned staff user: ${u.username} (${u.full_name})`);
        }
    }

    // 4. Vehicles and Drivers for all branches
    const vehicles = [
        { id: 1, branch_id: 1, reg: 'KMDF 412B', type: 'MOTORCYCLE', model: 'Honda Ace 125 Cargo', cap: 60 },
        { id: 2, branch_id: 1, reg: 'KBZ 891L', type: 'VAN', model: 'Toyota HiAce High-Roof Cargo', cap: 1200 },
        { id: 3, branch_id: 1, reg: 'KDG 554W', type: 'TRUCK', model: 'Isuzu FRR 90 (5-Tonne Cargo)', cap: 5000 },
        { id: 4, branch_id: 2, reg: 'KDM 109Q', type: 'VAN', model: 'Nissan NV350 Commercial Van', cap: 1100 },
        { id: 5, branch_id: 3, reg: 'KDB 782X', type: 'PICKUP', model: 'Toyota Hilux Single-Cab 4WD', cap: 1000 },
        { id: 6, branch_id: 4, reg: 'KDG 430Y', type: 'PICKUP', model: 'Toyota Hilux Double-Cab Cargo', cap: 1000 }
    ];

    for (const v of vehicles) {
        const exist = db.prepare('SELECT id FROM vehicles WHERE id = ? OR registration_number = ?').get(v.id, v.reg);
        if (!exist) {
            db.prepare(`
                INSERT INTO vehicles (id, branch_id, registration_number, vehicle_type, model, max_capacity_kg, is_active)
                VALUES (?, ?, ?, ?, ?, ?, 1)
            `).run(v.id, v.branch_id, v.reg, v.type, v.model, v.cap);
            console.log(`  ✔ Provisioned vehicle: ${v.reg} (${v.model})`);
        }
    }

    const driverProfiles = [
        { id: 1, user_id: 5, branch_id: 1, license: 'DL-NRB-88219', vehicle_id: 2, phone: '+254 722 000 005', status: 'AVAILABLE', lat: -1.3032, lng: 36.8456 },
        { id: 2, user_id: 8, branch_id: 2, license: 'DL-MSA-44102', vehicle_id: 4, phone: '+254 722 000 008', status: 'AVAILABLE', lat: -4.0435, lng: 39.6682 },
        { id: 3, user_id: 10, branch_id: 3, license: 'DL-KSM-99120', vehicle_id: 5, phone: '+254 722 000 010', status: 'AVAILABLE', lat: -0.0917, lng: 34.7680 },
        { id: 4, user_id: 18, branch_id: 4, license: 'DL-NAK-77182', vehicle_id: 6, phone: '+254 722 000 018', status: 'AVAILABLE', lat: -0.3031, lng: 36.0800 }
    ];

    for (const d of driverProfiles) {
        const exist = db.prepare('SELECT id FROM drivers WHERE user_id = ?').get(d.user_id);
        if (!exist) {
            db.prepare(`
                INSERT INTO drivers (id, user_id, branch_id, license_number, vehicle_id, phone, status, current_latitude, current_longitude, last_ping_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).run(d.id, d.user_id, d.branch_id, d.license, d.vehicle_id, d.phone, d.status, d.lat, d.lng);
            console.log(`  ✔ Provisioned driver record for User ID: ${d.user_id} (${d.license})`);
        }
    }

    // 5. Ensure inventory baseline across all warehouses
    const products = db.prepare('SELECT id, category_id, sku, barcode, name, cost_price, selling_price, min_stock_alert FROM products').all();
    const stockDistribution = [
        { warehouse_id: 1, branch_id: 1, factor: 1.5 },
        { warehouse_id: 2, branch_id: 1, factor: 0.8 },
        { warehouse_id: 3, branch_id: 2, factor: 1.1 },
        { warehouse_id: 4, branch_id: 3, factor: 0.9 },
        { warehouse_id: 5, branch_id: 4, factor: 0.7 }
    ];

    let newInventoryCount = 0;
    for (const dist of stockDistribution) {
        for (const p of products) {
            const baseQty = Math.max(15, Math.round(p.min_stock_alert * 3 * dist.factor));
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
                newInventoryCount++;
            }
        }
    }
    if (newInventoryCount > 0) {
        console.log(`  ✔ Provisioned ${newInventoryCount} initial inventory stock items across regional warehouses.`);
    }

    // 6. Regional B2B Customers
    const regionalCustomers = [
        // Nairobi
        { id: 1, branch_id: null, no: 'CUST-0001', name: 'Walk-in Customer (General Counter)', phone: '+254 700 000 000', email: 'walkin@swifttrack.co.ke', address: 'Counter Pickup', city: 'Nairobi', pin: null },
        { id: 2, branch_id: 1, no: 'CUST-0002', name: 'Alpha Apex Corporate Client Ltd', phone: '+254 722 991 122', email: 'cargo@alphaapex.co.ke', address: 'Riverside Drive, Delta Chambers Block C', city: 'Nairobi', pin: 'P059998881A' },
        { id: 3, branch_id: 1, no: 'CUST-0003', name: 'Safaricom Enterprise Operations', phone: '+254 722 110 099', email: 'procurement@safaricom.co.ke', address: 'Waiyaki Way, HQ 2, Westlands', city: 'Nairobi', pin: 'P051000111A' },
        { id: 4, branch_id: 1, no: 'CUST-0004', name: 'Twiga Foods Central Hub', phone: '+254 711 330 088', email: 'logistics@twigafoods.com', address: 'Tatu City Industrial Logistics Park', city: 'Nairobi', pin: 'P051000222B' },
        { id: 5, branch_id: 1, no: 'CUST-0005', name: 'Mama Sarah Hardware & Building Supplies', phone: '+254 723 445 566', email: 'mamasarah.hardware@gmail.com', address: 'Jogoo Road, Next to Posta', city: 'Nairobi', pin: 'A004556677Z' },

        // Mombasa
        { id: 6, branch_id: 2, no: 'CUST-0006', name: 'Mombasa Shipping & Marine Agency Ltd', phone: '+254 733 998 877', email: 'cargo@mombasashipping.co.ke', address: 'Kilindini Port Gate 5', city: 'Mombasa', pin: 'P051998877K' },
        { id: 7, branch_id: 2, no: 'CUST-0007', name: 'Coastal Freight & Logistics Terminal', phone: '+254 733 112 233', email: 'dispatch@coastfreight.co.ke', address: 'Shimanzi Commercial Terminal', city: 'Mombasa', pin: 'P051223344M' },
        { id: 8, branch_id: 2, no: 'CUST-0008', name: 'Bamburi Coastal Hardware Wholesalers', phone: '+254 733 445 566', email: 'orders@bamburihardware.co.ke', address: 'Nyali Links Road', city: 'Mombasa', pin: 'A008877665B' },
        { id: 9, branch_id: 2, no: 'CUST-0009', name: 'Diani Beach Resort Supplies Ltd', phone: '+254 733 778 899', email: 'procurement@dianiresort.co.ke', address: 'Diani Beach Road, Ukunda', city: 'Mombasa', pin: 'P059911223D' },

        // Kisumu
        { id: 10, branch_id: 3, no: 'CUST-0010', name: 'Victoria Marine & Fishery Logistics', phone: '+254 711 887 766', email: 'supplies@victoriamarine.co.ke', address: 'Kisumu Port Pier 2', city: 'Kisumu', pin: 'P051887766V' },
        { id: 11, branch_id: 3, no: 'CUST-0011', name: 'Great Lakes Hardware & Agro Supplies', phone: '+254 711 556 677', email: 'sales@greatlakeshardware.co.ke', address: 'Oginga Odinga Street', city: 'Kisumu', pin: 'P051556677G' },
        { id: 12, branch_id: 3, no: 'CUST-0012', name: 'Equator Beverages Distributorship', phone: '+254 711 223 344', email: 'dispatch@equatorbev.co.ke', address: 'Kisumu Industrial Estate Zone 4', city: 'Kisumu', pin: 'P051223344E' },
        { id: 13, branch_id: 3, no: 'CUST-0013', name: 'Nyanza Regional Medical Supplies', phone: '+254 711 990 011', email: 'medlogistics@nyanzamed.co.ke', address: 'Mega City Complex Wing B', city: 'Kisumu', pin: 'P051990011N' },

        // Nakuru
        { id: 14, branch_id: 4, no: 'CUST-0014', name: 'Rift Valley Farmers Cooperative Union', phone: '+254 722 443 322', email: 'info@rvfarmers.co.ke', address: 'Commercial Street, Nakuru West', city: 'Nakuru', pin: 'P051443322R' },
        { id: 15, branch_id: 4, no: 'CUST-0015', name: 'Menengai Hardware & Building Supplies', phone: '+254 722 667 788', email: 'orders@menengaihardware.co.ke', address: 'George Morara Avenue', city: 'Nakuru', pin: 'A007788990M' },
        { id: 16, branch_id: 4, no: 'CUST-0016', name: 'Crater Logistics & Fleet Spares Ltd', phone: '+254 722 889 900', email: 'fleet@craterlogistics.co.ke', address: 'Nakuru Expressway Junction', city: 'Nakuru', pin: 'P051889900C' }
    ];

    for (const c of regionalCustomers) {
        const exist = db.prepare('SELECT id FROM customers WHERE id = ? OR customer_number = ?').get(c.id, c.no);
        if (!exist) {
            db.prepare(`
                INSERT INTO customers (id, branch_id, customer_number, full_name, phone, email, address, city, kra_pin)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(c.id, c.branch_id, c.no, c.name, c.phone, c.email, c.address, c.city, c.pin);
            console.log(`  ✔ Provisioned customer: ${c.name} (${c.no})`);
        }
    }

    // 7. Seed 14-day Operational Timeline (Orders, Sales, Sale Items, Payments, Deliveries, POD)
    console.log('\n[Demo] Seeding 14-day operational transaction history per branch...');

    const failureReasons = [
        'Customer Phone Unreachable',
        'Incorrect Delivery Address / Geotag',
        'Customer Refused Payment / Postponed to Tomorrow',
        'Premises Gate Access Denied by Security',
        'Severe Road Flooding / Traffic Congestion'
    ];

    // Branch configuration mapping
    const branchConfigs = [
        {
            branchId: 1,
            code: 'NRB',
            cashierId: 4,
            dispatcherId: 3,
            driverId: 1,
            vehicleId: 2,
            city: 'Nairobi',
            customerPool: [1, 2, 3, 4, 5],
            lat: -1.3032,
            lng: 36.8456,
            dailyBase: 12
        },
        {
            branchId: 2,
            code: 'MSA',
            cashierId: 7,
            dispatcherId: 12,
            driverId: 2,
            vehicleId: 4,
            city: 'Mombasa',
            customerPool: [1, 6, 7, 8, 9],
            lat: -4.0435,
            lng: 39.6682,
            dailyBase: 8
        },
        {
            branchId: 3,
            code: 'KSM',
            cashierId: 13,
            dispatcherId: 14,
            driverId: 3,
            vehicleId: 5,
            city: 'Kisumu',
            customerPool: [1, 10, 11, 12, 13],
            lat: -0.0917,
            lng: 34.7680,
            dailyBase: 6
        },
        {
            branchId: 4,
            code: 'NAK',
            cashierId: 16,
            dispatcherId: 17,
            driverId: 4,
            vehicleId: 6,
            city: 'Nakuru',
            customerPool: [1, 14, 15, 16],
            lat: -0.3031,
            lng: 36.0800,
            dailyBase: 4
        }
    ];

    // Generate 14 days of realistic operations
    let totalOrdersCreated = 0;
    let totalSalesCreated = 0;
    let totalDeliveriesCreated = 0;

    for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
        const dateOffsetStr = `-${daysAgo} days`;

        for (const cfg of branchConfigs) {
            // Vary order volume slightly by day
            const dayFactor = (daysAgo % 3 === 0 ? 1.2 : (daysAgo % 2 === 0 ? 0.9 : 1.0));
            const count = Math.max(2, Math.round(cfg.dailyBase * dayFactor));

            for (let i = 0; i < count; i++) {
                const orderNum = `ORD-${cfg.code}-${daysAgo}-${i + 1}`;
                const existingOrder = db.prepare('SELECT id FROM orders WHERE order_number = ?').get(orderNum);
                if (existingOrder) continue;

                const isDelivery = (i % 3 === 0);
                const orderType = isDelivery ? 'DELIVERY_ORDER' : 'POS_WALKIN';

                // Pick 2 products
                const p1 = products[(i * 3 + daysAgo * 2 + cfg.branchId) % products.length];
                const p2 = products[(i * 5 + daysAgo + cfg.branchId * 3) % products.length];
                const qty1 = (i % 3) + 1;
                const qty2 = ((i + 1) % 2) + 1;

                const subtotal = Math.round(((p1.selling_price * qty1) + (p2.selling_price * qty2)) * 100) / 100;
                const tax = Math.round(subtotal * 0.16 * 100) / 100;
                const total = Math.round((subtotal + tax) * 100) / 100;

                let orderStatus = 'COMPLETED';
                let deliveryStatus = 'DELIVERED';
                let paymentStatus = 'PAID';
                let failReason = null;
                let failNotes = null;

                if (daysAgo === 0) {
                    // Today's active pipeline
                    if (isDelivery) {
                        if (i === 0) {
                            orderStatus = 'READY_FOR_DISPATCH';
                            deliveryStatus = 'READY_FOR_DISPATCH';
                            paymentStatus = 'UNPAID';
                        } else if (i === 3) {
                            orderStatus = 'DISPATCHED';
                            deliveryStatus = 'IN_TRANSIT';
                            paymentStatus = 'PAID';
                        } else {
                            orderStatus = 'COMPLETED';
                            deliveryStatus = 'DELIVERED';
                            paymentStatus = 'PAID';
                        }
                    } else {
                        orderStatus = 'COMPLETED';
                        paymentStatus = 'PAID';
                    }
                } else if (daysAgo >= 1 && daysAgo <= 4 && isDelivery && i === 3) {
                    // Past failed delivery exception
                    orderStatus = 'CANCELLED';
                    deliveryStatus = 'FAILED';
                    paymentStatus = 'UNPAID';
                    failReason = failureReasons[(daysAgo + cfg.branchId + i) % failureReasons.length];
                    failNotes = `Delivery exception recorded: ${failReason}`;
                }

                const custId = cfg.customerPool[(i + daysAgo) % cfg.customerPool.length];
                const cust = regionalCustomers.find(c => c.id === custId) || regionalCustomers[0];

                // Insert order
                const orderInsert = db.prepare(`
                    INSERT INTO orders (
                        branch_id, order_number, customer_id, cashier_user_id, order_type,
                        status, subtotal, discount_amount, tax_amount, total_amount, payment_status,
                        delivery_required, delivery_address, delivery_city, recipient_name, recipient_phone, special_instructions,
                        created_at, updated_at
                    ) VALUES (
                        ?, ?, ?, ?, ?,
                        ?, ?, 0.0, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?,
                        datetime('now', ?), datetime('now', ?)
                    )
                `).run(
                    cfg.branchId, orderNum, custId, cfg.cashierId, orderType,
                    orderStatus, subtotal, tax, total, paymentStatus,
                    isDelivery ? 1 : 0,
                    isDelivery ? `${cust.address}, Gate ${((i % 4) + 1)}` : null,
                    cfg.city,
                    cust.name,
                    cust.phone,
                    isDelivery ? 'Handle with care - fragile packaging verified' : null,
                    dateOffsetStr, dateOffsetStr
                );

                const newOrderId = orderInsert.lastInsertRowid;
                totalOrdersCreated++;

                // Insert order items
                db.prepare(`
                    INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount_amount, tax_rate, tax_amount, total_price)
                    VALUES (?, ?, ?, ?, 0.0, 16.0, ?, ?),
                           (?, ?, ?, ?, 0.0, 16.0, ?, ?)
                `).run(
                    newOrderId, p1.id, qty1, p1.selling_price, Math.round(p1.selling_price * qty1 * 0.16 * 100) / 100, p1.selling_price * qty1,
                    newOrderId, p2.id, qty2, p2.selling_price, Math.round(p2.selling_price * qty2 * 0.16 * 100) / 100, p2.selling_price * qty2
                );

                // Insert Sale and Sale Items if PAID
                if (paymentStatus === 'PAID') {
                    const saleNum = `SALE-${cfg.code}-${daysAgo}-${i + 1}`;
                    const saleInsert = db.prepare(`
                        INSERT INTO sales (
                            branch_id, order_id, sale_number, cashier_user_id, customer_id,
                            subtotal, discount_amount, tax_amount, total_amount, payment_status,
                            receipt_printed_at, created_at
                        ) VALUES (
                            ?, ?, ?, ?, ?,
                            ?, 0.0, ?, ?, 'PAID',
                            datetime('now', ?), datetime('now', ?)
                        )
                    `).run(
                        cfg.branchId, newOrderId, saleNum, cfg.cashierId, custId,
                        subtotal, tax, total,
                        dateOffsetStr, dateOffsetStr
                    );

                    const newSaleId = saleInsert.lastInsertRowid;
                    totalSalesCreated++;

                    // Critical for PnL and COGS calculations!
                    db.prepare(`
                        INSERT INTO sale_items (sale_id, product_id, quantity, unit_cost, unit_price, discount_amount, tax_amount, total_price)
                        VALUES (?, ?, ?, ?, ?, 0.0, ?, ?),
                               (?, ?, ?, ?, ?, 0.0, ?, ?)
                    `).run(
                        newSaleId, p1.id, qty1, p1.cost_price, p1.selling_price, Math.round(p1.selling_price * qty1 * 0.16 * 100) / 100, p1.selling_price * qty1,
                        newSaleId, p2.id, qty2, p2.cost_price, p2.selling_price, Math.round(p2.selling_price * qty2 * 0.16 * 100) / 100, p2.selling_price * qty2
                    );

                    // Insert payment
                    const payMethod = (i % 3 === 0) ? 'MPESA' : ((i % 3 === 1) ? 'CASH' : 'CARD');
                    const mpesaRef = `QKA${Math.floor(1000000 + Math.random() * 9000000)}`;
                    db.prepare(`
                        INSERT INTO payments (
                            branch_id, sale_id, order_id, payment_number, payment_method,
                            amount, currency, reference_code, mpesa_receipt_number, mpesa_phone_number,
                            status, cashier_user_id, created_at
                        ) VALUES (
                            ?, ?, ?, ?, ?,
                            ?, 'KES', ?, ?, ?,
                            'COMPLETED', ?, datetime('now', ?)
                        )
                    `).run(
                        cfg.branchId, newSaleId, newOrderId, `PAY-${cfg.code}-${newSaleId}`, payMethod,
                        total, mpesaRef, (payMethod === 'MPESA' ? mpesaRef : null), (payMethod === 'MPESA' ? cust.phone : null),
                        cfg.cashierId, dateOffsetStr
                    );
                }

                // Insert Delivery if delivery required
                if (isDelivery) {
                    const delNum = `DEL-${cfg.code}-${daysAgo}-${i + 1}`;
                    const assignedDriver = (deliveryStatus === 'READY_FOR_DISPATCH') ? null : cfg.driverId;
                    const assignedVehicle = (deliveryStatus === 'READY_FOR_DISPATCH') ? null : cfg.vehicleId;
                    const actualDelAt = (deliveryStatus === 'DELIVERED') ? new Date(Date.now() - daysAgo * 86400000).toISOString() : null;

                    const delInsert = db.prepare(`
                        INSERT INTO deliveries (
                            branch_id, delivery_number, order_id, driver_id, vehicle_id,
                            dispatcher_user_id, status, priority,
                            scheduled_pickup_at, estimated_delivery_at, actual_delivery_at,
                            failure_reason, failure_notes, created_at, updated_at
                        ) VALUES (
                            ?, ?, ?, ?, ?,
                            ?, ?, ?,
                            datetime('now', ?), datetime('now', ?), ?,
                            ?, ?, datetime('now', ?), datetime('now', ?)
                        )
                    `).run(
                        cfg.branchId, delNum, newOrderId, assignedDriver, assignedVehicle,
                        cfg.dispatcherId, deliveryStatus, (i % 2 === 0 ? 'HIGH' : 'NORMAL'),
                        dateOffsetStr, dateOffsetStr, actualDelAt,
                        failReason, failNotes, dateOffsetStr, dateOffsetStr
                    );

                    const newDelId = delInsert.lastInsertRowid;
                    totalDeliveriesCreated++;

                    // Delivery item
                    db.prepare(`
                        INSERT INTO delivery_items (delivery_id, order_item_id, product_id, quantity)
                        VALUES (?, 1, ?, ?)
                    `).run(newDelId, p1.id, qty1);

                    // Delivery tracking status history
                    if (['ASSIGNED', 'IN_TRANSIT', 'DELIVERED'].includes(deliveryStatus)) {
                        db.prepare(`
                            INSERT INTO delivery_status_history (delivery_id, status, notes, latitude, longitude, updated_by_user_id, created_at)
                            VALUES (?, 'ASSIGNED', 'Assigned to delivery driver', ?, ?, ?, datetime('now', ?)),
                                   (?, 'PICKED_UP', 'Cargo checked and loaded onto vehicle', ?, ?, ?, datetime('now', ?))
                        `).run(
                            newDelId, cfg.lat, cfg.lng, cfg.dispatcherId, dateOffsetStr,
                            newDelId, cfg.lat + 0.005, cfg.lng + 0.005, cfg.driverId, dateOffsetStr
                        );
                    }

                    if (deliveryStatus === 'IN_TRANSIT') {
                        db.prepare(`
                            INSERT INTO delivery_status_history (delivery_id, status, notes, latitude, longitude, updated_by_user_id, created_at)
                            VALUES (?, 'IN_TRANSIT', 'Driver en route to recipient premises', ?, ?, ?, CURRENT_TIMESTAMP)
                        `).run(newDelId, cfg.lat + 0.012, cfg.lng + 0.012, cfg.driverId);
                    }

                    // Proof of delivery for delivered orders
                    if (deliveryStatus === 'DELIVERED') {
                        db.prepare(`
                            INSERT INTO proof_of_delivery (
                                delivery_id, recipient_name, recipient_phone, otp_code, otp_verified,
                                signature_data, latitude, longitude, notes, verified_at
                            ) VALUES (
                                ?, ?, ?, '8842', 1,
                                'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><path d="M10 25 Q 30 5, 50 20 T 90 15" stroke="black" fill="none"/></svg>',
                                ?, ?, 'Delivered in pristine condition and signed by receiver', datetime('now', ?)
                            )
                        `).run(newDelId, cust.name, cust.phone, cfg.lat + 0.015, cfg.lng + 0.015, dateOffsetStr);
                    }
                }
            }
        }
    }

    console.log(`  ✔ Successfully seeded ${totalOrdersCreated} orders, ${totalSalesCreated} sales with COGS line items, and ${totalDeliveriesCreated} deliveries.`);

    // 8. Seed POS Held Sales per branch
    console.log('\n[Demo] Seeding POS held carts per branch...');
    const heldSales = [
        {
            branch_id: 1,
            cashier_id: 4,
            ref: 'HOLD-NRB-401',
            cust_name: 'Walk-in Customer (Fetching cash)',
            phone: '+254 721 999 888',
            cart: '[{"id":1,"name":"Heavy Duty Corrugated Box (Large 60x40x40cm)","sku":"LOG-BX-01","barcode":"890123450001","price":180,"qty":5},{"id":4,"name":"Reinforced Fragile Packaging Tape 48mm x 100m","sku":"LOG-TP-01","barcode":"890123450004","price":290,"qty":2}]',
            subtotal: 1480.0,
            total: 1716.8,
            notes: 'Customer stepped out to M-Pesa agent'
        },
        {
            branch_id: 2,
            cashier_id: 7,
            ref: 'HOLD-MSA-201',
            cust_name: 'Coast Express Cargo Courier',
            phone: '+254 733 444 333',
            cart: '[{"id":3,"name":"Industrial Stretch Film Roll 500mm x 300m","sku":"LOG-FLM-01","barcode":"890123450003","price":1450,"qty":4},{"id":5,"name":"Tamper-Evident Cargo Bolt Seals (Pack of 50)","sku":"LOG-SL-01","barcode":"890123450005","price":2600,"qty":2}]',
            subtotal: 11000.0,
            total: 12760.0,
            notes: 'Verifying purchase order with port supervisor'
        },
        {
            branch_id: 3,
            cashier_id: 13,
            ref: 'HOLD-KSM-301',
            cust_name: 'Lake Basin Solar Contractor',
            phone: '+254 711 665 544',
            cart: '[{"id":11,"name":"Pure Sine Wave Solar Inverter 3.5kVA 24V","sku":"ELE-INV-01","barcode":"890123450011","price":46500,"qty":1},{"id":14,"name":"Fleet Asset Magnetic GPS Tracker (4G LTE)","sku":"ELE-GPS-01","barcode":"890123450014","price":4800,"qty":2}]',
            subtotal: 56100.0,
            total: 65076.0,
            notes: 'Awaiting site manager confirmation via phone'
        },
        {
            branch_id: 4,
            cashier_id: 16,
            ref: 'HOLD-NAK-401',
            cust_name: 'Menengai Builder Wholesaler',
            phone: '+254 722 887 766',
            cart: '[{"id":6,"name":"Bamburi Portland Cement 32.5R (50kg Bag)","sku":"BLD-CMT-01","barcode":"890123450006","price":850,"qty":10},{"id":8,"name":"High Tensile Steel Binding Wire (25kg Roll)","sku":"BLD-ST-01","barcode":"890123450008","price":3850,"qty":2}]',
            subtotal: 16200.0,
            total: 18792.0,
            notes: 'Waiting for pickup truck arrival'
        }
    ];

    for (const h of heldSales) {
        const exist = db.prepare('SELECT id FROM held_sales WHERE hold_reference = ?').get(h.ref);
        if (!exist) {
            db.prepare(`
                INSERT INTO held_sales (branch_id, cashier_user_id, hold_reference, customer_name, customer_phone, cart_data_json, subtotal, total, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(h.branch_id, h.cashier_id, h.ref, h.cust_name, h.phone, h.cart, h.subtotal, h.total, h.notes);
            console.log(`  ✔ Provisioned held cart: ${h.ref} for Branch ${h.branch_id}`);
        }
    }

    // 9. Seed Refund Requests per branch
    console.log('\n[Demo] Seeding refund requests per branch...');
    const demoRefunds = [
        {
            branch_id: 1,
            req_num: 'REF-REQ-NRB-01',
            sale_num_prefix: 'SALE-NRB-1-',
            cashier_id: 4,
            amount: 580.0,
            reason: 'Customer purchased excess 2 rolls of packaging tape, unused packaging condition verified',
            status: 'PENDING_APPROVAL'
        },
        {
            branch_id: 2,
            req_num: 'REF-REQ-MSA-01',
            sale_num_prefix: 'SALE-MSA-1-',
            cashier_id: 7,
            amount: 2900.0,
            reason: 'Port client canceled packaging requirement for shipping container',
            status: 'PENDING_APPROVAL'
        },
        {
            branch_id: 3,
            req_num: 'REF-REQ-KSM-01',
            sale_num_prefix: 'SALE-KSM-1-',
            cashier_id: 13,
            amount: 950.0,
            reason: 'Site safety helmet sizing exchange request',
            status: 'PENDING_APPROVAL'
        },
        {
            branch_id: 4,
            req_num: 'REF-REQ-NAK-01',
            sale_num_prefix: 'SALE-NAK-1-',
            cashier_id: 16,
            amount: 1700.0,
            reason: 'Client reduced bag count on cement order',
            status: 'PENDING_APPROVAL'
        }
    ];

    for (const r of demoRefunds) {
        const exist = db.prepare('SELECT id FROM refund_requests WHERE refund_request_number = ?').get(r.req_num);
        if (!exist) {
            // Find a valid sale for this branch
            const sale = db.prepare('SELECT id FROM sales WHERE branch_id = ? ORDER BY id DESC LIMIT 1').get(r.branch_id);
            if (sale) {
                db.prepare(`
                    INSERT INTO refund_requests (refund_request_number, branch_id, sale_id, cashier_user_id, amount, reason, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(r.req_num, r.branch_id, sale.id, r.cashier_id, r.amount, r.reason, r.status);
                console.log(`  ✔ Provisioned refund request: ${r.req_num} for Branch ${r.branch_id}`);
            }
        }
    }

    // 10. Seed Regional Operating Expenses (Petty Cash & Vouchers)
    console.log('\n[Demo] Seeding realistic regional operating expenses per branch...');
    const demoExpenses = [
        // Nairobi
        { exp_no: 'EXP-NRB-001', branch_id: 1, category: 'FUEL', desc: 'Diesel fuel refill for Fleet Van KBZ 891L', amt: 6500.0, payee: 'Rubis Energy Industrial Area', method: 'MPESA', status: 'APPROVED', user_id: 2, app_user_id: 2 },
        { exp_no: 'EXP-NRB-002', branch_id: 1, category: 'PACKAGING', desc: 'Bulk pallet strapping seals purchase', amt: 4200.0, payee: 'Kenpoly Manufacturers Ltd', method: 'CASH', status: 'APPROVED', user_id: 4, app_user_id: 2 },
        { exp_no: 'EXP-NRB-003', branch_id: 1, category: 'UTILITIES', desc: 'Central Hub 3-phase warehouse power bill', amt: 14800.0, payee: 'Kenya Power & Lighting Co', method: 'BANK_TRANSFER', status: 'APPROVED', user_id: 2, app_user_id: 2 },
        { exp_no: 'EXP-NRB-004', branch_id: 1, category: 'VEHICLE_MAINTENANCE', desc: 'Loading bay hydraulic pallet jack seal replacement', amt: 3900.0, payee: 'Industrial Hydraulic Spares', method: 'CASH', status: 'PENDING_APPROVAL', user_id: 3, app_user_id: null },

        // Mombasa
        { exp_no: 'EXP-MSA-001', branch_id: 2, category: 'OTHER', desc: 'Kilindini Port container handling & gate pass entry', amt: 18500.0, payee: 'Kenya Ports Authority Kilindini', method: 'BANK_TRANSFER', status: 'APPROVED', user_id: 6, app_user_id: 6 },
        { exp_no: 'EXP-MSA-002', branch_id: 2, category: 'FUEL', desc: 'Coastal Delivery Van KDM 109Q Diesel Refill', amt: 7200.0, payee: 'TotalEnergies Moi Avenue', method: 'MPESA', status: 'APPROVED', user_id: 8, app_user_id: 6 },
        { exp_no: 'EXP-MSA-003', branch_id: 2, category: 'VEHICLE_MAINTENANCE', desc: 'Port Transit Warehouse cold-room refrigeration service', amt: 9400.0, payee: 'Coast Cool Systems Ltd', method: 'MPESA', status: 'APPROVED', user_id: 6, app_user_id: 6 },
        { exp_no: 'EXP-MSA-004', branch_id: 2, category: 'PACKAGING', desc: 'Marine cargo export tamper-proof straps', amt: 3500.0, payee: 'Mombasa Marine Supplies', method: 'CASH', status: 'APPROVED', user_id: 7, app_user_id: 6 },
        { exp_no: 'EXP-MSA-005', branch_id: 2, category: 'RENT', desc: 'Warehouse coastal salt fog rustproofing primer', amt: 5400.0, payee: 'Crown Paints Coastal Branch', method: 'MPESA', status: 'PENDING_APPROVAL', user_id: 6, app_user_id: null },

        // Kisumu
        { exp_no: 'EXP-KSM-001', branch_id: 3, category: 'FUEL', desc: 'Lake Basin Fleet Pickup KDB 782X Diesel Refill', amt: 5400.0, payee: 'Shell Oginga Odinga Street', method: 'MPESA', status: 'APPROVED', user_id: 10, app_user_id: 9 },
        { exp_no: 'EXP-KSM-002', branch_id: 3, category: 'UTILITIES', desc: 'Lake Basin Depot power & water utilities', amt: 4600.0, payee: 'Kenya Power & KIWASCO', method: 'MPESA', status: 'APPROVED', user_id: 9, app_user_id: 9 },
        { exp_no: 'EXP-KSM-003', branch_id: 3, category: 'PACKAGING', desc: 'Heavy-duty wooden cargo pallets repair & bracing', amt: 3800.0, payee: 'Lake Timber & Pallets', method: 'CASH', status: 'APPROVED', user_id: 13, app_user_id: 9 },
        { exp_no: 'EXP-KSM-004', branch_id: 3, category: 'OTHER', desc: 'Western regional depot night security services', amt: 6500.0, payee: 'G4S Western Kenya', method: 'BANK_TRANSFER', status: 'APPROVED', user_id: 9, app_user_id: 9 },
        { exp_no: 'EXP-KSM-005', branch_id: 3, category: 'VEHICLE_MAINTENANCE', desc: 'Dispatch office waybill registers & barcode ribbons', amt: 2750.0, payee: 'Lakeside Commercial Printers', method: 'CASH', status: 'PENDING_APPROVAL', user_id: 14, app_user_id: null },

        // Nakuru
        { exp_no: 'EXP-NAK-001', branch_id: 4, category: 'FUEL', desc: 'Depot 3-phase backup generator diesel refill', amt: 4200.0, payee: 'Rubis Nakuru West', method: 'MPESA', status: 'APPROVED', user_id: 15, app_user_id: 15 },
        { exp_no: 'EXP-NAK-002', branch_id: 4, category: 'VEHICLE_MAINTENANCE', desc: 'Fleet Van KDG 430Y periodic engine oil & filter service', amt: 4800.0, payee: 'Nakuru Auto Care Centre', method: 'MPESA', status: 'APPROVED', user_id: 18, app_user_id: 15 },
        { exp_no: 'EXP-NAK-003', branch_id: 4, category: 'OTHER', desc: 'KeNHA axle weighbridge road transit permits', amt: 1800.0, payee: 'KeNHA Nakuru Office', method: 'MPESA', status: 'APPROVED', user_id: 15, app_user_id: 15 },
        { exp_no: 'EXP-NAK-004', branch_id: 4, category: 'UTILITIES', desc: 'Depot cleaning & Menengai dust sanitation supplies', amt: 2500.0, payee: 'CleanCare Nakuru Supplies', method: 'CASH', status: 'PENDING_APPROVAL', user_id: 16, app_user_id: null }
    ];

    for (const e of demoExpenses) {
        const exist = db.prepare('SELECT id FROM expenses WHERE expense_number = ?').get(e.exp_no);
        if (!exist) {
            db.prepare(`
                INSERT INTO expenses (
                    expense_number, branch_id, category, description,
                    amount, payee, payment_method, status,
                    created_by_user_id, approved_by_user_id, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-2 days'))
            `).run(
                e.exp_no, e.branch_id, e.category, e.desc,
                e.amt, e.payee, e.method, e.status,
                e.user_id, e.app_user_id
            );
            console.log(`  ✔ Provisioned expense: ${e.exp_no} (${e.desc} - KES ${e.amt})`);
        }
    }

    // 11. Seed Inter-Branch Stock Transfers
    console.log('\n[Demo] Seeding inter-branch stock transfers...');
    const demoTransfers = [
        {
            num: 'TRF-REG-001',
            src_b: 1, src_w: 1,
            tgt_b: 2, tgt_w: 3,
            status: 'IN_TRANSIT',
            req_by: 6, app_by: 2,
            notes: 'Rapid coastal replenishment for shipping export client',
            items: [
                { prod_id: 3, qty_req: 25, qty_sent: 25, qty_rec: 0 },
                { prod_id: 5, qty_req: 40, qty_sent: 40, qty_rec: 0 }
            ]
        },
        {
            num: 'TRF-REG-002',
            src_b: 1, src_w: 1,
            tgt_b: 3, tgt_w: 4,
            status: 'APPROVED',
            req_by: 9, app_by: 2,
            notes: 'Solar inverters and battery packs for Western rural grid projects',
            items: [
                { prod_id: 11, qty_req: 10, qty_sent: 0, qty_rec: 0 },
                { prod_id: 12, qty_req: 5, qty_sent: 0, qty_rec: 0 }
            ]
        },
        {
            num: 'TRF-REG-003',
            src_b: 1, src_w: 1,
            tgt_b: 4, tgt_w: 5,
            status: 'RECEIVED',
            req_by: 15, app_by: 2, rec_by: 15,
            notes: 'Cement and binding wire transfer to Nakuru depot',
            items: [
                { prod_id: 6, qty_req: 50, qty_sent: 50, qty_rec: 50 },
                { prod_id: 8, qty_req: 15, qty_sent: 15, qty_rec: 15 }
            ]
        }
    ];

    for (const t of demoTransfers) {
        const exist = db.prepare('SELECT id FROM stock_transfers WHERE transfer_number = ?').get(t.num);
        if (!exist) {
            const trfInsert = db.prepare(`
                INSERT INTO stock_transfers (
                    transfer_number, source_branch_id, source_warehouse_id,
                    target_branch_id, target_warehouse_id, status,
                    requested_by_user_id, approved_by_user_id, received_by_user_id, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(t.num, t.src_b, t.src_w, t.tgt_b, t.tgt_w, t.status, t.req_by, t.app_by, t.rec_by || null, t.notes);

            const trfId = trfInsert.lastInsertRowid;
            for (const itm of t.items) {
                db.prepare(`
                    INSERT INTO stock_transfer_items (stock_transfer_id, product_id, quantity_requested, quantity_sent, quantity_received)
                    VALUES (?, ?, ?, ?, ?)
                `).run(trfId, itm.prod_id, itm.qty_req, itm.qty_sent, itm.qty_rec);
            }
            console.log(`  ✔ Provisioned transfer: ${t.num} (${t.status})`);
        }
    }

    // 12. Seed Stock Adjustments
    console.log('\n[Demo] Seeding stock adjustments...');
    const demoAdjustments = [
        { num: 'ADJ-MSA-001', branch_id: 2, warehouse_id: 3, prod_id: 1, type: 'WRITE_OFF', qty: 2, reason: 'Damaged corrugated boxes during container offloading', status: 'APPROVED', user_id: 6, app_id: 6 },
        { num: 'ADJ-KSM-001', branch_id: 3, warehouse_id: 4, prod_id: 16, type: 'ADD', qty: 4, reason: 'Physical cycle count surplus on spring water cartons', status: 'APPROVED', user_id: 9, app_id: 9 },
        { num: 'ADJ-NAK-001', branch_id: 4, warehouse_id: 5, prod_id: 10, type: 'DEDUCT', qty: 1, reason: 'Internal display sample allocation for showroom', status: 'APPROVED', user_id: 15, app_id: 15 }
    ];

    for (const a of demoAdjustments) {
        const exist = db.prepare('SELECT id FROM stock_adjustments WHERE adjustment_number = ?').get(a.num);
        if (!exist) {
            db.prepare(`
                INSERT INTO stock_adjustments (adjustment_number, branch_id, warehouse_id, product_id, adjustment_type, quantity, reason, status, requested_by_user_id, approved_by_user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(a.num, a.branch_id, a.warehouse_id, a.prod_id, a.type, a.qty, a.reason, a.status, a.user_id, a.app_id);
            console.log(`  ✔ Provisioned stock adjustment: ${a.num}`);
        }
    }

    // 13. Seed Contextual Branch Notifications
    console.log('\n[Demo] Seeding contextual branch notifications...');
    const demoNotifications = [
        // Nairobi
        { branch_id: 1, user_id: 2, type: 'LOW_STOCK', title: 'Low Stock Alert', msg: 'Industrial Stretch Film Roll stock has dropped below alert threshold at Nairobi Main.', ref_type: 'INVENTORY', ref_id: '3' },
        { branch_id: 1, user_id: 3, type: 'TRANSFER_REQUEST', title: 'Transfer Dispatched', msg: 'Stock transfer TRF-REG-001 dispatched to Mombasa Port Transit Warehouse.', ref_type: 'TRANSFER', ref_id: '1' },

        // Mombasa
        { branch_id: 2, user_id: 6, type: 'TRANSFER_REQUEST', title: 'Incoming Stock Transfer', msg: 'Transfer TRF-REG-001 (Stretch Film & Seals) is currently in transit from Nairobi.', ref_type: 'TRANSFER', ref_id: '1' },
        { branch_id: 2, user_id: 7, type: 'REFUND_REQUEST', title: 'Refund Review Required', msg: 'Refund request REF-REQ-MSA-01 submitted for KES 2,900.00.', ref_type: 'REFUND', ref_id: '2' },
        { branch_id: 2, user_id: 8, type: 'DELIVERY_ASSIGNED', title: 'Active Port Delivery Assigned', msg: 'Delivery assigned for Mombasa Shipping & Marine Agency at Kilindini Gate 5.', ref_type: 'DELIVERY', ref_id: '5' },

        // Kisumu
        { branch_id: 3, user_id: 9, type: 'TRANSFER_REQUEST', title: 'Transfer Approved', msg: 'Transfer TRF-REG-002 for solar inverters has been approved by Nairobi Hub.', ref_type: 'TRANSFER', ref_id: '2' },
        { branch_id: 3, user_id: 13, type: 'NEW_ORDER', title: 'High Priority Lake Delivery', msg: 'New delivery order prepared for Victoria Marine & Fishery Logistics.', ref_type: 'ORDER', ref_id: '8' },
        { branch_id: 3, user_id: 10, type: 'DELIVERY_ASSIGNED', title: 'Delivery Route Scheduled', msg: 'New delivery run assigned for Kisumu Port Pier 2.', ref_type: 'DELIVERY', ref_id: '9' },

        // Nakuru
        { branch_id: 4, user_id: 15, type: 'TRANSFER_REQUEST', title: 'Transfer Received', msg: 'Stock transfer TRF-REG-003 has been safely received into Nakuru Depot.', ref_type: 'TRANSFER', ref_id: '3' },
        { branch_id: 4, user_id: 16, type: 'NEW_ORDER', title: 'Farmers Co-op Bulk Order', msg: 'Order ORD-NAK-0-1 ready for counter checkout or pickup.', ref_type: 'ORDER', ref_id: '12' }
    ];

    for (const n of demoNotifications) {
        const exist = db.prepare('SELECT id FROM notifications WHERE branch_id = ? AND title = ? AND message = ?').get(n.branch_id, n.title, n.msg);
        if (!exist) {
            db.prepare(`
                INSERT INTO notifications (branch_id, user_id, type, title, message, is_read, reference_type, reference_id)
                VALUES (?, ?, ?, ?, ?, 0, ?, ?)
            `).run(n.branch_id, n.user_id, n.type, n.title, n.msg, n.ref_type, n.ref_id);
        }
    }

    console.log('\n================================================================');
    console.log('✅ ALL EXISTING BRANCHES SUCCESSFULLY POPULATED WITH DEMO DATA!');
    console.log('================================================================\n');
}

if (require.main === module) {
    try {
        seedAllBranchesDemoData();
    } catch (err) {
        console.error('[Seed Error]:', err);
        process.exit(1);
    }
}

module.exports = {
    seedAllBranchesDemoData
};
