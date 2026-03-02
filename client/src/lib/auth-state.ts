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

/** Called by engine files to get the current authenticated user */
export function getCurrentUser(): AuthUser {
  return _currentUser;
}

/** Check if the current user is actually authenticated (not the default fallback) */
export function isAuthenticated(): boolean {
  return _currentUser.id !== "anonymous";
}

/** Check if the current user has admin role */
export function isAdmin(): boolean {
  return isAuthenticated() && _currentUser.role === "admin";
}
