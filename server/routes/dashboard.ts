/**
 * Dashboard API Routes
 * 
 * GET /api/dashboard/summary — basic pipeline stats from real data
 * 
 * This does NOT invent new dashboard logic.
 * It provides a server-side endpoint for existing stats
 * that currently come from mock data in store.ts.
 */

import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../lib/auth.js';

export const dashboardRoutes = Router();

// All dashboard routes require authentication
dashboardRoutes.use(requireAuth);

// ─── GET /api/dashboard/summary ──────────────────────────
dashboardRoutes.get('/summary', async (_req, res, next) => {
  try {
    // Count workspaces by stage
    const { data: workspaces, error: wsErr } = await supabaseAdmin
      .from('workspaces')
      .select('id, stage, type');

    if (wsErr) throw { status: 500, message: wsErr.message, code: 'DB_ERROR' };

    // Count customers
    const { count: customerCount, error: custErr } = await supabaseAdmin
      .from('customers')
      .select('*', { count: 'exact', head: true });

    if (custErr) throw { status: 500, message: custErr.message, code: 'DB_ERROR' };

    // Count open escalations
    const { count: escalationCount, error: escErr } = await supabaseAdmin
      .from('escalation_events')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'pending']);

    if (escErr) {
      // Escalation table might not exist yet — don't fail
      console.warn('[DASHBOARD] Could not count escalations:', escErr.message);
    }

    // Compute simple stage distribution
    const stageDistribution: Record<string, number> = {};
    for (const ws of workspaces || []) {
      const stage = ws.stage || 'Unknown';
      stageDistribution[stage] = (stageDistribution[stage] || 0) + 1;
    }

    res.json({
      data: {
        totalWorkspaces: workspaces?.length || 0,
        totalCustomers: customerCount || 0,
        openEscalations: escalationCount || 0,
        stageDistribution,
      },
    });
  } catch (err) {
    next(err);
  }
});
