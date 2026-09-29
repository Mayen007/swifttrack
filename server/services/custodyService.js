// server/services/custodyService.js
// SwiftTrack Logistics: Stage 4 Physical Custody & Hub Operations Domain Service
const { db } = require('../db/database.js');
const crypto = require('node:crypto');
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
// 1. SCAN EVENTS (High-Throughput Chain of Custody Barcode Scans)
// ============================================================================

/**
 * Records a single barcode/QR scan event with deduplication and tracking synchronization
 */
function recordScanEvent(data, user = {}) {
    const scanUuid = data.scan_uuid || crypto.randomUUID();

    // Check for offline sync idempotency (BR-013, BR-014)
    const existing = db.prepare('SELECT * FROM scan_events WHERE scan_uuid = ?').get(scanUuid);
    if (existing) {
        return {
            ...existing,
            is_duplicate: true
        };
    }

    if (!data.barcode) {
        throw new Error('Barcode is required for scan event');
    }

    const scanType = (data.scan_type || 'AUDIT').toUpperCase();

    // Look up shipment and parcel from barcode or tracking number
    let shipment = db.prepare('SELECT id, tracking_number, status, origin_hub_id, destination_hub_id, current_hub_id FROM shipments WHERE tracking_number = ?').get(data.barcode);
    let parcel = null;

    if (!shipment) {
        parcel = db.prepare('SELECT id, shipment_id, barcode FROM parcels WHERE barcode = ?').get(data.barcode);
        if (parcel) {
            shipment = db.prepare('SELECT id, tracking_number, status, origin_hub_id, destination_hub_id, current_hub_id FROM shipments WHERE id = ?').get(parcel.shipment_id);
        }
    }

    const hubId = data.hub_id || (user.branchId ? Number(user.branchId) : (shipment ? shipment.current_hub_id : null));

    const executeTx = db.transaction(() => {
        // Insert immutable scan event
        const scanStmt = db.prepare(`
            INSERT INTO scan_events (
                scan_uuid, barcode, shipment_id, parcel_id, scan_type,
                hub_id, transport_run_id, location_desc, latitude, longitude,
                device_id, app_version, scanned_by_user_id, scanned_at,
                is_offline_sync, synced_at, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
        `);

        scanStmt.run(
            scanUuid,
            data.barcode,
            shipment ? shipment.id : null,
            parcel ? parcel.id : null,
            scanType,
            hubId,
            data.transport_run_id || null,
            data.location_desc || (hubId ? `Hub #${hubId}` : 'Field Scanner'),
            data.latitude || null,
            data.longitude || null,
            data.device_id || null,
            data.app_version || null,
            user.id || null,
            data.scanned_at || new Date().toISOString(),
            data.is_offline_sync ? 1 : 0,
            data.metadata ? (typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata)) : null
        );

        // If shipment was identified, append tracking event and update state if needed
        if (shipment) {
            let nextStatus = null;
            let eventCode = `SCAN_${scanType}`;
            let eventName = `Barcode Scanned (${scanType})`;

            if (scanType === 'INTAKE' && shipment.status === 'BOOKED') {
                nextStatus = 'AT_ORIGIN_HUB';
                eventCode = 'ACCEPTED_AT_ORIGIN';
                eventName = 'Accepted at Origin Hub';
            } else if (scanType === 'SORT' && (shipment.status === 'AT_ORIGIN_HUB' || shipment.status === 'AT_HUB')) {
                nextStatus = 'SORTED';
                eventCode = 'SORTED_AT_HUB';
                eventName = 'Sorted for Dispatch';
            } else if (scanType === 'RECEIVE' && shipment.status === 'IN_TRANSIT') {
                nextStatus = 'AT_HUB';
                eventCode = 'RECEIVED_AT_HUB';
                eventName = 'Received at Destination Hub';
            }

            if (nextStatus) {
                db.prepare(`
                    UPDATE shipments 
                    SET status = ?, current_hub_id = COALESCE(?, current_hub_id), updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                `).run(nextStatus, hubId, shipment.id);
            }

            db.prepare(`
                INSERT INTO tracking_events (
                    shipment_id, event_code, event_name,
                    hub_id, location_desc, latitude, longitude,
                    actor_type, actor_name, description, is_customer_visible, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            `).run(
                shipment.id,
                eventCode,
                eventName,
                hubId,
                data.location_desc || (hubId ? `Hub #${hubId}` : 'Scan Station'),
                data.latitude || null,
                data.longitude || null,
                user.roleName || 'OPERATOR',
                user.fullName || 'Station Scanner',
                `Barcode ${data.barcode} scanned with operation ${scanType}`,
                JSON.stringify({ scan_uuid: scanUuid, device_id: data.device_id, scan_type: scanType })
            );
        }

        return db.prepare('SELECT * FROM scan_events WHERE scan_uuid = ?').get(scanUuid);
    });

    return executeTx();
}

