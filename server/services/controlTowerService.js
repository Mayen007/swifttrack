// server/services/controlTowerService.js
// SwiftTrack Logistics: Stage 8 Operations Control Tower & Network Telemetry
const { db } = require('../db/database.js');
const { logAuditEvent } = require('../middleware/audit.js');

/**
 * Returns comprehensive live operational summary answering PRD Section 20 questions:
 * 1. "What is happening now?" (live volume, lifecycle status distribution)
 * 2. "What needs attention?" (critical bottleneck alerts)
 * 3. "What is moving?" (active transport runs, corridor throughput)
 * 4. "How is the network performing?" (success rates, reconciliation, SLA)
 */
function getLiveOperationalSummary(query = {}, user = {}) {
    let effectiveHubId = null;
    if (user.roleName && user.roleName !== 'SUPER_ADMIN') {
        effectiveHubId = user.branchId ? Number(user.branchId) : null;
    } else if (query.hub_id) {
        effectiveHubId = Number(query.hub_id);
    }

    // 1. Shipment Lifecycle Volume Telemetry
    const shpSql = `
        SELECT 
            COUNT(*) as total_shipments,
            COUNT(CASE WHEN status = 'BOOKED' THEN 1 END) as booked_count,
            COUNT(CASE WHEN status = 'ACCEPTED' THEN 1 END) as accepted_count,
            COUNT(CASE WHEN status IN ('SORTED', 'AT_HUB') THEN 1 END) as at_hub_count,
            COUNT(CASE WHEN status = 'LOADED' THEN 1 END) as loaded_count,
            COUNT(CASE WHEN status = 'IN_TRANSIT' THEN 1 END) as in_transit_count,
            COUNT(CASE WHEN status = 'READY_FOR_DELIVERY' THEN 1 END) as ready_for_delivery_count,
            COUNT(CASE WHEN status = 'OUT_FOR_DELIVERY' THEN 1 END) as out_for_delivery_count,
            COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END) as delivered_count,
            COUNT(CASE WHEN status = 'DELIVERY_FAILED' THEN 1 END) as delivery_failed_count,
            COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled_count,
            COALESCE(SUM(chargeable_weight_kg), 0.0) as total_chargeable_weight_kg,
            COALESCE(SUM(total_parcels), 0) as total_parcels_count,
            COALESCE(SUM(total_amount), 0.0) as total_freight_revenue_kes
        FROM shipments
        WHERE (? IS NULL OR origin_hub_id = ? OR destination_hub_id = ? OR current_hub_id = ?)
    `;
    const shpStats = db.prepare(shpSql).get(effectiveHubId, effectiveHubId, effectiveHubId, effectiveHubId);

    // Active in-pipeline shipments (not delivered or cancelled)
    const activeShipmentsCount = (shpStats.booked_count || 0) +
        (shpStats.accepted_count || 0) +
        (shpStats.at_hub_count || 0) +
        (shpStats.loaded_count || 0) +
        (shpStats.in_transit_count || 0) +
        (shpStats.ready_for_delivery_count || 0) +
        (shpStats.out_for_delivery_count || 0);

    // 2. Last-Mile Delivery Operations
    const dlvSql = `
        SELECT 
            COUNT(*) as total_deliveries,
            COUNT(CASE WHEN status IN ('ASSIGNED', 'IN_TRANSIT') THEN 1 END) as active_deliveries,
            COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END) as delivered_deliveries,
            COUNT(CASE WHEN status IN ('RETURN_TO_HUB', 'FAILED') THEN 1 END) as failed_deliveries,
            COUNT(CASE WHEN attempt_count > 1 THEN 1 END) as multi_attempt_deliveries,
            COALESCE(AVG(attempt_count), 0.0) as avg_attempts
        FROM deliveries
        WHERE (? IS NULL OR hub_id = ?)
    `;
    const dlvStats = db.prepare(dlvSql).get(effectiveHubId, effectiveHubId);

    // 3. Transport Runs & Fleet Telemetry
    const runSql = `
        SELECT 
            COUNT(*) as total_runs,
            COUNT(CASE WHEN status IN ('IN_TRANSIT', 'DISPATCHED') THEN 1 END) as active_runs,
            COUNT(CASE WHEN status = 'SCHEDULED' THEN 1 END) as scheduled_runs,
            COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_runs
        FROM transport_runs
        WHERE (? IS NULL OR origin_hub_id = ? OR destination_hub_id = ?)
    `;
    const runStats = db.prepare(runSql).get(effectiveHubId, effectiveHubId, effectiveHubId);

    // 4. Cash on Delivery (COD) Settlements
    const codSql = `
        SELECT 
            COUNT(*) as total_settlements,
            COALESCE(SUM(expected_amount), 0.0) as total_expected,
            COALESCE(SUM(collected_amount), 0.0) as total_collected,
            COALESCE(SUM(remitted_amount), 0.0) as total_remitted,
            COALESCE(SUM(variance_amount), 0.0) as total_variance,
            COUNT(CASE WHEN status = 'DISCREPANT' OR variance_amount != 0.0 THEN 1 END) as discrepant_count,
            COUNT(CASE WHEN status = 'RECONCILED' THEN 1 END) as reconciled_count,
            COUNT(CASE WHEN status = 'PENDING_COLLECTION' THEN 1 END) as pending_collection_count
        FROM cod_settlements
        WHERE (? IS NULL OR hub_id = ?)
    `;
    const codStats = db.prepare(codSql).get(effectiveHubId, effectiveHubId);

    // 5. Physical Custody Discrepancies
    const discSql = `
        SELECT 
            COUNT(*) as open_discrepancies,
            COUNT(CASE WHEN severity = 'CRITICAL' THEN 1 END) as critical_count,
            COUNT(CASE WHEN severity = 'HIGH' THEN 1 END) as high_count,
            COUNT(CASE WHEN severity = 'MEDIUM' THEN 1 END) as medium_count
        FROM discrepancies
        WHERE status IN ('OPEN', 'INVESTIGATING')
          AND (? IS NULL OR hub_id = ?)
    `;
    const discStats = db.prepare(discSql).get(effectiveHubId, effectiveHubId);

    // 6. Calculate Network Health & Performance KPIs
    const completedDel = dlvStats.delivered_deliveries || 0;
    const failedDel = dlvStats.failed_deliveries || 0;
    const totalFinishedDel = completedDel + failedDel;
    const deliverySuccessRate = totalFinishedDel > 0
        ? Number(((completedDel / totalFinishedDel) * 100).toFixed(1))
        : 100.0;

    const totalCod = codStats.total_settlements || 0;
    const reconciledCod = codStats.reconciled_count || 0;
    const codReconciliationRate = totalCod > 0
        ? Number(((reconciledCod / totalCod) * 100).toFixed(1))
        : 100.0;

    const firstAttemptSuccessRate = completedDel > 0
        ? Number((((completedDel - (dlvStats.multi_attempt_deliveries || 0)) / completedDel) * 100).toFixed(1))
        : 100.0;

    return {
        timestamp: new Date().toISOString(),
        scoped_hub_id: effectiveHubId,
        is_global: !effectiveHubId,

        // 1. What is happening now?
        now: {
            active_pipeline_shipments: activeShipmentsCount,
            total_shipments_recorded: shpStats.total_shipments || 0,
            lifecycle: {
                booked: shpStats.booked_count || 0,
                accepted: shpStats.accepted_count || 0,
                at_hub: shpStats.at_hub_count || 0,
                loaded: shpStats.loaded_count || 0,
                in_transit: shpStats.in_transit_count || 0,
                ready_for_delivery: shpStats.ready_for_delivery_count || 0,
                out_for_delivery: shpStats.out_for_delivery_count || 0,
                delivered: shpStats.delivered_count || 0,
                delivery_failed: shpStats.delivery_failed_count || 0,
                cancelled: shpStats.cancelled_count || 0
            },
            volume: {
                total_parcels: shpStats.total_parcels_count || 0,
                total_weight_kg: Number((shpStats.total_chargeable_weight_kg || 0).toFixed(2)),
                freight_revenue_kes: Number((shpStats.total_freight_revenue_kes || 0).toFixed(2))
            }
        },

        // 2. What needs attention?
        attention: {
            open_discrepancies: discStats.open_discrepancies || 0,
            critical_discrepancies: discStats.critical_count || 0,
            delivery_failures: failedDel,
            cod_variances_unreconciled: codStats.discrepant_count || 0,
            stale_shipments_count: 0 // populated in getOperationalAlerts
        },

        // 3. What is moving?
        movement: {
            active_transport_runs: runStats.active_runs || 0,
            scheduled_transport_runs: runStats.scheduled_runs || 0,
            active_last_mile_deliveries: dlvStats.active_deliveries || 0,
            completed_deliveries: completedDel
        },

        // 4. Financial & COD Settlement Position
        cod: {
            expected_total_kes: Number((codStats.total_expected || 0).toFixed(2)),
            collected_total_kes: Number((codStats.total_collected || 0).toFixed(2)),
            variance_total_kes: Number((codStats.total_variance || 0).toFixed(2)),
            reconciled_count: reconciledCod,
            discrepant_count: codStats.discrepant_count || 0,
            reconciliation_rate_pct: codReconciliationRate
        },

        // 5. Network Performance KPIs
        performance: {
            delivery_success_rate_pct: deliverySuccessRate,
            first_attempt_success_rate_pct: Math.max(0, firstAttemptSuccessRate),
            avg_delivery_attempts: Number((dlvStats.avg_attempts || 1.0).toFixed(2)),
            cod_reconciliation_rate_pct: codReconciliationRate
        }
    };
}

