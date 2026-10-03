// server/services/transportService.js
// SwiftTrack Logistics: Stage 3 Transport & Manifest Domain Service
const crypto = require('node:crypto');
const dbAdapter = require('../db/dbAdapter.js');
const shipmentService = require('./shipmentService.js');
const { logAuditEvent } = require('../middleware/audit.js');
const notificationService = require('./notificationService.js');

const RUN_STATUSES = {
    PLANNED: 'PLANNED',
    READY_FOR_LOADING: 'READY_FOR_LOADING',
    LOADING: 'LOADING',
    LOADED: 'LOADED',
    DISPATCHED: 'DISPATCHED',
    IN_TRANSIT: 'IN_TRANSIT',
    ARRIVED: 'ARRIVED',
    UNLOADING: 'UNLOADING',
    COMPLETED: 'COMPLETED',
    DELAYED: 'DELAYED',
    BREAKDOWN: 'BREAKDOWN',
    CANCELLED: 'CANCELLED'
};

const ALLOWED_RUN_TRANSITIONS = {
    PLANNED: ['READY_FOR_LOADING', 'LOADING', 'CANCELLED'],
    READY_FOR_LOADING: ['LOADING', 'LOADED', 'CANCELLED'],
    LOADING: ['LOADED', 'READY_FOR_LOADING', 'CANCELLED'],
    LOADED: ['DISPATCHED', 'IN_TRANSIT', 'LOADING', 'CANCELLED'],
    DISPATCHED: ['IN_TRANSIT', 'ARRIVED', 'DELAYED', 'BREAKDOWN', 'CANCELLED'],
    IN_TRANSIT: ['ARRIVED', 'DELAYED', 'BREAKDOWN'],
    DELAYED: ['IN_TRANSIT', 'ARRIVED', 'BREAKDOWN', 'CANCELLED'],
    BREAKDOWN: ['IN_TRANSIT', 'ARRIVED', 'CANCELLED'],
    ARRIVED: ['UNLOADING', 'COMPLETED'],
    UNLOADING: ['COMPLETED'],
    COMPLETED: [],
    CANCELLED: []
};

/**
 * Generates unique transport run number: RUN-YYYYMMDD-XXXX
 */
async function generateRunNumber(client = null) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const prefix = `RUN-${y}${m}${d}`;

    for (let i = 0; i < 10; i++) {
        const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
        const candidate = `${prefix}-${rand}`;
        const exist = await dbAdapter.get('SELECT id FROM transport_runs WHERE run_number = ?', [candidate], client);
        if (!exist) return candidate;
    }
    return `${prefix}-${Date.now().toString().slice(-4)}`;
}

/**
 * Generates unique manifest number: MAN-YYYYMMDD-XXXX
 */
async function generateManifestNumber(client = null) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const prefix = `MAN-${y}${m}${d}`;

    for (let i = 0; i < 10; i++) {
        const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
        const candidate = `${prefix}-${rand}`;
        const exist = await dbAdapter.get('SELECT id FROM manifests WHERE manifest_number = ?', [candidate], client);
        if (!exist) return candidate;
    }
    return `${prefix}-${Date.now().toString().slice(-4)}`;
}

/**
 * Creates a planned route
 */
