// server/routes/vehicles.js
// SwiftTrack Kenya: Logistics & Fleet Management — Vehicles API (Phase 9.2)
const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth.js');
const vehicleService = require('../services/vehicleService.js');

// GET /telemetry/summary - Fleet-wide vehicle aggregate telemetry
router.get('/telemetry/summary', authenticateToken, (req, res) => {
    try {
        const branchId = req.user.roleName === 'SUPER_ADMIN' 
            ? (req.query.branchId ? Number(req.query.branchId) : null)
            : req.user.branchId;

        const telemetry = vehicleService.getFleetVehiclesTelemetry(branchId);
        res.json(telemetry);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// GET / - List all vehicles with filters (branch, status, type, search) & pagination
router.get('/', authenticateToken, (req, res) => {
    try {
        const branchId = req.user.roleName === 'SUPER_ADMIN'
            ? (req.query.branchId ? Number(req.query.branchId) : null)
            : req.user.branchId;

        const { status, vehicleType, search, page, limit } = req.query;

        const result = vehicleService.listVehicles({
            branchId,
            status,
            vehicleType,
            search,
            page,
            limit
        });

        res.json(result);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// GET /:id - Single vehicle detailed profile
router.get('/:id', authenticateToken, (req, res) => {
    try {
        const vehicleId = Number(req.params.id);
        const vehicle = vehicleService.getVehicleById(vehicleId);

        // Branch isolation guard
        if (req.user.roleName !== 'SUPER_ADMIN' && vehicle.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Vehicle belongs to another branch depot' });
        }

        res.json(vehicle);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// POST / - Register new fleet vehicle
router.post('/', authenticateToken, requireRole(['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER']), (req, res) => {
    try {
        const branchId = req.user.roleName === 'SUPER_ADMIN'
            ? (req.body.branch_id ? Number(req.body.branch_id) : req.user.branchId)
            : req.user.branchId;

        const payload = {
            ...req.body,
            branch_id: branchId
        };

        const newVehicle = vehicleService.createVehicle(payload, req.user.id);
        res.status(201).json(newVehicle);
    } catch (err) {
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// PUT /:id - Update vehicle profile specifications
router.put('/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER']), (req, res) => {
    try {
        const vehicleId = Number(req.params.id);
        const existing = vehicleService.getVehicleById(vehicleId);

        if (req.user.roleName !== 'SUPER_ADMIN' && existing.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Vehicle belongs to another branch depot' });
        }

        const updated = vehicleService.updateVehicle(vehicleId, req.body, req.user.id);
        res.json(updated);
    } catch (err) {
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// PATCH /:id/status - Update vehicle operational status
router.patch('/:id/status', authenticateToken, requireRole(['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER']), (req, res) => {
    try {
        const vehicleId = Number(req.params.id);
        const { status, reason } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }

        const existing = vehicleService.getVehicleById(vehicleId);
        if (req.user.roleName !== 'SUPER_ADMIN' && existing.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Vehicle belongs to another branch depot' });
        }

        const updated = vehicleService.updateVehicleStatus(vehicleId, status, reason, req.user.id);
        res.json(updated);
    } catch (err) {
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// GET /:id/fuel - Fuel fill logs history
router.get('/:id/fuel', authenticateToken, (req, res) => {
    try {
        const vehicleId = Number(req.params.id);
        const existing = vehicleService.getVehicleById(vehicleId);

        if (req.user.roleName !== 'SUPER_ADMIN' && existing.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Vehicle belongs to another branch depot' });
        }

        const { limit, page } = req.query;
        const fuelLogs = vehicleService.getVehicleFuelLogs(vehicleId, { limit, page });
        res.json(fuelLogs);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// POST /:id/fuel - Record new refuel voucher/receipt
router.post('/:id/fuel', authenticateToken, requireRole(['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER']), (req, res) => {
    try {
        const vehicleId = Number(req.params.id);
        const existing = vehicleService.getVehicleById(vehicleId);

        if (req.user.roleName !== 'SUPER_ADMIN' && existing.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Vehicle belongs to another branch depot' });
        }

        const log = vehicleService.recordFuelLog(vehicleId, req.body, req.user.id);
        res.status(201).json(log);
    } catch (err) {
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// GET /:id/maintenance - Service and repair history
router.get('/:id/maintenance', authenticateToken, (req, res) => {
    try {
        const vehicleId = Number(req.params.id);
        const existing = vehicleService.getVehicleById(vehicleId);

        if (req.user.roleName !== 'SUPER_ADMIN' && existing.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Vehicle belongs to another branch depot' });
        }

        const { limit, page, status } = req.query;
        const maintenance = vehicleService.getVehicleMaintenanceHistory(vehicleId, { limit, page, status });
        res.json(maintenance);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// POST /:id/maintenance - Schedule or record maintenance/repairs
router.post('/:id/maintenance', authenticateToken, requireRole(['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER']), (req, res) => {
    try {
        const vehicleId = Number(req.params.id);
        const existing = vehicleService.getVehicleById(vehicleId);

        if (req.user.roleName !== 'SUPER_ADMIN' && existing.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Vehicle belongs to another branch depot' });
        }

        const record = vehicleService.recordMaintenance(vehicleId, req.body, req.user.id);
        res.status(201).json(record);
    } catch (err) {
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// PATCH /maintenance/:recordId/status - Update maintenance job state (e.g. IN_PROGRESS -> COMPLETED)
router.patch('/maintenance/:recordId/status', authenticateToken, requireRole(['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER']), (req, res) => {
    try {
        const recordId = Number(req.params.recordId);
        const { status, total_cost, labor_cost, parts_cost, actual_completion_date, notes } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }

        const updated = vehicleService.updateMaintenanceStatus(recordId, status, {
            total_cost,
            labor_cost,
            parts_cost,
            actual_completion_date,
            notes
        }, req.user.id);

        res.json(updated);
    } catch (err) {
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// GET /:id/mileage - Mileage and trip logs
router.get('/:id/mileage', authenticateToken, (req, res) => {
    try {
        const vehicleId = Number(req.params.id);
        const existing = vehicleService.getVehicleById(vehicleId);

        if (req.user.roleName !== 'SUPER_ADMIN' && existing.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Vehicle belongs to another branch depot' });
        }

        const { limit, page } = req.query;
        const logs = vehicleService.getVehicleMileageLogs(vehicleId, { limit, page });
        res.json(logs);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// POST /:id/mileage - Log trip mileage
router.post('/:id/mileage', authenticateToken, requireRole(['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER']), (req, res) => {
    try {
        const vehicleId = Number(req.params.id);
        const existing = vehicleService.getVehicleById(vehicleId);

        if (req.user.roleName !== 'SUPER_ADMIN' && existing.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Vehicle belongs to another branch depot' });
        }

        const log = vehicleService.recordMileageLog(vehicleId, req.body, req.user.id);
        res.status(201).json(log);
    } catch (err) {
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// GET /:id/telemetry - Telemetry and cost per km metrics
router.get('/:id/telemetry', authenticateToken, (req, res) => {
    try {
        const vehicleId = Number(req.params.id);
        const existing = vehicleService.getVehicleById(vehicleId);

        if (req.user.roleName !== 'SUPER_ADMIN' && existing.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Vehicle belongs to another branch depot' });
        }

        const telemetry = vehicleService.getVehicleTelemetry(vehicleId);
        res.json(telemetry);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

module.exports = router;
