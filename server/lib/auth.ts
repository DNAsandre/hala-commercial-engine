/**
 * Server Auth Middleware
 * 
 * Verifies Supabase JWT from the Authorization header.
 * Attaches authenticated user to req.authUser.
 * 
 * Sprint 2: Required on all mutation routes (PATCH/POST/DELETE).
 * Read routes also require auth for data protection.
 * 
 * NO role restrictions yet. Just identity verification.
 */

import { type Request, type Response, type NextFunction } from 'express';
import { supabaseAdmin } from './supabase.js';

export interface AuthenticatedUser {
  /** Supabase auth UUID */
  authId: string;
  /** App user ID (from users table) */
  userId: string;
  /** Display name */
  name: string;
  /** Email */
  email: string;
  /** Role (not enforced yet) */
  role: string;
  /** Region */
  region: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
    }
  }
}

/**
 * Auth middleware — verifies JWT and attaches user identity.
 * Returns 401 if token is missing or invalid.
 * Does NOT enforce roles — just establishes identity.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    const token = authHeader.slice(7);

    // Verify JWT with Supabase
    const { data: { user: authUser }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !authUser) {
      res.status(401).json({
        error: 'Invalid or expired token',
        code: 'AUTH_INVALID',
      });
      return;
    }

    // Fetch app user profile from users table
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('id, name, email, role, region')
      .eq('auth_id', authUser.id)
      .single();

    if (!profile) {
      // Auth valid but no app profile — allow with minimal identity
      req.authUser = {
        authId: authUser.id,
        userId: authUser.id,
        name: authUser.email || 'Unknown',
        email: authUser.email || '',
        role: 'unlinked',
        region: '',
      };
    } else {
      req.authUser = {
        authId: authUser.id,
        userId: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        region: profile.region || '',
      };
    }

    next();
  } catch (err: any) {
    console.error('[AUTH] Middleware error:', err.message);
    res.status(401).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR',
    });
  }
}

/**
 * Role middleware factory — enforces server-side RBAC.
 * Must be used AFTER requireAuth (needs req.authUser populated).
 * Returns 403 if the user's role is not in the allowed list.
 *
 * Usage:  router.post('/quotes/:id/approve', requireRole(['admin','manager']), handler)
 */
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.authUser?.role;
    if (!role || !allowedRoles.includes(role)) {
      res.status(403).json({
        error: `This action requires one of these roles: ${allowedRoles.join(', ')}. Your role: ${role || 'unknown'}`,
        code: 'FORBIDDEN',
      });
      return;
    }
    next();
  };
}

/**
 * Optional auth — attaches user if token is valid, continues without user if not.
 * Use for read routes where anonymous reads are temporarily allowed.
 *
 * NOTE: Do NOT use on mutation routes. Use requireAuth there.
 *
 * Bug note: cannot delegate to requireAuth() here because requireAuth sends
 * its own 401 response and returns without calling next — the outer next()
 * would never be reached, hanging the request.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  try {
    const token = authHeader.slice(7);
    const { data: { user: authUser }, error } = await supabaseAdmin.auth.getUser(token);

    if (!error && authUser) {
      const { data: profile } = await supabaseAdmin
        .from('users')
        .select('id, name, email, role, region')
        .eq('auth_id', authUser.id)
        .single();

      req.authUser = profile
        ? { authId: authUser.id, userId: profile.id, name: profile.name, email: profile.email, role: profile.role, region: profile.region || '' }
        : { authId: authUser.id, userId: authUser.id, name: authUser.email || 'Unknown', email: authUser.email || '', role: 'unlinked', region: '' };
    }
    // Invalid/expired token — proceed as unauthenticated (req.authUser stays undefined)
  } catch {
    // Network or unexpected error — proceed as unauthenticated
  }

  next();
}