async function createRoute(data, user = {}) {
    if (!data.code || !data.name || !data.origin_hub_id || !data.destination_hub_id) {
        throw new Error('Route code, name, origin_hub_id, and destination_hub_id are required');
    }

    const info = await dbAdapter.query(`
        INSERT INTO routes (code, name, origin_hub_id, destination_hub_id, distance_km, estimated_duration_hours, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
        data.code.trim().toUpperCase(),
        data.name.trim(),
        data.origin_hub_id,
        data.destination_hub_id,
        Number(data.distance_km) || 0.0,
        Number(data.estimated_duration_hours) || 0.0,
        data.is_active !== false
    ]);

    const routeId = info.insertId;

    // Create default primary leg if not provided
    await dbAdapter.run(`
        INSERT INTO route_legs (route_id, leg_sequence, origin_hub_id, destination_hub_id, distance_km, estimated_duration_hours, is_cross_border, is_active)
        VALUES (?, 1, ?, ?, ?, ?, ?, true)
    `, [
        routeId,
        data.origin_hub_id,
        data.destination_hub_id,
        Number(data.distance_km) || 0.0,
        Number(data.estimated_duration_hours) || 0.0,
        Boolean(data.is_cross_border)
    ]);

    return await getRouteById(routeId);
}

/**
 * Gets route by ID with route legs
 */
async function getRouteById(id, client = null) {
    const route = await dbAdapter.get(`
        SELECT r.*,
               orig.name as origin_hub_name, orig.code as origin_hub_code,
               dest.name as destination_hub_name, dest.code as destination_hub_code
        FROM routes r
        JOIN branches orig ON r.origin_hub_id = orig.id
        JOIN branches dest ON r.destination_hub_id = dest.id
        WHERE r.id = ?
    `, [id], client);

    if (!route) return null;

    const legs = await dbAdapter.all(`
        SELECT rl.*,
               o.name as origin_hub_name, d.name as destination_hub_name
        FROM route_legs rl
        JOIN branches o ON rl.origin_hub_id = o.id
        JOIN branches d ON rl.destination_hub_id = d.id
        WHERE rl.route_id = ?
        ORDER BY rl.leg_sequence ASC
    `, [id], client);

    return { ...route, legs };
}

/**
 * Lists routes
 */
async function listRoutes(filters = {}) {
    let query = `
        SELECT r.*,
               orig.name as origin_hub_name, orig.city as origin_city,
               dest.name as destination_hub_name, dest.city as destination_city,
               (SELECT count(*) FROM route_legs WHERE route_id = r.id) as legs_count
        FROM routes r
        JOIN branches orig ON r.origin_hub_id = orig.id
        JOIN branches dest ON r.destination_hub_id = dest.id
        WHERE 1=1
    `;
    const params = [];

    if (filters.origin_hub_id) {
        query += ' AND r.origin_hub_id = ?';
        params.push(filters.origin_hub_id);
    }
    if (filters.destination_hub_id) {
        query += ' AND r.destination_hub_id = ?';
        params.push(filters.destination_hub_id);
    }
    if (filters.is_active !== undefined) {
        query += ' AND r.is_active = ?';
        params.push(Boolean(filters.is_active));
    }

    query += ' ORDER BY r.code ASC';
    return await dbAdapter.all(query, params);
}

/**
 * Creates a scheduled Transport Run executing a Route Leg, and initializes an attached Manifest
 */
async function createTransportRun(data, user = {}) {
    if (!data.origin_hub_id || !data.destination_hub_id) {
        throw new Error('origin_hub_id and destination_hub_id are required');
    }

    // Verify driver if provided
    if (data.driver_id) {
        const driver = await dbAdapter.get('SELECT id, status FROM drivers WHERE id = ?', [data.driver_id]);
        if (!driver) throw new Error(`Driver ID ${data.driver_id} not found`);
    }

    // Verify vehicle if provided
    let vehicleOdo = 0.0;
    if (data.vehicle_id) {
        const vehicle = await dbAdapter.get('SELECT id, status, current_odometer_km, max_capacity_kg FROM vehicles WHERE id = ?', [data.vehicle_id]);
        if (!vehicle) throw new Error(`Vehicle ID ${data.vehicle_id} not found`);
        vehicleOdo = Number(vehicle.current_odometer_km) || 0.0;
    }

    return await dbAdapter.withTransaction(async (client) => {
        const runNumber = await generateRunNumber(client);
        const manifestNumber = await generateManifestNumber(client);

        // 1. Insert Transport Run
        const runRes = await dbAdapter.query(`
            INSERT INTO transport_runs (
                run_number, route_leg_id, origin_hub_id, destination_hub_id,
                driver_id, vehicle_id, dispatcher_user_id, status,
                scheduled_departure, scheduled_arrival,
                departure_odometer_km, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            runNumber,
            data.route_leg_id || null,
            data.origin_hub_id,
            data.destination_hub_id,
            data.driver_id || null,
            data.vehicle_id || null,
            user.id || 1,
            RUN_STATUSES.PLANNED,
            data.scheduled_departure || null,
            data.scheduled_arrival || null,
            vehicleOdo,
            data.notes || null
        ], client);

        const runId = runRes.insertId;

        // 2. Insert Default Attached Manifest
        await dbAdapter.run(`
            INSERT INTO manifests (
                manifest_number, transport_run_id, origin_hub_id, destination_hub_id, status, notes
            ) VALUES (?, ?, ?, ?, 'DRAFT', ?)
        `, [
            manifestNumber,
            runId,
            data.origin_hub_id,
            data.destination_hub_id,
            `Manifest for ${runNumber}`
        ], client);

        // Audit Log
        await logAuditEvent({
            userId: user.id || 1,
            role: user.roleName || 'STAFF',
            action: 'CREATE',
            resource: 'TRANSPORT_RUN',
            resourceId: String(runId),
            branchId: data.origin_hub_id,
            newValue: { run_number: runNumber, manifest_number: manifestNumber },
            reason: 'Created transport run'
        });

        return await getTransportRunById(runId, client);
    });
}

/**
 * Gets Transport Run by ID with driver, vehicle, checkpoints, and manifest with items
 */
async function getTransportRunById(id, client = null) {
    const run = await dbAdapter.get(`
        SELECT tr.*,
               orig.name as origin_hub_name, orig.code as origin_hub_code, orig.city as origin_city,
               dest.name as destination_hub_name, dest.code as destination_hub_code, dest.city as destination_city,
               drv_u.full_name as driver_name, drv.phone as driver_phone, drv.license_number as driver_license,
               v.registration_number as vehicle_reg, v.model as vehicle_model, v.max_capacity_kg as vehicle_capacity,
               disp.full_name as dispatcher_name
        FROM transport_runs tr
        JOIN branches orig ON tr.origin_hub_id = orig.id
        JOIN branches dest ON tr.destination_hub_id = dest.id
        LEFT JOIN drivers drv ON tr.driver_id = drv.id
        LEFT JOIN users drv_u ON drv.user_id = drv_u.id
        LEFT JOIN vehicles v ON tr.vehicle_id = v.id
        LEFT JOIN users disp ON tr.dispatcher_user_id = disp.id
        WHERE tr.id = ?
    `, [id], client);

    if (!run) return null;

    const manifest = await dbAdapter.get('SELECT * FROM manifests WHERE transport_run_id = ?', [id], client);
    let manifestItems = [];
    if (manifest) {
        manifestItems = await dbAdapter.all(`
            SELECT mi.*,
                   s.tracking_number, s.waybill_number, s.status as shipment_status,
                   s.total_parcels, s.chargeable_weight_kg, s.declared_value,
                   s.sender_name, s.recipient_name, s.recipient_city
            FROM manifest_items mi
            JOIN shipments s ON mi.shipment_id = s.id
            WHERE mi.manifest_id = ?
            ORDER BY mi.id ASC
        `, [manifest.id], client);
    }

    const checkpoints = await dbAdapter.all(`
        SELECT cp.*, drv_u.full_name as recorded_by_name
        FROM run_checkpoints cp
        LEFT JOIN drivers drv ON cp.recorded_by_driver_id = drv.id
        LEFT JOIN users drv_u ON drv.user_id = drv_u.id
        WHERE cp.transport_run_id = ?
        ORDER BY cp.id ASC
    `, [id], client);

    return {
        ...run,
        manifest: manifest ? { ...manifest, items: manifestItems } : null,
        checkpoints
    };
}

