export const CHECKOUT_STEP_IDS = [
  "cart",
  "shipping-address",
  "delivery-method",
  "payment-method",
  "billing-address",
  "promo-code",
  "review-submit",
] as const;

export type CheckoutStepId = (typeof CHECKOUT_STEP_IDS)[number];

export type CheckoutStatus =
  | "initiated"
  | "in_progress"
  | "ready_for_submit"
  | "submitted"
  | "failed";

export type StepPayload = Record<string, unknown> | null;

export interface StepState {
  completed: boolean;
  payload: StepPayload;
  updatedAt: string | null;
}

export interface CheckoutSteps {
  cart: StepState;
  "shipping-address": StepState;
  "delivery-method": StepState;
  "payment-method": StepState;
  "billing-address": StepState;
  "promo-code": StepState;
  "review-submit": StepState;
}

export interface ValidationIssue {
  ruleId?: string;
  code: string;
  message: string;
  stepId?: string;
  fieldPath?: string;
  severity?: "error" | "warning";
}

export interface CheckoutJourney {
  id: string;
  customerId: string;
  status: CheckoutStatus;
  steps: CheckoutSteps;
  validationIssues: ValidationIssue[];
  submittedOrderId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateJourneyInput {
  customerId: string;
  currency: string;
  locale?: string;
}

export interface UpdateStepInput {
  journeyId: string;
  stepId: CheckoutStepId;
  payload: Record<string, unknown>;
}

export function createEmptyStepState(): StepState {
  return {
    completed: false,
    payload: null,
    updatedAt: null,
  };
}

export function createInitialSteps(): CheckoutSteps {
  return {
    cart: createEmptyStepState(),
    "shipping-address": createEmptyStepState(),
    "delivery-method": createEmptyStepState(),
    "payment-method": createEmptyStepState(),
    "billing-address": createEmptyStepState(),
    "promo-code": createEmptyStepState(),
    "review-submit": createEmptyStepState(),
  };
}
