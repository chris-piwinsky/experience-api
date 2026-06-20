import { Router, type Request, type Response, type NextFunction } from "express";

import { createCheckoutService } from "../services/checkout.service";
import { ApiError } from "../types/api-error";
import { CHECKOUT_STEP_IDS, type CheckoutStepId } from "../types/checkout";

// HTTP handler layer for checkout journey endpoints.
// Routes delegate business logic to CheckoutService and wrap responses in canonical envelopes.
export const checkoutRouter = Router();
const checkoutService = createCheckoutService();

// Extract request/correlation IDs and current timestamp from response locals (set by middleware).
// These values are included in every response envelope for tracing and audit.
function requestContext(res: Response): { requestId: string; correlationId: string; timestamp: string } {
  return {
    requestId: res.locals.requestId,
    correlationId: res.locals.correlationId,
    timestamp: new Date().toISOString(),
  };
}

function readPathParam(value: string | string[] | undefined, name: string): string {
  if (!value) {
    throw new ApiError("VALIDATION_ERROR", `Missing required path parameter: ${name}`, 400);
  }

  // Express can expose repeated path params as arrays; this API contract expects a single value.
  return Array.isArray(value) ? value[0] : value;
}

// POST /journeys - Create new checkout journey.
// Returns 201 with initialized journey and step state.
checkoutRouter.post("/journeys", (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = requestContext(res);
    const journey = checkoutService.createJourney({
      customerId: req.body?.customerId,
      currency: req.body?.currency,
      locale: req.body?.locale,
    });

    res.status(201).json({
      data: journey,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      timestamp: ctx.timestamp,
    });
  } catch (error) {
    next(error);
  }
});

checkoutRouter.get("/journeys/:journeyId", (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = requestContext(res);
    const journeyId = readPathParam(req.params.journeyId, "journeyId");
    const journey = checkoutService.getJourneyById(journeyId);

    res.status(200).json({
      data: journey,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      timestamp: ctx.timestamp,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /journeys/:journeyId/steps/:stepId - Update a journey step with payload.
// Enforces step routing, integrates rules service for policy checks, updates journey status.
checkoutRouter.patch("/journeys/:journeyId/steps/:stepId", (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = requestContext(res);
    const journeyId = readPathParam(req.params.journeyId, "journeyId");
    const stepId = readPathParam(req.params.stepId, "stepId");

    if (!CHECKOUT_STEP_IDS.includes(stepId as CheckoutStepId)) {
      throw new ApiError("VALIDATION_ERROR", `Unsupported stepId: ${stepId}`, 400);
    }

    // Step payloads are schema-light in MVP, but must always be an object for service processing.
    if (!req.body || typeof req.body.payload !== "object" || req.body.payload === null) {
      throw new ApiError("VALIDATION_ERROR", "payload object is required", 400);
    }

    const journey = checkoutService.updateJourneyStep(
      journeyId,
      stepId as CheckoutStepId,
      req.body.payload as Record<string, unknown>,
    );

    res.status(200).json({
      data: journey,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      timestamp: ctx.timestamp,
    });
  } catch (error) {
    next(error);
  }
});

// POST /journeys/:journeyId/validate - Check journey readiness and collect validation issues.
// Returns valid: true/false and issues list for client-side field-level feedback.
checkoutRouter.post("/journeys/:journeyId/validate", (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = requestContext(res);
    const journeyId = readPathParam(req.params.journeyId, "journeyId");
    const result = checkoutService.validateJourney(journeyId);

    res.status(200).json({
      data: result,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      timestamp: ctx.timestamp,
    });
  } catch (error) {
    next(error);
  }
});

// POST /journeys/:journeyId/submit - Orchestrate deterministic submit flow.
// Validates readiness, reserves inventory, authorizes payment, creates fulfillment.
// Returns 200 with submitted journey or deterministic error (409/503) per adapter scenario.
checkoutRouter.post("/journeys/:journeyId/submit", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = requestContext(res);
    const journeyId = readPathParam(req.params.journeyId, "journeyId");
    const journey = await checkoutService.submitJourney(journeyId);

    res.status(200).json({
      data: journey,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      timestamp: ctx.timestamp,
    });
  } catch (error) {
    next(error);
  }
});