/**
 * Lists transport runs with filtering and branch scoping
 */
async function listTransportRuns(filters = {}, user = {}) {
    let query = `
        SELECT tr.*,
               orig.name as origin_hub_name, orig.code as origin_hub_code,
               dest.name as destination_hub_name, dest.code as destination_hub_code,
               drv_u.full_name as driver_name,
               v.registration_number as vehicle_reg,
               m.manifest_number, m.status as manifest_status
        FROM transport_runs tr
        JOIN branches orig ON tr.origin_hub_id = orig.id
        JOIN branches dest ON tr.destination_hub_id = dest.id
        LEFT JOIN drivers drv ON tr.driver_id = drv.id
        LEFT JOIN users drv_u ON drv.user_id = drv_u.id
        LEFT JOIN vehicles v ON tr.vehicle_id = v.id
        LEFT JOIN manifests m ON tr.id = m.transport_run_id
        WHERE 1=1
    `;
    const params = [];

    // Role / Hub Scoping
    if (user.roleName !== 'SUPER_ADMIN' && user.branchId) {
        query += ' AND (tr.origin_hub_id = ? OR tr.destination_hub_id = ?)';
        params.push(user.branchId, user.branchId);
    } else if (filters.hub_id) {
        query += ' AND (tr.origin_hub_id = ? OR tr.destination_hub_id = ?)';
        params.push(filters.hub_id, filters.hub_id);
    }

    if (filters.status) {
        query += ' AND tr.status = ?';
        params.push(filters.status);
    }

    if (filters.driver_id) {
        query += ' AND tr.driver_id = ?';
        params.push(filters.driver_id);
    }

    if (filters.vehicle_id) {
        query += ' AND tr.vehicle_id = ?';
        params.push(filters.vehicle_id);
    }

    query += ' ORDER BY tr.id DESC LIMIT ? OFFSET ?';
    const limit = Math.min(Number(filters.limit) || 50, 200);
    const offset = Math.max(0, Number(filters.offset) || 0);
    params.push(limit, offset);

    return await dbAdapter.all(query, params);
}

/**
 * Adds a shipment to the Transport Run's Manifest
 */
async function addShipmentToManifest(runId, shipmentId, user = {}) {
    const run = await dbAdapter.get('SELECT id, status, origin_hub_id, destination_hub_id FROM transport_runs WHERE id = ?', [runId]);
    if (!run) throw new Error(`Transport Run ${runId} not found`);

    if (['DISPATCHED', 'IN_TRANSIT', 'ARRIVED', 'COMPLETED', 'CANCELLED'].includes(run.status)) {
        throw new Error(`Cannot add shipments to a transport run in status '${run.status}'`);
    }

    const manifest = await dbAdapter.get('SELECT id, status FROM manifests WHERE transport_run_id = ?', [runId]);
    if (!manifest) throw new Error(`Manifest for run ${runId} not found`);
    if (manifest.status === 'LOCKED') throw new Error('Manifest is already locked. Unlock or create new run.');

    const shipment = await dbAdapter.get('SELECT id, tracking_number, status, total_parcels, chargeable_weight_kg FROM shipments WHERE id = ?', [shipmentId]);
    if (!shipment) throw new Error(`Shipment ${shipmentId} not found`);

    return await dbAdapter.withTransaction(async (client) => {
        // Insert item
        await dbAdapter.run(`
            INSERT INTO manifest_items (manifest_id, shipment_id, status)
            VALUES (?, ?, 'ASSIGNED')
        `, [manifest.id, shipmentId], client);

        // Link to active pending shipment leg matching this run's corridor
        await dbAdapter.run(`
            UPDATE shipment_legs SET
                transport_run_id = ?,
                manifest_id = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE shipment_id = ?
              AND origin_hub_id = ?
              AND destination_hub_id = ?
              AND status = 'PENDING'
        `, [runId, manifest.id, shipmentId, run.origin_hub_id, run.destination_hub_id], client);

        // Recalculate totals
        await recalculateManifestTotals(manifest.id, runId, client);

        return await getTransportRunById(runId, client);
    });
}

/**
 * Removes a shipment from Manifest
 */
async function removeShipmentFromManifest(runId, shipmentId, user = {}) {
    const manifest = await dbAdapter.get('SELECT id, status FROM manifests WHERE transport_run_id = ?', [runId]);
    if (!manifest) throw new Error(`Manifest for run ${runId} not found`);
    if (['LOCKED', 'DISPATCHED', 'RECEIVED'].includes(manifest.status)) {
        throw new Error(`Cannot remove items from manifest in status '${manifest.status}'`);
    }

    return await dbAdapter.withTransaction(async (client) => {
        await dbAdapter.run('DELETE FROM manifest_items WHERE manifest_id = ? AND shipment_id = ?', [manifest.id, shipmentId], client);
        await recalculateManifestTotals(manifest.id, runId, client);
        return await getTransportRunById(runId, client);
    });
}

/**
 * Helper to update manifest and run item counts and aggregate weight
 */
