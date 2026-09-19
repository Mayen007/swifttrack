// server/middleware/validation.js
// High-performance declarative schema validation middleware for Express
const { ValidationError } = require('../utils/response.js');

/**
 * Validates a single value against a defined rule.
 * @returns {{ valid: boolean, issue?: string, sanitizedValue?: any }}
 */
function validateField(val, rule = {}, fieldName = 'field') {
    // 1. Required Check
    if (val === undefined || val === null || val === '') {
        if (rule.required) {
            return { valid: false, issue: `'${fieldName}' is required` };
        }
        return { valid: true, sanitizedValue: rule.default !== undefined ? rule.default : val };
    }

    let sanitized = val;

    // 2. Type & Coercion Check
    const expectedType = rule.type ? rule.type.toLowerCase() : 'string';

    switch (expectedType) {
        case 'string':
            if (typeof sanitized !== 'string') {
                return { valid: false, issue: `'${fieldName}' must be a string` };
            }
            if (rule.trim !== false) {
                sanitized = sanitized.trim();
            }
            if (rule.toLowerCase) {
                sanitized = sanitized.toLowerCase();
            }
            if (rule.minLength !== undefined && sanitized.length < rule.minLength) {
                return { valid: false, issue: `'${fieldName}' must be at least ${rule.minLength} characters long` };
            }
            if (rule.maxLength !== undefined && sanitized.length > rule.maxLength) {
                return { valid: false, issue: `'${fieldName}' must not exceed ${rule.maxLength} characters` };
            }
            if (rule.pattern instanceof RegExp && !rule.pattern.test(sanitized)) {
                return { valid: false, issue: `'${fieldName}' does not match required pattern` };
            }
            break;

        case 'number':
            const num = Number(sanitized);
            if (isNaN(num)) {
                return { valid: false, issue: `'${fieldName}' must be a valid number` };
            }
            sanitized = num;
            if (rule.min !== undefined && sanitized < rule.min) {
                return { valid: false, issue: `'${fieldName}' must be at least ${rule.min}` };
            }
            if (rule.max !== undefined && sanitized > rule.max) {
                return { valid: false, issue: `'${fieldName}' must not exceed ${rule.max}` };
            }
            break;

        case 'integer':
            const intVal = Number(sanitized);
            if (!Number.isInteger(intVal)) {
                return { valid: false, issue: `'${fieldName}' must be an integer` };
            }
            sanitized = intVal;
            if (rule.min !== undefined && sanitized < rule.min) {
                return { valid: false, issue: `'${fieldName}' must be at least ${rule.min}` };
            }
            if (rule.max !== undefined && sanitized > rule.max) {
                return { valid: false, issue: `'${fieldName}' must not exceed ${rule.max}` };
            }
            break;

        case 'boolean':
            if (typeof sanitized === 'boolean') {
                // already boolean
            } else if (sanitized === 'true' || sanitized === 1 || sanitized === '1') {
                sanitized = true;
            } else if (sanitized === 'false' || sanitized === 0 || sanitized === '0') {
                sanitized = false;
            } else {
                return { valid: false, issue: `'${fieldName}' must be a boolean (true/false)` };
            }
            break;

        case 'array':
            if (!Array.isArray(sanitized)) {
                return { valid: false, issue: `'${fieldName}' must be an array` };
            }
            if (rule.min !== undefined && sanitized.length < rule.min) {
                return { valid: false, issue: `'${fieldName}' must contain at least ${rule.min} item(s)` };
            }
            if (rule.max !== undefined && sanitized.length > rule.max) {
                return { valid: false, issue: `'${fieldName}' must not exceed ${rule.max} item(s)` };
            }
            break;

        case 'object':
            if (typeof sanitized !== 'object' || Array.isArray(sanitized) || sanitized === null) {
                return { valid: false, issue: `'${fieldName}' must be an object` };
            }
            break;

        case 'email':
            if (typeof sanitized !== 'string') {
                return { valid: false, issue: `'${fieldName}' must be an email string` };
            }
            sanitized = sanitized.trim().toLowerCase();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(sanitized)) {
                return { valid: false, issue: `'${fieldName}' must be a valid email address` };
            }
            break;

        case 'phoneke':
            // Kenyan phone validator: accepts +254..., 254..., 07..., 01...
            if (typeof sanitized !== 'string') {
                return { valid: false, issue: `'${fieldName}' must be a phone string` };
            }
            sanitized = sanitized.trim().replace(/\s+/g, '');
            const keRegex = /^(?:(?:\+254)|(?:254)|(?:0))([17]\d{8})$/;
            if (!keRegex.test(sanitized)) {
                return { valid: false, issue: `'${fieldName}' must be a valid Kenyan mobile number (e.g. +254 7XX XXX XXX or 07XX XXX XXX)` };
            }
            break;

        case 'isodate':
            if (typeof sanitized !== 'string') {
                return { valid: false, issue: `'${fieldName}' must be an ISO date string` };
            }
            const date = new Date(sanitized);
            if (isNaN(date.getTime())) {
                return { valid: false, issue: `'${fieldName}' must be a valid ISO 8601 date string` };
            }
            break;

        case 'enum':
            if (!rule.enum || !Array.isArray(rule.enum)) {
                return { valid: false, issue: `Enum values configuration missing for '${fieldName}'` };
            }
            if (!rule.enum.includes(sanitized)) {
                return { valid: false, issue: `'${fieldName}' must be one of: [${rule.enum.join(', ')}]` };
            }
            break;
    }

    // 3. Enum check for typed fields
    if (rule.enum && Array.isArray(rule.enum) && !rule.enum.includes(sanitized)) {
        return { valid: false, issue: `'${fieldName}' must be one of: [${rule.enum.join(', ')}]` };
    }

    return { valid: true, sanitizedValue: sanitized };
}

