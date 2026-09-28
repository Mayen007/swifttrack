// server/services/counterBookingService.js
// SwiftTrack Logistics: Stage 6 POS Counter Booking, Volumetric Rating, Payments & Waybill Generation
const crypto = require('node:crypto');
const { db } = require('../db/database.js');
const shipmentPricingService = require('./shipmentPricingService.js');
const posShiftService = require('./posShiftService.js');
const { logAuditEvent } = require('../middleware/audit.js');

/**
 * Calculates live counter quote with volumetric calculations
 */
function calculateCounterQuote(data) {
    if (!data.origin_hub_id) {
        throw new Error('origin_hub_id is required for quote calculation');
    }
    if (!data.destination_hub_id) {
        throw new Error('destination_hub_id is required for quote calculation');
    }
    if (!Array.isArray(data.parcels) || data.parcels.length === 0) {
        throw new Error('At least one parcel is required for quote calculation');
    }

    const originHub = db.prepare('SELECT id, name, code, city FROM branches WHERE id = ?').get(data.origin_hub_id);
    if (!originHub) throw new Error(`Origin hub ID ${data.origin_hub_id} not found`);

    const destHub = db.prepare('SELECT id, name, code, city FROM branches WHERE id = ?').get(data.destination_hub_id);
    if (!destHub) throw new Error(`Destination hub ID ${data.destination_hub_id} not found`);

    const quote = shipmentPricingService.calculateShipmentQuote({
        originHubId: data.origin_hub_id,
        destinationHubId: data.destination_hub_id,
        serviceType: data.service_type || 'STANDARD',
        parcels: data.parcels,
        codAmount: data.cod_amount || 0,
        declaredValue: data.declared_value || 0,
        discountAmount: data.discount_amount || 0,
        applyTax: data.apply_tax !== false
    });

    return {
        ...quote,
        origin_hub: { id: originHub.id, name: originHub.name, code: originHub.code, city: originHub.city },
        destination_hub: { id: destHub.id, name: destHub.name, code: destHub.code, city: destHub.city }
    };
}

/**
 * Generates unique tracking number format: STK-YYYYMMDD-XXXX
 */
function generateTrackingNumber() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const datePrefix = `${y}${m}${d}`;

    for (let attempts = 0; attempts < 10; attempts++) {
        const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
        const candidate = `STK-${datePrefix}-${rand}`;
        const existing = db.prepare('SELECT id FROM shipments WHERE tracking_number = ?').get(candidate);
        if (!existing) return candidate;
    }
    return `STK-${datePrefix}-${Date.now().toString().slice(-4)}`;
}

/**
 * Executes atomic counter booking, payment processing, shift drawer update, and intake acceptance
 */
