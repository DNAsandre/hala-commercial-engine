/**
 * Global Auth State Accessor
 * 
 * Provides a way for non-React code (engine files like stage-transition.ts,
 * tender-engine.ts, document-vault.ts) to access the current authenticated user.
 * 
 * The AuthContext sets this on login; engine files read it via getCurrentUser().
 * Falls back to a default user if not yet set (e.g., during initialization).
 */

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  region: string;
}

const DEFAULT_USER: AuthUser = {
  id: "anonymous",
  name: "Unauthenticated",
  email: "",
  role: "viewer",
  region: "",
};

let _currentUser: AuthUser = DEFAULT_USER;

/** Called by AuthContext when user logs in or profile is fetched */
export function setGlobalAuthUser(user: AuthUser): void {
  _currentUser = user;
}

/** Called by AuthContext on logout */
export function clearGlobalAuthUser(): void {
  _currentUser = DEFAULT_USER;
}

const DEV_ROLE_KEY = 'dev_role_override';

/** Called by engine files to get the current authenticated user.
 *  In DEV mode only: respects localStorage dev_role_override for testing. */
export function getCurrentUser(): AuthUser {
  if (import.meta.env.DEV) {
    const devRole = localStorage.getItem(DEV_ROLE_KEY);
    if (devRole) return { ..._currentUser, role: devRole };
  }
  return _currentUser;
}

/** DEV only — set a temporary role override for testing. No-op in production. */
export function setDevRoleOverride(role: string | null): void {
  if (!import.meta.env.DEV) return;
  if (role) {
    localStorage.setItem(DEV_ROLE_KEY, role);
  } else {
    localStorage.removeItem(DEV_ROLE_KEY);
  }
}

/** DEV only — read the active override (null if none or in production). */
export function getDevRoleOverride(): string | null {
  if (!import.meta.env.DEV) return null;
  return localStorage.getItem(DEV_ROLE_KEY);
}

/** Check if the current user is actually authenticated (not the default fallback) */
export function isAuthenticated(): boolean {
  return _currentUser.id !== "anonymous";
}

/** Check if the current user has admin role */
export function isAdmin(): boolean {
  return isAuthenticated() && _currentUser.role === "admin";
}
