// server/services/vehicleService.js
// SwiftTrack Kenya: Logistics & Fleet Management — Vehicle Fleet Engine (Phase 9.2)
const { db } = require('../db/database.js');
const { logAuditEvent } = require('../middleware/audit.js');

const VALID_STATUSES = ['AVAILABLE', 'IN_TRANSIT', 'UNDER_MAINTENANCE', 'OUT_OF_SERVICE', 'RESERVED'];
const VALID_VEHICLE_TYPES = ['MOTORCYCLE', 'VAN', 'TRUCK', 'PICKUP', 'TUKTUK', 'LORRY'];
const VALID_FUEL_TYPES = ['DIESEL', 'PETROL', 'ELECTRIC', 'HYBRID'];
const VALID_OWNERSHIP_TYPES = ['COMPANY_OWNED', 'LEASED', 'THIRD_PARTY'];
const VALID_SERVICE_TYPES = [
    'PREVENTIVE_SCHEDULED',
    'REPAIR_CORRECTIVE',
    'TIRE_REPLACEMENT',
    'OIL_CHANGE',
    'INSPECTION_NTSA',
    'BRAKE_OVERHAUL',
    'ACCIDENT_REPAIR'
];
const VALID_MAINTENANCE_STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const VALID_TRIP_TYPES = ['DELIVERY_RUN', 'RELOCATION', 'MAINTENANCE', 'TEST_DRIVE'];

/**
 * Generate unique service maintenance reference number: SRV-YYYYMM-XXXX
 */
