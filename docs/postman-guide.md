# Postman Setup and Scenario Testing Guide

This guide shows how to configure Postman and run all major API scenarios for the checkout journey service.

## Importable Postman Assets

- Collection: [postman/Customer-Experience-API.postman_collection.json](../postman/Customer-Experience-API.postman_collection.json)
- Environment: [postman/Local-Checkout-API.postman_environment.json](../postman/Local-Checkout-API.postman_environment.json)

Import both files into Postman, then select the Local Checkout API environment before running requests.

## Collection Sequence Diagram

```mermaid
sequenceDiagram
  participant U as User
  participant P as Postman Collection
  participant API as Checkout API

  U->>P: Run collection
  P->>API: POST create journey
  API-->>P: 201 with journeyId
  P->>P: Save journeyId in environment
  P->>API: PATCH cart
  P->>API: PATCH shipping-address
  P->>API: PATCH delivery-method
  P->>API: PATCH payment-method
  P->>API: PATCH billing-address
  P->>API: PATCH promo-code
  P->>API: POST validate
  P->>API: POST submit
  P->>API: GET health
  API-->>P: success or deterministic degraded responses
```

## Prerequisites

- API running locally at http://localhost:3000
- Postman desktop app or web client

## 1) Environment Variables

The provided environment file includes:

- baseUrl = http://localhost:3000
- journeyId = (leave blank initially)
- customerId = cust-1001
- requestId = req-postman-1
- correlationId = corr-postman-1

Optional scenario variables for manual tracking:

- inventoryScenario = success
- paymentScenario = success
- fulfillmentScenario = success

## 2) Collection Structure

The provided collection includes three runnable folders:

1. 01 - Happy Path Full Flow
2. 02 - Error Scenarios
3. 03 - Rule Config and Validation Scenarios

Within those folders, requests are organized in this flow order:

1. POST {{baseUrl}}/v1/checkout/journeys
2. PATCH {{baseUrl}}/v1/checkout/journeys/{{journeyId}}/steps/cart
3. PATCH {{baseUrl}}/v1/checkout/journeys/{{journeyId}}/steps/shipping-address
4. PATCH {{baseUrl}}/v1/checkout/journeys/{{journeyId}}/steps/delivery-method
5. PATCH {{baseUrl}}/v1/checkout/journeys/{{journeyId}}/steps/payment-method
6. PATCH {{baseUrl}}/v1/checkout/journeys/{{journeyId}}/steps/billing-address
7. PATCH {{baseUrl}}/v1/checkout/journeys/{{journeyId}}/steps/promo-code
8. POST {{baseUrl}}/v1/checkout/journeys/{{journeyId}}/validate
9. POST {{baseUrl}}/v1/checkout/journeys/{{journeyId}}/submit
10. GET {{baseUrl}}/health

For every request, add headers:

- Content-Type: application/json
- x-request-id: {{requestId}}
- x-correlation-id: {{correlationId}}

## 3) Request payloads

### Create journey

```json
{
  "customerId": "{{customerId}}",
  "currency": "USD",
  "locale": "en-US"
}
```

Post-response Tests script for create request:

```javascript
pm.test("Created", function () {
  pm.response.to.have.status(201);
});
const json = pm.response.json();
pm.environment.set("journeyId", json.data.id);
pm.test("ID propagation", function () {
  pm.expect(json.requestId).to.exist;
  pm.expect(json.correlationId).to.exist;
});
```

### cart

```json
{
  "payload": {
    "items": [
      { "sku": "SKU-100", "name": "Demo Item", "quantity": 1, "unitPrice": 129.99 }
    ],
    "totalAmount": 129.99
  }
}
```

### shipping-address

```json
{
  "payload": {
    "firstName": "Sam",
    "lastName": "Taylor",
    "line1": "101 Main St",
    "city": "Austin",
    "state": "TX",
    "postalCode": "78701",
    "country": "US"
  }
}
```

### delivery-method

```json
{
  "payload": {
    "method": "standard"
  }
}
```

