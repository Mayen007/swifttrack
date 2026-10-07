// server/db/sqliteDevRuntime.js
// SQLite local development bootstrap isolated from server.js entrypoint

const sqlite = require('./database.js');
const { runSeed, initProductionBootstrap, ensureRichChartTelemetry } = require('./seed.js');

function initSqliteDevRuntime() {
    sqlite.initSchema();
    const company = sqlite.db.prepare('SELECT count(*) as count FROM company_settings').get();
    const isDemoMode = process.env.DEMO_MODE === 'true';
    if (company.count === 0) {
        if (isDemoMode) {
            console.log('Seeding initial system data with demo simulation...');
            runSeed();
        } else {
            console.log('Initializing clean enterprise production database bootstrap...');
            initProductionBootstrap();
        }
    } else if (isDemoMode) {
        ensureRichChartTelemetry();
    }
}

module.exports = {
    initSqliteDevRuntime
};
