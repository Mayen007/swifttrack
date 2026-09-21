// server/routes/customers.js
// SwiftTrack Kenya: Customer Management REST API Controller
const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/auth.js');
const customerService = require('../services/customerService.js');

// GET /api/v1/customers - List customers with search, status filtering, and branch isolation
router.get('/', authenticateToken, authorize('customers', 'view'), (req, res, next) => {
    try {
        const branchId = req.user.roleName === 'SUPER_ADMIN'
            ? (req.query.branch_id ? Number(req.query.branch_id) : null)
            : req.user.branchId;

        const result = customerService.listCustomers({
            branchId,
            search: req.query.search,
            status: req.query.status,
            page: req.query.page,
            limit: req.query.limit
        });

        res.json(result);
    } catch (err) {
        next(err);
    }
});

// GET /api/v1/customers/:id - Detailed customer profile with addresses, notes, and metrics
router.get('/:id', authenticateToken, authorize('customers', 'view'), (req, res, next) => {
    try {
        const customer = customerService.getCustomerById(req.params.id, req.user);
        res.json(customer);
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ error: err.message });
        }
        next(err);
    }
});

// POST /api/v1/customers - Create a new customer profile
router.post('/', authenticateToken, authorize('customers', 'create'), (req, res, next) => {
    try {
        const customer = customerService.createCustomer(req.body, req.user);
        res.status(201).json(customer);
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ error: err.message });
        }
        next(err);
    }
});

// PUT /api/v1/customers/:id - Update an existing customer profile
router.put('/:id', authenticateToken, authorize('customers', 'edit'), (req, res, next) => {
    try {
        const customer = customerService.updateCustomer(req.params.id, req.body, req.user);
        res.json(customer);
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ error: err.message });
        }
        next(err);
    }
});

// PATCH /api/v1/customers/:id/status - Update customer status (ACTIVE, INACTIVE, SUSPENDED, BLOCKED)
router.patch('/:id/status', authenticateToken, authorize('customers', 'manage'), (req, res, next) => {
    try {
        const { status, reason } = req.body;
        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }
        const updated = customerService.updateCustomerStatus(req.params.id, status, reason, req.user);
        res.json(updated);
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ error: err.message });
        }
        next(err);
    }
});

// GET /api/v1/customers/:id/addresses - List all delivery addresses for a customer
router.get('/:id/addresses', authenticateToken, authorize('customers', 'view'), (req, res, next) => {
    try {
        const customer = customerService.getCustomerById(req.params.id, req.user);
        res.json(customer.addresses);
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ error: err.message });
        }
        next(err);
    }
});

// POST /api/v1/customers/:id/addresses - Add delivery address
router.post('/:id/addresses', authenticateToken, authorize('customers', 'edit'), (req, res, next) => {
    try {
        const address = customerService.addDeliveryAddress(req.params.id, req.body, req.user);
        res.status(201).json(address);
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ error: err.message });
        }
        next(err);
    }
});

// PUT /api/v1/customers/:id/addresses/:addressId - Update delivery address
router.put('/:id/addresses/:addressId', authenticateToken, authorize('customers', 'edit'), (req, res, next) => {
    try {
        const address = customerService.updateDeliveryAddress(req.params.id, req.params.addressId, req.body, req.user);
        res.json(address);
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ error: err.message });
        }
        next(err);
    }
});

// DELETE /api/v1/customers/:id/addresses/:addressId - Delete delivery address
router.delete('/:id/addresses/:addressId', authenticateToken, authorize('customers', 'edit'), (req, res, next) => {
    try {
        const result = customerService.deleteDeliveryAddress(req.params.id, req.params.addressId, req.user);
        res.json(result);
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ error: err.message });
        }
        next(err);
    }
});

// POST /api/v1/customers/:id/addresses/:addressId/default - Set default delivery address
router.post('/:id/addresses/:addressId/default', authenticateToken, authorize('customers', 'edit'), (req, res, next) => {
    try {
        const address = customerService.setDefaultAddress(req.params.id, req.params.addressId, req.user);
        res.json(address);
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ error: err.message });
        }
        next(err);
    }
});

// GET /api/v1/customers/:id/notes - Get customer notes
router.get('/:id/notes', authenticateToken, authorize('customers', 'view'), (req, res, next) => {
    try {
        const customer = customerService.getCustomerById(req.params.id, req.user);
        res.json(customer.notes);
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ error: err.message });
        }
        next(err);
    }
});

// POST /api/v1/customers/:id/notes - Add customer note
router.post('/:id/notes', authenticateToken, authorize('customers', 'edit'), (req, res, next) => {
    try {
        const note = customerService.addCustomerNote(req.params.id, req.body, req.user);
        res.status(201).json(note);
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ error: err.message });
        }
        next(err);
    }
});

// DELETE /api/v1/customers/:id/notes/:noteId - Delete customer note
router.delete('/:id/notes/:noteId', authenticateToken, authorize('customers', 'edit'), (req, res, next) => {
    try {
        const result = customerService.deleteCustomerNote(req.params.id, req.params.noteId, req.user);
        res.json(result);
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ error: err.message });
        }
        next(err);
    }
});

// GET /api/v1/customers/:id/orders - Customer order history
router.get('/:id/orders', authenticateToken, authorize('customers', 'view'), (req, res, next) => {
    try {
        const result = customerService.getCustomerOrderHistory(req.params.id, req.user, req.query);
        res.json(result);
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ error: err.message });
        }
        next(err);
    }
});

// GET /api/v1/customers/:id/payments - Customer payment history
router.get('/:id/payments', authenticateToken, authorize('customers', 'view'), (req, res, next) => {
    try {
        const result = customerService.getCustomerPaymentHistory(req.params.id, req.user, req.query);
        res.json(result);
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ error: err.message });
        }
        next(err);
    }
});

// GET /api/v1/customers/:id/refunds - Customer refund history
router.get('/:id/refunds', authenticateToken, authorize('customers', 'view'), (req, res, next) => {
    try {
        const result = customerService.getCustomerRefundHistory(req.params.id, req.user, req.query);
        res.json(result);
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ error: err.message });
        }
        next(err);
    }
});

module.exports = router;
