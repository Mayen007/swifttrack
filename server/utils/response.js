// server/utils/response.js
// Enterprise Standardized API Response Envelopes & Typed Error Hierarchy

class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = []) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message = 'Validation failed', details = []) {
        super(message, 400, 'VALIDATION_ERROR', details);
    }
}

class AuthenticationError extends AppError {
    constructor(message = 'Authentication required', code = 'UNAUTHORIZED', details = []) {
        super(message, 401, code, details);
    }
}

class ForbiddenError extends AppError {
    constructor(message = 'Access forbidden', code = 'FORBIDDEN', details = []) {
        super(message, 403, code, details);
    }
}

class NotFoundError extends AppError {
    constructor(message = 'Resource not found', code = 'NOT_FOUND', details = []) {
        super(message, 404, code, details);
    }
}

class ConflictError extends AppError {
    constructor(message = 'Resource conflict', code = 'CONFLICT', details = []) {
        super(message, 409, code, details);
    }
}

class RateLimitError extends AppError {
    constructor(message = 'Too many requests', retryAfterSeconds = 60) {
        super(message, 429, 'TOO_MANY_REQUESTS', [{ retryAfterSeconds }]);
        this.retryAfterSeconds = retryAfterSeconds;
    }
}

class IdempotencyError extends AppError {
    constructor(message, statusCode = 409, code = 'IDEMPOTENCY_CONFLICT', details = []) {
        super(message, statusCode, code, details);
    }
}

/**
 * Middleware that decorates Express response with standard envelope helpers.
 */
function responseEnhancer(req, res, next) {
    // 1. Standard Success Envelope Helper
    res.apiSuccess = function(data, options = {}) {
        const statusCode = options.statusCode || 200;
        const meta = {
            requestId: req.id || null,
            timestamp: new Date().toISOString(),
            ...(options.meta || {})
        };

        return res.status(statusCode).json({
            success: true,
            data: data !== undefined ? data : null,
            meta
        });
    };

    // 2. Standard Error Envelope Helper (with dual-compatibility top-level fields)
    res.apiError = function(message, statusCode = 500, code = 'INTERNAL_ERROR', details = []) {
        const requestId = req.id || null;
        const timestamp = new Date().toISOString();

        return res.status(statusCode).json({
            success: false,
            error: {
                code,
                message: typeof message === 'string' ? message : 'Request failed',
                details: Array.isArray(details) ? details : [details],
                requestId,
                timestamp
            },
            // Legacy backwards-compatibility top-level properties
            code,
            message: typeof message === 'string' ? message : 'Request failed',
            details: Array.isArray(details) ? details : [details],
            requestId
        });
    };

    next();
}

/**
 * Centralized error handler middleware.
 */
function centralErrorHandler(err, req, res, next) {
    const statusCode = err.statusCode || (err.status >= 400 && err.status < 600 ? err.status : 500);
    const code = err.code || (statusCode === 404 ? 'NOT_FOUND' : statusCode === 400 ? 'BAD_REQUEST' : 'INTERNAL_ERROR');
    const message = err.message || 'Internal Server Error';
    const details = err.details || [];

    if (statusCode >= 500) {
        console.error(`[API Error ${req.id || 'N/A'}]`, {
            method: req.method,
            url: req.originalUrl,
            message: err.message,
            stack: err.stack
        });
    }

    if (typeof res.apiError === 'function') {
        return res.apiError(message, statusCode, code, details);
    }

    res.status(statusCode).json({
        success: false,
        error: {
            code,
            message,
            details,
            requestId: req.id || null,
            timestamp: new Date().toISOString()
        },
        code,
        message,
        details,
        requestId: req.id || null
    });
}

module.exports = {
    AppError,
    ValidationError,
    AuthenticationError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    IdempotencyError,
    responseEnhancer,
    centralErrorHandler
};
