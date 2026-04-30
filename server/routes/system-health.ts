/**
 * System Health Routes — Real-time module health checks
 * 
 * GET /api/system-health — returns health status for all system modules
 * GET /api/integration-status — returns live status for all integrations
 * 
 * Each module is checked against its actual backend:
 *   - PDF Compiler: tests PDFKit import
 *   - Escalation Engine: checks escalation_events table
 *   - Audit Logger: checks audit_log table + recent activity
 *   - AI Authoring: checks AI provider configuration
 *   - Notification Service: checks for SMTP/email configuration
 *   - CRM Sync: checks crm_connections table + last sync
 */

import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';

export const systemHealthRoutes = Router();

interface ModuleHealth {
  name: string;
  status: 'active' | 'inactive' | 'degraded';
  lastActivity: string;
  details?: string;
}

interface IntegrationStatus {
  name: string;
  status: 'active' | 'demo' | 'planned' | 'error';
  description: string;
  connectionInfo: string;
}

// ─── System Health ───────────────────────────────────────
systemHealthRoutes.get('/system-health', async (_req, res) => {
  try {
    const modules: ModuleHealth[] = [];

    // ─── CRM Sync Engine ────────────────────────────────
    try {
      const { data: conn } = await supabaseAdmin
        .from('crm_connections')
        .select('last_sync_at, sync_status')
        .order('last_sync_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (conn?.last_sync_at) {
        const ago = timeSince(conn.last_sync_at);
        modules.push({ name: 'CRM Sync Engine', status: 'active', lastActivity: `Last sync ${ago}` });
      } else {
        modules.push({ name: 'CRM Sync Engine', status: 'active', lastActivity: 'No sync recorded yet' });
      }
    } catch {
      modules.push({ name: 'CRM Sync Engine', status: 'degraded', lastActivity: 'Cannot reach sync table' });
    }

    // ─── PDF Compiler ───────────────────────────────────
    try {
      // Actually test if the PDF generator module loads
      await import('../lib/pdf-generator.js');
      modules.push({ name: 'PDF Compiler', status: 'active', lastActivity: 'PDFKit loaded — ready' });
    } catch {
      modules.push({ name: 'PDF Compiler', status: 'degraded', lastActivity: 'PDFKit module load failed' });
    }

    // ─── Escalation Engine ──────────────────────────────
    try {
      const { count, error } = await supabaseAdmin
        .from('escalation_events')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');

      if (error) throw error;
      modules.push({
        name: 'Escalation Engine',
        status: 'active',
        lastActivity: `${count || 0} open escalations`,
      });
    } catch {
      modules.push({ name: 'Escalation Engine', status: 'degraded', lastActivity: 'Cannot reach escalation table' });
    }

    // ─── Audit Logger ───────────────────────────────────
    try {
      const { count, error: countErr } = await supabaseAdmin
        .from('audit_log')
        .select('*', { count: 'exact', head: true });

      const { data: latest } = await supabaseAdmin
        .from('audit_log')
        .select('timestamp')
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (countErr) throw countErr;

      const lastAgo = latest?.timestamp ? timeSince(latest.timestamp) : 'No events';
      modules.push({
        name: 'Audit Logger',
        status: 'active',
        lastActivity: `${count || 0} events — last ${lastAgo}`,
      });
    } catch {
      modules.push({ name: 'Audit Logger', status: 'degraded', lastActivity: 'Cannot reach audit table' });
    }

    // ─── AI Authoring ───────────────────────────────────
    try {
      const { data: providers } = await supabaseAdmin
        .from('ai_providers')
        .select('name, enabled')
        .eq('enabled', true);

      const enabledCount = providers?.length || 0;
      modules.push({
        name: 'AI Authoring',
        status: enabledCount > 0 ? 'active' : 'inactive',
        lastActivity: enabledCount > 0
          ? `${enabledCount} provider${enabledCount > 1 ? 's' : ''} active`
          : 'No providers enabled',
      });
    } catch {
      modules.push({ name: 'AI Authoring', status: 'degraded', lastActivity: 'Cannot check providers' });
    }

    // ─── Notification Service ───────────────────────────
    // No email/SMTP infrastructure exists yet — honestly report this
    modules.push({
      name: 'Notification Service',
      status: 'inactive',
      lastActivity: 'Not implemented',
      details: 'Requires SMTP provider setup',
    });

    res.json({ modules });
  } catch (err: any) {
    console.error('[SYSTEM-HEALTH] Error:', err.message);
    res.status(500).json({ error: 'Health check failed' });
  }
});

