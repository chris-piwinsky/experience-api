# Customer Experience API - Checkout Journey Execution Plan

Last updated: 2026-06-20

## Purpose

This document is the working playbook to build a contract-first Express + TypeScript Customer Experience API that exposes the checkout journey, with mocked downstream services only.

Use this as the resume point whenever work is paused.

## Scope Locked In

- API style: single journey resource with step updates (REST)
- Auth: none for MVP
- Checkout steps in MVP:
  - cart
  - shipping-address
  - delivery-method
  - payment-method
  - billing-address
  - promo-code
  - review-submit
- Downstreams: mocked only
- Mock fidelity: happy path plus deterministic failure scenarios
- Persistence: undecided (default to in-memory first)

## Success Criteria

- Frontend can create and progress a checkout journey through all MVP steps
- Submit flow works using mocked inventory, payment, and fulfillment adapters
- Deterministic degraded scenarios are testable
- Every response includes request and correlation identifiers
- Health endpoint reports ok or degraded based on mock scenario state

## Proposed API Contract (OpenAPI First)

Base path: /v1

### Endpoints

1. POST /checkout/journeys
- Create a new checkout journey
- Returns: journey snapshot + identifiers

2. GET /checkout/journeys/{journeyId}
- Retrieve full current state of a journey

3. PATCH /checkout/journeys/{journeyId}/steps/{stepId}
- Update a single step payload
- Returns updated full journey snapshot

4. POST /checkout/journeys/{journeyId}/validate
- Cross-step validation prior to submit
- Returns validation results and issues

5. POST /checkout/journeys/{journeyId}/submit
- Orchestrates mocked downstream calls
- Returns submitted state or deterministic failure

6. GET /health
- Returns service status and downstream mock checks

### Response Envelope

Use a consistent envelope where practical:

- data
- requestId
- correlationId
- timestamp

### Error Model

Canonical error body:

- code
- message
- requestId
- correlationId
- details (optional array)
- timestamp

Suggested stable error codes:

- VALIDATION_ERROR
- JOURNEY_NOT_FOUND
- STEP_CONFLICT
- PAYMENT_DECLINED
- INVENTORY_UNAVAILABLE
- FULFILLMENT_TIMEOUT
- DEPENDENCY_FAILURE
- INTERNAL_ERROR

## Project Structure

Create this structure:

- openapi.yaml
- config/rules.yaml
- src/index.ts
- src/app.ts
- src/routes/checkout.ts
- src/services/checkout.service.ts
- src/services/rules.service.ts
- src/adapters/inventory.adapter.ts
- src/adapters/payment.adapter.ts
- src/adapters/fulfillment.adapter.ts
- src/adapters/mock-scenarios.ts
- src/data/journeys.store.ts
- src/data/fixtures.ts
- src/middleware/correlation-id.ts
- src/middleware/request-logger.ts
- src/middleware/error-handler.ts
- src/types/checkout.ts
- src/types/api-error.ts
- src/__tests__/unit/checkout.service.test.ts
- src/__tests__/unit/adapters.test.ts
- src/__tests__/integration/checkout.api.test.ts
- docs/overview.md
- docs/quickstart.md
- docs/testing.md
- docs/postman-guide.md
- docs/api-reference.md
- docs/architecture.md
- docs/mock-scenarios.md
- .env.example
- README.md

## Implementation Phases

## Phase 1 - Contract and Skeleton

Goal: establish stable interface and runnable app shell.

Tasks:

1. Write openapi.yaml with all endpoints and schemas before implementation.
2. Initialize Express + TypeScript + test tooling.
3. Add app factory pattern (app.ts) and bootstrap (index.ts).
4. Register placeholder checkout routes and health route.

Done when:

- OpenAPI is complete for all MVP endpoints.
- App starts and returns placeholder responses.

## Phase 2 - Domain Model and State Store

Goal: represent checkout journey lifecycle.

Tasks:

1. Define journey, step payload, status, and validation types.
2. Implement in-memory journey store abstraction.
3. Add step transition rules and basic guards.

Done when:

- Can create journey and update/read step state in memory.

## Phase 3 - Mock Downstream Adapters

Goal: isolate dependencies and make behavior controllable.

Tasks:

1. Define adapter interfaces:
   - InventoryAdapter
   - PaymentAdapter
   - FulfillmentAdapter
2. Implement default mock adapters with fixture-backed responses.
3. Add deterministic scenario selection via env flags.

Done when:

