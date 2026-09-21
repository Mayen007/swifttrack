// tests/pos/test-frontend-pos.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('Validating client frontend POS files...');

const posViewPath = path.join(__dirname, '../../client/src/views/PosView.jsx');
const cartContextPath = path.join(__dirname, '../../client/src/context/CartContext.jsx');

assert.ok(fs.existsSync(posViewPath), 'PosView.jsx exists');
assert.ok(fs.existsSync(cartContextPath), 'CartContext.jsx exists');

const posViewContent = fs.readFileSync(posViewPath, 'utf8');
const cartContextContent = fs.readFileSync(cartContextPath, 'utf8');

// Check critical exports and features in CartContext
assert.ok(cartContextContent.includes('discardHeldCart'), 'CartContext includes discardHeldCart');
assert.ok(cartContextContent.includes('recallCart'), 'CartContext includes recallCart');
assert.ok(cartContextContent.includes('heldCarts'), 'CartContext includes heldCarts');

// Check critical features in PosView
assert.ok(posViewContent.includes('handleOpenShift'), 'PosView includes handleOpenShift');
assert.ok(posViewContent.includes('handleCloseShift'), 'PosView includes handleCloseShift');
assert.ok(posViewContent.includes('handleDrawerMovement'), 'PosView includes handleDrawerMovement');
assert.ok(posViewContent.includes('handleCompleteSale'), 'PosView includes handleCompleteSale');
assert.ok(posViewContent.includes('handleLookupReceipt'), 'PosView includes handleLookupReceipt');
assert.ok(posViewContent.includes('handleExchangeSubmit'), 'PosView includes handleExchangeSubmit');
assert.ok(posViewContent.includes('cashVariance'), 'PosView includes cashVariance computation');
assert.ok(posViewContent.includes('splitModalOpen'), 'PosView includes splitModalOpen');
assert.ok(posViewContent.includes('reprintModalOpen'), 'PosView includes reprintModalOpen');
assert.ok(posViewContent.includes('exchangeModalOpen'), 'PosView includes exchangeModalOpen');
assert.ok(posViewContent.includes('activeShift'), 'PosView includes activeShift management');

console.log('✓ All client POS frontend component assertions passed successfully!');
