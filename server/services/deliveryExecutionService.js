// server/services/deliveryExecutionService.js
// SwiftTrack Logistics: Stage 5 Last-Mile Delivery, Multi-Attempt & Centralized Exceptions
const dbAdapter = require('../db/dbAdapter.js');
const { logAuditEvent } = require('../middleware/audit.js');
const notificationService = require('./notificationService.js');
const shipmentService = require('./shipmentService.js');

/**
 * Generates human-readable sequential business identifiers
 */
function generateSeqNumber(prefix) {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${today}-${rand}`;
}

// ============================================================================
// 1. DELIVERY TASK CREATION & DISPATCH
// ============================================================================

/**
 * Creates a last-mile delivery task linked to a shipment
 */
async function createDeliveryTask(data, user = {}) {
    if (!data.shipment_id) {
        throw new Error('shipment_id is required to create a delivery task');
    }

    const shipment = await dbAdapter.get(`
        SELECT s.*, dest.name as destination_hub_name, dest.city as destination_city
        FROM shipments s
        JOIN branches dest ON s.destination_hub_id = dest.id
        WHERE s.id = ?
    `, [data.shipment_id]);

    if (!shipment) {
        throw new Error(`Shipment ${data.shipment_id} not found`);
    }

    // Valid shipment statuses for delivery creation
    const validStatuses = ['AT_HUB', 'READY_FOR_DELIVERY', 'READY_FOR_PICKUP', 'BOOKED', 'SORTED'];
    if (!validStatuses.includes(shipment.status)) {
        throw new Error(`Cannot create delivery task for shipment in '${shipment.status}' status. Shipment must be at destination hub.`);
    }

    const deliveryNumber = generateSeqNumber('DEL');
    const branchId = shipment.destination_hub_id || user.branchId || 1;
    const priority = (data.priority || 'NORMAL').toUpperCase();
    const maxAttempts = data.max_attempts ? parseInt(data.max_attempts, 10) : 3;
    const podRequired = Array.isArray(data.pod_required_methods)
        ? data.pod_required_methods.join(',')
        : (data.pod_required_methods || 'SIGNATURE,GPS');
    const podOtp = podRequired.toUpperCase().includes('OTP') ? String(Math.floor(100000 + Math.random() * 900000)) : null;

    return await dbAdapter.withTransaction(async (client) => {
        const info = await dbAdapter.query(`
            INSERT INTO deliveries (
                branch_id, delivery_number, shipment_id, hub_id, delivery_type,
                driver_id, vehicle_id, dispatcher_user_id, status, priority,
                attempt_count, max_attempts, pod_required_methods, pod_otp,
                destination_address, destination_city, recipient_name, recipient_phone,
                cod_amount_expected, cod_amount_collected, scheduled_pickup_at,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'LAST_MILE', ?, ?, ?, 'PENDING_ASSIGNMENT', ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, 0.0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
            branchId,
            deliveryNumber,
            shipment.id,
            branchId,
            data.driver_id || null,
            data.vehicle_id || null,
            user.id || 1,
            priority,
            maxAttempts,
            podRequired,
            podOtp,
            data.destination_address || shipment.recipient_address,
            data.destination_city || shipment.destination_city,
            data.recipient_name || shipment.recipient_name,
            data.recipient_phone || shipment.recipient_phone,
            shipment.cod_amount || 0.0,
            data.scheduled_pickup_at || null
        ], client);

        const deliveryId = info.insertId;

        // Transition shipment status to READY_FOR_DELIVERY via canonical state machine
        await shipmentService.transitionShipmentStatus(shipment.id, 'READY_FOR_DELIVERY', {
            hub_id: branchId,
            location_desc: shipment.destination_hub_name || 'Destination Hub',
            event_code: 'DELIVERY_CREATED',
            event_name: 'Delivery Task Scheduled',
            notes: `Delivery task ${deliveryNumber} created for last-mile destination`
        }, user);

        // Link or initialize COD Settlement if shipment has positive COD obligation
        if (shipment.cod_amount && shipment.cod_amount > 0) {
            const existingSettlement = await dbAdapter.get('SELECT id FROM cod_settlements WHERE shipment_id = ?', [shipment.id], client);
            if (existingSettlement) {
                await dbAdapter.run('UPDATE cod_settlements SET delivery_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [deliveryId, existingSettlement.id], client);
            } else {
                const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                const rand = Math.floor(1000 + Math.random() * 9000);
                const settlementNum = `COD-${today}-${rand}`;
                await dbAdapter.run(`
                    INSERT INTO cod_settlements (
                        settlement_number, shipment_id, delivery_id, hub_id,
                        expected_amount, collected_amount, remitted_amount, variance_amount,
                        currency, status, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, 0.0, 0.0, 0.0, ?, 'PENDING_COLLECTION', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                `, [settlementNum, shipment.id, deliveryId, branchId, shipment.cod_amount, shipment.currency || 'KES'], client);
            }
        }

        return await getDeliveryById(deliveryId, client);
    });
}