// ─── Integration Status ─────────────────────────────────
systemHealthRoutes.get('/integration-status', async (_req, res) => {
  try {
    const integrations: IntegrationStatus[] = [];

    // ─── Zoho CRM ─────────────────────────────────────
    try {
      const { data: conns, error } = await supabaseAdmin
        .from('crm_connections')
        .select('id, name, provider, sync_status, last_sync_at')
        .limit(5);

      if (error) throw error;

      const zohoConn = conns?.find((c: any) => c.provider === 'zoho');
      if (zohoConn && zohoConn.sync_status === 'active') {
        const ago = zohoConn.last_sync_at ? timeSince(zohoConn.last_sync_at) : 'Never';
        integrations.push({
          name: 'Zoho CRM',
          status: 'active',
          description: `Deal sync, contact sync — last sync ${ago}`,
          connectionInfo: `Provider: ${zohoConn.provider} — ${zohoConn.name}`,
        });
      } else if (zohoConn) {
        integrations.push({
          name: 'Zoho CRM',
          status: 'demo',
          description: 'Deal sync, contact sync, stage updates',
          connectionInfo: `Connection exists but status: ${zohoConn.sync_status}`,
        });
      } else {
        // Check if any CRM connections exist at all
        const hasAny = conns && conns.length > 0;
        integrations.push({
          name: 'Zoho CRM',
          status: hasAny ? 'demo' : 'demo',
          description: 'Deal sync, contact sync, stage updates',
          connectionInfo: hasAny ? `${conns.length} connection(s) configured` : 'No connections configured',
        });
      }
    } catch {
      integrations.push({
        name: 'Zoho CRM',
        status: 'error',
        description: 'Deal sync, contact sync, stage updates',
        connectionInfo: 'Cannot reach crm_connections table',
      });
    }

    // ─── Supabase ─────────────────────────────────────
    try {
      // Test actual Supabase connectivity by counting users
      const { count, error } = await supabaseAdmin
        .from('users')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;
      integrations.push({
        name: 'Supabase',
        status: 'active',
        description: `Cloud database — ${count || 0} users`,
        connectionInfo: 'Connected — read/write operational',
      });
    } catch {
      integrations.push({
        name: 'Supabase',
        status: 'error',
        description: 'Cloud database',
        connectionInfo: 'Connection failed',
      });
    }

    // ─── Zoho Books — not implemented ──────────────────
    integrations.push({
      name: 'Zoho Books',
      status: 'planned',
      description: 'Invoice generation, payment tracking',
      connectionInfo: 'Not implemented',
    });

    // ─── WMS — not implemented ─────────────────────────
    integrations.push({
      name: 'WMS (Blue Yonder)',
      status: 'planned',
      description: 'Inventory data, space utilization',
      connectionInfo: 'Not implemented',
    });

    // ─── Email SMTP — not implemented ──────────────────
    integrations.push({
      name: 'Email (SMTP)',
      status: 'planned',
      description: 'Notification emails, document sharing',
      connectionInfo: 'Not implemented',
    });

    res.json({ integrations });
  } catch (err: any) {
    console.error('[INTEGRATION-STATUS] Error:', err.message);
    res.status(500).json({ error: 'Integration status check failed' });
  }
});

/** Human-readable time-since string */
function timeSince(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
