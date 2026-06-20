import { MockFulfillmentAdapter } from "../../adapters/fulfillment.adapter";
import { MockInventoryAdapter } from "../../adapters/inventory.adapter";
import { MockPaymentAdapter } from "../../adapters/payment.adapter";

describe("Mock adapters", () => {
  it("inventory success returns deterministic reservation id", async () => {
    const adapter = new MockInventoryAdapter({
      mockMode: true,
      inventoryScenario: "success",
      paymentScenario: "success",
      fulfillmentScenario: "success",
      inventoryDelayMs: 0,
      paymentDelayMs: 0,
      fulfillmentDelayMs: 0,
    });

    const result = await adapter.reserveItems({
      journeyId: "journey-123",
      items: [{ sku: "SKU-100", quantity: 1 }],
    });

    expect(result).toEqual({
      reserved: true,
      reservationId: "inv_res_journey-123",
    });
  });

  it("inventory out_of_stock returns deterministic unavailable sku", async () => {
    const adapter = new MockInventoryAdapter({
      mockMode: true,
      inventoryScenario: "out_of_stock",
      paymentScenario: "success",
      fulfillmentScenario: "success",
      inventoryDelayMs: 0,
      paymentDelayMs: 0,
      fulfillmentDelayMs: 0,
    });

    const result = await adapter.reserveItems({
      journeyId: "journey-123",
      items: [{ sku: "SKU-404", quantity: 1 }],
    });

    expect(result).toEqual({
      reserved: false,
      unavailableSkus: ["SKU-404"],
    });
  });

  it("payment declined returns deterministic decline reason", async () => {
    const adapter = new MockPaymentAdapter({
      mockMode: true,
      inventoryScenario: "success",
      paymentScenario: "declined",
      fulfillmentScenario: "success",
      inventoryDelayMs: 0,
      paymentDelayMs: 0,
      fulfillmentDelayMs: 0,
    });

    const result = await adapter.authorize({
      journeyId: "journey-123",
      amount: 129.99,
      currency: "USD",
      method: "card",
    });

    expect(result).toEqual({
      authorized: false,
      declineReason: "Mock payment decline scenario",
    });
  });

  it("fulfillment success returns deterministic shipment id", async () => {
    const adapter = new MockFulfillmentAdapter({
      mockMode: true,
      inventoryScenario: "success",
      paymentScenario: "success",
      fulfillmentScenario: "success",
      inventoryDelayMs: 0,
      paymentDelayMs: 0,
      fulfillmentDelayMs: 0,
    });

    const result = await adapter.createShipment({
      journeyId: "journey-123",
      customerId: "cust-1001",
      destinationCountry: "US",
    });

    expect(result).toEqual({
      accepted: true,
      shipmentId: "ship_journey-123",
    });
  });

  it("maps payment timeout to deterministic dependency failure error", async () => {
    const adapter = new MockPaymentAdapter({
      mockMode: true,
      inventoryScenario: "success",
      paymentScenario: "timeout",
      fulfillmentScenario: "success",
      inventoryDelayMs: 0,
      paymentDelayMs: 0,
      fulfillmentDelayMs: 0,
    });

    await expect(
      adapter.authorize({
        journeyId: "journey-123",
        amount: 129.99,
        currency: "USD",
        method: "card",
      }),
    ).rejects.toMatchObject({
      code: "DEPENDENCY_FAILURE",
      status: 503,
    });
  });

  it("maps fulfillment timeout to deterministic fulfillment timeout error", async () => {
    const adapter = new MockFulfillmentAdapter({
      mockMode: true,
      inventoryScenario: "success",
      paymentScenario: "success",
      fulfillmentScenario: "timeout",
      inventoryDelayMs: 0,
      paymentDelayMs: 0,
      fulfillmentDelayMs: 0,
    });

    await expect(
      adapter.createShipment({
        journeyId: "journey-123",
        customerId: "cust-1001",
        destinationCountry: "US",
      }),
    ).rejects.toMatchObject({
      code: "FULFILLMENT_TIMEOUT",
      status: 503,
    });
  });
});
