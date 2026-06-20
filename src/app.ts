import cors from "cors";
import express, { type Express, type Request, type Response } from "express";

import { readMockScenarioConfig } from "./adapters/mock-scenarios";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { correlationIdMiddleware } from "./middleware/correlation-id";
import { requestLoggerMiddleware } from "./middleware/request-logger";
import { checkoutRouter } from "./routes/checkout";

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);

  app.get("/health", (_req: Request, res: Response) => {
    const config = readMockScenarioConfig();
    const inventoryStatus = config.inventoryScenario === "success" ? "ok" : "degraded";
    const paymentStatus = config.paymentScenario === "success" ? "ok" : "degraded";
    const fulfillmentStatus = config.fulfillmentScenario === "success" ? "ok" : "degraded";
    const overallStatus =
      inventoryStatus === "ok" && paymentStatus === "ok" && fulfillmentStatus === "ok"
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

  app.use("/v1/checkout", checkoutRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
