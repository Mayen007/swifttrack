// server/services/driverService.js
// SwiftTrack Kenya: Logistics & Fleet Management — Driver Management Service (Phase 9.1)
const dbAdapter = require('../db/dbAdapter.js');
const { logAuditEvent } = require('../middleware/audit.js');
const { hashPassword } = require('../utils/security.js');

const VALID_STATUSES = ['AVAILABLE', 'ON_DELIVERY', 'OFF_DUTY', 'ON_LEAVE', 'SUSPENDED'];
const VALID_INCIDENT_TYPES = ['ACCIDENT', 'TRAFFIC_VIOLATION', 'CUSTOMER_COMPLAINT', 'VEHICLE_BREAKDOWN', 'DELAY'];
const VALID_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const VALID_EMPLOYMENT_TYPES = ['FULL_TIME', 'CONTRACTOR', 'CASUAL'];

/**
 * Generate sequential unique employee code: DRV-0001, DRV-0002...
 */
async function generateEmployeeCode(tx = null) {
    const executor = tx || dbAdapter;
    let nextNum = 1;
    const maxRow = await executor.get(`
        SELECT employee_code 
        FROM drivers 
        WHERE employee_code LIKE 'DRV-%' 
        ORDER BY id DESC 
        LIMIT 1
    `);

    if (maxRow && maxRow.employee_code) {
        const parts = maxRow.employee_code.split('-');
        if (parts[1] && !isNaN(Number(parts[1]))) {
            nextNum = Number(parts[1]) + 1;
        }
    }

    let code = `DRV-${String(nextNum).padStart(4, '0')}`;
    let exists = await executor.get('SELECT id FROM drivers WHERE employee_code = ?', [code]);
    while (exists) {
        nextNum++;
        code = `DRV-${String(nextNum).padStart(4, '0')}`;
        exists = await executor.get('SELECT id FROM drivers WHERE employee_code = ?', [code]);
    }
    return code;
}

/**
 * Calculate license compliance state for a driver
 */
function calculateCompliance(licenseExpiryDate, ntsaVerified) {
    if (!licenseExpiryDate) {
        return {
            status: 'UNVERIFIED',
            days_left: 0,
            is_valid: false,
            message: 'No driving license expiry date recorded'
        };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(licenseExpiryDate);
    expiry.setHours(0, 0, 0, 0);

    const diffMs = expiry.getTime() - today.getTime();
    const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
        return {
            status: 'EXPIRED',
            days_left: daysLeft,
            is_valid: false,
            message: `License expired ${Math.abs(daysLeft)} day(s) ago`
        };
    } else if (daysLeft <= 30) {
        return {
            status: 'EXPIRING_SOON',
            days_left: daysLeft,
            is_valid: true,
            message: `License expires in ${daysLeft} day(s)`
        };
    } else if (!ntsaVerified) {
        return {
            status: 'UNVERIFIED',
            days_left: daysLeft,
            is_valid: true,
            message: 'License awaiting NTSA verification check'
        };
    }

    return {
        status: 'VALID',
        days_left: daysLeft,
        is_valid: true,
        message: 'NTSA license verified and valid'
    };
}

/**
 * List drivers with optional branch isolation, status filter, compliance filter, and search
 */
async function listDrivers({ branchId, status, search, complianceStatus, page = 1, limit = 50 }) {
    const pageNum = Math.max(1, Number(page) || 1);
    const pageLimit = Math.max(1, Math.min(100, Number(limit) || 50));
    const offset = (pageNum - 1) * pageLimit;

    let baseSql = `
        FROM drivers d
        JOIN users u ON d.user_id = u.id
        JOIN branches b ON d.branch_id = b.id
        LEFT JOIN vehicles v ON (d.vehicle_id = v.id OR v.assigned_driver_id = d.id)
        WHERE 1=1
    `;
    const params = [];

    if (branchId) {
        baseSql += ' AND d.branch_id = ?';
        params.push(branchId);
    }

    if (status && VALID_STATUSES.includes(status.toUpperCase())) {
        baseSql += ' AND d.status = ?';
        params.push(status.toUpperCase());
    }

    if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        baseSql += ` AND (
            u.full_name LIKE ? OR 
            d.employee_code LIKE ? OR 
            d.phone LIKE ? OR 
            d.license_number LIKE ? OR 
            d.national_id LIKE ? OR
            v.registration_number LIKE ?
        )`;
        params.push(term, term, term, term, term, term);
    }

    const countSql = `SELECT count(*) as total ${baseSql}`;
    const countRow = await dbAdapter.get(countSql, params);
    const totalCount = countRow ? Number(countRow.total) : 0;

    const dataSql = `
        SELECT 
            d.*,
            COALESCE(d.vehicle_id, v.id) as vehicle_id,
            COALESCE(d.vehicle_id, v.id) as assigned_vehicle_id,
            u.full_name,
            u.username,
            u.is_active as user_is_active,
            b.name as branch_name,
            b.code as branch_code,
            v.registration_number as vehicle_reg,
            v.vehicle_type,
            v.model as vehicle_model,
            (SELECT count(*) FROM deliveries WHERE driver_id = d.id AND status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT')) as active_deliveries_count,
            (SELECT count(*) FROM deliveries WHERE driver_id = d.id AND status = 'DELIVERED') as completed_deliveries_count,
            (SELECT count(*) FROM driver_incident_logs WHERE driver_id = d.id) as incident_count
        ${baseSql}
        ORDER BY d.id DESC
        LIMIT ? OFFSET ?
    `;

    const rawDrivers = await dbAdapter.all(dataSql, [...params, pageLimit, offset]);

    const drivers = rawDrivers.map(drv => {
        const comp = calculateCompliance(drv.license_expiry_date, drv.ntsa_verified);
        return {
            ...drv,
            rating: drv.rating != null ? Number(drv.rating) : 5.0,
            active_deliveries_count: Number(drv.active_deliveries_count) || 0,
            completed_deliveries_count: Number(drv.completed_deliveries_count) || 0,
            incident_count: Number(drv.incident_count) || 0,
            assigned_vehicle_id: drv.vehicle_id || null,
            compliance: comp
        };
    });

    const filteredDrivers = complianceStatus 
        ? drivers.filter(d => d.compliance.status === complianceStatus.toUpperCase())
        : drivers;

    return {
        drivers: filteredDrivers,
        pagination: {
            page: pageNum,
            limit: pageLimit,
            total: complianceStatus ? filteredDrivers.length : totalCount,
            pages: Math.ceil((complianceStatus ? filteredDrivers.length : totalCount) / pageLimit)
        }
    };
}