- Submit/validate can call adapters without real services.
- Failure modes are deterministic and reproducible.

## Phase 4 - Route and Service Orchestration

Goal: functional checkout journey API.

Tasks:

1. Implement create/get/update/validate/submit handlers.
2. Move orchestration and business logic into checkout service.
3. Ensure all responses and errors use canonical envelope/model.

Done when:

- End-to-end flow works from create to submit on happy path.

## Phase 5 - Observability and Error Handling

Goal: debuggable and traceable behavior.

Tasks:

1. Add correlation ID middleware with header propagation.
2. Add request ID generation.
3. Add structured JSON request and response logs.
4. Implement centralized error mapping middleware.
5. Implement health checks reflecting mock status.

Done when:

- IDs are present in logs and responses.
- Health indicates degraded under forced failure scenarios.

## Phase 6 - Tests

Goal: confidence in normal and degraded behavior.

Tasks:

1. Unit tests:
   - state transitions
   - validation behavior
   - adapter deterministic outputs
2. Integration tests:
   - full happy path
   - payment declined
   - inventory unavailable
   - fulfillment timeout
   - ID propagation and error body consistency

Done when:

- Test suite passes with deterministic results.

## Phase 7 - Documentation and Quickstart

Goal: provide complete onboarding and usage documentation for contributors and consumers.

Tasks:

1. Create docs folder with focused markdown files:
   - docs/overview.md
   - docs/quickstart.md
   - docs/testing.md
   - docs/postman-guide.md
   - docs/api-reference.md
   - docs/architecture.md
   - docs/mock-scenarios.md
2. Add quickstart instructions for install, run, and first API call.
3. Add testing guide with unit/integration commands and degraded scenario coverage.
4. Add API reference guidance aligned with openapi.yaml and checkout routes.
5. Add architecture and mock scenario behavior notes.
6. Update README.md to serve as the main entry point and link all docs files.

Done when:

- A new contributor can run and test the service by following docs/quickstart.md and docs/testing.md.
- README.md links to all docs files under /docs and provides clear navigation.

## Phase 8 - Developer Code Comments and Maintainability

Goal: improve maintainability by adding clear, intentional comments for support and future enhancement work.

Tasks:

