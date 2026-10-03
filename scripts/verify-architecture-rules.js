// scripts/verify-architecture-rules.js
// SwiftTrack Architectural Enforcement Scanner (Section 45 Mandate)
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SERVER_DIR = path.join(ROOT_DIR, 'server');

const VIOLATIONS = [];

// Prohibited imports in routes and services
const DIRECT_DB_IMPORT_REGEX = /require\s*\(\s*['"](\.\.\/)*db\/database(\.js)?['"]\s*\)/;
const DIRECT_SQLITE_MODULE_REGEX = /require\s*\(\s*['"]better-sqlite3['"]\s*\)/;
const DIRECT_DB_PREPARE_REGEX = /\bdb\.prepare\s*\(/;

function scanFile(filePath) {
    const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    const isRoute = relPath.startsWith('server/routes/');
    const isService = relPath.startsWith('server/services/');
    const isMiddleware = relPath.startsWith('server/middleware/');
    const isServerEntry = relPath === 'server/server.js';
    const isRepository = relPath.startsWith('server/repositories/');

    lines.forEach((line, index) => {
        const lineNum = index + 1;

        // Rule 1: Routes, services, middleware, and server.js must NOT import db/database.js directly
        if ((isRoute || isService || isMiddleware || isServerEntry) && DIRECT_DB_IMPORT_REGEX.test(line)) {
            VIOLATIONS.push({
                file: relPath,
                line: lineNum,
                rule: 'NO_DIRECT_DB_IMPORT',
                message: 'Routes, services, and middleware must not import database.js directly. Use repositories or dbAdapter.'
            });
        }

        // Rule 2: No direct better-sqlite3 import outside server/db/database.js
        if (relPath !== 'server/db/database.js' && DIRECT_SQLITE_MODULE_REGEX.test(line)) {
            VIOLATIONS.push({
                file: relPath,
                line: lineNum,
                rule: 'NO_SQLITE_DRIVER_IMPORT',
                message: 'better-sqlite3 is prohibited outside the isolated server/db/database.js adapter.'
            });
        }

        // Rule 3: No direct db.prepare() outside server/db/ or legacy test/seed scripts
        if ((isRoute || isService) && DIRECT_DB_PREPARE_REGEX.test(line)) {
            VIOLATIONS.push({
                file: relPath,
                line: lineNum,
                rule: 'NO_DIRECT_DB_PREPARE',
                message: 'db.prepare() is forbidden in domain services and routes. Delegate persistence to repositories.'
            });
        }
    });
}

function traverseDirectory(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && entry.name !== '.git') {
                traverseDirectory(fullPath);
            }
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            scanFile(fullPath);
        }
    }
}

console.log('============================================================');
console.log('   SWIFTTRACK ARCHITECTURAL CONVERGENCE & RULE SCANNER');
console.log('============================================================\n');

traverseDirectory(SERVER_DIR);

if (VIOLATIONS.length === 0) {
    console.log('✅ ALL ARCHITECTURAL RULES SATISFIED: Zero unauthorized database layer bypasses found.\n');
    process.exit(0);
} else {
    console.log(`❌ ARCHITECTURAL VIOLATIONS DETECTED: ${VIOLATIONS.length} violations found across server files.\n`);
    
    // Group violations by rule
    const grouped = {};
    for (const v of VIOLATIONS) {
        grouped[v.rule] = grouped[v.rule] || [];
        grouped[v.rule].push(v);
    }

    for (const [rule, items] of Object.entries(grouped)) {
        console.log(`Rule [${rule}] (${items.length} violations):`);
        items.slice(0, 15).forEach(item => {
            console.log(`  - ${item.file}:${item.line}`);
        });
        if (items.length > 15) {
            console.log(`  ... and ${items.length - 15} more`);
        }
        console.log('');
    }

    console.log('Run remediation phases to eliminate all violations.\n');
    process.exit(1);
}
