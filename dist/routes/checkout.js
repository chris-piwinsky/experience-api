"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkoutRouter = void 0;
const express_1 = require("express");
const checkout_service_1 = require("../services/checkout.service");
const api_error_1 = require("../types/api-error");
const checkout_1 = require("../types/checkout");
exports.checkoutRouter = (0, express_1.Router)();
const checkoutService = (0, checkout_service_1.createCheckoutService)();
function requestContext(res) {
    return {
        requestId: res.locals.requestId,
        correlationId: res.locals.correlationId,
        timestamp: new Date().toISOString(),
    };
}
function readPathParam(value, name) {
    if (!value) {
        throw new api_error_1.ApiError("VALIDATION_ERROR", `Missing required path parameter: ${name}`, 400);
    }
    // Express can expose repeated path params as arrays; this API contract expects a single value.
    return Array.isArray(value) ? value[0] : value;
}
exports.checkoutRouter.post("/journeys", (req, res, next) => {
    try {
        const ctx = requestContext(res);
        const journey = checkoutService.createJourney({
            customerId: req.body?.customerId,
            currency: req.body?.currency,
            locale: req.body?.locale,
        });
        res.status(201).json({
            data: journey,
            requestId: ctx.requestId,
            correlationId: ctx.correlationId,
            timestamp: ctx.timestamp,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.checkoutRouter.get("/journeys/:journeyId", (req, res, next) => {
    try {
        const ctx = requestContext(res);
        const journeyId = readPathParam(req.params.journeyId, "journeyId");
        const journey = checkoutService.getJourneyById(journeyId);
        res.status(200).json({
            data: journey,
            requestId: ctx.requestId,
            correlationId: ctx.correlationId,
            timestamp: ctx.timestamp,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.checkoutRouter.patch("/journeys/:journeyId/steps/:stepId", (req, res, next) => {
    try {
        const ctx = requestContext(res);
        const journeyId = readPathParam(req.params.journeyId, "journeyId");
        const stepId = readPathParam(req.params.stepId, "stepId");
        if (!checkout_1.CHECKOUT_STEP_IDS.includes(stepId)) {
            throw new api_error_1.ApiError("VALIDATION_ERROR", `Unsupported stepId: ${stepId}`, 400);
        }
        // Step payloads are schema-light in MVP, but must always be an object for service processing.
        if (!req.body || typeof req.body.payload !== "object" || req.body.payload === null) {
            throw new api_error_1.ApiError("VALIDATION_ERROR", "payload object is required", 400);
        }
        const journey = checkoutService.updateJourneyStep(journeyId, stepId, req.body.payload);
        res.status(200).json({
            data: journey,
            requestId: ctx.requestId,
            correlationId: ctx.correlationId,
            timestamp: ctx.timestamp,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.checkoutRouter.post("/journeys/:journeyId/validate", (req, res, next) => {
    try {
        const ctx = requestContext(res);
        const journeyId = readPathParam(req.params.journeyId, "journeyId");
        const result = checkoutService.validateJourney(journeyId);
        res.status(200).json({
            data: result,
            requestId: ctx.requestId,
            correlationId: ctx.correlationId,
            timestamp: ctx.timestamp,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.checkoutRouter.post("/journeys/:journeyId/submit", async (req, res, next) => {
    try {
        const ctx = requestContext(res);
        const journeyId = readPathParam(req.params.journeyId, "journeyId");
        const journey = await checkoutService.submitJourney(journeyId);
        res.status(200).json({
            data: journey,
            requestId: ctx.requestId,
            correlationId: ctx.correlationId,
            timestamp: ctx.timestamp,
        });
    }
    catch (error) {
        next(error);
    }
});
