// server/services/paymentService.js
// SwiftTrack Kenya: Phase 7 Standalone Payments Engine & Reconciliation Service
const { db } = require('../db/database.js');
const darajaService = require('./darajaService.js');
const { logAuditEvent } = require('../middleware/audit.js');

const PAYMENT_STATUSES = {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
    TIMEOUT: 'TIMEOUT',
    CANCELLED: 'CANCELLED',
    REFUNDED: 'REFUNDED'
};

const PAYMENT_METHODS = {
    MPESA: 'MPESA',
    CARD: 'CARD',
    CASH: 'CASH',
    BANK: 'BANK'
};

const ALLOWED_TRANSITIONS = {
    PENDING: ['PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED'],
    PROCESSING: ['SUCCESS', 'FAILED', 'TIMEOUT', 'CANCELLED'],
    SUCCESS: ['REFUNDED'],
    FAILED: ['PROCESSING', 'CANCELLED'], // Allows retry
    TIMEOUT: ['PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED'], // Allows status recovery
    CANCELLED: [],
    REFUNDED: []
};

/**
 * Generate unique intent reference: PI-YYYYMMDD-XXXXX
 */
function generateIntentNumber() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const rand = Math.floor(Math.random() * 90000 + 10000);
    return `PI-${yyyy}${mm}${dd}-${rand}`;
}

/**
 * Generate unique payment number: PAY-YYYYMMDD-XXXXX
 */
function generatePaymentNumber() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const rand = Math.floor(Math.random() * 90000 + 10000);
    return `PAY-${yyyy}${mm}${dd}-${rand}`;
}

/**
 * Generate unique refund number: REF-PAY-YYYYMMDD-XXXXX
 */
function generateRefundNumber() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const rand = Math.floor(Math.random() * 90000 + 10000);
    return `REF-PAY-${yyyy}${mm}${dd}-${rand}`;
}

/**
 * Record payment audit trail entry
 */