/**
 * Assigns a delivery task to a driver and vehicle
 */
async function assignDeliveryTask(deliveryId, { driver_id, vehicle_id }, user = {}) {
    const delivery = await dbAdapter.get('SELECT * FROM deliveries WHERE id = ?', [deliveryId]);
    if (!delivery) throw new Error(`Delivery task ${deliveryId} not found`);

    if (!driver_id) throw new Error('driver_id is required for assignment');

    const driver = await dbAdapter.get('SELECT d.id, u.full_name FROM drivers d JOIN users u ON d.user_id = u.id WHERE d.id = ?', [driver_id]);
    if (!driver) throw new Error(`Driver ${driver_id} not found`);

    return await dbAdapter.withTransaction(async (client) => {
        await dbAdapter.run(`
            UPDATE deliveries
            SET driver_id = ?, vehicle_id = ?, status = 'ASSIGNED', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [driver_id, vehicle_id || null, deliveryId], client);

        if (delivery.shipment_id) {
            await dbAdapter.run(`
                INSERT INTO tracking_events (
                    shipment_id, event_code, event_name,
                    hub_id, location_desc, actor_type, actor_name,
                    description, is_customer_visible, metadata
                ) VALUES (?, 'DELIVERY_ASSIGNED', 'Assigned to Delivery Driver', ?, ?, ?, ?, ?, true, ?)
            `, [
                delivery.shipment_id,
                delivery.hub_id,
                `Hub #${delivery.hub_id}`,
                user.roleName || 'DISPATCHER',
                user.fullName || 'Dispatcher',
                `Assigned to driver ${driver.full_name}`,
                JSON.stringify({ driver_id, vehicle_id, delivery_id: deliveryId })
            ], client);
        }

        return await getDeliveryById(deliveryId, client);
    });
}

/**
 * Driver accepts and starts delivery run
 */
