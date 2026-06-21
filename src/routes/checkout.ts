import { Router, type Request, type Response, type NextFunction } from "express";

import { logFlowError, logFlowStage } from "../middleware/flow-logger";
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
    // Route-stage events mark entry/exit boundaries so demos can map requests to architecture layers.
    logFlowStage("route.create_journey.enter", {
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      method: req.method,
      route: req.originalUrl,
    });

    const journey = checkoutService.createJourney({
      customerId: req.body?.customerId,
      currency: req.body?.currency,
      locale: req.body?.locale,
    }, {
      // Forward the same trace context into the service so route and service logs can be correlated.
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      method: req.method,
      route: req.originalUrl,
    });

    logFlowStage("route.create_journey.response", {
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      method: req.method,
      route: req.originalUrl,
      journeyId: journey.id,
    });

    res.status(201).json({
      data: journey,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      timestamp: ctx.timestamp,
    });
  } catch (error) {
    const ctx = requestContext(res);
    logFlowError(
      "route.create_journey.error",
      {
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        method: req.method,
        route: req.originalUrl,
      },
      error,
    );
    next(error);
  }
});

checkoutRouter.get("/journeys/:journeyId", (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = requestContext(res);
    const journeyId = readPathParam(req.params.journeyId, "journeyId");
    logFlowStage("route.get_journey.enter", {
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      method: req.method,
      route: req.originalUrl,
      journeyId,
    });

    const journey = checkoutService.getJourneyById(journeyId, {
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      method: req.method,
      route: req.originalUrl,
      journeyId,
    });

    logFlowStage("route.get_journey.response", {
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      method: req.method,
      route: req.originalUrl,
      journeyId,
    });

    res.status(200).json({
      data: journey,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      timestamp: ctx.timestamp,
    });
  } catch (error) {
    const ctx = requestContext(res);
    logFlowError(
      "route.get_journey.error",
      {
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        method: req.method,
        route: req.originalUrl,
        journeyId: req.params.journeyId,
      },
      error,
    );
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
    logFlowStage("route.update_step.enter", {
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      method: req.method,
      route: req.originalUrl,
      journeyId,
      stepId,
    });

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
      {
        // Include journey and step identifiers so stage logs can pinpoint exactly where flow paused.
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        method: req.method,
        route: req.originalUrl,
        journeyId,
        stepId,
      },
    );

    logFlowStage("route.update_step.response", {
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      method: req.method,
      route: req.originalUrl,
      journeyId,
      stepId,
    });

    res.status(200).json({
      data: journey,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      timestamp: ctx.timestamp,
    });
  } catch (error) {
    const ctx = requestContext(res);
    logFlowError(
      "route.update_step.error",
      {
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        method: req.method,
        route: req.originalUrl,
        journeyId: req.params.journeyId,
        stepId: req.params.stepId,
      },
      error,
    );
    next(error);
  }
});

// POST /journeys/:journeyId/validate - Check journey readiness and collect validation issues.
// Returns valid: true/false and issues list for client-side field-level feedback.
checkoutRouter.post("/journeys/:journeyId/validate", (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = requestContext(res);
    const journeyId = readPathParam(req.params.journeyId, "journeyId");
    logFlowStage("route.validate_journey.enter", {
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      method: req.method,
      route: req.originalUrl,
      journeyId,
    });

    const result = checkoutService.validateJourney(journeyId, {
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      method: req.method,
      route: req.originalUrl,
      journeyId,
    });

    logFlowStage("route.validate_journey.response", {
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      method: req.method,
      route: req.originalUrl,
      journeyId,
    }, {
      issueCount: result.issues.length,
      valid: result.valid,
    });

    res.status(200).json({
      data: result,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      timestamp: ctx.timestamp,
    });
  } catch (error) {
    const ctx = requestContext(res);
    logFlowError(
      "route.validate_journey.error",
      {
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        method: req.method,
        route: req.originalUrl,
        journeyId: req.params.journeyId,
      },
      error,
    );
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
    logFlowStage("route.submit_journey.enter", {
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      method: req.method,
      route: req.originalUrl,
      journeyId,
    });

    const journey = await checkoutService.submitJourney(journeyId, {
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      method: req.method,
      route: req.originalUrl,
      journeyId,
    });

    logFlowStage("route.submit_journey.response", {
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      method: req.method,
      route: req.originalUrl,
      journeyId,
    }, {
      submittedOrderId: journey.submittedOrderId,
    });

    res.status(200).json({
      data: journey,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      timestamp: ctx.timestamp,
    });
  } catch (error) {
    const ctx = requestContext(res);
    logFlowError(
      "route.submit_journey.error",
      {
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        method: req.method,
        route: req.originalUrl,
        journeyId: req.params.journeyId,
      },
      error,
    );
    next(error);
  }
});
