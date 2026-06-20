# Customer Experience API - Checkout Journey Execution Plan

Last updated: 2026-06-20

## Purpose

This document is the working playbook to build a contract-first Express + TypeScript Customer Experience API that exposes the checkout journey, with mocked downstream services only.

Use this as the resume point whenever work is paused.

## Completion Status

**Phases 1–8: COMPLETE**
- ✅ Phase 1: Contract and skeleton (OpenAPI, Express app, routes)
- ✅ Phase 2: Domain model and state store (journey types, in-memory store)
- ✅ Phase 3: Mock downstream adapters (inventory, payment, fulfillment with deterministic scenarios)
- ✅ Phase 4: Route and service orchestration (create/get/update/validate/submit handlers)
- ✅ Phase 5: Observability and error handling (correlation IDs, structured logging, centralized error mapping)
- ✅ Phase 6: Tests (unit and integration; all 20 tests passing)
- ✅ Phase 7: Documentation and quickstart (all docs including bruno-guide.md; README updated)
- ✅ Phase 8: Developer code comments and maintainability (build passes; comments added to routes, service, middleware, adapters; all tests passing)

**Phase 9–10: COMPLETE**
- ✅ Phase 9: Customer journey requirements documentation (docs/customer-journey-requirements.md exists and linked)
- ✅ Phase 10: Rules integration and expansion documentation (docs/rules-integration-and-expansion.md exists and linked)

**Phase 11: PARTIAL**
- 🔄 Phase 11: Rules Service POC implementation (src/services/rules.service.ts exists; core operators and actions implemented; further testing and validation expansion may be needed)

**Migration Notes**
- ✅ Postman → Bruno migration complete (25 requests across 3 folders in bruno/Customer-Experience-API/)
- ✅ All Postman JSON files and /postman/ directory removed
- ✅ All documentation updated to reference Bruno instead of Postman

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
- docs/bruno-guide.md
- docs/api-reference.md
- docs/architecture.md
- docs/mock-scenarios.md
- docs/customer-journey-requirements.md
- docs/rules-integration-and-expansion.md
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
   - docs/bruno-guide.md
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

**Status: COMPLETE** ✅

Goal: improve maintainability by adding clear, intentional comments for support and future enhancement work.

Completed tasks:

1. Added concise comments in core files:
   - src/routes/checkout.ts (4 block comments: HTTP layer purpose, request context, endpoint flow intents)
   - src/services/checkout.service.ts (2 block comments: orchestration role, submit sequence and async rationale)
   - src/middleware/correlation-id.ts (1 expanded comment: ID chaining logic)
   - src/middleware/error-handler.ts (2 expanded comments: error handling strategy and contract protection)
   - src/adapters/inventory.adapter.ts (1 block comment: deterministic scenario behavior)
   - src/adapters/payment.adapter.ts (1 expanded comment: timeout vs decline error distinction)
   - src/adapters/fulfillment.adapter.ts (1 block comment: deterministic scenario behavior)
2. Comments focus on business and flow intent, non-obvious decisions, and error-mapping rationale.
3. Avoided noisy comments that only restate obvious code.
4. Verified comments are accurate and in sync with openapi.yaml and Phase 4 orchestration behavior.
5. Ran full test suite and build to ensure no conflicts with existing deterministic expectations.

Validation:

- ✅ TypeScript build passes with no errors
- ✅ All 20 tests pass (3 suites: unit, unit adapters, integration)
- ✅ Support engineers can follow route, service, adapter, and middleware logic without guesswork
- ✅ Comments are concise, accurate, and limited to high-value sections

## Phase 9 - Customer Journey Requirements Documentation

**Status: COMPLETE** ✅

Goal: provide a clear business and product requirements narrative for the checkout journey, including intended behavior, constraints, and acceptance boundaries.

Completed tasks:

1. Created docs/customer-journey-requirements.md with comprehensive narrative.
2. Documented journey purpose, actors, and expected user outcomes for all MVP checkout steps.
3. Captured functional and non-functional requirements with explicit out-of-scope items.
4. Defined state transitions and failure behavior expectations aligned with API and mock scenario strategy.
5. Mapped requirements to endpoints, test scenarios, and support diagnostics expectations.
6. Linked the document from docs/overview.md and README.md.

Validation:

- ✅ Product and support teams can understand checkout journey meaning and success/failure outcomes
- ✅ Requirements are traceable to API behavior and deterministic scenario tests

## Phase 10 - Rules Integration and Dynamic Expansion Documentation

**Status: COMPLETE** ✅

Goal: provide implementation-level guidance for how config/rules.yaml is integrated, evaluated, and safely expanded over time.

Completed tasks:

1. Created docs/rules-integration-and-expansion.md with implementation guidance.
2. Documented rules.yaml sections and expected runtime interpretation.
3. Described integration points for PATCH, validate, and submit flows.
4. Defined evaluation order (stepDependencies → fieldRules → eligibilityRules → dynamicRules), conflict resolution, and error mapping expectations.
5. Provided dynamic expansion guidance with examples and required test patterns.
6. Linked the document from docs/overview.md and README.md.

Validation:

- ✅ Engineers can understand and evolve rules behavior without route rewrites
- ✅ Support and QA can map rule outcomes to API responses and test scenarios

## Phase 11 - Rules Service POC Implementation

**Status: PARTIAL** 🔄