async function startDelivery(deliveryId, user = {}) {
    const delivery = await dbAdapter.get('SELECT * FROM deliveries WHERE id = ?', [deliveryId]);
    if (!delivery) throw new Error(`Delivery task ${deliveryId} not found`);

    let currentOtp = delivery.pod_otp;
    if (delivery.pod_required_methods && delivery.pod_required_methods.toUpperCase().includes('OTP') && !currentOtp) {
        currentOtp = String(Math.floor(100000 + Math.random() * 900000));
    }

    const res = await dbAdapter.withTransaction(async (client) => {
        await dbAdapter.run(`
            UPDATE deliveries
            SET status = 'IN_TRANSIT', pod_otp = COALESCE(pod_otp, ?), updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [currentOtp || null, deliveryId], client);

        if (delivery.shipment_id) {
            // Transition shipment to OUT_FOR_DELIVERY via canonical state machine
            await shipmentService.transitionShipmentStatus(delivery.shipment_id, 'OUT_FOR_DELIVERY', {
                hub_id: delivery.hub_id,
                location_desc: delivery.destination_city || 'Local Delivery Route',
                notes: `Shipment is out for delivery to ${delivery.recipient_name}`
            }, user);
        }

        return await getDeliveryById(deliveryId, client);
    });

    if (delivery.shipment_id) {
        try {
            const shipment = await dbAdapter.get('SELECT * FROM shipments WHERE id = ?', [delivery.shipment_id]);
            await notificationService.queueMilestoneNotification('OUT_FOR_DELIVERY', {
                shipment,
                delivery: res,
                otp_code: res.pod_otp || currentOtp || '123456'
            });
        } catch (e) {
            // Non-blocking
        }
    }

    return res;
}

// ============================================================================
// 2. MULTI-ATTEMPT DELIVERIES & FAILURE WORKFLOWS
// ============================================================================

/**
 * Records a delivery attempt (Rule BR-008: Failed delivery requires a reason)
 */
async function recordDeliveryAttempt(deliveryId, data, user = {}) {
    const delivery = await dbAdapter.get('SELECT * FROM deliveries WHERE id = ?', [deliveryId]);
    if (!delivery) throw new Error(`Delivery task ${deliveryId} not found`);

    const status = (data.status || 'FAILED').toUpperCase();
    if (!['SUCCESS', 'FAILED', 'RESCHEDULED'].includes(status)) {
        throw new Error(`Invalid attempt status: ${status}. Must be SUCCESS, FAILED, or RESCHEDULED.`);
    }

    // BR-008: Failed delivery requires a reason
    if (status === 'FAILED' && !data.failure_reason) {
        throw new Error('Business Rule BR-008 Violation: A failed delivery attempt requires a failure_reason.');
    }

    const nextAttemptNumber = (delivery.attempt_count || 0) + 1;
    const maxAttempts = delivery.max_attempts || 3;

    const res = await dbAdapter.withTransaction(async (client) => {
        // Record attempt
        const info = await dbAdapter.query(`
            INSERT INTO delivery_attempts (
                delivery_id, shipment_id, attempt_number, status,
                failure_reason, failure_notes, driver_id, latitude, longitude,
                rescheduled_for, attempted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
            deliveryId,
            delivery.shipment_id || null,
            nextAttemptNumber,
            status,
            data.failure_reason || null,
            data.failure_notes || null,
            delivery.driver_id || null,
            data.latitude || null,
            data.longitude || null,
            data.rescheduled_for || null
        ], client);

        let createdException = null;

        if (status === 'FAILED') {
            // Check if max attempts reached
            if (nextAttemptNumber >= maxAttempts) {
                // Transition delivery to RETURN_TO_HUB
                await dbAdapter.run(`
                    UPDATE deliveries
                    SET status = 'RETURN_TO_HUB', attempt_count = ?, failure_reason = ?, failure_notes = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [nextAttemptNumber, data.failure_reason, data.failure_notes || null, deliveryId], client);

                if (delivery.shipment_id) {
                    // Update shipment to DELIVERY_FAILED via canonical state machine
                    await shipmentService.transitionShipmentStatus(delivery.shipment_id, 'DELIVERY_FAILED', {
                        hub_id: delivery.hub_id,
                        location_desc: delivery.destination_city || 'Delivery Stop',
                        reason: data.failure_reason,
                        notes: `Delivery unsuccessful after ${nextAttemptNumber} attempts (${data.failure_reason}). Returning to hub.`
                    }, user);

                    // Auto-generate operational exception (Rule EXC-005)
                    createdException = await createExceptionInternal({
                        exception_type: 'DELIVERY_FAILURE',
                        severity: 'HIGH',
                        shipment_id: delivery.shipment_id,
                        delivery_id: deliveryId,
                        hub_id: delivery.hub_id,
                        description: `Delivery failed after ${nextAttemptNumber}/${maxAttempts} attempts. Final reason: ${data.failure_reason}. Notes: ${data.failure_notes || 'None'}`
                    }, user, client);
                }
            } else {
                // Rescheduled for next attempt
                await dbAdapter.run(`
                    UPDATE deliveries
                    SET status = 'RESCHEDULED', attempt_count = ?, failure_reason = ?, failure_notes = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [nextAttemptNumber, data.failure_reason, data.failure_notes || null, deliveryId], client);

                if (delivery.shipment_id) {
                    await dbAdapter.run(`
                        INSERT INTO tracking_events (
                            shipment_id, event_code, event_name,
                            hub_id, location_desc, actor_type, actor_name,
                            description, is_customer_visible, metadata
                        ) VALUES (?, 'DELIVERY_ATTEMPT_FAILED', 'Delivery Attempt Unsuccessful', ?, ?, 'DRIVER', ?, ?, true, ?)
                    `, [
                        delivery.shipment_id,
                        delivery.hub_id,
                        delivery.destination_city || 'Delivery Stop',
                        user.fullName || 'Courier Driver',
                        `Attempt #${nextAttemptNumber} unsuccessful: ${data.failure_reason}. Will reschedule.`,
                        JSON.stringify({ attempt_number: nextAttemptNumber, reason: data.failure_reason })
                    ], client);
                }
            }
        }

        return {
            attempt: await dbAdapter.get('SELECT * FROM delivery_attempts WHERE id = ?', [info.insertId], client),
            delivery: await getDeliveryById(deliveryId, client),
            exception: createdException
        };
    });

    if (status === 'FAILED' && delivery.shipment_id) {
        try {
            const shipment = await dbAdapter.get('SELECT * FROM shipments WHERE id = ?', [delivery.shipment_id]);
            await notificationService.queueMilestoneNotification('DELIVERY_FAILED', {
                shipment,
                delivery: res.delivery,
                reason: data.failure_reason
            });
        } catch (e) {
            // Non-blocking
        }
    }

    return res;
}

