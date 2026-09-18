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

/**
 * SHA-256 hash a string (used for indexing tokens and refresh tokens safely)
 * @param {string} data
 * @returns {string} Hex string
 */
function sha256Hash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

const COMMON_COMPROMISED_PASSWORDS = new Set([
    'password', 'password123', 'password1234', '12345678', '123456789',
    '1234567890', 'qwertyuiop', 'admin123', 'admin1234', 'administrator',
    'welcome123', 'letmein123', 'swifttrack', 'swifttrack123', 'logistics123'
]);

/**
 * Enforces Enterprise Strong Password Policy
 * - Min 10 chars (12 in production)
 * - Max 128 chars
 * - At least 1 uppercase, 1 lowercase, 1 number, 1 special character
 * - Prohibits username and email local part
 * - Prohibits known common compromised passwords
 * @param {string} password
 * @param {object} [userContext] - { username, email }
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validatePasswordStrength(password, userContext = {}) {
    const errors = [];
    const minLength = process.env.NODE_ENV === 'production' ? 12 : 10;

    if (!password || typeof password !== 'string') {
        return { isValid: false, errors: ['Password must be a valid non-empty string.'] };
    }

    if (password.length < minLength) {
        errors.push(`Password must be at least ${minLength} characters long.`);
    }

    if (password.length > 128) {
        errors.push('Password cannot exceed 128 characters.');
    }

    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter (A-Z).');
    }

    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter (a-z).');
    }

    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one numerical digit (0-9).');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?~`]/.test(password)) {
        errors.push('Password must contain at least one special symbol (e.g. !@#$%^&*).');
    }

    const lowerPass = password.toLowerCase();

    if (COMMON_COMPROMISED_PASSWORDS.has(lowerPass)) {
        errors.push('This password is on the common compromised password blacklist and is unsafe.');
    }

    const username = userContext.username ? userContext.username.toLowerCase().trim() : '';
    if (username && username.length >= 3 && lowerPass.includes(username)) {
        errors.push('Password cannot contain your username.');
    }

    const email = userContext.email ? userContext.email.toLowerCase().trim() : '';
    if (email && email.includes('@')) {
        const localPart = email.split('@')[0];
        if (localPart.length >= 3 && lowerPass.includes(localPart)) {
            errors.push('Password cannot contain your email identifier.');
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

module.exports = {
    hashPassword,
    verifyPassword,
    generateSecureRandom,
    sha256Hash,
    validatePasswordStrength,
    LEGACY_STATIC_SALT
};