async function recalculateManifestTotals(manifestId, runId, client = null) {
    const agg = await dbAdapter.get(`
        SELECT count(mi.shipment_id) as total_shipments,
               COALESCE(sum(s.total_parcels), 0) as total_parcels,
               COALESCE(sum(s.chargeable_weight_kg), 0.0) as total_weight
        FROM manifest_items mi
        JOIN shipments s ON mi.shipment_id = s.id
        WHERE mi.manifest_id = ?
    `, [manifestId], client);

    const totalShipments = Number(agg?.total_shipments || 0);
    const totalParcels = Number(agg?.total_parcels || 0);
    const totalWeight = Math.round((Number(agg?.total_weight) || 0.0) * 100) / 100;

    await dbAdapter.run(`
        UPDATE manifests SET
            total_shipments = ?,
            total_parcels = ?,
            total_weight_kg = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [totalShipments, totalParcels, totalWeight, manifestId], client);

    await dbAdapter.run(`
        UPDATE transport_runs SET
            total_shipments_count = ?,
            total_parcels_count = ?,
            total_weight_kg = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [totalShipments, totalParcels, totalWeight, runId], client);
}

/**
 * Locks the manifest and marks all assigned shipments as LOADED (PRD BR-005)
 */
async function lockManifest(runId, user = {}) {
    const run = await dbAdapter.get('SELECT id, run_number, origin_hub_id FROM transport_runs WHERE id = ?', [runId]);
    if (!run) throw new Error(`Transport Run ${runId} not found`);

    const manifest = await dbAdapter.get('SELECT id, status, total_shipments, manifest_number FROM manifests WHERE transport_run_id = ?', [runId]);
    if (!manifest) throw new Error(`Manifest not found for run ${runId}`);
    if (manifest.total_shipments === 0) {
        throw new Error('Cannot lock an empty manifest. Add at least one shipment.');
    }

    const hub = await dbAdapter.get('SELECT name FROM branches WHERE id = ?', [run.origin_hub_id]);

    return await dbAdapter.withTransaction(async (client) => {
        // Lock manifest
        await dbAdapter.run(`
            UPDATE manifests SET
                status = 'LOCKED',
                locked_at = CURRENT_TIMESTAMP,
                locked_by_user_id = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [user.id || 1, manifest.id], client);

        // Advance Run status to LOADED
        await dbAdapter.run(`
            UPDATE transport_runs SET
                status = 'LOADED',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [runId], client);

        // Mark items as LOADED and advance shipments to LOADED
        const items = await dbAdapter.all('SELECT shipment_id FROM manifest_items WHERE manifest_id = ?', [manifest.id], client);

        for (const item of items) {
            await dbAdapter.run(`
                UPDATE manifest_items SET
                    status = 'LOADED',
                    loaded_at = CURRENT_TIMESTAMP,
                    loaded_by_user_id = ?
                WHERE manifest_id = ? AND shipment_id = ?
            `, [user.id || 1, manifest.id, item.shipment_id], client);

            // Update shipment status via canonical state machine
            await shipmentService.transitionShipmentStatus(item.shipment_id, 'LOADED', {
                hub_id: run.origin_hub_id,
                location_desc: hub ? hub.name : 'Origin Hub',
                notes: `Shipment loaded on transport run ${run.run_number} (Manifest ${manifest.manifest_number})`
            }, user);
        }

        return await getTransportRunById(runId, client);
    });
}

/**
 * Dispatches the Transport Run: sets vehicle & driver to IN_TRANSIT / ON_DELIVERY
 * and transitions all manifest shipments to IN_TRANSIT
 */