// ============================================================================
// 3. PROOF OF DELIVERY & COMPLETION
// ============================================================================

/**
 * Completes delivery with legally binding Proof of Delivery evidence (Rule BR-007, POD-001..005)
 */
async function completeDeliveryWithPOD(deliveryId, podData, user = {}) {
    const delivery = await dbAdapter.get('SELECT * FROM deliveries WHERE id = ?', [deliveryId]);
    if (!delivery) throw new Error(`Delivery task ${deliveryId} not found`);

    if (delivery.status === 'DELIVERED') {
        throw new Error(`Delivery ${delivery.delivery_number} has already been completed`);
    }

    // Role-based capability check: Only assigned driver (or Super Admin emergency override) can submit POD
    if (user.roleName) {
        if (user.roleName !== 'DRIVER' && user.roleName !== 'SUPER_ADMIN') {
            throw new Error(`Vertical Privilege Escalation Blocked: Role '${user.roleDisplayName || user.roleName}' is not authorized to submit recipient proof of delivery. Delivery POD must be captured by the assigned courier driver.`);
        }
        if (user.roleName === 'DRIVER' && delivery.driver_id) {
            const driverRec = await dbAdapter.get('SELECT id FROM drivers WHERE user_id = ?', [user.id]);
            if (driverRec && Number(delivery.driver_id) !== Number(driverRec.id)) {
                throw new Error('Forbidden: You can only complete deliveries assigned to your driver profile.');
            }
        }
    }

    const requiredMethods = (delivery.pod_required_methods || 'SIGNATURE,GPS').toUpperCase().split(',');

    // Rule BR-007: Successful delivery requires configured POD evidence
    if (requiredMethods.includes('SIGNATURE') && !podData.signature_data && !podData.recipient_name) {
        throw new Error('Business Rule BR-007 Violation: Signature or recipient confirmation is required for POD.');
    }

    if (requiredMethods.includes('GPS') && (!podData.latitude || !podData.longitude)) {
        throw new Error('Business Rule BR-007 Violation: GPS coordinates (latitude, longitude) are required for POD.');
    }

    const recipientName = podData.recipient_name || delivery.recipient_name;
    const recipientPhone = podData.recipient_phone || delivery.recipient_phone;

    const res = await dbAdapter.withTransaction(async (client) => {
        // Record Proof of Delivery
        await dbAdapter.run(`
            INSERT INTO proof_of_delivery (
                delivery_id, shipment_id, recipient_name, recipient_phone,
                otp_code, otp_verified, signature_data, photo_data,
                latitude, longitude, device_id, notes, verified_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
            deliveryId,
            delivery.shipment_id || null,
            recipientName,
            recipientPhone,
            podData.otp_code || null,
            Boolean(podData.otp_verified),
            podData.signature_data || null,
            podData.photo_data || null,
            podData.latitude || null,
            podData.longitude || null,
            podData.device_id || null,
            podData.notes || null
        ], client);

        // Record successful attempt
        const nextAttempt = (delivery.attempt_count || 0) + 1;
        await dbAdapter.run(`
            INSERT INTO delivery_attempts (
                delivery_id, shipment_id, attempt_number, status,
                driver_id, latitude, longitude, attempted_at
            ) VALUES (?, ?, ?, 'SUCCESS', ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
            deliveryId,
            delivery.shipment_id || null,
            nextAttempt,
            delivery.driver_id || null,
            podData.latitude || null,
            podData.longitude || null
        ], client);

        // Update delivery
        const expectedCod = Number(delivery.cod_amount_expected || 0);
        const codCollected = podData.cod_amount_collected !== undefined ? Number(podData.cod_amount_collected) : expectedCod;
        await dbAdapter.run(`
            UPDATE deliveries
            SET status = 'DELIVERED', actual_delivery_at = CURRENT_TIMESTAMP,
                attempt_count = ?, cod_amount_collected = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [nextAttempt, codCollected, deliveryId], client);

        // Update shipment to DELIVERED via canonical state machine
        if (delivery.shipment_id) {
            await shipmentService.transitionShipmentStatus(delivery.shipment_id, 'DELIVERED', {
                hub_id: delivery.hub_id,
                location_desc: delivery.destination_city || 'Recipient Location',
                latitude: podData.latitude || null,
                longitude: podData.longitude || null,
                notes: `Delivered to ${recipientName}. Proof of delivery confirmed.`
            }, user);
        }

        // Automatic COD Settlement Synchronization on POD Completion
        if (delivery.shipment_id && expectedCod > 0) {
            const codSettlement = await dbAdapter.get('SELECT * FROM cod_settlements WHERE shipment_id = ?', [delivery.shipment_id], client);
            const varAmt = Number((codCollected - expectedCod).toFixed(2));
            const settlementStatus = varAmt !== 0 ? 'DISCREPANT' : 'COLLECTED';
            const collMethod = podData.collection_method || 'CASH';
            const collRef = podData.collection_reference || null;

            if (codSettlement) {
                await dbAdapter.run(`
                    UPDATE cod_settlements
                    SET delivery_id = ?,
                        collected_amount = ?,
                        collection_method = ?,
                        collection_reference = ?,
                        variance_amount = ?,
                        status = ?,
                        collector_id = ?,
                        collected_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [
                    deliveryId,
                    codCollected,
                    collMethod,
                    collRef,
                    varAmt,
                    settlementStatus,
                    user.id || delivery.driver_id || null,
                    codSettlement.id
                ], client);
            } else {
                const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                const rand = Math.floor(1000 + Math.random() * 9000);
                const settlementNumber = `COD-${today}-${rand}`;
                await dbAdapter.run(`
                    INSERT INTO cod_settlements (
                        settlement_number, shipment_id, delivery_id, hub_id, collector_id,
                        expected_amount, collected_amount, remitted_amount, variance_amount,
                        currency, status, collection_method, collection_reference,
                        collected_at, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0.0, ?, 'KES', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                `, [
                    settlementNumber,
                    delivery.shipment_id,
                    deliveryId,
                    delivery.hub_id,
                    user.id || delivery.driver_id || null,
                    expectedCod,
                    codCollected,
                    varAmt,
                    settlementStatus,
                    collMethod,
                    collRef
                ], client);
            }

            // Record COD_COLLECTED tracking event
            await dbAdapter.run(`
                INSERT INTO tracking_events (
                    shipment_id, event_code, event_name,
                    hub_id, location_desc, latitude, longitude,
                    actor_type, actor_name, description, is_customer_visible, metadata
                ) VALUES (?, 'COD_COLLECTED', 'Cash on Delivery Collected', ?, ?, ?, ?, 'DRIVER', ?, ?, true, ?)
            `, [
                delivery.shipment_id,
                delivery.hub_id,
                delivery.destination_city || 'Recipient Location',
                podData.latitude || null,
                podData.longitude || null,
                user.fullName || 'Courier Driver',
                `COD collected: KES ${codCollected.toFixed(2)} via ${collMethod}.${varAmt !== 0 ? ` Variance noted: KES ${varAmt.toFixed(2)}` : ''}`,
                JSON.stringify({ cod_collected: codCollected, variance: varAmt, method: collMethod, reference: collRef })
            ], client);
        }

        // Audit Log
        logAuditEvent({
            userId: user.id || 1,
            role: user.roleName || 'DRIVER',
            action: 'COMPLETE',
            resource: 'DELIVERY',
            resourceId: String(deliveryId),
            branchId: delivery.branch_id,
            newValue: { status: 'DELIVERED', recipient: recipientName },
            reason: 'Successful delivery completed with verified POD'
        });

        return {
            delivery: await getDeliveryById(deliveryId, client),
            pod: await dbAdapter.get('SELECT * FROM proof_of_delivery WHERE delivery_id = ?', [deliveryId], client)
        };
    });

    if (delivery.shipment_id) {
        try {
            const shipment = await dbAdapter.get('SELECT * FROM shipments WHERE id = ?', [delivery.shipment_id]);
            await notificationService.queueMilestoneNotification('DELIVERED', {
                shipment,
                delivery: res.delivery
            });
        } catch (e) {
            // Non-blocking
        }
    }

    return res;
}

