# POC Demo Playbook

Use this script to run a clear, repeatable live demo of the checkout journey API in 15 to 25 minutes.

## Audience and objective

- Audience: engineering leads, product partners, QA, and stakeholders evaluating approach fit.
- Objective: show that this API design is understandable, testable, and deterministic enough for iterative delivery.

## Core messages to land

1. Contract-first keeps frontend and backend aligned early.
2. Step-based journey endpoints map cleanly to real checkout UX flows.
3. Deterministic mocks make demos and tests reliable.
4. Stable error codes plus request tracing make support and QA faster.
5. Rules are policy-as-config and can expand without route churn.

## Demo flow (recommended)

1. Show architecture map
2. Run happy-path checkout journey
3. Run one degraded scenario
4. Run one policy/rule scenario
5. Show traceability and tests
6. Close with tradeoffs and next steps

## Before you start

1. Start API in success mode:

```bash
npm run build
npm start
```

2. Keep these docs open for visual support:
  - architecture.md
  - mock-scenarios.md
  - rules-integration-and-expansion.md

3. Open Bruno collection:
  - bruno/Customer-Experience-API/requests

4. Keep a terminal visible for flow-stage logs.
  - The API now emits structured logs with message value flow_stage and stage names that map to route and service architecture boundaries.

## Live flow logging for architecture walkthrough

Use this during the demo so people can see where each request is in the stack.

1. Start server and filter flow-stage events:

```bash
npm run dev | grep '"message":"flow_stage"\|"message":"flow_stage_error"'
```

2. Trigger requests from Bruno.

3. Narrate stage progression in real time, for example:
  - route.submit_journey.enter
  - service.submit_journey.start
  - service.rules.submit.start
  - service.adapter.inventory.reserve.start
  - service.adapter.payment.authorize.start
  - service.adapter.fulfillment.create_shipment.start
  - route.submit_journey.response

4. If a degraded scenario is active, point out the error stage event:
  - message is flow_stage_error
  - stage shows where orchestration failed
  - errorCode shows the canonical API code

This is especially useful when teaching how route, service, and adapter responsibilities are separated.

## Talk track by segment

### 1) Architecture map (2 to 3 min)

- Show docs/architecture.md diagrams.
- Explain flow: middleware -> route -> service -> adapters/store.
- Emphasize separation of concerns:
  - route handles transport and envelope
  - service handles orchestration
  - adapters simulate downstream behavior

### 2) Happy path (5 to 7 min)

- Run folder: 01-Happy-Path-Full-Flow.
- Point out request and correlation IDs in each response.
- Explain why step-level PATCH is helpful for checkout UIs with save/resume behavior.
- End on submit success and note deterministic IDs.

### 3) Degraded path (3 to 4 min)

1. Restart API with one forced scenario, for example:

```bash
MOCK_PAYMENT_SCENARIO=declined npm run dev
```

2. Run Bruno folder:
  - 02-Error-Scenarios/Prepare-Ready-Journey
  - 02-Error-Scenarios/19-Submit-Payment-Declined

3. Explain outcome:
  - status code is stable
  - error code is stable
  - envelope remains consistent

### 4) Rule/policy path (3 to 4 min)

- Run one request from 03-Rule-Config-and-Validation-Scenarios.
- Show how config/rules.yaml changes behavior without route contract changes.
- Highlight that policy logic is transparent in docs and testable in integration flows.

### 5) Testing and operability (2 to 3 min)

- Show tests in src/__tests__ and run:

```bash
npm test
```

- Connect tests to business confidence:
  - happy flow
  - degraded dependency behavior
  - ID propagation

## Objection handling quick answers

- "Why not random chaos style failures?"
  - For a POC and CI reliability, deterministic outcomes are a better learning and debugging baseline.

- "Is in-memory storage realistic?"
  - It is intentionally scoped for speed; persistence is a replaceable boundary behind the service/store abstraction.

- "Can rules become too complex?"
  - Yes if unmanaged; mitigations are rule IDs, deterministic ordering, and test matrix updates per rule change.

- "Why step endpoints instead of one giant payload?"
  - Step endpoints align with UX progression, enable partial saves, and isolate validation concerns.

## Suggested closing statement

"This POC proves an approach, not final production scope: contract-first interfaces, deterministic dependencies, and observable workflows let us learn quickly while keeping upgrade paths clear for persistence, auth, and real integrations."

## Optional follow-up exercises for the team

1. Add a new eligibility rule and corresponding integration test.
2. Add one additional degraded scenario and assert canonical error behavior.
3. Replace one mock adapter with a real integration stub while keeping the same service contract.
