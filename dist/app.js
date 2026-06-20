"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const mock_scenarios_1 = require("./adapters/mock-scenarios");
const error_handler_1 = require("./middleware/error-handler");
const correlation_id_1 = require("./middleware/correlation-id");
const request_logger_1 = require("./middleware/request-logger");
const checkout_1 = require("./routes/checkout");
function createApp() {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json());
    app.use(correlation_id_1.correlationIdMiddleware);
    app.use(request_logger_1.requestLoggerMiddleware);
    app.get("/health", (_req, res) => {
        const config = (0, mock_scenarios_1.readMockScenarioConfig)();
        const inventoryStatus = config.inventoryScenario === "success" ? "ok" : "degraded";
        const paymentStatus = config.paymentScenario === "success" ? "ok" : "degraded";
        const fulfillmentStatus = config.fulfillmentScenario === "success" ? "ok" : "degraded";
        const overallStatus = inventoryStatus === "ok" && paymentStatus === "ok" && fulfillmentStatus === "ok"
            ? "ok"
            : "degraded";
        res.status(200).json({
            status: overallStatus,
            requestId: res.locals.requestId,
            correlationId: res.locals.correlationId,
            timestamp: new Date().toISOString(),
            checks: {
                inventory: { status: inventoryStatus, scenario: config.inventoryScenario },
                payment: { status: paymentStatus, scenario: config.paymentScenario },
                fulfillment: { status: fulfillmentStatus, scenario: config.fulfillmentScenario },
            },
        });
    });
    app.use("/v1/checkout", checkout_1.checkoutRouter);
    app.use(error_handler_1.notFoundHandler);
    app.use(error_handler_1.errorHandler);
    return app;
}
