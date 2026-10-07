// server/db/dbAdapter.js
// Enterprise Unified Database Access Adapter
// Provides a consistent, promise-based query & transaction abstraction across PostgreSQL and SQLite.

require('../utils/env.js');

const isPostgres = process.env.DB_CLIENT === 'postgres' || (!!process.env.DATABASE_URL && process.env.DB_CLIENT !== 'sqlite');

let pgPool = null;
let pgTransactions = null;
let sqliteDb = null;

if (isPostgres) {
    pgPool = require('./postgres/pool.js');
    pgTransactions = require('./postgres/transactions.js');
} else {
    const sqliteModule = require('./database.js');
    sqliteDb = sqliteModule.db;
}

/**
 * Translates SQLite '?' placeholders to PostgreSQL '$1, $2, ...' placeholders,
 * safely ignoring any '?' inside single-quoted string literals.
 */
function translatePlaceholdersToPg(sql) {
    let index = 1;
    return sql.replace(/'(?:''|[^'])*'|\?/g, (match) => {
        if (match === '?') {
            return `$${index++}`;
        }
        return match;
    });
}

/**
 * Translates PostgreSQL '$1, $2, ...' placeholders to SQLite '?' placeholders,
 * safely ignoring any '$' inside single-quoted string literals.
 */
function translatePlaceholdersToSqlite(sql) {
    return sql
        .replace(/::(?:jsonb|json|text|varchar|integer|int|boolean)/gi, '')
        .replace(/'(?:''|[^'])*'|\$[0-9]+/g, (match) => {
            if (match.startsWith('$')) {
                return '?';
            }
            return match;
        });
}

/**
 * Normalizes query execution across engines.
 *
 * @param {string} text - SQL query
 * @param {Array} [params=[]] - Query parameter bindings
 * @param {Object} [client=null] - Optional transaction client (pg.Client or SQLite transaction context)
 * @returns {Promise<{ rows: Array, rowCount: number, insertId: number|null }>}
 */
async function query(text, params = [], client = null) {
    if (isPostgres) {
        let pgSql = translatePlaceholdersToPg(text);
        if (/^\s*INSERT\s+INTO\b/i.test(pgSql) && !/\bRETURNING\b/i.test(pgSql)) {
            pgSql = pgSql.trim().replace(/;+$/, '') + ' RETURNING id';
        }
        const executor = client || pgPool;
        const res = await executor.query(pgSql, params);

        let insertId = null;
        if (res.rows && res.rows.length > 0 && (res.rows[0].id !== undefined || res.rows[0].ID !== undefined)) {
            insertId = Number(res.rows[0].id || res.rows[0].ID);
        }

        return {
            rows: res.rows || [],
            rowCount: res.rowCount || 0,
            insertId
        };
    } else {
        const sqliteSql = translatePlaceholdersToSqlite(text);
        const isSelect = /^\s*(SELECT|PRAGMA|WITH)\b/i.test(sqliteSql);
        const normalizedParams = (params || []).map(p => typeof p === 'boolean' ? (p ? 1 : 0) : p);

        try {
            const stmt = sqliteDb.prepare(sqliteSql);
            if (isSelect) {
                const rows = stmt.all(...normalizedParams);
                return {
                    rows: rows || [],
                    rowCount: rows ? rows.length : 0,
                    insertId: null
                };
            } else {
                const result = stmt.run(...normalizedParams);
                return {
                    rows: [],
                    rowCount: result.changes || 0,
                    insertId: result.lastInsertRowid ? Number(result.lastInsertRowid) : null
                };
            }
        } catch (err) {
            console.error('[SQLite dbAdapter Error]', { text: sqliteSql.trim().substring(0, 100), error: err.message });
            throw err;
        }
    }
}

/**
 * Fetches a single row.
 */
async function get(text, params = [], client = null) {
    const res = await query(text, params, client);
    return res.rows[0] || null;
}

/**
 * Fetches all matching rows.
 */
async function all(text, params = [], client = null) {
    const res = await query(text, params, client);
    return res.rows;
}

/**
 * Executes a mutation (INSERT, UPDATE, DELETE).
 */
async function run(text, params = [], client = null) {
    const res = await query(text, params, client);
    return {
        rowCount: res.rowCount,
        insertId: res.insertId
    };
}

/**
 * Executes an async callback within an atomic transaction boundary.
 * Works uniformly on both PostgreSQL (client checkout, BEGIN/COMMIT/ROLLBACK)
 * and SQLite (BEGIN IMMEDIATE/COMMIT/ROLLBACK).
 *
 * @param {Function} callback - async (tx) => result
 * @returns {Promise<*>} Result of callback
 */
async function withTransaction(callback) {
    if (isPostgres) {
        return await pgTransactions.withTransaction(async (pgClient) => {
            const tx = {
                query: (sql, params) => query(sql, params, pgClient),
                get: (sql, params) => get(sql, params, pgClient),
                all: (sql, params) => all(sql, params, pgClient),
                run: (sql, params) => run(sql, params, pgClient),
                client: pgClient
            };
            return await callback(tx);
        });
    } else {
        sqliteDb.exec('BEGIN IMMEDIATE;');
        const tx = {
            query: (sql, params) => query(sql, params, null),
            get: (sql, params) => get(sql, params, null),
            all: (sql, params) => all(sql, params, null),
            run: (sql, params) => run(sql, params, null),
            client: sqliteDb
        };

        try {
            const result = await callback(tx);
            sqliteDb.exec('COMMIT;');
            return result;
        } catch (err) {
            try {
                sqliteDb.exec('ROLLBACK;');
            } catch (rbErr) {
                // Ignore if already rolled back
            }
            throw err;
        }
    }
}

async function close() {
    if (isPostgres) {
        if (pgPool && typeof pgPool.closePool === 'function') {
            await pgPool.closePool();
        }
    } else if (sqliteDb && typeof sqliteDb.close === 'function') {
        sqliteDb.close();
    }
}

module.exports = {
    engine: isPostgres ? 'postgres' : 'sqlite',
    isPostgres,
    isSqlite: !isPostgres,
    query,
    get,
    all,
    run,
    withTransaction,
    close,
    translatePlaceholdersToPg,
    translatePlaceholdersToSqlite,
    // Direct engine handles when needed
    pgPool: isPostgres ? pgPool.getPool : null,
    sqliteDb
};
