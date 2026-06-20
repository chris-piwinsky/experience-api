"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockInventoryAdapter = void 0;
exports.createInventoryAdapter = createInventoryAdapter;
const api_error_1 = require("../types/api-error");
const fixtures_1 = require("../data/fixtures");
const mock_scenarios_1 = require("./mock-scenarios");
class MockInventoryAdapter {
    config;
    constructor(config = (0, mock_scenarios_1.readMockScenarioConfig)()) {
        this.config = config;
    }
    async reserveItems(input) {
        await (0, mock_scenarios_1.waitForDelay)(this.config.inventoryDelayMs);
        return this.handleScenario(this.config.inventoryScenario, input);
    }
    handleScenario(scenario, input) {
        // Timeout throws to exercise API-level dependency failure behavior in a deterministic way.
        if (scenario === "timeout") {
            throw new api_error_1.ApiError("INVENTORY_UNAVAILABLE", "Inventory service timeout in mock scenario", 503);
        }
        if (scenario === "out_of_stock") {
            const firstSku = input.items[0]?.sku;
            return {
                reserved: false,
                unavailableSkus: firstSku ? [firstSku] : [],
            };
        }
        return {
            reserved: true,
            reservationId: `${fixtures_1.INVENTORY_FIXTURES.reservedReferencePrefix}${input.journeyId}`,
        };
    }
}
exports.MockInventoryAdapter = MockInventoryAdapter;
function createInventoryAdapter() {
    return new MockInventoryAdapter();
}