### payment-method

```json
{
  "payload": {
    "method": "card",
    "cardLast4": "4242"
  }
}
```

### billing-address

```json
{
  "payload": {
    "line1": "101 Main St",
    "city": "Austin",
    "state": "TX",
    "postalCode": "78701",
    "country": "US"
  }
}
```

### promo-code

```json
{
  "payload": {
    "code": "WELCOME10"
  }
}
```

### validate

No body required.

### submit

No body required.

## 4) Scenario matrix

Set API environment variables before starting the server, then run the matching collection requests.

### Happy path submit

Server config:

- MOCK_INVENTORY_SCENARIO=success
- MOCK_PAYMENT_SCENARIO=success
- MOCK_FULFILLMENT_SCENARIO=success

Expected submit:

- HTTP 200
- data.status is submitted
- data.submittedOrderId exists

Run folder: 01 - Happy Path Full Flow

### Payment declined

Server config:

- MOCK_PAYMENT_SCENARIO=declined

Expected submit:

- HTTP 409
- code is PAYMENT_DECLINED

Run folder: 02 - Error Scenarios
Run requests:

1. Prepare Ready Journey
2. Submit - Payment Declined

### Inventory unavailable

Server config:

- MOCK_INVENTORY_SCENARIO=out_of_stock

Expected submit:

- HTTP 409
- code is INVENTORY_UNAVAILABLE

Run folder: 02 - Error Scenarios
Run requests:

1. Prepare Ready Journey
2. Submit - Inventory Unavailable

### Fulfillment timeout

Server config:

- MOCK_FULFILLMENT_SCENARIO=timeout

Expected submit:

- HTTP 503
- code is FULFILLMENT_TIMEOUT

Run folder: 02 - Error Scenarios
Run requests:

1. Prepare Ready Journey
2. Submit - Fulfillment Timeout

## 5) Validation and step-conflict checks

### Validation-style bad payload example

Use invalid shipping-address payload:

```json
{
  "payload": {
    "firstName": "Sam",
    "lastName": "Taylor",
    "line1": "101 Main St",
    "city": "Austin",
    "state": "TX",
    "postalCode": "ABC",
    "country": "US"
  }
}
```

This now evaluates through the Phase 11 rules service and should return:

- HTTP 400
- code is VALIDATION_ERROR
- details include the field path and rule identifier

In collection: Rule-style Invalid Postal

### Eligibility rule check

Set shipping-address state to NY, then use this payment-method payload:

```json
{
  "payload": {
    "method": "cash_on_delivery"
  }
}
```

Expected:

- HTTP 409
- code is CUSTOMER_NOT_ELIGIBLE
- details include the eligibility rule identifier

In collection: Rule-style NY Cash On Delivery

### Warning-only validate example

Use a PO Box shipping line and overnight delivery:

```json
{
  "payload": {
    "method": "overnight"
  }
}
```

Expected validate response:

- HTTP 200
- data.valid is true
- data.issues includes a warning with ruleId DYN-WARN-POBOX-EXPRESS

### Step dependency conflict

Try review-submit before required steps:

```json
{
  "payload": {
    "confirmed": true
  }
}
```

Expected:

- HTTP 409
- code is STEP_CONFLICT

In collection: Step Conflict - Review Submit Too Early

## 6) Common Postman Tests script

Attach this Tests script to update, validate, and submit requests:

```javascript
const json = pm.response.json();
pm.test("requestId exists", function () {
  pm.expect(json.requestId).to.exist;
});
pm.test("correlationId exists", function () {
  pm.expect(json.correlationId).to.exist;
});
```

For failure requests, add:

```javascript
pm.test("error code exists", function () {
  const json = pm.response.json();
  pm.expect(json.code).to.exist;
  pm.expect(json.message).to.exist;
});
```

## 7) Health endpoint checks

Call GET {{baseUrl}}/health.

Expected:

- status is ok when all scenarios are success
- status is degraded when any scenario is non-success
- requestId and correlationId exist
