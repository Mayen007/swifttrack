// server/utils/env.js
// Production Secrets & Environment Validation Utility
const crypto = require('node:crypto');

const KNOWN_INSECURE_SECRETS = [
    'swifttrack_jwt_super_secret_production_key_2026',
    'swifttrack_jwt_super_secret_production_key_2026_change_in_prod',
    'secret',
    'jwt_secret',
    'changeme',
    'supersecret',
    'password',
    'password123!',
    'admin',
    '12345678'
];

let cachedSecret = null;

/**
 * Validates and retrieves the JWT Secret.
 * In production: strictly enforces presence, non-default value, and minimum length (>= 32 chars).
 * In development/test: generates an ephemeral secure secret if missing, with clear advisory logging.
 */
function getJwtSecret() {
    if (cachedSecret) return cachedSecret;

    const rawSecret = process.env.JWT_SECRET ? process.env.JWT_SECRET.trim() : '';
    const isProd = process.env.NODE_ENV === 'production';

    if (isProd) {
        if (!rawSecret) {
            console.error('[ERROR] FATAL SECURITY ERROR: JWT_SECRET environment variable is missing in production!');
            console.error('[GUIDE] Generate a secure secret using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
            process.exit(1);
        }

        if (KNOWN_INSECURE_SECRETS.includes(rawSecret.toLowerCase())) {
            console.error('[ERROR] FATAL SECURITY ERROR: JWT_SECRET is set to an insecure default placeholder!');
            console.error('[GUIDE] Set a cryptographically random production secret in .env or environment.');
            process.exit(1);
        }

        if (rawSecret.length < 32) {
            console.error(`[ERROR] FATAL SECURITY ERROR: JWT_SECRET is too short (${rawSecret.length} chars). Minimum length is 32 characters.`);
            process.exit(1);
        }

        cachedSecret = rawSecret;
        return cachedSecret;
    }

    // Development / Test mode
    if (rawSecret && !KNOWN_INSECURE_SECRETS.includes(rawSecret.toLowerCase()) && rawSecret.length >= 32) {
        cachedSecret = rawSecret;
        return cachedSecret;
    }

    if (rawSecret && rawSecret.length >= 16) {
        cachedSecret = rawSecret;
        return cachedSecret;
    }

    // If missing in dev/test, generate ephemeral 256-bit secret for this process
    cachedSecret = crypto.randomBytes(32).toString('hex');
    return cachedSecret;
}

const fs = require('node:fs');
const path = require('node:path');

function loadEnv() {
    const candidatePaths = [
        path.resolve(__dirname, '../../.env'),
        path.resolve(__dirname, '../.env'),
        path.resolve(process.cwd(), '.env')
    ];
    for (const p of candidatePaths) {
        if (fs.existsSync(p) && typeof process.loadEnvFile === 'function') {
            try {
                process.loadEnvFile(p);
                break;
            } catch (e) {
                // Ignore parse errors or continue
            }
        }
    }
}

// Auto-load .env on module evaluation
loadEnv();

/**
 * Validates critical environment variables and production secret entropy at startup
 */
function validateStartupEnv() {
    loadEnv();
    const isProd = process.env.NODE_ENV === 'production';
    const secret = getJwtSecret();

    if (isProd) {
        // Enforce production database constraints (Section 3 Mandate)
        if (process.env.DB_CLIENT !== 'postgres') {
            console.error('[ERROR] FATAL CONFIGURATION ERROR: Production requires DB_CLIENT=postgres.');
            console.error('[ERROR] Silent fallback to SQLite is strictly prohibited in production.');
            process.exit(1);
        }

        if (!process.env.DATABASE_URL) {
            console.error('[ERROR] FATAL CONFIGURATION ERROR: Production requires DATABASE_URL to connect to PostgreSQL.');
            process.exit(1);
        }

        // Enforce production security constraints
        if (process.env.DEMO_MODE === 'true') {
            console.error('[ERROR] FATAL SECURITY ERROR: DEMO_MODE must NOT be enabled in production environment!');
            process.exit(1);
        }

        // Check database password entropy if PostgreSQL credentials provided
        const dbPassword = process.env.DB_PASSWORD || process.env.PGPASSWORD;
        if (dbPassword && KNOWN_INSECURE_SECRETS.includes(dbPassword.toLowerCase())) {
            console.error('[ERROR] FATAL SECURITY ERROR: Database password is set to an insecure default!');
            process.exit(1);
        }

        console.log('[Security] Production environment configuration & secrets verified.');
    } else {
        // In non-production, validate DB_CLIENT if specified
        if (process.env.DB_CLIENT && !['postgres', 'sqlite'].includes(process.env.DB_CLIENT)) {
            console.error(`[ERROR] Invalid DB_CLIENT: "${process.env.DB_CLIENT}". Must be 'postgres' or 'sqlite'.`);
            process.exit(1);
        }
        console.log('[Security] Environment configuration & secrets verified.');
    }

    return {
        isProduction: isProd,
        hasValidSecret: Boolean(secret)
    };
}

module.exports = {
    getJwtSecret,
    validateStartupEnv,
    KNOWN_INSECURE_SECRETS
};
