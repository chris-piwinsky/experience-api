import { type NextFunction, type Request, type Response } from "express";

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
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
