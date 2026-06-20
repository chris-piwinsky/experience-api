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
import { ApiError } from "../types/api-error";
import {
  createInitialSteps,
  type CheckoutJourney,
  type CheckoutStatus,
  type CheckoutStepId,
  type CreateJourneyInput,
  type ValidationIssue,
} from "../types/checkout";

const STEP_PREREQUISITES: Partial<Record<CheckoutStepId, CheckoutStepId[]>> = {
  "shipping-address": ["cart"],
  "delivery-method": ["shipping-address"],
  "payment-method": ["delivery-method"],
  "billing-address": ["payment-method"],
  "promo-code": ["cart"],
  "review-submit": ["cart", "shipping-address", "delivery-method", "payment-method"],
};

export class CheckoutService {
  constructor(
    private readonly store: JourneysStore,
    private readonly inventoryAdapter: InventoryAdapter,
    private readonly paymentAdapter: PaymentAdapter,
    private readonly fulfillmentAdapter: FulfillmentAdapter,
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

    this.assertStepPrerequisites(journey, stepId);

    const now = new Date().toISOString();
    const nextJourney: CheckoutJourney = {
      ...journey,
      steps: {
        ...journey.steps,
        [stepId]: {
          completed: true,
          payload,
          updatedAt: now,
        },
      },
      validationIssues: [],
      status: this.computeJourneyStatus({
        ...journey,
        steps: {
          ...journey.steps,
          [stepId]: {
            completed: true,
            payload,
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
    const issues = this.computeValidationIssues(journey);

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  async submitJourney(journeyId: string): Promise<CheckoutJourney> {
    const journey = this.getJourneyById(journeyId);
    const validationResult = this.validateJourney(journeyId);

    // Validation issues are flattened into API error details so clients can render field-level messages.
    if (!validationResult.valid) {
      throw new ApiError(
        "VALIDATION_ERROR",
        "Checkout journey is not ready for submit",
        400,
        validationResult.issues.map((issue) => ({
          field: issue.fieldPath,
          reason: issue.message,
        })),
      );
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

  private assertStepPrerequisites(journey: CheckoutJourney, stepId: CheckoutStepId): void {
    const requiredSteps = STEP_PREREQUISITES[stepId] ?? [];

    // Prerequisite guard keeps step progression deterministic and prevents partial submit state.
    for (const requiredStep of requiredSteps) {
      if (!journey.steps[requiredStep].completed) {
        throw new ApiError(
          "STEP_CONFLICT",
          `${requiredStep} must be completed before ${stepId}`,
          409,
        );
      }
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
}

export function createCheckoutService(
  store: JourneysStore = new InMemoryJourneysStore(),
  inventoryAdapter: InventoryAdapter = createInventoryAdapter(),
  paymentAdapter: PaymentAdapter = createPaymentAdapter(),
  fulfillmentAdapter: FulfillmentAdapter = createFulfillmentAdapter(),
): CheckoutService {
  return new CheckoutService(store, inventoryAdapter, paymentAdapter, fulfillmentAdapter);
}
