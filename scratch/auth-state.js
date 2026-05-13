"use strict";
/**
 * Global Auth State Accessor
 *
 * Provides a way for non-React code (engine files like stage-transition.ts,
 * tender-engine.ts, document-vault.ts) to access the current authenticated user.
 *
 * The AuthContext sets this on login; engine files read it via getCurrentUser().
 * Falls back to a default user if not yet set (e.g., during initialization).
 */
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.setGlobalAuthUser = setGlobalAuthUser;
exports.clearGlobalAuthUser = clearGlobalAuthUser;
exports.getCurrentUser = getCurrentUser;
exports.setDevRoleOverride = setDevRoleOverride;
exports.getDevRoleOverride = getDevRoleOverride;
exports.isAuthenticated = isAuthenticated;
exports.isAdmin = isAdmin;
var DEFAULT_USER = {
    id: "anonymous",
    name: "Unauthenticated",
    email: "",
    role: "viewer",
    region: "",
};
var _currentUser = DEFAULT_USER;
/** Called by AuthContext when user logs in or profile is fetched */
function setGlobalAuthUser(user) {
    _currentUser = user;
}
/** Called by AuthContext on logout */
function clearGlobalAuthUser() {
    _currentUser = DEFAULT_USER;
}
var DEV_ROLE_KEY = 'dev_role_override';
/** Called by engine files to get the current authenticated user.
 *  In DEV mode only: respects localStorage dev_role_override for testing. */
function getCurrentUser() {
    if (import.meta.env.DEV) {
        var devRole = localStorage.getItem(DEV_ROLE_KEY);
        if (devRole)
            return __assign(__assign({}, _currentUser), { role: devRole });
    }
    return _currentUser;
}
/** DEV only — set a temporary role override for testing. No-op in production. */
function setDevRoleOverride(role) {
    if (!import.meta.env.DEV)
        return;
    if (role) {
        localStorage.setItem(DEV_ROLE_KEY, role);
    }
    else {
        localStorage.removeItem(DEV_ROLE_KEY);
    }
}
/** DEV only — read the active override (null if none or in production). */
function getDevRoleOverride() {
    if (!import.meta.env.DEV)
        return null;
    return localStorage.getItem(DEV_ROLE_KEY);
}
/** Check if the current user is actually authenticated (not the default fallback) */
function isAuthenticated() {
    return _currentUser.id !== "anonymous";
}
/** Check if the current user has admin role */
function isAdmin() {
    return isAuthenticated() && _currentUser.role === "admin";
}