/**
 * Return-to-hub workflow when failed package is received back at the facility
 */
async function processReturnToHub(deliveryId, data = {}, user = {}) {
    const delivery = await dbAdapter.get('SELECT * FROM deliveries WHERE id = ?', [deliveryId]);
    if (!delivery) throw new Error(`Delivery task ${deliveryId} not found`);

    return await dbAdapter.withTransaction(async (client) => {
        await dbAdapter.run(`
            UPDATE deliveries
            SET status = 'RETURN_RECEIVED', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [deliveryId], client);

        if (delivery.shipment_id) {
            // Update shipment to RETURNED via canonical state machine
            await shipmentService.transitionShipmentStatus(delivery.shipment_id, 'RETURNED', {
                hub_id: delivery.hub_id,
                location_desc: `Hub #${delivery.hub_id} Receiving`,
                event_code: 'RETURNED_TO_HUB',
                event_name: 'Returned to Hub Facility',
                notes: `Package returned to hub after failed delivery. Reason: ${delivery.failure_reason || data.notes || 'Unclaimed'}`
            }, user);
        }

        return await getDeliveryById(deliveryId, client);
    });
}

// ============================================================================
// 4. CENTRALIZED OPERATIONAL EXCEPTIONS (Rule EXC-001..005)
// ============================================================================