/**
 * Records a batch of scan events (e.g. mobile scanner synchronizing after offline operation)
 */
function recordBatchScans(scans = [], user = {}) {
    if (!Array.isArray(scans) || scans.length === 0) {
        throw new Error('scans array must not be empty');
    }

    const results = {
        total: scans.length,
        processed: 0,
        duplicates: 0,
        items: []
    };

    const executeTx = db.transaction(() => {
        for (const scan of scans) {
            const item = recordScanEvent({ ...scan, is_offline_sync: true }, user);
            if (item.is_duplicate) {
                results.duplicates++;
            } else {
                results.processed++;
            }
            results.items.push(item);
        }
        return results;
    });

    return executeTx();
}

/**
 * Lists scan events with filters and pagination
 */
function listScanEvents(query = {}, user = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    let sql = 'SELECT se.*, s.tracking_number, b.name as hub_name FROM scan_events se LEFT JOIN shipments s ON se.shipment_id = s.id LEFT JOIN branches b ON se.hub_id = b.id WHERE 1=1';
    let countSql = 'SELECT count(*) as total FROM scan_events se WHERE 1=1';
    const params = [];
    const countParams = [];

    // Role-based branch scoping
    if (user.roleName !== 'SUPER_ADMIN' && user.branchId) {
        sql += ' AND (se.hub_id = ? OR se.hub_id IS NULL)';
        countSql += ' AND (se.hub_id = ? OR se.hub_id IS NULL)';
        params.push(user.branchId);
        countParams.push(user.branchId);
    }

    if (query.barcode) {
        sql += ' AND se.barcode LIKE ?';
        countSql += ' AND se.barcode LIKE ?';
        params.push(`%${query.barcode}%`);
        countParams.push(`%${query.barcode}%`);
    }

    if (query.scan_type) {
        sql += ' AND se.scan_type = ?';
        countSql += ' AND se.scan_type = ?';
        params.push(query.scan_type.toUpperCase());
        countParams.push(query.scan_type.toUpperCase());
    }

    if (query.shipment_id) {
        sql += ' AND se.shipment_id = ?';
        countSql += ' AND se.shipment_id = ?';
        params.push(Number(query.shipment_id));
        countParams.push(Number(query.shipment_id));
    }

    const total = db.prepare(countSql).get(...countParams)?.total || 0;

    sql += ' ORDER BY se.id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const items = db.prepare(sql).all(...params);

    return {
        scan_events: items,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
    };
}

// ============================================================================
// 2. CUSTODY HANDOFFS (Physical Custody Transfers Between Actors)
// ============================================================================

/**
 * Executes a formal chain of custody handoff between two parties
 */