function recordAuditTrail(intentId, fromStatus, toStatus, actorType, actorId, details) {
    db.prepare(`
        INSERT INTO payment_audit_trail (
            payment_intent_id, from_status, to_status, actor_type, actor_id, details
        ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(intentId, fromStatus, toStatus, actorType, String(actorId || 'SYSTEM'), details || '');
}

/**
 * 1. Create a Payment Intent (Decoupled from POS/Orders)
 * Enforces strict Idempotency: duplicate request with same idempotency_key returns existing intent.
 */
function createPaymentIntent(data, user) {
    const {
        branch_id,
        order_id,
        sale_id,
        customer_id,
        payment_method,
        amount,
        currency = 'KES',
        idempotency_key,
        phone_number,
        metadata = {}
    } = data;

    const branchId = Number(branch_id || user.branchId || user.branch_id || 1);
    const amt = Number(amount);

    if (!amt || amt <= 0) {
        const err = new Error('Payment amount must be greater than zero.');
        err.statusCode = 400;
        throw err;
    }

    const method = String(payment_method || 'CASH').toUpperCase();
    if (!PAYMENT_METHODS[method]) {
        const err = new Error(`Invalid payment method '${payment_method}'. Allowed: MPESA, CARD, CASH, BANK.`);
        err.statusCode = 400;
        throw err;
    }

    // IDEMPOTENCY GUARD: Check if an intent was already created with this idempotency key
    if (idempotency_key) {
        const existing = db.prepare('SELECT * FROM payment_intents WHERE idempotency_key = ?').get(idempotency_key);
        if (existing) {
            return {
                ...existing,
                is_idempotent_replay: true
            };
        }
    }

    const intentNumber = generateIntentNumber();
    const metaStr = typeof metadata === 'object' ? JSON.stringify(metadata) : metadata;
    const formattedPhone = method === 'MPESA' ? darajaService.formatPhone(phone_number) : phone_number;

    return db.transaction(() => {
        const res = db.prepare(`
            INSERT INTO payment_intents (
                intent_number, branch_id, order_id, sale_id, customer_id,
                payment_method, amount, currency, status, idempotency_key,
                phone_number, metadata, created_by_user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)
        `).run(
            intentNumber, branchId, order_id || null, sale_id || null, customer_id || null,
            method, amt, currency, idempotency_key || null,
            formattedPhone || null, metaStr || null, user.id
        );

        const createdId = res.lastInsertRowid;
        recordAuditTrail(createdId, null, 'PENDING', 'USER', user.id, `Payment intent created for KES ${amt}`);

        logAuditEvent({
            userId: user.id,
            role: user.roleName || user.role,
            action: 'CREATE_PAYMENT_INTENT',
            resource: 'PAYMENT_INTENT',
            resourceId: intentNumber,
            branchId,
            newValue: { intent_number: intentNumber, amount: amt, method },
            reason: 'Initiated payment intent'
        });

        return db.prepare('SELECT * FROM payment_intents WHERE id = ?').get(createdId);
    })();
}

/**
 * 2. Process / Execute a Payment Intent
 * Moves intent into PROCESSING (or SUCCESS for synchronous tenders like cash).
 */
async function processIntent(intentId, options = {}, user) {
    const intent = db.prepare('SELECT * FROM payment_intents WHERE id = ?').get(Number(intentId));
    if (!intent) {
        const err = new Error('Payment intent not found');
        err.statusCode = 404;
        throw err;
    }

    if (user.roleName !== 'SUPER_ADMIN' && intent.branch_id !== (user.branchId || user.branch_id)) {
        const err = new Error('Forbidden: Cannot process payment intent of another branch.');
        err.statusCode = 403;
        throw err;
    }

    // Verify current status allows processing
    if (!['PENDING', 'FAILED', 'TIMEOUT'].includes(intent.status)) {
        const err = new Error(`Cannot process intent in '${intent.status}' status.`);
        err.statusCode = 400;
        throw err;
    }

    const method = intent.payment_method;

    // --- CASE A: M-PESA STK PUSH ---
    if (method === 'MPESA') {
        const phoneToUse = options.phone_number || intent.phone_number;
        if (!phoneToUse) {
            const err = new Error('Phone number is required to initiate M-Pesa STK push.');
            err.statusCode = 400;
            throw err;
        }

        const stkRes = await darajaService.initiateStkPush({
            phone: phoneToUse,
            amount: intent.amount,
            reference: intent.intent_number,
            description: `Payment for ${intent.intent_number}`
        });

        if (!stkRes.success) {
            db.transaction(() => {
                db.prepare(`
                    UPDATE payment_intents
                    SET status = 'FAILED', failure_reason = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(stkRes.response_description, intent.id);
                recordAuditTrail(intent.id, intent.status, 'FAILED', 'PROVIDER', 'DARAJA', stkRes.response_description);
            })();
            const err = new Error(`Daraja STK push failed: ${stkRes.customer_message || stkRes.response_description}`);
            err.statusCode = 400;
            throw err;
        }

        // Set status to PROCESSING with timeout in 120 seconds
        db.transaction(() => {
            db.prepare(`
                UPDATE payment_intents
                SET status = 'PROCESSING',
                    provider_reference = ?,
                    phone_number = ?,
                    timeout_at = datetime('now', '+120 seconds'),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(stkRes.checkout_request_id, stkRes.phone, intent.id);

            recordAuditTrail(
                intent.id, intent.status, 'PROCESSING', 'USER', user.id,
                `STK push dispatched to ${stkRes.phone}. CheckoutRequestID: ${stkRes.checkout_request_id}`
            );
        })();

        return {
            ...db.prepare('SELECT * FROM payment_intents WHERE id = ?').get(intent.id),
            daraja_response: stkRes
        };
    }

    // --- CASE B: CARD (POS Terminal / Gateway) ---
    if (method === 'CARD') {
        const cardRef = options.card_reference || `CARD-AUTH-${Date.now().toString().slice(-6)}`;
        return db.transaction(() => {
            db.prepare(`
                UPDATE payment_intents
                SET status = 'SUCCESS',
                    provider_reference = ?,
                    external_reference = ?,
                    completed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(cardRef, options.last4 ? `CARD-****-${options.last4}` : cardRef, intent.id);

            recordAuditTrail(intent.id, intent.status, 'SUCCESS', 'USER', user.id, `Card payment confirmed. Auth: ${cardRef}`);
            const updatedIntent = db.prepare('SELECT * FROM payment_intents WHERE id = ?').get(intent.id);
            settleSuccessfulPayment(updatedIntent, user.id);
            return updatedIntent;
        })();
    }

    // --- CASE C: CASH (Cash Drawer Register) ---
    if (method === 'CASH') {
        const cashRef = `CSH-${Date.now().toString().slice(-6)}`;
        return db.transaction(() => {
            db.prepare(`
                UPDATE payment_intents
                SET status = 'SUCCESS',
                    provider_reference = ?,
                    external_reference = ?,
                    completed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(cashRef, cashRef, intent.id);

            recordAuditTrail(intent.id, intent.status, 'SUCCESS', 'USER', user.id, `Cash payment received in drawer: KES ${intent.amount}`);
            const updatedIntent = db.prepare('SELECT * FROM payment_intents WHERE id = ?').get(intent.id);
            settleSuccessfulPayment(updatedIntent, user.id);
            return updatedIntent;
        })();
    }

    // --- CASE D: BANK TRANSFER / EFT ---
    if (method === 'BANK') {
        const bankRef = options.bank_reference || `BANK-VCH-${Date.now().toString().slice(-6)}`;
        return db.transaction(() => {
            db.prepare(`
                UPDATE payment_intents
                SET status = 'SUCCESS',
                    provider_reference = ?,
                    external_reference = ?,
                    completed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(bankRef, options.bank_name ? `${options.bank_name}: ${bankRef}` : bankRef, intent.id);

            recordAuditTrail(intent.id, intent.status, 'SUCCESS', 'USER', user.id, `Bank transfer confirmed. Voucher: ${bankRef}`);
            const updatedIntent = db.prepare('SELECT * FROM payment_intents WHERE id = ?').get(intent.id);
            settleSuccessfulPayment(updatedIntent, user.id);
            return updatedIntent;
        })();
    }

    throw new Error(`Unsupported payment method '${method}'`);
}

