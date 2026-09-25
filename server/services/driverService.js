// server/services/driverService.js
// SwiftTrack Kenya: Logistics & Fleet Management — Driver Management Service (Phase 9.1)
const { db } = require('../db/database.js');
const { logAuditEvent } = require('../middleware/audit.js');
const { hashPassword } = require('../utils/security.js');

const VALID_STATUSES = ['AVAILABLE', 'ON_DELIVERY', 'OFF_DUTY', 'ON_LEAVE', 'SUSPENDED'];
const VALID_INCIDENT_TYPES = ['ACCIDENT', 'TRAFFIC_VIOLATION', 'CUSTOMER_COMPLAINT', 'VEHICLE_BREAKDOWN', 'DELAY'];
const VALID_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const VALID_EMPLOYMENT_TYPES = ['FULL_TIME', 'CONTRACTOR', 'CASUAL'];

/**
 * Generate sequential unique employee code: DRV-0001, DRV-0002...
 */
function generateEmployeeCode() {
    let nextNum = 1;
    const maxRow = db.prepare(`
        SELECT employee_code 
        FROM drivers 
        WHERE employee_code LIKE 'DRV-%' 
        ORDER BY id DESC 
        LIMIT 1
    `).get();

    if (maxRow && maxRow.employee_code) {
        const parts = maxRow.employee_code.split('-');
        if (parts[1] && !isNaN(Number(parts[1]))) {
            nextNum = Number(parts[1]) + 1;
        }
    }

    let code = `DRV-${String(nextNum).padStart(4, '0')}`;
    let exists = db.prepare('SELECT id FROM drivers WHERE employee_code = ?').get(code);
    while (exists) {
        nextNum++;
        code = `DRV-${String(nextNum).padStart(4, '0')}`;
        exists = db.prepare('SELECT id FROM drivers WHERE employee_code = ?').get(code);
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
function listDrivers({ branchId, status, search, complianceStatus, page = 1, limit = 50 }) {
    const pageNum = Math.max(1, Number(page) || 1);
    const pageLimit = Math.max(1, Math.min(100, Number(limit) || 50));
    const offset = (pageNum - 1) * pageLimit;

    let baseSql = `
        FROM drivers d
        JOIN users u ON d.user_id = u.id
        JOIN branches b ON d.branch_id = b.id
        LEFT JOIN vehicles v ON d.vehicle_id = v.id
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
    const totalCount = db.prepare(countSql).get(...params).total;

    const dataSql = `
        SELECT 
            d.*,
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

    const rawDrivers = db.prepare(dataSql).all(...params, pageLimit, offset);

    const drivers = rawDrivers.map(drv => {
        const comp = calculateCompliance(drv.license_expiry_date, drv.ntsa_verified);
        return {
            ...drv,
            compliance: comp
        };
    });

    // If complianceStatus filter requested ('VALID', 'EXPIRING_SOON', 'EXPIRED', 'UNVERIFIED')
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
function getDriverById(id) {
    const driver = db.prepare(`
        SELECT 
            d.*,
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
        LEFT JOIN vehicles v ON d.vehicle_id = v.id
        WHERE d.id = ?
    `).get(id);

    if (!driver) {
        const err = new Error('Driver not found');
        err.statusCode = 404;
        throw err;
    }

    driver.compliance = calculateCompliance(driver.license_expiry_date, driver.ntsa_verified);
    return driver;
}

/**
 * Create a new driver profile with optional staff user account provisioning
 */
function createDriver(data, creatorUserId = null) {
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
        city = 'Nairobi',
        emergency_contact_name,
        emergency_contact_phone,
        emergency_contact_relation,
        vehicle_id = null,
        notes = null,
        user_id = null, // Can link existing user or auto-provision
        username = null,
        password = null
    } = data;

    if (!full_name || !phone || !branch_id || !license_number) {
        const err = new Error('Missing required fields: full_name, phone, branch_id, and license_number are required');
        err.statusCode = 400;
        throw err;
    }

    // Verify branch exists
    const branch = db.prepare('SELECT id, name FROM branches WHERE id = ?').get(branch_id);
    if (!branch) {
        const err = new Error(`Branch with ID ${branch_id} does not exist`);
        err.statusCode = 400;
        throw err;
    }

    // Verify vehicle if provided
    if (vehicle_id) {
        const vehicle = db.prepare('SELECT id, branch_id, is_active FROM vehicles WHERE id = ?').get(vehicle_id);
        if (!vehicle) {
            const err = new Error(`Vehicle with ID ${vehicle_id} does not exist`);
            err.statusCode = 400;
            throw err;
        }
    }

    let linkedUserId = user_id;

    // Use transaction for atomic user + driver creation
    const createdDriver = db.transaction(() => {
        // 1. Provision user if not provided
        if (!linkedUserId) {
            const genUsername = username || `driver.${full_name.toLowerCase().replace(/[^a-z0-9]/g, '')}.${Math.floor(100 + Math.random() * 900)}`;
            const genEmail = email || `${genUsername}@swifttrack.co.ke`;
            const rawPassword = password || 'Driver@SwiftTrack2026!';
            const passHash = hashPassword(rawPassword);

            // Check if username/email already taken
            const existingUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(genUsername, genEmail);
            if (existingUser) {
                linkedUserId = existingUser.id;
            } else {
                const userInsert = db.prepare(`
                    INSERT INTO users (
                        branch_id, role_id, username, email, full_name, phone, password_hash, is_active, created_at, updated_at
                    ) VALUES (?, 5, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                `).run(branch_id, genUsername, genEmail, full_name, phone, passHash);
                linkedUserId = Number(userInsert.lastInsertRowid);
            }
        } else {
            // Verify existing user exists and is not already a driver
            const existingDriverUser = db.prepare('SELECT id FROM drivers WHERE user_id = ?').get(linkedUserId);
            if (existingDriverUser) {
                const err = new Error(`User ID ${linkedUserId} is already assigned to driver #${existingDriverUser.id}`);
                err.statusCode = 400;
                throw err;
            }
        }

        // 2. Generate unique employee code
        const employeeCode = data.employee_code || generateEmployeeCode();

        // 3. Insert driver
        const insertStmt = db.prepare(`
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
        `);

        const result = insertStmt.run(
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
            city || 'Nairobi',
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
            vehicle_id || null,
            notes || null
        );

        const driverId = Number(result.lastInsertRowid);

        // 4. Log initial status
        db.prepare(`
            INSERT INTO driver_status_history (
                driver_id, from_status, to_status, reason, changed_by_user_id, created_at
            ) VALUES (?, NULL, 'AVAILABLE', 'Driver created and activated', ?, CURRENT_TIMESTAMP)
        `).run(driverId, creatorUserId || null);

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

        return getDriverById(driverId);
    })();

    return createdDriver;
}

/**
 * Update driver profile
 */
function updateDriver(id, data, updaterUserId = null) {
    const existing = getDriverById(id);

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

    db.transaction(() => {
        db.prepare(`
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
        `).run(
            phone,
            alt_phone,
            email,
            employment_type,
            hire_date,
            avatar_url,
            blood_group,
            residential_address,
            city,
            emergency_contact_name,
            emergency_contact_phone,
            emergency_contact_relation,
            national_id,
            kra_pin,
            nssf_number,
            nhif_number,
            license_number,
            license_classes,
            license_issue_date,
            license_expiry_date,
            ntsa_verified,
            ntsa_verification_date,
            rating,
            notes,
            id
        );

        // Keep linked user record in sync
        db.prepare(`
            UPDATE users
            SET full_name = ?, phone = ?, email = COALESCE(?, email), updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(full_name, phone, email, existing.user_id);

        logAuditEvent({
            userId: updaterUserId,
            role: 'DISPATCHER',
            action: 'UPDATE',
            resource: 'DRIVER',
            resourceId: id,
            branchId: existing.branch_id,
            previousValue: { license_number: existing.license_number, phone: existing.phone },
            newValue: { license_number, phone, national_id, kra_pin },
            reason: 'Driver profile updated'
        });
    })();

    return getDriverById(id);
}

/**
 * Transition driver operational status with transition history logging
 */
function updateDriverStatus(driverId, newStatus, reason = null, userId = null) {
    const driver = getDriverById(driverId);
    const upperStatus = newStatus.toUpperCase();

    if (!VALID_STATUSES.includes(upperStatus)) {
        const err = new Error(`Invalid status '${newStatus}'. Allowed: ${VALID_STATUSES.join(', ')}`);
        err.statusCode = 400;
        throw err;
    }

    if (driver.status === upperStatus) {
        return driver; // No-op if already in target status
    }

    // Safety guard: if going to OFF_DUTY or ON_LEAVE or SUSPENDED while ON_DELIVERY with active jobs
    if (['OFF_DUTY', 'ON_LEAVE', 'SUSPENDED'].includes(upperStatus) && driver.active_deliveries_count > 0) {
        // Can still force if explicit reason provided, else reject to protect shipments
        if (!reason) {
            const err = new Error(`Cannot transition driver to ${upperStatus} while they have ${driver.active_deliveries_count} active deliveries. Provide an explicit override reason.`);
            err.statusCode = 400;
            throw err;
        }
    }

    db.transaction(() => {
        db.prepare(`
            UPDATE drivers
            SET status = ?,
                status_reason = ?,
                status_updated_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(upperStatus, reason || null, driverId);

        db.prepare(`
            INSERT INTO driver_status_history (
                driver_id, from_status, to_status, reason, changed_by_user_id, created_at
            ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(driverId, driver.status, upperStatus, reason || null, userId || null);

        logAuditEvent({
            userId,
            role: 'DISPATCHER',
            action: 'UPDATE',
            resource: 'DRIVER_STATUS',
            resourceId: driverId,
            branchId: driver.branch_id,
            previousValue: { status: driver.status },
            newValue: { status: upperStatus, reason },
            reason: `Driver status changed from ${driver.status} to ${upperStatus}`
        });
    })();

    return getDriverById(driverId);
}

/**
 * Assign / reassign driver to a branch depot
 */
function assignDriverBranch(driverId, newBranchId, userId = null) {
    const driver = getDriverById(driverId);

    const branch = db.prepare('SELECT id, name FROM branches WHERE id = ?').get(newBranchId);
    if (!branch) {
        const err = new Error(`Target branch ID ${newBranchId} does not exist`);
        err.statusCode = 400;
        throw err;
    }

    if (driver.branch_id === newBranchId) {
        return driver;
    }

    db.transaction(() => {
        // If driver has a vehicle assigned, check if vehicle belongs to the old branch
        if (driver.vehicle_id) {
            const veh = db.prepare('SELECT branch_id FROM vehicles WHERE id = ?').get(driver.vehicle_id);
            if (veh && veh.branch_id !== newBranchId) {
                // Unassign vehicle on cross-branch transfer
                db.prepare('UPDATE drivers SET vehicle_id = NULL WHERE id = ?').run(driverId);
            }
        }

        db.prepare(`
            UPDATE drivers
            SET branch_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(newBranchId, driverId);

        // Sync linked user record branch
        db.prepare(`
            UPDATE users
            SET branch_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(newBranchId, driver.user_id);

        logAuditEvent({
            userId,
            role: 'SUPER_ADMIN',
            action: 'UPDATE',
            resource: 'DRIVER_BRANCH',
            resourceId: driverId,
            branchId: newBranchId,
            previousValue: { branch_id: driver.branch_id },
            newValue: { branch_id: newBranchId },
            reason: `Driver transferred to branch ${branch.name}`
        });
    })();

    return getDriverById(driverId);
}

/**
 * Assign or unassign fleet vehicle to driver
 */
function assignDriverVehicle(driverId, vehicleId, userId = null) {
    const driver = getDriverById(driverId);

    if (!vehicleId) {
        // Unassign
        db.prepare('UPDATE drivers SET vehicle_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(driverId);
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
        return getDriverById(driverId);
    }

    const vehicle = db.prepare('SELECT id, branch_id, registration_number, is_active FROM vehicles WHERE id = ?').get(vehicleId);
    if (!vehicle) {
        const err = new Error(`Vehicle with ID ${vehicleId} does not exist`);
        err.statusCode = 404;
        throw err;
    }

    db.transaction(() => {
        // If another driver currently has this vehicle, unassign them first
        db.prepare('UPDATE drivers SET vehicle_id = NULL WHERE vehicle_id = ? AND id != ?').run(vehicleId, driverId);

        db.prepare(`
            UPDATE drivers
            SET vehicle_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(vehicleId, driverId);

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
    })();

    return getDriverById(driverId);
}

/**
 * Granular delivery history ledger for a driver
 */
function getDriverDeliveryHistory(driverId, { limit = 20, page = 1, status = null } = {}) {
    // Verify driver exists
    const driver = getDriverById(driverId);

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

    const totalCount = db.prepare(`SELECT count(*) as total ${baseSql}`).get(...params).total;

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

    const deliveries = db.prepare(querySql).all(...params, pageLimit, offset);

    // Calculate delivery turnaround duration & on-time flag
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
function getDriverPerformance(driverId) {
    const driver = getDriverById(driverId);

    // Delivery stats
    const stats = db.prepare(`
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
    `).get(driverId);

    const totalAssigned = stats.total_assigned || 0;
    const totalCompleted = stats.total_completed || 0;
    const totalFailed = stats.total_failed || 0;
    const totalActive = stats.total_active || 0;
    const finishedCount = totalCompleted + totalFailed;

    // Success Rate %
    const successRate = finishedCount > 0 
        ? Math.round((totalCompleted / finishedCount) * 1000) / 10 
        : 100.0;

    // On-Time Delivery Rate & Average Turnaround
    const completedDeliveries = db.prepare(`
        SELECT 
            scheduled_pickup_at,
            created_at,
            estimated_delivery_at,
            actual_delivery_at
        FROM deliveries
        WHERE driver_id = ? AND status = 'DELIVERED' AND actual_delivery_at IS NOT NULL
    `).all(driverId);

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
        : 35; // Default fleet target benchmark

    // Safety incident count
    const incidentCount = db.prepare('SELECT count(*) as count FROM driver_incident_logs WHERE driver_id = ?').get(driverId).count;

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
            urgent: stats.urgent_deliveries || 0,
            high: stats.high_deliveries || 0,
            normal: stats.normal_deliveries || 0
        },
        compliance: driver.compliance
    };
}

/**
 * Log driver incident
 */
function logDriverIncident(driverId, data, userId) {
    const driver = getDriverById(driverId);
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

    const result = db.prepare(`
        INSERT INTO driver_incident_logs (
            driver_id, incident_type, severity, incident_date, description, action_taken, logged_by_user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
        driverId,
        incident_type.toUpperCase(),
        severity.toUpperCase(),
        incident_date,
        description,
        action_taken,
        userId
    );

    const incidentId = Number(result.lastInsertRowid);

    // If critical incident, adjust rating slightly and log audit
    if (['HIGH', 'CRITICAL'].includes(severity.toUpperCase())) {
        const newRating = Math.max(1.0, (driver.rating || 5.0) - (severity.toUpperCase() === 'CRITICAL' ? 0.5 : 0.2));
        db.prepare('UPDATE drivers SET rating = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newRating, driverId);
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

    return db.prepare(`
        SELECT il.*, u.full_name as logged_by_name
        FROM driver_incident_logs il
        JOIN users u ON il.logged_by_user_id = u.id
        WHERE il.id = ?
    `).get(incidentId);
}

/**
 * Get incident logs for driver
 */
function getDriverIncidents(driverId) {
    getDriverById(driverId); // verify exists
    return db.prepare(`
        SELECT il.*, u.full_name as logged_by_name
        FROM driver_incident_logs il
        JOIN users u ON il.logged_by_user_id = u.id
        WHERE il.driver_id = ?
        ORDER BY il.id DESC
    `).all(driverId);
}

/**
 * Get driver status transition history
 */
function getDriverStatusHistory(driverId) {
    getDriverById(driverId);
    return db.prepare(`
        SELECT sh.*, u.full_name as changed_by_name
        FROM driver_status_history sh
        LEFT JOIN users u ON sh.changed_by_user_id = u.id
        WHERE sh.driver_id = ?
        ORDER BY sh.id DESC
    `).all(driverId);
}

/**
 * Fleet telemetry aggregate metrics for fleet header
 */
function getFleetTelemetry(branchId = null) {
    let whereClause = 'WHERE 1=1';
    const params = [];
    if (branchId) {
        whereClause += ' AND branch_id = ?';
        params.push(branchId);
    }

    const counts = db.prepare(`
        SELECT 
            count(*) as total_drivers,
            sum(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) as available_drivers,
            sum(CASE WHEN status = 'ON_DELIVERY' THEN 1 ELSE 0 END) as on_delivery_drivers,
            sum(CASE WHEN status IN ('OFF_DUTY', 'ON_LEAVE') THEN 1 ELSE 0 END) as off_duty_drivers,
            sum(CASE WHEN status = 'SUSPENDED' THEN 1 ELSE 0 END) as suspended_drivers,
            avg(rating) as avg_rating
        FROM drivers
        ${whereClause}
    `).get(...params);

    // Compute license compliance tallies
    const drivers = db.prepare(`SELECT license_expiry_date, ntsa_verified FROM drivers ${whereClause}`).all(...params);
    let expiringSoon = 0;
    let expired = 0;
    let valid = 0;

    for (const d of drivers) {
        const c = calculateCompliance(d.license_expiry_date, d.ntsa_verified);
        if (c.status === 'EXPIRED') expired++;
        else if (c.status === 'EXPIRING_SOON') expiringSoon++;
        else if (c.status === 'VALID') valid++;
    }

    // On-time rate across completed deliveries
    let delWhere = "WHERE status = 'DELIVERED' AND actual_delivery_at IS NOT NULL";
    const delParams = [];
    if (branchId) {
        delWhere += ' AND branch_id = ?';
        delParams.push(branchId);
    }

    const completed = db.prepare(`
        SELECT estimated_delivery_at, actual_delivery_at
        FROM deliveries
        ${delWhere}
    `).all(...delParams);

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
        total_drivers: counts.total_drivers || 0,
        available_drivers: counts.available_drivers || 0,
        on_delivery_drivers: counts.on_delivery_drivers || 0,
        off_duty_drivers: counts.off_duty_drivers || 0,
        suspended_drivers: counts.suspended_drivers || 0,
        expiring_licenses_count: expiringSoon,
        expired_licenses_count: expired,
        valid_licenses_count: valid,
        fleet_on_time_rate_pct: fleetOnTimeRate,
        fleet_avg_rating: counts.avg_rating ? Math.round(counts.avg_rating * 10) / 10 : 5.0
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
