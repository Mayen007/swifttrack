// server/services/shipmentService.js
// SwiftTrack Logistics: Stage 2 Shipment Core Domain Service & State Machine
const crypto = require('node:crypto');
const { db } = require('../db/database.js');
const shipmentPricingService = require('./shipmentPricingService.js');
const { logAuditEvent } = require('../middleware/audit.js');
const notificationService = require('./notificationService.js');

const SHIPMENT_STATUSES = {
    DRAFT: 'DRAFT',
    BOOKED: 'BOOKED',
    PAYMENT_PENDING: 'PAYMENT_PENDING',
    PAID: 'PAID',
    ACCEPTED: 'ACCEPTED',
    AT_ORIGIN_HUB: 'AT_ORIGIN_HUB',
    SORTED: 'SORTED',
    READY_FOR_DISPATCH: 'READY_FOR_DISPATCH',
    LOADED: 'LOADED',
    IN_TRANSIT: 'IN_TRANSIT',
    AT_HUB: 'AT_HUB',
    READY_FOR_DELIVERY: 'READY_FOR_DELIVERY',
    READY_FOR_PICKUP: 'READY_FOR_PICKUP',
    OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
    DELIVERED: 'DELIVERED',
    FAILED_DELIVERY: 'FAILED_DELIVERY',
    DELIVERY_FAILED: 'DELIVERY_FAILED',
    RETURN_TO_HUB: 'RETURN_TO_HUB',
    RETURNED: 'RETURNED',
    ON_HOLD: 'ON_HOLD',
    EXCEPTION: 'EXCEPTION',
    CANCELLED: 'CANCELLED'
};

