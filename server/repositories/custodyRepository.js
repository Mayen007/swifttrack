// server/repositories/custodyRepository.js
// Enterprise Data Access Layer: Physical Scans, Handoffs, Receiving Sessions & Discrepancies

const dbAdapter = require('../db/dbAdapter.js');
const { db: sqliteDb } = require('../db/database.js');

class CustodyRepository {
    constructor() {
        this.dbAdapter = dbAdapter;
    }

    /**
     * Records a physical barcode scan event with idempotency checking (Async).
     */
    async recordScanEvent(scanData, tx = null) {
        const sql = `
            INSERT INTO scan_events (
                scan_uuid, barcode, parcel_id, shipment_id, scan_type,
                hub_id, transport_run_id, location_desc, latitude, longitude,
                device_id, app_version, scanned_by_user_id, is_offline_sync, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            scanData.scan_uuid, scanData.barcode, scanData.parcel_id || null,
            scanData.shipment_id || null, scanData.scan_type, scanData.hub_id || null,
            scanData.transport_run_id || null, scanData.location_desc || null,
            scanData.latitude || null, scanData.longitude || null,
            scanData.device_id || null, scanData.app_version || '1.0.0',
            scanData.scanned_by_user_id || null, scanData.is_offline_sync ? 1 : 0,
            typeof scanData.metadata === 'object' ? JSON.stringify(scanData.metadata) : (scanData.metadata || '{}')
        ];
        const res = await dbAdapter.run(sql, params, tx?.client);
        return res.insertId;
    }

    /**
     * Finds a scan by its client idempotency UUID (Async).
     */
    async findScanByUuid(scanUuid, tx = null) {
        return await dbAdapter.get('SELECT * FROM scan_events WHERE scan_uuid = ?', [scanUuid], tx?.client);
    }

    /**
     * Creates a formal physical custody handoff (Async).
     */
    async createHandoff(handoffData, tx = null) {
        const sql = `
            INSERT INTO handoffs (
                handoff_number, shipment_id, transport_run_id, manifest_id,
                hub_id, handoff_type, releasing_actor_type, releasing_actor_id,
                releasing_actor_name, receiving_actor_type, receiving_actor_id,
                receiving_actor_name, notes, security_seal_number
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            handoffData.handoff_number, handoffData.shipment_id,
            handoffData.transport_run_id || null, handoffData.manifest_id || null,
            handoffData.hub_id || null, handoffData.handoff_type,
            handoffData.releasing_actor_type || 'STAFF', handoffData.releasing_actor_id || null,
            handoffData.releasing_actor_name || 'Staff', handoffData.receiving_actor_type || 'DRIVER',
            handoffData.receiving_actor_id || null, handoffData.receiving_actor_name || 'Driver',
            handoffData.notes || null, handoffData.security_seal_number || null
        ];
        const res = await dbAdapter.run(sql, params, tx?.client);
        return res.insertId;
    }

    /**
     * Creates a hub receiving session (Async).
     */
    async createReceivingSession(sessionData, tx = null) {
        const sql = `
            INSERT INTO hub_receiving_sessions (
                session_number, hub_id, transport_run_id, manifest_id,
                status, operator_user_id, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            sessionData.session_number, sessionData.hub_id, sessionData.transport_run_id || null,
            sessionData.manifest_id || null, sessionData.status || 'OPEN',
            sessionData.operator_user_id || sessionData.received_by_user_id || 1, sessionData.notes || null
        ];
        const res = await dbAdapter.run(sql, params, tx?.client);
        return res.insertId;
    }

    /**
     * Finds a receiving session by ID (Async).
     */
    async findReceivingSessionById(id, tx = null) {
        return await dbAdapter.get('SELECT * FROM hub_receiving_sessions WHERE id = ?', [id], tx?.client);
    }

    /**
     * Records an item in a receiving session (Async).
     */
    async addReceivingItem(itemData, tx = null) {
        const sql = `
            INSERT INTO hub_receiving_items (
                session_id, parcel_id, shipment_id, barcode,
                is_expected, is_damaged, condition_notes, scanned_by_user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            itemData.session_id, itemData.parcel_id || null, itemData.shipment_id || null,
            itemData.barcode, itemData.is_expected ? 1 : 0, itemData.is_damaged ? 1 : 0,
            itemData.condition_notes || null, itemData.scanned_by_user_id
        ];
        const res = await dbAdapter.run(sql, params, tx?.client);
        return res.insertId;
    }

    /**
     * Logs an operational discrepancy ticket (Async).
     */
    async createDiscrepancy(discData, tx = null) {
        const sql = `
            INSERT INTO discrepancies (
                discrepancy_number, discrepancy_type, severity, hub_id,
                shipment_id, parcel_id, transport_run_id, manifest_id,
                receiving_session_id, description, reported_by_user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            discData.discrepancy_number, discData.discrepancy_type, discData.severity || 'MEDIUM',
            discData.hub_id, discData.shipment_id || null, discData.parcel_id || null,
            discData.transport_run_id || null, discData.manifest_id || null,
            discData.receiving_session_id || null, discData.description,
            discData.reported_by_user_id
        ];
        const res = await dbAdapter.run(sql, params, tx?.client);
        return res.insertId;
    }
}

module.exports = new CustodyRepository();
