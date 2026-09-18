// server/utils/totp.js
// Enterprise RFC 6238 Time-Based One-Time Password (TOTP) Engine
// Zero external dependencies - uses native Node.js crypto
const crypto = require('node:crypto');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encode a buffer into standard RFC 4648 Base32 string (without padding)
 * @param {Buffer} buffer
 * @returns {string}
 */
function base32Encode(buffer) {
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
        value = (value << 8) | buffer[i];
        bits += 8;

        while (bits >= 5) {
            output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }

    if (bits > 0) {
        output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }

    return output;
}

/**
 * Decode an RFC 4648 Base32 string into a Buffer
 * @param {string} base32Str
 * @returns {Buffer}
 */
function base32Decode(base32Str) {
    const cleaned = base32Str.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
    let bits = 0;
    let value = 0;
    const bytes = [];

    for (let i = 0; i < cleaned.length; i++) {
        const char = cleaned[i];
        const val = BASE32_ALPHABET.indexOf(char);
        if (val === -1) continue;

        value = (value << 5) | val;
        bits += 5;

        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }

    return Buffer.from(bytes);
}

/**
 * Generate a 6-digit TOTP code for a secret buffer at a given counter
 * @param {Buffer} secretBuffer
 * @param {number} counter
 * @returns {string} 6-digit string
 */
function generateHOTP(secretBuffer, counter) {
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(counter), 0);

    const hmac = crypto.createHmac('sha1', secretBuffer).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;

    const code =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);

    return (code % 1000000).toString().padStart(6, '0');
}

/**
 * Generates a new 160-bit (20-byte) cryptographically secure Base32 TOTP secret
 * @returns {string}
 */
function generateSecret(bytes = 20) {
    return base32Encode(crypto.randomBytes(bytes));
}

/**
 * Generates the standardized otpauth:// URI for authenticator applications
 * @param {object} params
 * @param {string} params.secret - Base32 secret
 * @param {string} params.username - User username or email
 * @param {string} [params.issuer] - Company / Application label
 * @returns {string}
 */
function getOtpAuthUri({ secret, username, issuer = 'SwiftTrack Kenya' }) {
    const encodedIssuer = encodeURIComponent(issuer);
    const encodedUser = encodeURIComponent(username);
    return `otpauth://totp/${encodedIssuer}:${encodedUser}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Verifies a user-supplied 6-digit TOTP code against a Base32 secret
 * Allows +/- 1 window (30 seconds drift tolerance)
 * @param {string} token - 6-digit code
 * @param {string} base32Secret - User's stored Base32 secret
 * @param {number} [window=1] - Step tolerance (default: +/- 1 step = +/- 30s)
 * @returns {boolean}
 */
function verifyTotp(token, base32Secret, window = 1) {
    if (!token || !base32Secret || typeof token !== 'string') return false;

    const cleanedToken = token.trim().replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleanedToken)) return false;

    try {
        const secretBuffer = base32Decode(base32Secret);
        const currentStep = Math.floor(Date.now() / 1000 / 30);

        for (let errorWindow = -window; errorWindow <= window; errorWindow++) {
            const calculatedCode = generateHOTP(secretBuffer, currentStep + errorWindow);
            if (crypto.timingSafeEqual(Buffer.from(cleanedToken), Buffer.from(calculatedCode))) {
                return true;
            }
        }
    } catch {
        return false;
    }

    return false;
}

/**
 * Generates 8 single-use alphanumeric backup recovery codes
 * Returns array of plain codes (to show user once) and hashed codes (to store in DB)
 * @returns {{ plainCodes: string[], hashedCodes: string[] }}
 */
function generateRecoveryCodes(count = 8) {
    const plainCodes = [];
    const hashedCodes = [];

    for (let i = 0; i < count; i++) {
        const chunk1 = crypto.randomBytes(2).toString('hex').toUpperCase();
        const chunk2 = crypto.randomBytes(2).toString('hex').toUpperCase();
        const chunk3 = crypto.randomBytes(2).toString('hex').toUpperCase();
        const code = `${chunk1}-${chunk2}-${chunk3}`;

        plainCodes.push(code);
        hashedCodes.push(crypto.createHash('sha256').update(code).digest('hex'));
    }

    return { plainCodes, hashedCodes };
}

/**
 * Verifies and consumes a recovery backup code
 * @param {string} submittedCode
 * @param {string[]} storedHashedCodes
 * @returns {{ isValid: boolean, remainingHashedCodes: string[] }}
 */
function verifyRecoveryCode(submittedCode, storedHashedCodes = []) {
    if (!submittedCode || !Array.isArray(storedHashedCodes) || storedHashedCodes.length === 0) {
        return { isValid: false, remainingHashedCodes: storedHashedCodes };
    }

    const cleaned = submittedCode.trim().toUpperCase();
    const submittedHash = crypto.createHash('sha256').update(cleaned).digest('hex');

    const matchIndex = storedHashedCodes.findIndex(h => h === submittedHash);
    if (matchIndex !== -1) {
        const remaining = [...storedHashedCodes];
        remaining.splice(matchIndex, 1);
        return { isValid: true, remainingHashedCodes: remaining };
    }

    return { isValid: false, remainingHashedCodes: storedHashedCodes };
}

module.exports = {
    generateSecret,
    getOtpAuthUri,
    verifyTotp,
    generateRecoveryCodes,
    verifyRecoveryCode,
    base32Encode,
    base32Decode
};
