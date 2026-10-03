// server/routes/branches.js
// Enterprise Branch & Station Network Route Controller
const express = require('express');
const router = express.Router();
const branchRepository = require('../repositories/branchRepository.js');
const dbAdapter = require('../db/dbAdapter.js');
const { authenticateToken, authorize } = require('../middleware/auth.js');
const { logAuditEvent } = require('../middleware/audit.js');

// GET /api/branches - List branches (Super Admin sees detailed metrics; operational roles see network directory)
router.get('/', authenticateToken, authorize('branches', 'view'), async (req, res) => {
    try {
        const { city, search, is_active } = req.query;

        if (req.user.roleName === 'SUPER_ADMIN') {
            const branches = await branchRepository.findWithMetrics({
                city,
                search,
                isActive: is_active !== undefined ? is_active === '1' || is_active === 'true' : undefined
            });
            return res.json(branches);
        }

        // Operational staff see active branch directory
        const branches = await branchRepository.findForStaff(req.user.branchId || 0, { city, search });
        res.json(branches);
    } catch (err) {
        console.error('List branches error:', err);
        res.status(500).json({ error: 'Failed to list branches' });
    }
});

// GET /api/branches/:id - Get specific branch (Enforces branch isolation)
router.get('/:id', authenticateToken, authorize('branches', 'view'), async (req, res) => {
    try {
        const targetBranchId = Number(req.params.id);

        if (req.user.roleName !== 'SUPER_ADMIN' && targetBranchId !== Number(req.user.branchId)) {
            return res.status(403).json({
                error: `Forbidden: Branch isolation policy blocks access to branch ${targetBranchId}. You are bound to branch ${req.user.branchId}.`
            });
        }

        const branch = await branchRepository.findByIdWithMetrics(targetBranchId);
        if (!branch) {
            return res.status(404).json({ error: 'Branch not found' });
        }

        const warehouses = await branchRepository.getWarehousesByBranchId(targetBranchId);
        res.json({ ...branch, warehouses });
    } catch (err) {
        console.error('Get branch error:', err);
        res.status(500).json({ error: 'Failed to get branch' });
    }
});

// POST /api/branches - Create branch (SUPER_ADMIN ONLY)
router.post('/', authenticateToken, authorize('branches', 'create'), async (req, res) => {
    const { code, name, city, address, phone, email } = req.body;

    if (!code || !name || !city || !address || !phone || !email) {
        return res.status(400).json({ error: 'All branch details (code, name, city, address, phone, email) are required' });
    }

    try {
        const cleanCode = code.toUpperCase().trim();
        const existing = await branchRepository.findByCode(cleanCode);
        if (existing) {
            return res.status(409).json({ error: `Branch code '${cleanCode}' already exists.` });
        }

        const newBranchId = await branchRepository.create({
            code: cleanCode,
            name: name.trim(),
            city: city.trim(),
            address: address.trim(),
            phone: phone.trim(),
            email: email.trim(),
            is_active: true
        });

        // Automatically create a default retail depot warehouse for this new branch
        const warehouseCode = `W-${cleanCode}-01`;
        await branchRepository.createWarehouse({
            branch_id: newBranchId,
            code: warehouseCode,
            name: `${name.trim()} Depot`,
            location_desc: 'Main Depot'
        });

        logAuditEvent({
            userId: req.user.id,
            role: req.user.roleName,
            action: 'CREATE',
            resource: 'BRANCH',
            resourceId: String(newBranchId),
            branchId: newBranchId,
            newValue: { code: cleanCode, name, city, address },
            reason: 'Created new company branch'
        });

        const createdBranch = await branchRepository.findById(newBranchId);
        res.status(201).json(createdBranch);
    } catch (err) {
        if (err.message && err.message.includes('duplicate key')) {
            return res.status(409).json({ error: `Branch code '${code}' already exists.` });
        }
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/branches/:id - Edit branch
router.put('/:id', authenticateToken, authorize('branches', 'manage', { entityTable: 'branches', idParam: 'id', branchColumn: 'id' }), async (req, res) => {
    const targetBranchId = Number(req.params.id);
    const { name, city, address, phone, email, is_active } = req.body;

    try {
        const previous = await branchRepository.findById(targetBranchId);
        if (!previous) {
            return res.status(404).json({ error: 'Branch not found' });
        }

        const activeVal = (req.user.roleName === 'SUPER_ADMIN' && is_active !== undefined)
            ? Boolean(is_active)
            : previous.is_active;

        await branchRepository.update(targetBranchId, {
            name: name || previous.name,
            code: previous.code,
            city: city || previous.city,
            address: address || previous.address,
            phone: phone || previous.phone,
            email: email || previous.email,
            is_active: activeVal
        });

        logAuditEvent({
            userId: req.user.id,
            role: req.user.roleName,
            action: 'UPDATE',
            resource: 'BRANCH',
            resourceId: String(targetBranchId),
            branchId: targetBranchId,
            previousValue: previous,
            newValue: { name, city, address, phone, email, is_active: activeVal },
            reason: 'Updated branch profile'
        });

        const updated = await branchRepository.findById(targetBranchId);
        res.json(updated);
    } catch (err) {
        console.error('Update branch error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/branches/:id/warehouses - List warehouses for a branch
router.get('/:id/warehouses', authenticateToken, async (req, res) => {
    const targetBranchId = Number(req.params.id);

    if (req.user.roleName !== 'SUPER_ADMIN' && targetBranchId !== Number(req.user.branchId)) {
        return res.status(403).json({ error: 'Forbidden: Cannot view warehouses of an unauthorized branch.' });
    }

    try {
        const warehouses = await branchRepository.getWarehousesByBranchId(targetBranchId);
        res.json(warehouses);
    } catch (err) {
        console.error('List branch warehouses error:', err);
        res.status(500).json({ error: 'Failed to list branch warehouses' });
    }
});

// POST /api/branches/:id/warehouses - Create warehouse (SUPER_ADMIN or BRANCH_MANAGER of own branch)
router.post('/:id/warehouses', authenticateToken, async (req, res) => {
    const targetBranchId = Number(req.params.id);

    if (req.user.roleName !== 'SUPER_ADMIN' && (req.user.roleName !== 'BRANCH_MANAGER' || targetBranchId !== Number(req.user.branchId))) {
        return res.status(403).json({ error: 'Forbidden: Cannot create warehouses for this branch.' });
    }

    const { code, name, location_desc } = req.body;
    if (!code || !name) {
        return res.status(400).json({ error: 'Warehouse code and name are required' });
    }

    try {
        const warehouseId = await branchRepository.createWarehouse({
            branch_id: targetBranchId,
            code,
            name,
            location_desc
        });

        logAuditEvent({
            userId: req.user.id,
            role: req.user.roleName,
            action: 'CREATE',
            resource: 'WAREHOUSE',
            resourceId: String(warehouseId),
            branchId: targetBranchId,
            newValue: { code, name, branch_id: targetBranchId },
            reason: 'Added new warehouse facility'
        });

        res.status(201).json({ id: warehouseId, branch_id: targetBranchId, code, name });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