/**
 * 3. Handle Inbound Safaricom Daraja Webhook Callback
 * Implements strict Duplicate Callback Protection and automatic Order/Sale settlement.
 */
function handleMpesaCallback(rawBody) {
    const parsed = darajaService.parseCallback(rawBody);
    if (!parsed || !parsed.checkout_request_id) {
        return { success: false, error: 'Invalid Daraja callback structure: missing CheckoutRequestID' };
    }

    const {
        checkout_request_id,
        merchant_request_id,
        result_code,
        result_description,
        is_success,
        amount,
        mpesa_receipt_number,
        phone_number
    } = parsed;

    // --- DUPLICATE CALLBACK PROTECTION ---
    const existingCallback = db.prepare('SELECT id FROM payment_callbacks WHERE provider = ? AND provider_reference = ?')
        .get('MPESA', checkout_request_id);

    if (existingCallback) {
        return {
            success: true,
            is_duplicate: true,
            message: 'Duplicate callback acknowledged and ignored'
        };
    }

    // Find linked payment intent by provider_reference
    const intent = db.prepare('SELECT * FROM payment_intents WHERE provider_reference = ?').get(checkout_request_id);

    return db.transaction(() => {
        // Record callback payload
        db.prepare(`
            INSERT INTO payment_callbacks (
                payment_intent_id, provider, provider_reference, result_code,
                result_description, raw_payload, is_processed
            ) VALUES (?, 'MPESA', ?, ?, ?, ?, 1)
        `).run(
            intent ? intent.id : null,
            checkout_request_id,
            result_code,
            result_description,
            JSON.stringify(rawBody)
        );

        if (!intent) {
            return {
                success: false,
                error: `Orphan callback: No payment intent found for CheckoutRequestID ${checkout_request_id}`
            };
        }

        // If intent is already SUCCESS, safely ignore redundant state updates
        if (intent.status === 'SUCCESS') {
            return {
                success: true,
                message: 'Intent already settled'
            };
        }

        if (is_success) {
            // Update intent to SUCCESS
            db.prepare(`
                UPDATE payment_intents
                SET status = 'SUCCESS',
                    external_reference = ?,
                    completed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(mpesa_receipt_number || 'MPESA_SUCCESS', intent.id);

            recordAuditTrail(
                intent.id, intent.status, 'SUCCESS', 'PROVIDER_CALLBACK', 'DARAJA',
                `M-Pesa payment confirmed. Receipt: ${mpesa_receipt_number}, Amount: KES ${amount || intent.amount}`
            );

            // Settle completed payments and linked orders/sales
            const updatedIntent = db.prepare('SELECT * FROM payment_intents WHERE id = ?').get(intent.id);
            settleSuccessfulPayment(updatedIntent, updatedIntent.created_by_user_id);

            return {
                success: true,
                intent_number: intent.intent_number,
                status: 'SUCCESS',
                receipt: mpesa_receipt_number
            };
        } else {
            // Callback indicated failure (e.g. ResultCode 1032 = Cancelled by user, 1037 = Timeout)
            const targetStatus = result_code === 1037 ? 'TIMEOUT' : 'FAILED';
            db.prepare(`
                UPDATE payment_intents
                SET status = ?,
                    failure_reason = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(targetStatus, result_description, intent.id);

            recordAuditTrail(
                intent.id, intent.status, targetStatus, 'PROVIDER_CALLBACK', 'DARAJA',
                `Payment failed: ${result_description} (Code: ${result_code})`
            );

            return {
                success: true,
                intent_number: intent.intent_number,
                status: targetStatus,
                reason: result_description
            };
        }
    })();
}

/**
 * Helper: Settle successful payment into payments ledger & sync linked Order / Sale
 */
function settleSuccessfulPayment(intent, cashierUserId) {
    const paymentNumber = generatePaymentNumber();

    // 1. Insert into payments table
    db.prepare(`
        INSERT INTO payments (
            branch_id, payment_intent_id, sale_id, order_id, payment_number,
            payment_method, amount, currency, reference_code, provider_reference,
            mpesa_receipt_number, mpesa_phone_number, status, cashier_user_id, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?)
    `).run(
        intent.branch_id,
        intent.id,
        intent.sale_id,
        intent.order_id,
        paymentNumber,
        intent.payment_method,
        intent.amount,
        intent.currency,
        intent.external_reference || intent.provider_reference || intent.intent_number,
        intent.provider_reference,
        intent.payment_method === 'MPESA' ? intent.external_reference : null,
        intent.phone_number,
        cashierUserId || intent.created_by_user_id,
        `Settled via Payments Engine Intent ${intent.intent_number}`
    );

    // 2. Sync linked order if present
    if (intent.order_id) {
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(intent.order_id);
        if (order) {
            // Compute total paid so far
            const totalPaidRow = db.prepare(`
                SELECT COALESCE(SUM(amount), 0) as total_paid
                FROM payments
                WHERE order_id = ? AND status = 'COMPLETED'
            `).get(order.id);

            const totalPaid = totalPaidRow.total_paid;
            if (totalPaid >= order.total_amount) {
                db.prepare(`
                    UPDATE orders
                    SET payment_status = 'PAID', updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(order.id);

                // If order was in CONFIRMED, advance to PAID
                if (order.status === 'CONFIRMED') {
                    db.prepare(`
                        UPDATE orders
                        SET status = 'PAID', updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `).run(order.id);

                    db.prepare(`
                        INSERT INTO order_status_history (order_id, from_status, to_status, user_id, notes)
                        VALUES (?, 'CONFIRMED', 'PAID', ?, 'Payment settled in full via Payments Engine')
                    `).run(order.id, cashierUserId || intent.created_by_user_id);
                }
            } else if (totalPaid > 0) {
                db.prepare(`
                    UPDATE orders
                    SET payment_status = 'PARTIAL', updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(order.id);
            }
        }
    }

    // 3. Sync linked sale if present
    if (intent.sale_id) {
        db.prepare(`
            UPDATE sales
            SET payment_status = 'PAID', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(intent.sale_id);
    }
}

/**
 * 4. Query live status from provider (Timeout Recovery)
 */
async function queryPaymentStatus(intentId, user) {
    const intent = db.prepare('SELECT * FROM payment_intents WHERE id = ?').get(Number(intentId));
    if (!intent) {
        const err = new Error('Payment intent not found');
        err.statusCode = 404;
        throw err;
    }

    if (intent.payment_method === 'MPESA' && intent.provider_reference) {
        const res = await darajaService.queryStkStatus(intent.provider_reference);
        if (res.result_code === 0 && intent.status !== 'SUCCESS') {
            db.transaction(() => {
                db.prepare(`
                    UPDATE payment_intents
                    SET status = 'SUCCESS',
                        external_reference = COALESCE(external_reference, ?),
                        completed_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(darajaService.generateReceiptCode(), intent.id);

                recordAuditTrail(intent.id, intent.status, 'SUCCESS', 'USER', user.id, 'Payment verified via Daraja status query');
                const updated = db.prepare('SELECT * FROM payment_intents WHERE id = ?').get(intent.id);
                settleSuccessfulPayment(updated, user.id);
            })();
        }
        return db.prepare('SELECT * FROM payment_intents WHERE id = ?').get(intent.id);
    }

    return intent;
}