/**
 * Get full driver profile by driver ID
 */
async function getDriverById(id, tx = null) {
    const executor = tx || dbAdapter;
    const driver = await executor.get(`
        SELECT 
            d.*,
            COALESCE(d.vehicle_id, v.id) as vehicle_id,
            COALESCE(d.vehicle_id, v.id) as assigned_vehicle_id,
            u.full_name,
            u.username,
            u.is_active as user_is_active,
            u.last_login_at,
            b.name as branch_name,
            b.code as branch_code,
            v.registration_number as vehicle_reg,
            v.vehicle_type,
            v.model as vehicle_model,
            v.max_capacity_kg as vehicle_capacity_kg,
            (SELECT count(*) FROM deliveries WHERE driver_id = d.id AND status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT')) as active_deliveries_count,
            (SELECT count(*) FROM deliveries WHERE driver_id = d.id AND status = 'DELIVERED') as completed_deliveries_count,
            (SELECT count(*) FROM driver_incident_logs WHERE driver_id = d.id) as incident_count
        FROM drivers d
        JOIN users u ON d.user_id = u.id
        JOIN branches b ON d.branch_id = b.id
        LEFT JOIN vehicles v ON (d.vehicle_id = v.id OR v.assigned_driver_id = d.id)
        WHERE d.id = ?
    `, [id]);

    if (!driver) {
        const err = new Error('Driver not found');
        err.statusCode = 404;
        throw err;
    }

    driver.rating = driver.rating != null ? Number(driver.rating) : 5.0;
    driver.active_deliveries_count = Number(driver.active_deliveries_count) || 0;
    driver.completed_deliveries_count = Number(driver.completed_deliveries_count) || 0;
    driver.incident_count = Number(driver.incident_count) || 0;
    driver.assigned_vehicle_id = driver.vehicle_id || null;
    driver.compliance = calculateCompliance(driver.license_expiry_date, driver.ntsa_verified);
    return driver;
}

/**
 * Create a new driver profile with optional staff user account provisioning
 */
