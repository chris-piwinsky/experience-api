"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckoutService = void 0;
exports.createCheckoutService = createCheckoutService;
const crypto_1 = require("crypto");
const fulfillment_adapter_1 = require("../adapters/fulfillment.adapter");
const inventory_adapter_1 = require("../adapters/inventory.adapter");
const payment_adapter_1 = require("../adapters/payment.adapter");
const journeys_store_1 = require("../data/journeys.store");
const api_error_1 = require("../types/api-error");
const checkout_1 = require("../types/checkout");
const STEP_PREREQUISITES = {
    "shipping-address": ["cart"],
    "delivery-method": ["shipping-address"],
    "payment-method": ["delivery-method"],
    "billing-address": ["payment-method"],
    "promo-code": ["cart"],
    "review-submit": ["cart", "shipping-address", "delivery-method", "payment-method"],
};
class CheckoutService {
    store;
    inventoryAdapter;
    paymentAdapter;
    fulfillmentAdapter;
    constructor(store, inventoryAdapter, paymentAdapter, fulfillmentAdapter) {
        this.store = store;
        this.inventoryAdapter = inventoryAdapter;
        this.paymentAdapter = paymentAdapter;
        this.fulfillmentAdapter = fulfillmentAdapter;
    }
    createJourney(input) {
        if (!input.customerId || !input.currency) {
            throw new api_error_1.ApiError("VALIDATION_ERROR", "customerId and currency are required", 400);
        }
        const now = new Date().toISOString();
        const journey = {
            id: (0, crypto_1.randomUUID)(),
            customerId: input.customerId,
            status: "initiated",
            steps: (0, checkout_1.createInitialSteps)(),
            validationIssues: [],
            submittedOrderId: null,
            createdAt: now,
            updatedAt: now,
        };
        return this.store.create(journey);
    }
    getJourneyById(journeyId) {
        const journey = this.store.getById(journeyId);
        if (!journey) {
            throw new api_error_1.ApiError("JOURNEY_NOT_FOUND", "Checkout journey was not found", 404);
        }
        return journey;
    }
    updateJourneyStep(journeyId, stepId, payload) {
        const journey = this.getJourneyById(journeyId);
        this.assertStepPrerequisites(journey, stepId);
        const now = new Date().toISOString();
        const nextJourney = {
            ...journey,
            steps: {
                ...journey.steps,
                [stepId]: {
                    completed: true,
                    payload,
                    updatedAt: now,
                },
            },
            validationIssues: [],
            status: this.computeJourneyStatus({
                ...journey,
                steps: {
                    ...journey.steps,
                    [stepId]: {
                        completed: true,
                        payload,
                        updatedAt: now,
                    },
                },
            }),
            updatedAt: now,
        };
        return this.store.update(nextJourney);
    }
    validateJourney(journeyId) {
        const journey = this.getJourneyById(journeyId);
        const issues = this.computeValidationIssues(journey);
        return {
            valid: issues.length === 0,
            issues,
        };
    }
    async submitJourney(journeyId) {
        const journey = this.getJourneyById(journeyId);
        const validationResult = this.validateJourney(journeyId);
        // Validation issues are flattened into API error details so clients can render field-level messages.
        if (!validationResult.valid) {
            throw new api_error_1.ApiError("VALIDATION_ERROR", "Checkout journey is not ready for submit", 400, validationResult.issues.map((issue) => ({
                field: issue.fieldPath,
                reason: issue.message,
            })));
        }
        const cartPayload = (journey.steps.cart.payload ?? {});
        const paymentPayload = (journey.steps["payment-method"].payload ?? {});
        const shippingPayload = (journey.steps["shipping-address"].payload ?? {});
        // Submit orchestration uses minimal payload shape to keep adapters isolated from route body details.
        const items = Array.isArray(cartPayload.items)
            ? cartPayload.items.map((item) => ({
                sku: item.sku,
                quantity: item.quantity,
            }))
            : [];
        const inventoryReservation = await this.inventoryAdapter.reserveItems({
            journeyId,
            items,
        });
        if (!inventoryReservation.reserved) {
            throw new api_error_1.ApiError("INVENTORY_UNAVAILABLE", "Inventory is unavailable for one or more items", 409);
        }
        const paymentAuthorization = await this.paymentAdapter.authorize({
            journeyId,
            amount: Number(cartPayload.totalAmount ?? 0),
            currency: "USD",
            method: String(paymentPayload.method ?? "unknown"),
        });
        if (!paymentAuthorization.authorized) {
            throw new api_error_1.ApiError("PAYMENT_DECLINED", "Payment authorization failed", 409);
        }
        const fulfillmentResult = await this.fulfillmentAdapter.createShipment({
            journeyId,
            customerId: journey.customerId,
            destinationCountry: String(shippingPayload.country ?? "US"),
        });
        if (!fulfillmentResult.accepted) {
            // Defensive mapping for any non-timeout negative fulfillment outcome.
            throw new api_error_1.ApiError("DEPENDENCY_FAILURE", "Fulfillment did not accept shipment", 503);
        }
        const now = new Date().toISOString();
        const submittedJourney = {
            ...journey,
            status: "submitted",
            submittedOrderId: fulfillmentResult.shipmentId ?? (0, crypto_1.randomUUID)(),
            validationIssues: [],
            updatedAt: now,
        };
        return this.store.update(submittedJourney);
    }
    assertStepPrerequisites(journey, stepId) {
        const requiredSteps = STEP_PREREQUISITES[stepId] ?? [];
        // Prerequisite guard keeps step progression deterministic and prevents partial submit state.
        for (const requiredStep of requiredSteps) {
            if (!journey.steps[requiredStep].completed) {
                throw new api_error_1.ApiError("STEP_CONFLICT", `${requiredStep} must be completed before ${stepId}`, 409);
            }
        }
    }
    computeJourneyStatus(journey) {
        if (journey.status === "submitted" || journey.status === "failed") {
            return journey.status;
        }
        const requiredForSubmit = [
            "cart",
            "shipping-address",
            "delivery-method",
            "payment-method",
            "review-submit",
        ];
        const isReady = requiredForSubmit.every((step) => journey.steps[step].completed);
        if (isReady) {
            return "ready_for_submit";
        }
        // Any completed step moves status out of initiated even when submit requirements are not satisfied.
        const hasAnyCompleted = Object.values(journey.steps).some((step) => step.completed);
        return hasAnyCompleted ? "in_progress" : "initiated";
    }
    computeValidationIssues(journey) {
        const issues = [];
        const requiredForSubmit = [
            "cart",
            "shipping-address",
            "delivery-method",
            "payment-method",
            "review-submit",
        ];
        for (const step of requiredForSubmit) {
            if (!journey.steps[step].completed) {
                issues.push({
                    code: "VALIDATION_ERROR",
                    message: `${step} must be completed before submit`,
                    stepId: step,
                    fieldPath: `steps.${step}`,
                    severity: "error",
                });
            }
        }
        return issues;
    }
}
exports.CheckoutService = CheckoutService;
function createCheckoutService(store = new journeys_store_1.InMemoryJourneysStore(), inventoryAdapter = (0, inventory_adapter_1.createInventoryAdapter)(), paymentAdapter = (0, payment_adapter_1.createPaymentAdapter)(), fulfillmentAdapter = (0, fulfillment_adapter_1.createFulfillmentAdapter)()) {
    return new CheckoutService(store, inventoryAdapter, paymentAdapter, fulfillmentAdapter);
}
