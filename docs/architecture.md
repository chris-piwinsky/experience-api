# Architecture

This service follows a contract-first Express + TypeScript structure with mocked downstream dependencies.

## System Architecture Diagram

```mermaid
flowchart LR
  Client[Client App or API Client] --> App[Express App]
  App --> MW[Middleware Layer]
  MW --> Routes[Checkout Routes]
  Routes --> Service[Checkout Service]
  Service --> Store[(InMemory Journeys Store)]
  Service --> Inv[Inventory Adapter]
  Service --> Pay[Payment Adapter]
  Service --> Ful[Fulfillment Adapter]
  Inv --> Scenarios[Mock Scenario Config]
  Pay --> Scenarios
  Ful --> Scenarios
```

## High-level components

- src/index.ts
  - process bootstrap and HTTP listen
- src/app.ts
  - middleware wiring and route registration
- src/routes/checkout.ts
  - HTTP handlers and envelope responses
- src/services/checkout.service.ts
  - journey lifecycle orchestration and submit flow
- src/data/journeys.store.ts
  - in-memory persistence abstraction
- src/adapters/*.adapter.ts
  - deterministic mock integrations for inventory, payment, fulfillment
- src/middleware/*.ts
  - correlation/request IDs, structured logging, centralized errors

## Request lifecycle

1. Request enters app middleware.
2. Correlation/request IDs are established and propagated.
3. Route handler calls checkout service.
4. Service uses in-memory store and mock adapters.
5. Response envelope includes data plus requestId/correlationId/timestamp.
6. Request logger emits one structured completion log per request.

## Flow Stage Legend

Use this legend when filtering `flow_stage` and `flow_stage_error` logs during demos.

| Flow stage | Architecture layer | Meaning |
| --- | --- | --- |
| route.create_journey.enter | Routes | Create-journey request entered HTTP handler |
| route.create_journey.response | Routes | Create-journey response sent |
| route.get_journey.enter | Routes | Get-journey request entered HTTP handler |
| route.get_journey.response | Routes | Get-journey response sent |
| route.update_step.enter | Routes | Step update request entered HTTP handler |
| route.update_step.response | Routes | Step update response sent |
| route.validate_journey.enter | Routes | Validate request entered HTTP handler |
| route.validate_journey.response | Routes | Validate response sent |
| route.submit_journey.enter | Routes | Submit request entered HTTP handler |
| route.submit_journey.response | Routes | Submit response sent |
| service.create_journey.start/completed | Service | Create journey orchestration start and finish |
| service.get_journey.start/completed | Service | Journey lookup start and finish |
| service.update_step.start/completed | Service | Step update orchestration start and finish |
| service.rules.step_update.start/completed | Rules service | Step-level policy checks start and finish |
| service.validate_journey.start/completed | Service | Validate orchestration start and finish |
| service.rules.validate.start/completed | Rules service | Validate policy checks start and finish |
| service.submit_journey.start/completed | Service | Submit orchestration start and finish |
| service.rules.submit.start/completed | Rules service | Pre-submit policy checks start and finish |
| service.adapter.inventory.reserve.start/completed | Inventory adapter | Inventory reservation attempt and outcome |
| service.adapter.payment.authorize.start/completed | Payment adapter | Payment authorization attempt and outcome |
| service.adapter.fulfillment.create_shipment.start/completed | Fulfillment adapter | Shipment creation attempt and outcome |
| route.*.error, service.submit_journey.error | Route or service | Error event with canonical errorCode and message |

## Request Sequence Diagram

```mermaid
sequenceDiagram
  participant C as Client
  participant A as App Middleware
  participant R as Route Handler
  participant S as Checkout Service
  participant D as Adapters and Store

  C->>A: HTTP request with optional IDs
  A->>A: set requestId and correlationId
  A->>R: forward request
  R->>S: call use-case method
  S->>D: read or write journey and call adapters
  D-->>S: deterministic result or typed error
  S-->>R: domain response or ApiError
  R-->>A: success payload or next(error)
  A-->>C: canonical envelope with IDs
  A->>A: emit structured completion log
```

## Submit orchestration path

On POST /v1/checkout/journeys/{journeyId}/submit:

1. Validate required steps are complete.
2. Reserve inventory.
3. Authorize payment.
4. Create fulfillment shipment.
5. Return submitted journey with submittedOrderId.

Deterministic failures are surfaced as canonical API errors.

## Submit Decision Diagram

```mermaid
flowchart TD
  Start([POST submit]) --> Validate{Required steps complete?}
  Validate -- No --> VErr[400 VALIDATION_ERROR]
  Validate -- Yes --> Inv{Inventory reserved?}
  Inv -- No --> IErr[409 INVENTORY_UNAVAILABLE]
  Inv -- Yes --> Pay{Payment authorized?}
  Pay -- No --> PErr[409 PAYMENT_DECLINED]
  Pay -- Yes --> Ful{Fulfillment accepted?}
  Ful -- No --> DErr[503 DEPENDENCY_FAILURE or FULFILLMENT_TIMEOUT]
  Ful -- Yes --> Ok[200 submitted journey]
```

## Design constraints

- No real downstream calls in MVP.
- No random failures in test flows.
- In-memory store is used by default.
