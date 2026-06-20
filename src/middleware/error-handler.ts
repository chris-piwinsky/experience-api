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
  // Preserve typed domain errors so clients receive stable error codes and optional detail arrays.
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

  // Fallback protects the API contract when unexpected exceptions occur.
  res.status(500).json({
    code: "INTERNAL_ERROR",
    message: "Unexpected error while handling checkout request",
    requestId: res.locals.requestId,
    correlationId: res.locals.correlationId,
    timestamp: new Date().toISOString(),
  });
}
