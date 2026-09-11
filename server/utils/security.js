// server/utils/security.js
// Production Cryptographic & Password Security Utilities
const crypto = require('node:crypto');

const LEGACY_STATIC_SALT = 'swifttrack_secure_salt_2026';

/**
 * Hash password with a cryptographically secure random per-user salt
 * @param {string} password - Plaintext password
 * @param {string} [customSalt] - Optional salt for testing or deterministic seeding
 * @returns {string} Formatted as 'salt:derivedKey'
 */
function hashPassword(password, customSalt = null) {
    if (!password || typeof password !== 'string') {
        throw new Error('Password must be a valid non-empty string');
    }
    const salt = customSalt || crypto.randomBytes(16).toString('hex');
    const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${derivedKey}`;
}

/**
 * Timing-safe password verification with backward compatibility for legacy hashes
 * @param {string} password - Plaintext password candidate
 * @param {string} storedHash - Stored hash from database
 * @returns {{ isValid: boolean, needsUpgrade: boolean }}
 */
function verifyPassword(password, storedHash) {
    if (!password || !storedHash || typeof password !== 'string' || typeof storedHash !== 'string') {
        return { isValid: false, needsUpgrade: false };
    }

    try {
        // Modern format: 'salt:derivedKey'
        if (storedHash.includes(':')) {
            const [salt, expectedHash] = storedHash.split(':');
            if (!salt || !expectedHash) return { isValid: false, needsUpgrade: false };

            const computedKey = crypto.scryptSync(password, salt, 64);
            const expectedBuffer = Buffer.from(expectedHash, 'hex');

            if (computedKey.length !== expectedBuffer.length) {
                return { isValid: false, needsUpgrade: false };
            }

            const isValid = crypto.timingSafeEqual(computedKey, expectedBuffer);
            return { isValid, needsUpgrade: false };
        }

        // Legacy format: raw hex string using static salt
        const computedLegacyKey = crypto.scryptSync(password, LEGACY_STATIC_SALT, 64);
        const expectedLegacyBuffer = Buffer.from(storedHash, 'hex');

        if (computedLegacyKey.length !== expectedLegacyBuffer.length) {
            return { isValid: false, needsUpgrade: false };
        }

        const isValid = crypto.timingSafeEqual(computedLegacyKey, expectedLegacyBuffer);
        // If valid, flag for upgrade to per-user dynamic salt
        return { isValid, needsUpgrade: isValid };
    } catch {
        return { isValid: false, needsUpgrade: false };
    }
}

/**
 * Generate a cryptographically random secret string
 * @param {number} bytes - Number of random bytes
 * @returns {string} Hex string
 */
function generateSecureRandom(bytes = 32) {
    return crypto.randomBytes(bytes).toString('hex');
}

module.exports = {
    hashPassword,
    verifyPassword,
    generateSecureRandom,
    LEGACY_STATIC_SALT
};
