// server/services/posShiftService.js
// SwiftTrack Kenya: POS Cashier Shifts & Cash Drawer Control Service
const { db } = require('../db/database.js');
const { logAuditEvent } = require('../middleware/audit.js');

function generateShiftNumber(branchId = 1) {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `SFT-BR${branchId}-${today}-${rand}`;
}

/**
 * Get current active open shift for a cashier
 */
function getCurrentShift(cashierId, branchId) {
    const shift = db.prepare(`
        SELECT s.*, u.full_name as cashier_name, b.name as branch_name, b.code as branch_code
        FROM pos_shifts s
        JOIN users u ON s.cashier_user_id = u.id
        JOIN branches b ON s.branch_id = b.id
        WHERE s.cashier_user_id = ? AND s.branch_id = ? AND s.status = 'OPEN'
        ORDER BY s.id DESC LIMIT 1
    `).get(Number(cashierId), Number(branchId));

    if (!shift) return null;

    // Fetch drawer movements
    const movements = db.prepare(`
        SELECT * FROM cash_drawer_movements
        WHERE shift_id = ?
        ORDER BY id DESC LIMIT 20
    `).all(shift.id);

    // Compute live in-drawer cash balance
    const inDrawerCash = Number((
        shift.opening_cash
        + (shift.total_cash_amount || 0)
        - (shift.total_refunds_amount || 0)
    ).toFixed(2));

    return {
        ...shift,
        in_drawer_cash: inDrawerCash,
        movements
    };
}

/**
 * Open a new shift with starting cash float
 */
function openShift({ opening_cash = 0, notes }, user) {
    const branchId = user.branchId || 1;
    const cashierId = user.id;

    // Check if cashier already has an active open shift
    const existing = db.prepare(`
        SELECT id, shift_number FROM pos_shifts
        WHERE cashier_user_id = ? AND branch_id = ? AND status = 'OPEN'
    `).get(cashierId, branchId);

    if (existing) {
        const err = new Error(`Cannot open shift: Cashier already has active open shift #${existing.shift_number}`);
        err.statusCode = 400;
        throw err;
    }

    const floatAmount = Math.max(0, Number(opening_cash) || 0);
    const shiftNumber = generateShiftNumber(branchId);
    let shiftId;

    db.transaction(() => {
        const res = db.prepare(`
            INSERT INTO pos_shifts (
                branch_id, cashier_user_id, shift_number, status,
                opening_cash, expected_cash, notes
            ) VALUES (?, ?, ?, 'OPEN', ?, ?, ?)
        `).run(branchId, cashierId, shiftNumber, floatAmount, floatAmount, notes || '');

        shiftId = res.lastInsertRowid;

        // Log initial drawer float movement
        db.prepare(`
            INSERT INTO cash_drawer_movements (
                shift_id, branch_id, cashier_user_id, movement_type, amount, reason
            ) VALUES (?, ?, ?, 'FLOAT_IN', ?, 'Starting opening cash drawer float')
        `).run(shiftId, branchId, cashierId, floatAmount);
    })();

    logAuditEvent({
        userId: user.id,
        role: user.roleName,
        action: 'OPEN_SHIFT',
        resource: 'POS_SHIFT',
        resourceId: String(shiftId),
        branchId,
        newValue: { shiftNumber, opening_cash: floatAmount },
        reason: 'Opened cashier POS shift and recorded drawer float'
    });

    return getCurrentShift(cashierId, branchId);
}

/**
 * Record a completed sale against an open shift
 */
