// server/middleware/bodyLimits.js
// Tiered Request Body Limits by Endpoint
const express = require('express');

const STANDARD_LIMIT = '100kb';
const UPLOAD_LIMIT = '5mb';

// Dedicated parser instances
const standardJson = express.json({ limit: STANDARD_LIMIT });
const uploadJson = express.json({ limit: UPLOAD_LIMIT });
const standardUrlEncoded = express.urlencoded({ extended: true, limit: STANDARD_LIMIT });

// Endpoints requiring higher payload limit (POD signatures, photo evidence)
const UPLOAD_ENDPOINT_PREFIXES = [
    '/api/v1/deliveries/',
    '/api/deliveries/'
];

/**
 * Conditionally applies tiered body limits based on route path
 */
function tieredBodyParser(req, res, next) {
    const isUploadPath = UPLOAD_ENDPOINT_PREFIXES.some(prefix => 
        req.path.startsWith(prefix) && req.path.endsWith('/pod')
    );

    if (isUploadPath) {
        return uploadJson(req, res, (err) => {
            if (err) return handleBodyLimitError(err, req, res, next, UPLOAD_LIMIT);
            next();
        });
    }

    return standardJson(req, res, (err) => {
        if (err) return handleBodyLimitError(err, req, res, next, STANDARD_LIMIT);
        next();
    });
}

function tieredUrlEncodedParser(req, res, next) {
    return standardUrlEncoded(req, res, (err) => {
        if (err) return handleBodyLimitError(err, req, res, next, STANDARD_LIMIT);
        next();
    });
}

function handleBodyLimitError(err, req, res, next, limit) {
    if (err.type === 'entity.too.large' || err.status === 413) {
        const message = `Payload Too Large: Request body exceeds the maximum permitted limit of ${limit} for this endpoint.`;
        if (typeof res.apiError === 'function') {
            return res.apiError(message, 413, 'PAYLOAD_TOO_LARGE', {
                limit,
                receivedBytes: err.length
            });
        }
        return res.status(413).json({
            success: false,
            error: {
                code: 'PAYLOAD_TOO_LARGE',
                message,
                limit,
                receivedBytes: err.length
            },
            code: 'PAYLOAD_TOO_LARGE',
            message
        });
    }
    next(err);
}

module.exports = {
    tieredBodyParser,
    tieredUrlEncodedParser,
    STANDARD_LIMIT,
    UPLOAD_LIMIT
};
