// server/repositories/deliveryRepository.js
// Enterprise Data Access Layer: Deliveries, Attempts & Proof of Delivery (POD)

const dbAdapter = require('../db/dbAdapter.js');

class DeliveryRepository {
    constructor() {
        this.dbAdapter = dbAdapter;
    }

    /**
     * Finds a delivery record by ID (Async).
     */
    async findDeliveryById(id, tx = null) {
        return await dbAdapter.get('SELECT * FROM deliveries WHERE id = ?', [id], tx?.client);
    }

    /**
     * Finds a delivery record by shipment ID (Async).
     */
    async findDeliveryByShipmentId(shipmentId, tx = null) {
        return await dbAdapter.get('SELECT * FROM deliveries WHERE shipment_id = ?', [shipmentId], tx?.client);
    }

    /**
     * Creates a new doorstep delivery record (Async).
     */
    async createDelivery(deliveryData, tx = null) {
        const sql = `
            INSERT INTO deliveries (
                branch_id, delivery_number, shipment_id, hub_id, driver_id, vehicle_id,
                dispatcher_user_id, status, recipient_name, recipient_phone,
                destination_address, destination_city, cod_amount_expected
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            deliveryData.branch_id || deliveryData.hub_id || 1,
            deliveryData.delivery_number, deliveryData.shipment_id, deliveryData.hub_id || 1,
            deliveryData.driver_id || null, deliveryData.vehicle_id || null,
            deliveryData.dispatcher_user_id || 1,
            deliveryData.status || 'PENDING', deliveryData.recipient_name,
            deliveryData.recipient_phone, deliveryData.destination_address,
            deliveryData.destination_city || 'Nairobi', deliveryData.cod_amount_expected || 0.00
        ];
        const res = await dbAdapter.run(sql, params, tx?.client);
        return res.insertId;
    }

    /**
     * Updates a delivery record (Async).
     */
    async updateDelivery(id, updates, tx = null) {
        const setClauses = [];
        const params = [];
        for (const [key, val] of Object.entries(updates)) {
            setClauses.push(`${key} = ?`);
            params.push(val);
        }
        params.push(id);
        const sql = `UPDATE deliveries SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        return await dbAdapter.run(sql, params, tx?.client);
    }

    /**
     * Records a delivery attempt (Async).
     */
    async createAttempt(attemptData, tx = null) {
        const sql = `
            INSERT INTO delivery_attempts (
                delivery_id, shipment_id, attempt_number, status,
                failure_reason, failure_notes, driver_id, latitude, longitude
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            attemptData.delivery_id, attemptData.shipment_id,
            attemptData.attempt_number || 1, attemptData.status || 'FAILED',
            attemptData.failure_reason || null, attemptData.failure_notes || null,
            attemptData.driver_id || null, attemptData.latitude || null,
            attemptData.longitude || null
        ];
        const res = await dbAdapter.run(sql, params, tx?.client);
        return res.insertId;
    }

    /**
     * Inserts an immutable Proof of Delivery record (Async).
     */
    async createPOD(podData, tx = null) {
        const sql = `
            INSERT INTO proof_of_delivery (
                delivery_id, shipment_id, recipient_name, recipient_phone,
                otp_code, otp_verified, signature_data, photo_data,
                latitude, longitude, device_id, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            podData.delivery_id || null, podData.shipment_id, podData.recipient_name,
            podData.recipient_phone || '+254700000000', podData.otp_code || null,
            Boolean(podData.otp_verified), podData.signature_data || null,
            podData.photo_data || podData.photo_url || null,
            podData.latitude || null, podData.longitude || null,
            podData.device_id || null, podData.notes || null
        ];
        const res = await dbAdapter.run(sql, params, tx?.client);
        return res.insertId;
    }

    /**
     * Retrieves POD record by shipment ID (Async).
     */
    async getPODByShipmentId(shipmentId, tx = null) {
        return await dbAdapter.get('SELECT * FROM proof_of_delivery WHERE shipment_id = ?', [shipmentId], tx?.client);
    }
}

module.exports = new DeliveryRepository();