async function createDriver(data, creatorUserId = null) {
    const {
        full_name,
        email,
        phone,
        alt_phone,
        branch_id,
        national_id,
        kra_pin,
        nssf_number,
        nhif_number,
        license_number,
        license_classes = 'B, C1',
        license_issue_date,
        license_expiry_date,
        ntsa_verified = 1,
        employment_type = 'FULL_TIME',
        hire_date,
        avatar_url,
        blood_group,
        residential_address,
        city = null,
        emergency_contact_name,
        emergency_contact_phone,
        emergency_contact_relation,
        vehicle_id = null,
        notes = null,
        user_id = null,
        username = null,
        password = null
    } = data;

    const chosenVehicleId = vehicle_id || data.assigned_vehicle_id ? Number(vehicle_id || data.assigned_vehicle_id) : null;

    if (!full_name || !phone || !branch_id || !license_number) {
        const err = new Error('Missing required fields: full_name, phone, branch_id, and license_number are required');
        err.statusCode = 400;
        throw err;
    }

    // Verify branch exists
    const branch = await dbAdapter.get('SELECT id, name, city FROM branches WHERE id = ?', [branch_id]);
    if (!branch) {
        const err = new Error(`Branch with ID ${branch_id} does not exist`);
        err.statusCode = 400;
        throw err;
    }

    // Verify vehicle if provided
    if (chosenVehicleId) {
        const vehicle = await dbAdapter.get('SELECT id, branch_id, is_active FROM vehicles WHERE id = ?', [chosenVehicleId]);
        if (!vehicle) {
            const err = new Error(`Vehicle with ID ${chosenVehicleId} does not exist`);
            err.statusCode = 400;
            throw err;
        }
    }

    let linkedUserId = user_id;

    return await dbAdapter.withTransaction(async (tx) => {
        // 1. Provision user if not provided
        if (!linkedUserId) {
            const genUsername = username || `driver.${full_name.toLowerCase().replace(/[^a-z0-9]/g, '')}.${Math.floor(100 + Math.random() * 900)}`;
            const genEmail = email || `${genUsername}@swifttrack.co.ke`;
            const rawPassword = password || 'Driver@SwiftTrack2026!';
            const passHash = hashPassword(rawPassword);

            // Check if username/email already taken
            const existingUser = await tx.get('SELECT id FROM users WHERE username = ? OR email = ?', [genUsername, genEmail]);
            if (existingUser) {
                linkedUserId = existingUser.id;
            } else {
                const userInsert = await tx.run(`
                    INSERT INTO users (
                        branch_id, role_id, username, email, full_name, phone, password_hash, is_active, created_at, updated_at
                    ) VALUES (?, 5, ?, ?, ?, ?, ?, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                `, [branch_id, genUsername, genEmail, full_name, phone, passHash]);
                linkedUserId = Number(userInsert.insertId);
            }
        } else {
            // Verify existing user exists and is not already a driver
            const existingDriverUser = await tx.get('SELECT id FROM drivers WHERE user_id = ?', [linkedUserId]);
            if (existingDriverUser) {
                const err = new Error(`User ID ${linkedUserId} is already assigned to driver #${existingDriverUser.id}`);
                err.statusCode = 400;
                throw err;
            }
        }

        // 2. Generate unique employee code
        const employeeCode = data.employee_code || await generateEmployeeCode(tx);

        // 3. Insert driver
        const result = await tx.run(`
            INSERT INTO drivers (
                user_id, branch_id, employee_code, employment_type, hire_date, avatar_url, blood_group,
                phone, alt_phone, email, residential_address, city,
                emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
                national_id, kra_pin, nssf_number, nhif_number,
                license_number, license_classes, license_issue_date, license_expiry_date,
                ntsa_verified, ntsa_verification_date, vehicle_id, status, status_reason, status_updated_at,
                rating, notes, created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, 'AVAILABLE', 'Initial onboarding', CURRENT_TIMESTAMP,
                5.0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
        `, [
            linkedUserId,
            branch_id,
            employeeCode,
            employment_type,
            hire_date || null,
            avatar_url || null,
            blood_group || null,
            phone,
            alt_phone || null,
            email || null,
            residential_address || null,
            city || (branch && branch.city) || null,
            emergency_contact_name || null,
            emergency_contact_phone || null,
            emergency_contact_relation || null,
            national_id || null,
            kra_pin || null,
            nssf_number || null,
            nhif_number || null,
            license_number,
            license_classes,
            license_issue_date || null,
            license_expiry_date || null,
            ntsa_verified ? 1 : 0,
            ntsa_verified ? (data.ntsa_verification_date || new Date().toISOString().split('T')[0]) : null,
            chosenVehicleId || null,
            notes || null
        ]);

        const driverId = Number(result.insertId);

        // Sync vehicle assigned_driver_id if vehicle was chosen
        if (chosenVehicleId) {
            await tx.run('UPDATE drivers SET vehicle_id = NULL WHERE vehicle_id = ? AND id != ?', [chosenVehicleId, driverId]);
            await tx.run('UPDATE vehicles SET assigned_driver_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [driverId, chosenVehicleId]);
        }

        // 4. Log initial status
        await tx.run(`
            INSERT INTO driver_status_history (
                driver_id, from_status, to_status, reason, changed_by_user_id, created_at
            ) VALUES (?, NULL, 'AVAILABLE', 'Driver created and activated', ?, CURRENT_TIMESTAMP)
        `, [driverId, creatorUserId || null]);

        // 5. Audit log
        logAuditEvent({
            userId: creatorUserId,
            role: 'DISPATCHER',
            action: 'CREATE',
            resource: 'DRIVER',
            resourceId: driverId,
            branchId: branch_id,
            newValue: { id: driverId, employeeCode, full_name, license_number, branch_id },
            reason: 'Driver profile created'
        });

        return await getDriverById(driverId, tx);
    });
}

/**
 * Update driver profile
 */
async function updateDriver(id, data, updaterUserId = null) {
    const existing = await getDriverById(id);

    const full_name = data.full_name !== undefined ? data.full_name : existing.full_name;
    const phone = data.phone !== undefined ? data.phone : existing.phone;
    const alt_phone = data.alt_phone !== undefined ? data.alt_phone : existing.alt_phone;
    const email = data.email !== undefined ? data.email : existing.email;
    const employment_type = data.employment_type !== undefined ? data.employment_type : existing.employment_type;
    const hire_date = data.hire_date !== undefined ? data.hire_date : existing.hire_date;
    const avatar_url = data.avatar_url !== undefined ? data.avatar_url : existing.avatar_url;
    const blood_group = data.blood_group !== undefined ? data.blood_group : existing.blood_group;
    const residential_address = data.residential_address !== undefined ? data.residential_address : existing.residential_address;
    const city = data.city !== undefined ? data.city : existing.city;
    const emergency_contact_name = data.emergency_contact_name !== undefined ? data.emergency_contact_name : existing.emergency_contact_name;
    const emergency_contact_phone = data.emergency_contact_phone !== undefined ? data.emergency_contact_phone : existing.emergency_contact_phone;
    const emergency_contact_relation = data.emergency_contact_relation !== undefined ? data.emergency_contact_relation : existing.emergency_contact_relation;
    const national_id = data.national_id !== undefined ? data.national_id : existing.national_id;
    const kra_pin = data.kra_pin !== undefined ? data.kra_pin : existing.kra_pin;
    const nssf_number = data.nssf_number !== undefined ? data.nssf_number : existing.nssf_number;
    const nhif_number = data.nhif_number !== undefined ? data.nhif_number : existing.nhif_number;
    const license_number = data.license_number !== undefined ? data.license_number : existing.license_number;
    const license_classes = data.license_classes !== undefined ? data.license_classes : existing.license_classes;
    const license_issue_date = data.license_issue_date !== undefined ? data.license_issue_date : existing.license_issue_date;
    const license_expiry_date = data.license_expiry_date !== undefined ? data.license_expiry_date : existing.license_expiry_date;
    const ntsa_verified = data.ntsa_verified !== undefined ? (data.ntsa_verified ? 1 : 0) : existing.ntsa_verified;
    const ntsa_verification_date = data.ntsa_verification_date !== undefined ? data.ntsa_verification_date : existing.ntsa_verification_date;
    const rating = data.rating !== undefined ? Number(data.rating) : existing.rating;
    const notes = data.notes !== undefined ? data.notes : existing.notes;

    return await dbAdapter.withTransaction(async (tx) => {
        await tx.run(`
            UPDATE drivers
            SET phone = ?,
                alt_phone = ?,
                email = ?,
                employment_type = ?,
                hire_date = ?,
                avatar_url = ?,
                blood_group = ?,
                residential_address = ?,
                city = ?,
                emergency_contact_name = ?,
                emergency_contact_phone = ?,
                emergency_contact_relation = ?,
                national_id = ?,
                kra_pin = ?,
                nssf_number = ?,
                nhif_number = ?,
                license_number = ?,
                license_classes = ?,
                license_issue_date = ?,
                license_expiry_date = ?,
                ntsa_verified = ?,
                ntsa_verification_date = ?,
                rating = ?,
                notes = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            phone, alt_phone || null, email || null, employment_type, hire_date || null,
            avatar_url || null, blood_group || null, residential_address || null, city || null,
            emergency_contact_name || null, emergency_contact_phone || null, emergency_contact_relation || null,
            national_id || null, kra_pin || null, nssf_number || null, nhif_number || null,
            license_number, license_classes, license_issue_date || null, license_expiry_date || null,
            ntsa_verified, ntsa_verification_date || null, rating, notes || null,
            id
        ]);

        if (data.full_name || data.phone || data.email) {
            await tx.run(`
                UPDATE users 
                SET full_name = COALESCE(?, full_name),
                    phone = COALESCE(?, phone),
                    email = COALESCE(?, email),
                    updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `, [data.full_name || null, data.phone || null, data.email || null, existing.user_id]);
        }

        // Synchronize branch reassignment if specified
        if (data.branch_id !== undefined && data.branch_id && Number(data.branch_id) !== existing.branch_id) {
            const newBranchId = Number(data.branch_id);
            await tx.run('UPDATE drivers SET branch_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newBranchId, id]);
            await tx.run('UPDATE users SET branch_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newBranchId, existing.user_id]);
        }

        // Synchronize vehicle assignment if specified
        if (data.vehicle_id !== undefined || data.assigned_vehicle_id !== undefined) {
            const rawVeh = data.vehicle_id !== undefined ? data.vehicle_id : data.assigned_vehicle_id;
            const newVehId = rawVeh ? Number(rawVeh) : null;
            const curVehId = existing.vehicle_id ? Number(existing.vehicle_id) : null;

            if (newVehId !== curVehId) {
                if (!newVehId) {
                    await tx.run('UPDATE drivers SET vehicle_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
                    await tx.run('UPDATE vehicles SET assigned_driver_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE assigned_driver_id = ?', [id]);
                    if (curVehId) {
                        await tx.run('UPDATE vehicles SET assigned_driver_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [curVehId]);
                    }
                } else {
                    await tx.run('UPDATE drivers SET vehicle_id = NULL WHERE vehicle_id = ? AND id != ?', [newVehId, id]);
                    if (curVehId && curVehId !== newVehId) {
                        await tx.run('UPDATE vehicles SET assigned_driver_id = NULL WHERE id = ?', [curVehId]);
                    }
                    await tx.run('UPDATE vehicles SET assigned_driver_id = NULL WHERE assigned_driver_id = ? AND id != ?', [id, newVehId]);
                    await tx.run('UPDATE drivers SET vehicle_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newVehId, id]);
                    await tx.run('UPDATE vehicles SET assigned_driver_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id, newVehId]);
                }
            }
        }

        logAuditEvent({
            userId: updaterUserId,
            role: 'DISPATCHER',
            action: 'UPDATE',
            resource: 'DRIVER',
            resourceId: id,
            branchId: existing.branch_id,
            previousValue: { phone: existing.phone, license_number: existing.license_number },
            newValue: { phone, license_number },
            reason: 'Driver profile details updated'
        });

        return await getDriverById(id, tx);
    });
}

/**
 * Update driver operational status
 */
async function updateDriverStatus(driverId, status, reason = null, userId = null) {
    if (!VALID_STATUSES.includes(status)) {
        const err = new Error(`Invalid driver status '${status}'. Allowed statuses: ${VALID_STATUSES.join(', ')}`);
        err.statusCode = 400;
        throw err;
    }

    const driver = await getDriverById(driverId);
    const prevStatus = driver.status;

    return await dbAdapter.withTransaction(async (tx) => {
        await tx.run(`
            UPDATE drivers
            SET status = ?,
                status_reason = ?,
                status_updated_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [status, reason || null, driverId]);

        await tx.run(`
            INSERT INTO driver_status_history (
                driver_id, from_status, to_status, reason, changed_by_user_id, created_at
            ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [driverId, prevStatus, status, reason || null, userId || null]);

        logAuditEvent({
            userId,
            role: 'DISPATCHER',
            action: 'STATUS_CHANGE',
            resource: 'DRIVER',
            resourceId: driverId,
            branchId: driver.branch_id,
            previousValue: { status: prevStatus },
            newValue: { status, reason },
            reason: `Driver status transitioned from ${prevStatus} to ${status}`
        });

        return await getDriverById(driverId, tx);
    });
}

/**
 * Assign or reassign driver to a branch
 */
async function assignDriverBranch(driverId, branchId, userId = null) {
    const driver = await getDriverById(driverId);
    const branch = await dbAdapter.get('SELECT id, name FROM branches WHERE id = ?', [branchId]);
    if (!branch) {
        const err = new Error(`Branch with ID ${branchId} does not exist`);
        err.statusCode = 404;
        throw err;
    }

    return await dbAdapter.withTransaction(async (tx) => {
        await tx.run('UPDATE drivers SET branch_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [branchId, driverId]);
        await tx.run('UPDATE users SET branch_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [branchId, driver.user_id]);

        logAuditEvent({
            userId,
            role: 'SUPER_ADMIN',
            action: 'REASSIGN_BRANCH',
            resource: 'DRIVER',
            resourceId: driverId,
            branchId,
            previousValue: { branch_id: driver.branch_id },
            newValue: { branch_id: branchId, branch_name: branch.name },
            reason: `Driver reassigned to branch ${branch.name}`
        });

        return await getDriverById(driverId, tx);
    });
}

/**
 * Assign or unassign fleet vehicle to driver
 */
async function assignDriverVehicle(driverId, vehicleId, userId = null) {
    const driver = await getDriverById(driverId);

    if (!vehicleId) {
        // Unassign driver from vehicle
        await dbAdapter.withTransaction(async (tx) => {
            await tx.run('UPDATE drivers SET vehicle_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [driverId]);
            await tx.run('UPDATE vehicles SET assigned_driver_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE assigned_driver_id = ?', [driverId]);
            if (driver.vehicle_id) {
                await tx.run('UPDATE vehicles SET assigned_driver_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [driver.vehicle_id]);
            }

            logAuditEvent({
                userId,
                role: 'DISPATCHER',
                action: 'UPDATE',
                resource: 'DRIVER_VEHICLE',
                resourceId: driverId,
                branchId: driver.branch_id,
                previousValue: { vehicle_id: driver.vehicle_id },
                newValue: { vehicle_id: null },
                reason: 'Driver unassigned from vehicle'
            });
        });

        return await getDriverById(driverId);
    }

    const vehicle = await dbAdapter.get('SELECT id, branch_id, registration_number, is_active FROM vehicles WHERE id = ?', [vehicleId]);
    if (!vehicle) {
        const err = new Error(`Vehicle with ID ${vehicleId} does not exist`);
        err.statusCode = 404;
        throw err;
    }

    await dbAdapter.withTransaction(async (tx) => {
        // 1. If another driver currently has this vehicle, unassign them first
        await tx.run('UPDATE drivers SET vehicle_id = NULL WHERE vehicle_id = ? AND id != ?', [vehicleId, driverId]);

        // 2. If this driver previously had another vehicle, unassign that vehicle
        if (driver.vehicle_id && driver.vehicle_id !== vehicleId) {
            await tx.run('UPDATE vehicles SET assigned_driver_id = NULL WHERE id = ?', [driver.vehicle_id]);
        }
        await tx.run('UPDATE vehicles SET assigned_driver_id = NULL WHERE assigned_driver_id = ? AND id != ?', [driverId, vehicleId]);

        // 3. Assign vehicle to driver
        await tx.run('UPDATE drivers SET vehicle_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [vehicleId, driverId]);

        // 4. Assign driver to vehicle
        await tx.run('UPDATE vehicles SET assigned_driver_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [driverId, vehicleId]);

        logAuditEvent({
            userId,
            role: 'DISPATCHER',
            action: 'UPDATE',
            resource: 'DRIVER_VEHICLE',
            resourceId: driverId,
            branchId: driver.branch_id,
            previousValue: { vehicle_id: driver.vehicle_id },
            newValue: { vehicle_id: vehicleId, registration_number: vehicle.registration_number },
            reason: `Driver assigned to vehicle ${vehicle.registration_number}`
        });
    });

    return await getDriverById(driverId);
}

/**
 * Granular delivery history ledger for a driver
 */
async function getDriverDeliveryHistory(driverId, { limit = 20, page = 1, status = null } = {}) {
    await getDriverById(driverId);

    const pageNum = Math.max(1, Number(page) || 1);
    const pageLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const offset = (pageNum - 1) * pageLimit;

    let baseSql = `
        FROM deliveries del
        JOIN orders o ON del.order_id = o.id
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN proof_of_delivery pod ON del.id = pod.delivery_id
        LEFT JOIN vehicles v ON del.vehicle_id = v.id
        WHERE del.driver_id = ?
    `;
    const params = [driverId];

    if (status) {
        baseSql += ' AND del.status = ?';
        params.push(status.toUpperCase());
    }

    const countRow = await dbAdapter.get(`SELECT count(*) as total ${baseSql}`, params);
    const totalCount = countRow ? Number(countRow.total) : 0;

    const querySql = `
        SELECT 
            del.id as delivery_id,
            del.delivery_number,
            del.status as delivery_status,
            del.priority,
            del.scheduled_pickup_at,
            del.estimated_delivery_at,
            del.actual_delivery_at,
            del.failure_reason,
            del.failure_notes,
            del.created_at as assigned_at,
            o.id as order_id,
            o.order_number,
            o.delivery_address,
            o.total_amount as order_amount,
            COALESCE(c.full_name, o.recipient_name, 'Direct Customer') as customer_name,
            COALESCE(c.phone, o.recipient_phone) as customer_phone,
            pod.recipient_name,
            pod.recipient_phone,
            pod.otp_verified,
            pod.signature_data IS NOT NULL as has_signature,
            pod.photo_data IS NOT NULL as has_photo,
            pod.notes as pod_notes,
            pod.verified_at as pod_verified_at,
            v.registration_number as vehicle_reg
        ${baseSql}
        ORDER BY del.id DESC
        LIMIT ? OFFSET ?
    `;

    const deliveries = await dbAdapter.all(querySql, [...params, pageLimit, offset]);

    const enriched = deliveries.map(d => {
        let turnaroundMinutes = null;
        let isOnTime = null;

        if (d.actual_delivery_at) {
            const start = new Date(d.scheduled_pickup_at || d.assigned_at).getTime();
            const end = new Date(d.actual_delivery_at).getTime();
            if (!isNaN(start) && !isNaN(end) && end >= start) {
                turnaroundMinutes = Math.round((end - start) / (1000 * 60));
            }

            if (d.estimated_delivery_at) {
                isOnTime = new Date(d.actual_delivery_at) <= new Date(d.estimated_delivery_at);
            } else {
                isOnTime = true;
            }
        }

        return {
            ...d,
            turnaround_minutes: turnaroundMinutes,
            is_on_time: isOnTime
        };
    });

    return {
        deliveries: enriched,
        pagination: {
            page: pageNum,
            limit: pageLimit,
            total: totalCount,
            pages: Math.ceil(totalCount / pageLimit)
        }
    };
}

/**
 * Driver Performance Scorecard Telemetry
 */
async function getDriverPerformance(driverId) {
    const driver = await getDriverById(driverId);

    const stats = await dbAdapter.get(`
        SELECT 
            count(*) as total_assigned,
            sum(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as total_completed,
            sum(CASE WHEN status IN ('FAILED', 'RETURN_TO_BRANCH', 'RETURN_RECEIVED') THEN 1 ELSE 0 END) as total_failed,
            sum(CASE WHEN status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT') THEN 1 ELSE 0 END) as total_active,
            sum(CASE WHEN priority = 'URGENT' THEN 1 ELSE 0 END) as urgent_deliveries,
            sum(CASE WHEN priority = 'HIGH' THEN 1 ELSE 0 END) as high_deliveries,
            sum(CASE WHEN priority = 'NORMAL' THEN 1 ELSE 0 END) as normal_deliveries
        FROM deliveries
        WHERE driver_id = ?
    `, [driverId]) || {};

    const totalAssigned = Number(stats.total_assigned) || 0;
    const totalCompleted = Number(stats.total_completed) || 0;
    const totalFailed = Number(stats.total_failed) || 0;
    const totalActive = Number(stats.total_active) || 0;
    const finishedCount = totalCompleted + totalFailed;

    const successRate = finishedCount > 0 
        ? Math.round((totalCompleted / finishedCount) * 1000) / 10 
        : 100.0;

    const completedDeliveries = await dbAdapter.all(`
        SELECT 
            scheduled_pickup_at,
            created_at,
            estimated_delivery_at,
            actual_delivery_at
        FROM deliveries
        WHERE driver_id = ? AND status = 'DELIVERED' AND actual_delivery_at IS NOT NULL
    `, [driverId]);

    let onTimeCount = 0;
    let totalMinutes = 0;
    let validDurationCount = 0;

    for (const d of completedDeliveries) {
        if (d.estimated_delivery_at) {
            if (new Date(d.actual_delivery_at) <= new Date(d.estimated_delivery_at)) {
                onTimeCount++;
            }
        } else {
            onTimeCount++;
        }

        const start = new Date(d.scheduled_pickup_at || d.created_at).getTime();
        const end = new Date(d.actual_delivery_at).getTime();
        if (!isNaN(start) && !isNaN(end) && end >= start) {
            totalMinutes += (end - start) / (1000 * 60);
            validDurationCount++;
        }
    }

    const onTimeRate = completedDeliveries.length > 0
        ? Math.round((onTimeCount / completedDeliveries.length) * 1000) / 10
        : 100.0;

    const avgTurnaroundMinutes = validDurationCount > 0
        ? Math.round(totalMinutes / validDurationCount)
        : 35;

    const incRow = await dbAdapter.get('SELECT count(*) as count FROM driver_incident_logs WHERE driver_id = ?', [driverId]);
    const incidentCount = incRow ? Number(incRow.count) : 0;

    return {
        driver_id: driver.id,
        driver_name: driver.full_name,
        employee_code: driver.employee_code,
        current_status: driver.status,
        rating: driver.rating || 5.0,
        metrics: {
            total_assigned: totalAssigned,
            total_completed: totalCompleted,
            total_failed: totalFailed,
            total_active: totalActive,
            success_rate_pct: successRate,
            on_time_rate_pct: onTimeRate,
            avg_turnaround_minutes: avgTurnaroundMinutes,
            incident_count: incidentCount
        },
        priority_breakdown: {
            urgent: Number(stats.urgent_deliveries) || 0,
            high: Number(stats.high_deliveries) || 0,
            normal: Number(stats.normal_deliveries) || 0
        },
        compliance: driver.compliance
    };
}

/**
 * Log driver incident
 */
async function logDriverIncident(driverId, data, userId) {
    const driver = await getDriverById(driverId);
    const {
        incident_type,
        severity = 'LOW',
        incident_date = new Date().toISOString(),
        description,
        action_taken = null
    } = data;

    if (!incident_type || !description) {
        const err = new Error('incident_type and description are required');
        err.statusCode = 400;
        throw err;
    }

    if (!VALID_INCIDENT_TYPES.includes(incident_type.toUpperCase())) {
        const err = new Error(`Invalid incident_type. Allowed: ${VALID_INCIDENT_TYPES.join(', ')}`);
        err.statusCode = 400;
        throw err;
    }

    if (!VALID_SEVERITIES.includes(severity.toUpperCase())) {
        const err = new Error(`Invalid severity. Allowed: ${VALID_SEVERITIES.join(', ')}`);
        err.statusCode = 400;
        throw err;
    }

    return await dbAdapter.withTransaction(async (tx) => {
        const result = await tx.run(`
            INSERT INTO driver_incident_logs (
                driver_id, incident_type, severity, incident_date, description, action_taken, logged_by_user_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
            driverId,
            incident_type.toUpperCase(),
            severity.toUpperCase(),
            incident_date,
            description,
            action_taken,
            userId
        ]);

        const incidentId = Number(result.insertId);

        if (['HIGH', 'CRITICAL'].includes(severity.toUpperCase())) {
            const newRating = Math.max(1.0, (Number(driver.rating) || 5.0) - (severity.toUpperCase() === 'CRITICAL' ? 0.5 : 0.2));
            await tx.run('UPDATE drivers SET rating = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newRating, driverId]);
        }

        logAuditEvent({
            userId,
            role: 'DISPATCHER',
            action: 'CREATE',
            resource: 'DRIVER_INCIDENT',
            resourceId: incidentId,
            branchId: driver.branch_id,
            newValue: { driver_id: driverId, incident_type, severity, description },
            reason: `Safety incident logged: ${incident_type} (${severity})`
        });

        return await tx.get(`
            SELECT il.*, u.full_name as logged_by_name
            FROM driver_incident_logs il
            JOIN users u ON il.logged_by_user_id = u.id
            WHERE il.id = ?
        `, [incidentId]);
    });
}

/**
 * Get incident logs for driver
 */
async function getDriverIncidents(driverId) {
    await getDriverById(driverId);
    return await dbAdapter.all(`
        SELECT il.*, u.full_name as logged_by_name
        FROM driver_incident_logs il
        JOIN users u ON il.logged_by_user_id = u.id
        WHERE il.driver_id = ?
        ORDER BY il.id DESC
    `, [driverId]);
}

/**
 * Get driver status transition history
 */
async function getDriverStatusHistory(driverId) {
    await getDriverById(driverId);
    return await dbAdapter.all(`
        SELECT sh.*, u.full_name as changed_by_name
        FROM driver_status_history sh
        LEFT JOIN users u ON sh.changed_by_user_id = u.id
        WHERE sh.driver_id = ?
        ORDER BY sh.id DESC
    `, [driverId]);
}

/**
 * Fleet telemetry aggregate metrics for fleet header
 */
async function getFleetTelemetry(branchId = null) {
    let whereClause = 'WHERE 1=1';
    const params = [];
    if (branchId) {
        whereClause += ' AND branch_id = ?';
        params.push(branchId);
    }

    const counts = await dbAdapter.get(`
        SELECT 
            count(*) as total_drivers,
            sum(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) as available_drivers,
            sum(CASE WHEN status = 'ON_DELIVERY' THEN 1 ELSE 0 END) as on_delivery_drivers,
            sum(CASE WHEN status IN ('OFF_DUTY', 'ON_LEAVE') THEN 1 ELSE 0 END) as off_duty_drivers,
            sum(CASE WHEN status = 'SUSPENDED' THEN 1 ELSE 0 END) as suspended_drivers,
            avg(rating) as avg_rating
        FROM drivers
        ${whereClause}
    `, params) || {};

    const drivers = await dbAdapter.all(`SELECT license_expiry_date, ntsa_verified FROM drivers ${whereClause}`, params);
    let expiringSoon = 0;
    let expired = 0;
    let valid = 0;

    for (const d of drivers) {
        const c = calculateCompliance(d.license_expiry_date, d.ntsa_verified);
        if (c.status === 'EXPIRED') expired++;
        else if (c.status === 'EXPIRING_SOON') expiringSoon++;
        else if (c.status === 'VALID') valid++;
    }

    let delWhere = "WHERE status = 'DELIVERED' AND actual_delivery_at IS NOT NULL";
    const delParams = [];
    if (branchId) {
        delWhere += ' AND branch_id = ?';
        delParams.push(branchId);
    }

    const completed = await dbAdapter.all(`
        SELECT estimated_delivery_at, actual_delivery_at
        FROM deliveries
        ${delWhere}
    `, delParams);

    let onTime = 0;
    for (const c of completed) {
        if (c.estimated_delivery_at) {
            if (new Date(c.actual_delivery_at) <= new Date(c.estimated_delivery_at)) {
                onTime++;
            }
        } else {
            onTime++;
        }
    }

    const fleetOnTimeRate = completed.length > 0 
        ? Math.round((onTime / completed.length) * 1000) / 10 
        : 96.5;

    return {
        total_drivers: Number(counts.total_drivers) || 0,
        available_drivers: Number(counts.available_drivers) || 0,
        on_delivery_drivers: Number(counts.on_delivery_drivers) || 0,
        off_duty_drivers: Number(counts.off_duty_drivers) || 0,
        suspended_drivers: Number(counts.suspended_drivers) || 0,
        expiring_licenses_count: expiringSoon,
        expired_licenses_count: expired,
        valid_licenses_count: valid,
        fleet_on_time_rate_pct: fleetOnTimeRate,
        fleet_avg_rating: counts.avg_rating ? Math.round(Number(counts.avg_rating) * 10) / 10 : 5.0
    };
}

module.exports = {
    listDrivers,
    getDriverById,
    createDriver,
    updateDriver,
    updateDriverStatus,
    assignDriverBranch,
    assignDriverVehicle,
    getDriverDeliveryHistory,
    getDriverPerformance,
    logDriverIncident,
    getDriverIncidents,
    getDriverStatusHistory,
    getFleetTelemetry,
    calculateCompliance,
    VALID_STATUSES,
    VALID_INCIDENT_TYPES,
    VALID_SEVERITIES,
    VALID_EMPLOYMENT_TYPES
};
