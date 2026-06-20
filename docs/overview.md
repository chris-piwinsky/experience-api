# Customer Experience API Documentation Overview

This folder contains the detailed project documentation for the checkout journey API.

## Documents

- [quickstart.md](quickstart.md): install, run, and first request flow.
- [testing.md](testing.md): unit and integration test execution, deterministic degraded scenarios.
- [postman-guide.md](postman-guide.md): Postman environment setup, collection flow, payloads, and scenario matrix.
- [api-reference.md](api-reference.md): endpoint and envelope summary aligned with openapi.yaml.
- [architecture.md](architecture.md): app structure, request lifecycle, and component responsibilities.
- [mock-scenarios.md](mock-scenarios.md): deterministic mock toggles and expected behavior.
- [customer-journey-requirements.md](customer-journey-requirements.md): business meaning, requirements, and acceptance boundaries for the checkout journey.
- [rules-integration-and-expansion.md](rules-integration-and-expansion.md): rules.yaml integration, evaluation order, and dynamic expansion guidance.

## Suggested Reading Order

1. [quickstart.md](quickstart.md)
2. [postman-guide.md](postman-guide.md)
3. [testing.md](testing.md)
4. [api-reference.md](api-reference.md)
5. [customer-journey-requirements.md](customer-journey-requirements.md)
6. [rules-integration-and-expansion.md](rules-integration-and-expansion.md)
7. [architecture.md](architecture.md)
8. [mock-scenarios.md](mock-scenarios.md)

## Source of truth

- API contract: [openapi.yaml](../openapi.yaml)
- Working implementation plan: [checkout-journey-execution-plan.md](../checkout-journey-execution-plan.md)

## Postman assets

- [postman/Customer-Experience-API.postman_collection.json](../postman/Customer-Experience-API.postman_collection.json)
- [postman/Local-Checkout-API.postman_environment.json](../postman/Local-Checkout-API.postman_environment.json)

Use README.md in the repository root as the primary entry point for this documentation set.
