"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockPaymentAdapter = void 0;
exports.createPaymentAdapter = createPaymentAdapter;
const api_error_1 = require("../types/api-error");
const fixtures_1 = require("../data/fixtures");
const mock_scenarios_1 = require("./mock-scenarios");
class MockPaymentAdapter {
    config;
    constructor(config = (0, mock_scenarios_1.readMockScenarioConfig)()) {
        this.config = config;
    }
    async authorize(input) {
        await (0, mock_scenarios_1.waitForDelay)(this.config.paymentDelayMs);
        return this.handleScenario(this.config.paymentScenario, input);
    }
    handleScenario(scenario, input) {
        // Timeout is mapped to a dependency error code so callers can distinguish declines vs outages.
        if (scenario === "timeout") {
            throw new api_error_1.ApiError("DEPENDENCY_FAILURE", "Payment service timeout in mock scenario", 503);
        }
        if (scenario === "declined") {
            return {
                authorized: false,
                declineReason: fixtures_1.PAYMENT_FIXTURES.declineReason,
            };
        }
        return {
            authorized: true,
            transactionId: `${fixtures_1.PAYMENT_FIXTURES.transactionPrefix}${input.journeyId}`,
        };
    }
}
exports.MockPaymentAdapter = MockPaymentAdapter;
function createPaymentAdapter() {
    return new MockPaymentAdapter();
}