function recordHandoff(data, user = {}) {
    if (!data.shipment_id && !data.tracking_number) {
        throw new Error('shipment_id or tracking_number is required for custody handoff');
    }

    let shipment = null;
    if (data.shipment_id) {
        shipment = db.prepare('SELECT id, tracking_number, status, current_hub_id FROM shipments WHERE id = ?').get(data.shipment_id);
    } else {
        shipment = db.prepare('SELECT id, tracking_number, status, current_hub_id FROM shipments WHERE tracking_number = ?').get(data.tracking_number);
    }

    if (!shipment) {
        throw new Error('Shipment not found for custody handoff');
    }

    const handoffNumber = generateSeqNumber('HND');
    const handoffType = data.handoff_type || 'HUB_TRANSFER';
    const packageCondition = (data.package_condition || 'GOOD').toUpperCase();
    const verificationMethod = (data.verification_method || 'BARCODE_SCAN').toUpperCase();

    const releasingType = data.releasing_actor_type || 'AGENT';
    const releasingName = data.releasing_actor_name || user.fullName || 'Releasing Agent';
    const receivingType = data.receiving_actor_type || 'DRIVER';
    const receivingName = data.receiving_actor_name || 'Receiving Party';

    const hubId = data.hub_id || user.branchId || shipment.current_hub_id;

    const executeTx = db.transaction(() => {
        // Insert handoff record
        const handoffStmt = db.prepare(`
            INSERT INTO handoffs (
                handoff_number, shipment_id, transport_run_id, manifest_id, hub_id,
                handoff_type, releasing_actor_type, releasing_actor_id, releasing_actor_name,
                receiving_actor_type, receiving_actor_id, receiving_actor_name,
                package_condition, seal_number, verification_method, signature_data,
                notes, transferred_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `);

        const info = handoffStmt.run(
            handoffNumber,
            shipment.id,
            data.transport_run_id || null,
            data.manifest_id || null,
            hubId || null,
            handoffType,
            releasingType,
            data.releasing_actor_id || null,
            releasingName,
            receivingType,
            data.receiving_actor_id || null,
            receivingName,
            packageCondition,
            data.seal_number || null,
            verificationMethod,
            data.signature_data || null,
            data.notes || null
        );

        const handoffId = info.lastInsertRowid;

        // Also record a physical scan event representing this transfer
        recordScanEvent({
            barcode: shipment.tracking_number,
            scan_type: 'AUDIT',
            hub_id: hubId,
            location_desc: `Handoff ${handoffNumber}`,
            metadata: { handoff_id: handoffId, handoff_type: handoffType }
        }, user);

        // Record tracking event
        db.prepare(`
            INSERT INTO tracking_events (
                shipment_id, event_code, event_name,
                hub_id, location_desc, actor_type, actor_name,
                description, is_customer_visible, metadata
            ) VALUES (?, 'CUSTODY_HANDOFF', 'Chain of Custody Transferred', ?, ?, ?, ?, ?, 1, ?)
        `).run(
            shipment.id,
            hubId || null,
            hubId ? `Hub #${hubId}` : 'Transfer Point',
            releasingType,
            releasingName,
            `Custody transferred from ${releasingName} (${releasingType}) to ${receivingName} (${receivingType}). Condition: ${packageCondition}`,
            JSON.stringify({ handoff_number: handoffNumber, condition: packageCondition, seal_number: data.seal_number })
        );

        let createdDiscrepancy = null;
        // If package condition is not GOOD, auto-flag a discrepancy record
        if (packageCondition !== 'GOOD') {
            createdDiscrepancy = createDiscrepancyInternal({
                discrepancy_type: packageCondition.includes('TAMPERED') ? 'TAMPERED_SEAL' : 'DAMAGED_PACKAGE',
                severity: 'HIGH',
                shipment_id: shipment.id,
                hub_id: hubId,
                transport_run_id: data.transport_run_id || null,
                manifest_id: data.manifest_id || null,
                description: `Package reported as ${packageCondition} during custody handoff ${handoffNumber}. Notes: ${data.notes || 'None'}`
            }, user);
        }

        return {
            handoff: db.prepare('SELECT * FROM handoffs WHERE id = ?').get(handoffId),
            discrepancy: createdDiscrepancy
        };
    });

    return executeTx();
}

