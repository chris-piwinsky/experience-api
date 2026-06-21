import { randomUUID } from "crypto";

import {
  createFulfillmentAdapter,
  type FulfillmentAdapter,
} from "../adapters/fulfillment.adapter";
import {
  createInventoryAdapter,
  type InventoryAdapter,
} from "../adapters/inventory.adapter";
import {
  createPaymentAdapter,
  type PaymentAdapter,
} from "../adapters/payment.adapter";
import { InMemoryJourneysStore, type JourneysStore } from "../data/journeys.store";
import { logFlowError, logFlowStage, type FlowLogContext } from "../middleware/flow-logger";
import { createRulesService, type RulesService } from "./rules.service";
import { ApiError } from "../types/api-error";

// Service layer orchestrating checkout journey lifecycle.
// Coordinates step updates, validation, rules evaluation, and submit orchestration.
// Delegates storage to JourneysStore and dependency calls to adapters.
import {
  createInitialSteps,
  type CheckoutJourney,
  type CheckoutStatus,
  type CheckoutStepId,
  type CreateJourneyInput,
  type ValidationIssue,
} from "../types/checkout";

export class CheckoutService {
  constructor(
    private readonly store: JourneysStore,
    private readonly inventoryAdapter: InventoryAdapter,
    private readonly paymentAdapter: PaymentAdapter,
    private readonly fulfillmentAdapter: FulfillmentAdapter,
    private readonly rulesService: RulesService = createRulesService(),
  ) {}

  createJourney(input: CreateJourneyInput, trace: FlowLogContext = {}): CheckoutJourney {
    logFlowStage("service.create_journey.start", trace);

    if (!input.customerId || !input.currency) {
      throw new ApiError("VALIDATION_ERROR", "customerId and currency are required", 400);
    }

    const now = new Date().toISOString();
    const journey: CheckoutJourney = {
      id: randomUUID(),
      customerId: input.customerId,
      status: "initiated",
      steps: createInitialSteps(),
      validationIssues: [],
      submittedOrderId: null,
      createdAt: now,
      updatedAt: now,
    };

    const createdJourney = this.store.create(journey);
    logFlowStage("service.create_journey.completed", { ...trace, journeyId: createdJourney.id });
    return createdJourney;
  }

  getJourneyById(journeyId: string, trace: FlowLogContext = {}): CheckoutJourney {
    logFlowStage("service.get_journey.start", { ...trace, journeyId });

    const journey = this.store.getById(journeyId);
    if (!journey) {
      throw new ApiError("JOURNEY_NOT_FOUND", "Checkout journey was not found", 404);
    }

    logFlowStage("service.get_journey.completed", { ...trace, journeyId });
    return journey;
  }

  // Update a step's payload and apply rules-based policy checks.
  // Rules service validates step prerequisites, field constraints, and eligibility.
  // Throws on blocking issues; includes warnings in journey state.
  updateJourneyStep(
    journeyId: string,
    stepId: CheckoutStepId,
    payload: Record<string, unknown>,
    trace: FlowLogContext = {},
  ): CheckoutJourney {
    // Scope extends request trace with domain identifiers so downstream stage events stay self-describing.
    const scope = { ...trace, journeyId, stepId };
    logFlowStage("service.update_step.start", scope);

    const journey = this.getJourneyById(journeyId, scope);

    logFlowStage("service.rules.step_update.start", scope);
    const rulesResult = this.rulesService.evaluateForStepUpdate(journey, stepId, payload);
    logFlowStage("service.rules.step_update.completed", scope, { issueCount: rulesResult.issues.length });
    this.assertBlockingIssues(rulesResult.issues);
    const nextValidationIssues = rulesResult.issues.filter((issue) => issue.severity === "warning");

    const now = new Date().toISOString();
    const nextJourney: CheckoutJourney = {
      ...journey,
      steps: {
        ...journey.steps,
        [stepId]: {
          completed: true,
          payload: rulesResult.nextPayload,
          updatedAt: now,
        },
      },
      validationIssues: nextValidationIssues,
      status: this.computeJourneyStatus({
        ...journey,
        steps: {
          ...journey.steps,
          [stepId]: {
            completed: true,
            payload: rulesResult.nextPayload,
            updatedAt: now,
          },
        },
      }),
      updatedAt: now,
    };

    const updatedJourney = this.store.update(nextJourney);
    logFlowStage("service.update_step.completed", scope, { status: updatedJourney.status });
    return updatedJourney;
  }

