// server/repositories/index.js
// Enterprise Logistics Domain Repositories Registry

const shipmentRepository = require('./shipmentRepository.js');
const transportRepository = require('./transportRepository.js');
const custodyRepository = require('./custodyRepository.js');
const deliveryRepository = require('./deliveryRepository.js');
const codRepository = require('./codRepository.js');
const vehicleRepository = require('./vehicleRepository.js');
const driverRepository = require('./driverRepository.js');
const hubRepository = require('./hubRepository.js');
const notificationRepository = require('./notificationRepository.js');
const auditRepository = require('./auditRepository.js');

module.exports = {
    shipmentRepository,
    transportRepository,
    custodyRepository,
    deliveryRepository,
    codRepository,
    vehicleRepository,
    driverRepository,
    hubRepository,
    notificationRepository,
    auditRepository
};
