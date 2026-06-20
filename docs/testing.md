# Testing Guide

Tests are deterministic by design and use scenario flags instead of randomness.

## Test suites

- Unit tests:
  - src/__tests__/unit/checkout.service.test.ts
  - src/__tests__/unit/adapters.test.ts
- Integration tests:
  - src/__tests__/integration/checkout.api.test.ts

## Run all tests

```bash
npm test
```

## Recommended local validation sequence

```bash
npm run build
npm test
```

## Deterministic degraded scenarios

Integration coverage includes:

- payment declined (MOCK_PAYMENT_SCENARIO=declined)
- inventory unavailable (MOCK_INVENTORY_SCENARIO=out_of_stock)
- fulfillment timeout (MOCK_FULFILLMENT_SCENARIO=timeout)

These cases assert:

- stable error codes
- expected status codes
- canonical error envelope fields
- requestId and correlationId propagation

## Manual scenario checks

Run the server with a forced scenario and call submit:

```bash
MOCK_PAYMENT_SCENARIO=declined npm run dev
```

Then submit a ready journey and verify code PAYMENT_DECLINED.

## Notes

- Keep mock delays at 0 for stable test runtime.
- Avoid introducing random failure behavior in MVP tests.