function generateServiceNumber() {
    const now = new Date();
    const prefix = `SRV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    let rand = Math.floor(1000 + Math.random() * 9000);
    let number = `${prefix}-${rand}`;

    let exists = db.prepare('SELECT id FROM vehicle_maintenance_records WHERE service_number = ?').get(number);
    while (exists) {
        rand = Math.floor(1000 + Math.random() * 9000);
        number = `${prefix}-${rand}`;
        exists = db.prepare('SELECT id FROM vehicle_maintenance_records WHERE service_number = ?').get(number);
    }
    return number;
}

/**
 * List vehicles with filters (branch, status, type, search) & pagination
 */
function listVehicles({ branchId, status, vehicleType, search, page = 1, limit = 50 }) {
    const pageNum = Math.max(1, Number(page) || 1);
    const pageLimit = Math.max(1, Math.min(100, Number(limit) || 50));
    const offset = (pageNum - 1) * pageLimit;

    let baseSql = `
        FROM vehicles v
        JOIN branches b ON v.branch_id = b.id
        LEFT JOIN drivers d ON v.assigned_driver_id = d.id
        LEFT JOIN users u ON d.user_id = u.id
        WHERE v.is_active = 1
    `;
    const params = [];

    if (branchId) {
        baseSql += ' AND v.branch_id = ?';
        params.push(branchId);
    }

    if (status && VALID_STATUSES.includes(status.toUpperCase())) {
        baseSql += ' AND v.status = ?';
        params.push(status.toUpperCase());
    }

    if (vehicleType && VALID_VEHICLE_TYPES.includes(vehicleType.toUpperCase())) {
        baseSql += ' AND v.vehicle_type = ?';
        params.push(vehicleType.toUpperCase());
    }

    if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        baseSql += ` AND (
            v.registration_number LIKE ? OR
            v.make LIKE ? OR
            v.model LIKE ? OR
            v.chassis_number LIKE ? OR
            u.full_name LIKE ?
        )`;
        params.push(term, term, term, term, term);
    }

    const totalCount = db.prepare(`SELECT count(*) as total ${baseSql}`).get(...params).total;

    const querySql = `
        SELECT 
            v.*,
            b.name as branch_name,
            b.code as branch_code,
            d.id as driver_id,
            d.employee_code as driver_code,
            d.phone as driver_phone,
            u.full_name as driver_name,
            (SELECT count(*) FROM deliveries WHERE vehicle_id = v.id AND status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT')) as active_deliveries_count,
            (SELECT count(*) FROM deliveries WHERE vehicle_id = v.id AND status = 'DELIVERED') as completed_deliveries_count,
            (SELECT count(*) FROM vehicle_maintenance_records WHERE vehicle_id = v.id AND status IN ('SCHEDULED', 'IN_PROGRESS')) as pending_maintenance_count,
            (SELECT total_cost FROM vehicle_fuel_logs WHERE vehicle_id = v.id ORDER BY id DESC LIMIT 1) as last_fuel_cost,
            (SELECT fuel_date FROM vehicle_fuel_logs WHERE vehicle_id = v.id ORDER BY id DESC LIMIT 1) as last_fuel_date
        ${baseSql}
        ORDER BY v.id DESC
        LIMIT ? OFFSET ?
    `;

    const rawVehicles = db.prepare(querySql).all(...params, pageLimit, offset);

    // Compute service proximity metrics
    const enriched = rawVehicles.map(veh => {
        const currentKm = Number(veh.current_odometer_km) || 0;
        const nextServiceKm = Number(veh.next_service_odometer_km) || (currentKm + 5000);
        const kmUntilService = Math.max(0, nextServiceKm - currentKm);
        const isServiceDue = kmUntilService <= 500;

        return {
            ...veh,
            capacity_kg: veh.max_capacity_kg,
            km_until_service: kmUntilService,
            is_service_due: isServiceDue
        };
    });

    return {
        vehicles: enriched,
        pagination: {
            page: pageNum,
            limit: pageLimit,
            total: totalCount,
            pages: Math.ceil(totalCount / pageLimit)
        }
    };
}

/**
 * Get single vehicle by ID with comprehensive details
 */
function getVehicleById(id) {
    const vehicle = db.prepare(`
        SELECT 
            v.*,
            b.name as branch_name,
            b.code as branch_code,
            d.id as driver_id,
            d.employee_code as driver_code,
            d.phone as driver_phone,
            u.full_name as driver_name,
            (SELECT count(*) FROM deliveries WHERE vehicle_id = v.id AND status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT')) as active_deliveries_count,
            (SELECT count(*) FROM deliveries WHERE vehicle_id = v.id AND status = 'DELIVERED') as completed_deliveries_count,
            (SELECT count(*) FROM vehicle_maintenance_records WHERE vehicle_id = v.id AND status IN ('SCHEDULED', 'IN_PROGRESS')) as pending_maintenance_count
        FROM vehicles v
        JOIN branches b ON v.branch_id = b.id
        LEFT JOIN drivers d ON v.assigned_driver_id = d.id
        LEFT JOIN users u ON d.user_id = u.id
        WHERE v.id = ? AND v.is_active = 1
    `).get(id);

    if (!vehicle) {
        const err = new Error('Vehicle not found');
        err.statusCode = 404;
        throw err;
    }

    const currentKm = Number(vehicle.current_odometer_km) || 0;
    const nextServiceKm = Number(vehicle.next_service_odometer_km) || (currentKm + 5000);
    vehicle.capacity_kg = vehicle.max_capacity_kg;
    vehicle.km_until_service = Math.max(0, nextServiceKm - currentKm);
    vehicle.is_service_due = vehicle.km_until_service <= 500;

    return vehicle;
}

/**
 * Register a new fleet vehicle
 */
function createVehicle(data, userId = null) {
    const {
        registration_number,
        vehicle_type = 'VAN',
        make = 'Toyota',
        model,
        year_of_manufacture,
        chassis_number,
        engine_number,
        color = 'White',
        fuel_type = 'DIESEL',
        fuel_tank_capacity_liters = 70.0,
        ownership_type = 'COMPANY_OWNED',
        max_capacity_kg = 1500,
        cargo_volume_cbm = 6.0,
        initial_odometer_km = 0.0,
        current_odometer_km = 0.0,
        next_service_odometer_km,
        branch_id,
        assigned_driver_id = null,
        notes = null
    } = data;

    if (!registration_number || !model || !branch_id) {
        const err = new Error('registration_number, model, and branch_id are required');
        err.statusCode = 400;
        throw err;
    }

    const normPlate = registration_number.trim().toUpperCase();

    // Kenya registration format validation e.g. KDL 456X, KMCE 123A, KBZ 789C
    const plateRegex = /^K[A-Z]{1,3}\s?[0-9]{1,4}[A-Z]?$/i;
    if (!plateRegex.test(normPlate)) {
        const err = new Error(`Invalid Kenya vehicle registration number format '${normPlate}'. Expected format like 'KDL 456X'`);
        err.statusCode = 400;
        throw err;
    }

    // Check duplicate plate
    const existing = db.prepare('SELECT id FROM vehicles WHERE registration_number = ?').get(normPlate);
    if (existing) {
        const err = new Error(`Vehicle with registration plate '${normPlate}' is already registered`);
        err.statusCode = 409;
        throw err;
    }

    // Verify branch exists
    const branch = db.prepare('SELECT id, name FROM branches WHERE id = ?').get(branch_id);
    if (!branch) {
        const err = new Error(`Branch ID ${branch_id} does not exist`);
        err.statusCode = 400;
        throw err;
    }

    // Verify driver if provided
    if (assigned_driver_id) {
        const drv = db.prepare('SELECT id, branch_id FROM drivers WHERE id = ?').get(assigned_driver_id);
        if (!drv) {
            const err = new Error(`Driver ID ${assigned_driver_id} does not exist`);
            err.statusCode = 400;
            throw err;
        }
    }

    const startOdo = Number(initial_odometer_km) || 0.0;
    const currOdo = Number(current_odometer_km) || startOdo;
    const nextService = Number(next_service_odometer_km) || (currOdo + 5000.0);
    const maxCap = Number(data.max_capacity_kg !== undefined ? data.max_capacity_kg : (data.capacity_kg !== undefined ? data.capacity_kg : 1500));

    const vehicleId = db.transaction(() => {
        const result = db.prepare(`
            INSERT INTO vehicles (
                branch_id, registration_number, vehicle_type, make, model,
                year_of_manufacture, chassis_number, engine_number, color,
                fuel_type, fuel_tank_capacity_liters, ownership_type,
                max_capacity_kg, cargo_volume_cbm,
                current_odometer_km, initial_odometer_km, last_service_odometer_km, next_service_odometer_km,
                status, status_reason, status_updated_at, assigned_driver_id,
                is_active, notes, created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?,
                ?, ?, ?, ?,
                'AVAILABLE', 'Initial onboarding', CURRENT_TIMESTAMP, ?,
                1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
        `).run(
            branch_id,
            normPlate,
            vehicle_type.toUpperCase(),
            make,
            model,
            year_of_manufacture || null,
            chassis_number || null,
            engine_number || null,
            color,
            fuel_type.toUpperCase(),
            Number(fuel_tank_capacity_liters) || 70.0,
            ownership_type.toUpperCase(),
            maxCap,
            Number(cargo_volume_cbm) || 6.0,
            currOdo,
            startOdo,
            currOdo,
            nextService,
            assigned_driver_id || null,
            notes || null
        );

        const id = Number(result.lastInsertRowid);

        // Sync assigned driver's vehicle_id if paired
        if (assigned_driver_id) {
            db.prepare('UPDATE drivers SET vehicle_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id, assigned_driver_id);
        }

        // Record initial status in status history
        db.prepare(`
            INSERT INTO vehicle_status_history (
                vehicle_id, from_status, to_status, reason, changed_by_user_id, created_at
            ) VALUES (?, NULL, 'AVAILABLE', 'Vehicle onboarded into fleet registry', ?, CURRENT_TIMESTAMP)
        `).run(id, userId || null);

        logAuditEvent({
            userId,
            role: 'DISPATCHER',
            action: 'CREATE',
            resource: 'VEHICLE',
            resourceId: id,
            branchId: branch_id,
            newValue: { id, registration_number: normPlate, make, model, max_capacity_kg },
            reason: 'Vehicle registered in fleet'
        });

        return id;
    })();

    return getVehicleById(vehicleId);
}

/**
 * Update vehicle profile details
 */
function updateVehicle(id, data, userId = null) {
    const existing = getVehicleById(id);

    const make = data.make !== undefined ? data.make : existing.make;
    const model = data.model !== undefined ? data.model : existing.model;
    const vehicle_type = data.vehicle_type !== undefined ? data.vehicle_type.toUpperCase() : existing.vehicle_type;
    const year_of_manufacture = data.year_of_manufacture !== undefined ? data.year_of_manufacture : existing.year_of_manufacture;
    const chassis_number = data.chassis_number !== undefined ? data.chassis_number : existing.chassis_number;
    const engine_number = data.engine_number !== undefined ? data.engine_number : existing.engine_number;
    const color = data.color !== undefined ? data.color : existing.color;
    const fuel_type = data.fuel_type !== undefined ? data.fuel_type.toUpperCase() : existing.fuel_type;
    const fuel_tank_capacity_liters = data.fuel_tank_capacity_liters !== undefined ? Number(data.fuel_tank_capacity_liters) : existing.fuel_tank_capacity_liters;
    const ownership_type = data.ownership_type !== undefined ? data.ownership_type.toUpperCase() : existing.ownership_type;
    const max_capacity_kg = data.max_capacity_kg !== undefined ? Number(data.max_capacity_kg) : (data.capacity_kg !== undefined ? Number(data.capacity_kg) : existing.max_capacity_kg);
    const cargo_volume_cbm = data.cargo_volume_cbm !== undefined ? Number(data.cargo_volume_cbm) : existing.cargo_volume_cbm;
    const branch_id = data.branch_id !== undefined ? Number(data.branch_id) : existing.branch_id;
    const assigned_driver_id = data.assigned_driver_id !== undefined ? (data.assigned_driver_id ? Number(data.assigned_driver_id) : null) : existing.assigned_driver_id;
    const notes = data.notes !== undefined ? data.notes : existing.notes;
    const next_service_odometer_km = data.next_service_odometer_km !== undefined ? Number(data.next_service_odometer_km) : existing.next_service_odometer_km;
    const next_service_date = data.next_service_date !== undefined ? data.next_service_date : existing.next_service_date;

    db.transaction(() => {
        // If assigned driver changed, update cross-references
        if (assigned_driver_id !== existing.assigned_driver_id) {
            // Unassign previous driver
            if (existing.assigned_driver_id) {
                db.prepare('UPDATE drivers SET vehicle_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(existing.assigned_driver_id);
            }
            // Assign new driver
            if (assigned_driver_id) {
                db.prepare('UPDATE drivers SET vehicle_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id, assigned_driver_id);
            }
        }

        db.prepare(`
            UPDATE vehicles
            SET make = ?,
                model = ?,
                vehicle_type = ?,
                year_of_manufacture = ?,
                chassis_number = ?,
                engine_number = ?,
                color = ?,
                fuel_type = ?,
                fuel_tank_capacity_liters = ?,
                ownership_type = ?,
                max_capacity_kg = ?,
                cargo_volume_cbm = ?,
                branch_id = ?,
                assigned_driver_id = ?,
                next_service_odometer_km = ?,
                next_service_date = ?,
                notes = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            make,
            model,
            vehicle_type,
            year_of_manufacture,
            chassis_number,
            engine_number,
            color,
            fuel_type,
            fuel_tank_capacity_liters,
            ownership_type,
            max_capacity_kg,
            cargo_volume_cbm,
            branch_id,
            assigned_driver_id,
            next_service_odometer_km,
            next_service_date,
            notes,
            id
        );

        logAuditEvent({
            userId,
            role: 'DISPATCHER',
            action: 'UPDATE',
            resource: 'VEHICLE',
            resourceId: id,
            branchId: existing.branch_id,
            previousValue: { model: existing.model, assigned_driver_id: existing.assigned_driver_id },
            newValue: { model, assigned_driver_id },
            reason: 'Vehicle details updated'
        });
    })();

    return getVehicleById(id);
}

