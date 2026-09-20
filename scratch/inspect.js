const { db } = require('../server/db/database.js');

console.log('--- TEST BRANCHES ---');
console.log(db.prepare("SELECT id, code, name FROM branches WHERE code LIKE 'XSS%' OR code LIKE 'CSRF%' OR code LIKE 'BEAR%'").all());

console.log('--- TEST WAREHOUSES ---');
console.log(db.prepare("SELECT id, code, name FROM warehouses WHERE code LIKE '%XSS%' OR code LIKE '%CSRF%' OR code LIKE '%BEAR%'").all());

console.log('--- TEST PRODUCTS ---');
console.log(db.prepare("SELECT id, sku, name FROM products WHERE sku LIKE '%TEST%' OR name LIKE '%TEST%'").all());

console.log('--- TEST TRANSFERS ---');
console.log(db.prepare("SELECT id, transfer_number, status FROM stock_transfers WHERE transfer_number LIKE '%TEST%'").all());

console.log('--- STOCKTAKES ---');
console.log(db.prepare("SELECT id, stocktake_number, title FROM stocktakes").all());

console.log('--- STOCK RECEIPTS ---');
console.log(db.prepare("SELECT id, receipt_number, supplier_invoice_no FROM stock_receipts").all());

console.log('--- WRITE OFFS ---');
console.log(db.prepare("SELECT id, write_off_number, reason_category FROM stock_write_offs").all());
