# Quickstart

This guide gets the service running locally and verifies the checkout journey end to end.

## Prerequisites

- Node.js 20+
- npm 10+

## 1) Install dependencies

```bash
npm install
```

## 2) Configure environment

Copy .env.example values into your shell or .env workflow.

Required runtime variables:

- PORT=3000
- MOCK_MODE=true
- MOCK_INVENTORY_SCENARIO=success
- MOCK_PAYMENT_SCENARIO=success
- MOCK_FULFILLMENT_SCENARIO=success
- MOCK_INVENTORY_DELAY_MS=0
- MOCK_PAYMENT_DELAY_MS=0
- MOCK_FULFILLMENT_DELAY_MS=0

## 3) Build and start

```bash
npm run build
npm start
```

For live development:

```bash
npm run dev
```

## 4) Verify health

```bash
curl -s http://localhost:3000/health
```

Expected with all success scenarios:

- status is ok
- checks.inventory.status is ok
- checks.payment.status is ok
- checks.fulfillment.status is ok

## 5) Create a checkout journey

```bash
curl -s -X POST http://localhost:3000/v1/checkout/journeys \
  -H 'content-type: application/json' \
  -H 'x-request-id: req-quickstart-1' \
  -H 'x-correlation-id: corr-quickstart-1' \
  -d '{
    "customerId": "cust-1001",
    "currency": "USD",
    "locale": "en-US"
  }'
```

Expected:

- HTTP 201
- response contains data.id
- response contains requestId and correlationId

## 6) Continue the journey

Use the returned journey id and call:

- PATCH /v1/checkout/journeys/{journeyId}/steps/cart
- PATCH /v1/checkout/journeys/{journeyId}/steps/shipping-address
- PATCH /v1/checkout/journeys/{journeyId}/steps/delivery-method
- PATCH /v1/checkout/journeys/{journeyId}/steps/payment-method
- PATCH /v1/checkout/journeys/{journeyId}/steps/review-submit
- POST /v1/checkout/journeys/{journeyId}/validate
- POST /v1/checkout/journeys/{journeyId}/submit

Reference sample payloads in ../checkout-journey-execution-plan.md.
