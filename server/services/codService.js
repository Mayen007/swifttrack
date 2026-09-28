// server/services/codService.js
// SwiftTrack Logistics: Stage 7 Cash on Delivery (COD) Settlement & Financial Reconciliation
const crypto = require('node:crypto');
const { db } = require('../db/database.js');
const { logAuditEvent } = require('../middleware/audit.js');
const { checkPermission, SCOPES } = require('../config/permissions.js');

/**
 * Generates human-readable unique COD settlement identifier: COD-YYYYMMDD-XXXX
 */
function generateSettlementNumber() {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    for (let attempts = 0; attempts < 10; attempts++) {
        const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
        const candidate = `COD-${today}-${rand}`;
        const existing = db.prepare('SELECT id FROM cod_settlements WHERE settlement_number = ?').get(candidate);
        if (!existing) return candidate;
    }
    return `COD-${today}-${Date.now().toString().slice(-4)}`;
}

/**
 * Initializes an expected COD settlement record for a shipment
 * Triggered when a shipment with cod_amount > 0 is booked or assigned for delivery
 */
function createExpectedSettlement(data, user = {}) {
    if (!data.shipment_id) {
        throw new Error('shipment_id is required to create a COD settlement');
    }

    const shipment = db.prepare(`
        SELECT s.*, dest.name as destination_hub_name, dest.city as destination_city
        FROM shipments s
        JOIN branches dest ON s.destination_hub_id = dest.id
        WHERE s.id = ?
    `).get(data.shipment_id);

    if (!shipment) {
        throw new Error(`Shipment with ID ${data.shipment_id} not found`);
    }

    const expectedAmount = Number(data.expected_amount !== undefined ? data.expected_amount : (shipment.cod_amount || 0));
    if (expectedAmount <= 0) {
        throw new Error(`Cannot create COD settlement for shipment without positive COD amount (expected: ${expectedAmount})`);
    }

    // Check if an active COD settlement already exists for this shipment
    const existing = db.prepare('SELECT * FROM cod_settlements WHERE shipment_id = ?').get(shipment.id);
    if (existing) {
        // If delivery_id is now provided, link it
        if (data.delivery_id && !existing.delivery_id) {
            db.prepare('UPDATE cod_settlements SET delivery_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(data.delivery_id, existing.id);
            return getSettlementById(existing.id);
        }
        return getSettlementById(existing.id);
    }

    const settlementNumber = generateSettlementNumber();
    const hubId = Number(data.hub_id || shipment.destination_hub_id || user.branchId || 1);
    const currency = data.currency || shipment.currency || 'KES';

    const info = db.prepare(`
        INSERT INTO cod_settlements (
            settlement_number, shipment_id, delivery_id, hub_id, collector_id,
            expected_amount, collected_amount, remitted_amount, variance_amount,
            currency, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 0.0, 0.0, 0.0, ?, 'PENDING_COLLECTION', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
        settlementNumber,
        shipment.id,
        data.delivery_id || null,
        hubId,
        data.collector_id || null,
        expectedAmount,
        currency
    );

    const settlementId = info.lastInsertRowid;

    // Log Audit Event
    logAuditEvent({
        userId: user.id || 1,
        role: user.roleName || 'SYSTEM',
        action: 'CREATE',
        resource: 'COD_SETTLEMENT',
        resourceId: String(settlementId),
        branchId: hubId,
        newValue: { settlement_number: settlementNumber, shipment_id: shipment.id, expected_amount: expectedAmount },
        reason: 'Initialized expected COD settlement for shipment'
    });

    return getSettlementById(settlementId);
}

/**
 * Records collection of COD funds from recipient (by Driver upon delivery or Cashier at counter)
 */
function recordCollection(settlementId, data, user = {}) {
    const settlement = db.prepare('SELECT * FROM cod_settlements WHERE id = ?').get(settlementId);
    if (!settlement) {
        throw new Error(`COD settlement ${settlementId} not found`);
    }

    if (['RECONCILED', 'CANCELLED'].includes(settlement.status)) {
        throw new Error(`Cannot record collection on settlement in '${settlement.status}' status`);
    }

    // Role-based capability check: Driver, Cashier, Manager, Super Admin
    if (user.roleName) {
        const permCheck = checkPermission(user, 'cod', 'collect', { branchId: settlement.hub_id });
        if (!permCheck.granted && user.roleName !== 'SUPER_ADMIN') {
            throw new Error(permCheck.reason || 'Permission denied: Not authorized to collect COD');
        }
    }

    if (data.collected_amount === undefined || data.collected_amount === null || isNaN(Number(data.collected_amount))) {
        throw new Error('collected_amount is required and must be a valid number');
    }

    const collectedAmount = Number(Number(data.collected_amount).toFixed(2));
    if (collectedAmount < 0) {
        throw new Error('collected_amount cannot be negative');
    }

    const method = String(data.collection_method || 'CASH').toUpperCase();
    if (!['CASH', 'MPESA', 'BANK'].includes(method)) {
        throw new Error(`Invalid collection method: ${method}. Must be CASH, MPESA, or BANK.`);
    }

    const expectedAmount = Number(settlement.expected_amount);
    const varianceAmount = Number((collectedAmount - expectedAmount).toFixed(2));
    const newStatus = varianceAmount !== 0 ? 'DISCREPANT' : 'COLLECTED';
    const collectorId = user.id || settlement.collector_id || null;

    const executeTx = db.transaction(() => {
        db.prepare(`
            UPDATE cod_settlements
            SET collected_amount = ?,
                collection_method = ?,
                collection_reference = ?,
                variance_amount = ?,
                status = ?,
                collector_id = ?,
                collected_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            collectedAmount,
            method,
            data.collection_reference || null,
            varianceAmount,
            newStatus,
            collectorId,
            settlementId
        );

        // Record tracking event on shipment
        const shipment = db.prepare('SELECT id, destination_hub_id FROM shipments WHERE id = ?').get(settlement.shipment_id);
        if (shipment) {
            db.prepare(`
                INSERT INTO tracking_events (
                    shipment_id, event_code, event_name, hub_id,
                    location_desc, actor_type, actor_id, actor_name,
                    description, is_customer_visible, metadata
                ) VALUES (?, 'COD_COLLECTED', 'Cash on Delivery Collected', ?, ?, ?, ?, ?, ?, 1, ?)
            `).run(
                shipment.id,
                settlement.hub_id,
                'Delivery Collection Point',
                user.roleName || 'COLLECTOR',
                user.id || null,
                user.fullName || user.username || 'Collector',
                `COD collected: ${settlement.currency} ${collectedAmount.toFixed(2)} via ${method}.${varianceAmount !== 0 ? ` Variance noted: ${settlement.currency} ${varianceAmount.toFixed(2)}` : ''}`,
                JSON.stringify({
                    settlement_id: settlementId,
                    collected_amount: collectedAmount,
                    expected_amount: expectedAmount,
                    variance_amount: varianceAmount,
                    method,
                    reference: data.collection_reference || null
                })
            );
        }

        // Audit Log
        logAuditEvent({
            userId: user.id || 1,
            role: user.roleName || 'COLLECTOR',
            action: 'UPDATE',
            resource: 'COD_SETTLEMENT',
            resourceId: String(settlementId),
            branchId: settlement.hub_id,
            oldValue: { collected_amount: settlement.collected_amount, status: settlement.status },
            newValue: { collected_amount: collectedAmount, variance_amount: varianceAmount, status: newStatus },
            reason: `Recorded COD collection with variance ${varianceAmount}`
        });

        return getSettlementById(settlementId);
    });

    return executeTx();
}

