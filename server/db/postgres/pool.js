// server/db/postgres/pool.js
// Enterprise PostgreSQL connection pool manager using pg (node-postgres)
const { Pool } = require('pg');

let poolInstance = null;

/**
 * Builds configuration object for pg.Pool based on environment variables.
 */
function buildPoolConfig() {
    const config = {
        max: parseInt(process.env.PGPOOL_MAX || '20', 10),
        min: parseInt(process.env.PGPOOL_MIN || '2', 10),
        idleTimeoutMillis: parseInt(process.env.PGPOOL_IDLE_TIMEOUT_MS || '30000', 10),
        connectionTimeoutMillis: parseInt(process.env.PGPOOL_CONN_TIMEOUT_MS || '5000', 10),
        allowExitOnIdle: false
    };

    if (process.env.DATABASE_URL) {
        config.connectionString = process.env.DATABASE_URL;
        // Enable SSL if specified or if connecting to standard cloud providers
        if (process.env.PGSSLMODE === 'require' || process.env.DATABASE_URL.includes('sslmode=require')) {
            config.ssl = { rejectUnauthorized: false };
        }
    } else {
        config.host = process.env.PGHOST || '127.0.0.1';
        config.port = parseInt(process.env.PGPORT || '5432', 10);
        config.database = process.env.PGDATABASE || 'swifttrack_logistics';
        config.user = process.env.PGUSER || 'postgres';
        config.password = process.env.PGPASSWORD || 'postgres';

        if (process.env.PGSSL === 'true' || process.env.PGSSLMODE === 'require') {
            config.ssl = { rejectUnauthorized: false };
        }
    }

    return config;
}

/**
 * Returns or initializes the singleton pg.Pool instance.
 */
function getPool() {
    if (!poolInstance) {
        const config = buildPoolConfig();
        poolInstance = new Pool(config);

        // Lifecycle hook: configure session parameters on new client checkout
        poolInstance.on('connect', (client) => {
            // Set 30s statement timeout to prevent runaway queries
            client.query("SET statement_timeout = '30000'").catch((err) => {
                console.warn('[PostgreSQL Pool] Warning setting statement_timeout:', err.message);
            });
        });

        // Error hook: handle idle client failures gracefully
        poolInstance.on('error', (err) => {
            console.error('[PostgreSQL Pool] Unexpected error on idle client:', err.message);
        });
    }
    return poolInstance;
}

/**
 * Shorthand helper to execute a query against the connection pool.
 */
async function query(text, params) {
    const pool = getPool();
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        if (process.env.DEBUG_SQL === 'true') {
            console.log('[PostgreSQL Query]', { text: text.trim().substring(0, 100), duration, rows: res.rowCount });
        }
        return res;
    } catch (err) {
        console.error('[PostgreSQL Query Error]', { text: text.trim().substring(0, 100), error: err.message });
        throw err;
    }
}

/**
 * Check out a dedicated client from the pool (for transactions / multi-statement ops).
 */
async function getClient() {
    const pool = getPool();
    return await pool.connect();
}

/**
 * Performs a health and telemetry check on the connection pool.
 */
async function poolHealthCheck() {
    const pool = getPool();
    const start = Date.now();
    try {
        const res = await pool.query('SELECT 1 as ok, NOW() as server_time, current_database() as database');
        const latencyMs = Date.now() - start;
        return {
            status: 'healthy',
            connected: true,
            latencyMs,
            serverTime: res.rows[0]?.server_time,
            database: res.rows[0]?.database,
            pool: {
                totalCount: pool.totalCount,
                idleCount: pool.idleCount,
                waitingCount: pool.waitingCount
            }
        };
    } catch (err) {
        return {
            status: 'unhealthy',
            connected: false,
            error: err.message,
            pool: {
                totalCount: pool.totalCount,
                idleCount: pool.idleCount,
                waitingCount: pool.waitingCount
            }
        };
    }
}

/**
 * Gracefully closes the connection pool.
 */
async function closePool() {
    if (poolInstance) {
        await poolInstance.end();
        poolInstance = null;
    }
}

module.exports = {
    getPool,
    query,
    getClient,
    poolHealthCheck,
    closePool,
    buildPoolConfig
};
