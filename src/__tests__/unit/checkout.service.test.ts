import { CheckoutService } from "../../services/checkout.service";
import { InMemoryJourneysStore } from "../../data/journeys.store";
import type { FulfillmentAdapter } from "../../adapters/fulfillment.adapter";
import type { InventoryAdapter } from "../../adapters/inventory.adapter";
import type { PaymentAdapter } from "../../adapters/payment.adapter";
import { ApiError } from "../../types/api-error";

function createService(overrides?: {
  inventory?: InventoryAdapter;
  payment?: PaymentAdapter;
  fulfillment?: FulfillmentAdapter;
}): CheckoutService {
  const inventory: InventoryAdapter =
    overrides?.inventory ??
    ({
      reserveItems: jest.fn().mockResolvedValue({ reserved: true, reservationId: "inv_res_default" }),
    } as InventoryAdapter);

  const payment: PaymentAdapter =
    overrides?.payment ??
    ({
      authorize: jest.fn().mockResolvedValue({ authorized: true, transactionId: "pay_txn_default" }),
    } as PaymentAdapter);

  const fulfillment: FulfillmentAdapter =
    overrides?.fulfillment ??
    ({
      createShipment: jest.fn().mockResolvedValue({ accepted: true, shipmentId: "ship_default" }),
    } as FulfillmentAdapter);

  return new CheckoutService(new InMemoryJourneysStore(), inventory, payment, fulfillment);
}

function completeRequiredSteps(service: CheckoutService, journeyId: string): void {
  service.updateJourneyStep(journeyId, "cart", {
    items: [{ sku: "SKU-100", quantity: 1 }],
    totalAmount: 129.99,
  });
  service.updateJourneyStep(journeyId, "shipping-address", {
    line1: "101 Main St",
    city: "Austin",
    state: "TX",
    postalCode: "78701",
    country: "US",
  });
  service.updateJourneyStep(journeyId, "delivery-method", { method: "standard" });
  service.updateJourneyStep(journeyId, "payment-method", { method: "card", cardLast4: "4242" });
  service.updateJourneyStep(journeyId, "review-submit", { confirmed: true });
}

describe("CheckoutService", () => {
  it("creates a journey with initiated status and empty steps", () => {
    const service = createService();

    const journey = service.createJourney({
      customerId: "cust-1001",
      currency: "USD",
      locale: "en-US",
    });

    expect(journey.status).toBe("initiated");
    expect(journey.steps.cart.completed).toBe(false);
    expect(journey.steps["review-submit"].completed).toBe(false);
  });

  it("enforces step prerequisites", () => {
    const service = createService();
    const journey = service.createJourney({ customerId: "cust-1001", currency: "USD" });

    expect(() =>
      service.updateJourneyStep(journey.id, "shipping-address", {
        line1: "101 Main St",
      }),
    ).toThrow(ApiError);

    try {
      service.updateJourneyStep(journey.id, "shipping-address", { line1: "101 Main St" });
    } catch (err) {
      const apiError = err as ApiError;
      expect(apiError.code).toBe("STEP_CONFLICT");
      expect(apiError.status).toBe(409);
    }
  });

  it("transitions to ready_for_submit after required steps are completed", () => {
    const service = createService();
    const journey = service.createJourney({ customerId: "cust-1001", currency: "USD" });

    completeRequiredSteps(service, journey.id);

    const updated = service.getJourneyById(journey.id);
    expect(updated.status).toBe("ready_for_submit");
    expect(updated.steps["review-submit"].completed).toBe(true);
  });

  it("returns validation issues for missing required steps", () => {
    const service = createService();
    const journey = service.createJourney({ customerId: "cust-1001", currency: "USD" });

    service.updateJourneyStep(journey.id, "cart", {
      items: [{ sku: "SKU-100", quantity: 1 }],
      totalAmount: 129.99,
    });

    const validation = service.validateJourney(journey.id);

    expect(validation.valid).toBe(false);
    expect(validation.issues.length).toBeGreaterThan(0);
    expect(validation.issues.some((issue) => issue.stepId === "shipping-address")).toBe(true);
  });

  it("submits a ready journey on happy path", async () => {
    const service = createService();
    const journey = service.createJourney({ customerId: "cust-1001", currency: "USD" });

    completeRequiredSteps(service, journey.id);

    const submitted = await service.submitJourney(journey.id);

    expect(submitted.status).toBe("submitted");
    expect(submitted.submittedOrderId).toBe("ship_default");
  });

  it("returns deterministic degraded error when inventory is unavailable", async () => {
    const inventoryUnavailable: InventoryAdapter = {
      reserveItems: jest.fn().mockResolvedValue({ reserved: false, unavailableSkus: ["SKU-100"] }),
    };

    const service = createService({ inventory: inventoryUnavailable });
    const journey = service.createJourney({ customerId: "cust-1001", currency: "USD" });
    completeRequiredSteps(service, journey.id);

    await expect(service.submitJourney(journey.id)).rejects.toMatchObject({
      code: "INVENTORY_UNAVAILABLE",
      status: 409,
    });
  });
});
