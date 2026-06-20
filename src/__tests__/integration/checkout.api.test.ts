import type { Express } from "express";
import request from "supertest";

function withMockEnv(overrides: Record<string, string>): void {
  process.env.MOCK_MODE = "true";
  process.env.MOCK_INVENTORY_DELAY_MS = "0";
  process.env.MOCK_PAYMENT_DELAY_MS = "0";
  process.env.MOCK_FULFILLMENT_DELAY_MS = "0";
  process.env.MOCK_INVENTORY_SCENARIO = overrides.MOCK_INVENTORY_SCENARIO ?? "success";
  process.env.MOCK_PAYMENT_SCENARIO = overrides.MOCK_PAYMENT_SCENARIO ?? "success";
  process.env.MOCK_FULFILLMENT_SCENARIO = overrides.MOCK_FULFILLMENT_SCENARIO ?? "success";
}

function loadApp(overrides: Record<string, string> = {}): ReturnType<typeof request> {
  withMockEnv(overrides);
  jest.resetModules();

  let createApp: () => Express;
  jest.isolateModules(() => {
    const appModule = require("../../app") as { createApp: () => Express };
    createApp = appModule.createApp;
  });

  return request(createApp!());
}

async function createJourneyAndCompleteRequiredSteps(
  app: ReturnType<typeof request>,
  headers: Record<string, string>,
): Promise<string> {
  const createResponse = await app.post("/v1/checkout/journeys").set(headers).send({
    customerId: "cust-1001",
    currency: "USD",
    locale: "en-US",
  });

  const journeyId = createResponse.body.data.id as string;

  await app.patch(`/v1/checkout/journeys/${journeyId}/steps/cart`).set(headers).send({
    payload: {
      items: [{ sku: "SKU-100", name: "Demo Item", quantity: 1, unitPrice: 129.99 }],
      totalAmount: 129.99,
    },
  });

  await app.patch(`/v1/checkout/journeys/${journeyId}/steps/shipping-address`).set(headers).send({
    payload: {
      firstName: "Sam",
      lastName: "Taylor",
      line1: "101 Main St",
      city: "Austin",
      state: "TX",
      postalCode: "78701",
      country: "US",
    },
  });

  await app.patch(`/v1/checkout/journeys/${journeyId}/steps/delivery-method`).set(headers).send({
    payload: { method: "standard" },
  });

  await app.patch(`/v1/checkout/journeys/${journeyId}/steps/payment-method`).set(headers).send({
    payload: { method: "card", cardLast4: "4242" },
  });

  await app.patch(`/v1/checkout/journeys/${journeyId}/steps/review-submit`).set(headers).send({
    payload: { confirmed: true },
  });

  return journeyId;
}

describe("Checkout API integration", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("completes the happy path and propagates request and correlation IDs", async () => {
    const app = loadApp();
    const headers = {
      "x-request-id": "req-happy-1",
      "x-correlation-id": "corr-happy-1",
    };

    const journeyId = await createJourneyAndCompleteRequiredSteps(app, headers);

    const validateResponse = await app
      .post(`/v1/checkout/journeys/${journeyId}/validate`)
      .set(headers)
      .send({});

    expect(validateResponse.status).toBe(200);
    expect(validateResponse.body.data.valid).toBe(true);
    expect(validateResponse.body.requestId).toBe("req-happy-1");
    expect(validateResponse.body.correlationId).toBe("corr-happy-1");

    const submitResponse = await app
      .post(`/v1/checkout/journeys/${journeyId}/submit`)
      .set(headers)
      .send({});

    expect(submitResponse.status).toBe(200);
    expect(submitResponse.body.data.status).toBe("submitted");
    expect(submitResponse.body.data.submittedOrderId).toMatch(/^ship_/);
    expect(submitResponse.body.requestId).toBe("req-happy-1");
    expect(submitResponse.body.correlationId).toBe("corr-happy-1");
    expect(submitResponse.body.timestamp).toBeTruthy();
  });

  it("returns deterministic payment declined error envelope", async () => {
    const app = loadApp({ MOCK_PAYMENT_SCENARIO: "declined" });
    const headers = {
      "x-request-id": "req-pay-declined",
      "x-correlation-id": "corr-pay-declined",
    };

    const journeyId = await createJourneyAndCompleteRequiredSteps(app, headers);

    const response = await app.post(`/v1/checkout/journeys/${journeyId}/submit`).set(headers).send({});

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("PAYMENT_DECLINED");
    expect(response.body.message).toBeTruthy();
    expect(response.body.requestId).toBe("req-pay-declined");
    expect(response.body.correlationId).toBe("corr-pay-declined");
    expect(response.body.timestamp).toBeTruthy();
  });

  it("returns deterministic inventory unavailable error envelope", async () => {
    const app = loadApp({ MOCK_INVENTORY_SCENARIO: "out_of_stock" });
    const headers = {
      "x-request-id": "req-inv-unavailable",
      "x-correlation-id": "corr-inv-unavailable",
    };

    const journeyId = await createJourneyAndCompleteRequiredSteps(app, headers);

    const response = await app.post(`/v1/checkout/journeys/${journeyId}/submit`).set(headers).send({});

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("INVENTORY_UNAVAILABLE");
    expect(response.body.message).toBeTruthy();
    expect(response.body.requestId).toBe("req-inv-unavailable");
    expect(response.body.correlationId).toBe("corr-inv-unavailable");
    expect(response.body.timestamp).toBeTruthy();
  });

  it("returns deterministic fulfillment timeout error envelope", async () => {
    const app = loadApp({ MOCK_FULFILLMENT_SCENARIO: "timeout" });
    const headers = {
      "x-request-id": "req-ful-timeout",
      "x-correlation-id": "corr-ful-timeout",
    };

    const journeyId = await createJourneyAndCompleteRequiredSteps(app, headers);

    const response = await app.post(`/v1/checkout/journeys/${journeyId}/submit`).set(headers).send({});

    expect(response.status).toBe(503);
    expect(response.body.code).toBe("FULFILLMENT_TIMEOUT");
    expect(response.body.message).toBeTruthy();
    expect(response.body.requestId).toBe("req-ful-timeout");
    expect(response.body.correlationId).toBe("corr-ful-timeout");
    expect(response.body.timestamp).toBeTruthy();
  });

  it("reports health as degraded when any scenario is non-success", async () => {
    const app = loadApp({ MOCK_PAYMENT_SCENARIO: "declined" });
    const response = await app.get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("degraded");
    expect(response.body.checks.payment.scenario).toBe("declined");
    expect(response.body.requestId).toBeTruthy();
    expect(response.body.correlationId).toBeTruthy();
  });
});
