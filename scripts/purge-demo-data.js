// scripts/purge-demo-data.js
// Purges all demo/seed fixtures and resets PostgreSQL to a clean, empty foundation
require('../server/utils/env.js');
const { getPool, closePool } = require('../server/db/postgres/pool.js');
const { withTransaction } = require('../server/db/postgres/transactions.js');
const { hashPassword } = require('../server/utils/security.js');
const { seedPermissionsAndMappings, resetSequence, truncateAllTables } = require('../server/db/postgres/seed.js');

async function purgeDemoData() {
    console.log('============================================================');
    console.log('  SWIFTTRACK: PURGING DEMO & SEED DATA (CLEAN FOUNDATION)');
    console.log('============================================================\n');

    await withTransaction(async (client) => {
        // 1. Cleanly wipe all application tables
        await truncateAllTables(client);

        // 2. Company Settings (Singleton foundation required for system configuration)
        console.log('  -> Initializing clean company settings...');
        await client.query(`
            INSERT INTO company_settings (
                id, company_name, registration_number, kra_pin, vat_rate, currency,
                phone, email, address, city, country, receipt_header, receipt_footer,
                etims_enabled, etims_branch_code
            ) VALUES (
                1, 'SwiftTrack Kenya Logistics Ltd', 'CPR/2021/88921', 'P051234567Z', 16.00, 'KES',
                '+254 700 123 456', 'info@swifttrack.co.ke', 'Enterprise Road, Industrial Area, Plot 42',
                'Nairobi', 'Kenya',
                '*** SWIFTTRACK KENYA LOGISTICS & POS ***\\nYour Trusted Cross-Country Supply Partner',
                'Thank you for partnering with SwiftTrack Kenya!\\neTIMS Certified Tax Invoice\\nGoods once sold subject to return policy.',
                true, '00'
            )
            ON CONFLICT (id) DO UPDATE SET
                company_name = EXCLUDED.company_name;
        `);

        // 3. System Roles
        console.log('  -> Initializing system roles...');
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

        // 4. Canonical Permissions & Role Mappings
        console.log('  -> Initializing RBAC permissions matrix...');
        await seedPermissionsAndMappings(client);

        // 5. Baseline Universal Pricing Tariffs
        console.log('  -> Initializing baseline pricing tariffs (universal fallback)...');
        await client.query(`
            INSERT INTO logistics_pricing_tariffs 
            (origin_hub_id, destination_hub_id, service_type, base_weight_kg, base_price, per_kg_above_base, cod_fee_percent, min_cod_fee, insurance_rate_percent, currency, is_active)
            VALUES 
                (NULL, NULL, 'STANDARD', 5.0, 350.0, 50.0, 2.0, 100.0, 1.0, 'KES', true),
                (NULL, NULL, 'EXPRESS', 5.0, 600.0, 80.0, 2.0, 100.0, 1.0, 'KES', true),
                (NULL, NULL, 'SAME_DAY', 5.0, 850.0, 120.0, 2.0, 100.0, 1.0, 'KES', true)
            ON CONFLICT (origin_hub_id, destination_hub_id, service_type) DO NOTHING;
        `);

        // 6. Standard Logistics Notification Templates
        console.log('  -> Initializing notification templates...');
        const templates = [
            { code: 'SHIPMENT_BOOKED', name: 'Shipment Intake Notification', event: 'SHIPMENT_BOOKED', sms: 'Habari {{recipient_name}}, shipment {{tracking_number}} has been booked by {{sender_name}} to {{destination_city}}. Track online: https://swifttrack.co.ke/t/{{tracking_number}}', wa: 'SwiftTrack Update: Parcel {{tracking_number}} has been booked for delivery to {{recipient_name}}.', sub: 'Shipment Booked: {{tracking_number}}' },
            { code: 'IN_TRANSIT', name: 'Corridor Transit Milestone', event: 'IN_TRANSIT', sms: 'SwiftTrack: Shipment {{tracking_number}} is now in transit from {{origin_city}} to {{destination_city}}.', wa: 'SwiftTrack In-Transit: Parcel {{tracking_number}} dispatched on corridor linehaul.', sub: 'In Transit: {{tracking_number}}' },
            { code: 'OUT_FOR_DELIVERY', name: 'Out For Delivery Alert', event: 'OUT_FOR_DELIVERY', sms: 'SwiftTrack: Shipment {{tracking_number}} is out for delivery with driver {{driver_name}} ({{driver_phone}}). Your delivery verification OTP is {{otp_code}}.', wa: 'SwiftTrack Last-Mile: Driver {{driver_name}} is approaching your address with shipment {{tracking_number}}. OTP: {{otp_code}}', sub: 'Out for Delivery: {{tracking_number}}' },
            { code: 'DELIVERED', name: 'Proof of Delivery Completed', event: 'DELIVERED', sms: 'SwiftTrack: Shipment {{tracking_number}} has been delivered successfully to {{recipient_name}}. Thank you for choosing SwiftTrack Kenya!', wa: 'SwiftTrack Delivered: Parcel {{tracking_number}} delivered. Digital receipt attached.', sub: 'Delivery Complete: {{tracking_number}}' },
            { code: 'EXCEPTION', name: 'Delivery Exception Notice', event: 'EXCEPTION', sms: 'SwiftTrack: Delivery for {{tracking_number}} was rescheduled: {{exception_reason}}. Our team will re-attempt shortly.', wa: 'SwiftTrack Notice: Delivery attempt exception on {{tracking_number}}.', sub: 'Delivery Update: {{tracking_number}}' }
        ];

        for (const t of templates) {
            await client.query(`
                INSERT INTO notification_templates (code, name, event_type, sms_template, whatsapp_template, email_subject, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, true)
                ON CONFLICT (code) DO UPDATE SET
                    name = EXCLUDED.name,
                    sms_template = EXCLUDED.sms_template,
                    whatsapp_template = EXCLUDED.whatsapp_template;
            `, [t.code, t.name, t.event, t.sms, t.wa, t.sub]);
        }

        // 7. Initial Super Administrator Account (for operational user onboarding)
        console.log('  -> Provisioning Super Administrator (superadmin)...');
        const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || 'Password123!';
        const adminHash = hashPassword(adminPassword);
        await client.query(`
            INSERT INTO users (
                id, username, email, password_hash, full_name, phone,
                role_id, branch_id, is_active, must_change_password
            ) VALUES (
                1, 'superadmin', 'admin@swifttrack.co.ke', $1, 'System Administrator', '+254700000000',
                1, NULL, true, false
            )
            ON CONFLICT (id) DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                is_active = true,
                branch_id = NULL;
        `, [adminHash]);

        // 8. Sequence Alignment
        const allSequenceTables = [
            'roles', 'permissions', 'users', 'branches', 'warehouses', 'products',
            'categories', 'brands', 'inventory', 'customers', 'suppliers', 'vehicles',
            'drivers', 'orders', 'sales', 'shipments', 'parcels', 'transport_runs',
            'manifests', 'deliveries', 'payments', 'expenses'
        ];
        for (const tbl of allSequenceTables) {
            await resetSequence(client, tbl);
        }

        console.log('\n============================================================');
        console.log('✅ DEMO DATA PURGE COMPLETE: System reset to clean state.');
        console.log('   - 0 demo shipments, branches, products, or customers');
        console.log('   - Roles and permissions intact (5 Roles, 40 Permissions)');
        console.log('   - Active Administrator: superadmin');
        console.log('============================================================\n');
    });
}

if (require.main === module) {
    purgeDemoData()
        .catch(err => {
            console.error('Fatal error purging demo data:', err);
            process.exit(1);
        })
        .finally(() => closePool());
}

module.exports = { purgeDemoData };