/**
 * Internal helper to create operational exception
 */
async function createExceptionInternal(data, user = {}, client = null) {
    const exceptionNumber = generateSeqNumber('EXC');
    const severity = (data.severity || 'MEDIUM').toUpperCase();

    const info = await dbAdapter.query(`
        INSERT INTO exceptions (
            exception_number, exception_type, severity, shipment_id, delivery_id,
            hub_id, status, description, root_cause, resolution_notes,
            reported_by_user_id, assigned_to_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
        exceptionNumber,
        data.exception_type,
        severity,
        data.shipment_id || null,
        data.delivery_id || null,
        data.hub_id || null,
        data.description,
        data.root_cause || null,
        data.resolution_notes || null,
        user.id || 1,
        data.assigned_to_user_id || null
    ], client);

    return await dbAdapter.get('SELECT * FROM exceptions WHERE id = ?', [info.insertId], client);
}

/**
 * Public method to explicitly create an operational exception
 */
async function createException(data, user = {}) {
    if (!data.exception_type) throw new Error('exception_type is required');
    if (!data.description) throw new Error('description is required');

    return await dbAdapter.withTransaction(async (client) => {
        const exception = await createExceptionInternal(data, user, client);

        if (data.shipment_id) {
            await dbAdapter.run(`
                INSERT INTO tracking_events (
                    shipment_id, event_code, event_name,
                    hub_id, location_desc, actor_type, actor_name,
                    description, is_customer_visible, metadata
                ) VALUES (?, 'EXCEPTION_RECORDED', 'Operational Exception Logged', ?, ?, ?, ?, ?, false, ?)
            `, [
                data.shipment_id,
                data.hub_id || null,
                data.hub_id ? `Hub #${data.hub_id}` : 'Operations Office',
                user.roleName || 'STAFF',
                user.fullName || 'Operations User',
                `Exception ${exception.exception_number} (${data.exception_type}): ${data.description}`,
                JSON.stringify({ exception_number: exception.exception_number, severity: data.severity })
            ], client);
        }

        return exception;
    });
}

