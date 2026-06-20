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
import { createRulesService, type RulesService } from "./rules.service";
import { ApiError } from "../types/api-error";
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

  createJourney(input: CreateJourneyInput): CheckoutJourney {
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

    return this.store.create(journey);
  }

  getJourneyById(journeyId: string): CheckoutJourney {
    const journey = this.store.getById(journeyId);
    if (!journey) {
      throw new ApiError("JOURNEY_NOT_FOUND", "Checkout journey was not found", 404);
    }

    return journey;
  }

  updateJourneyStep(
    journeyId: string,
    stepId: CheckoutStepId,
    payload: Record<string, unknown>,
  ): CheckoutJourney {
    const journey = this.getJourneyById(journeyId);

    const rulesResult = this.rulesService.evaluateForStepUpdate(journey, stepId, payload);
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

    return this.store.update(nextJourney);
  }

  validateJourney(journeyId: string): { valid: boolean; issues: ValidationIssue[] } {
    const journey = this.getJourneyById(journeyId);
    const rulesResult = this.rulesService.evaluateForValidate(journey);
    const issues = [...this.computeValidationIssues(journey), ...rulesResult.issues];

    return {
      valid: issues.every((issue) => issue.severity === "warning"),
      issues,
    };
  }

  async submitJourney(journeyId: string): Promise<CheckoutJourney> {
    const journey = this.getJourneyById(journeyId);
    const validationResult = this.validateJourney(journeyId);

    const submitRulesResult = this.rulesService.evaluateForSubmit(journey);
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

    const inventoryReservation = await this.inventoryAdapter.reserveItems({
      journeyId,
      items,
    });

    if (!inventoryReservation.reserved) {
      throw new ApiError("INVENTORY_UNAVAILABLE", "Inventory is unavailable for one or more items", 409);
    }

    const paymentAuthorization = await this.paymentAdapter.authorize({
      journeyId,
      amount: Number(cartPayload.totalAmount ?? 0),
      currency: "USD",
      method: String(paymentPayload.method ?? "unknown"),
    });

    if (!paymentAuthorization.authorized) {
      throw new ApiError("PAYMENT_DECLINED", "Payment authorization failed", 409);
    }

    const fulfillmentResult = await this.fulfillmentAdapter.createShipment({
      journeyId,
      customerId: journey.customerId,
      destinationCountry: String(shippingPayload.country ?? "US"),
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

    return this.store.update(submittedJourney);
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