/**
 * Lists custody handoffs
 */
function listHandoffs(query = {}, user = {}) {
    let sql = 'SELECT h.*, s.tracking_number, b.name as hub_name FROM handoffs h JOIN shipments s ON h.shipment_id = s.id LEFT JOIN branches b ON h.hub_id = b.id WHERE 1=1';
    const params = [];

    if (user.roleName !== 'SUPER_ADMIN' && user.branchId) {
        sql += ' AND (h.hub_id = ? OR h.hub_id IS NULL)';
        params.push(user.branchId);
    }

    if (query.shipment_id) {
        sql += ' AND h.shipment_id = ?';
        params.push(Number(query.shipment_id));
    }

    if (query.handoff_type) {
        sql += ' AND h.handoff_type = ?';
        params.push(query.handoff_type);
    }

    sql += ' ORDER BY h.id DESC LIMIT 100';

    const handoffs = db.prepare(sql).all(...params);
    return { handoffs, total: handoffs.length };
}

/**
 * Gets a handoff by ID
 */
function getHandoffById(id) {
    const handoff = db.prepare(`
        SELECT h.*, s.tracking_number, s.status as shipment_status, b.name as hub_name
        FROM handoffs h
        JOIN shipments s ON h.shipment_id = s.id
        LEFT JOIN branches b ON h.hub_id = b.id
        WHERE h.id = ?
    `).get(id);

    if (!handoff) return null;
    return handoff;
}

// ============================================================================
// 3. HUB RECEIVING SESSIONS (Intake & Inbound Unloading Bay Sessions)
// ============================================================================

/**
 * Opens a new receiving session at a hub station or unloading bay
 */
function openReceivingSession(data, user = {}) {
    const hubId = data.hub_id || user.branchId;
    if (!hubId) throw new Error('hub_id is required to open a receiving session');

    const sessionNumber = generateSeqNumber('RCV');
    let expectedCount = 0;

    // If attached to a manifest or run, calculate expected package count
    if (data.manifest_id) {
        const manifest = db.prepare('SELECT total_shipments, total_parcels FROM manifests WHERE id = ?').get(data.manifest_id);
        if (manifest) expectedCount = manifest.total_shipments || 0;
    } else if (data.transport_run_id) {
        const run = db.prepare('SELECT total_shipments_count FROM transport_runs WHERE id = ?').get(data.transport_run_id);
        if (run) expectedCount = run.total_shipments_count || 0;
    }

    const executeTx = db.transaction(() => {
        const info = db.prepare(`
            INSERT INTO hub_receiving_sessions (
                session_number, hub_id, transport_run_id, manifest_id,
                station_bay, operator_user_id, status, expected_packages_count,
                scanned_packages_count, intact_count, damaged_count, unexpected_count,
                started_at, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'IN_PROGRESS', ?, 0, 0, 0, 0, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)
        `).run(
            sessionNumber,
            hubId,
            data.transport_run_id || null,
            data.manifest_id || null,
            data.station_bay || 'Main Receiving Bay',
            user.id || 1,
            expectedCount,
            data.notes || null
        );

        return getReceivingSessionById(info.lastInsertRowid);
    });

    return executeTx();
}

/**
 * Scans an individual incoming package inside a receiving session
 */
