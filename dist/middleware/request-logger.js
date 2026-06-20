"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLoggerMiddleware = requestLoggerMiddleware;
function requestLoggerMiddleware(req, res, next) {
    const startedAt = Date.now();
    res.on("finish", () => {
        // Emit one completion event per request for traceability and latency monitoring.
        const log = {
            timestamp: new Date().toISOString(),
            level: "info",
            message: "http_request_completed",
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            durationMs: Date.now() - startedAt,
            requestId: res.locals.requestId,
            correlationId: res.locals.correlationId,
        };
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(log));
    });
    next();
}