/**
 * Returns prioritized actionable operational alerts ("What needs attention?")
 */
function getOperationalAlerts(query = {}, user = {}) {
    let effectiveHubId = null;
    if (user.roleName && user.roleName !== 'SUPER_ADMIN') {
        effectiveHubId = user.branchId ? Number(user.branchId) : null;
    } else if (query.hub_id) {
        effectiveHubId = Number(query.hub_id);
    }

    const alerts = [];

    // Alert Category A: Physical Manifest & Receiving Discrepancies
    const discSql = `
        SELECT 
            d.id, d.discrepancy_number, d.discrepancy_type, d.severity,
            d.description, d.status, d.hub_id, d.shipment_id, d.created_at,
            b.name as hub_name, b.code as hub_code,
            s.tracking_number
        FROM discrepancies d
        LEFT JOIN branches b ON d.hub_id = b.id
        LEFT JOIN shipments s ON d.shipment_id = s.id
        WHERE d.status IN ('OPEN', 'INVESTIGATING')
          AND (? IS NULL OR d.hub_id = ?)
        ORDER BY 
            CASE d.severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
            d.created_at DESC
        LIMIT 50
    `;
    const discrepancies = db.prepare(discSql).all(effectiveHubId, effectiveHubId);

    for (const d of discrepancies) {
        alerts.push({
            id: `DISC-${d.id}`,
            category: 'PHYSICAL_DISCREPANCY',
            severity: d.severity || 'HIGH',
            title: `${d.discrepancy_type.replace(/_/g, ' ')}: ${d.discrepancy_number}`,
            description: d.description,
            tracking_number: d.tracking_number || null,
            entity_type: 'DISCREPANCY',
            entity_id: d.id,
            hub_id: d.hub_id,
            hub_name: d.hub_name || 'Hub Depot',
            hub_code: d.hub_code || 'HUB',
            status: d.status,
            created_at: d.created_at,
            action_prompt: 'Investigate physical custody variance'
        });
    }

    // Alert Category B: Failed Deliveries & Return-to-Hub Exceptions
    const dlvSql = `
        SELECT 
            del.id, del.delivery_number, del.status, del.failure_reason, del.failure_notes,
            del.attempt_count, del.max_attempts, del.hub_id, del.updated_at,
            s.tracking_number, s.recipient_name, s.recipient_phone,
            b.name as hub_name, b.code as hub_code
        FROM deliveries del
        JOIN shipments s ON del.shipment_id = s.id
        JOIN branches b ON del.hub_id = b.id
        WHERE (del.status = 'RETURN_TO_HUB' OR (del.status = 'FAILED' AND del.attempt_count >= del.max_attempts))
          AND (? IS NULL OR del.hub_id = ?)
        ORDER BY del.updated_at DESC
        LIMIT 50
    `;
    const failedDeliveries = db.prepare(dlvSql).all(effectiveHubId, effectiveHubId);

    for (const del of failedDeliveries) {
        alerts.push({
            id: `DLV-${del.id}`,
            category: 'DELIVERY_FAILURE',
            severity: 'CRITICAL',
            title: `Delivery Failed (${del.attempt_count}/${del.max_attempts} attempts): ${del.delivery_number}`,
            description: `Shipment ${del.tracking_number} failed. Reason: ${del.failure_reason || 'Consignee unavailable'}. Consignee: ${del.recipient_name}`,
            tracking_number: del.tracking_number,
            entity_type: 'DELIVERY',
            entity_id: del.id,
            hub_id: del.hub_id,
            hub_name: del.hub_name,
            hub_code: del.hub_code,
            status: del.status,
            created_at: del.updated_at,
            action_prompt: 'Process return-to-hub intake or reschedule'
        });
    }

    // Alert Category C: COD Financial Variances
    const codSql = `
        SELECT 
            cs.id, cs.settlement_number, cs.status, cs.expected_amount, cs.collected_amount,
            cs.variance_amount, cs.currency, cs.hub_id, cs.created_at,
            s.tracking_number,
            b.name as hub_name, b.code as hub_code
        FROM cod_settlements cs
        JOIN shipments s ON cs.shipment_id = s.id
        JOIN branches b ON cs.hub_id = b.id
        WHERE (cs.status = 'DISCREPANT' OR (cs.variance_amount != 0.0 AND cs.status != 'RECONCILED'))
          AND (? IS NULL OR cs.hub_id = ?)
        ORDER BY cs.created_at DESC
        LIMIT 50
    `;
    const codVariances = db.prepare(codSql).all(effectiveHubId, effectiveHubId);

    for (const cs of codVariances) {
        alerts.push({
            id: `COD-${cs.id}`,
            category: 'COD_VARIANCE',
            severity: 'HIGH',
            title: `COD Financial Variance: ${cs.settlement_number}`,
            description: `Shipment ${cs.tracking_number}: Expected ${cs.currency} ${cs.expected_amount}, Collected ${cs.currency} ${cs.collected_amount}. Variance: ${cs.currency} ${cs.variance_amount}. Formal justification required.`,
            tracking_number: cs.tracking_number,
            entity_type: 'COD_SETTLEMENT',
            entity_id: cs.id,
            hub_id: cs.hub_id,
            hub_name: cs.hub_name,
            hub_code: cs.hub_code,
            status: cs.status,
            created_at: cs.created_at,
            action_prompt: 'Audit till tape & record variance justification'
        });
    }

    // Filter by severity if requested
    let filteredAlerts = alerts;
    if (query.severity) {
        const targetSev = query.severity.toUpperCase();
        filteredAlerts = alerts.filter(a => a.severity === targetSev);
    }
    if (query.category) {
        const targetCat = query.category.toUpperCase();
        filteredAlerts = filteredAlerts.filter(a => a.category === targetCat);
    }

    return {
        total_alerts: filteredAlerts.length,
        critical_count: filteredAlerts.filter(a => a.severity === 'CRITICAL').length,
        high_count: filteredAlerts.filter(a => a.severity === 'HIGH').length,
        medium_count: filteredAlerts.filter(a => a.severity === 'MEDIUM').length,
        alerts: filteredAlerts
    };
}

