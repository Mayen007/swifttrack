// server/middleware/requestId.js
// Enterprise Request ID & Correlation Tracking Middleware
const crypto = require('node:crypto');

/**
 * Generates or extracts a collision-resistant request correlation ID.
 * Sets `req.id` and writes the `X-Request-ID` header to the response.
 */
function requestIdMiddleware(req, res, next) {
    const incomingId = req.headers['x-request-id'] || req.headers['x-correlation-id'];

    // If incoming ID exists, sanitize it; otherwise generate a new unique ID
    let reqId = typeof incomingId === 'string' ? incomingId.trim() : null;
    if (!reqId || reqId.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(reqId)) {
        reqId = `req_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    }

    req.id = reqId;
    res.setHeader('X-Request-ID', reqId);
    next();
}

module.exports = {
    requestIdMiddleware
};