function recordSaleInShift(shiftId, saleTotal, paymentBreakdown, user) {
    if (!shiftId) return;

    let cashAmount = 0;
    let mpesaAmount = 0;
    let cardAmount = 0;
    let bankAmount = 0;

    for (const p of paymentBreakdown) {
        const amt = Number(p.amount) || 0;
        const method = (p.payment_method || p.method || '').toUpperCase();
        if (method === 'CASH') cashAmount += amt;
        else if (method === 'MPESA') mpesaAmount += amt;
        else if (method === 'CARD') cardAmount += amt;
        else if (method === 'BANK_TRANSFER' || method === 'BANK') bankAmount += amt;
    }

    db.transaction(() => {
        db.prepare(`
            UPDATE pos_shifts
            SET total_sales_count = total_sales_count + 1,
                total_sales_amount = total_sales_amount + ?,
                total_cash_amount = total_cash_amount + ?,
                total_mpesa_amount = total_mpesa_amount + ?,
                total_card_amount = total_card_amount + ?,
                total_bank_amount = total_bank_amount + ?,
                expected_cash = expected_cash + ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            Number(saleTotal),
            cashAmount,
            mpesaAmount,
            cardAmount,
            bankAmount,
            cashAmount,
            shiftId
        );

        if (cashAmount > 0) {
            db.prepare(`
                INSERT INTO cash_drawer_movements (
                    shift_id, branch_id, cashier_user_id, movement_type, amount, reason
                ) VALUES (?, ?, ?, 'SALE_CASH', ?, 'Cash tender collected from sale')
            `).run(shiftId, user.branchId || 1, user.id, cashAmount);
        }
    })();
}

/**
 * Record a cash payout or cash drop from the drawer
 */
function recordDrawerMovement(shiftId, { movement_type, amount, reason, reference_id }, user) {
    const validTypes = ['PAYOUT', 'DROP_OUT'];
    const type = String(movement_type).toUpperCase();
    if (!validTypes.includes(type)) {
        const err = new Error(`Invalid drawer movement type '${movement_type}'. Must be PAYOUT or DROP_OUT`);
        err.statusCode = 400;
        throw err;
    }

    const moveAmount = Number(amount);
    if (moveAmount <= 0) {
        const err = new Error('Movement amount must be greater than zero');
        err.statusCode = 400;
        throw err;
    }

    const shift = db.prepare('SELECT * FROM pos_shifts WHERE id = ?').get(Number(shiftId));
    if (!shift || shift.status !== 'OPEN') {
        const err = new Error('Shift not found or not currently OPEN');
        err.statusCode = 400;
        throw err;
    }

    db.transaction(() => {
        db.prepare(`
            UPDATE pos_shifts
            SET expected_cash = expected_cash - ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(moveAmount, shift.id);

        db.prepare(`
            INSERT INTO cash_drawer_movements (
                shift_id, branch_id, cashier_user_id, movement_type, amount, reference_id, reason
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(shift.id, shift.branch_id, user.id, type, moveAmount, reference_id || null, reason || '');
    })();

    return getCurrentShift(shift.cashier_user_id, shift.branch_id);
}

/**
 * Close shift and submit physical cash drawer count
 */
function closeShift(shiftId, { closing_cash, notes }, user) {
    const targetShiftId = Number(shiftId);
    const shift = db.prepare('SELECT * FROM pos_shifts WHERE id = ?').get(targetShiftId);

    if (!shift) {
        const err = new Error('Shift record not found');
        err.statusCode = 404;
        throw err;
    }

    if (shift.status !== 'OPEN') {
        const err = new Error(`Shift is already ${shift.status}`);
        err.statusCode = 400;
        throw err;
    }

    // Branch / user check
    if (user.roleName !== 'SUPER_ADMIN' && shift.branch_id !== user.branchId) {
        const err = new Error('Forbidden: Cannot close shift belonging to another branch');
        err.statusCode = 403;
        throw err;
    }

    const countedCash = Math.max(0, Number(closing_cash) || 0);
    const variance = Number((countedCash - shift.expected_cash).toFixed(2));

    db.prepare(`
        UPDATE pos_shifts
        SET status = 'CLOSED',
            closing_cash = ?,
            cash_variance = ?,
            closed_at = CURRENT_TIMESTAMP,
            notes = COALESCE(?, notes),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(countedCash, variance, notes ? notes.trim() : null, targetShiftId);

    logAuditEvent({
        userId: user.id,
        role: user.roleName,
        action: 'CLOSE_SHIFT',
        resource: 'POS_SHIFT',
        resourceId: String(targetShiftId),
        branchId: shift.branch_id,
        previousValue: { status: 'OPEN', expected_cash: shift.expected_cash },
        newValue: { status: 'CLOSED', closing_cash: countedCash, cash_variance: variance },
        reason: `Closed shift #${shift.shift_number} with variance KES ${variance}`
    });

    return db.prepare(`
        SELECT s.*, u.full_name as cashier_name, b.name as branch_name
        FROM pos_shifts s
        JOIN users u ON s.cashier_user_id = u.id
        JOIN branches b ON s.branch_id = b.id
        WHERE s.id = ?
    `).get(targetShiftId);
}

/**
 * Reconcile shift (Branch Manager or Super Admin sign-off)
 */
function reconcileShift(shiftId, { reconciliation_notes }, user) {
    const targetShiftId = Number(shiftId);
    const shift = db.prepare('SELECT * FROM pos_shifts WHERE id = ?').get(targetShiftId);

    if (!shift) {
        const err = new Error('Shift record not found');
        err.statusCode = 404;
        throw err;
    }

    if (shift.status !== 'CLOSED') {
        const err = new Error(`Only CLOSED shifts can be reconciled. Shift is currently '${shift.status}'.`);
        err.statusCode = 400;
        throw err;
    }

    if (user.roleName !== 'SUPER_ADMIN' && user.roleName !== 'BRANCH_MANAGER') {
        const err = new Error('Forbidden: Only Branch Managers and Super Admins can reconcile shifts');
        err.statusCode = 403;
        throw err;
    }

    db.prepare(`
        UPDATE pos_shifts
        SET status = 'RECONCILED',
            reconciled_at = CURRENT_TIMESTAMP,
            reconciled_by = ?,
            reconciliation_notes = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(user.id, reconciliation_notes || 'Reconciled and verified against physical count', targetShiftId);

    logAuditEvent({
        userId: user.id,
        role: user.roleName,
        action: 'RECONCILE_SHIFT',
        resource: 'POS_SHIFT',
        resourceId: String(targetShiftId),
        branchId: shift.branch_id,
        previousValue: { status: 'CLOSED' },
        newValue: { status: 'RECONCILED', reconciled_by: user.id },
        reason: 'Manager certified end-of-day shift reconciliation'
    });

    return db.prepare(`
        SELECT s.*, u.full_name as cashier_name, b.name as branch_name, m.full_name as reconciled_by_name
        FROM pos_shifts s
        JOIN users u ON s.cashier_user_id = u.id
        JOIN branches b ON s.branch_id = b.id
        LEFT JOIN users m ON s.reconciled_by = m.id
        WHERE s.id = ?
    `).get(targetShiftId);
}

/**
 * List shifts with pagination, branch isolation, and filters
 */
function listShifts({ branchId, cashierId, status, date, page = 1, limit = 50 }) {
    const pageNum = Math.max(1, Number(page) || 1);
    const pageLimit = Math.max(1, Math.min(100, Number(limit) || 50));
    const offset = (pageNum - 1) * pageLimit;

    let query = `
        SELECT s.*, u.full_name as cashier_name, b.name as branch_name, m.full_name as reconciled_by_name
        FROM pos_shifts s
        JOIN users u ON s.cashier_user_id = u.id
        JOIN branches b ON s.branch_id = b.id
        LEFT JOIN users m ON s.reconciled_by = m.id
        WHERE 1=1
    `;
    const params = [];

    if (branchId) {
        query += ' AND s.branch_id = ?';
        params.push(Number(branchId));
    }
    if (cashierId) {
        query += ' AND s.cashier_user_id = ?';
        params.push(Number(cashierId));
    }
    if (status) {
        query += ' AND s.status = ?';
        params.push(status.toUpperCase());
    }
    if (date) {
        query += ' AND date(s.opened_at) = date(?)';
        params.push(date);
    }

    query += ' ORDER BY s.id DESC LIMIT ? OFFSET ?';
    params.push(pageLimit, offset);

    return db.prepare(query).all(...params);
}

module.exports = {
    generateShiftNumber,
    getCurrentShift,
    openShift,
    recordSaleInShift,
    recordDrawerMovement,
    closeShift,
    reconcileShift,
    listShifts
};