/**
 * Returns active transport corridors and in-transit runs ("What is moving?")
 */
function getActiveCorridorTelemetry(user = {}) {
    let effectiveHubId = null;
    if (user.roleName && user.roleName !== 'SUPER_ADMIN') {
        effectiveHubId = user.branchId ? Number(user.branchId) : null;
    }

    const runsSql = `
        SELECT 
            tr.id, tr.run_number, tr.status, tr.scheduled_departure, tr.actual_departure,
            tr.scheduled_arrival, tr.total_shipments_count, tr.total_parcels_count, tr.total_weight_kg,
            r.code as route_code, r.name as route_name, r.distance_km, r.estimated_duration_hours,
            orig.name as origin_hub_name, orig.code as origin_hub_code, orig.city as origin_city,
            dest.name as dest_hub_name, dest.code as dest_hub_code, dest.city as dest_city,
            v.registration_number as plate_number, v.registration_number, v.vehicle_type, v.model as vehicle_model,
            u.full_name as driver_name, u.phone as driver_phone,
            m.manifest_number, m.status as manifest_status
        FROM transport_runs tr
        JOIN route_legs rl ON tr.route_leg_id = rl.id
        JOIN routes r ON rl.route_id = r.id
        JOIN branches orig ON tr.origin_hub_id = orig.id
        JOIN branches dest ON tr.destination_hub_id = dest.id
        LEFT JOIN vehicles v ON tr.vehicle_id = v.id
        LEFT JOIN drivers d ON tr.driver_id = d.id
        LEFT JOIN users u ON d.user_id = u.id
        LEFT JOIN manifests m ON tr.id = m.transport_run_id
        WHERE tr.status IN ('DISPATCHED', 'IN_TRANSIT', 'SCHEDULED')
          AND (? IS NULL OR tr.origin_hub_id = ? OR tr.destination_hub_id = ?)
        ORDER BY tr.scheduled_departure ASC
    `;
    const runs = db.prepare(runsSql).all(effectiveHubId, effectiveHubId, effectiveHubId);

    // Attach latest waypoint checkpoint for in-transit runs
    for (const run of runs) {
        const latestCheckpoint = db.prepare(`
            SELECT checkpoint_name, location_desc, recorded_at, latitude, longitude
            FROM run_checkpoints
            WHERE transport_run_id = ?
            ORDER BY id DESC
            LIMIT 1
        `).get(run.id);
        run.latest_checkpoint = latestCheckpoint || null;
    }

    // Aggregate primary corridor volumes
    const corridorMap = {};
    for (const run of runs) {
        const key = `${run.origin_hub_code} → ${run.dest_hub_code}`;
        if (!corridorMap[key]) {
            corridorMap[key] = {
                corridor: key,
                origin_city: run.origin_city,
                dest_city: run.dest_city,
                active_runs_count: 0,
                total_parcels_in_transit: 0,
                total_weight_kg_in_transit: 0
            };
        }
        corridorMap[key].active_runs_count += 1;
        corridorMap[key].total_parcels_in_transit += run.total_parcels_count || 0;
        corridorMap[key].total_weight_kg_in_transit += run.total_weight_kg || 0;
    }

    return {
        total_active_runs: runs.length,
        runs,
        corridors: Object.values(corridorMap)
    };
}

