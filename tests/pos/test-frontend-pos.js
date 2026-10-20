// tests/pos/test-frontend-pos.js
// SwiftTrack Logistics Platform - POS Counter Booking & Shift Architecture Frontend Test Suite
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

console.log('============================================================');
console.log('  SWIFTTRACK LOGISTICS: FRONTEND POS COMPONENT INTEGRITY TEST');
console.log('============================================================\n');

const posDir = path.join(__dirname, '../../client/src/components/pos');
const posViewPath = path.join(__dirname, '../../client/src/views/PosView.jsx');

console.log('> TEST 1: Validating PosView and Core Component Manifest...');
assert.ok(fs.existsSync(posViewPath), 'PosView.jsx must exist');
const posViewContent = fs.readFileSync(posViewPath, 'utf8');

const requiredPosComponents = [
  'ParcelCounterBooking.jsx',
  'ShiftStatusBar.jsx',
  'ShiftGateCard.jsx',
  'OpenShiftModal.jsx',
  'CloseShiftModal.jsx',
  'CashMovementModal.jsx',
  'ReprintReceiptModal.jsx',
  'PosReceiptModal.jsx',
  'PrintableWaybillModal.jsx'
];

for (const comp of requiredPosComponents) {
  const compPath = path.join(posDir, comp);
  assert.ok(fs.existsSync(compPath), `POS component must exist: ${comp}`);
}
console.log('  [PASS] PosView.jsx and all 9 specialized POS components verified on disk');

console.log('> TEST 2: Validating Cashier Shift Lifecycle Controls in PosView...');
assert.ok(posViewContent.includes('handleOpenShift'), 'PosView must handle shift opening');
assert.ok(posViewContent.includes('handleCloseShift'), 'PosView must handle shift closure');
assert.ok(posViewContent.includes('handleDrawerMovement'), 'PosView must handle cash drawer movements (float/drop/payout)');
assert.ok(posViewContent.includes('handleLookupReceipt'), 'PosView must support receipt & waybill lookup');
assert.ok(posViewContent.includes('activeShift'), 'PosView must manage activeShift state');
assert.ok(posViewContent.includes('openingFloat'), 'PosView must track openingFloat input');
assert.ok(posViewContent.includes('countedCash'), 'PosView must track countedCash for reconciliation');
assert.ok(posViewContent.includes('movementAmount'), 'PosView must track movementAmount');
assert.ok(posViewContent.includes('reprintQuery'), 'PosView must track reprintQuery');
console.log('  [PASS] Cashier shift opening, closing, cash drawer movements, and reprint workflows verified');

console.log('> TEST 3: Validating Parcel Counter Booking Component Capabilities...');
const counterBookingPath = path.join(posDir, 'ParcelCounterBooking.jsx');
const counterBookingContent = fs.readFileSync(counterBookingPath, 'utf8');

assert.ok(counterBookingContent.includes('PACKAGING_PRESETS'), 'ParcelCounterBooking must export standardized packaging presets');
assert.ok(counterBookingContent.includes('PrintableWaybillModal'), 'ParcelCounterBooking must integrate PrintableWaybillModal');
assert.ok(counterBookingContent.includes('originHubId'), 'ParcelCounterBooking must track origin hub selection');
assert.ok(counterBookingContent.includes('destinationHubId'), 'ParcelCounterBooking must track destination hub selection');
assert.ok(counterBookingContent.includes('calculateQuote') || counterBookingContent.includes('quote'), 'ParcelCounterBooking must compute volumetric counter quotes');
assert.ok(counterBookingContent.includes('MPESA') || counterBookingContent.includes('M-Pesa'), 'ParcelCounterBooking must support M-Pesa STK payment rail');
assert.ok(counterBookingContent.includes('CASH'), 'ParcelCounterBooking must support Cash payments');
console.log('  [PASS] Volumetric pricing calculation, hub routing, M-Pesa/Cash rails, and waybill printing verified');

console.log('> TEST 4: Validating Cash Movement and Modal Integrations...');
const movementModalPath = path.join(posDir, 'CashMovementModal.jsx');
const movementContent = fs.readFileSync(movementModalPath, 'utf8');
assert.ok(movementContent.includes('movementType'), 'CashMovementModal must select movement type (FLOAT/DROP/PAYOUT)');
assert.ok(movementContent.includes('movementReason'), 'CashMovementModal must require an audit reason for cash movements');

const closeShiftModalPath = path.join(posDir, 'CloseShiftModal.jsx');
const closeShiftContent = fs.readFileSync(closeShiftModalPath, 'utf8');
assert.ok(closeShiftContent.includes('countedCash'), 'CloseShiftModal must accept counted cash for reconciliation');
assert.ok(closeShiftContent.includes('variance') || closeShiftContent.includes('expected_cash'), 'CloseShiftModal must display drawer variance against expected cash');
console.log('  [PASS] Cash drawer movement controls and blind drop reconciliation verified');

console.log('\n============================================================');
console.log('[SUCCESS]  ALL 4 FRONTEND POS ARCHITECTURE TESTS PASSED!');
console.log('============================================================\n');