/**
 * Resolves an operational exception
 */
async function resolveException(id, data = {}, user = {}) {
    const exception = await dbAdapter.get('SELECT * FROM exceptions WHERE id = ?', [id]);
    if (!exception) throw new Error(`Exception ${id} not found`);

    if (exception.status === 'RESOLVED') {
        throw new Error(`Exception ${exception.exception_number} is already resolved`);
    }

    return await dbAdapter.withTransaction(async (client) => {
        await dbAdapter.run(`
            UPDATE exceptions
            SET status = 'RESOLVED',
                root_cause = COALESCE(?, root_cause),
                resolution_notes = ?,
                resolved_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            data.root_cause || null,
            data.resolution_notes || 'Resolved upon investigation',
            id
        ], client);

        if (exception.shipment_id) {
            await dbAdapter.run(`
                INSERT INTO tracking_events (
                    shipment_id, event_code, event_name,
                    hub_id, location_desc, actor_type, actor_name,
                    description, is_customer_visible, metadata
                ) VALUES (?, 'EXCEPTION_RESOLVED', 'Operational Exception Resolved', ?, ?, ?, ?, ?, true, ?)
            `, [
                exception.shipment_id,
                exception.hub_id,
                exception.hub_id ? `Hub #${exception.hub_id}` : 'Operations Center',
                user.roleName || 'MANAGER',
                user.fullName || 'Operations Manager',
                `Exception ${exception.exception_number} resolved: ${data.resolution_notes || 'Resolved'}`,
                JSON.stringify({ exception_number: exception.exception_number, resolved_at: new Date().toISOString() })
            ], client);
        }

        return await getExceptionById(id, client);
    });
}

/**
 * Gets exception by ID
 */
async function getExceptionById(id, client = null) {
    return await dbAdapter.get(`
        SELECT e.*, s.tracking_number, b.name as hub_name,
               u_rep.full_name as reported_by_name, u_ass.full_name as assigned_to_name
        FROM exceptions e
        LEFT JOIN shipments s ON e.shipment_id = s.id
        LEFT JOIN branches b ON e.hub_id = b.id
        LEFT JOIN users u_rep ON e.reported_by_user_id = u_rep.id
        LEFT JOIN users u_ass ON e.assigned_to_user_id = u_ass.id
        WHERE e.id = ?
    `, [id], client);
}

/**
 * Lists exceptions
 */