/**
 * Returns station-by-station telemetry across all regional hubs
 */
function getHubNetworkTelemetry(user = {}) {
    const branches = db.prepare('SELECT id, code, name, city, address, phone FROM branches WHERE is_active = 1').all();

    const hubs = branches.map(hub => {
        // On hand at hub (under sorting or ready)
        const onHand = db.prepare(`
            SELECT COUNT(*) as count, COALESCE(SUM(chargeable_weight_kg), 0.0) as weight_kg
            FROM shipments
            WHERE current_hub_id = ? AND status IN ('ACCEPTED', 'SORTED', 'AT_HUB', 'READY_FOR_DELIVERY')
        `).get(hub.id);

        // Inbound en route to this hub
        const inbound = db.prepare(`
            SELECT COUNT(*) as count, COALESCE(SUM(chargeable_weight_kg), 0.0) as weight_kg
            FROM shipments
            WHERE destination_hub_id = ? AND status IN ('IN_TRANSIT', 'LOADED')
        `).get(hub.id);

        // Outbound departing this hub
        const outbound = db.prepare(`
            SELECT COUNT(*) as count
            FROM shipments
            WHERE origin_hub_id = ? AND status IN ('ACCEPTED', 'BOOKED')
        `).get(hub.id);

        // Active last-mile delivery tasks at this hub
        const activeDeliveries = db.prepare(`
            SELECT COUNT(*) as count
            FROM deliveries
            WHERE hub_id = ? AND status IN ('ASSIGNED', 'IN_TRANSIT')
        `).get(hub.id);

        // Open discrepancies at this hub
        const discrepancies = db.prepare(`
            SELECT COUNT(*) as count
            FROM discrepancies
            WHERE hub_id = ? AND status IN ('OPEN', 'INVESTIGATING')
        `).get(hub.id);

        return {
            hub_id: hub.id,
            hub_code: hub.code,
            hub_name: hub.name,
            city: hub.city,
            phone: hub.phone,
            on_hand_shipments: onHand.count || 0,
            on_hand_weight_kg: Number((onHand.weight_kg || 0).toFixed(1)),
            inbound_shipments: inbound.count || 0,
            inbound_weight_kg: Number((inbound.weight_kg || 0).toFixed(1)),
            outbound_shipments: outbound.count || 0,
            active_deliveries: activeDeliveries.count || 0,
            open_discrepancies: discrepancies.count || 0
        };
    });

    return {
        hubs_count: hubs.length,
        hubs
    };
}

