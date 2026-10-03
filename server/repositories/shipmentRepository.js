// server/repositories/shipmentRepository.js
// Enterprise Data Access Layer: Shipments, Parcels, Legs & Tracking Events

const dbAdapter = require('../db/dbAdapter.js');

class ShipmentRepository {
    constructor() {
        this.dbAdapter = dbAdapter;
    }

    /**
     * Finds a shipment by primary ID (Async).
     */
    async findById(id, tx = null) {
        return await dbAdapter.get('SELECT * FROM shipments WHERE id = ?', [id], tx?.client);
    }

    /**
     * Finds a shipment by tracking number (Async).
     */
    async findByTrackingNumber(trackingNumber, tx = null) {
        return await dbAdapter.get('SELECT * FROM shipments WHERE tracking_number = ?', [trackingNumber], tx?.client);
    }

    /**
     * Inserts a new shipment record (Async).
     */
    async create(shipmentData, tx = null) {
        const sql = `
            INSERT INTO shipments (
                tracking_number, waybill_number, origin_hub_id, destination_hub_id, current_hub_id,
                current_location_desc, sender_customer_id, sender_name, sender_phone, sender_email,
                sender_address, sender_city, recipient_customer_id, recipient_name, recipient_phone,
                recipient_email, recipient_address, recipient_city, service_type, delivery_type,
                status, total_parcels, actual_weight_kg, volumetric_weight_kg, chargeable_weight_kg,
                declared_value, currency, base_rate, weight_charge, surcharges,
                discount_amount, tax_amount, total_amount, payment_terms, payment_status,
                cod_amount, cod_fee, special_instructions, created_by_user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            shipmentData.tracking_number, shipmentData.waybill_number, shipmentData.origin_hub_id,
            shipmentData.destination_hub_id, shipmentData.current_hub_id, shipmentData.current_location_desc,
            shipmentData.sender_customer_id || null, shipmentData.sender_name, shipmentData.sender_phone,
            shipmentData.sender_email || null, shipmentData.sender_address, shipmentData.sender_city,
            shipmentData.recipient_customer_id || null, shipmentData.recipient_name, shipmentData.recipient_phone,
            shipmentData.recipient_email || null, shipmentData.recipient_address, shipmentData.recipient_city,
            shipmentData.service_type || 'STANDARD', shipmentData.delivery_type || 'LAST_MILE',
            shipmentData.status || 'BOOKED', shipmentData.total_parcels || 1,
            shipmentData.actual_weight_kg || 0, shipmentData.volumetric_weight_kg || 0,
            shipmentData.chargeable_weight_kg || 0, shipmentData.declared_value || 0,
            shipmentData.currency || 'KES', shipmentData.base_rate || 0,
            shipmentData.weight_charge || 0, shipmentData.surcharges || 0,
            shipmentData.discount_amount || 0, shipmentData.tax_amount || 0,
            shipmentData.total_amount || 0, shipmentData.payment_terms || 'PREPAID',
            shipmentData.payment_status || 'PENDING', shipmentData.cod_amount || 0,
            shipmentData.cod_fee || 0, shipmentData.special_instructions || null,
            shipmentData.created_by_user_id
        ];

        const res = await dbAdapter.run(sql, params, tx?.client);
        return res.insertId;
    }

    /**
     * Inserts a new parcel record (Async).
     */
    async createParcel(parcelData, tx = null) {
        const sql = `
            INSERT INTO parcels (
                shipment_id, parcel_number, parcel_index, weight_kg, length_cm,
                width_cm, height_cm, volumetric_weight_kg, package_type, description,
                condition_at_intake, intake_notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            parcelData.shipment_id, parcelData.parcel_number, parcelData.parcel_index,
            parcelData.weight_kg, parcelData.length_cm, parcelData.width_cm,
            parcelData.height_cm, parcelData.volumetric_weight_kg, parcelData.package_type || 'BOX',
            parcelData.description || null, parcelData.condition_at_intake || 'INTACT',
            parcelData.intake_notes || null
        ];
        const res = await dbAdapter.run(sql, params, tx?.client);
        return res.insertId;
    }

    /**
     * Retrieves parcels for a shipment (Async).
     */
    async getParcels(shipmentId, tx = null) {
        return await dbAdapter.all('SELECT * FROM parcels WHERE shipment_id = ? ORDER BY parcel_index ASC', [shipmentId], tx?.client);
    }

    /**
     * Inserts a shipment routing leg (Async).
     */
    async createLeg(legData, tx = null) {
        const sql = `
            INSERT INTO shipment_legs (
                shipment_id, leg_sequence, origin_hub_id, destination_hub_id,
                status, transport_run_id, manifest_id, is_cross_border,
                border_post_name, customs_status, scheduled_departure, scheduled_arrival
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            legData.shipment_id, legData.leg_sequence, legData.origin_hub_id, legData.destination_hub_id,
            legData.status || 'PENDING', legData.transport_run_id || null, legData.manifest_id || null,
            legData.is_cross_border ? true : false, legData.border_post_name || null,
            legData.customs_status || 'NOT_APPLICABLE',
            legData.scheduled_departure || null, legData.scheduled_arrival || null
        ];
        const res = await dbAdapter.run(sql, params, tx?.client);
        return res.insertId;
    }

    /**
     * Retrieves routing legs for a shipment (Async).
     */
    async getLegs(shipmentId, tx = null) {
        return await dbAdapter.all('SELECT * FROM shipment_legs WHERE shipment_id = ? ORDER BY leg_sequence ASC', [shipmentId], tx?.client);
    }

    /**
     * Updates shipment status (Async).
     */
    async updateStatus(id, newStatus, currentHubId = null, locationDesc = null, tx = null) {
        const sql = `
            UPDATE shipments 
            SET status = ?, current_hub_id = COALESCE(?, current_hub_id),
                current_location_desc = COALESCE(?, current_location_desc),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        return await dbAdapter.run(sql, [newStatus, currentHubId, locationDesc, id], tx?.client);
    }

    /**
     * Appends an immutable tracking event (Async).
     */
    async createTrackingEvent(eventData, tx = null) {
        const sql = `
            INSERT INTO tracking_events (
                shipment_id, parcel_id, leg_id, event_code, event_name,
                hub_id, location_desc, latitude, longitude, actor_id,
                actor_type, actor_name, description, is_customer_visible, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            eventData.shipment_id, eventData.parcel_id || null, eventData.leg_id || null,
            eventData.event_code, eventData.event_name, eventData.hub_id || null,
            eventData.location_desc || null, eventData.latitude || null, eventData.longitude || null,
            eventData.actor_id || null, eventData.actor_type || 'STAFF', eventData.actor_name || 'System',
            eventData.description, eventData.is_customer_visible !== false,
            typeof eventData.metadata === 'object' ? JSON.stringify(eventData.metadata) : (eventData.metadata || '{}')
        ];
        const res = await dbAdapter.run(sql, params, tx?.client);
        return res.insertId;
    }

    /**
     * Retrieves tracking history for a shipment (Async).
     */
    async getTrackingEvents(shipmentId, customerVisibleOnly = false, tx = null) {
        let sql = 'SELECT * FROM tracking_events WHERE shipment_id = ?';
        const params = [shipmentId];
        if (customerVisibleOnly) {
            sql += ' AND is_customer_visible = true';
        }
        sql += ' ORDER BY created_at ASC, id ASC';
        return await dbAdapter.all(sql, params, tx?.client);
    }
}

module.exports = new ShipmentRepository();