1. Add concise comments in core files where logic is not self-evident:
   - src/routes/checkout.ts
   - src/services/checkout.service.ts
   - src/adapters/*.ts
   - src/middleware/*.ts
2. Focus comments on:
   - business and flow intent
   - non-obvious decision points
   - error-mapping rationale
   - deterministic mock behavior assumptions
3. Avoid noisy comments that only restate obvious code.
4. Keep comments accurate and in sync with openapi.yaml and execution plan behavior.
5. Review tests to ensure comments do not conflict with existing deterministic expectations.

Done when:

- Support engineers can follow route, service, adapter, and middleware logic without guesswork.
- Comments are concise, accurate, and limited to high-value sections.

## Mock Scenario Strategy

Use explicit scenario flags, not randomness.

Recommended env variables:

- MOCK_MODE=true
- MOCK_INVENTORY_SCENARIO=success|out_of_stock|timeout
- MOCK_PAYMENT_SCENARIO=success|declined|timeout
- MOCK_FULFILLMENT_SCENARIO=success|timeout

Optional latency controls:

- MOCK_INVENTORY_DELAY_MS=0
- MOCK_PAYMENT_DELAY_MS=0
- MOCK_FULFILLMENT_DELAY_MS=0

Note: avoid random failure rates in MVP to keep tests and demos reliable.

## Rules Configuration Strategy

Goal: keep validation and eligibility logic configurable so business policy updates do not require route rewrites.

### What goes into config-driven rules

- Field validation rules:
   - required fields
   - format rules (email, postal code, state code)
   - min and max length
   - enum constraints
- Eligibility rules:
   - disallowed shipping states
   - allowed delivery methods by state
   - blocked payment method by state or customer segment

### Recommended design

1. Store policy in config/rules.yaml and load it at startup.
2. Evaluate rules in src/services/rules.service.ts from:
    - PATCH step updates (step-level checks)
    - POST validate (full journey checks)
    - POST submit (final guardrail)
3. Return violations as:
    - 400 VALIDATION_ERROR for field format and missing required values
    - 409 CUSTOMER_NOT_ELIGIBLE for policy-based ineligibility (for example state restrictions)
4. Include ruleId and fieldPath in validation issue details for frontend clarity.

### Dynamic rule capabilities to support

- enabled toggle per rule for runtime enable and disable
- priority for deterministic ordering
- effective.from and effective.to windows for date-based activation
- appliesTo filters (step, channel, customer segment)
- condition sets using contextPath + operator + value
- actions:
   - block (hard stop)
   - warn (non-blocking issue)
   - set_value (policy-driven mutation, for example shipping fee adjustments)

### Example in-scope policy checks

- Customer shipping state in AK or HI can only use delivery-method=standard.
- Customer state NY cannot use payment-method=cash_on_delivery.
- Billing postal code must match US ZIP format if country=US.

### Rule governance

- Version rules with a policyVersion value.
- Add tests per rule in unit tests and at least one integration test per rule family.
- Record rule changes in this plan Decision Log with date and reason.

## Postman Sample Payloads and Scenario Matrix

### Postman environment variables

- baseUrl: http://localhost:3000
- journeyId: set after create call
- correlationId: optional fixed value for tracing
- customerId: cust-1001

### Collection flow order

1. POST {{baseUrl}}/v1/checkout/journeys
2. PATCH {{baseUrl}}/v1/checkout/journeys/{{journeyId}}/steps/cart
3. PATCH {{baseUrl}}/v1/checkout/journeys/{{journeyId}}/steps/shipping-address
4. PATCH {{baseUrl}}/v1/checkout/journeys/{{journeyId}}/steps/delivery-method
5. PATCH {{baseUrl}}/v1/checkout/journeys/{{journeyId}}/steps/payment-method
6. PATCH {{baseUrl}}/v1/checkout/journeys/{{journeyId}}/steps/billing-address
7. PATCH {{baseUrl}}/v1/checkout/journeys/{{journeyId}}/steps/promo-code
8. POST {{baseUrl}}/v1/checkout/journeys/{{journeyId}}/validate
9. POST {{baseUrl}}/v1/checkout/journeys/{{journeyId}}/submit

### Create journey payload

```json
{
   "customerId": "cust-1001",
   "currency": "USD",
   "locale": "en-US"
}
```

Postman test script for create request:

```javascript
pm.test("Created", function () {
   pm.response.to.have.status(201);
});
const json = pm.response.json();
pm.environment.set("journeyId", json.data.id);
```

### Happy-path step payloads

cart:

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

shipping-address:

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

delivery-method:

```json
{
   "payload": {
      "method": "standard"
   }
}
```

payment-method:

```json
{
   "payload": {
      "method": "card",
      "cardLast4": "4242"
   }
}
```

billing-address:

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

promo-code:

```json
{
   "payload": {
      "code": "WELCOME10"
   }
}
```

### Rule-driven failure payloads

Validation error (bad postal code in shipping-address, expect 400 VALIDATION_ERROR):

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

Eligibility failure (cash_on_delivery in NY in payment-method, expect 409 CUSTOMER_NOT_ELIGIBLE):

- Ensure shipping state is NY first, then use:

```json
{
   "payload": {
      "method": "cash_on_delivery"
   }
}
```

Step dependency conflict (set review-submit before required steps, expect 409 STEP_CONFLICT):

```json
{
   "payload": {
      "confirmed": true
   }
}
```

### Submit scenario matrix

- Happy submit:
   - MOCK_INVENTORY_SCENARIO=success
   - MOCK_PAYMENT_SCENARIO=success
   - MOCK_FULFILLMENT_SCENARIO=success
   - Expect 200

- Payment failure:
   - MOCK_PAYMENT_SCENARIO=declined
   - Expect 409 or 503 per mapping, with stable error code

- Inventory unavailable:
   - MOCK_INVENTORY_SCENARIO=out_of_stock
   - Expect 409 or 503 with deterministic code

- Fulfillment timeout:
   - MOCK_FULFILLMENT_SCENARIO=timeout
   - Expect 503

### Response assertions for Postman tests

Check on every request:

- Status code matches scenario
- requestId exists
- correlationId exists
- For failures: code exists and matches expected domain code
- For validation: issue details include ruleId and or fieldPath

## Prompt Templates

Use these templates to drive implementation one phase at a time from this plan.

### Explicit phase prompt pack (no placeholders)

Use these when you want direct copy and paste prompts without replacing TARGET_PHASE_HEADING.

#### Prompt for Phase 1 - Contract and Skeleton

Implement Phase 1 - Contract and Skeleton from the Implementation Phases section in checkout-journey-execution-plan.md.
Requirements:
- Treat checkout-journey-execution-plan.md as the source of truth; if generated code conflicts with it, follow the plan and call out any required deviation explicitly.
- Validate output against Project Structure, Proposed API Contract, and Success Criteria sections before finishing.
- Follow contract-first approach from openapi.yaml.
- Initialize Express and TypeScript scaffold and app bootstrap.
- Register placeholder checkout routes and health route.
- Keep mocked downstream services only.
- Do not implement work outside Phase 1.
- After code changes, run relevant checks and summarize results.
Deliverables:
- Files created and updated
- Assumptions made
- Phase 1 completion checklist
- Validation checklist covering implemented files vs planned files, implemented endpoints vs planned endpoints, and any gaps or deviations

#### Prompt for Phase 2 - Domain Model and State Store

Implement Phase 2 - Domain Model and State Store from the Implementation Phases section in checkout-journey-execution-plan.md.
Requirements:
- Treat checkout-journey-execution-plan.md as the source of truth; if generated code conflicts with it, follow the plan and call out any required deviation explicitly.
- Validate output against Project Structure, Proposed API Contract, and Success Criteria sections before finishing.
- Define journey, step payload, status, and validation types.
- Implement in-memory journey store abstraction.
- Add step transition rules and guards.
- Keep contract compatibility with openapi.yaml.
- Do not implement work outside Phase 2.
- Run relevant checks and summarize results.
Deliverables:
- Files created and updated
- Assumptions made
- Phase 2 completion checklist
- Validation checklist covering implemented files vs planned files, implemented endpoints vs planned endpoints, and any gaps or deviations

#### Prompt for Phase 3 - Mock Downstream Adapters

Implement Phase 3 - Mock Downstream Adapters from the Implementation Phases section in checkout-journey-execution-plan.md.
Requirements:
- Treat checkout-journey-execution-plan.md as the source of truth; if generated code conflicts with it, follow the plan and call out any required deviation explicitly.
- Validate output against Project Structure, Proposed API Contract, and Success Criteria sections before finishing.
- Define adapter interfaces for inventory, payment, and fulfillment.
- Implement deterministic mock adapters and scenario toggles.
- Keep behavior aligned with Mock Scenario Strategy.
- Do not implement work outside Phase 3.
- Run relevant checks and summarize results.
Deliverables:
- Files created and updated
- Assumptions made
- Phase 3 completion checklist
- Validation checklist covering implemented files vs planned files, implemented endpoints vs planned endpoints, and any gaps or deviations

#### Prompt for Phase 4 - Route and Service Orchestration

Implement Phase 4 - Route and Service Orchestration from the Implementation Phases section in checkout-journey-execution-plan.md.
Requirements:
- Treat checkout-journey-execution-plan.md as the source of truth; if generated code conflicts with it, follow the plan and call out any required deviation explicitly.
- Validate output against Project Structure, Proposed API Contract, and Success Criteria sections before finishing.
- Implement create, get, update, validate, and submit handlers.
- Move orchestration into checkout service.
- Ensure response and error models remain canonical.
- Do not implement work outside Phase 4.
- Run relevant checks and summarize results.
Deliverables:
- Files created and updated
- Assumptions made
- Phase 4 completion checklist
- Validation checklist covering implemented files vs planned files, implemented endpoints vs planned endpoints, and any gaps or deviations

#### Prompt for Phase 5 - Observability and Error Handling

Implement Phase 5 - Observability and Error Handling from the Implementation Phases section in checkout-journey-execution-plan.md.
Requirements:
- Treat checkout-journey-execution-plan.md as the source of truth; if generated code conflicts with it, follow the plan and call out any required deviation explicitly.
- Validate output against Project Structure, Proposed API Contract, and Success Criteria sections before finishing.
- Add correlation ID and request ID handling.
- Add structured request and response logging.
- Implement centralized error mapping middleware.
- Implement health checks that reflect mock status.
- Do not implement work outside Phase 5.
- Run relevant checks and summarize results.
Deliverables:
- Files created and updated
- Assumptions made
- Phase 5 completion checklist
- Validation checklist covering implemented files vs planned files, implemented endpoints vs planned endpoints, and any gaps or deviations

#### Prompt for Phase 6 - Tests

Implement Phase 6 - Tests from the Implementation Phases section in checkout-journey-execution-plan.md.
Requirements:
- Treat checkout-journey-execution-plan.md as the source of truth; if generated code conflicts with it, follow the plan and call out any required deviation explicitly.
- Validate output against Project Structure, Proposed API Contract, and Success Criteria sections before finishing.
- Add unit tests for state transitions, validation, and adapter behavior.
- Add integration tests for happy path and degraded scenarios.
- Include checks for requestId and correlationId propagation.
- Keep tests deterministic and aligned with rules and mock scenarios.
- Do not implement work outside Phase 6.
- Run test suite and summarize results.
Deliverables:
- Files created and updated
- Assumptions made
- Phase 6 completion checklist
- Validation checklist covering implemented files vs planned files, implemented endpoints vs planned endpoints, and any gaps or deviations

#### Prompt for Phase 7 - Documentation and Quickstart

Implement Phase 7 - Documentation and Quickstart from the Implementation Phases section in checkout-journey-execution-plan.md.
Requirements:
- Treat checkout-journey-execution-plan.md as the source of truth; if generated content conflicts with it, follow the plan and call out any required deviation explicitly.
- Validate output against Project Structure, Proposed API Contract, and Success Criteria sections before finishing.
- Create and organize extensive documentation in markdown files under /docs.
- Include a quickstart guide for install, run, and first request.
- Include a testing guide covering unit and integration test execution and degraded scenarios.
- Ensure README.md is the top-level overview with links to all docs files.
- Keep documentation aligned with implemented behavior and openapi.yaml.
- Do not implement work outside Phase 7.
- Summarize what was added and any documentation gaps that remain.
Deliverables:
- Files created and updated
- Assumptions made
- Phase 7 completion checklist
- Validation checklist covering implemented files vs planned files, documented endpoints vs planned endpoints, and any gaps or deviations

#### Prompt for Phase 8 - Developer Code Comments and Maintainability

Implement Phase 8 - Developer Code Comments and Maintainability from the Implementation Phases section in checkout-journey-execution-plan.md.
Requirements:
- Treat checkout-journey-execution-plan.md as the source of truth; if generated code comments conflict with it, follow the plan and call out any required deviation explicitly.
- Validate output against Project Structure, Proposed API Contract, and Success Criteria sections before finishing.
- Add concise, high-value comments only where logic is not self-evident.
- Prioritize comments in routes, service orchestration, adapters, and middleware.
- Explain intent, non-obvious behavior, and error mapping decisions.
- Do not add noisy comments that restate obvious syntax.
- Do not implement work outside Phase 8.
- Run build and tests after comment updates and summarize results.
Deliverables:
- Files created and updated
- Assumptions made
- Phase 8 completion checklist
- Validation checklist covering implemented files vs planned files, commented modules vs planned modules, and any gaps or deviations

## Execution Order and Parallel Work

Sequential dependencies:

1. Phase 1 must complete first.
2. Phase 2 and Phase 3 can overlap after types are defined.
3. Phase 4 depends on 2 and 3.
4. Phase 5 can start as soon as handlers exist.
5. Phase 6 starts once core route logic is available.
6. Phase 7 starts once tests are stable.
7. Phase 8 starts after core behavior and tests are stable.

Parallel candidates (if multiple engineers):

- Engineer A: OpenAPI + route skeleton
- Engineer B: in-memory store + journey types
- Engineer C: mock adapters + fixtures

## Resume Checklist

When returning after a break:

1. Open this file and mark current phase.
2. Confirm what is already implemented in:
   - openapi.yaml
   - src/routes/checkout.ts
   - src/services/checkout.service.ts
   - src/adapters/*.ts
3. Run tests and note failing areas.
4. Continue from the next unchecked task in the active phase.

## Decision Log

- 2026-06-19: Chosen API style is single journey resource with step updates.
- 2026-06-19: Auth excluded from MVP.
- 2026-06-19: Downstreams will be mocked only.
- 2026-06-19: Mock behavior should include deterministic degraded scenarios.
- 2026-06-19: Persistence decision deferred. Start with in-memory abstraction.
- 2026-06-19: Validation and eligibility rules will be config-driven via config/rules.yaml.

## Open Questions (Track Before Production)

- Should journey state survive restart (SQLite or file-backed store)?
- How to handle concurrent updates to the same journey?
- What is journey TTL/expiration policy?
- What additional steps may be added later (gift cards, tax exemptions, etc.)?

## Optional Next Step Command Checklist

Run these when you begin implementation:

1. npm init -y
2. npm install express cors
3. npm install -D typescript ts-node @types/node @types/express @types/cors nodemon jest ts-jest @types/jest supertest @types/supertest
4. npx tsc --init
5. Configure scripts for dev, build, test

End of plan.
