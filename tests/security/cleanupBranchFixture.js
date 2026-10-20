const dbAdapter = require('../../server/db/dbAdapter.js');

async function cleanupBranchFixture(branchId) {
    if (!branchId) return;

    try {
        await dbAdapter.run('DELETE FROM inventory WHERE branch_id = ?', [branchId]);
        await dbAdapter.run('DELETE FROM warehouses WHERE branch_id = ?', [branchId]);
        await dbAdapter.run('DELETE FROM branches WHERE id = ?', [branchId]);
    } catch (err) {
        const isForeignKeyViolation = err.code === '23503'
            || (err.code === 'ERR_SQLITE_ERROR' && err.errcode === 787)
            || /foreign key constraint failed|violates foreign key/i.test(err.message);
        if (!isForeignKeyViolation) throw err;

        await dbAdapter.run('UPDATE branches SET is_active = false WHERE id = ?', [branchId]);
        console.warn(`[security fixture cleanup]: branch ${branchId} is retained inactive because it is referenced by test data.`);
    }
}

module.exports = cleanupBranchFixture;
