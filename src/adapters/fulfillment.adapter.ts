import { ApiError } from "../types/api-error";
import { FULFILLMENT_FIXTURES } from "../data/fixtures";
import {
  readMockScenarioConfig,
  waitForDelay,
  type FulfillmentScenario,
  type MockScenarioConfig,
} from "./mock-scenarios";

export interface FulfillmentCreateInput {
  journeyId: string;
  customerId: string;
  destinationCountry?: string;
}

export interface FulfillmentCreateResult {
  accepted: boolean;
  shipmentId?: string;
}

export interface FulfillmentAdapter {
  createShipment(input: FulfillmentCreateInput): Promise<FulfillmentCreateResult>;
}

export class MockFulfillmentAdapter implements FulfillmentAdapter {
  constructor(private readonly config: MockScenarioConfig = readMockScenarioConfig()) {}

  async createShipment(input: FulfillmentCreateInput): Promise<FulfillmentCreateResult> {
    await waitForDelay(this.config.fulfillmentDelayMs);

    return this.handleScenario(this.config.fulfillmentScenario, input);
  }

  private handleScenario(
    scenario: FulfillmentScenario,
    input: FulfillmentCreateInput,
  ): FulfillmentCreateResult {
    // Fulfillment timeout has a dedicated error code to keep scenario assertions explicit.
    if (scenario === "timeout") {
      throw new ApiError("FULFILLMENT_TIMEOUT", "Fulfillment service timeout in mock scenario", 503);
    }

    return {
      accepted: true,
      shipmentId: `${FULFILLMENT_FIXTURES.shipmentPrefix}${input.journeyId}`,
    };
  }
}

export function createFulfillmentAdapter(): FulfillmentAdapter {
  return new MockFulfillmentAdapter();
}
