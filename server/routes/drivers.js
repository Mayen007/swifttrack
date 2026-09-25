// server/routes/drivers.js
// SwiftTrack Kenya: Logistics & Fleet Management — Drivers API (Phase 9.1)
const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth.js');
const driverService = require('../services/driverService.js');

// GET /telemetry/summary - Fleet-wide driver aggregate telemetry
router.get('/telemetry/summary', authenticateToken, (req, res) => {
    try {
        const branchId = req.user.roleName === 'SUPER_ADMIN' 
            ? (req.query.branchId ? Number(req.query.branchId) : null)
            : req.user.branchId;

        const telemetry = driverService.getFleetTelemetry(branchId);
        res.json(telemetry);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// GET / - List all drivers with filters
router.get('/', authenticateToken, (req, res) => {
    try {
        const branchId = req.user.roleName === 'SUPER_ADMIN'
            ? (req.query.branchId ? Number(req.query.branchId) : null)
            : req.user.branchId;

        const { status, search, complianceStatus, page, limit } = req.query;

        const result = driverService.listDrivers({
            branchId,
            status,
            search,
            complianceStatus,
            page,
            limit
        });

        res.json(result);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// GET /:id - Single driver detailed profile
router.get('/:id', authenticateToken, (req, res) => {
    try {
        const driverId = Number(req.params.id);
        const driver = driverService.getDriverById(driverId);

        // Branch isolation guard
        if (req.user.roleName !== 'SUPER_ADMIN' && driver.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Driver belongs to another branch' });
        }

        res.json(driver);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// POST / - Create new driver profile
router.post('/', authenticateToken, requireRole(['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER']), (req, res) => {
    try {
        const branchId = req.user.roleName === 'SUPER_ADMIN'
            ? (req.body.branch_id ? Number(req.body.branch_id) : req.user.branchId)
            : req.user.branchId;

        const payload = {
            ...req.body,
            branch_id: branchId
        };

        const newDriver = driverService.createDriver(payload, req.user.id);
        res.status(201).json(newDriver);
    } catch (err) {
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// PUT /:id - Update driver profile
router.put('/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER']), (req, res) => {
    try {
        const driverId = Number(req.params.id);
        const existing = driverService.getDriverById(driverId);

        if (req.user.roleName !== 'SUPER_ADMIN' && existing.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Driver belongs to another branch' });
        }

        const updated = driverService.updateDriver(driverId, req.body, req.user.id);
        res.json(updated);
    } catch (err) {
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// PATCH /:id/status - Update driver operational status
router.patch('/:id/status', authenticateToken, requireRole(['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER']), (req, res) => {
    try {
        const driverId = Number(req.params.id);
        const { status, reason } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }

        const existing = driverService.getDriverById(driverId);
        if (req.user.roleName !== 'SUPER_ADMIN' && existing.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Driver belongs to another branch' });
        }

        const updated = driverService.updateDriverStatus(driverId, status, reason, req.user.id);
        res.json(updated);
    } catch (err) {
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// POST /:id/reassign-branch - Transfer driver to another branch depot
router.post('/:id/reassign-branch', authenticateToken, requireRole(['SUPER_ADMIN']), (req, res) => {
    try {
        const driverId = Number(req.params.id);
        const { branch_id } = req.body;

        if (!branch_id) {
            return res.status(400).json({ error: 'Target branch_id is required' });
        }

        const updated = driverService.assignDriverBranch(driverId, Number(branch_id), req.user.id);
        res.json(updated);
    } catch (err) {
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// POST /:id/assign-vehicle - Assign or unassign fleet vehicle
router.post('/:id/assign-vehicle', authenticateToken, requireRole(['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER']), (req, res) => {
    try {
        const driverId = Number(req.params.id);
        const { vehicle_id } = req.body;

        const existing = driverService.getDriverById(driverId);
        if (req.user.roleName !== 'SUPER_ADMIN' && existing.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Driver belongs to another branch' });
        }

        const updated = driverService.assignDriverVehicle(
            driverId,
            vehicle_id ? Number(vehicle_id) : null,
            req.user.id
        );
        res.json(updated);
    } catch (err) {
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// GET /:id/deliveries - Granular delivery history ledger
router.get('/:id/deliveries', authenticateToken, (req, res) => {
    try {
        const driverId = Number(req.params.id);
        const existing = driverService.getDriverById(driverId);

        if (req.user.roleName !== 'SUPER_ADMIN' && existing.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Driver belongs to another branch' });
        }

        const { limit, page, status } = req.query;
        const history = driverService.getDriverDeliveryHistory(driverId, { limit, page, status });
        res.json(history);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// GET /:id/performance - Detailed driver performance scorecard
router.get('/:id/performance', authenticateToken, (req, res) => {
    try {
        const driverId = Number(req.params.id);
        const existing = driverService.getDriverById(driverId);

        if (req.user.roleName !== 'SUPER_ADMIN' && existing.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Driver belongs to another branch' });
        }

        const perf = driverService.getDriverPerformance(driverId);
        res.json(perf);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// GET /:id/incidents - Safety & incident logs
router.get('/:id/incidents', authenticateToken, (req, res) => {
    try {
        const driverId = Number(req.params.id);
        const existing = driverService.getDriverById(driverId);

        if (req.user.roleName !== 'SUPER_ADMIN' && existing.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Driver belongs to another branch' });
        }

        const incidents = driverService.getDriverIncidents(driverId);
        res.json(incidents);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// POST /:id/incidents - Log safety incident
router.post('/:id/incidents', authenticateToken, requireRole(['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER']), (req, res) => {
    try {
        const driverId = Number(req.params.id);
        const existing = driverService.getDriverById(driverId);

        if (req.user.roleName !== 'SUPER_ADMIN' && existing.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Driver belongs to another branch' });
        }

        const incident = driverService.logDriverIncident(driverId, req.body, req.user.id);
        res.status(201).json(incident);
    } catch (err) {
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// GET /:id/status-history - Status transition history
router.get('/:id/status-history', authenticateToken, (req, res) => {
    try {
        const driverId = Number(req.params.id);
        const existing = driverService.getDriverById(driverId);

        if (req.user.roleName !== 'SUPER_ADMIN' && existing.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Driver belongs to another branch' });
        }

        const history = driverService.getDriverStatusHistory(driverId);
        res.json(history);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

module.exports = router;
