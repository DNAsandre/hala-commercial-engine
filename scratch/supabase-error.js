"use strict";
/**
 * supabase-error.ts
 * ─────────────────
 * Shared Supabase error handler.
 *
 * Replaces bare `console.error()` calls across the sync layer with
 * structured error handling: toast notification + console log + optional
 * app_errors table persistence.
 *
 * Usage:
 *   import { handleSupabaseError } from '@/lib/supabase-error';
 *   const { error } = await supabase.from('table').insert(row);
 *   if (error) handleSupabaseError('syncWorkspaceStage', error);
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecentErrors = getRecentErrors;
exports.handleSupabaseError = handleSupabaseError;
exports.setFetchError = setFetchError;
exports.clearFetchError = clearFetchError;
exports.getFetchError = getFetchError;
exports.hasFetchErrors = hasFetchErrors;
exports.getAllFetchErrors = getAllFetchErrors;
exports.clearAllFetchErrors = clearAllFetchErrors;
exports.withSupabaseErrorHandling = withSupabaseErrorHandling;
var sonner_1 = require("sonner");
// ── Error Log (in-memory ring buffer for debugging) ─────────
var ERROR_LOG_MAX = 50;
var errorLog = [];
function getRecentErrors() {
    return errorLog;
}
// ── Main Handler ────────────────────────────────────────────
/**
 * Handle a Supabase error with toast + console + optional persistence.
 *
 * @param operation - Name of the sync function (e.g., 'syncWorkspaceStage')
 * @param error - The Supabase error object
 * @param options - Optional configuration
 * @param options.silent - If true, skip the toast (useful for background syncs)
 * @param options.entityId - Entity ID for traceability
 */
function handleSupabaseError(operation, error, options) {
    var ctx = {
        operation: operation,
        error: error,
        timestamp: new Date().toISOString(),
        entityId: options === null || options === void 0 ? void 0 : options.entityId,
    };
    // 1. Console (always)
    console.error("[Supabase] ".concat(operation, " failed:"), {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        entityId: options === null || options === void 0 ? void 0 : options.entityId,
    });
    // 2. Ring buffer (always)
    errorLog.push(ctx);
    if (errorLog.length > ERROR_LOG_MAX)
        errorLog.shift();
    // 3. Toast (unless silent)
    if (!(options === null || options === void 0 ? void 0 : options.silent)) {
        var shortMsg = error.message.length > 80
            ? error.message.slice(0, 77) + '...'
            : error.message;
        sonner_1.toast.error("Sync failed: ".concat(operation), {
            description: shortMsg,
            duration: 5000,
        });
    }
    // 4. Optional: persist to app_errors table (future)
    // This is a placeholder for when we add an app_errors table.
    // persistErrorToSupabase(ctx).catch(() => {});
}
// ── Fetch Error State (per-operation last-error tracker) ────
// Allows components to distinguish "data is empty" from "fetch failed"
var fetchErrorState = new Map();
/**
 * Record a fetch error for a specific operation.
 * Called by supabase-data.ts fetchers on failure.
 */
function setFetchError(operation, error) {
    var ctx = {
        operation: operation,
        error: error,
        timestamp: new Date().toISOString(),
    };
    fetchErrorState.set(operation, ctx);
}
/**
 * Clear the fetch error for an operation (e.g., on successful retry).
 */
function clearFetchError(operation) {
    fetchErrorState.delete(operation);
}
/**
 * Get the last fetch error for a specific operation.
 * Returns null if the last fetch succeeded.
 */
function getFetchError(operation) {
    var _a;
    return (_a = fetchErrorState.get(operation)) !== null && _a !== void 0 ? _a : null;
}
/**
 * Check if ANY fetch operation is currently in error state.
 * Useful for dashboard-level health indicators.
 */
function hasFetchErrors() {
    return fetchErrorState.size > 0;
}
/**
 * Get all current fetch errors (for admin/debug views).
 */
function getAllFetchErrors() {
    return fetchErrorState;
}
/**
 * Clear all fetch errors (e.g., on full page refresh/retry).
 */
function clearAllFetchErrors() {
    fetchErrorState.clear();
}
/**
 * Wrap a Supabase operation with automatic error handling.
 * Returns true if the operation succeeded, false if it failed.
 */
function withSupabaseErrorHandling(operation, fn, options) {
    return __awaiter(this, void 0, void 0, function () {
        var error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fn()];
                case 1:
                    error = (_a.sent()).error;
                    if (error) {
                        handleSupabaseError(operation, error, options);
                        return [2 /*return*/, false];
                    }
                    return [2 /*return*/, true];
            }
        });
    });
}