const ALLOWED_TRANSITIONS = {
    DRAFT: ['BOOKED', 'CANCELLED'],
    BOOKED: ['PAID', 'PAYMENT_PENDING', 'ACCEPTED', 'AT_ORIGIN_HUB', 'SORTED', 'READY_FOR_DISPATCH', 'LOADED', 'READY_FOR_DELIVERY', 'CANCELLED'],
    PAYMENT_PENDING: ['PAID', 'ACCEPTED', 'AT_ORIGIN_HUB', 'CANCELLED'],
    PAID: ['ACCEPTED', 'AT_ORIGIN_HUB', 'CANCELLED'],
    ACCEPTED: ['AT_ORIGIN_HUB', 'SORTED', 'READY_FOR_DISPATCH', 'LOADED', 'READY_FOR_DELIVERY', 'CANCELLED'],
    AT_ORIGIN_HUB: ['SORTED', 'READY_FOR_DISPATCH', 'LOADED', 'READY_FOR_DELIVERY', 'ON_HOLD', 'EXCEPTION'],
    SORTED: ['READY_FOR_DISPATCH', 'LOADED', 'READY_FOR_DELIVERY', 'ON_HOLD', 'EXCEPTION'],
    READY_FOR_DISPATCH: ['LOADED', 'ON_HOLD', 'EXCEPTION'],
    LOADED: ['IN_TRANSIT', 'READY_FOR_DISPATCH', 'EXCEPTION'],
    IN_TRANSIT: ['AT_HUB', 'EXCEPTION'],
    AT_HUB: ['SORTED', 'READY_FOR_DISPATCH', 'LOADED', 'READY_FOR_DELIVERY', 'READY_FOR_PICKUP', 'ON_HOLD', 'EXCEPTION'],
    READY_FOR_DELIVERY: ['OUT_FOR_DELIVERY', 'FAILED_DELIVERY', 'DELIVERY_FAILED', 'RETURN_TO_HUB', 'ON_HOLD', 'EXCEPTION', 'CANCELLED'],
    OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED_DELIVERY', 'DELIVERY_FAILED', 'RETURN_TO_HUB', 'EXCEPTION'],
    FAILED_DELIVERY: ['READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'RETURN_TO_HUB', 'RETURNED', 'EXCEPTION'],
    DELIVERY_FAILED: ['READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'RETURN_TO_HUB', 'RETURNED', 'EXCEPTION'],
    READY_FOR_PICKUP: ['DELIVERED', 'RETURN_TO_HUB', 'EXCEPTION'],
    RETURN_TO_HUB: ['RETURNED', 'READY_FOR_DELIVERY', 'AT_HUB', 'EXCEPTION'],
    ON_HOLD: ['BOOKED', 'ACCEPTED', 'AT_ORIGIN_HUB', 'SORTED', 'READY_FOR_DISPATCH', 'LOADED', 'IN_TRANSIT', 'READY_FOR_DELIVERY', 'CANCELLED'],
    EXCEPTION: ['AT_ORIGIN_HUB', 'AT_HUB', 'SORTED', 'READY_FOR_DISPATCH', 'LOADED', 'IN_TRANSIT', 'READY_FOR_DELIVERY', 'RETURN_TO_HUB', 'CANCELLED'],
    DELIVERED: [],
    RETURNED: [],
    CANCELLED: []
};

/**
 * Generates globally unique tracking number format: STK-YYYYMMDD-XXXX
 */
function generateTrackingNumber() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const datePrefix = `${y}${m}${d}`;

    for (let attempts = 0; attempts < 10; attempts++) {
        const rand = crypto.randomBytes(2).toString('hex').toUpperCase(); // 4 chars
        const candidate = `STK-${datePrefix}-${rand}`;
        const existing = db.prepare('SELECT id FROM shipments WHERE tracking_number = ?').get(candidate);
        if (!existing) {
            return candidate;
        }
    }
    // Fallback timestamp if random collisions occur
    return `STK-${datePrefix}-${Date.now().toString().slice(-4)}`;
}

/**
 * Creates a new shipment booking with parcels and default routing leg atomically
 */
function createShipment(data, user = {}) {
    if (!data.origin_hub_id) {
        throw new Error('origin_hub_id is required');
    }
    if (!data.destination_hub_id) {
        throw new Error('destination_hub_id is required');
    }
    if (!data.sender || !data.sender.name || !data.sender.phone || !data.sender.address) {
        throw new Error('Sender name, phone, and address are mandatory');
    }
    if (!data.recipient || !data.recipient.name || !data.recipient.phone || !data.recipient.address) {
        throw new Error('Recipient name, phone, and address are mandatory');
    }
    if (!Array.isArray(data.parcels) || data.parcels.length === 0) {
        throw new Error('At least one parcel is required to create a shipment');
    }

    const originHub = db.prepare('SELECT id, name, code, city FROM branches WHERE id = ?').get(data.origin_hub_id);
    if (!originHub) {
        throw new Error(`Origin hub ID ${data.origin_hub_id} not found`);
    }

    const destHub = db.prepare('SELECT id, name, code, city FROM branches WHERE id = ?').get(data.destination_hub_id);
    if (!destHub) {
        throw new Error(`Destination hub ID ${data.destination_hub_id} not found`);
    }

    // Calculate rating & pricing
    const pricing = shipmentPricingService.calculateShipmentQuote({
        originHubId: data.origin_hub_id,
        destinationHubId: data.destination_hub_id,
        serviceType: data.service_type || 'STANDARD',
        parcels: data.parcels,
        codAmount: data.cod_amount || 0,
        declaredValue: data.declared_value || 0,
        discountAmount: data.discount_amount || 0,
        applyTax: data.apply_tax !== false
    });

    const trackingNumber = generateTrackingNumber();
    const waybillNumber = `WB-${trackingNumber.replace('STK-', '')}-${originHub.code}-${destHub.code}`;

    const executeTransaction = db.transaction(() => {
        // 1. Insert Shipment
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

        const initialStatus = SHIPMENT_STATUSES.BOOKED;
        const paymentTerms = data.payment_terms || 'PREPAID';
        const paymentStatus = paymentTerms === 'PREPAID' ? 'PENDING' : 'PENDING';

        const shipmentResult = shipmentStmt.run(
            trackingNumber,
            waybillNumber,
            data.origin_hub_id,
            data.destination_hub_id,
            data.origin_hub_id, // Initially at origin hub
            originHub.name,
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

        const shipmentId = shipmentResult.lastInsertRowid;

        // 2. Insert Parcels
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
                volumetric_weight_kg: p.volumetric_weight_kg,
                package_type: p.package_type || 'BOX'
            });
        });

        // 3. Insert Shipment Routing Leg(s)
        const legStmt = db.prepare(`
            INSERT INTO shipment_legs (
                shipment_id, leg_sequence, origin_hub_id, destination_hub_id, status,
                is_cross_border, border_post_name, customs_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const routingLegs = Array.isArray(data.legs) && data.legs.length > 0 ? data.legs :
                            Array.isArray(data.routing_legs) && data.routing_legs.length > 0 ? data.routing_legs :
                            [{ origin_hub_id: data.origin_hub_id, destination_hub_id: data.destination_hub_id }];

        let firstLegId = null;
        routingLegs.forEach((leg, index) => {
            const isCrossBorder = leg.is_cross_border ? 1 : 0;
            const borderPost = leg.border_post_name || null;
            const customsStatus = leg.customs_status || (isCrossBorder ? 'PENDING_DOCS' : 'NOT_APPLICABLE');
            const lRes = legStmt.run(
                shipmentId,
                index + 1,
                leg.origin_hub_id,
                leg.destination_hub_id,
                'PENDING',
                isCrossBorder,
                borderPost,
                customsStatus
            );
            if (index === 0) firstLegId = lRes.lastInsertRowid;
        });

        // Auto-initialize COD settlement record if positive COD obligation
        if (pricing.cod_amount && pricing.cod_amount > 0) {
            const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            let settlementNum;
            for (let attempts = 0; attempts < 10; attempts++) {
                const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
                const candidate = `COD-${today}-${rand}`;
                const existing = db.prepare('SELECT id FROM cod_settlements WHERE settlement_number = ?').get(candidate);
                if (!existing) {
                    settlementNum = candidate;
                    break;
                }
            }
            if (!settlementNum) {
                settlementNum = `COD-${today}-${Date.now().toString(36).toUpperCase()}`;
            }
            db.prepare(`
                INSERT INTO cod_settlements (
                    settlement_number, shipment_id, hub_id,
                    expected_amount, collected_amount, remitted_amount, variance_amount,
                    currency, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, 0.0, 0.0, 0.0, ?, 'PENDING_COLLECTION', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).run(
                settlementNum,
                shipmentId,
                data.destination_hub_id,
                pricing.cod_amount,
                pricing.currency || 'KES'
            );
        }

        // 4. Insert Initial Booking Tracking Event
        const eventStmt = db.prepare(`
            INSERT INTO tracking_events (
                shipment_id, leg_id, event_code, event_name,
                hub_id, location_desc, actor_id, actor_type, actor_name,
                description, is_customer_visible, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        eventStmt.run(
            shipmentId,
            firstLegId,
            'BOOKED',
            'Shipment Booked',
            data.origin_hub_id,
            originHub.name,
            user.id || 1,
            user.roleName || 'STAFF',
            user.fullName || user.username || 'System Intake',
            `Shipment created and accepted for routing from ${originHub.name} to ${destHub.name}`,
            1,
            JSON.stringify({ tracking_number: trackingNumber, chargeable_weight_kg: pricing.chargeable_weight_kg })
        );

        // 5. Audit Log
        logAuditEvent({
            userId: user.id || 1,
            role: user.roleName || 'STAFF',
            action: 'CREATE',
            resource: 'SHIPMENT',
            resourceId: String(shipmentId),
            branchId: data.origin_hub_id,
            newValue: { tracking_number: trackingNumber, total_amount: pricing.total_amount },
            reason: 'Counter parcel booking intake'
        });

        const result = {
            id: shipmentId,
            tracking_number: trackingNumber,
            waybill_number: waybillNumber,
            status: initialStatus,
            chargeable_weight_kg: pricing.chargeable_weight_kg,
            total_amount: pricing.total_amount,
            currency: pricing.currency,
            payment_status: paymentStatus,
            origin_hub: originHub.name,
            destination_hub: destHub.name,
            parcels: insertedParcels,
            legs: [{ sequence: 1, origin_hub: originHub.name, destination_hub: destHub.name, status: 'PENDING' }]
        };

        // Asynchronous non-blocking milestone notification (Rule NTF-002)
        notificationService.queueMilestoneNotification('BOOKED', {
            shipment: {
                id: shipmentId,
                tracking_number: trackingNumber,
                recipient_name: data.recipient.name,
                recipient_phone: data.recipient.phone,
                recipient_email: data.recipient.email,
                sender_name: data.sender.name,
                sender_phone: data.sender.phone,
                sender_email: data.sender.email,
                origin_city: originHub.city || originHub.name,
                dest_city: destHub.city || destHub.name
            }
        });

        return result;
    });

    return executeTransaction();
}

/**
 * Lists shipments with multi-axis filtering, search, and branch isolation scoping
 */
function listShipments(filters = {}, user = {}) {
    let query = `
        SELECT s.*,
               orig.name as origin_hub_name, orig.code as origin_hub_code,
               dest.name as destination_hub_name, dest.code as destination_hub_code,
               curr.name as current_hub_name,
               u.full_name as created_by_name
        FROM shipments s
        JOIN branches orig ON s.origin_hub_id = orig.id
        JOIN branches dest ON s.destination_hub_id = dest.id
        LEFT JOIN branches curr ON s.current_hub_id = curr.id
        LEFT JOIN users u ON s.created_by_user_id = u.id
        WHERE 1=1
    `;
    const params = [];

    // Role / Branch Isolation Scoping
    if (user.roleName !== 'SUPER_ADMIN' && user.branchId) {
        query += ` AND (s.origin_hub_id = ? OR s.destination_hub_id = ? OR s.current_hub_id = ?)`;
        params.push(user.branchId, user.branchId, user.branchId);
    } else if (filters.hub_id) {
        query += ` AND (s.origin_hub_id = ? OR s.destination_hub_id = ? OR s.current_hub_id = ?)`;
        params.push(filters.hub_id, filters.hub_id, filters.hub_id);
    }

    if (filters.status) {
        query += ` AND s.status = ?`;
        params.push(filters.status);
    }

    if (filters.service_type) {
        query += ` AND s.service_type = ?`;
        params.push(filters.service_type);
    }

    if (filters.search) {
        const term = `%${filters.search.trim()}%`;
        query += ` AND (
            s.tracking_number LIKE ? OR
            s.waybill_number LIKE ? OR
            s.sender_name LIKE ? OR
            s.sender_phone LIKE ? OR
            s.recipient_name LIKE ? OR
            s.recipient_phone LIKE ?
        )`;
        params.push(term, term, term, term, term, term);
    }

    if (filters.start_date) {
        query += ` AND date(s.created_at) >= date(?)`;
        params.push(filters.start_date);
    }

    if (filters.end_date) {
        query += ` AND date(s.created_at) <= date(?)`;
        params.push(filters.end_date);
    }

    query += ` ORDER BY s.id DESC`;

    const limit = Math.min(Number(filters.limit) || 50, 200);
    const offset = Math.max(0, Number(filters.offset) || 0);

    query += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rows = db.prepare(query).all(...params);

    // Attach parcel summaries
    const parcelStmt = db.prepare('SELECT id, parcel_number, parcel_index, weight_kg, volumetric_weight_kg, package_type FROM parcels WHERE shipment_id = ?');
    return rows.map(r => ({
        ...r,
        parcels: parcelStmt.all(r.id)
    }));
}

/**
 * Retrieves single shipment with parcels, routing legs, and complete event timeline
 */
function getShipmentById(id, user = {}) {
    const shipment = db.prepare(`
        SELECT s.*,
               orig.name as origin_hub_name, orig.code as origin_hub_code, orig.city as origin_city,
               dest.name as destination_hub_name, dest.code as destination_hub_code, dest.city as destination_city,
               curr.name as current_hub_name,
               u.full_name as created_by_name
        FROM shipments s
        JOIN branches orig ON s.origin_hub_id = orig.id
        JOIN branches dest ON s.destination_hub_id = dest.id
        LEFT JOIN branches curr ON s.current_hub_id = curr.id
        LEFT JOIN users u ON s.created_by_user_id = u.id
        WHERE s.id = ?
    `).get(id);

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

    const parcels = db.prepare('SELECT * FROM parcels WHERE shipment_id = ? ORDER BY parcel_index ASC').all(id);
    const legs = db.prepare(`
        SELECT sl.*,
               o.name as origin_hub_name, d.name as destination_hub_name
        FROM shipment_legs sl
        JOIN branches o ON sl.origin_hub_id = o.id
        JOIN branches d ON sl.destination_hub_id = d.id
        WHERE sl.shipment_id = ?
        ORDER BY sl.leg_sequence ASC
    `).all(id);

    const events = db.prepare(`
        SELECT te.*, b.name as hub_name
        FROM tracking_events te
        LEFT JOIN branches b ON te.hub_id = b.id
        WHERE te.shipment_id = ?
        ORDER BY te.id ASC
    `).all(id);

    return {
        ...shipment,
        parcels,
        legs,
        timeline: events.map(e => ({
            ...e,
            metadata: typeof e.metadata === 'string' ? JSON.parse(e.metadata || '{}') : e.metadata
        }))
    };
}

/**
 * Enforces the formal state machine transitions and logs tracking events
 */
function transitionShipmentStatus(id, targetStatus, payload = {}, user = {}) {
    const shipment = db.prepare('SELECT * FROM shipments WHERE id = ?').get(id);
    if (!shipment) {
        const err = new Error('Shipment not found');
        err.statusCode = 404;
        throw err;
    }

    const currentStatus = shipment.status;
    const target = String(targetStatus).toUpperCase();

    if (!SHIPMENT_STATUSES[target]) {
        const err = new Error(`Invalid status '${targetStatus}'. Must be a recognized operational status.`);
        err.statusCode = 400;
        err.code = 'INVALID_STATUS_VALUE';
        throw err;
    }

    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(target)) {
        const err = new Error(
            `Illegal status transition from '${currentStatus}' to '${target}'. Allowed transitions: [${allowed.join(', ') || 'None (Terminal state)'}]`
        );
        err.statusCode = 400;
        err.code = 'INVALID_STATE_TRANSITION';
        throw err;
    }

    // Invariant checks: Failure reason strictly mandatory for failed delivery
    if ((target === 'FAILED_DELIVERY' || target === 'DELIVERY_FAILED') && !payload.reason) {
        const err = new Error('A failure reason is strictly mandatory when recording a failed delivery (BR-008)');
        err.statusCode = 400;
        err.code = 'FAILED_REASON_REQUIRED';
        throw err;
    }

    const hubId = payload.hub_id || shipment.current_hub_id;
    let hubName = shipment.current_location_desc;
    if (payload.hub_id) {
        const hub = db.prepare('SELECT name FROM branches WHERE id = ?').get(payload.hub_id);
        if (hub) hubName = hub.name;
    }
    const locationDesc = payload.location_desc || hubName;

    const executeTransition = db.transaction(() => {
        // Update shipment status
        db.prepare(`
            UPDATE shipments SET
                status = ?,
                current_hub_id = ?,
                current_location_desc = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(target, hubId, locationDesc, id);

        // Record tracking event
        const eventCode = payload.event_code || target;
        const eventName = payload.event_name || (payload.event_code ? payload.event_code.replace(/_/g, ' ') : target.replace(/_/g, ' '));
        const desc = payload.notes || payload.reason || `Status updated from ${currentStatus} to ${target}`;

        const eventRes = db.prepare(`
            INSERT INTO tracking_events (
                shipment_id, event_code, event_name,
                hub_id, location_desc, latitude, longitude,
                actor_id, actor_type, actor_name,
                description, is_customer_visible, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id,
            eventCode,
            eventName,
            hubId,
            locationDesc,
            payload.latitude || null,
            payload.longitude || null,
            user.id || null,
            user.roleName || 'STAFF',
            user.fullName || user.username || 'System Operator',
            desc,
            1,
            JSON.stringify({ previous_status: currentStatus, target_status: target, reason: payload.reason || null })
        );

        // Audit Log
        logAuditEvent({
            userId: user.id || 1,
            role: user.roleName || 'STAFF',
            action: 'UPDATE',
            resource: 'SHIPMENT',
            resourceId: String(id),
            branchId: hubId,
            previousValue: { status: currentStatus },
            newValue: { status: target, reason: payload.reason || null },
            reason: payload.notes || 'Shipment status transition'
        });

        return {
            id,
            tracking_number: shipment.tracking_number,
            previous_status: currentStatus,
            current_status: target,
            event_id: eventRes.lastInsertRowid,
            updated_at: new Date().toISOString()
        };
    });

    const res = executeTransition();

    // Trigger milestone notification on key transitions
    try {
        const fullShipment = db.prepare('SELECT * FROM shipments WHERE id = ?').get(id);
        if (fullShipment && ['ACCEPTED', 'CANCELLED', 'EXCEPTION', 'DELIVERED'].includes(target)) {
            notificationService.queueMilestoneNotification(target, {
                shipment: fullShipment,
                reason: payload.reason || payload.notes
            });
        }
    } catch (e) {
        // Non-blocking
    }

    return res;
}

/**
 * Public, sanitized tracking lookup for customers (No auth required, PII stripped)
 */
function getPublicTracking(trackingNumber) {
    if (!trackingNumber) {
        throw new Error('Tracking number is required');
    }

    const cleanNum = String(trackingNumber).trim().toUpperCase();
    const shipment = db.prepare(`
        SELECT s.id, s.tracking_number, s.status, s.service_type, s.delivery_type,
               s.total_parcels, s.created_at, s.current_location_desc,
               orig.name as origin_hub_name, orig.city as origin_city,
               dest.name as destination_hub_name, dest.city as destination_city
        FROM shipments s
        JOIN branches orig ON s.origin_hub_id = orig.id
        JOIN branches dest ON s.destination_hub_id = dest.id
        WHERE UPPER(s.tracking_number) = ? OR UPPER(s.waybill_number) = ?
    `).get(cleanNum, cleanNum);

    if (!shipment) {
        return null;
    }

    const events = db.prepare(`
        SELECT event_code, event_name, location_desc, description, created_at
        FROM tracking_events
        WHERE shipment_id = ? AND is_customer_visible = 1
        ORDER BY id ASC
    `).all(shipment.id);

    return {
        tracking_number: shipment.tracking_number,
        status: shipment.status,
        service_type: shipment.service_type,
        origin: { city: shipment.origin_city, hub: shipment.origin_hub_name },
        destination: { city: shipment.destination_city, hub: shipment.destination_hub_name },
        current_location: shipment.current_location_desc,
        total_parcels: shipment.total_parcels,
        booked_at: shipment.created_at,
        timeline: events.map(e => ({
            code: e.event_code,
            title: e.event_name,
            location: e.location_desc,
            description: e.description,
            timestamp: e.created_at
        }))
    };
}

/**
 * Retrieves all legs for a shipment ordered by sequence
 */
function getShipmentLegs(shipmentId) {
    return db.prepare(`
        SELECT sl.*,
               o.name as origin_hub_name, o.code as origin_hub_code, o.city as origin_hub_city,
               d.name as destination_hub_name, d.code as destination_hub_code, d.city as destination_hub_city,
               tr.run_number, m.manifest_number
        FROM shipment_legs sl
        JOIN branches o ON sl.origin_hub_id = o.id
        JOIN branches d ON sl.destination_hub_id = d.id
        LEFT JOIN transport_runs tr ON sl.transport_run_id = tr.id
        LEFT JOIN manifests m ON sl.manifest_id = m.id
        WHERE sl.shipment_id = ?
        ORDER BY sl.leg_sequence ASC
    `).all(shipmentId);
}

/**
 * Returns the currently active or pending leg for a shipment
 */
function getActiveLeg(shipmentId) {
    const legs = getShipmentLegs(shipmentId);
    if (!legs || legs.length === 0) return null;
    const inTransit = legs.find(l => l.status === 'IN_TRANSIT');
    if (inTransit) return inTransit;
    const pending = legs.find(l => l.status === 'PENDING' || l.status === 'ACTIVE');
    if (pending) return pending;
    return legs[legs.length - 1] || null;
}

/**
 * Completes a shipment leg and automatically activates the next sequential leg if present.
 * If this was the final leg, the shipment is now at its final destination hub!
 */
function completeLegAndActivateNext(shipmentId, manifestIdOrLegId, arrivalHubId, arrivalHubName, user = {}, metadata = {}) {
    const shipment = db.prepare('SELECT * FROM shipments WHERE id = ?').get(shipmentId);
    if (!shipment) throw new Error(`Shipment ${shipmentId} not found`);

    const legs = db.prepare('SELECT * FROM shipment_legs WHERE shipment_id = ? ORDER BY leg_sequence ASC').all(shipmentId);
    if (legs.length === 0) {
        throw new Error(`No routing legs defined for shipment ${shipmentId}`);
    }

    let completedLeg = legs.find(l => l.manifest_id === manifestIdOrLegId || l.id === manifestIdOrLegId);
    if (!completedLeg) {
        completedLeg = legs.find(l => l.destination_hub_id === arrivalHubId && l.status !== 'COMPLETED');
    }
    if (!completedLeg) {
        completedLeg = legs.find(l => l.status !== 'COMPLETED') || legs[0];
    }

    const executeTx = db.transaction(() => {
        // 1. Mark completed leg as COMPLETED
        db.prepare(`
            UPDATE shipment_legs SET
                status = 'COMPLETED',
                actual_arrival = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(completedLeg.id);

        // 2. Check for next leg
        const nextLeg = legs.find(l => l.leg_sequence === completedLeg.leg_sequence + 1);
        const isFinalLeg = !nextLeg;

        if (nextLeg) {
            // Activate next leg (mark status PENDING/ACTIVE, ready for next corridor transport assignment)
            db.prepare(`
                UPDATE shipment_legs SET
                    status = 'PENDING',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(nextLeg.id);

            // Shipment arrived at an intermediate transit hub
            transitionShipmentStatus(shipmentId, 'AT_HUB', {
                hub_id: arrivalHubId,
                location_desc: arrivalHubName,
                event_code: 'ARRIVED_AT_HUB',
                event_name: 'Arrived at Hub',
                notes: `Arrived at transit hub ${arrivalHubName} (Leg ${completedLeg.leg_sequence} completed). Next leg #${nextLeg.leg_sequence} to Hub #${nextLeg.destination_hub_id} is active.`
            }, user);

            db.prepare(`
                INSERT INTO tracking_events (
                    shipment_id, leg_id, event_code, event_name,
                    hub_id, location_desc, actor_id, actor_type, actor_name,
                    description, is_customer_visible, metadata
                ) VALUES (?, ?, 'TRANSIT_HUB_ARRIVAL', 'Arrived at Transit Hub', ?, ?, ?, 'STAFF', ?, ?, 1, ?)
            `).run(
                shipmentId,
                completedLeg.id,
                arrivalHubId,
                arrivalHubName,
                user.id || 1,
                user.fullName || 'Hub Receiving Staff',
                `Package processed through intermediate transit hub ${arrivalHubName}. Ready for outbound connection.`,
                JSON.stringify({
                    completed_leg_sequence: completedLeg.leg_sequence,
                    next_leg_sequence: nextLeg.leg_sequence,
                    next_destination_hub_id: nextLeg.destination_hub_id,
                    ...metadata
                })
            );

            return {
                shipment_id: shipmentId,
                is_final_leg: false,
                completed_leg: completedLeg,
                next_leg: nextLeg
            };
        } else {
            // Final leg completed! Shipment reached final destination hub
            transitionShipmentStatus(shipmentId, 'AT_HUB', {
                hub_id: arrivalHubId,
                location_desc: arrivalHubName,
                event_code: 'ARRIVED_AT_HUB',
                event_name: 'Arrived at Hub',
                notes: `Arrived at final destination hub ${arrivalHubName}. Ready for last-mile delivery or customer pickup.`
            }, user);

            db.prepare(`
                INSERT INTO tracking_events (
                    shipment_id, leg_id, event_code, event_name,
                    hub_id, location_desc, actor_id, actor_type, actor_name,
                    description, is_customer_visible, metadata
                ) VALUES (?, ?, 'ARRIVED_AT_DESTINATION_HUB', 'Arrived at Destination Hub', ?, ?, ?, 'STAFF', ?, ?, 1, ?)
            `).run(
                shipmentId,
                completedLeg.id,
                arrivalHubId,
                arrivalHubName,
                user.id || 1,
                user.fullName || 'Hub Receiving Staff',
                `Package arrived at final destination hub ${arrivalHubName}. Scheduled for final dispatch.`,
                JSON.stringify({
                    completed_leg_sequence: completedLeg.leg_sequence,
                    final_destination: true,
                    ...metadata
                })
            );

            return {
                shipment_id: shipmentId,
                is_final_leg: true,
                completed_leg: completedLeg,
                next_leg: null
            };
        }
    });

    return executeTx();
}

