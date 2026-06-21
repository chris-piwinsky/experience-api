# Customer Experience API - Checkout Journey

Contract-first Express + TypeScript API for a checkout journey with deterministic mocked downstream services.

## What this project provides

- Checkout journey lifecycle endpoints
- Deterministic submit success and degraded scenarios
- Request and correlation ID propagation across responses
- Structured request logging and centralized error handling
- Unit and integration test coverage for normal and degraded paths

## Documentation map

Start here, then use the guides in docs/:

- [docs/overview.md](docs/overview.md): documentation index and reading order.
- [docs/quickstart.md](docs/quickstart.md): local setup, run steps, and first API request.
- [docs/testing.md](docs/testing.md): test suites, commands, and degraded scenario guidance.
- [docs/bruno-guide.md](docs/bruno-guide.md): Bruno setup, request flow, payloads, and scenario matrix.
- [docs/api-reference.md](docs/api-reference.md): endpoint and envelope summary aligned to OpenAPI.
- [docs/customer-journey-requirements.md](docs/customer-journey-requirements.md): customer journey meaning, requirements, and acceptance boundaries.
- [docs/rules-integration-and-expansion.md](docs/rules-integration-and-expansion.md): rules.yaml integration, evaluation behavior, and dynamic expansion guidance.
- [docs/architecture.md](docs/architecture.md): component boundaries and request lifecycle.
- [docs/mock-scenarios.md](docs/mock-scenarios.md): deterministic mock settings and expected outcomes.
- [docs/approach-primer.md](docs/approach-primer.md): architecture rationale, tradeoffs, and production evolution path.
- [docs/poc-demo-playbook.md](docs/poc-demo-playbook.md): facilitator script for running a high-confidence live POC demo.

## Fast start

1. Install dependencies:

```bash
npm install
```

2. Build and run:

```bash
npm run build
npm start
```

3. Validate health:

```bash
curl -s http://localhost:3000/health
```

For full setup and first-request instructions, see [docs/quickstart.md](docs/quickstart.md).

## Testing

Run all tests:

```bash
npm test
```

Detailed testing instructions and scenario coverage are in [docs/testing.md](docs/testing.md).

## API contract

- OpenAPI spec: [openapi.yaml](openapi.yaml)
- Endpoint and envelope summary: [docs/api-reference.md](docs/api-reference.md)

## Bruno assets

- Collection metadata: [bruno/Customer-Experience-API/bruno.json](bruno/Customer-Experience-API/bruno.json)
- Environment file: [bruno/Customer-Experience-API/environments/local.bru](bruno/Customer-Experience-API/environments/local.bru)
- Requests tree: [bruno/Customer-Experience-API/requests](bruno/Customer-Experience-API/requests)
- Usage guide: [docs/bruno-guide.md](docs/bruno-guide.md)

## Notes

- MVP uses in-memory journey storage.
- Downstreams are mocked only and controlled via env scenarios.

## References

The implementation approach and setup in this repo align with these primary sources:

- Express documentation: https://expressjs.com/
- Express error handling guide: https://expressjs.com/en/guide/error-handling.html
- Node.js HTTP and runtime docs: https://nodejs.org/docs/latest/api/
- TypeScript handbook: https://www.typescriptlang.org/docs/
- OpenAPI Specification 3.0.3: https://spec.openapis.org/oas/v3.0.3
- Jest documentation: https://jestjs.io/docs/getting-started
- SuperTest repository and usage: https://github.com/ladjs/supertest
- Bruno API Client docs: https://docs.usebruno.com/

### Patterns and Approach References (Rules + Experience API)

- Backends for Frontends (BFF) pattern: https://learn.microsoft.com/azure/architecture/patterns/backends-for-frontends
- API Gateway pattern: https://microservices.io/patterns/apigateway.html
- API Composition pattern: https://microservices.io/patterns/data/api-composition.html
- Twelve-Factor App - Config: https://12factor.net/config
- Open Policy Agent (policy-as-code concepts): https://www.openpolicyagent.org/docs/latest/
- Martin Fowler - Feature Toggles: https://martinfowler.com/articles/feature-toggles.html

