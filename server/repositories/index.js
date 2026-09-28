// server/repositories/index.js
// Enterprise Logistics Domain Repositories Registry

const shipmentRepository = require('./shipmentRepository.js');
const transportRepository = require('./transportRepository.js');
const custodyRepository = require('./custodyRepository.js');
const deliveryRepository = require('./deliveryRepository.js');
const codRepository = require('./codRepository.js');

module.exports = {
    shipmentRepository,
    transportRepository,
    custodyRepository,
    deliveryRepository,
    codRepository
};