function scanReceivingItem(sessionId, data, user = {}) {
    const session = db.prepare('SELECT * FROM hub_receiving_sessions WHERE id = ?').get(sessionId);
    if (!session) throw new Error(`Receiving session ${sessionId} not found`);
    if (session.status !== 'IN_PROGRESS') {
        throw new Error(`Cannot scan into receiving session with status ${session.status}`);
    }

    if (!data.barcode) throw new Error('Barcode is required for receiving scan');

    // Look up shipment by tracking number or parcel barcode
    let shipment = db.prepare('SELECT id, tracking_number, status, current_hub_id, destination_hub_id FROM shipments WHERE tracking_number = ?').get(data.barcode);
    let parcel = null;

    if (!shipment) {
        parcel = db.prepare('SELECT id, shipment_id, barcode FROM parcels WHERE barcode = ?').get(data.barcode);
        if (parcel) {
            shipment = db.prepare('SELECT id, tracking_number, status, current_hub_id, destination_hub_id FROM shipments WHERE id = ?').get(parcel.shipment_id);
        }
    }

    if (!shipment) {
        throw new Error(`Unrecognized barcode: ${data.barcode}. Shipment or parcel does not exist.`);
    }

    // Check if item was already scanned in this session
    const alreadyScanned = db.prepare('SELECT id FROM hub_receiving_items WHERE session_id = ? AND shipment_id = ?').get(sessionId, shipment.id);
    if (alreadyScanned) {
        throw new Error(`Shipment ${shipment.tracking_number} has already been scanned in this receiving session.`);
    }

    const condition = (data.condition || 'GOOD').toUpperCase();
    const isGoodCondition = condition === 'GOOD';

    // Verify if item is on the manifest (if attached to a manifest)
    let isExpected = 1;
    if (session.manifest_id) {
        const onManifest = db.prepare('SELECT id FROM manifest_items WHERE manifest_id = ? AND shipment_id = ?').get(session.manifest_id, shipment.id);
        if (!onManifest) {
            isExpected = 0;
        }
    }

    const executeTx = db.transaction(() => {
        // Record receiving item
        const itemInfo = db.prepare(`
            INSERT INTO hub_receiving_items (
                session_id, shipment_id, parcel_id, barcode,
                is_expected, condition, condition_notes, scanned_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
            sessionId,
            shipment.id,
            parcel ? parcel.id : null,
            data.barcode,
            isExpected,
            condition,
            data.condition_notes || null
        );

        // Record scan event
        recordScanEvent({
            barcode: data.barcode,
            scan_type: 'RECEIVE',
            hub_id: session.hub_id,
            location_desc: `Receiving Session ${session.session_number} (${session.station_bay})`,
            metadata: { session_id: sessionId, session_number: session.session_number, condition }
        }, user);

        let createdDiscrepancy = null;

        // Auto-create discrepancy if unexpected overage or damaged
        if (!isExpected) {
            createdDiscrepancy = createDiscrepancyInternal({
                discrepancy_type: 'UNEXPECTED_OVERAGE',
                severity: 'MEDIUM',
                shipment_id: shipment.id,
                hub_id: session.hub_id,
                transport_run_id: session.transport_run_id,
                manifest_id: session.manifest_id,
                receiving_session_id: sessionId,
                description: `Shipment ${shipment.tracking_number} received but was NOT listed on manifest #${session.manifest_id}.`
            }, user);
        } else if (!isGoodCondition) {
            createdDiscrepancy = createDiscrepancyInternal({
                discrepancy_type: condition.includes('TAMPERED') ? 'TAMPERED_SEAL' : 'DAMAGED_PACKAGE',
                severity: 'HIGH',
                shipment_id: shipment.id,
                hub_id: session.hub_id,
                transport_run_id: session.transport_run_id,
                manifest_id: session.manifest_id,
                receiving_session_id: sessionId,
                description: `Package arrived in ${condition} condition during receiving session ${session.session_number}. Notes: ${data.condition_notes || 'None'}`
            }, user);
        }

        // Update session counts
        db.prepare(`
            UPDATE hub_receiving_sessions
            SET scanned_packages_count = scanned_packages_count + 1,
                intact_count = intact_count + ?,
                damaged_count = damaged_count + ?,
                unexpected_count = unexpected_count + ?
            WHERE id = ?
        `).run(
            isGoodCondition ? 1 : 0,
            !isGoodCondition ? 1 : 0,
            !isExpected ? 1 : 0,
            sessionId
        );

        // Update shipment status to AT_HUB and current_hub_id
        db.prepare(`
            UPDATE shipments
            SET status = 'AT_HUB', current_hub_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(session.hub_id, shipment.id);

        return {
            item: db.prepare('SELECT * FROM hub_receiving_items WHERE id = ?').get(itemInfo.lastInsertRowid),
            discrepancy: createdDiscrepancy,
            session: db.prepare('SELECT * FROM hub_receiving_sessions WHERE id = ?').get(sessionId)
        };
    });

    return executeTx();
}

/**
 * Completes a receiving session and detects missing manifest items
 */
function completeReceivingSession(sessionId, data = {}, user = {}) {
    const session = db.prepare('SELECT * FROM hub_receiving_sessions WHERE id = ?').get(sessionId);
    if (!session) throw new Error(`Receiving session ${sessionId} not found`);
    if (session.status === 'COMPLETED') {
        throw new Error(`Receiving session ${sessionId} is already completed`);
    }

    const executeTx = db.transaction(() => {
        let missingCount = 0;
        const missingDiscrepancies = [];

        // If attached to a manifest, identify any manifest items that were never scanned
        if (session.manifest_id) {
            const manifestItems = db.prepare(`
                SELECT mi.shipment_id, s.tracking_number
                FROM manifest_items mi
                JOIN shipments s ON mi.shipment_id = s.id
                WHERE mi.manifest_id = ?
            `).all(session.manifest_id);

            const scannedShipmentIds = db.prepare('SELECT shipment_id FROM hub_receiving_items WHERE session_id = ?').all(sessionId).map(i => i.shipment_id);

            for (const item of manifestItems) {
                if (!scannedShipmentIds.includes(item.shipment_id)) {
                    missingCount++;
                    const disc = createDiscrepancyInternal({
                        discrepancy_type: 'MISSING_MANIFEST_ITEM',
                        severity: 'HIGH',
                        shipment_id: item.shipment_id,
                        hub_id: session.hub_id,
                        transport_run_id: session.transport_run_id,
                        manifest_id: session.manifest_id,
                        receiving_session_id: sessionId,
                        description: `Shipment ${item.tracking_number} on manifest #${session.manifest_id} was NOT found during receiving scan.`
                    }, user);
                    missingDiscrepancies.push(disc);

                    // Mark shipment exception via canonical state machine
                    shipmentService.transitionShipmentStatus(item.shipment_id, 'EXCEPTION', {
                        hub_id: session.hub_id,
                        reason: 'MISSING_MANIFEST_ITEM',
                        notes: `Shipment missing during hub receiving scan for session #${sessionId} manifest #${session.manifest_id}`
                    }, user);
                }
            }
        }

        const finalStatus = (session.damaged_count > 0 || session.unexpected_count > 0 || missingCount > 0)
            ? 'DISCREPANCY_FLAGGED'
            : 'COMPLETED';

        db.prepare(`
            UPDATE hub_receiving_sessions
            SET status = ?, completed_at = CURRENT_TIMESTAMP, notes = COALESCE(?, notes)
            WHERE id = ?
        `).run(finalStatus, data.notes || null, sessionId);

        return {
            session: db.prepare('SELECT * FROM hub_receiving_sessions WHERE id = ?').get(sessionId),
            missing_items_count: missingCount,
            missing_discrepancies: missingDiscrepancies
        };
    });

    return executeTx();
}