/**
 * Fast-resolution or acknowledgment of a control tower operational alert
 */
function resolveAlert(alertType, entityId, resolutionData = {}, user = {}) {
    const cleanType = String(alertType || '').toUpperCase();
    const id = Number(entityId);

    if (cleanType === 'DISCREPANCY') {
        const disc = db.prepare('SELECT * FROM discrepancies WHERE id = ?').get(id);
        if (!disc) throw new Error(`Discrepancy ID ${id} not found`);

        const action = resolutionData.action || 'RESOLVED_BY_CONTROL_TOWER';
        const notes = resolutionData.notes || 'Acknowledged and investigated via Operations Control Tower';

        db.prepare(`
            UPDATE discrepancies
            SET status = 'RESOLVED',
                investigator_user_id = COALESCE(investigator_user_id, ?),
                resolution_action = ?,
                resolution_notes = ?,
                resolved_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(user.id || 1, action, notes, id);

        logAuditEvent({
            userId: user.id || 1,
            role: user.roleName || 'DISPATCHER',
            action: 'RESOLVE',
            resource: 'DISCREPANCY',
            resourceId: String(id),
            branchId: disc.hub_id,
            reason: notes
        });

        return { success: true, message: `Discrepancy ${disc.discrepancy_number} resolved successfully.` };
    }

    if (cleanType === 'DELIVERY') {
        const del = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(id);
        if (!del) throw new Error(`Delivery ID ${id} not found`);

        const notes = resolutionData.notes || 'Delivery failure acknowledged by Control Tower dispatcher';

        logAuditEvent({
            userId: user.id || 1,
            role: user.roleName || 'DISPATCHER',
            action: 'ACKNOWLEDGE',
            resource: 'DELIVERY',
            resourceId: String(id),
            branchId: del.hub_id,
            reason: notes
        });

        return { success: true, message: `Delivery task ${del.delivery_number} failure alert acknowledged.` };
    }

    throw new Error(`Unsupported alert resolution type: ${alertType}`);
}

module.exports = {
    getLiveOperationalSummary,
    getOperationalAlerts,
    getActiveCorridorTelemetry,
    getHubNetworkTelemetry,
    resolveAlert
};
