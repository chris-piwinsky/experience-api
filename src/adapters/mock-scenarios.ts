export type InventoryScenario = "success" | "out_of_stock" | "timeout";
export type PaymentScenario = "success" | "declined" | "timeout";
export type FulfillmentScenario = "success" | "timeout";

export interface MockScenarioConfig {
  mockMode: boolean;
  inventoryScenario: InventoryScenario;
  paymentScenario: PaymentScenario;
  fulfillmentScenario: FulfillmentScenario;
  inventoryDelayMs: number;
  paymentDelayMs: number;
  fulfillmentDelayMs: number;
}

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  return value.toLowerCase() === "true";
}

function parseDelay(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function parseScenario<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  defaultValue: T,
): T {
  if (!value) {
    return defaultValue;
  }

  // Invalid scenario values fail closed to defaults so local and CI runs remain deterministic.
  return (allowed as readonly string[]).includes(value) ? (value as T) : defaultValue;
}

export function readMockScenarioConfig(env: NodeJS.ProcessEnv = process.env): MockScenarioConfig {
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

export async function waitForDelay(delayMs: number): Promise<void> {
  if (delayMs <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, delayMs));
}
