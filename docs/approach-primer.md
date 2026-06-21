# Approach Primer for This POC

This document explains the design approach used in this repository and why it is a good fit for a proof-of-concept phase.

## Problem this approach solves

During early API delivery, teams usually need all of the following at the same time:

- frontend/backend parallel work
- predictable demos and tests
- clear failure behavior
- room to evolve without rewriting public contracts

This POC approach addresses those needs with contract-first design, deterministic mocks, and explicit orchestration boundaries.

## Principles in use

### 1) Contract-first API

- OpenAPI is defined before implementation changes.
- Handlers and service behavior conform to the documented contract.
- Client teams can integrate earlier with fewer surprises.

Why it helps in a POC:
- You can validate interface quality before infrastructure complexity.

### 2) Journey as a step-based resource

- A single journey resource progresses across named checkout steps.
- Each step update is explicit and traceable.

Why it helps in a POC:
- Mirrors real UX flows and allows partial progress checks.

### 3) Deterministic downstream adapters

- Inventory, payment, and fulfillment are mocked with scenario flags.
- The same input conditions produce the same outcomes every run.

Why it helps in a POC:
- Reliable demos, stable tests, and faster debugging.

### 4) Canonical envelope and stable error taxonomy

- Success and error responses include request tracing metadata.
- Stable codes let clients and QA automate behavior checks.

Why it helps in a POC:
- Stakeholders can reason about behavior from contracts, not log spelunking.

### 5) Policy via rules config

- rules.yaml externalizes policy checks from route definitions.
- Evaluation order is deterministic.

Why it helps in a POC:
- Business logic can evolve in controlled increments with focused tests.

## Tradeoffs and why they are acceptable here

1. In-memory storage instead of a database.
   - Tradeoff: no persistence across restarts.
   - Benefit: lower setup cost and faster iteration.

2. Mocked adapters instead of real dependencies.
   - Tradeoff: does not expose real integration failures yet.
   - Benefit: deterministic behavior for learning and confidence.

3. Lightweight rule validation instead of full schema engine.
   - Tradeoff: narrower config safety guarantees.
   - Benefit: simpler implementation while proving policy integration shape.

## Evolution path to production-aligned architecture

1. Replace in-memory store with durable persistence behind the same service boundary.
2. Add authN/authZ middleware and route-level policy where needed.
3. Move from mock adapters to real downstream clients incrementally.
4. Harden rules config validation with stronger schema guarantees.
5. Expand observability with policy evaluation metrics and dashboards.

## How to teach this approach quickly

1. Start from the request lifecycle diagram.
2. Show one happy and one degraded flow end-to-end.
3. Tie each flow to a test case.
4. Show one rules.yaml change and the resulting behavior difference.
5. Close with production evolution path.

## Anti-patterns to avoid during expansion

- Adding business orchestration directly in route handlers.
- Introducing random failure simulation in core tests.
- Returning inconsistent error shapes across endpoints.
- Growing rules without adding deterministic test coverage.

## Summary

For this POC, the approach optimizes for clarity and confidence: contract-first interfaces, deterministic behavior, and explicit boundaries keep learning velocity high without hiding future production concerns.
