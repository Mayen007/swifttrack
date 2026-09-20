// server/routes/inventory/index.js
// SwiftTrack Kenya: Master Inventory Sub-System Router
const express = require('express');
const router = express.Router();

const matrixRouter = require('./matrix.js');
const statesRouter = require('./states.js');
const adjustmentsRouter = require('./adjustments.js');
const transfersRouter = require('./transfers.js');

// Mount sub-routers in order of specificity
router.use(statesRouter);
router.use(adjustmentsRouter);
router.use(transfersRouter);
router.use(matrixRouter);

module.exports = router;
