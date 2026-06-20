import { type NextFunction, type Request, type Response } from "express";

import { ApiError } from "../types/api-error";

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    code: "JOURNEY_NOT_FOUND",
    message: "Route was not found",
    requestId: res.locals.requestId,
    correlationId: res.locals.correlationId,
    timestamp: new Date().toISOString(),
  });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  // Preserve typed domain errors (ApiError) so clients receive stable error codes and optional detail arrays.
  // Domain errors include validation failures (400), deterministic adapter failures (409/503), and not-found (404).
  if (err instanceof ApiError) {
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

  // Fallback: protects the API contract by converting unexpected exceptions to 500 with stable envelope.
  // Helps support engineers identify code bugs vs expected business logic failures.
  res.status(500).json({
    code: "INTERNAL_ERROR",
    message: "Unexpected error while handling checkout request",
    requestId: res.locals.requestId,
    correlationId: res.locals.correlationId,
    timestamp: new Date().toISOString(),
  });
}
