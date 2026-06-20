"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.correlationIdMiddleware = correlationIdMiddleware;
const crypto_1 = require("crypto");
function correlationIdMiddleware(req, res, next) {
    const requestId = req.header("x-request-id") ?? (0, crypto_1.randomUUID)();
    // Default correlation id to request id so single-call flows remain traceable without extra client headers.
    const correlationId = req.header("x-correlation-id") ?? requestId;
    res.locals.requestId = requestId;
    res.locals.correlationId = correlationId;
    res.setHeader("x-request-id", requestId);
    res.setHeader("x-correlation-id", correlationId);
    next();
}