/**
 * Transition vehicle operational status
 */
function updateVehicleStatus(vehicleId, newStatus, reason = null, userId = null) {
    const vehicle = getVehicleById(vehicleId);
    const upperStatus = newStatus.toUpperCase();

    if (!VALID_STATUSES.includes(upperStatus)) {
        const err = new Error(`Invalid status '${newStatus}'. Allowed: ${VALID_STATUSES.join(', ')}`);
        err.statusCode = 400;
        throw err;
    }

    if (vehicle.status === upperStatus) {
        return vehicle;
    }

    // Safety guard: cannot ground vehicle with active deliveries without reason
    if (['UNDER_MAINTENANCE', 'OUT_OF_SERVICE'].includes(upperStatus) && vehicle.active_deliveries_count > 0) {
        if (!reason) {
            const err = new Error(`Cannot transition vehicle to ${upperStatus} while it has ${vehicle.active_deliveries_count} active deliveries. Provide an override reason.`);
            err.statusCode = 400;
            throw err;
        }
    }

    db.transaction(() => {
        db.prepare(`
            UPDATE vehicles
            SET status = ?,
                status_reason = ?,
                status_updated_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(upperStatus, reason || null, vehicleId);

        db.prepare(`
            INSERT INTO vehicle_status_history (
                vehicle_id, from_status, to_status, reason, changed_by_user_id, created_at
            ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(vehicleId, vehicle.status, upperStatus, reason || null, userId || null);

        logAuditEvent({
            userId,
            role: 'DISPATCHER',
            action: 'UPDATE',
            resource: 'VEHICLE_STATUS',
            resourceId: vehicleId,
            branchId: vehicle.branch_id,
            previousValue: { status: vehicle.status },
            newValue: { status: upperStatus, reason },
            reason: `Vehicle status changed from ${vehicle.status} to ${upperStatus}`
        });
    })();

    return getVehicleById(vehicleId);
}

/**
 * Record a fuel intake log with consumption calculation (km/L)
 */
function recordFuelLog(vehicleId, data, userId) {
    const vehicle = getVehicleById(vehicleId);
    const {
        driver_id = vehicle.assigned_driver_id || null,
        fuel_date = new Date().toISOString(),
        fuel_type = vehicle.fuel_type || 'DIESEL',
        quantity_liters,
        cost_per_liter,
        total_cost,
        odometer_km,
        fuel_station = 'TotalEnergies',
        receipt_voucher_no = null,
        payment_method = 'CORPORATE_CARD',
        full_tank_flag = 1,
        notes = null
    } = data;

    const liters = Number(quantity_liters);
    const costPerL = Number(cost_per_liter);
    const computedTotal = total_cost ? Number(total_cost) : (liters * costPerL);
    const pumpOdo = Number(odometer_km);

    if (!liters || liters <= 0) {
        const err = new Error('quantity_liters must be greater than 0');
        err.statusCode = 400;
        throw err;
    }

    if (!pumpOdo || pumpOdo < Number(vehicle.current_odometer_km)) {
        const err = new Error(`odometer_km (${pumpOdo}) cannot be lower than current vehicle odometer (${vehicle.current_odometer_km})`);
        err.statusCode = 400;
        throw err;
    }

    // Fuel consumption calculation (km/L) if previous full-tank refuel exists
    let calculatedConsumption = null;
    if (full_tank_flag) {
        const lastFullTank = db.prepare(`
            SELECT odometer_km
            FROM vehicle_fuel_logs
            WHERE vehicle_id = ? AND full_tank_flag = 1
            ORDER BY id DESC
            LIMIT 1
        `).get(vehicleId);

        if (lastFullTank && pumpOdo > lastFullTank.odometer_km) {
            const distance = pumpOdo - lastFullTank.odometer_km;
            calculatedConsumption = Math.round((distance / liters) * 100) / 100;
        }
    }

    const logId = db.transaction(() => {
        const res = db.prepare(`
            INSERT INTO vehicle_fuel_logs (
                vehicle_id, driver_id, fuel_date, fuel_type, quantity_liters, cost_per_liter,
                total_cost, odometer_km, fuel_station, receipt_voucher_no, payment_method,
                full_tank_flag, calculated_consumption_kml, logged_by_user_id, notes, created_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, CURRENT_TIMESTAMP
            )
        `).run(
            vehicleId,
            driver_id,
            fuel_date,
            fuel_type.toUpperCase(),
            liters,
            costPerL,
            computedTotal,
            pumpOdo,
            fuel_station,
            receipt_voucher_no,
            payment_method,
            full_tank_flag ? 1 : 0,
            calculatedConsumption,
            userId,
            notes
        );

        // Advance vehicle current odometer
        db.prepare('UPDATE vehicles SET current_odometer_km = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(pumpOdo, vehicleId);

        logAuditEvent({
            userId,
            role: 'DISPATCHER',
            action: 'CREATE',
            resource: 'VEHICLE_FUEL',
            resourceId: Number(res.lastInsertRowid),
            branchId: vehicle.branch_id,
            newValue: { vehicleId, liters, costPerL, totalCost: computedTotal, odo: pumpOdo },
            reason: `Fuel logged: ${liters}L @ KES ${computedTotal}`
        });

        return Number(res.lastInsertRowid);
    })();

    return db.prepare(`
        SELECT fl.*, u.full_name as logged_by_name, d.employee_code as driver_code
        FROM vehicle_fuel_logs fl
        JOIN users u ON fl.logged_by_user_id = u.id
        LEFT JOIN drivers d ON fl.driver_id = d.id
        WHERE fl.id = ?
    `).get(logId);
}

/**
 * Get fuel logs for a vehicle
 */
function getVehicleFuelLogs(vehicleId, { limit = 50, page = 1 } = {}) {
    getVehicleById(vehicleId); // verify exists
    const pageNum = Math.max(1, Number(page) || 1);
    const pageLimit = Math.max(1, Math.min(100, Number(limit) || 50));
    const offset = (pageNum - 1) * pageLimit;

    const total = db.prepare('SELECT count(*) as count FROM vehicle_fuel_logs WHERE vehicle_id = ?').get(vehicleId).count;

    const logs = db.prepare(`
        SELECT fl.*, u.full_name as logged_by_name, d.employee_code as driver_code
        FROM vehicle_fuel_logs fl
        JOIN users u ON fl.logged_by_user_id = u.id
        LEFT JOIN drivers d ON fl.driver_id = d.id
        WHERE fl.vehicle_id = ?
        ORDER BY fl.id DESC
        LIMIT ? OFFSET ?
    `).all(vehicleId, pageLimit, offset);

    const sumRow = db.prepare(`
        SELECT 
            COALESCE(sum(quantity_liters), 0.0) as total_liters,
            COALESCE(sum(total_cost), 0.0) as total_spend,
            avg(calculated_consumption_kml) as avg_consumption_kml
        FROM vehicle_fuel_logs WHERE vehicle_id = ?
    `).get(vehicleId);

    return {
        logs,
        fuel_logs: logs,
        summary: {
            total_liters: sumRow.total_liters,
            total_spend: sumRow.total_spend,
            average_consumption_kml: sumRow.avg_consumption_kml ? Math.round(sumRow.avg_consumption_kml * 10) / 10 : null
        },
        pagination: {
            page: pageNum,
            limit: pageLimit,
            total,
            pages: Math.ceil(total / pageLimit)
        }
    };
}

/**
 * Record or schedule a maintenance service for a vehicle
 */
function recordMaintenance(vehicleId, data, userId) {
    const vehicle = getVehicleById(vehicleId);
    const {
        service_type = 'PREVENTIVE_SCHEDULED',
        severity = 'ROUTINE',
        service_date = new Date().toISOString().split('T')[0],
        odometer_km = vehicle.current_odometer_km,
        service_provider = 'In-House Depot Garage',
        invoice_reference = null,
        parts_cost = 0.0,
        labor_cost = 0.0,
        total_cost = null,
        status = 'COMPLETED',
        description,
        parts_replaced = null,
        next_service_due_date = null,
        next_service_due_km = null
    } = data;

    if (!description) {
        const err = new Error('Maintenance description is required');
        err.statusCode = 400;
        throw err;
    }

    const pCost = Number(parts_cost) || 0.0;
    const lCost = Number(labor_cost) || 0.0;
    const totCost = total_cost !== null && total_cost !== undefined ? Number(total_cost) : (pCost + lCost);
    const odo = Number(data.odometer_km !== undefined ? data.odometer_km : (data.service_odometer_km !== undefined ? data.service_odometer_km : vehicle.current_odometer_km));
    const nextKmTarget = data.next_service_due_km !== undefined 
        ? Number(data.next_service_due_km) 
        : (data.next_service_target_km !== undefined ? Number(data.next_service_target_km) : (odo + 5000));
    const nextServiceDate = data.next_service_due_date || data.next_service_target_date || null;
    const srvNum = generateServiceNumber();
    const upperStatus = status.toUpperCase();

    const recordId = db.transaction(() => {
        const res = db.prepare(`
            INSERT INTO vehicle_maintenance_records (
                vehicle_id, service_number, service_type, severity, service_date,
                odometer_km, service_provider, invoice_reference, parts_cost, labor_cost,
                total_cost, status, description, parts_replaced, next_service_due_date,
                next_service_due_km, logged_by_user_id, approved_by_user_id, created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
        `).run(
            vehicleId,
            srvNum,
            service_type.toUpperCase(),
            severity.toUpperCase(),
            service_date,
            odo,
            service_provider,
            invoice_reference,
            pCost,
            lCost,
            totCost,
            upperStatus,
            description,
            parts_replaced,
            nextServiceDate,
            nextKmTarget,
            userId,
            userId
        );

        const recId = Number(res.lastInsertRowid);

        // Update vehicle maintenance dates and odometer targets
        db.prepare(`
            UPDATE vehicles
            SET last_service_odometer_km = ?,
                last_service_date = ?,
                next_service_odometer_km = ?,
                next_service_date = COALESCE(?, next_service_date),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(odo, service_date, nextKmTarget, nextServiceDate, vehicleId);

        // If maintenance is IN_PROGRESS, set vehicle status to UNDER_MAINTENANCE
        if (upperStatus === 'IN_PROGRESS') {
            updateVehicleStatus(vehicleId, 'UNDER_MAINTENANCE', `Entered garage service: ${srvNum}`, userId);
        } else if (upperStatus === 'COMPLETED' && vehicle.status === 'UNDER_MAINTENANCE') {
            // Restore back to AVAILABLE
            updateVehicleStatus(vehicleId, 'AVAILABLE', `Completed garage service: ${srvNum}`, userId);
        }

        logAuditEvent({
            userId,
            role: 'DISPATCHER',
            action: 'CREATE',
            resource: 'VEHICLE_MAINTENANCE',
            resourceId: recId,
            branchId: vehicle.branch_id,
            newValue: { srvNum, service_type, total_cost: totCost, service_provider },
            reason: `Maintenance logged: ${srvNum} (${upperStatus})`
        });

        return recId;
    })();

    return db.prepare(`
        SELECT mr.*, u.full_name as logged_by_name
        FROM vehicle_maintenance_records mr
        JOIN users u ON mr.logged_by_user_id = u.id
        WHERE mr.id = ?
    `).get(recordId);
}

/**
 * Update maintenance record status (e.g. IN_PROGRESS -> COMPLETED)
 */
function updateMaintenanceStatus(recordId, newStatus, details = {}, userId = null) {
    const record = db.prepare('SELECT * FROM vehicle_maintenance_records WHERE id = ?').get(recordId);
    if (!record) {
        const err = new Error('Maintenance record not found');
        err.statusCode = 404;
        throw err;
    }

    const upperStatus = newStatus.toUpperCase();
    if (!VALID_MAINTENANCE_STATUSES.includes(upperStatus)) {
        const err = new Error(`Invalid status '${newStatus}'. Allowed: ${VALID_MAINTENANCE_STATUSES.join(', ')}`);
        err.statusCode = 400;
        throw err;
    }

    db.transaction(() => {
        db.prepare(`
            UPDATE vehicle_maintenance_records
            SET status = ?,
                parts_cost = COALESCE(?, parts_cost),
                labor_cost = COALESCE(?, labor_cost),
                total_cost = COALESCE(?, total_cost),
                parts_replaced = COALESCE(?, parts_replaced),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            upperStatus,
            details.parts_cost !== undefined ? Number(details.parts_cost) : null,
            details.labor_cost !== undefined ? Number(details.labor_cost) : null,
            details.total_cost !== undefined ? Number(details.total_cost) : null,
            details.parts_replaced || null,
            recordId
        );

        if (upperStatus === 'IN_PROGRESS') {
            updateVehicleStatus(record.vehicle_id, 'UNDER_MAINTENANCE', `Maintenance in progress: ${record.service_number}`, userId);
        } else if (upperStatus === 'COMPLETED') {
            updateVehicleStatus(record.vehicle_id, 'AVAILABLE', `Maintenance completed: ${record.service_number}`, userId);
        }
    })();

    return db.prepare('SELECT * FROM vehicle_maintenance_records WHERE id = ?').get(recordId);
}

/**
 * Get maintenance history for a vehicle
 */
function getVehicleMaintenanceHistory(vehicleId, { limit = 50, page = 1 } = {}) {
    getVehicleById(vehicleId);
    const pageNum = Math.max(1, Number(page) || 1);
    const pageLimit = Math.max(1, Math.min(100, Number(limit) || 50));
    const offset = (pageNum - 1) * pageLimit;

    const total = db.prepare('SELECT count(*) as count FROM vehicle_maintenance_records WHERE vehicle_id = ?').get(vehicleId).count;

    const records = db.prepare(`
        SELECT mr.*, u.full_name as logged_by_name
        FROM vehicle_maintenance_records mr
        JOIN users u ON mr.logged_by_user_id = u.id
        WHERE mr.vehicle_id = ?
        ORDER BY mr.id DESC
        LIMIT ? OFFSET ?
    `).all(vehicleId, pageLimit, offset);

    return {
        records,
        maintenance_records: records,
        pagination: {
            page: pageNum,
            limit: pageLimit,
            total,
            pages: Math.ceil(total / pageLimit)
        }
    };
}

/**
 * Record vehicle mileage log (advancing current odometer)
 */
function recordMileageLog(vehicleId, data, userId) {
    const vehicle = getVehicleById(vehicleId);
    const {
        driver_id = vehicle.assigned_driver_id || null,
        delivery_id = null,
        trip_type = 'DELIVERY_RUN',
        start_odometer_km,
        end_odometer_km,
        distance_km,
        notes = null
    } = data;

    const startKm = Number(start_odometer_km !== undefined ? start_odometer_km : vehicle.current_odometer_km);
    let endKm = Number(end_odometer_km);
    let dist = Number(distance_km);

    if (isNaN(endKm) && !isNaN(dist)) {
        endKm = startKm + dist;
    } else if (isNaN(dist) && !isNaN(endKm)) {
        dist = Math.max(0, endKm - startKm);
    }

    if (isNaN(endKm) || endKm < startKm) {
        const err = new Error(`end_odometer_km (${endKm}) cannot be less than start_odometer_km (${startKm})`);
        err.statusCode = 400;
        throw err;
    }

    const logId = db.transaction(() => {
        const res = db.prepare(`
            INSERT INTO vehicle_mileage_logs (
                vehicle_id, driver_id, delivery_id, trip_type, start_odometer_km, end_odometer_km,
                distance_km, recorded_at, logged_by_user_id, notes, created_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, CURRENT_TIMESTAMP, ?, ?, CURRENT_TIMESTAMP
            )
        `).run(
            vehicleId,
            driver_id,
            delivery_id,
            trip_type.toUpperCase(),
            startKm,
            endKm,
            dist,
            userId,
            notes
        );

        // Advance vehicle current odometer
        db.prepare('UPDATE vehicles SET current_odometer_km = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(endKm, vehicleId);

        return Number(res.lastInsertRowid);
    })();

    return db.prepare('SELECT * FROM vehicle_mileage_logs WHERE id = ?').get(logId);
}

/**
 * Get mileage logs for a vehicle
 */
function getVehicleMileageLogs(vehicleId, { limit = 50, page = 1 } = {}) {
    getVehicleById(vehicleId);
    const pageNum = Math.max(1, Number(page) || 1);
    const pageLimit = Math.max(1, Math.min(100, Number(limit) || 50));
    const offset = (pageNum - 1) * pageLimit;

    const total = db.prepare('SELECT count(*) as count FROM vehicle_mileage_logs WHERE vehicle_id = ?').get(vehicleId).count;

    const logs = db.prepare(`
        SELECT ml.*, u.full_name as logged_by_name, d.employee_code as driver_code
        FROM vehicle_mileage_logs ml
        JOIN users u ON ml.logged_by_user_id = u.id
        LEFT JOIN drivers d ON ml.driver_id = d.id
        WHERE ml.vehicle_id = ?
        ORDER BY ml.id DESC
        LIMIT ? OFFSET ?
    `).all(vehicleId, pageLimit, offset);

    const distRow = db.prepare('SELECT COALESCE(sum(distance_km), 0.0) as total_dist FROM vehicle_mileage_logs WHERE vehicle_id = ?').get(vehicleId);

    return {
        logs,
        mileage_logs: logs,
        summary: {
            total_logged_distance_km: distRow.total_dist
        },
        pagination: {
            page: pageNum,
            limit: pageLimit,
            total,
            pages: Math.ceil(total / pageLimit)
        }
    };
}

/**
 * Quantitative efficiency and cost telemetry for a vehicle
 */
function getVehicleTelemetry(vehicleId) {
    const vehicle = getVehicleById(vehicleId);

    // Mileage metrics
    const totalDistance = Math.max(0, Number(vehicle.current_odometer_km) - Number(vehicle.initial_odometer_km));

    // Fuel telemetry
    const fuelStats = db.prepare(`
        SELECT 
            count(*) as total_refuels,
            COALESCE(sum(quantity_liters), 0.0) as total_liters_pumped,
            COALESCE(sum(total_cost), 0.0) as total_fuel_spend,
            avg(calculated_consumption_kml) as avg_consumption_kml
        FROM vehicle_fuel_logs
        WHERE vehicle_id = ?
    `).get(vehicleId);

    // Maintenance telemetry
    const maintStats = db.prepare(`
        SELECT 
            count(*) as total_services,
            COALESCE(sum(total_cost), 0.0) as total_maintenance_spend,
            COALESCE(sum(parts_cost), 0.0) as total_parts_spend,
            COALESCE(sum(labor_cost), 0.0) as total_labor_spend
        FROM vehicle_maintenance_records
        WHERE vehicle_id = ? AND status = 'COMPLETED'
    `).get(vehicleId);

    const totalFuelSpend = fuelStats.total_fuel_spend || 0.0;
    const totalMaintSpend = maintStats.total_maintenance_spend || 0.0;
    const totalOperationalCost = totalFuelSpend + totalMaintSpend;

    // Operating cost per kilometer (KES / km)
    const costPerKm = totalDistance > 0 
        ? Math.round((totalOperationalCost / totalDistance) * 100) / 100 
        : 0.0;

    const currentKm = Number(vehicle.current_odometer_km) || 0;
    const nextServiceKm = Number(vehicle.next_service_odometer_km) || (currentKm + 5000);
    const kmUntilService = Math.max(0, nextServiceKm - currentKm);

    return {
        vehicle_id: vehicle.id,
        registration_number: vehicle.registration_number,
        model: `${vehicle.make} ${vehicle.model}`,
        status: vehicle.status,
        total_distance_km: totalDistance,
        total_fuel_spend: totalFuelSpend,
        total_maintenance_spend: totalMaintSpend,
        operating_cost_per_km: costPerKm,
        fuel_logs_count: fuelStats.total_refuels || 0,
        maintenance_records_count: maintStats.total_services || 0,
        km_until_service: kmUntilService,
        is_service_due: kmUntilService <= 500,
        metrics: {
            current_odometer_km: currentKm,
            total_distance_km: totalDistance,
            total_fuel_spend: totalFuelSpend,
            total_liters_pumped: Math.round(fuelStats.total_liters_pumped * 10) / 10,
            avg_consumption_kml: fuelStats.avg_consumption_kml ? Math.round(fuelStats.avg_consumption_kml * 10) / 10 : null,
            total_maintenance_spend: totalMaintSpend,
            total_services_completed: maintStats.total_services || 0,
            operating_cost_per_km: costPerKm,
            km_until_service: kmUntilService,
            is_service_due: kmUntilService <= 500
        }
    };
}

/**
 * Fleet aggregate telemetry metrics for executive header banner
 */
function getFleetVehiclesTelemetry(branchId = null) {
    let whereClause = 'WHERE is_active = 1';
    const params = [];
    if (branchId) {
        whereClause += ' AND branch_id = ?';
        params.push(branchId);
    }

    const counts = db.prepare(`
        SELECT 
            count(*) as total_vehicles,
            sum(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) as available_vehicles,
            sum(CASE WHEN status = 'IN_TRANSIT' THEN 1 ELSE 0 END) as in_transit_vehicles,
            sum(CASE WHEN status = 'UNDER_MAINTENANCE' THEN 1 ELSE 0 END) as maintenance_vehicles,
            sum(CASE WHEN status = 'OUT_OF_SERVICE' THEN 1 ELSE 0 END) as out_of_service_vehicles,
            sum(current_odometer_km - initial_odometer_km) as total_fleet_distance_km,
            sum(max_capacity_kg) as total_payload_capacity_kg
        FROM vehicles
        ${whereClause}
    `).get(...params);

    // Fleet fuel spend & efficiency
    let fuelWhere = 'WHERE 1=1';
    const fuelParams = [];
    if (branchId) {
        fuelWhere += ' AND vehicle_id IN (SELECT id FROM vehicles WHERE branch_id = ?)';
        fuelParams.push(branchId);
    }

    const fuelAgg = db.prepare(`
        SELECT 
            COALESCE(sum(total_cost), 0.0) as fleet_fuel_spend,
            COALESCE(sum(quantity_liters), 0.0) as fleet_liters,
            avg(calculated_consumption_kml) as fleet_avg_consumption_kml
        FROM vehicle_fuel_logs
        ${fuelWhere}
    `).get(...fuelParams);

    return {
        total_vehicles: counts.total_vehicles || 0,
        available_vehicles: counts.available_vehicles || 0,
        in_transit_vehicles: counts.in_transit_vehicles || 0,
        maintenance_vehicles: counts.maintenance_vehicles || 0,
        out_of_service_vehicles: counts.out_of_service_vehicles || 0,
        total_fleet_distance_km: Math.round((counts.total_fleet_distance_km || 0) * 10) / 10,
        total_payload_capacity_kg: counts.total_payload_capacity_kg || 0,
        monthly_fuel_spend: fuelAgg.fleet_fuel_spend || 0.0,
        fleet_avg_consumption_kml: fuelAgg.fleet_avg_consumption_kml ? Math.round(fuelAgg.fleet_avg_consumption_kml * 10) / 10 : 8.5
    };
}

module.exports = {
    listVehicles,
    getVehicleById,
    createVehicle,
    updateVehicle,
    updateVehicleStatus,
    recordFuelLog,
    getVehicleFuelLogs,
    recordMaintenance,
    updateMaintenanceStatus,
    getVehicleMaintenanceHistory,
    recordMileageLog,
    getVehicleMileageLogs,
    getVehicleTelemetry,
    getFleetVehiclesTelemetry,
    VALID_STATUSES,
    VALID_VEHICLE_TYPES,
    VALID_FUEL_TYPES,
    VALID_OWNERSHIP_TYPES,
    VALID_SERVICE_TYPES,
    VALID_MAINTENANCE_STATUSES,
    VALID_TRIP_TYPES
};