/**
 * 5. Check & transition timed-out intents
 */
function checkTimeouts() {
    const expiredIntents = db.prepare(`
        SELECT * FROM payment_intents
        WHERE status = 'PROCESSING'
          AND timeout_at IS NOT NULL
          AND timeout_at <= CURRENT_TIMESTAMP
    `).all();

    for (const intent of expiredIntents) {
        db.transaction(() => {
            db.prepare(`
                UPDATE payment_intents
                SET status = 'TIMEOUT', failure_reason = 'Payment confirmation timed out after 120s', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(intent.id);

            recordAuditTrail(intent.id, 'PROCESSING', 'TIMEOUT', 'SYSTEM', 'TIMEOUT_WORKER', 'Auto-timed out after 120s without callback');
        })();
    }

    return expiredIntents.length;
}

/**
 * 6. Cancel a pending or processing payment intent
 */
function cancelPaymentIntent(intentId, reason = 'Cancelled by staff', user) {
    const intent = db.prepare('SELECT * FROM payment_intents WHERE id = ?').get(Number(intentId));
    if (!intent) {
        const err = new Error('Payment intent not found');
        err.statusCode = 404;
        throw err;
    }

    if (intent.status === 'SUCCESS' || intent.status === 'REFUNDED') {
        const err = new Error(`Cannot cancel payment intent in '${intent.status}' status. Use refund flow instead.`);
        err.statusCode = 400;
        throw err;
    }

    return db.transaction(() => {
        db.prepare(`
            UPDATE payment_intents
            SET status = 'CANCELLED', failure_reason = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(reason, intent.id);

        recordAuditTrail(intent.id, intent.status, 'CANCELLED', 'USER', user.id, `Intent cancelled: ${reason}`);

        logAuditEvent({
            userId: user.id,
            role: user.roleName || user.role,
            action: 'CANCEL_PAYMENT_INTENT',
            resource: 'PAYMENT_INTENT',
            resourceId: intent.intent_number,
            branchId: intent.branch_id,
            newValue: { status: 'CANCELLED', reason },
            reason
        });

        return db.prepare('SELECT * FROM payment_intents WHERE id = ?').get(intent.id);
    })();
}

/**
 * 7. Process full or partial refund against a completed payment
 */
function refundPayment(paymentId, { amount, reason = 'Customer refund' } = {}, user) {
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(Number(paymentId));
    if (!payment) {
        const err = new Error('Payment not found');
        err.statusCode = 404;
        throw err;
    }

    if (payment.status === 'REFUNDED') {
        const err = new Error('Payment has already been refunded.');
        err.statusCode = 400;
        throw err;
    }

    const refundAmount = Number(amount || payment.amount);
    if (refundAmount <= 0 || refundAmount > payment.amount) {
        const err = new Error(`Refund amount must be between 0.01 and ${payment.amount} KES.`);
        err.statusCode = 400;
        throw err;
    }

    const refundNumber = generateRefundNumber();

    return db.transaction(() => {
        // Insert refund record
        const refRes = db.prepare(`
            INSERT INTO payment_refunds (
                refund_number, payment_id, payment_intent_id, amount,
                reason, status, processed_by_user_id
            ) VALUES (?, ?, ?, ?, ?, 'COMPLETED', ?)
        `).run(
            refundNumber, payment.id, payment.payment_intent_id || null,
            refundAmount, reason, user.id
        );

        // Update payment status
        db.prepare(`
            UPDATE payments
            SET status = 'REFUNDED', notes = COALESCE(notes, '') || ' [Refunded: ' || ? || ']'
            WHERE id = ?
        `).run(refundNumber, payment.id);

        // If payment intent exists, transition to REFUNDED
        if (payment.payment_intent_id) {
            db.prepare(`
                UPDATE payment_intents
                SET status = 'REFUNDED', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(payment.payment_intent_id);

            recordAuditTrail(
                payment.payment_intent_id, 'SUCCESS', 'REFUNDED', 'USER', user.id,
                `Refund processed: KES ${refundAmount}. Reason: ${reason} (Ref: ${refundNumber})`
            );
        }

        logAuditEvent({
            userId: user.id,
            role: user.roleName || user.role,
            action: 'REFUND_PAYMENT',
            resource: 'PAYMENT',
            resourceId: payment.payment_number,
            branchId: payment.branch_id,
            newValue: { refund_number: refundNumber, amount: refundAmount, reason },
            reason
        });

        return db.prepare('SELECT * FROM payment_refunds WHERE id = ?').get(refRes.lastInsertRowid);
    })();
}

/**
 * 8. Payment Reconciliation Engine
 * Automatically compares payments ledger against recorded intents and provider references.
 */
function reconcilePayments({ branch_id, from_date, to_date } = {}, user) {
    let query = `
        SELECT p.*,
               pi.intent_number, pi.status as intent_status, pi.provider_reference as intent_provider_ref,
               u.full_name as cashier_name, b.name as branch_name
        FROM payments p
        JOIN branches b ON p.branch_id = b.id
        LEFT JOIN users u ON p.cashier_user_id = u.id
        LEFT JOIN payment_intents pi ON p.payment_intent_id = pi.id
        WHERE 1=1
    `;
    const params = [];

    if (user.roleName !== 'SUPER_ADMIN' && (user.branchId || user.branch_id)) {
        query += ' AND p.branch_id = ?';
        params.push(user.branchId || user.branch_id);
    } else if (branch_id) {
        query += ' AND p.branch_id = ?';
        params.push(Number(branch_id));
    }

    if (from_date) {
        query += ' AND p.created_at >= ?';
        params.push(from_date);
    }
    if (to_date) {
        query += ' AND p.created_at <= ?';
        params.push(to_date);
    }

    query += ' ORDER BY p.id DESC';
    const paymentsList = db.prepare(query).all(...params);

    const matched = [];
    const discrepancies = [];
    let totalReconciledVolume = 0;

    return db.transaction(() => {
        for (const p of paymentsList) {
            let hasDiscrepancy = false;
            let discReason = '';

            // Check if M-Pesa receipt code is present for M-Pesa payments
            if (p.payment_method === 'MPESA' && !p.mpesa_receipt_number && !p.reference_code) {
                hasDiscrepancy = true;
                discReason = 'Missing M-Pesa receipt code';
            }

            if (hasDiscrepancy) {
                discrepancies.push({
                    payment_id: p.id,
                    payment_number: p.payment_number,
                    reason: discReason
                });
            } else {
                matched.push(p.id);
                totalReconciledVolume += Number(p.amount);

                // Mark reconciled
                db.prepare(`
                    UPDATE payments
                    SET reconciled_at = CURRENT_TIMESTAMP, reconciled_by_user_id = ?
                    WHERE id = ? AND reconciled_at IS NULL
                `).run(user.id, p.id);
            }
        }

        return {
            total_evaluated: paymentsList.length,
            matched_count: matched.length,
            discrepancies_count: discrepancies.length,
            reconciled_volume: totalReconciledVolume,
            discrepancies
        };
    })();
}

/**
 * 9. Multi-Axis Filtering & Listing of Payment Intents
 */
function listPaymentIntents(filters = {}, user = {}) {
    let query = `
        SELECT pi.*,
               b.name as branch_name, b.code as branch_code,
               c.full_name as customer_name, c.phone as customer_phone,
               o.order_number, s.sale_number,
               u.full_name as creator_name,
               (SELECT count(*) FROM payment_callbacks WHERE payment_intent_id = pi.id) as callback_count
        FROM payment_intents pi
        JOIN branches b ON pi.branch_id = b.id
        LEFT JOIN customers c ON pi.customer_id = c.id
        LEFT JOIN orders o ON pi.order_id = o.id
        LEFT JOIN sales s ON pi.sale_id = s.id
        JOIN users u ON pi.created_by_user_id = u.id
        WHERE 1=1
    `;
    const params = [];

    if (user.roleName !== 'SUPER_ADMIN' && (user.branchId || user.branch_id)) {
        query += ' AND pi.branch_id = ?';
        params.push(user.branchId || user.branch_id);
    } else if (filters.branch_id) {
        query += ' AND pi.branch_id = ?';
        params.push(Number(filters.branch_id));
    }

    if (filters.status && filters.status !== 'ALL') {
        query += ' AND pi.status = ?';
        params.push(filters.status.toUpperCase());
    }

    if (filters.payment_method && filters.payment_method !== 'ALL') {
        query += ' AND pi.payment_method = ?';
        params.push(filters.payment_method.toUpperCase());
    }

    if (filters.search && filters.search.trim()) {
        const q = `%${filters.search.trim().toLowerCase()}%`;
        query += ` AND (
            LOWER(pi.intent_number) LIKE ? OR
            LOWER(COALESCE(pi.provider_reference, '')) LIKE ? OR
            LOWER(COALESCE(pi.external_reference, '')) LIKE ? OR
            LOWER(COALESCE(c.full_name, '')) LIKE ? OR
            LOWER(COALESCE(pi.phone_number, '')) LIKE ? OR
            LOWER(COALESCE(o.order_number, '')) LIKE ?
        )`;
        params.push(q, q, q, q, q, q);
    }

    query += ' ORDER BY pi.id DESC';

    const limit = Math.min(200, Math.max(1, Number(filters.limit) || 50));
    const offset = Math.max(0, Number(filters.offset) || 0);

    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return db.prepare(query).all(...params);
}

/**
 * 10. Get full Payment Intent Details with Audit Trail & Callbacks
 */
function getPaymentIntentById(id, user = {}) {
    const intent = db.prepare(`
        SELECT pi.*,
               b.name as branch_name, b.code as branch_code,
               c.full_name as customer_name, c.phone as customer_phone,
               o.order_number, s.sale_number,
               u.full_name as creator_name
        FROM payment_intents pi
        JOIN branches b ON pi.branch_id = b.id
        LEFT JOIN customers c ON pi.customer_id = c.id
        LEFT JOIN orders o ON pi.order_id = o.id
        LEFT JOIN sales s ON pi.sale_id = s.id
        JOIN users u ON pi.created_by_user_id = u.id
        WHERE pi.id = ?
    `).get(Number(id));

    if (!intent) return null;

    if (user.roleName !== 'SUPER_ADMIN' && intent.branch_id !== (user.branchId || user.branch_id)) {
        const err = new Error('Forbidden: Cannot view payment intent of another branch.');
        err.statusCode = 403;
        throw err;
    }

    const auditTrail = db.prepare(`
        SELECT * FROM payment_audit_trail
        WHERE payment_intent_id = ?
        ORDER BY id ASC
    `).all(intent.id);

    const callbacks = db.prepare(`
        SELECT * FROM payment_callbacks
        WHERE payment_intent_id = ?
        ORDER BY id ASC
    `).all(intent.id);

    const linkedPayments = db.prepare(`
        SELECT p.*, u.full_name as cashier_name
        FROM payments p
        LEFT JOIN users u ON p.cashier_user_id = u.id
        WHERE p.payment_intent_id = ?
    `).all(intent.id);

    return {
        ...intent,
        audit_trail: auditTrail,
        callbacks,
        payments: linkedPayments
    };
}

/**
 * 11. Export Payment Intents to CSV
 */
function exportPaymentsToCsv(filters = {}, user = {}) {
    const intents = listPaymentIntents({ ...filters, limit: 1000, offset: 0 }, user);
    const headers = [
        'Intent Number', 'Date', 'Branch', 'Method', 'Amount (KES)',
        'Status', 'Customer', 'Phone', 'Provider Reference', 'M-Pesa Receipt', 'Order Number'
    ];

    const rows = intents.map(it => [
        it.intent_number,
        new Date(it.created_at).toISOString(),
        it.branch_name,
        it.payment_method,
        Number(it.amount).toFixed(2),
        it.status,
        it.customer_name || 'Walk-in',
        it.phone_number || '',
        it.provider_reference || '',
        it.external_reference || '',
        it.order_number || ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    return csvContent;
}

module.exports = {
    PAYMENT_STATUSES,
    PAYMENT_METHODS,
    ALLOWED_TRANSITIONS,
    createPaymentIntent,
    processIntent,
    handleMpesaCallback,
    queryPaymentStatus,
    checkTimeouts,
    cancelPaymentIntent,
    refundPayment,
    reconcilePayments,
    listPaymentIntents,
    getPaymentIntentById,
    exportPaymentsToCsv
};