async function dispatchTransportRun(runId, payload = {}, user = {}) {
    const run = await getTransportRunById(runId);
    if (!run) throw new Error(`Transport Run ${runId} not found`);

    if (!run.driver_id) throw new Error('A driver must be assigned before dispatching a transport run');
    if (!run.vehicle_id) throw new Error('A vehicle must be assigned before dispatching a transport run');
    if (!run.manifest || run.manifest.items.length === 0) {
        throw new Error('Cannot dispatch a run without any shipments on the manifest');
    }

    const departureOdo = Number(payload.departure_odometer_km) || Number(run.departure_odometer_km) || 0.0;

    const runResult = await dbAdapter.withTransaction(async (client) => {
        // 1. Update Transport Run
        await dbAdapter.run(`
            UPDATE transport_runs SET
                status = 'IN_TRANSIT',
                actual_departure = CURRENT_TIMESTAMP,
                departure_odometer_km = ?,
                current_odometer_km = ?,
                notes = COALESCE(?, notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [departureOdo, departureOdo, payload.notes || null, runId], client);

        // 2. Update Manifest
        await dbAdapter.run(`
            UPDATE manifests SET
                status = 'DISPATCHED',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [run.manifest.id], client);

        // 3. Update Vehicle & Driver Statuses
        await dbAdapter.run(`
            UPDATE vehicles SET
                status = 'IN_TRANSIT',
                current_odometer_km = ?,
                status_updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [departureOdo, run.vehicle_id], client);

        await dbAdapter.run(`
            UPDATE drivers SET
                status = 'ON_DELIVERY',
                status_updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [run.driver_id], client);

        // 4. Update manifest items and shipments to IN_TRANSIT
        for (const item of run.manifest.items) {
            await dbAdapter.run('UPDATE manifest_items SET status = ? WHERE manifest_id = ? AND shipment_id = ?', ['IN_TRANSIT', run.manifest.id, item.shipment_id], client);

            await dbAdapter.run(`
                UPDATE shipment_legs SET
                    status = 'IN_TRANSIT',
                    actual_departure = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE manifest_id = ? AND shipment_id = ?
            `, [run.manifest.id, item.shipment_id], client);

            // Update shipment status to IN_TRANSIT via canonical state machine
            await shipmentService.transitionShipmentStatus(item.shipment_id, 'IN_TRANSIT', {
                hub_id: run.origin_hub_id,
                location_desc: `In transit on ${run.run_number}`,
                notes: `Departed from ${run.origin_hub_name} heading towards ${run.destination_hub_name}`
            }, user);
        }

        // Audit Log
        await logAuditEvent({
            userId: user.id || 1,
            role: user.roleName || 'STAFF',
            action: 'DISPATCH',
            resource: 'TRANSPORT_RUN',
            resourceId: String(runId),
            branchId: run.origin_hub_id,
            newValue: { status: 'IN_TRANSIT', run_number: run.run_number },
            reason: 'Transport run departed'
        });

        return await getTransportRunById(runId, client);
    });

    // Trigger milestone notifications for shipments on manifest after commit (Rule NTF-002)
    if (run.manifest && run.manifest.items) {
        for (const item of run.manifest.items) {
            try {
                const shipment = await dbAdapter.get('SELECT * FROM shipments WHERE id = ?', [item.shipment_id]);
                if (shipment) {
                    await notificationService.queueMilestoneNotification('DISPATCHED', {
                        shipment,
                        run: runResult,
                        eta: runResult.estimated_arrival ? new Date(runResult.estimated_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'In Transit'
                    });
                }
            } catch (e) {
                // Non-blocking
            }
        }
    }

    return runResult;
}

/**
 * Records a checkpoint update during transit
 */
async function recordCheckpoint(runId, data, user = {}) {
    const run = await dbAdapter.get('SELECT tr.id, tr.status, tr.driver_id, b.name AS destination_hub_name FROM transport_runs tr JOIN branches b ON tr.destination_hub_id = b.id WHERE tr.id = ?', [runId]);
    if (!run) throw new Error(`Transport Run ${runId} not found`);

    if (!data.checkpoint_name) throw new Error('checkpoint_name is required');

    const info = await dbAdapter.query(`
        INSERT INTO run_checkpoints (
            transport_run_id, checkpoint_name, location_desc, latitude, longitude,
            recorded_by_driver_id, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
        runId,
        data.checkpoint_name,
        data.location_desc || data.checkpoint_name,
        data.latitude || null,
        data.longitude || null,
        run.driver_id || null,
        data.notes || null
    ]);

    // Also attach checkpoint event to all shipments on this run
    const manifest = await dbAdapter.get('SELECT id FROM manifests WHERE transport_run_id = ?', [runId]);
    if (manifest) {
        const items = await dbAdapter.all('SELECT shipment_id FROM manifest_items WHERE manifest_id = ?', [manifest.id]);

        for (const item of items) {
            await dbAdapter.run(`
                INSERT INTO tracking_events (
                    shipment_id, event_code, event_name,
                    location_desc, latitude, longitude, actor_type, actor_name,
                    description, is_customer_visible, metadata
                ) VALUES (?, 'IN_TRANSIT_CHECKPOINT', 'In Transit Checkpoint', ?, ?, ?, 'DRIVER', ?, ?, true, ?)
            `, [
                item.shipment_id,
                data.location_desc || data.checkpoint_name,
                data.latitude || null,
                data.longitude || null,
                user.fullName || 'Transport Driver',
                `Checkpoint scan at ${data.checkpoint_name}`,
                JSON.stringify({ checkpoint_name: data.checkpoint_name })
            ]);
        }
    }

    return { id: info.insertId, checkpoint_name: data.checkpoint_name, recorded_at: new Date().toISOString() };
}

/**
 * Marks transport run arrived at destination hub
 */
async function arriveTransportRun(runId, payload = {}, user = {}) {
    const run = await getTransportRunById(runId);
    if (!run) throw new Error(`Transport Run ${runId} not found`);

    const arrivalOdo = Number(payload.arrival_odometer_km) || (Number(run.departure_odometer_km) + (Number(run.distance_km) || 100));

    return await dbAdapter.withTransaction(async (client) => {
        await dbAdapter.run(`
            UPDATE transport_runs SET
                status = 'ARRIVED',
                actual_arrival = CURRENT_TIMESTAMP,
                arrival_odometer_km = ?,
                current_odometer_km = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [arrivalOdo, arrivalOdo, runId], client);

        // Update vehicle odometer
        if (run.vehicle_id) {
            await dbAdapter.run('UPDATE vehicles SET current_odometer_km = ? WHERE id = ?', [arrivalOdo, run.vehicle_id], client);
        }

        return await getTransportRunById(runId, client);
    });
}

/**
 * Receives and reconciles manifest shipments at destination hub (PRD BR-006)
 * Checks received shipments vs expected shipments on the manifest.
 */
