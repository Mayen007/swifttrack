// server/repositories/codRepository.js
// Enterprise Data Access Layer: COD Settlements, Remittance & Financial Audit Logging

const dbAdapter = require('../db/dbAdapter.js');

class CodRepository {
    constructor() {
        this.dbAdapter = dbAdapter;
    }

    /**
     * Finds a COD settlement by ID (Async).
     */
    async findSettlementById(id, tx = null) {
        return await dbAdapter.get('SELECT * FROM cod_settlements WHERE id = ?', [id], tx?.client);
    }

    /**
     * Finds a COD settlement by shipment ID (Async).
     */
    async findSettlementByShipmentId(shipmentId, tx = null) {
        return await dbAdapter.get('SELECT * FROM cod_settlements WHERE shipment_id = ?', [shipmentId], tx?.client);
    }

    /**
     * Creates a new COD settlement record (Async).
     */
    async createSettlement(data, tx = null) {
        const sql = `
            INSERT INTO cod_settlements (
                settlement_number, shipment_id, delivery_id, expected_amount,
                collected_amount, remitted_amount, variance_amount, currency,
                status, hub_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            data.settlement_number, data.shipment_id, data.delivery_id || null,
            data.expected_amount, data.collected_amount || 0.00,
            data.remitted_amount || 0.00, data.variance_amount || 0.00,
            data.currency || 'KES', data.status || 'PENDING_COLLECTION',
            data.hub_id || 1
        ];
        const res = await dbAdapter.run(sql, params, tx?.client);
        return res.insertId;
    }

    /**
     * Updates COD settlement state and financials (Async).
     */
    async updateSettlement(id, updates, tx = null) {
        const setClauses = [];
        const params = [];
        for (const [key, val] of Object.entries(updates)) {
            setClauses.push(`${key} = ?`);
            params.push(val);
        }
        params.push(id);
        const sql = `UPDATE cod_settlements SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        return await dbAdapter.run(sql, params, tx?.client);
    }

    /**
     * Records an audit entry in the central audit_logs table (Async).
     */
    async recordAudit(auditData, tx = null) {
        const sql = `
            INSERT INTO audit_logs (
                user_id, role, action, resource, resource_id,
                previous_value, new_value, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            auditData.user_id || null, auditData.role || 'FINANCE_MANAGER', auditData.action, 'COD_SETTLEMENT',
            auditData.settlement_id ? String(auditData.settlement_id) : null,
            auditData.previous_value ? JSON.stringify(auditData.previous_value) : null,
            auditData.new_value ? JSON.stringify(auditData.new_value) : null,
            auditData.ip_address || '127.0.0.1', auditData.user_agent || 'System'
        ];
        const res = await dbAdapter.run(sql, params, tx?.client);
        return res.insertId;
    }

    /**
     * Retrieves audit trail for a settlement (Async).
     */
    async getAuditHistory(settlementId, tx = null) {
        return await dbAdapter.all(
            "SELECT * FROM audit_logs WHERE resource = 'COD_SETTLEMENT' AND resource_id = ? ORDER BY created_at ASC",
            [String(settlementId)],
            tx?.client
        );
    }
}

module.exports = new CodRepository();
