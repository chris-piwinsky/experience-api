"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readMockScenarioConfig = readMockScenarioConfig;
exports.waitForDelay = waitForDelay;
function parseBool(value, defaultValue) {
    if (value === undefined) {
        return defaultValue;
    }
    return value.toLowerCase() === "true";
}
function parseDelay(value) {
    if (!value) {
        return 0;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
function parseScenario(value, allowed, defaultValue) {
    if (!value) {
        return defaultValue;
    }
    // Invalid scenario values fail closed to defaults so local and CI runs remain deterministic.
    return allowed.includes(value) ? value : defaultValue;
}
function readMockScenarioConfig(env = process.env) {
    return {
        mockMode: parseBool(env.MOCK_MODE, true),
        inventoryScenario: parseScenario(env.MOCK_INVENTORY_SCENARIO, ["success", "out_of_stock", "timeout"], "success"),
        paymentScenario: parseScenario(env.MOCK_PAYMENT_SCENARIO, ["success", "declined", "timeout"], "success"),
        fulfillmentScenario: parseScenario(env.MOCK_FULFILLMENT_SCENARIO, ["success", "timeout"], "success"),
        inventoryDelayMs: parseDelay(env.MOCK_INVENTORY_DELAY_MS),
        paymentDelayMs: parseDelay(env.MOCK_PAYMENT_DELAY_MS),
        fulfillmentDelayMs: parseDelay(env.MOCK_FULFILLMENT_DELAY_MS),
    };
}
async function waitForDelay(delayMs) {
    if (delayMs <= 0) {
        return;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
}