/**
 * Retrieves receiving session details with line items
 */
function getReceivingSessionById(id) {
    const session = db.prepare(`
        SELECT hrs.*, b.name as hub_name, u.full_name as operator_name
        FROM hub_receiving_sessions hrs
        JOIN branches b ON hrs.hub_id = b.id
        LEFT JOIN users u ON hrs.operator_user_id = u.id
        WHERE hrs.id = ?
    `).get(id);

    if (!session) return null;

    session.items = db.prepare(`
        SELECT hri.*, s.tracking_number, s.status as shipment_status
        FROM hub_receiving_items hri
        JOIN shipments s ON hri.shipment_id = s.id
        WHERE hri.session_id = ?
        ORDER BY hri.id ASC
    `).all(id);

    session.discrepancies = db.prepare(`
        SELECT * FROM discrepancies WHERE receiving_session_id = ? ORDER BY id ASC
    `).all(id);

    return session;
}

/**
 * Lists receiving sessions
 */
function listReceivingSessions(query = {}, user = {}) {
    let sql = 'SELECT hrs.*, b.name as hub_name, u.full_name as operator_name FROM hub_receiving_sessions hrs JOIN branches b ON hrs.hub_id = b.id LEFT JOIN users u ON hrs.operator_user_id = u.id WHERE 1=1';
    const params = [];

    if (user.roleName !== 'SUPER_ADMIN' && user.branchId) {
        sql += ' AND hrs.hub_id = ?';
        params.push(user.branchId);
    }

    if (query.hub_id) {
        sql += ' AND hrs.hub_id = ?';
        params.push(Number(query.hub_id));
    }

    if (query.status) {
        sql += ' AND hrs.status = ?';
        params.push(query.status.toUpperCase());
    }

    sql += ' ORDER BY hrs.id DESC LIMIT 100';

    const sessions = db.prepare(sql).all(...params);
    return { receiving_sessions: sessions, total: sessions.length };
}

