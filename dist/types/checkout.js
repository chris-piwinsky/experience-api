"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHECKOUT_STEP_IDS = void 0;
exports.createEmptyStepState = createEmptyStepState;
exports.createInitialSteps = createInitialSteps;
exports.CHECKOUT_STEP_IDS = [
    "cart",
    "shipping-address",
    "delivery-method",
    "payment-method",
    "billing-address",
    "promo-code",
    "review-submit",
];
function createEmptyStepState() {
    return {
        completed: false,
        payload: null,
        updatedAt: null,
    };
}
function createInitialSteps() {
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