/**
 * Returns shipments awaiting manifest assignment for a specific hub and corridor
 */
function getShipmentsAwaitingManifest(hubId, destinationHubId = null) {
    let sql = `
        SELECT s.*, sl.id as leg_id, sl.leg_sequence, sl.origin_hub_id as leg_origin, sl.destination_hub_id as leg_destination
        FROM shipments s
        JOIN shipment_legs sl ON sl.shipment_id = s.id
        WHERE sl.origin_hub_id = ?
          AND sl.status IN ('PENDING', 'ACTIVE')
          AND sl.manifest_id IS NULL
          AND s.status IN ('BOOKED', 'ACCEPTED', 'AT_ORIGIN_HUB', 'SORTED', 'READY_FOR_DISPATCH', 'AT_HUB')
    `;
    const params = [hubId];
    if (destinationHubId) {
        sql += ` AND sl.destination_hub_id = ?`;
        params.push(destinationHubId);
    }
    sql += ` ORDER BY s.id ASC`;
    return db.prepare(sql).all(...params);
}

module.exports = {
    SHIPMENT_STATUSES,
    ALLOWED_TRANSITIONS,
    generateTrackingNumber,
    createShipment,
    listShipments,
    getShipmentById,
    transitionShipmentStatus,
    getPublicTracking,
    getShipmentLegs,
    getActiveLeg,
    completeLegAndActivateNext,
    getShipmentsAwaitingManifest
};
