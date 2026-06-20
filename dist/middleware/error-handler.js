"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = notFoundHandler;
exports.errorHandler = errorHandler;
const api_error_1 = require("../types/api-error");
function notFoundHandler(req, res) {
    res.status(404).json({
        code: "JOURNEY_NOT_FOUND",
        message: "Route was not found",
        requestId: res.locals.requestId,
        correlationId: res.locals.correlationId,
        timestamp: new Date().toISOString(),
    });
}
function errorHandler(err, _req, res, _next) {
    // Preserve typed domain errors so clients receive stable error codes and optional detail arrays.
    if (err instanceof api_error_1.ApiError) {
        res.status(err.status).json({
            code: err.code,
            message: err.message,
            details: err.details,
            requestId: res.locals.requestId,
            correlationId: res.locals.correlationId,
            timestamp: new Date().toISOString(),
        });
        return;
    }
    // Fallback protects the API contract when unexpected exceptions occur.
    res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Unexpected error while handling checkout request",
        requestId: res.locals.requestId,
        correlationId: res.locals.correlationId,
        timestamp: new Date().toISOString(),
    });
}
