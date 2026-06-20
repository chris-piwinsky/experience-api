import { ApiError } from "../types/api-error";
import { INVENTORY_FIXTURES, type FixtureOrderItem } from "../data/fixtures";
import {
  readMockScenarioConfig,
  waitForDelay,
  type InventoryScenario,
  type MockScenarioConfig,
} from "./mock-scenarios";

// Mock inventory adapter with deterministic scenario behavior.
// Scenarios are controlled via MOCK_INVENTORY_SCENARIO env var.
// success: reservation succeeds with deterministic ID
// out_of_stock: reservation fails without throwing
// timeout: simulates service outage, throws 503 INVENTORY_UNAVAILABLE

export interface InventoryReservationInput {
  journeyId: string;
  items: FixtureOrderItem[];
}

export interface InventoryReservationResult {
  reserved: boolean;
  reservationId?: string;
  unavailableSkus?: string[];
}

export interface InventoryAdapter {
  reserveItems(input: InventoryReservationInput): Promise<InventoryReservationResult>;
}

export class MockInventoryAdapter implements InventoryAdapter {
  constructor(private readonly config: MockScenarioConfig = readMockScenarioConfig()) {}

  async reserveItems(input: InventoryReservationInput): Promise<InventoryReservationResult> {
    await waitForDelay(this.config.inventoryDelayMs);

    return this.handleScenario(this.config.inventoryScenario, input);
  }

  private handleScenario(
    scenario: InventoryScenario,
    input: InventoryReservationInput,
  ): InventoryReservationResult {
    // Timeout throws to exercise API-level dependency failure behavior in a deterministic way.
    if (scenario === "timeout") {
      throw new ApiError("INVENTORY_UNAVAILABLE", "Inventory service timeout in mock scenario", 503);
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
      reservationId: `${INVENTORY_FIXTURES.reservedReferencePrefix}${input.journeyId}`,
    };
  }
}

export function createInventoryAdapter(): InventoryAdapter {
  return new MockInventoryAdapter();
}
