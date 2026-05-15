/**
 * GHL Sync Routes — Outbound Sync & Status API
 *
 * Provides endpoints for:
 *   - Pushing workspaces to GHL as opportunities (create/update)
 *   - Pushing customers to GHL as contacts (create/update)
 *   - Sync health status and entity map browsing
 *   - Sync audit log with filters
 *   - Connection testing
 *   - Pipeline discovery
 *
 * SECURITY: This module runs SERVER-SIDE ONLY.
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import * as ghlService from '../lib/ghl-service.js';
import {
  halaCustomerToGhlContact,
  halaWorkspaceToGhlOpportunity,
  halaCustomerToGhlBusiness,
  resolveGhlStageName,
} from '../lib/ghl-mapper.js';

const router = Router();

// ─── SUPABASE CLIENT ────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured');
  return createClient(url, key);
}

// ─── CONNECTION TEST ────────────────────────────────────────────────────────

/**
 * POST /api/ghl/sync/test-connection
 * Tests GHL Private Integration token connectivity.
 */
router.post('/sync/test-connection', async (_req: Request, res: Response) => {
  try {
    const result = await ghlService.testConnection();
    res.json(result);
  } catch (err: any) {
    res.json({ ok: false, latencyMs: 0, message: err.message });
  }
});

// ─── PUSH WORKSPACE → GHL OPPORTUNITY ───────────────────────────────────────

/**
 * POST /api/ghl/sync/push-workspace/:id
 * Push a Hala workspace to GHL as an opportunity.
 * Creates a new opportunity or updates an existing one based on entity map.
 */