/**
 * Records remittance of collected COD funds to depot finance / bank drop
 */
function recordRemittance(settlementId, data, user = {}) {
    const settlement = db.prepare('SELECT * FROM cod_settlements WHERE id = ?').get(settlementId);
    if (!settlement) {
        throw new Error(`COD settlement ${settlementId} not found`);
    }

    if (['PENDING_COLLECTION', 'RECONCILED', 'CANCELLED'].includes(settlement.status)) {
        throw new Error(`Cannot record remittance for settlement in '${settlement.status}' status. Funds must be collected first.`);
    }

    // Role-based capability check
    if (user.roleName) {
        const permCheck = checkPermission(user, 'cod', 'remit', { branchId: settlement.hub_id });
        if (!permCheck.granted && user.roleName !== 'SUPER_ADMIN') {
            throw new Error(permCheck.reason || 'Permission denied: Not authorized to remit COD funds');
        }
    }

    if (data.remitted_amount === undefined || data.remitted_amount === null || isNaN(Number(data.remitted_amount))) {
        throw new Error('remitted_amount is required and must be a valid number');
    }

    const remittedAmount = Number(Number(data.remitted_amount).toFixed(2));
    if (remittedAmount < 0) {
        throw new Error('remitted_amount cannot be negative');
    }

    const method = String(data.remittance_method || 'BANK_DEPOSIT').toUpperCase();
    if (!['BANK_DEPOSIT', 'MPESA_PAYBILL', 'CASH_DROP'].includes(method)) {
        throw new Error(`Invalid remittance method: ${method}. Must be BANK_DEPOSIT, MPESA_PAYBILL, or CASH_DROP.`);
    }

    // Calculate total variance between remitted and expected amount
    const expectedAmount = Number(settlement.expected_amount);
    const collectedAmount = Number(settlement.collected_amount);
    const varianceAmount = Number((remittedAmount - expectedAmount).toFixed(2));
    const isDiscrepant = varianceAmount !== 0 || Math.abs(remittedAmount - collectedAmount) > 0.01;
    const newStatus = isDiscrepant ? 'DISCREPANT' : 'REMITTED';

    const executeTx = db.transaction(() => {
        db.prepare(`
            UPDATE cod_settlements
            SET remitted_amount = ?,
                remittance_method = ?,
                remittance_reference = ?,
                variance_amount = ?,
                status = ?,
                remitted_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            remittedAmount,
            method,
            data.remittance_reference || null,
            varianceAmount,
            newStatus,
            settlementId
        );

        // Record tracking event
        const shipment = db.prepare('SELECT id FROM shipments WHERE id = ?').get(settlement.shipment_id);
        if (shipment) {
            db.prepare(`
                INSERT INTO tracking_events (
                    shipment_id, event_code, event_name, hub_id,
                    location_desc, actor_type, actor_id, actor_name,
                    description, is_customer_visible, metadata
                ) VALUES (?, 'COD_REMITTED', 'Cash on Delivery Remitted', ?, ?, ?, ?, ?, ?, 1, ?)
            `).run(
                shipment.id,
                settlement.hub_id,
                'Hub Finance Depot',
                user.roleName || 'COLLECTOR',
                user.id || null,
                user.fullName || user.username || 'Remitter',
                `COD remitted: ${settlement.currency} ${remittedAmount.toFixed(2)} via ${method} (Ref: ${data.remittance_reference || 'N/A'}).`,
                JSON.stringify({
                    settlement_id: settlementId,
                    remitted_amount: remittedAmount,
                    method,
                    reference: data.remittance_reference || null
                })
            );
        }

        // Audit Log
        logAuditEvent({
            userId: user.id || 1,
            role: user.roleName || 'COLLECTOR',
            action: 'UPDATE',
            resource: 'COD_SETTLEMENT',
            resourceId: String(settlementId),
            branchId: settlement.hub_id,
            oldValue: { remitted_amount: settlement.remitted_amount, status: settlement.status },
            newValue: { remitted_amount: remittedAmount, variance_amount: varianceAmount, status: newStatus },
            reason: `Recorded COD remittance via ${method}`
        });

        return getSettlementById(settlementId);
    });

    return executeTx();
}

/**
 * Reconciles and formally signs off a COD settlement (Rule BR-010, COD-006)
 * Strictly restricted to SUPER_ADMIN and BRANCH_MANAGER roles with cod:reconcile permission.
 * Requires mandatory variance_reason if financial discrepancy exists.
 */
function reconcileSettlement(settlementId, data, user = {}) {
    const settlement = db.prepare('SELECT * FROM cod_settlements WHERE id = ?').get(settlementId);
    if (!settlement) {
        throw new Error(`COD settlement ${settlementId} not found`);
    }

    if (settlement.status === 'RECONCILED') {
        throw new Error(`Settlement ${settlement.settlement_number} has already been reconciled`);
    }

    if (settlement.status === 'CANCELLED') {
        throw new Error(`Cannot reconcile a cancelled settlement`);
    }

    // 1. Role & Permission Authorization Gate
    // Cashiers and Drivers are strictly denied from reconciling settlements
    if (user.roleName === 'CASHIER' || user.roleName === 'DRIVER') {
        throw new Error(
            `Vertical Privilege Escalation Blocked: Role '${user.roleDisplayName || user.roleName}' is not authorized to reconcile COD settlements. Only Super Admin or Branch Manager can approve reconciliation.`
        );
    }

    if (user.roleName) {
        const permCheck = checkPermission(user, 'cod', 'reconcile', { branchId: settlement.hub_id });
        if (!permCheck.granted && user.roleName !== 'SUPER_ADMIN') {
            throw new Error(permCheck.reason || 'Permission denied: Not authorized to reconcile COD settlements');
        }
    }

    // 2. Branch Isolation: Branch Manager cannot reconcile settlements for other hubs
    if (user.roleName !== 'SUPER_ADMIN' && user.branchId && Number(settlement.hub_id) !== Number(user.branchId)) {
        throw new Error(
            `Horizontal Privilege Escalation Blocked: Cross-branch access denied. Operator assigned to branch ${user.branchId} cannot reconcile COD settlement belonging to hub ${settlement.hub_id}.`
        );
    }

    // 3. Rule BR-010: Mandatory Justification for Variances
    const expected = Number(settlement.expected_amount);
    const collected = Number(settlement.collected_amount);
    const remitted = Number(settlement.remitted_amount);
    const variance = Number(settlement.variance_amount);

    const hasFinancialVariance = Math.abs(variance) > 0.001 ||
        Math.abs(expected - collected) > 0.001 ||
        Math.abs(collected - remitted) > 0.001;

    if (hasFinancialVariance) {
        const reason = (data.variance_reason || '').trim();
        if (!reason) {
            throw new Error(
                `Business Rule BR-010 Violation: Mandatory variance justification required to reconcile COD settlement with financial variance of ${settlement.currency} ${variance.toFixed(2)}.`
            );
        }
    }

    const executeTx = db.transaction(() => {
        db.prepare(`
            UPDATE cod_settlements
            SET status = 'RECONCILED',
                reconciled_by_user_id = ?,
                reconciled_at = CURRENT_TIMESTAMP,
                reconciliation_notes = ?,
                variance_reason = COALESCE(?, variance_reason),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            user.id || null,
            data.reconciliation_notes || null,
            data.variance_reason ? data.variance_reason.trim() : null,
            settlementId
        );

        // Record tracking event
        const shipment = db.prepare('SELECT id FROM shipments WHERE id = ?').get(settlement.shipment_id);
        if (shipment) {
            db.prepare(`
                INSERT INTO tracking_events (
                    shipment_id, event_code, event_name, hub_id,
                    location_desc, actor_type, actor_id, actor_name,
                    description, is_customer_visible, metadata
                ) VALUES (?, 'COD_RECONCILED', 'Cash on Delivery Reconciled', ?, ?, ?, ?, ?, ?, 1, ?)
            `).run(
                shipment.id,
                settlement.hub_id,
                'Hub Finance Office',
                user.roleName || 'MANAGER',
                user.id || null,
                user.fullName || user.username || 'Reconciler',
                `COD settlement ${settlement.settlement_number} reconciled and closed by ${user.fullName || user.username}.${hasFinancialVariance ? ` Variance reason: ${data.variance_reason.trim()}` : ''}`,
                JSON.stringify({
                    settlement_id: settlementId,
                    reconciled_by: user.id,
                    has_variance: hasFinancialVariance,
                    variance_amount: variance
                })
            );
        }

        // Audit Log
        logAuditEvent({
            userId: user.id || 1,
            role: user.roleName || 'MANAGER',
            action: 'APPROVE',
            resource: 'COD_SETTLEMENT',
            resourceId: String(settlementId),
            branchId: settlement.hub_id,
            oldValue: { status: settlement.status },
            newValue: { status: 'RECONCILED', variance_reason: data.variance_reason || settlement.variance_reason },
            reason: `Reconciled COD settlement${hasFinancialVariance ? ` with justification: ${data.variance_reason}` : ''}`
        });

        return getSettlementById(settlementId);
    });

    return executeTx();
}