async function listExceptions(query = {}, user = {}) {
    let sql = 'SELECT e.*, s.tracking_number, b.name as hub_name FROM exceptions e LEFT JOIN shipments s ON e.shipment_id = s.id LEFT JOIN branches b ON e.hub_id = b.id WHERE 1=1';
    const params = [];

    if (user.roleName !== 'SUPER_ADMIN' && user.branchId) {
        sql += ' AND (e.hub_id = ? OR e.hub_id IS NULL)';
        params.push(user.branchId);
    }

    if (query.status) {
        sql += ' AND e.status = ?';
        params.push(query.status.toUpperCase());
    }

    if (query.exception_type) {
        sql += ' AND e.exception_type = ?';
        params.push(query.exception_type.toUpperCase());
    }

    if (query.shipment_id) {
        sql += ' AND e.shipment_id = ?';
        params.push(Number(query.shipment_id));
    }

    sql += ' ORDER BY e.id DESC LIMIT 100';

    const items = await dbAdapter.all(sql, params);
    return { exceptions: items, total: items.length };
}

/**
 * Gets delivery task by ID
 */
async function getDeliveryById(id, client = null) {
    const delivery = await dbAdapter.get(`
        SELECT d.*, s.tracking_number, s.status as shipment_status,
               drv.full_name as driver_name, drv.phone as driver_phone,
               v.registration_number as vehicle_reg, v.model as vehicle_model,
               b.name as hub_name
        FROM deliveries d
        LEFT JOIN shipments s ON d.shipment_id = s.id
        LEFT JOIN drivers dr ON d.driver_id = dr.id
        LEFT JOIN users drv ON dr.user_id = drv.id
        LEFT JOIN vehicles v ON d.vehicle_id = v.id
        LEFT JOIN branches b ON d.hub_id = b.id
        WHERE d.id = ?
    `, [id], client);

    if (!delivery) return null;

    delivery.attempts = await dbAdapter.all(`
        SELECT * FROM delivery_attempts WHERE delivery_id = ? ORDER BY attempt_number ASC
    `, [id], client);

    delivery.proof_of_delivery = await dbAdapter.get(`
        SELECT * FROM proof_of_delivery WHERE delivery_id = ?
    `, [id], client) || null;

    return delivery;
}

/**
 * Lists delivery tasks with filters
 */
async function listDeliveries(query = {}, user = {}) {
    let sql = 'SELECT d.*, s.tracking_number, drv.full_name as driver_name, b.name as hub_name FROM deliveries d LEFT JOIN shipments s ON d.shipment_id = s.id LEFT JOIN drivers dr ON d.driver_id = dr.id LEFT JOIN users drv ON dr.user_id = drv.id LEFT JOIN branches b ON d.hub_id = b.id WHERE 1=1';
    const params = [];

    // Role-based scoping
    if (user.roleName === 'DRIVER') {
        const driver = await dbAdapter.get('SELECT id FROM drivers WHERE user_id = ?', [user.id]);
        if (driver) {
            sql += ' AND d.driver_id = ?';
            params.push(driver.id);
        }
    } else if (user.roleName !== 'SUPER_ADMIN' && user.branchId) {
        sql += ' AND (d.hub_id = ? OR d.branch_id = ?)';
        params.push(user.branchId, user.branchId);
    }

    if (query.status) {
        sql += ' AND d.status = ?';
        params.push(query.status.toUpperCase());
    }

    if (query.driver_id) {
        sql += ' AND d.driver_id = ?';
        params.push(Number(query.driver_id));
    }

    if (query.shipment_id) {
        sql += ' AND d.shipment_id = ?';
        params.push(Number(query.shipment_id));
    }

    sql += ' ORDER BY d.id DESC LIMIT 100';

    const deliveries = await dbAdapter.all(sql, params);
    return { deliveries, total: deliveries.length };
}

module.exports = {
    createDeliveryTask,
    assignDeliveryTask,
    startDelivery,
    recordDeliveryAttempt,
    completeDeliveryWithPOD,
    processReturnToHub,
    createException,
    resolveException,
    getExceptionById,
    listExceptions,
    getDeliveryById,
    listDeliveries
};