router.post('/sync/push-workspace/:id', async (req: Request, res: Response) => {
  const workspaceId = req.params.id;
  const supabase = getSupabase();

  try {
    // Fetch workspace
    const { data: workspace, error: wsError } = await supabase
      .from('commercial_workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single();

    if (wsError || !workspace) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }

    // Check if already mapped to a GHL opportunity
    const { data: existingMap } = await supabase
      .from('ghl_entity_map')
      .select('*')
      .eq('hala_entity_type', 'workspace')
      .eq('hala_entity_id', workspaceId)
      .eq('ghl_entity_type', 'opportunity')
      .limit(1);

    // Resolve GHL contact ID (needed for opportunity creation/update)
    let ghlContactId = '';
    if (workspace.customer_id) {
      const { data: contactMap } = await supabase
        .from('ghl_entity_map')
        .select('ghl_entity_id')
        .eq('hala_entity_type', 'customer')
        .eq('hala_entity_id', workspace.customer_id)
        .eq('ghl_entity_type', 'contact')
        .limit(1);

      if (contactMap && contactMap.length > 0) {
        ghlContactId = contactMap[0].ghl_entity_id;
      } else {
        // Customer not yet in GHL — push them first
        const { data: customer } = await supabase
          .from('customer_master')
          .select('*')
          .eq('id', workspace.customer_id)
          .single();

        if (customer) {
          const contactPayload = halaCustomerToGhlContact({
            name: customer.name,
            contactEmail: customer.contact_email ?? '',
            contactPhone: customer.contact_phone ?? '',
            industry: customer.industry ?? '',
            city: customer.city ?? '',
            country: customer.country ?? '',
            website: customer.website ?? '',
            address: customer.address ?? '',
            ghlContactId: null,
            ghlBusinessId: null,
          });
          const ghlContact = await ghlService.createContact(contactPayload);
          ghlContactId = ghlContact.id;

          // Create contact entity map
          await supabase.from('ghl_entity_map').insert({
            id: crypto.randomUUID(),
            ghl_entity_type: 'contact',
            ghl_entity_id: ghlContact.id,
            hala_entity_type: 'customer',
            hala_entity_id: workspace.customer_id,
            ghl_contact_id: ghlContact.id,
            sync_status: 'active',
            metadata: { source: 'outbound_push' },
          });
        }
      }
    }

    if (!ghlContactId) {
      res.status(400).json({ error: 'Cannot push opportunity without a contact. Ensure workspace has a customer.' });
      return;
    }

    // Resolve pipeline and stage
    const pipelines = await ghlService.getPipelines();
    const defaultPipeline = pipelines[0];  // Use first pipeline as default
    if (!defaultPipeline) {
      res.status(400).json({ error: 'No GHL pipelines found. Create a pipeline in GHL first.' });
      return;
    }

    const targetStageName = resolveGhlStageName(workspace.stage ?? 'prospecting');
    const targetStage = defaultPipeline.stages.find(
      (s) => s.name.toLowerCase() === targetStageName.toLowerCase()
    ) ?? defaultPipeline.stages[0];

    // Create sync log
    const logId = crypto.randomUUID();
    await supabase.from('ghl_sync_log').insert({
      id: logId,
      direction: 'outbound',
      event_type: existingMap?.length ? 'OpportunityUpdate' : 'OpportunityCreate',
      ghl_entity_type: 'opportunity',
      hala_entity_type: 'workspace',
      hala_entity_id: workspaceId,
      status: 'processing',
      request_payload: { workspaceId, ghlContactId },
      idempotency_key: `out-ws-${workspaceId}-${Date.now()}`,
    });

    if (existingMap && existingMap.length > 0) {
      // UPDATE existing GHL opportunity
      const ghlOppId = existingMap[0].ghl_entity_id;
      const updatedOpp = await ghlService.updateOpportunity(ghlOppId, {
        name: workspace.title,
        pipelineStageId: targetStage.id,
        monetaryValue: workspace.estimated_value ?? 0,
        status: mapHalaStatusToGhl(workspace.status),
      });

      await supabase.from('ghl_entity_map')
        .update({ last_synced_at: new Date().toISOString(), sync_status: 'active' })
        .eq('id', existingMap[0].id);

      await supabase.from('ghl_sync_log').update({
        status: 'success',
        ghl_entity_id: ghlOppId,
        response_payload: { opportunityId: ghlOppId, action: 'updated' },
        processed_at: new Date().toISOString(),
      }).eq('id', logId);

      res.json({ success: true, action: 'updated', ghlOpportunityId: ghlOppId, opportunity: updatedOpp });
    } else {
      // CREATE new GHL opportunity
      const oppPayload = halaWorkspaceToGhlOpportunity(
        {
          title: workspace.title,
          customerId: workspace.customer_id,
          customerName: workspace.customer_name ?? '',
          stage: workspace.stage ?? 'prospecting',
          estimatedValue: workspace.estimated_value ?? 0,
          owner: workspace.owner ?? '',
          source: workspace.source ?? 'Hala Commercial',
          status: workspace.status ?? 'active',
          ghlOpportunityId: null,
          ghlContactId,
          ghlBusinessId: null,
          ghlPipelineId: defaultPipeline.id,
          ghlPipelineStageId: targetStage.id,
        },
        ghlContactId,
        defaultPipeline.id,
        targetStage.id,
      );

      const ghlOpp = await ghlService.createOpportunity(oppPayload);

      // Create entity map
      await supabase.from('ghl_entity_map').insert({
        id: crypto.randomUUID(),
        ghl_entity_type: 'opportunity',
        ghl_entity_id: ghlOpp.id,
        hala_entity_type: 'workspace',
        hala_entity_id: workspaceId,
        ghl_contact_id: ghlContactId,
        ghl_opportunity_id: ghlOpp.id,
        sync_status: 'active',
        metadata: { source: 'outbound_push', pipelineId: defaultPipeline.id, stageId: targetStage.id },
      });

      // Update workspace with GHL IDs
      await supabase.from('commercial_workspaces').update({
        ghl_opportunity_id: ghlOpp.id,
        ghl_contact_id: ghlContactId,
        ghl_pipeline_id: defaultPipeline.id,
        ghl_pipeline_stage_id: targetStage.id,
        updated_at: new Date().toISOString(),
      }).eq('id', workspaceId);

      await supabase.from('ghl_sync_log').update({
        status: 'success',
        ghl_entity_id: ghlOpp.id,
        response_payload: { opportunityId: ghlOpp.id, action: 'created' },
        processed_at: new Date().toISOString(),
      }).eq('id', logId);

      res.json({ success: true, action: 'created', ghlOpportunityId: ghlOpp.id, opportunity: ghlOpp });
    }
  } catch (err: any) {
    console.error('[GHL Sync] push-workspace error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── PUSH CUSTOMER → GHL CONTACT ────────────────────────────────────────────

/**
 * POST /api/ghl/sync/push-customer/:id
 * Push a Hala customer to GHL as a contact.
 */
router.post('/sync/push-customer/:id', async (req: Request, res: Response) => {
  const customerId = req.params.id;
  const supabase = getSupabase();

  try {
    const { data: customer, error: custError } = await supabase
      .from('customer_master')
      .select('*')
      .eq('id', customerId)
      .single();

    if (custError || !customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    const { data: existingMap } = await supabase
      .from('ghl_entity_map')
      .select('*')
      .eq('hala_entity_type', 'customer')
      .eq('hala_entity_id', customerId)
      .eq('ghl_entity_type', 'contact')
      .limit(1);

    const contactPayload = halaCustomerToGhlContact({
      name: customer.name,
      contactEmail: customer.contact_email ?? '',
      contactPhone: customer.contact_phone ?? '',
      industry: customer.industry ?? '',
      city: customer.city ?? '',
      country: customer.country ?? '',
      website: customer.website ?? '',
      address: customer.address ?? '',
      ghlContactId: null,
      ghlBusinessId: null,
    });

    if (existingMap && existingMap.length > 0) {
      // UPDATE
      const ghlContactId = existingMap[0].ghl_entity_id;
      const updated = await ghlService.updateContact(ghlContactId, contactPayload);

      await supabase.from('ghl_entity_map')
        .update({ last_synced_at: new Date().toISOString(), sync_status: 'active' })
        .eq('id', existingMap[0].id);

      res.json({ success: true, action: 'updated', ghlContactId, contact: updated });
    } else {
      // CREATE
      const ghlContact = await ghlService.createContact(contactPayload);

      await supabase.from('ghl_entity_map').insert({
        id: crypto.randomUUID(),
        ghl_entity_type: 'contact',
        ghl_entity_id: ghlContact.id,
        hala_entity_type: 'customer',
        hala_entity_id: customerId,
        ghl_contact_id: ghlContact.id,
        sync_status: 'active',
        metadata: { source: 'outbound_push' },
      });

      res.json({ success: true, action: 'created', ghlContactId: ghlContact.id, contact: ghlContact });
    }
  } catch (err: any) {
    console.error('[GHL Sync] push-customer error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── SYNC STATUS ────────────────────────────────────────────────────────────

/**
 * GET /api/ghl/sync/status
 * Returns sync health overview: counts by status, last sync times.
 */
router.get('/sync/status', async (_req: Request, res: Response) => {
  const supabase = getSupabase();
  try {
    // Entity map counts by status
    const { data: mapCounts } = await supabase
      .from('ghl_entity_map')
      .select('sync_status, ghl_entity_type');

    const stats = {
      contacts: { active: 0, pending: 0, error: 0, deleted: 0 },
      opportunities: { active: 0, pending: 0, error: 0, deleted: 0 },
      businesses: { active: 0, pending: 0, error: 0, deleted: 0 },
    };

    (mapCounts ?? []).forEach((row: any) => {
      const key = row.ghl_entity_type === 'contact' ? 'contacts'
        : row.ghl_entity_type === 'opportunity' ? 'opportunities'
        : 'businesses';
      const status = row.sync_status as keyof typeof stats.contacts;
      if (stats[key] && stats[key][status] !== undefined) {
        stats[key][status]++;
      }
    });

    // Recent sync log stats
    const { data: recentLogs } = await supabase
      .from('ghl_sync_log')
      .select('direction, status, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    const logStats = {
      total: recentLogs?.length ?? 0,
      success: recentLogs?.filter((l: any) => l.status === 'success').length ?? 0,
      failed: recentLogs?.filter((l: any) => l.status === 'failed').length ?? 0,
      lastInbound: recentLogs?.find((l: any) => l.direction === 'inbound')?.created_at ?? null,
      lastOutbound: recentLogs?.find((l: any) => l.direction === 'outbound')?.created_at ?? null,
    };

    // Config
    const { data: config } = await supabase
      .from('ghl_sync_config')
      .select('*')
      .eq('id', 'default')
      .single();

    res.json({
      entityMap: stats,
      recentActivity: logStats,
      config: config ?? { sync_enabled: false },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ENTITY MAP ─────────────────────────────────────────────────────────────

/**
 * GET /api/ghl/sync/entity-map
 * List all entity mappings with optional filters.
 * Query params: entityType, status, limit
 */
router.get('/sync/entity-map', async (req: Request, res: Response) => {
  const supabase = getSupabase();
  try {
    let query = supabase.from('ghl_entity_map').select('*').order('created_at', { ascending: false });

    if (req.query.entityType) {
      query = query.eq('ghl_entity_type', req.query.entityType as string);
    }
    if (req.query.status) {
      query = query.eq('sync_status', req.query.status as string);
    }

    const limit = parseInt(req.query.limit as string || '50', 10);
    query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ entityMap: data ?? [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SYNC LOG ───────────────────────────────────────────────────────────────

/**
 * GET /api/ghl/sync/log
 * Audit log with optional filters.
 * Query params: direction, status, eventType, limit
 */
router.get('/sync/log', async (req: Request, res: Response) => {
  const supabase = getSupabase();
  try {
    let query = supabase.from('ghl_sync_log').select('*').order('created_at', { ascending: false });

    if (req.query.direction) {
      query = query.eq('direction', req.query.direction as string);
    }
    if (req.query.status) {
      query = query.eq('status', req.query.status as string);
    }
    if (req.query.eventType) {
      query = query.eq('event_type', req.query.eventType as string);
    }

    const limit = parseInt(req.query.limit as string || '50', 10);
    query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ logs: data ?? [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PIPELINES ──────────────────────────────────────────────────────────────

/**
 * GET /api/ghl/pipelines
 * Proxy to fetch GHL pipelines for config UI.
 */
router.get('/pipelines', async (_req: Request, res: Response) => {
  try {
    const pipelines = await ghlService.getPipelines();
    res.json({ pipelines });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── HELPERS ────────────────────────────────────────────────────────────────

function mapHalaStatusToGhl(halaStatus: string): string {
  switch (halaStatus?.toLowerCase()) {
    case 'active':     return 'open';
    case 'won':        return 'won';
    case 'lost':       return 'lost';
    case 'abandoned':  return 'abandoned';
    default:           return 'open';
  }
}

export const ghlSyncRoutes = router;
