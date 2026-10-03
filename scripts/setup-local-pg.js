// scripts/setup-local-pg.js
const { Client } = require('pg');

async function setup() {
    const c = new Client({ connectionString: 'postgres://postgres@127.0.0.1:5433/postgres' });
    await c.connect();

    // Check if database exists
    const dbRes = await c.query("SELECT 1 FROM pg_database WHERE datname = 'swifttrack_logistics'");
    if (dbRes.rows.length === 0) {
        await c.query('CREATE DATABASE swifttrack_logistics');
        console.log('Created database swifttrack_logistics');
    } else {
        console.log('Database swifttrack_logistics already exists');
    }

    // Check if user exists
    const userRes = await c.query("SELECT 1 FROM pg_roles WHERE rolname = 'swifttrack_admin'");
    if (userRes.rows.length === 0) {
        await c.query("CREATE USER swifttrack_admin WITH SUPERUSER PASSWORD 'super_secure_pg_password_2026'");
        console.log('Created user swifttrack_admin');
    } else {
        console.log('User swifttrack_admin already exists');
    }

    await c.end();

    // Test connection as swifttrack_admin
    const c2 = new Client({ connectionString: 'postgres://swifttrack_admin:super_secure_pg_password_2026@127.0.0.1:5433/swifttrack_logistics' });
    await c2.connect();
    console.log('Verified connection as swifttrack_admin to swifttrack_logistics!');
    await c2.end();
}

setup().catch(err => {
    console.error('Setup error:', err);
    process.exit(1);
});
