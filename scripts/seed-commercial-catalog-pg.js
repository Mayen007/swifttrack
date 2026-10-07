// scripts/seed-commercial-catalog-pg.js
// Populates full 25 commercial catalog products, variants, bulk pricing, branch pricing, and promotions into PostgreSQL
const dbAdapter = require('../server/db/dbAdapter.js');

async function seedCommercialCatalog() {
    console.log('[Catalog Seed] Syncing commercial catalog into PostgreSQL...');

    // 1. Categories
    const categories = [
        { id: 1, code: 'LOG-SUP', name: 'Logistics Packaging & Supplies', description: 'Boxes, strapping, stretch film, security seals, pallets' },
        { id: 2, code: 'BLD-MAT', name: 'Building & Construction Supplies', description: 'Cement bags, fasteners, steel mesh, protective gear' },
        { id: 3, code: 'ELE-ACC', name: 'Electronics & High-Value Cargo', description: 'Inverters, lithium backup batteries, barcode scanners, GPS tags' },
        { id: 4, code: 'FMCG-BEV', name: 'FMCG & Wholesale Beverages', description: 'Bulk cartons, bottled mineral water, non-perishable wholesale' },
        { id: 5, code: 'AUT-PRT', name: 'Automotive & Fleet Spares', description: 'Engine oil 20L drums, heavy-duty truck filters, hydraulic fluids' }
    ];

    for (const c of categories) {
        await dbAdapter.run(`
            INSERT INTO categories (id, code, name, description, is_active)
            VALUES (?, ?, ?, ?, true)
            ON CONFLICT (id) DO UPDATE SET
                code = EXCLUDED.code,
                name = EXCLUDED.name,
                description = EXCLUDED.description
        `, [c.id, c.code, c.name, c.description]);
    }
    console.log('  [OK] Categories synced');

    // 2. Brands
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
        await dbAdapter.run(`
            INSERT INTO brands (id, code, name, description, is_active)
            VALUES (?, ?, ?, ?, true)
            ON CONFLICT (id) DO UPDATE SET
                code = EXCLUDED.code,
                name = EXCLUDED.name,
                description = EXCLUDED.description
        `, [b.id, b.code, b.name, b.description]);
    }
    console.log('  [OK] Brands synced');

    // 3. Suppliers
    const suppliers = [
        { id: 1, code: 'SUP-BAMBURI', name: 'Bamburi Industrial Depot', contact_person: 'David Maina', email: 'orders@bamburi.co.ke', phone: '+254 722 100 001', lead_time_days: 2, payment_terms: 'NET30' },
        { id: 2, code: 'SUP-SWIFTPACK', name: 'SwiftPack Industries Kenya', contact_person: 'Grace Wambui', email: 'sales@swiftpack.co.ke', phone: '+254 722 100 002', lead_time_days: 1, payment_terms: 'NET15' },
        { id: 3, code: 'SUP-SOLARMAX', name: 'SolarMax Technologies East Africa', contact_person: 'Kevin Ochieng', email: 'wholesale@solarmax.ke', phone: '+254 722 100 003', lead_time_days: 4, payment_terms: 'NET45' },
        { id: 4, code: 'SUP-TOTAL', name: 'TotalEnergies Commercial Distribution', contact_person: 'Fatuma Hassan', email: 'logistics@totalenergies.co.ke', phone: '+254 722 100 004', lead_time_days: 3, payment_terms: 'NET30' }
    ];

    for (const s of suppliers) {
        await dbAdapter.run(`
            INSERT INTO suppliers (id, code, name, contact_person, email, phone, lead_time_days, payment_terms, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, true)
            ON CONFLICT (id) DO UPDATE SET
                code = EXCLUDED.code,
                name = EXCLUDED.name,
                contact_person = EXCLUDED.contact_person,
                email = EXCLUDED.email,
                phone = EXCLUDED.phone
        `, [s.id, s.code, s.name, s.contact_person, s.email, s.phone, s.lead_time_days, s.payment_terms]);
    }
    console.log('  [OK] Suppliers synced');

    // 4. Products (1-25)
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
        await dbAdapter.run(`
            INSERT INTO products (
                id, category_id, brand_id, supplier_id, sku, barcode, name, description,
                unit, cost_price, selling_price, wholesale_price, tax_category, min_stock_alert,
                max_stock_alert, reorder_threshold, reorder_quantity, images, is_active, is_archived
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1000, ?, 50, '[]'::jsonb, true, false)
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
                is_archived = false
        `, [
            p.id, p.category_id, p.brand_id, p.supplier_id, p.sku, p.barcode, p.name,
            `${p.name} - Certified Supply`, p.unit, p.cost, p.price, p.wholesale, p.tax, p.min, p.min
        ]);
    }
    console.log('  [OK] Products 1-25 synced');

    // 5. Variants
    const variants = [
        { id: 1, product_id: 1, sku: 'LOG-BX-01-SM', barcode: '890123450101', name: 'Corrugated Box Small 30x20x20cm', size: '30x20x20cm', color: 'Brown Kraft', model: 'Standard Wall', cost: 65.0, price: 95.0, wholesale: 80.0 },
        { id: 2, product_id: 1, sku: 'LOG-BX-01-MD', barcode: '890123450102', name: 'Corrugated Box Medium 40x30x30cm', size: '40x30x30cm', color: 'Brown Kraft', model: 'Double Wall', cost: 90.0, price: 140.0, wholesale: 115.0 },
        { id: 3, product_id: 1, sku: 'LOG-BX-01-LG', barcode: '890123450103', name: 'Corrugated Box Large 60x40x40cm', size: '60x40x40cm', color: 'Brown Kraft', model: 'Triple Heavy Wall', cost: 120.0, price: 180.0, wholesale: 150.0 },
        { id: 4, product_id: 10, sku: 'BLD-SAF-01-YEL', barcode: '890123451001', name: 'Site Helmet Visor Yellow/M', size: 'M (54-58cm)', color: 'High-Vis Yellow', model: 'Pro-Guard V2', cost: 650.0, price: 950.0, wholesale: 800.0 },
        { id: 5, product_id: 10, sku: 'BLD-SAF-01-WHT', barcode: '890123451002', name: 'Site Helmet Visor White/L', size: 'L (58-62cm)', color: 'Engineer White', model: 'Pro-Guard V2', cost: 680.0, price: 980.0, wholesale: 820.0 },
        { id: 6, product_id: 10, sku: 'BLD-SAF-01-BLU', barcode: '890123451003', name: 'Site Helmet Visor Blue/L', size: 'L (58-62cm)', color: 'Safety Blue', model: 'Pro-Guard V2', cost: 680.0, price: 980.0, wholesale: 820.0 }
    ];

    for (const v of variants) {
        await dbAdapter.run(`
            INSERT INTO product_variants (
                id, product_id, variant_sku, variant_barcode, variant_name, size, color, model,
                cost_price_override, selling_price_override, wholesale_price_override, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true)
            ON CONFLICT (id) DO UPDATE SET
                product_id = EXCLUDED.product_id,
                variant_sku = EXCLUDED.variant_sku,
                variant_barcode = EXCLUDED.variant_barcode,
                variant_name = EXCLUDED.variant_name,
                selling_price_override = EXCLUDED.selling_price_override,
                wholesale_price_override = EXCLUDED.wholesale_price_override,
                is_active = true
        `, [v.id, v.product_id, v.sku, v.barcode, v.name, v.size, v.color, v.model, v.cost, v.price, v.wholesale]);
    }
    console.log('  [OK] Product variants synced');

    // 6. Bulk Pricing
    const bulkPricing = [
        { product_id: 1, min_qty: 20, max_qty: 49, unit_price: 165.0, discount: 8.3 },
        { product_id: 1, min_qty: 50, max_qty: 99, unit_price: 150.0, discount: 16.6 },
        { product_id: 1, min_qty: 100, max_qty: null, unit_price: 135.0, discount: 25.0 },
        { product_id: 6, min_qty: 50, max_qty: 99, unit_price: 810.0, discount: 4.7 },
        { product_id: 6, min_qty: 100, max_qty: null, unit_price: 780.0, discount: 8.2 }
    ];

    for (const bp of bulkPricing) {
        await dbAdapter.run(`
            INSERT INTO product_bulk_pricing (product_id, min_quantity, max_quantity, unit_price, discount_percent)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (product_id, variant_id, min_quantity) DO UPDATE SET
                unit_price = EXCLUDED.unit_price,
                discount_percent = EXCLUDED.discount_percent
        `, [bp.product_id, bp.min_qty, bp.max_qty, bp.unit_price, bp.discount]);
    }
    console.log('  [OK] Bulk pricing breaks synced');

    // 7. Branch-Specific Pricing
    const branchPrices = [
        { branch_id: 2, product_id: 6, selling_price: 820.0, wholesale_price: 760.0 },
        { branch_id: 3, product_id: 6, selling_price: 890.0, wholesale_price: 820.0 }
    ];

    for (const bp of branchPrices) {
        await dbAdapter.run(`
            INSERT INTO branch_product_prices (branch_id, product_id, selling_price, wholesale_price)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (branch_id, product_id, variant_id) DO UPDATE SET
                selling_price = EXCLUDED.selling_price,
                wholesale_price = EXCLUDED.wholesale_price
        `, [bp.branch_id, bp.product_id, bp.selling_price, bp.wholesale_price]);
    }
    console.log('  [OK] Branch-specific prices synced');

    // 8. Promotions
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
        await dbAdapter.run(`
            INSERT INTO promotions (
                promo_code, name, description, discount_type, discount_value, scope,
                target_id, min_spend, start_date, end_date, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (promo_code) DO UPDATE SET
                name = EXCLUDED.name,
                discount_type = EXCLUDED.discount_type,
                discount_value = EXCLUDED.discount_value,
                scope = EXCLUDED.scope,
                target_id = EXCLUDED.target_id,
                min_spend = EXCLUDED.min_spend,
                start_date = EXCLUDED.start_date,
                end_date = EXCLUDED.end_date,
                is_active = true
        `, [
            pr.promo_code, pr.name, pr.description, pr.discount_type, pr.discount_value,
            pr.scope, pr.target_id, pr.min_spend, pr.start_date, pr.end_date, pr.is_active
        ]);
    }
    console.log('  [OK] Promotions synced');

    // Reset sequences
    for (const t of ['categories', 'brands', 'suppliers', 'products', 'product_variants', 'product_bulk_pricing', 'branch_product_prices', 'promotions']) {
        try {
            await dbAdapter.run(`
                SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT MAX(id) FROM ${t}), 0) + 1, false)
            `);
        } catch {}
    }

    console.log('[Catalog Seed] Complete!');
    process.exit(0);
}

seedCommercialCatalog().catch(err => {
    console.error('Catalog seed error:', err);
    process.exit(1);
});
