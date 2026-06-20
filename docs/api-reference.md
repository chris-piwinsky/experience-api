# API Reference Summary

Primary API contract is defined in ../openapi.yaml.

Base path: /v1

## Endpoints

- POST /checkout/journeys
  - Creates a journey
  - Returns JourneyEnvelope
- GET /checkout/journeys/{journeyId}
  - Retrieves current journey snapshot
  - Returns JourneyEnvelope
- PATCH /checkout/journeys/{journeyId}/steps/{stepId}
  - Updates one step payload
  - Returns JourneyEnvelope
- POST /checkout/journeys/{journeyId}/validate
  - Runs cross-step validation
  - Returns ValidationEnvelope
- POST /checkout/journeys/{journeyId}/submit
  - Orchestrates inventory, payment, and fulfillment adapters
  - Returns JourneyEnvelope on success
- GET /health
  - Returns service and downstream mock status

## Standard response envelope

Success responses include:

- data
- requestId
- correlationId
- timestamp

## Standard error model

Errors include:

- code
- message
- requestId
- correlationId
- details (optional)
- timestamp

Common error codes:

- VALIDATION_ERROR
- JOURNEY_NOT_FOUND
- STEP_CONFLICT
- PAYMENT_DECLINED
- INVENTORY_UNAVAILABLE
- FULFILLMENT_TIMEOUT
- DEPENDENCY_FAILURE
- INTERNAL_ERROR

## Step IDs

Supported stepId values:

- cart
- shipping-address
- delivery-method
- payment-method
- billing-address
- promo-code
- review-submit

For request and response schemas, use ../openapi.yaml as the canonical source.