// ============================================================================
// 4. DISCREPANCIES (Physical Inventory Exceptions & Investigations)
// ============================================================================

/**
 * Internal helper to create a discrepancy with audit trail
 */
function createDiscrepancyInternal(data, user = {}) {
    const discrepancyNumber = generateSeqNumber('DISC');

    const info = db.prepare(`
        INSERT INTO discrepancies (
            discrepancy_number, discrepancy_type, severity, shipment_id, parcel_id,
            hub_id, transport_run_id, manifest_id, receiving_session_id,
            status, description, reported_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
        discrepancyNumber,
        data.discrepancy_type,
        data.severity || 'MEDIUM',
        data.shipment_id || null,
        data.parcel_id || null,
        data.hub_id || (user.branchId ? Number(user.branchId) : null),
        data.transport_run_id || null,
        data.manifest_id || null,
        data.receiving_session_id || null,
        data.description,
        user.id || 1
    );

    // If shipment exists, log exception tracking event
    if (data.shipment_id) {
        db.prepare(`
            INSERT INTO tracking_events (
                shipment_id, event_code, event_name,
                hub_id, location_desc, actor_type, actor_name,
                description, is_customer_visible, metadata
            ) VALUES (?, 'DISCREPANCY_FLAGGED', 'Discrepancy Exception Flagged', ?, ?, ?, ?, ?, 0, ?)
        `).run(
            data.shipment_id,
            data.hub_id || null,
            data.hub_id ? `Hub #${data.hub_id}` : 'Station',
            user.roleName || 'OPERATOR',
            user.fullName || 'Station Operator',
            `Discrepancy ${discrepancyNumber}: ${data.description}`,
            JSON.stringify({ discrepancy_number: discrepancyNumber, type: data.discrepancy_type, severity: data.severity })
        );
    }

    return db.prepare('SELECT * FROM discrepancies WHERE id = ?').get(info.lastInsertRowid);
}

/**
 * Public method to explicitly create a discrepancy
 */
function createDiscrepancy(data, user = {}) {
    if (!data.description) throw new Error('description is required');
    if (!data.discrepancy_type) throw new Error('discrepancy_type is required');

    const executeTx = db.transaction(() => {
        return createDiscrepancyInternal(data, user);
    });

    return executeTx();
}

/**
 * Lists discrepancies with filters
 */