/**
 * Express middleware generator that validates body, query, and params against a schema.
 *
 * @param {Object} schema
 * @param {Object} [schema.body] - Rules for req.body
 * @param {Object} [schema.query] - Rules for req.query
 * @param {Object} [schema.params] - Rules for req.params
 */
function validateRequest(schema = {}) {
    return (req, res, next) => {
        const errors = [];

        // Validate req.params
        if (schema.params) {
            for (const [field, rule] of Object.entries(schema.params)) {
                const check = validateField(req.params[field], rule, field);
                if (!check.valid) {
                    errors.push({ location: 'params', field, issue: check.issue, received: req.params[field] });
                } else if (check.sanitizedValue !== undefined) {
                    req.params[field] = check.sanitizedValue;
                }
            }
        }

        // Validate req.query
        if (schema.query) {
            for (const [field, rule] of Object.entries(schema.query)) {
                const check = validateField(req.query[field], rule, field);
                if (!check.valid) {
                    errors.push({ location: 'query', field, issue: check.issue, received: req.query[field] });
                } else if (check.sanitizedValue !== undefined) {
                    req.query[field] = check.sanitizedValue;
                }
            }
        }

        // Validate req.body
        if (schema.body) {
            // Ensure body exists if schema defines required fields
            req.body = req.body || {};
            for (const [field, rule] of Object.entries(schema.body)) {
                const check = validateField(req.body[field], rule, field);
                if (!check.valid) {
                    errors.push({ location: 'body', field, issue: check.issue, received: req.body[field] });
                } else if (check.sanitizedValue !== undefined) {
                    req.body[field] = check.sanitizedValue;
                }
            }
        }

        if (errors.length > 0) {
            const message = `Validation failed: ${errors.length} error(s) detected`;
            if (typeof res.apiError === 'function') {
                return res.apiError(message, 400, 'VALIDATION_ERROR', errors);
            }
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message,
                    details: errors,
                    requestId: req.id || null,
                    timestamp: new Date().toISOString()
                },
                code: 'VALIDATION_ERROR',
                message,
                details: errors
            });
        }

        next();
    };
}

module.exports = {
    validateRequest,
    validateField
};