  validateJourney(journeyId: string, trace: FlowLogContext = {}): { valid: boolean; issues: ValidationIssue[] } {
    const scope = { ...trace, journeyId };
    logFlowStage("service.validate_journey.start", scope);

    const journey = this.getJourneyById(journeyId, scope);
    logFlowStage("service.rules.validate.start", scope);
    const rulesResult = this.rulesService.evaluateForValidate(journey);
    logFlowStage("service.rules.validate.completed", scope, { issueCount: rulesResult.issues.length });
    const issues = [...this.computeValidationIssues(journey), ...rulesResult.issues];

    const result = {
      valid: issues.every((issue) => issue.severity === "warning"),
      issues,
    };

    logFlowStage("service.validate_journey.completed", scope, {
      valid: result.valid,
      issueCount: result.issues.length,
    });

    return result;
  }

  // Orchestrate submit: validate readiness, apply final rules, then call adapters in sequence.
  // Sequence: inventory reserve -> payment authorize -> fulfillment create.
  // Deterministic failures from adapters are mapped to stable error codes (409/503).
  // Async due to adapter latency and optional artificial delays in mock scenarios.
  async submitJourney(journeyId: string, trace: FlowLogContext = {}): Promise<CheckoutJourney> {
    // Submit has the richest architecture path, so we keep explicit stage logs per policy check and adapter hop.
    const scope = { ...trace, journeyId };
    logFlowStage("service.submit_journey.start", scope);

    try {
      const journey = this.getJourneyById(journeyId, scope);
      const validationResult = this.validateJourney(journeyId, scope);

      logFlowStage("service.rules.submit.start", scope);
      const submitRulesResult = this.rulesService.evaluateForSubmit(journey);
      logFlowStage("service.rules.submit.completed", scope, { issueCount: submitRulesResult.issues.length });

      const submitBlockingIssues = submitRulesResult.issues.filter((issue) => issue.severity !== "warning");
      if (submitBlockingIssues.length > 0) {
        this.throwFromIssues("Checkout journey failed policy checks before submit", submitBlockingIssues);
      }

      // Validation issues are flattened into API error details so clients can render field-level messages.
      if (!validationResult.valid) {
        this.throwFromIssues("Checkout journey is not ready for submit", validationResult.issues);
      }

      const cartPayload = (journey.steps.cart.payload ?? {}) as Record<string, unknown>;
      const paymentPayload = (journey.steps["payment-method"].payload ?? {}) as Record<string, unknown>;
      const shippingPayload = (journey.steps["shipping-address"].payload ?? {}) as Record<string, unknown>;

      // Submit orchestration uses minimal payload shape to keep adapters isolated from route body details.
      const items = Array.isArray(cartPayload.items)
        ? (cartPayload.items as Array<{ sku: string; quantity: number }>).map((item) => ({
            sku: item.sku,
            quantity: item.quantity,
          }))
        : [];

      logFlowStage("service.adapter.inventory.reserve.start", scope, { itemCount: items.length });
      const inventoryReservation = await this.inventoryAdapter.reserveItems({
        journeyId,
        items,
      });
      logFlowStage("service.adapter.inventory.reserve.completed", scope, {
        reserved: inventoryReservation.reserved,
      });

      if (!inventoryReservation.reserved) {
        throw new ApiError("INVENTORY_UNAVAILABLE", "Inventory is unavailable for one or more items", 409);
      }

      logFlowStage("service.adapter.payment.authorize.start", scope, {
        amount: Number(cartPayload.totalAmount ?? 0),
      });
      const paymentAuthorization = await this.paymentAdapter.authorize({
        journeyId,
        amount: Number(cartPayload.totalAmount ?? 0),
        currency: "USD",
        method: String(paymentPayload.method ?? "unknown"),
      });
      logFlowStage("service.adapter.payment.authorize.completed", scope, {
        authorized: paymentAuthorization.authorized,
      });

      if (!paymentAuthorization.authorized) {
        throw new ApiError("PAYMENT_DECLINED", "Payment authorization failed", 409);
      }

      logFlowStage("service.adapter.fulfillment.create_shipment.start", scope, {
        destinationCountry: String(shippingPayload.country ?? "US"),
      });
      const fulfillmentResult = await this.fulfillmentAdapter.createShipment({
        journeyId,
        customerId: journey.customerId,
        destinationCountry: String(shippingPayload.country ?? "US"),
      });
      logFlowStage("service.adapter.fulfillment.create_shipment.completed", scope, {
        accepted: fulfillmentResult.accepted,
      });

      if (!fulfillmentResult.accepted) {
        // Defensive mapping for any non-timeout negative fulfillment outcome.
        throw new ApiError("DEPENDENCY_FAILURE", "Fulfillment did not accept shipment", 503);
      }

      const now = new Date().toISOString();
      const submittedJourney: CheckoutJourney = {
        ...journey,
        status: "submitted",
        submittedOrderId: fulfillmentResult.shipmentId ?? randomUUID(),
        validationIssues: [],
        updatedAt: now,
      };

      const storedJourney = this.store.update(submittedJourney);
      logFlowStage("service.submit_journey.completed", scope, {
        submittedOrderId: storedJourney.submittedOrderId,
      });
      return storedJourney;
    } catch (error) {
      logFlowError("service.submit_journey.error", scope, error);
      throw error;
    }
  }