async function receiveManifest(runOrManifestId, receivedShipmentIds = [], user = {}) {
    let run = await getTransportRunById(runOrManifestId);
    if (!run) {
        const manifestRow = await dbAdapter.get('SELECT transport_run_id FROM manifests WHERE id = ?', [runOrManifestId]);
        if (manifestRow) {
            run = await getTransportRunById(manifestRow.transport_run_id);
        }
    }
    if (!run) throw new Error(`Transport Run or Manifest ${runOrManifestId} not found`);

    const runId = run.id;
    const manifest = run.manifest;
    if (!manifest) throw new Error(`No manifest found for run ${runId}`);

    const destHub = await dbAdapter.get('SELECT name, city FROM branches WHERE id = ?', [run.destination_hub_id]);
    const destHubName = destHub ? destHub.name : 'Destination Hub';

    return await dbAdapter.withTransaction(async (client) => {
        const receivedSet = new Set(receivedShipmentIds.map(Number));
        let shortageCount = 0;
        let receivedCount = 0;

        for (const item of manifest.items) {
            if (receivedSet.has(item.shipment_id)) {
                // Successfully received
                await dbAdapter.run(`
                    UPDATE manifest_items SET
                        status = 'RECEIVED',
                        received_at = CURRENT_TIMESTAMP,
                        received_by_user_id = ?
                    WHERE manifest_id = ? AND shipment_id = ?
                `, [user.id || 1, manifest.id, item.shipment_id], client);

                // Multi-leg completion & activation via canonical domain service
                await shipmentService.completeLegAndActivateNext(
                    item.shipment_id,
                    manifest.id,
                    run.destination_hub_id,
                    destHubName,
                    user,
                    { run_number: run.run_number }
                );

                receivedCount++;
            } else {
                // Shortage: Expected but missing from unload
                await dbAdapter.run(`
                    UPDATE manifest_items SET
                        status = 'SHORTAGE',
                        discrepancy_reason = 'MISSING_FROM_UNLOAD'
                    WHERE manifest_id = ? AND shipment_id = ?
                `, [manifest.id, item.shipment_id], client);

                // Mark shipment in EXCEPTION via canonical state machine if not already in EXCEPTION
                if (item.shipment_status !== 'EXCEPTION') {
                    await shipmentService.transitionShipmentStatus(item.shipment_id, 'EXCEPTION', {
                        hub_id: run.destination_hub_id,
                        location_desc: destHubName,
                        reason: 'Manifest Discrepancy (Shortage): Expected but missing from unload',
                        notes: `Shortage on transport run ${run.run_number} manifest #${manifest.id}`
                    }, user);
                }

                shortageCount++;
            }
        }

        // Close manifest
        const manifestStatus = shortageCount === 0 ? 'RECONCILED' : 'DISCREPANCY';
        await dbAdapter.run('UPDATE manifests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [manifestStatus, manifest.id], client);

        // Complete Transport Run
        await dbAdapter.run('UPDATE transport_runs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [RUN_STATUSES.COMPLETED, runId], client);

        // Free Driver & Vehicle back to AVAILABLE
        if (run.driver_id) {
            await dbAdapter.run(`UPDATE drivers SET status = 'AVAILABLE', status_updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [run.driver_id], client);
        }
        if (run.vehicle_id) {
            await dbAdapter.run(`UPDATE vehicles SET status = 'AVAILABLE', status_updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [run.vehicle_id], client);
        }

        // Audit Log
        await logAuditEvent({
            userId: user.id || 1,
            role: user.roleName || 'STAFF',
            action: 'RECEIVE',
            resource: 'MANIFEST',
            resourceId: String(manifest.id),
            branchId: run.destination_hub_id,
            newValue: { status: manifestStatus, received: receivedCount, shortage: shortageCount },
            reason: 'Manifest received at hub'
        });

        return {
            run_id: runId,
            manifest_id: manifest.id,
            status: RUN_STATUSES.COMPLETED,
            manifest_status: manifestStatus,
            received_count: receivedCount,
            shortage_count: shortageCount
        };
    });
}

/**
 * Lists linehaul manifests with hub details
 */
async function listManifests(query = {}) {
    let sql = `
        SELECT m.*,
               b1.name as origin_hub_name, b1.code as origin_hub_code,
               b2.name as destination_hub_name, b2.code as destination_hub_code,
               tr.run_number, tr.status as run_status
        FROM manifests m
        LEFT JOIN branches b1 ON m.origin_hub_id = b1.id
        LEFT JOIN branches b2 ON m.destination_hub_id = b2.id
        LEFT JOIN transport_runs tr ON m.transport_run_id = tr.id
        WHERE 1=1
    `;
    const params = [];
    if (query.origin_hub_id) {
        sql += ` AND m.origin_hub_id = ?`;
        params.push(query.origin_hub_id);
    }
    if (query.destination_hub_id) {
        sql += ` AND m.destination_hub_id = ?`;
        params.push(query.destination_hub_id);
    }
    if (query.status && query.status !== 'ALL') {
        sql += ` AND m.status = ?`;
        params.push(query.status);
    }
    sql += ` ORDER BY m.created_at DESC`;
    const manifests = await dbAdapter.all(sql, params);
    return {
        manifests,
        total: manifests.length
    };
}

/**
 * Gets manifest details by ID with loaded items
 */
async function getManifestById(id) {
    const manifest = await dbAdapter.get(`
        SELECT m.*,
               b1.name as origin_hub_name, b1.code as origin_hub_code,
               b2.name as destination_hub_name, b2.code as destination_hub_code,
               tr.run_number, tr.status as run_status
        FROM manifests m
        LEFT JOIN branches b1 ON m.origin_hub_id = b1.id
        LEFT JOIN branches b2 ON m.destination_hub_id = b2.id
        LEFT JOIN transport_runs tr ON m.transport_run_id = tr.id
        WHERE m.id = ? OR m.manifest_number = ?
    `, [isNaN(Number(id)) ? -1 : Number(id), String(id)]);

    if (!manifest) return null;

    const items = await dbAdapter.all(`
        SELECT mi.*, s.tracking_number, s.waybill_number, s.status as shipment_status,
               s.sender_name, s.recipient_name, s.actual_weight_kg, s.total_amount
        FROM manifest_items mi
        LEFT JOIN shipments s ON mi.shipment_id = s.id
        WHERE mi.manifest_id = ?
    `, [manifest.id]);

    return {
        ...manifest,
        items
    };
}

/**
 * Cross-border: Submit customs documentation for a cross-border leg
 */
async function submitCustomsDeclaration(legId, payload = {}, user = {}) {
    const leg = await dbAdapter.get('SELECT * FROM shipment_legs WHERE id = ?', [legId]);
    if (!leg) throw new Error(`Shipment leg #${legId} not found`);
    if (!leg.is_cross_border) throw new Error(`Leg #${legId} is not designated as cross-border`);

    const customsDocNumber = payload.customs_doc_number || `CUST-DOC-${Date.now().toString().slice(-6)}`;
    const borderPost = payload.border_post_name || leg.border_post_name || 'Namanga Border Post';

    return await dbAdapter.withTransaction(async (client) => {
        await dbAdapter.run(`
            UPDATE shipment_legs SET
                customs_status = 'SUBMITTED',
                border_post_name = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [borderPost, legId], client);

        // Record tracking event on shipment
        await dbAdapter.run(`
            INSERT INTO tracking_events (
                shipment_id, leg_id, event_code, event_name,
                hub_id, location_desc, actor_id, actor_type, actor_name,
                description, is_customer_visible, metadata
            ) VALUES (?, ?, 'CUSTOMS_SUBMITTED', 'Customs Declaration Submitted', ?, ?, ?, 'STAFF', ?, ?, true, ?)
        `, [
            leg.shipment_id,
            legId,
            leg.origin_hub_id,
            borderPost,
            user.id || 1,
            user.fullName || 'Customs Broker',
            `Customs clearance declaration ${customsDocNumber} submitted at ${borderPost}`,
            JSON.stringify({
                customs_doc_number: customsDocNumber,
                border_post: borderPost,
                notes: payload.notes || null
            })
        ], client);

        return {
            leg_id: legId,
            shipment_id: leg.shipment_id,
            customs_status: 'SUBMITTED',
            customs_doc_number: customsDocNumber,
            border_post: borderPost
        };
    });
}

/**
 * Cross-border: Record customs physical inspection
 */
async function inspectCustomsLeg(legId, payload = {}, user = {}) {
    const leg = await dbAdapter.get('SELECT * FROM shipment_legs WHERE id = ?', [legId]);
    if (!leg) throw new Error(`Shipment leg #${legId} not found`);

    const borderPost = leg.border_post_name || 'Border Post';

    return await dbAdapter.withTransaction(async (client) => {
        await dbAdapter.run(`
            UPDATE shipment_legs SET
                customs_status = 'INSPECTION',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [legId], client);

        await dbAdapter.run(`
            INSERT INTO tracking_events (
                shipment_id, leg_id, event_code, event_name,
                hub_id, location_desc, actor_id, actor_type, actor_name,
                description, is_customer_visible, metadata
            ) VALUES (?, ?, 'CUSTOMS_INSPECTION', 'Customs Inspection Underway', ?, ?, ?, 'STAFF', ?, ?, true, ?)
        `, [
            leg.shipment_id,
            legId,
            leg.origin_hub_id,
            borderPost,
            user.id || 1,
            user.fullName || 'Customs Official',
            `Package undergoing mandatory customs inspection at ${borderPost}`,
            JSON.stringify({
                inspector_name: payload.inspector_name || user.fullName,
                notes: payload.notes || null
            })
        ], client);

        return {
            leg_id: legId,
            shipment_id: leg.shipment_id,
            customs_status: 'INSPECTION'
        };
    });
}

/**
 * Cross-border: Place customs hold with reason and auto-generate exception
 */
async function holdCustomsLeg(legId, payload = {}, user = {}) {
    const leg = await dbAdapter.get('SELECT * FROM shipment_legs WHERE id = ?', [legId]);
    if (!leg) throw new Error(`Shipment leg #${legId} not found`);
    if (!payload.reason) throw new Error('A specific reason is strictly mandatory when placing a customs hold');

    const borderPost = leg.border_post_name || 'Border Post';

    return await dbAdapter.withTransaction(async (client) => {
        await dbAdapter.run(`
            UPDATE shipment_legs SET
                customs_status = 'CUSTOMS_HOLD',
                customs_hold_reason = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [payload.reason, legId], client);

        // Put shipment on hold
        try {
            await shipmentService.transitionShipmentStatus(leg.shipment_id, 'ON_HOLD', {
                location_desc: borderPost,
                reason: payload.reason,
                notes: `Customs hold at ${borderPost}: ${payload.reason}`
            }, user);
        } catch {
            // Ignore if state transition is already non-pending
        }

        // Insert into exceptions table for Control Tower tracking
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const rand = Math.floor(1000 + Math.random() * 9000);
        const excNum = `EXC-${today}-${rand}`;

        await dbAdapter.run(`
            INSERT INTO exceptions (
                exception_number, shipment_id, hub_id, exception_type, severity, status,
                description, reported_by_user_id
            ) VALUES (?, ?, ?, 'CUSTOMS_HOLD', 'HIGH', 'OPEN', ?, ?)
        `, [
            excNum,
            leg.shipment_id,
            leg.origin_hub_id,
            `Customs Hold at ${borderPost}: ${payload.reason}`,
            user.id || 1
        ], client);

        return {
            leg_id: legId,
            shipment_id: leg.shipment_id,
            customs_status: 'CUSTOMS_HOLD',
            hold_reason: payload.reason
        };
    });
}

/**
 * Cross-border: Clear customs verification
 */
async function clearCustomsLeg(legId, payload = {}, user = {}) {
    const leg = await dbAdapter.get('SELECT * FROM shipment_legs WHERE id = ?', [legId]);
    if (!leg) throw new Error(`Shipment leg #${legId} not found`);

    const clearanceRef = payload.clearance_number || `CLR-KE-TZ-${Date.now().toString().slice(-6)}`;
    const borderPost = leg.border_post_name || 'Border Post';

    return await dbAdapter.withTransaction(async (client) => {
        await dbAdapter.run(`
            UPDATE shipment_legs SET
                customs_status = 'CLEARED',
                customs_hold_reason = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [legId], client);

        await dbAdapter.run(`
            INSERT INTO tracking_events (
                shipment_id, leg_id, event_code, event_name,
                hub_id, location_desc, actor_id, actor_type, actor_name,
                description, is_customer_visible, metadata
            ) VALUES (?, ?, 'CUSTOMS_CLEARED', 'Customs Cleared', ?, ?, ?, 'STAFF', ?, ?, true, ?)
        `, [
            leg.shipment_id,
            legId,
            leg.origin_hub_id,
            borderPost,
            user.id || 1,
            user.fullName || 'Customs Authority',
            `Customs cleared at ${borderPost}. Clearance certificate: ${clearanceRef}`,
            JSON.stringify({ clearance_number: clearanceRef })
        ], client);

        return {
            leg_id: legId,
            shipment_id: leg.shipment_id,
            customs_status: 'CLEARED',
            clearance_number: clearanceRef
        };
    });
}

/**
 * Cross-border: Release customs inspection and permit continuation of transit leg
 */
async function releaseCustomsLeg(legId, user = {}) {
    const leg = await dbAdapter.get('SELECT * FROM shipment_legs WHERE id = ?', [legId]);
    if (!leg) throw new Error(`Shipment leg #${legId} not found`);

    const borderPost = leg.border_post_name || 'Border Post';

    return await dbAdapter.withTransaction(async (client) => {
        await dbAdapter.run(`
            UPDATE shipment_legs SET
                customs_status = 'RELEASED',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [legId], client);

        // Resume IN_TRANSIT status on shipment if was on hold
        const shipment = await dbAdapter.get('SELECT status FROM shipments WHERE id = ?', [leg.shipment_id], client);
        if (shipment && shipment.status === 'ON_HOLD') {
            await shipmentService.transitionShipmentStatus(leg.shipment_id, 'IN_TRANSIT', {
                location_desc: `Departed ${borderPost} after customs release`,
                notes: `Customs released at ${borderPost}. Continuing transit.`
            }, user);
        }

        await dbAdapter.run(`
            INSERT INTO tracking_events (
                shipment_id, leg_id, event_code, event_name,
                hub_id, location_desc, actor_id, actor_type, actor_name,
                description, is_customer_visible, metadata
            ) VALUES (?, ?, 'CUSTOMS_RELEASED', 'Customs Released & En Route', ?, ?, ?, 'STAFF', ?, ?, true, ?)
        `, [
            leg.shipment_id,
            legId,
            leg.origin_hub_id,
            borderPost,
            user.id || 1,
            user.fullName || 'Border Gate Officer',
            `Released from ${borderPost}. Vehicle cleared to proceed to next destination hub.`,
            JSON.stringify({ released: true })
        ], client);

        return {
            leg_id: legId,
            shipment_id: leg.shipment_id,
            customs_status: 'RELEASED'
        };
    });
}

/**
 * Lists cross-border shipment legs with filtering
 */
async function getCrossBorderLegs(filters = {}) {
    let sql = `
        SELECT sl.*,
               s.tracking_number, s.waybill_number, s.status as shipment_status,
               s.chargeable_weight_kg, s.declared_value, s.currency,
               orig.name as origin_hub_name, orig.city as origin_hub_city,
               dest.name as destination_hub_name, dest.city as destination_hub_city,
               tr.run_number
        FROM shipment_legs sl
        JOIN shipments s ON sl.shipment_id = s.id
        JOIN branches orig ON sl.origin_hub_id = orig.id
        JOIN branches dest ON sl.destination_hub_id = dest.id
        LEFT JOIN transport_runs tr ON sl.transport_run_id = tr.id
        WHERE sl.is_cross_border = true
    `;
    const params = [];
    if (filters.customs_status) {
        sql += ` AND sl.customs_status = ?`;
        params.push(filters.customs_status);
    }
    if (filters.border_post) {
        sql += ` AND sl.border_post_name = ?`;
        params.push(filters.border_post);
    }
    sql += ` ORDER BY sl.id DESC`;
    return await dbAdapter.all(sql, params);
}

module.exports = {
    RUN_STATUSES,
    ALLOWED_RUN_TRANSITIONS,
    generateRunNumber,
    generateManifestNumber,
    createRoute,
    getRouteById,
    listRoutes,
    createTransportRun,
    getTransportRunById,
    listTransportRuns,
    addShipmentToManifest,
    removeShipmentFromManifest,
    lockManifest,
    dispatchTransportRun,
    recordCheckpoint,
    arriveTransportRun,
    receiveManifest,
    listManifests,
    getManifestById,
    submitCustomsDeclaration,
    inspectCustomsLeg,
    holdCustomsLeg,
    clearCustomsLeg,
    releaseCustomsLeg,
    getCrossBorderLegs
};
