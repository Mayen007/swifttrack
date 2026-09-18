// server/db/postgres/transactions.js
// Enterprise transaction boundaries & nested savepoint coordinator for PostgreSQL
const { getClient } = require('./pool.js');

/**
 * Executes an async callback inside an atomic PostgreSQL transaction.
 * Automatically commits on success and rolls back on failure.
 *
 * @param {Function} callback - async (client) => result
 * @param {Object} [existingClient=null] - Optional already-checked-out pg.Client
 * @returns {Promise<*>} Result of the callback
 */
async function withTransaction(callback, existingClient = null) {
    const isNewClient = !existingClient;
    const client = existingClient || (await getClient());

    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        try {
            await client.query('ROLLBACK');
        } catch (rbErr) {
            console.warn('[PostgreSQL Transaction] Rollback notice:', rbErr.message);
        }
        throw err;
    } finally {
        if (isNewClient) {
            client.release();
        }
    }
}

/**
 * Executes an async callback within an isolated PostgreSQL SAVEPOINT.
 * Useful for nested atomic operations within an outer transaction.
 *
 * @param {Object} client - Active pg.Client in an open transaction
 * @param {string} savepointName - Alphanumeric identifier for savepoint
 * @param {Function} callback - async (client) => result
 * @returns {Promise<*>} Result of the callback
 */
async function withSavepoint(client, savepointName, callback) {
    // Sanitize savepoint name to alphanumeric to prevent SQL injection
    const sanitizedName = (savepointName || 'sp_default').replace(/[^a-zA-Z0-9_]/g, '_');

    await client.query(`SAVEPOINT ${sanitizedName}`);
    try {
        const result = await callback(client);
        await client.query(`RELEASE SAVEPOINT ${sanitizedName}`);
        return result;
    } catch (err) {
        try {
            await client.query(`ROLLBACK TO SAVEPOINT ${sanitizedName}`);
        } catch (rbErr) {
            console.warn(`[PostgreSQL Savepoint] Rollback to ${sanitizedName} notice:`, rbErr.message);
        }
        throw err;
    }
}

module.exports = {
    withTransaction,
    withSavepoint
};
