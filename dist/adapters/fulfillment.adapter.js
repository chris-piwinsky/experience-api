"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockFulfillmentAdapter = void 0;
exports.createFulfillmentAdapter = createFulfillmentAdapter;
const api_error_1 = require("../types/api-error");
const fixtures_1 = require("../data/fixtures");
const mock_scenarios_1 = require("./mock-scenarios");
class MockFulfillmentAdapter {
    config;
    constructor(config = (0, mock_scenarios_1.readMockScenarioConfig)()) {
        this.config = config;
    }
    async createShipment(input) {
        await (0, mock_scenarios_1.waitForDelay)(this.config.fulfillmentDelayMs);
        return this.handleScenario(this.config.fulfillmentScenario, input);
    }
    handleScenario(scenario, input) {
        // Fulfillment timeout has a dedicated error code to keep scenario assertions explicit.
        if (scenario === "timeout") {
            throw new api_error_1.ApiError("FULFILLMENT_TIMEOUT", "Fulfillment service timeout in mock scenario", 503);
        }
        return {
            accepted: true,
            shipmentId: `${fixtures_1.FULFILLMENT_FIXTURES.shipmentPrefix}${input.journeyId}`,
        };
    }
}
exports.MockFulfillmentAdapter = MockFulfillmentAdapter;
function createFulfillmentAdapter() {
    return new MockFulfillmentAdapter();
}