  private computeJourneyStatus(journey: CheckoutJourney): CheckoutStatus {
    if (journey.status === "submitted" || journey.status === "failed") {
      return journey.status;
    }

    const requiredForSubmit: CheckoutStepId[] = [
      "cart",
      "shipping-address",
      "delivery-method",
      "payment-method",
      "review-submit",
    ];

    const isReady = requiredForSubmit.every((step) => journey.steps[step].completed);
    if (isReady) {
      return "ready_for_submit";
    }

    // Any completed step moves status out of initiated even when submit requirements are not satisfied.
    const hasAnyCompleted = Object.values(journey.steps).some((step) => step.completed);
    return hasAnyCompleted ? "in_progress" : "initiated";
  }

  private computeValidationIssues(journey: CheckoutJourney): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const requiredForSubmit: CheckoutStepId[] = [
      "cart",
      "shipping-address",
      "delivery-method",
      "payment-method",
      "review-submit",
    ];

    for (const step of requiredForSubmit) {
      if (!journey.steps[step].completed) {
        issues.push({
          code: "VALIDATION_ERROR",
          message: `${step} must be completed before submit`,
          stepId: step,
          fieldPath: `steps.${step}`,
          severity: "error",
        });
      }
    }

    return issues;
  }

  private assertBlockingIssues(issues: ValidationIssue[]): void {
    const blockingIssues = issues.filter((issue) => issue.severity !== "warning");
    if (blockingIssues.length > 0) {
      this.throwFromIssues("Checkout step update failed policy checks", blockingIssues);
    }
  }

  private throwFromIssues(message: string, issues: ValidationIssue[]): never {
    const blockingIssues = issues.filter((issue) => issue.severity !== "warning");
    const firstIssue = blockingIssues[0] ?? issues[0];
    const code = firstIssue?.code ?? "VALIDATION_ERROR";
    const status = this.statusForCode(code);

    throw new ApiError(
      code,
      firstIssue?.message ?? message,
      status,
      issues.map((issue) => ({
        field: issue.fieldPath,
        reason: `${issue.ruleId ? `${issue.ruleId}: ` : ""}${issue.message}`,
      })),
    );
  }

  private statusForCode(code: string): number {
    if (code === "VALIDATION_ERROR") {
      return 400;
    }
    if (code === "RULES_CONFIG_ERROR") {
      return 503;
    }
    if (code === "STEP_CONFLICT" || code === "CUSTOMER_NOT_ELIGIBLE") {
      return 409;
    }

    return 400;
  }
}

export function createCheckoutService(
  store: JourneysStore = new InMemoryJourneysStore(),
  inventoryAdapter: InventoryAdapter = createInventoryAdapter(),
  paymentAdapter: PaymentAdapter = createPaymentAdapter(),
  fulfillmentAdapter: FulfillmentAdapter = createFulfillmentAdapter(),
  rulesService: RulesService = createRulesService(),
): CheckoutService {
  return new CheckoutService(store, inventoryAdapter, paymentAdapter, fulfillmentAdapter, rulesService);
}
