// server/repositories/transportRepository.js
// Enterprise Data Access Layer: Routes, Transport Runs, Manifests & Checkpoints

const dbAdapter = require('../db/dbAdapter.js');
const { db: sqliteDb } = require('../db/database.js');

class TransportRepository {
    constructor() {
        this.dbAdapter = dbAdapter;
    }

    /**
     * Finds a transport run by ID (Async).
     */
    async findRunById(id, tx = null) {
        return await dbAdapter.get('SELECT * FROM transport_runs WHERE id = ?', [id], tx?.client);
    }

    /**
     * Finds a transport run by ID (Sync).
     */
    findRunByIdSync(id) {
        if (!sqliteDb) throw new Error('Sync operations only supported under SQLite engine');
        return sqliteDb.prepare('SELECT * FROM transport_runs WHERE id = ?').get(id) || null;
    }

    /**
     * Creates a transport run (Async).
     */
    async createRun(runData, tx = null) {
        const sql = `
            INSERT INTO transport_runs (
                run_number, route_leg_id, origin_hub_id, destination_hub_id,
                driver_id, vehicle_id, dispatcher_user_id, status,
                scheduled_departure, scheduled_arrival, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            runData.run_number, runData.route_leg_id || null, runData.origin_hub_id,
            runData.destination_hub_id, runData.driver_id || null, runData.vehicle_id || null,
            runData.dispatcher_user_id, runData.status || 'PLANNED',
            runData.scheduled_departure || null, runData.scheduled_arrival || null,
            runData.notes || null
        ];
        const res = await dbAdapter.run(sql, params, tx?.client);
        return res.insertId;
    }

    /**
     * Updates transport run status and metrics (Async).
     */
    async updateRun(id, updates, tx = null) {
        const setClauses = [];
        const params = [];
        for (const [key, val] of Object.entries(updates)) {
            setClauses.push(`${key} = ?`);
            params.push(val);
        }
        params.push(id);
        const sql = `UPDATE transport_runs SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        return await dbAdapter.run(sql, params, tx?.client);
    }

    /**
     * Finds a manifest by ID (Async).
     */
    async findManifestById(id, tx = null) {
        return await dbAdapter.get('SELECT * FROM manifests WHERE id = ?', [id], tx?.client);
    }

    /**
     * Finds a manifest by ID (Sync).
     */
    findManifestByIdSync(id) {
        if (!sqliteDb) throw new Error('Sync operations only supported under SQLite engine');
        return sqliteDb.prepare('SELECT * FROM manifests WHERE id = ?').get(id) || null;
    }

    /**
     * Creates a linehaul manifest (Async).
     */
    async createManifest(manifestData, tx = null) {
        const sql = `
            INSERT INTO manifests (
                manifest_number, transport_run_id, origin_hub_id, destination_hub_id,
                status, notes
            ) VALUES (?, ?, ?, ?, ?, ?)
        `;
        const params = [
            manifestData.manifest_number, manifestData.transport_run_id, manifestData.origin_hub_id,
            manifestData.destination_hub_id, manifestData.status || 'DRAFT', manifestData.notes || null
        ];
        const res = await dbAdapter.run(sql, params, tx?.client);
        return res.insertId;
    }

    /**
     * Updates manifest record (Async).
     */
    async updateManifest(id, updates, tx = null) {
        const setClauses = [];
        const params = [];
        for (const [key, val] of Object.entries(updates)) {
            setClauses.push(`${key} = ?`);
            params.push(val);
        }
        params.push(id);
        const sql = `UPDATE manifests SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        return await dbAdapter.run(sql, params, tx?.client);
    }

    /**
     * Adds an item to a manifest (Async).
     */
    async addManifestItem(itemData, tx = null) {
        const sql = `
            INSERT INTO manifest_items (
                manifest_id, shipment_id, shipment_leg_id, status
            ) VALUES (?, ?, ?, ?)
        `;
        const params = [
            itemData.manifest_id, itemData.shipment_id, itemData.shipment_leg_id || null,
            itemData.status || 'ASSIGNED'
        ];
        const res = await dbAdapter.run(sql, params, tx?.client);
        return res.insertId;
    }

    /**
     * Retrieves all items assigned to a manifest (Async).
     */
    async getManifestItems(manifestId, tx = null) {
        const sql = `
            SELECT mi.*, s.tracking_number, s.status as shipment_status,
                   s.total_parcels, s.actual_weight_kg
            FROM manifest_items mi
            JOIN shipments s ON mi.shipment_id = s.id
            WHERE mi.manifest_id = ?
        `;
        return await dbAdapter.all(sql, [manifestId], tx?.client);
    }

    /**
     * Records a transport run checkpoint (Async).
     */
    async createCheckpoint(checkpointData, tx = null) {
        const sql = `
            INSERT INTO run_checkpoints (
                transport_run_id, checkpoint_name, location_desc,
                latitude, longitude, recorded_by_driver_id, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            checkpointData.transport_run_id, checkpointData.checkpoint_name,
            checkpointData.location_desc || null, checkpointData.latitude || null,
            checkpointData.longitude || null, checkpointData.recorded_by_driver_id || null,
            checkpointData.notes || null
        ];
        const res = await dbAdapter.run(sql, params, tx?.client);
        return res.insertId;
    }
}

module.exports = new TransportRepository();