/**
 * Retrieves a single COD settlement by ID with full joined context
 */
function getSettlementById(settlementId, user = null) {
    const settlement = db.prepare(`
        SELECT 
            cs.*,
            s.tracking_number,
            s.waybill_number,
            s.status as shipment_status,
            s.sender_name,
            s.sender_phone,
            s.recipient_name,
            s.recipient_phone,
            b.name as hub_name,
            b.code as hub_code,
            b.city as hub_city,
            d.delivery_number,
            d.status as delivery_status,
            u_col.full_name as collector_name,
            u_col.username as collector_username,
            u_rec.full_name as reconciler_name,
            u_rec.username as reconciler_username
        FROM cod_settlements cs
        JOIN shipments s ON cs.shipment_id = s.id
        JOIN branches b ON cs.hub_id = b.id
        LEFT JOIN deliveries d ON cs.delivery_id = d.id
        LEFT JOIN users u_col ON cs.collector_id = u_col.id
        LEFT JOIN users u_rec ON cs.reconciled_by_user_id = u_rec.id
        WHERE cs.id = ?
    `).get(settlementId);

    if (!settlement) return null;

    // Check scope if user context is provided
    if (user && user.roleName && user.roleName !== 'SUPER_ADMIN') {
        if (user.roleName === 'DRIVER' && user.id && settlement.collector_id && settlement.collector_id !== user.id) {
            throw new Error('Access denied: Driver can only view their own assigned settlements');
        }
        if (user.branchId && Number(settlement.hub_id) !== Number(user.branchId)) {
            throw new Error(`Cross-branch access denied: Settlement belongs to hub ${settlement.hub_id}`);
        }
    }

    return settlement;
}

