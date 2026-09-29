const fs = require('fs');
const path = require('path');
const cp = require('child_process');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(fullPath));
    } else if (file.endsWith('.js')) {
      results.push(fullPath);
    }
  });
  return results;
}

const allTests = getFiles(path.resolve(__dirname, '../tests'));
console.log('Found ' + allTests.length + ' test files.');
let pass = 0, fail = 0;
const failures = [];

for (const t of allTests) {
  const rel = path.relative(path.resolve(__dirname, '..'), t);
  try {
    cp.execSync(`node "${t}"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
    pass++;
    console.log('[PASS] ' + rel);
  } catch (err) {
    fail++;
    console.log('[FAIL] ' + rel);
    failures.push({ file: rel, error: ((err.stderr || '') + (err.stdout || '') || err.message).slice(-300) });
  }
}
console.log('\n================================');
console.log('SUMMARY: ' + pass + ' PASSED, ' + fail + ' FAILED');
console.log('================================');
if (failures.length > 0) {
  console.log('Failures:');
  failures.forEach(f => console.log(' - ' + f.file + ':\n' + f.error));
}
