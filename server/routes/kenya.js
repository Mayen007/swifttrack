// server/routes/kenya.js
const express = require('express');
const router = express.Router();
const { db } = require('../db/database.js');
const { authenticateToken } = require('../middleware/auth.js');

// Format and validate Kenyan phone numbers (+254 7XX / +254 1XX)
function formatKenyanPhone(phone) {
    if (!phone) return null;
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
        clean = '254' + clean.slice(1);
    } else if (clean.startsWith('7') || clean.startsWith('1')) {
        clean = '254' + clean;
    }
    return '+' + clean;
}

// POST /api/kenya/mpesa/stk-push - Initiates simulated M-Pesa Daraja STK push to phone
router.post('/mpesa/stk-push', authenticateToken, (req, res) => {
    const { phone, amount, reference } = req.body;

    if (!phone || !amount) {
        return res.status(400).json({ error: 'Phone number and amount are required' });
    }

    const formattedPhone = formatKenyanPhone(phone);
    const checkoutRequestId = `ws_CO_${Date.now()}_${Math.floor(Math.random() * 900000 + 100000)}`;

    // Generate realistic M-Pesa Receipt Number e.g. RKA8921KL9
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let mpesaCode = 'R';
    for (let i = 0; i < 9; i++) {
        mpesaCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // In a live system, this calls Safaricom Daraja API. In our production-ready simulator:
    res.json({
        success: true,
        response_code: '0',
        response_description: 'Success. Request accepted for processing',
        merchant_request_id: `MR_${Date.now()}`,
        checkout_request_id: checkoutRequestId,
        customer_message: `Success. An STK push prompt has been dispatched to ${formattedPhone}. Please enter your M-Pesa PIN on your phone to authorize payment of KSh ${Number(amount).toFixed(2)}.`,
        simulated_data: {
            phone: formattedPhone,
            amount: Number(amount),
            mpesa_receipt_number: mpesaCode,
            transaction_date: new Date().toISOString()
        }
    });
});

// GET /api/kenya/etims/invoice/:saleNumber - Generates KRA eTIMS invoice verification details
router.get('/etims/invoice/:saleNumber', authenticateToken, (req, res) => {
    const { saleNumber } = req.params;
    const sale = db.prepare('SELECT s.*, b.name as branch_name, b.code as branch_code FROM sales s JOIN branches b ON s.branch_id = b.id WHERE s.sale_number = ?').get(saleNumber);

    if (!sale) return res.status(404).json({ error: 'Sale not found' });

    const company = db.prepare('SELECT * FROM company_settings WHERE id = 1').get();

    // Generate standard KRA eTIMS QR data string format
    const qrData = `https://etims.kra.go.ke/verify?pin=${company.kra_pin}&cu=${company.etims_branch_code}&inv=${sale.sale_number}&amt=${sale.total_amount}&dt=${sale.created_at}`;

    res.json({
        company_name: company.company_name,
        kra_pin: company.kra_pin,
        branch_name: sale.branch_name,
        branch_code: sale.branch_code,
        sale_number: sale.sale_number,
        invoice_number: `KRA-CU-${company.etims_branch_code}-${sale.id.toString().padStart(8, '0')}`,
        vat_amount: sale.tax_amount,
        vat_rate: `${company.vat_rate}%`,
        subtotal: sale.subtotal,
        total_amount: sale.total_amount,
        date: sale.created_at,
        qr_verification_url: qrData
    });
});

module.exports = router;
