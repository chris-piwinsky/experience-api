"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiError = void 0;
class ApiError extends Error {
    code;
    status;
    details;
    constructor(code, message, status, details) {
        super(message);
        this.name = "ApiError";
        this.code = code;
        this.status = status;
        this.details = details;
    }
}
exports.ApiError = ApiError;