/**
 * Lists COD settlements with dynamic filtering, branch scoping, and pagination
 */
function listSettlements(query = {}, user = {}) {
    let sql = `
        SELECT 
            cs.*,
            s.tracking_number,
            s.waybill_number,
            s.recipient_name,
            s.recipient_phone,
            b.name as hub_name,
            b.code as hub_code,
            d.delivery_number,
            u_col.full_name as collector_name,
            u_rec.full_name as reconciler_name
        FROM cod_settlements cs
        JOIN shipments s ON cs.shipment_id = s.id
        JOIN branches b ON cs.hub_id = b.id
        LEFT JOIN deliveries d ON cs.delivery_id = d.id
        LEFT JOIN users u_col ON cs.collector_id = u_col.id
        LEFT JOIN users u_rec ON cs.reconciled_by_user_id = u_rec.id
        WHERE 1=1
    `;
    const params = [];

    // Branch Isolation & Role Scoping
    if (user.roleName && user.roleName !== 'SUPER_ADMIN') {
        if (user.roleName === 'DRIVER') {
            sql += ` AND cs.collector_id = ?`;
            params.push(user.id);
        } else if (user.branchId) {
            sql += ` AND cs.hub_id = ?`;
            params.push(user.branchId);
        }
    } else if (query.hub_id) {
        sql += ` AND cs.hub_id = ?`;
        params.push(Number(query.hub_id));
    }

    if (query.status) {
        sql += ` AND cs.status = ?`;
        params.push(query.status.toUpperCase());
    }

    if (query.collector_id) {
        sql += ` AND cs.collector_id = ?`;
        params.push(Number(query.collector_id));
    }

    if (query.shipment_id) {
        sql += ` AND cs.shipment_id = ?`;
        params.push(Number(query.shipment_id));
    }

    if (query.has_variance === 'true' || query.has_variance === true) {
        sql += ` AND (cs.variance_amount != 0.0 OR cs.status = 'DISCREPANT')`;
    }

    if (query.search) {
        sql += ` AND (cs.settlement_number LIKE ? OR s.tracking_number LIKE ? OR s.recipient_name LIKE ?)`;
        const s = `%${query.search}%`;
        params.push(s, s, s);
    }

    if (query.start_date) {
        sql += ` AND cs.created_at >= ?`;
        params.push(query.start_date);
    }

    if (query.end_date) {
        sql += ` AND cs.created_at <= ?`;
        params.push(query.end_date);
    }

    // Count total before pagination
    const countSql = `SELECT COUNT(*) as total FROM (${sql})`;
    const countRow = db.prepare(countSql).get(...params);
    const total = countRow ? countRow.total : 0;

    sql += ` ORDER BY cs.created_at DESC`;

    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    sql += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const items = db.prepare(sql).all(...params);

    return {
        items,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
}

/**
 * Returns aggregated COD summary metrics & KPIs for control tower / finance
 */
function getCODSummaryMetrics(hubId = null, user = {}) {
    let filterHubId = hubId;
    if (user.roleName && user.roleName !== 'SUPER_ADMIN') {
        filterHubId = user.branchId;
    }

    let sql = `
        SELECT 
            COUNT(*) as total_settlements,
            COALESCE(SUM(expected_amount), 0.0) as total_expected,
            COALESCE(SUM(collected_amount), 0.0) as total_collected,
            COALESCE(SUM(remitted_amount), 0.0) as total_remitted,
            COALESCE(SUM(variance_amount), 0.0) as total_variance,
            COUNT(CASE WHEN status = 'PENDING_COLLECTION' THEN 1 END) as pending_collection_count,
            COUNT(CASE WHEN status = 'COLLECTED' THEN 1 END) as collected_count,
            COUNT(CASE WHEN status = 'REMITTED' THEN 1 END) as remitted_count,
            COUNT(CASE WHEN status = 'RECONCILED' THEN 1 END) as reconciled_count,
            COUNT(CASE WHEN status = 'DISCREPANT' OR variance_amount != 0.0 THEN 1 END) as discrepant_count
        FROM cod_settlements
        WHERE 1=1
    `;
    const params = [];

    if (filterHubId) {
        sql += ` AND hub_id = ?`;
        params.push(Number(filterHubId));
    }

    const row = db.prepare(sql).get(...params);

    return {
        total_settlements: row.total_settlements || 0,
        total_expected: Number((row.total_expected || 0).toFixed(2)),
        total_collected: Number((row.total_collected || 0).toFixed(2)),
        total_remitted: Number((row.total_remitted || 0).toFixed(2)),
        total_variance: Number((row.total_variance || 0).toFixed(2)),
        pending_collection_count: row.pending_collection_count || 0,
        collected_count: row.collected_count || 0,
        remitted_count: row.remitted_count || 0,
        reconciled_count: row.reconciled_count || 0,
        discrepant_count: row.discrepant_count || 0
    };
}

module.exports = {
    generateSettlementNumber,
    createExpectedSettlement,
    recordCollection,
    recordRemittance,
    reconcileSettlement,
    getSettlementById,
    listSettlements,
    getCODSummaryMetrics
};