function bookCounterShipment(data, user = {}) {
    const originHubId = Number(data.origin_hub_id || user.branchId || 1);
    const destinationHubId = Number(data.destination_hub_id);

    if (!destinationHubId) {
        throw new Error('destination_hub_id is required');
    }
    if (!data.sender || !data.sender.name || !data.sender.phone || !data.sender.address) {
        throw new Error('Sender name, phone, and address are mandatory');
    }
    if (!data.recipient || !data.recipient.name || !data.recipient.phone || !data.recipient.address) {
        throw new Error('Recipient name, phone, and address are mandatory');
    }
    if (!Array.isArray(data.parcels) || data.parcels.length === 0) {
        throw new Error('At least one parcel is required for counter booking');
    }

    const originHub = db.prepare('SELECT id, name, code, city, address, phone FROM branches WHERE id = ?').get(originHubId);
    if (!originHub) throw new Error(`Origin hub ID ${originHubId} not found`);

    const destHub = db.prepare('SELECT id, name, code, city, address, phone FROM branches WHERE id = ?').get(destinationHubId);
    if (!destHub) throw new Error(`Destination hub ID ${destinationHubId} not found`);

    // 1. Shift Verification Guard: Cashier must have an active open shift
    const branchForShift = (user.roleName === 'SUPER_ADMIN' && data.origin_hub_id)
        ? Number(data.origin_hub_id)
        : (user.branchId || originHubId);
    
    let activeShift = posShiftService.getCurrentShift(user.id, branchForShift);
    if (!activeShift) {
        if (user.roleName === 'SUPER_ADMIN') {
            activeShift = posShiftService.openShift({ opening_cash: 5000, notes: 'Super Admin Auto-Open Shift' }, user);
        } else {
            const err = new Error('Cannot process counter booking: No active shift open for this cashier. Please open a shift with starting cash float to begin.');
            err.statusCode = 403;
            err.code = 'NO_ACTIVE_SHIFT';
            throw err;
        }
    }

    // 2. Calculate Rated Pricing Breakdown
    const pricing = shipmentPricingService.calculateShipmentQuote({
        originHubId,
        destinationHubId,
        serviceType: data.service_type || 'STANDARD',
        parcels: data.parcels,
        codAmount: data.cod_amount || 0,
        declaredValue: data.declared_value || 0,
        discountAmount: data.discount_amount || 0,
        applyTax: data.apply_tax !== false
    });

    // 3. Prepare Payment(s) Breakdown
    const totalDue = pricing.total_amount;
    let paymentsList = [];

    if (Array.isArray(data.split_payments) && data.split_payments.length > 0) {
        let splitSum = 0;
        for (const sp of data.split_payments) {
            const amt = Number(sp.amount) || 0;
            if (amt <= 0) throw new Error('Split payment amounts must be greater than zero');
            splitSum += amt;
            paymentsList.push({
                method: String(sp.method || 'CASH').toUpperCase(),
                amount: amt,
                tendered: Number(sp.amount_tendered || amt),
                mpesa_phone: sp.mpesa_phone || null,
                mpesa_receipt: sp.mpesa_receipt || null,
                card_ref: sp.card_ref || null
            });
        }
        if (Math.abs(splitSum - totalDue) > 0.01) {
            throw new Error(`Split payments total (${splitSum}) does not match shipment total (${totalDue})`);
        }
    } else {
        const method = String(data.payment_method || 'CASH').toUpperCase();
        let tendered = Number(data.amount_tendered || totalDue);
        if (method === 'CASH' && tendered < totalDue) {
            throw new Error(`Insufficient cash tendered: ${tendered} < total required: ${totalDue}`);
        }
        paymentsList.push({
            method,
            amount: totalDue,
            tendered,
            mpesa_phone: data.mpesa_phone || null,
            mpesa_receipt: data.mpesa_receipt || null,
            card_ref: data.card_ref || null
        });
    }

    const trackingNumber = generateTrackingNumber();
    const waybillNumber = `WB-${trackingNumber.replace('STK-', '')}-${originHub.code}-${destHub.code}`;

    // Execute atomic booking transaction
    const executeBookingTx = db.transaction(() => {
        // A. Insert Shipment Record (Accepted at Origin Hub)
        const shipmentStmt = db.prepare(`
            INSERT INTO shipments (
                tracking_number, waybill_number,
                origin_hub_id, destination_hub_id, current_hub_id, current_location_desc,
                sender_customer_id, sender_name, sender_phone, sender_email, sender_address, sender_city,
                recipient_customer_id, recipient_name, recipient_phone, recipient_email, recipient_address, recipient_city,
                service_type, delivery_type, status,
                total_parcels, actual_weight_kg, volumetric_weight_kg, chargeable_weight_kg, declared_value,
                currency, base_rate, weight_charge, surcharges, discount_amount, tax_amount, total_amount,
                payment_terms, payment_status, cod_amount, cod_fee,
                special_instructions, created_by_user_id
            ) VALUES (
                ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?
            )
        `);

        const isAccountPayment = paymentsList.some(p => p.method === 'ACCOUNT');
        const paymentTerms = isAccountPayment ? 'ACCOUNT' : 'PREPAID';
        const paymentStatus = isAccountPayment ? 'PENDING' : 'PAID';
        const initialStatus = 'ACCEPTED'; // Direct intake at counter

        const shipmentRes = shipmentStmt.run(
            trackingNumber,
            waybillNumber,
            originHubId,
            destinationHubId,
            originHubId,
            `${originHub.name} Counter`,
            data.sender.customer_id || null,
            data.sender.name,
            data.sender.phone,
            data.sender.email || null,
            data.sender.address,
            data.sender.city || originHub.city,
            data.recipient.customer_id || null,
            data.recipient.name,
            data.recipient.phone,
            data.recipient.email || null,
            data.recipient.address,
            data.recipient.city || destHub.city,
            data.service_type || 'STANDARD',
            data.delivery_type || 'LAST_MILE',
            initialStatus,
            pricing.total_parcels,
            pricing.actual_weight_kg,
            pricing.volumetric_weight_kg,
            pricing.chargeable_weight_kg,
            pricing.declared_value,
            pricing.currency,
            pricing.base_rate,
            pricing.weight_charge,
            pricing.surcharges,
            pricing.discount_amount,
            pricing.tax_amount,
            pricing.total_amount,
            paymentTerms,
            paymentStatus,
            pricing.cod_amount,
            pricing.cod_fee,
            data.special_instructions || null,
            user.id || 1
        );

        const shipmentId = shipmentRes.lastInsertRowid;

        // B. Insert Parcels
        const parcelStmt = db.prepare(`
            INSERT INTO parcels (
                shipment_id, parcel_number, parcel_index,
                weight_kg, length_cm, width_cm, height_cm, volumetric_weight_kg,
                package_type, description, condition_at_intake, intake_notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertedParcels = [];
        pricing.parcels.forEach((p, idx) => {
            const pNum = `${trackingNumber}-P${String(idx + 1).padStart(2, '0')}`;
            const pRes = parcelStmt.run(
                shipmentId,
                pNum,
                idx + 1,
                p.weight_kg,
                p.length_cm || 0,
                p.width_cm || 0,
                p.height_cm || 0,
                p.volumetric_weight_kg || 0,
                p.package_type || 'BOX',
                p.description || null,
                p.condition_at_intake || 'INTACT',
                p.intake_notes || null
            );
            insertedParcels.push({
                id: pRes.lastInsertRowid,
                parcel_number: pNum,
                parcel_index: idx + 1,
                weight_kg: p.weight_kg,
                dimensions: `${p.length_cm || 0}x${p.width_cm || 0}x${p.height_cm || 0} cm`,
                volumetric_weight_kg: p.volumetric_weight_kg,
                package_type: p.package_type || 'BOX',
                description: p.description || null
            });
        });

        // C. Insert Initial Shipment Leg
        const legRes = db.prepare(`
            INSERT INTO shipment_legs (
                shipment_id, leg_sequence, origin_hub_id, destination_hub_id, status
            ) VALUES (?, 1, ?, ?, 'PENDING')
        `).run(shipmentId, originHubId, destinationHubId);

        // D. Insert BOOKED and ACCEPTED Tracking Events
        const eventStmt = db.prepare(`
            INSERT INTO tracking_events (
                shipment_id, leg_id, event_code, event_name,
                hub_id, location_desc, actor_id, actor_type, actor_name,
                description, is_customer_visible, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        // Milestone 1: BOOKED
        eventStmt.run(
            shipmentId,
            legRes.lastInsertRowid,
            'BOOKED',
            'Shipment Booked at Counter',
            originHubId,
            originHub.name,
            user.id || 1,
            user.roleName || 'CASHIER',
            user.fullName || user.username || 'Counter Cashier',
            `Consignment booked at ${originHub.name} counter for routing to ${destHub.name}`,
            1,
            JSON.stringify({ tracking_number: trackingNumber, chargeable_weight_kg: pricing.chargeable_weight_kg })
        );

        // Milestone 2: ACCEPTED
        eventStmt.run(
            shipmentId,
            legRes.lastInsertRowid,
            'ACCEPTED',
            'Accepted at Origin Hub',
            originHubId,
            `${originHub.name} Counter Desk`,
            user.id || 1,
            user.roleName || 'CASHIER',
            user.fullName || user.username || 'Counter Cashier',
            `Physical custody accepted at ${originHub.name} counter intake. Payment verified.`,
            1,
            JSON.stringify({ payment_status: paymentStatus, payment_terms: paymentTerms, total_amount: pricing.total_amount })
        );

        // E. Record Physical Intake Scan in scan_events (Stage 4 chain of custody)
        const intakeScanUuid = crypto.randomUUID();
        db.prepare(`
            INSERT INTO scan_events (
                scan_uuid, barcode, shipment_id, scan_type,
                hub_id, location_desc, device_id, scanned_by_user_id,
                metadata
            ) VALUES (?, ?, ?, 'INTAKE', ?, ?, ?, ?, ?)
        `).run(
            intakeScanUuid,
            trackingNumber,
            shipmentId,
            originHubId,
            `${originHub.name} Counter Intake`,
            data.device_id || 'POS-TERMINAL-01',
            user.id || 1,
            JSON.stringify({ notes: 'Accepted and scanned into hub custody at counter booking', role: user.roleName || 'CASHIER' })
        );

        // F. Insert Payment Ledger Record(s) linked to shipment_id
        const createdPayments = [];
        for (let i = 0; i < paymentsList.length; i++) {
            const p = paymentsList[i];
            const paymentNumber = `PAY-SHP-${Date.now().toString().slice(-6)}-${i + 1}`;
            const refCode = p.card_ref || (p.method === 'MPESA'
                ? (p.mpesa_receipt || `MP-${Date.now().toString().slice(-6)}`)
                : `CSH-${Date.now().toString().slice(-6)}`);

            db.prepare(`
                INSERT INTO payments (
                    branch_id, shipment_id, payment_number, payment_method,
                    amount, currency, reference_code, mpesa_receipt_number, mpesa_phone_number,
                    status, cashier_user_id, notes
                ) VALUES (?, ?, ?, ?, ?, 'KES', ?, ?, ?, 'COMPLETED', ?, ?)
            `).run(
                originHubId,
                shipmentId,
                paymentNumber,
                p.method,
                p.amount,
                refCode,
                p.mpesa_receipt || null,
                p.mpesa_phone || null,
                user.id || 1,
                data.notes || 'POS Counter Parcel Booking Tender'
            );

            createdPayments.push({
                payment_number: paymentNumber,
                payment_method: p.method,
                amount: p.amount,
                reference_code: refCode,
                change: (p.method === 'CASH' && p.tendered > p.amount) ? Number((p.tendered - p.amount).toFixed(2)) : 0
            });
        }

        // G. Update Cashier Shift Totals & Cash Drawer Ledger
        posShiftService.recordSaleInShift(activeShift.id, pricing.total_amount, paymentsList, user);

        // H. Audit Log
        logAuditEvent({
            userId: user.id || 1,
            role: user.roleName || 'CASHIER',
            action: 'CREATE',
            resource: 'SHIPMENT',
            resourceId: String(shipmentId),
            branchId: originHubId,
            newValue: {
                tracking_number: trackingNumber,
                waybill_number: waybillNumber,
                total_amount: pricing.total_amount,
                payment_method: paymentsList.map(p => p.method).join(', ')
            },
            reason: 'Counter parcel booking and payment acceptance'
        });

        // I. Build Complete Waybill Document
        const waybill = buildWaybillDocument({
            shipmentId,
            trackingNumber,
            waybillNumber,
            originHub,
            destHub,
            sender: data.sender,
            recipient: data.recipient,
            serviceType: data.service_type || 'STANDARD',
            deliveryType: data.delivery_type || 'LAST_MILE',
            parcels: insertedParcels,
            pricing,
            paymentStatus,
            payments: createdPayments,
            user,
            createdAt: new Date().toISOString()
        });

        return {
            shipment_id: shipmentId,
            tracking_number: trackingNumber,
            waybill_number: waybillNumber,
            status: initialStatus,
            payment_status: paymentStatus,
            pricing,
            parcels: insertedParcels,
            payments: createdPayments,
            shift_id: activeShift.id,
            waybill
        };
    });

    return executeBookingTx();
}

/**
 * Builds standard structured printable waybill document
 */
function buildWaybillDocument({
    shipmentId,
    trackingNumber,
    waybillNumber,
    originHub,
    destHub,
    sender,
    recipient,
    serviceType,
    deliveryType,
    parcels,
    pricing,
    paymentStatus,
    payments,
    user,
    createdAt
}) {
    return {
        header: {
            title: 'OFFICIAL CONSIGNMENT WAYBILL & RECEIPT',
            carrier: 'SwiftTrack Kenya Logistics Ltd',
            tagline: 'Reliable Regional Parcel Transport & Last-Mile Delivery',
            kra_pin: 'P051988234Z',
            contact: '+254 700 000 000 | support@swifttrack.co.ke'
        },
        waybill_number: waybillNumber,
        tracking_number: trackingNumber,
        barcode_value: trackingNumber,
        booking_date: createdAt || new Date().toISOString(),
        origin: {
            id: originHub.id,
            code: originHub.code,
            name: originHub.name,
            city: originHub.city,
            address: originHub.address || `${originHub.city} Regional Hub`,
            phone: originHub.phone || '+254700000001'
        },
        destination: {
            id: destHub.id,
            code: destHub.code,
            name: destHub.name,
            city: destHub.city,
            address: destHub.address || `${destHub.city} Regional Depot`,
            phone: destHub.phone || '+254700000002'
        },
        shipper: {
            name: sender.name,
            phone: sender.phone,
            email: sender.email || '',
            address: sender.address,
            city: sender.city || originHub.city
        },
        consignee: {
            name: recipient.name,
            phone: recipient.phone,
            email: recipient.email || '',
            address: recipient.address,
            city: recipient.city || destHub.city
        },
        service: {
            service_type: serviceType,
            delivery_type: deliveryType,
            status: 'ACCEPTED'
        },
        parcels: parcels.map((p, idx) => ({
            item_no: idx + 1,
            parcel_number: p.parcel_number,
            package_type: p.package_type,
            dimensions: p.dimensions,
            weight_kg: Number(p.weight_kg).toFixed(2),
            volumetric_weight_kg: Number(p.volumetric_weight_kg || 0).toFixed(2),
            description: p.description || 'General Merchandise'
        })),
        totals: {
            total_parcels: pricing.total_parcels,
            actual_weight_kg: Number(pricing.actual_weight_kg).toFixed(2),
            volumetric_weight_kg: Number(pricing.volumetric_weight_kg).toFixed(2),
            chargeable_weight_kg: Number(pricing.chargeable_weight_kg).toFixed(2)
        },
        financials: {
            base_rate: Number(pricing.base_rate).toFixed(2),
            weight_charge: Number(pricing.weight_charge).toFixed(2),
            surcharges: Number(pricing.surcharges).toFixed(2),
            declared_value: Number(pricing.declared_value || 0).toFixed(2),
            cod_amount: Number(pricing.cod_amount || 0).toFixed(2),
            cod_fee: Number(pricing.cod_fee || 0).toFixed(2),
            discount_amount: Number(pricing.discount_amount || 0).toFixed(2),
            tax_amount: Number(pricing.tax_amount).toFixed(2),
            total_amount: Number(pricing.total_amount).toFixed(2),
            currency: pricing.currency || 'KES',
            payment_status: paymentStatus
        },
        payment_receipt: {
            status: paymentStatus,
            payments: payments.map(p => ({
                method: p.payment_method,
                amount: Number(p.amount).toFixed(2),
                reference: p.reference_code,
                change: p.change ? Number(p.change).toFixed(2) : '0.00'
            })),
            cashier_name: user.full_name || user.fullName || user.username || 'Intake Cashier',
            cashier_id: user.id || 1
        },
        terms_and_conditions: 'All shipments carried subject to SwiftTrack Kenya standard conditions of carriage. Liability for loss or damage is limited unless declared value insurance has been purchased.'
    };
}

/**
 * Retrieves full printable waybill document by ID or tracking/waybill number
 */
function getWaybillByIdentifier(identifier, user = {}) {
    if (!identifier) throw new Error('Shipment identifier is required');

    const cleanId = String(identifier).trim();
    let shipment = null;

    if (/^\d+$/.test(cleanId)) {
        shipment = db.prepare('SELECT * FROM shipments WHERE id = ?').get(Number(cleanId));
    }
    if (!shipment) {
        shipment = db.prepare('SELECT * FROM shipments WHERE UPPER(tracking_number) = ? OR UPPER(waybill_number) = ?').get(cleanId.toUpperCase(), cleanId.toUpperCase());
    }

    if (!shipment) return null;

    // Scope check
    if (user.roleName !== 'SUPER_ADMIN' && user.branchId) {
        const inScope = (
            shipment.origin_hub_id === user.branchId ||
            shipment.destination_hub_id === user.branchId ||
            shipment.current_hub_id === user.branchId
        );
        if (!inScope) {
            const err = new Error('Access denied: Shipment is outside your branch operational scope');
            err.statusCode = 403;
            throw err;
        }
    }

    const originHub = db.prepare('SELECT id, name, code, city, address, phone FROM branches WHERE id = ?').get(shipment.origin_hub_id);
    const destHub = db.prepare('SELECT id, name, code, city, address, phone FROM branches WHERE id = ?').get(shipment.destination_hub_id);
    const parcels = db.prepare('SELECT * FROM parcels WHERE shipment_id = ? ORDER BY parcel_index ASC').all(shipment.id);
    const payments = db.prepare('SELECT * FROM payments WHERE shipment_id = ?').all(shipment.id);
    const cashierUser = db.prepare('SELECT id, full_name, username FROM users WHERE id = ?').get(shipment.created_by_user_id) || {};

    const formattedParcels = parcels.map(p => ({
        id: p.id,
        parcel_number: p.parcel_number,
        parcel_index: p.parcel_index,
        weight_kg: p.weight_kg,
        dimensions: `${p.length_cm || 0}x${p.width_cm || 0}x${p.height_cm || 0} cm`,
        volumetric_weight_kg: p.volumetric_weight_kg,
        package_type: p.package_type,
        description: p.description
    }));

    const pricing = {
        total_parcels: shipment.total_parcels,
        actual_weight_kg: shipment.actual_weight_kg,
        volumetric_weight_kg: shipment.volumetric_weight_kg,
        chargeable_weight_kg: shipment.chargeable_weight_kg,
        declared_value: shipment.declared_value,
        currency: shipment.currency,
        base_rate: shipment.base_rate,
        weight_charge: shipment.weight_charge,
        surcharges: shipment.surcharges,
        discount_amount: shipment.discount_amount,
        tax_amount: shipment.tax_amount,
        total_amount: shipment.total_amount,
        cod_amount: shipment.cod_amount,
        cod_fee: shipment.cod_fee
    };

    return buildWaybillDocument({
        shipmentId: shipment.id,
        trackingNumber: shipment.tracking_number,
        waybillNumber: shipment.waybill_number,
        originHub,
        destHub,
        sender: {
            name: shipment.sender_name,
            phone: shipment.sender_phone,
            email: shipment.sender_email,
            address: shipment.sender_address,
            city: shipment.sender_city
        },
        recipient: {
            name: shipment.recipient_name,
            phone: shipment.recipient_phone,
            email: shipment.recipient_email,
            address: shipment.recipient_address,
            city: shipment.recipient_city
        },
        serviceType: shipment.service_type,
        deliveryType: shipment.delivery_type,
        parcels: formattedParcels,
        pricing,
        paymentStatus: shipment.payment_status,
        payments: payments.map(p => ({
            payment_method: p.payment_method,
            amount: p.amount,
            reference_code: p.reference_code,
            change: 0
        })),
        user: cashierUser,
        createdAt: shipment.created_at
    });
}

module.exports = {
    calculateCounterQuote,
    bookCounterShipment,
    getWaybillByIdentifier,
    buildWaybillDocument
};
