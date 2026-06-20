# Mock Scenario Configuration

Mock behavior is controlled by environment variables and is deterministic.

## Scenario Resolution Diagram

```mermaid
flowchart TD
	Env[Read environment variable] --> Present{Value present?}
	Present -- No --> Default[Use default scenario]
	Present -- Yes --> Allowed{Value allowed?}
	Allowed -- No --> Default
	Allowed -- Yes --> UseValue[Use provided scenario]
```

## Core toggles

- MOCK_MODE=true
- MOCK_INVENTORY_SCENARIO=success|out_of_stock|timeout
- MOCK_PAYMENT_SCENARIO=success|declined|timeout
- MOCK_FULFILLMENT_SCENARIO=success|timeout

## Optional delay controls

- MOCK_INVENTORY_DELAY_MS=0
- MOCK_PAYMENT_DELAY_MS=0
- MOCK_FULFILLMENT_DELAY_MS=0

## Expected behavior by scenario

### Inventory

- success: reserveItems returns reserved true with deterministic reservationId
- out_of_stock: reserveItems returns reserved false
- timeout: reserveItems throws INVENTORY_UNAVAILABLE with 503

### Payment

- success: authorize returns authorized true with deterministic transactionId
- declined: authorize returns authorized false
- timeout: authorize throws DEPENDENCY_FAILURE with 503

### Fulfillment

- success: createShipment returns accepted true with deterministic shipmentId
- timeout: createShipment throws FULFILLMENT_TIMEOUT with 503

## Submit Scenario Decision Diagram

```mermaid
flowchart TD
	Submit([Submit request]) --> InvS{Inventory scenario}
	InvS -- timeout --> InvTO[503 INVENTORY_UNAVAILABLE]
	InvS -- out_of_stock --> InvOOS[409 INVENTORY_UNAVAILABLE]
	InvS -- success --> PayS{Payment scenario}

	PayS -- timeout --> PayTO[503 DEPENDENCY_FAILURE]
	PayS -- declined --> PayDeclined[409 PAYMENT_DECLINED]
	PayS -- success --> FulS{Fulfillment scenario}

	FulS -- timeout --> FulTO[503 FULFILLMENT_TIMEOUT]
	FulS -- success --> Submitted[200 submitted]
```

## Health endpoint mapping

GET /health reports:

- ok when all scenarios are success
- degraded when any scenario is non-success

```mermaid
flowchart LR
	Inv[Inventory status] --> Any{Any degraded?}
	Pay[Payment status] --> Any
	Ful[Fulfillment status] --> Any
	Any -- Yes --> Degraded[Health status: degraded]
	Any -- No --> Ok[Health status: ok]
```

## Rules and Scenario Interplay

Rules-based field and eligibility validation is planned to run before submit orchestration.

```mermaid
flowchart TD
	Req[Submit attempt] --> Rules{Rules validation passes?}
	Rules -- No --> RulesErr[400 VALIDATION_ERROR or 409 CUSTOMER_NOT_ELIGIBLE]
	Rules -- Yes --> ScenarioPath[Evaluate deterministic adapter scenarios]
	ScenarioPath --> ScenarioResult[Submit success or deterministic dependency error]
```

## Testing recommendations

- Keep all delays at 0 for fast and stable CI.
- Set one degraded scenario at a time for clear assertions.
