"use strict";
/**
 * optimistic-lock.ts
 * ──────────────────
 * Implements optimistic concurrency control for Supabase updates.
 *
 * Pattern: Every UPDATE adds `WHERE updated_at = $expected` to detect
 * concurrent modifications. If another user changed the row since we
 * last read it, the update returns 0 rows and we surface a conflict error.
 *
 * Usage:
 *   // In supabase-data.ts:
 *   const result = await optimisticUpdate("customers", id, row, expectedUpdatedAt);
 *
 *   // In supabase-sync.ts (fire-and-forget, no expectedUpdatedAt):
 *   // Sync functions set updated_at themselves, so they use a simpler pattern.
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.OptimisticLockError = void 0;
exports.optimisticUpdate = optimisticUpdate;
exports.optimisticSyncUpdate = optimisticSyncUpdate;
var supabase_1 = require("./supabase");
var supabase_error_1 = require("./supabase-error");
var sonner_1 = require("sonner");
var OptimisticLockError = /** @class */ (function (_super) {
    __extends(OptimisticLockError, _super);
    function OptimisticLockError(table, id) {
        var _this = _super.call(this, "Conflict: \"".concat(table, "\" row \"").concat(id, "\" was modified by another user. Please refresh and try again.")) || this;
        _this.name = "OptimisticLockError";
        return _this;
    }
    return OptimisticLockError;
}(Error));
exports.OptimisticLockError = OptimisticLockError;
/**
 * Perform an optimistic-locked update on a Supabase table.
 *
 * @param table - The table name
 * @param id - The row ID
 * @param updates - The column updates (snake_case, including updated_at = now)
 * @param expectedUpdatedAt - The updated_at value we last read (ISO string).
 *   If provided, the update will include `WHERE updated_at = $expected`.
 *   If null/undefined, the update proceeds without the lock check (backward compat).
 * @returns The updated row, or null on error/conflict
 */
function optimisticUpdate(table, id, updates, expectedUpdatedAt) {
    return __awaiter(this, void 0, void 0, function () {
        var now, row, query, _a, data, error, count;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    now = new Date().toISOString();
                    row = __assign(__assign({}, updates), { updated_at: now });
                    query = supabase_1.supabase.from(table).update(row).eq("id", id);
                    // Add optimistic lock condition if we have an expected timestamp
                    if (expectedUpdatedAt) {
                        query = query.eq("updated_at", expectedUpdatedAt);
                    }
                    return [4 /*yield*/, query.select().single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error, count = _a.count;
                    if (error) {
                        // PGRST116 = "JSON object requested, multiple (or no) rows returned"
                        // This means the WHERE updated_at condition didn't match → conflict
                        if (error.code === "PGRST116" && expectedUpdatedAt) {
                            sonner_1.toast.error("Update conflict", {
                                description: "This record was modified by another user. Please refresh and try again.",
                                duration: 6000,
                            });
                            (0, supabase_error_1.handleSupabaseError)("optimisticUpdate(".concat(table, ")"), error, { entityId: id, silent: true });
                            return [2 /*return*/, null];
                        }
                        (0, supabase_error_1.handleSupabaseError)("optimisticUpdate(".concat(table, ")"), error, { entityId: id });
                        return [2 /*return*/, null];
                    }
                    return [2 /*return*/, data];
            }
        });
    });
}
/**
 * Perform an optimistic-locked update for sync operations (fire-and-forget).
 * These don't return data, just check for conflicts.
 *
 * @param table - The table name
 * @param id - The row ID
 * @param updates - The column updates (snake_case)
 * @param operation - Name of the sync operation for error reporting
 */
function optimisticSyncUpdate(table, id, updates, operation) {
    return __awaiter(this, void 0, void 0, function () {
        var now, row, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    now = new Date().toISOString();
                    row = __assign(__assign({}, updates), { updated_at: now });
                    return [4 /*yield*/, supabase_1.supabase.from(table).update(row).eq("id", id)];
                case 1:
                    error = (_a.sent()).error;
                    if (error) {
                        (0, supabase_error_1.handleSupabaseError)(operation, error, { entityId: id });
                        return [2 /*return*/, false];
                    }
                    return [2 /*return*/, true];
            }
        });
    });
}
