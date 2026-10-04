// server/routes/company.js
// Enterprise Company Settings & Tax Configuration Controller
const express = require('express');
const router = express.Router();
const dbAdapter = require('../db/dbAdapter.js');
const { authenticateToken, requireRole } = require('../middleware/auth.js');
const { logAuditEvent } = require('../middleware/audit.js');

// GET /api/v1/company - Retrieve current company settings
router.get('/', authenticateToken, async (req, res) => {
    try {
        const company = await dbAdapter.get('SELECT * FROM company_settings WHERE id = 1');
        if (!company) {
            return res.status(404).json({ error: 'Company settings not found' });
        }
        res.json(company);
    } catch (err) {
        console.error('Failed to get company settings:', err);
        res.status(500).json({ error: 'Failed to retrieve company settings' });
    }
});

// PUT /api/v1/company - Update enterprise company settings (SUPER_ADMIN only)
router.put('/', authenticateToken, requireRole('SUPER_ADMIN'), async (req, res) => {
    try {
        const previous = await dbAdapter.get('SELECT * FROM company_settings WHERE id = 1');
        if (!previous) {
            return res.status(404).json({ error: 'Company settings record not found' });
        }

        const {
            company_name,
            registration_number,
            kra_pin,
            vat_rate,
            currency,
            phone,
            email,
            address,
            city,
            country,
            receipt_header,
            receipt_footer,
            etims_enabled,
            etims_branch_code
        } = req.body;

        const updated = {
            company_name: company_name !== undefined ? company_name : previous.company_name,
            registration_number: registration_number !== undefined ? registration_number : previous.registration_number,
            kra_pin: kra_pin !== undefined ? kra_pin : previous.kra_pin,
            vat_rate: vat_rate !== undefined ? Number(vat_rate) : previous.vat_rate,
            currency: currency !== undefined ? currency : previous.currency,
            phone: phone !== undefined ? phone : previous.phone,
            email: email !== undefined ? email : previous.email,
            address: address !== undefined ? address : previous.address,
            city: city !== undefined ? city : previous.city,
            country: country !== undefined ? country : previous.country,
            receipt_header: receipt_header !== undefined ? receipt_header : previous.receipt_header,
            receipt_footer: receipt_footer !== undefined ? receipt_footer : previous.receipt_footer,
            etims_enabled: etims_enabled !== undefined ? Boolean(etims_enabled) : previous.etims_enabled,
            etims_branch_code: etims_branch_code !== undefined ? etims_branch_code : previous.etims_branch_code
        };

        await dbAdapter.run(`
            UPDATE company_settings
            SET company_name = ?,
                registration_number = ?,
                kra_pin = ?,
                vat_rate = ?,
                currency = ?,
                phone = ?,
                email = ?,
                address = ?,
                city = ?,
                country = ?,
                receipt_header = ?,
                receipt_footer = ?,
                etims_enabled = ?,
                etims_branch_code = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
        `, [
            updated.company_name,
            updated.registration_number,
            updated.kra_pin,
            updated.vat_rate,
            updated.currency,
            updated.phone,
            updated.email,
            updated.address,
            updated.city,
            updated.country,
            updated.receipt_header,
            updated.receipt_footer,
            updated.etims_enabled,
            updated.etims_branch_code
        ]);

        logAuditEvent({
            userId: req.user.id,
            role: req.user.roleName,
            action: 'UPDATE_COMPANY_SETTINGS',
            resource: 'company_settings',
            resourceId: 1,
            previousValue: previous,
            newValue: updated,
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        const current = await dbAdapter.get('SELECT * FROM company_settings WHERE id = 1');
        res.json({ message: 'Company settings updated successfully', company: current });
    } catch (err) {
        console.error('Failed to update company settings:', err);
        res.status(500).json({ error: 'Failed to update company settings: ' + err.message });
    }
});

module.exports = router;
