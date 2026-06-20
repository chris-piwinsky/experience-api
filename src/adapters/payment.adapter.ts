import { ApiError } from "../types/api-error";
import { PAYMENT_FIXTURES } from "../data/fixtures";
import {
  readMockScenarioConfig,
  waitForDelay,
  type MockScenarioConfig,
  type PaymentScenario,
} from "./mock-scenarios";

export interface PaymentAuthorizationInput {
  journeyId: string;
  amount: number;
  currency: string;
  method: string;
}

export interface PaymentAuthorizationResult {
  authorized: boolean;
  transactionId?: string;
  declineReason?: string;
}

export interface PaymentAdapter {
  authorize(input: PaymentAuthorizationInput): Promise<PaymentAuthorizationResult>;
}

export class MockPaymentAdapter implements PaymentAdapter {
  constructor(private readonly config: MockScenarioConfig = readMockScenarioConfig()) {}

  async authorize(input: PaymentAuthorizationInput): Promise<PaymentAuthorizationResult> {
    await waitForDelay(this.config.paymentDelayMs);

    return this.handleScenario(this.config.paymentScenario, input);
  }

  private handleScenario(
    scenario: PaymentScenario,
    input: PaymentAuthorizationInput,
  ): PaymentAuthorizationResult {
    // Timeout is mapped to 503 DEPENDENCY_FAILURE (not 409) to help callers distinguish
    // transient outages from business logic declines. Submit flow retries outages at orchestration level.
    if (scenario === "timeout") {
      throw new ApiError("DEPENDENCY_FAILURE", "Payment service timeout in mock scenario", 503);
    }

    if (scenario === "declined") {
      return {
        authorized: false,
        declineReason: PAYMENT_FIXTURES.declineReason,
      };
    }

    return {
      authorized: true,
      transactionId: `${PAYMENT_FIXTURES.transactionPrefix}${input.journeyId}`,
    };
  }
}

export function createPaymentAdapter(): PaymentAdapter {
  return new MockPaymentAdapter();
}
