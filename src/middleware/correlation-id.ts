import { randomUUID } from "crypto";

import { type NextFunction, type Request, type Response } from "express";

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.header("x-request-id") ?? randomUUID();
  // Default correlation id to request id so single-call flows remain traceable without extra client headers.
  const correlationId = req.header("x-correlation-id") ?? requestId;

  res.locals.requestId = requestId;
  res.locals.correlationId = correlationId;

  res.setHeader("x-request-id", requestId);
  res.setHeader("x-correlation-id", correlationId);

  next();
}
