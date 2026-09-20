// server/routes/inventory/index.js
// SwiftTrack Kenya: Master Inventory Sub-System Router
const express = require('express');
const router = express.Router();

const matrixRouter = require('./matrix.js');
const statesRouter = require('./states.js');
const receivingRouter = require('./receiving.js');
const reservationsRouter = require('./reservations.js');
const transfersRouter = require('./transfers.js');
const stocktakesRouter = require('./stocktakes.js');
const writeoffsRouter = require('./writeoffs.js');
const adjustmentsRouter = require('./adjustments.js');
const advancedRouter = require('./advanced.js');

// Mount sub-routers in order of specificity
router.use(statesRouter);
router.use(advancedRouter);
router.use(receivingRouter);
router.use(reservationsRouter);
router.use(transfersRouter);
router.use(stocktakesRouter);
router.use(writeoffsRouter);
router.use(adjustmentsRouter);
router.use(matrixRouter);

module.exports = router;
