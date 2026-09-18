// server/db/database.js
// High-performance SQLite database connection using Node 24 native node:sqlite
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = path.resolve(__dirname, '../../data/logistics_platform.db');
const DB_DIR = path.dirname(DB_PATH);

if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

// Enable Foreign Key constraints and WAL mode for high concurrency & integrity
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');

// Helper method for executing transactions
db.transaction = (fn) => {
    return (...args) => {
        db.exec('BEGIN IMMEDIATE;');
        try {
            const result = fn(...args);
            db.exec('COMMIT;');
            return result;
        } catch (error) {
            try {
                db.exec('ROLLBACK;');
            } catch (rbError) {
                // Ignore rollback failure if already rolled back
            }
            throw error;
        }
    };
};

// Safely add missing columns to existing tables during schema evolution
function migrateAuthSchema() {
    try {
        const userCols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);

        const newCols = [
            { name: 'password_changed_at', def: 'DATETIME' },
            { name: 'must_change_password', def: 'INTEGER NOT NULL DEFAULT 0' },
            { name: 'failed_login_attempts', def: 'INTEGER NOT NULL DEFAULT 0' },
            { name: 'locked_until', def: 'DATETIME' },
            { name: 'token_version', def: 'INTEGER NOT NULL DEFAULT 1' },
            { name: 'two_factor_enabled', def: 'INTEGER NOT NULL DEFAULT 0' },
            { name: 'two_factor_secret', def: 'TEXT' },
            { name: 'two_factor_recovery_codes', def: 'TEXT' }
        ];

        for (const col of newCols) {
            if (!userCols.includes(col.name)) {
                db.exec(`ALTER TABLE users ADD COLUMN ${col.name} ${col.def};`);
            }
        }
    } catch (err) {
        console.warn('Auth schema migration notice:', err.message);
    }
}

// Initialize schema
function initSchema() {
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
    migrateAuthSchema();
}

module.exports = {
    db,
    initSchema,
    DB_PATH
};
