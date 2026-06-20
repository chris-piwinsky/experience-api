import { randomUUID } from "crypto";

import { type NextFunction, type Request, type Response } from "express";

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Generate or extract request ID for this call.
  // Extract or default correlation ID to request ID so single-call flows remain traceable without extra client headers.
  // Multi-call flows can use explicit correlation ID header to tie requests together for support diagnostics.
  const requestId = req.header("x-request-id") ?? randomUUID();
  const correlationId = req.header("x-correlation-id") ?? requestId;

  res.locals.requestId = requestId;
  res.locals.correlationId = correlationId;

  res.setHeader("x-request-id", requestId);
  res.setHeader("x-correlation-id", correlationId);

  next();
}