Goal: implement a thin, deterministic rules service for demo use that evaluates config/rules.yaml in core checkout flows.

Completed tasks:

1. Implemented src/services/rules.service.ts with focused operator/action subset:
   - operators: eq, in, regex, exists, gte ✅
   - actions: block, warn ✅
   - optional: set_value (foundation in place)
2. Added rules.yaml loading and validation at service initialization ✅
3. Core service logic for deterministic evaluation ✅

Pending tasks for full Phase 11 completion:

1. Complete integration into PATCH step updates, POST validate, and POST submit flows
2. Enforce full deterministic evaluation order (stepDependencies → fieldRules → eligibilityRules → dynamicRules)
3. Add comprehensive unit and integration tests demonstrating block and warn outcomes
4. Update Bruno test collection and docs when rules-driven behavior is user-facing
5. Validate end-to-end rule evaluation with config/rules.yaml scenarios

Next steps:

- Extend checkout.service.ts to call rules.service.ts during PATCH, validate, and submit flows
- Add test scenarios for policy blocks and warnings
- Document rules behaviors in Bruno collection scenarios
- Update mock scenario matrix in docs/bruno-guide.md if rules impact visible behavior

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

## Bruno Sample Payloads and Scenario Matrix

### Bruno environment variables

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

Bruno no-script workflow note for create request:

Capture `data.id` from the create response and set `journeyId` in the Bruno environment before running patch, validate, or submit requests.

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

### Response checks in Bruno

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

#### Prompt for Phase 9 - Customer Journey Requirements Documentation

Implement Phase 9 - Customer Journey Requirements Documentation from the Implementation Phases section in checkout-journey-execution-plan.md.
Requirements:
- Treat checkout-journey-execution-plan.md as the source of truth; if generated content conflicts with it, follow the plan and call out any required deviation explicitly.
- Validate output against Project Structure, Proposed API Contract, and Success Criteria sections before finishing.
- Create docs/customer-journey-requirements.md to explain the meaning of the customer journey and requirements around it.
- Include business goals, actor expectations, checkout step intent, and acceptance criteria.
- Include functional and non-functional requirements, deterministic scenario expectations, and clear out-of-scope boundaries.
- Map requirements to API endpoints and test/Bruno scenarios where applicable.
- Do not implement work outside Phase 9.
- Summarize what was added and any requirement gaps that remain.
Deliverables:
- Files created and updated
- Assumptions made
- Phase 9 completion checklist
- Validation checklist covering implemented files vs planned files, documented requirements vs planned requirements, and any gaps or deviations

#### Prompt for Phase 10 - Rules Integration and Dynamic Expansion Documentation

Implement Phase 10 - Rules Integration and Dynamic Expansion Documentation from the Implementation Phases section in checkout-journey-execution-plan.md.
Requirements:
- Treat checkout-journey-execution-plan.md as the source of truth; if generated content conflicts with it, follow the plan and call out any required deviation explicitly.
- Validate output against Project Structure, Proposed API Contract, and Success Criteria sections before finishing.
- Create docs/rules-integration-and-expansion.md.
- Explain how config/rules.yaml is integrated and used in PATCH, validate, and submit flows.
- Document evaluation order, priority handling, conflict behavior, and error mapping conventions.
- Include guidance for dynamically expanding rules safely, including examples and required tests.
- Keep the document explicit about current implementation status vs planned rules service behavior.
- Do not implement work outside Phase 10.
- Summarize what was added and remaining rules integration gaps.
Deliverables:
- Files created and updated
- Assumptions made
- Phase 10 completion checklist
- Validation checklist covering implemented files vs planned files, documented rules behavior vs planned rules behavior, and any gaps or deviations

#### Prompt for Phase 11 - Rules Service POC Implementation

Implement Phase 11 - Rules Service POC Implementation from the Implementation Phases section in checkout-journey-execution-plan.md.
Requirements:
- Treat checkout-journey-execution-plan.md as the source of truth; if generated code conflicts with it, follow the plan and call out any required deviation explicitly.
- Validate output against Project Structure, Proposed API Contract, and Success Criteria sections before finishing.
- Implement src/services/rules.service.ts for a focused POC scope.
- Support operators eq, in, regex, exists, gte and actions block, warn (optional set_value for one controlled path).
- Integrate rules checks into PATCH step updates, POST validate, and POST submit.
- Keep deterministic evaluation order and stable mapping to canonical error model.
- Add or update tests for rule evaluation and API-visible outcomes.
- Update docs/bruno-guide where behavior changes.
- Do not implement work outside Phase 11.
- Run build and tests and summarize results.
Deliverables:
- Files created and updated
- Assumptions made
- Phase 11 completion checklist
- Validation checklist covering implemented files vs planned files, implemented rules behavior vs planned rules behavior, and any gaps or deviations

## Execution Order and Parallel Work

Sequential dependencies:

1. Phase 1 must complete first.
2. Phase 2 and Phase 3 can overlap after types are defined.
3. Phase 4 depends on 2 and 3.
4. Phase 5 can start as soon as handlers exist.
5. Phase 6 starts once core route logic is available.
6. Phase 7 starts once tests are stable.
7. Phase 8 starts after core behavior and tests are stable.
8. Phase 9 starts after documentation baseline is in place.
9. Phase 10 starts after customer journey requirements documentation is in place.
10. Phase 11 starts after rules integration documentation is in place.

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