function listDiscrepancies(query = {}, user = {}) {
    let sql = 'SELECT d.*, s.tracking_number, b.name as hub_name, u.full_name as reported_by_name FROM discrepancies d LEFT JOIN shipments s ON d.shipment_id = s.id LEFT JOIN branches b ON d.hub_id = b.id LEFT JOIN users u ON d.reported_by_user_id = u.id WHERE 1=1';
    const params = [];

    if (user.roleName !== 'SUPER_ADMIN' && user.branchId) {
        sql += ' AND (d.hub_id = ? OR d.hub_id IS NULL)';
        params.push(user.branchId);
    }

    if (query.status) {
        sql += ' AND d.status = ?';
        params.push(query.status.toUpperCase());
    }

    if (query.discrepancy_type) {
        sql += ' AND d.discrepancy_type = ?';
        params.push(query.discrepancy_type.toUpperCase());
    }

    if (query.severity) {
        sql += ' AND d.severity = ?';
        params.push(query.severity.toUpperCase());
    }

    if (query.shipment_id) {
        sql += ' AND d.shipment_id = ?';
        params.push(Number(query.shipment_id));
    }

    sql += ' ORDER BY d.id DESC LIMIT 100';

    const discrepancies = db.prepare(sql).all(...params);
    return { discrepancies, total: discrepancies.length };
}

/**
 * Gets a discrepancy by ID
 */
function getDiscrepancyById(id) {
    const discrepancy = db.prepare(`
        SELECT d.*, s.tracking_number, s.status as shipment_status, b.name as hub_name,
               u_rep.full_name as reported_by_name, u_inv.full_name as investigator_name
        FROM discrepancies d
        LEFT JOIN shipments s ON d.shipment_id = s.id
        LEFT JOIN branches b ON d.hub_id = b.id
        LEFT JOIN users u_rep ON d.reported_by_user_id = u_rep.id
        LEFT JOIN users u_inv ON d.investigator_user_id = u_inv.id
        WHERE d.id = ?
    `).get(id);

    if (!discrepancy) return null;
    return discrepancy;
}

/**
 * Resolves an open discrepancy
 */
function resolveDiscrepancy(id, data = {}, user = {}) {
    const discrepancy = db.prepare('SELECT * FROM discrepancies WHERE id = ?').get(id);
    if (!discrepancy) throw new Error(`Discrepancy ${id} not found`);

    if (discrepancy.status === 'RESOLVED') {
        throw new Error(`Discrepancy ${discrepancy.discrepancy_number} is already resolved`);
    }

    const action = data.resolution_action || 'RESOLVED_BY_INVESTIGATION';
    const notes = data.resolution_notes || 'Discrepancy resolved upon investigation';

    const executeTx = db.transaction(() => {
        db.prepare(`
            UPDATE discrepancies
            SET status = 'RESOLVED',
                investigator_user_id = ?,
                resolution_action = ?,
                resolution_notes = ?,
                resolved_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(user.id || null, action, notes, id);

        // If attached to a shipment, record resolution event
        if (discrepancy.shipment_id) {
            db.prepare(`
                INSERT INTO tracking_events (
                    shipment_id, event_code, event_name,
                    hub_id, location_desc, actor_type, actor_name,
                    description, is_customer_visible, metadata
                ) VALUES (?, 'DISCREPANCY_RESOLVED', 'Discrepancy Resolved', ?, ?, ?, ?, ?, 1, ?)
            `).run(
                discrepancy.shipment_id,
                discrepancy.hub_id,
                discrepancy.hub_id ? `Hub #${discrepancy.hub_id}` : 'Operations Office',
                user.roleName || 'INVESTIGATOR',
                user.fullName || 'Operations Manager',
                `Discrepancy ${discrepancy.discrepancy_number} resolved: ${action}. ${notes}`,
                JSON.stringify({ discrepancy_number: discrepancy.discrepancy_number, action })
            );
        }

        return getDiscrepancyById(id);
    });

    return executeTx();
}

module.exports = {
    recordScanEvent,
    recordBatchScans,
    listScanEvents,
    recordHandoff,
    listHandoffs,
    getHandoffById,
    openReceivingSession,
    scanReceivingItem,
    completeReceivingSession,
    getReceivingSessionById,
    listReceivingSessions,
    createDiscrepancy,
    listDiscrepancies,
    getDiscrepancyById,
    resolveDiscrepancy
};
