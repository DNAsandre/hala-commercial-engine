/**
 * GHL Webhook Handler — Inbound Events from GoHighLevel CRM
 *
 * Receives webhook POST requests from GHL and processes:
 *   - OpportunityCreate / OpportunityStageUpdate / OpportunityStatusUpdate
 *   - OpportunityMonetaryValueUpdate / OpportunityDelete
 *   - ContactCreate / ContactUpdate / ContactDelete
 *
 * Security:
 *   - Ed25519 signature verification via X-GHL-Signature header
 *   - Fallback to RSA X-WH-Signature during transition period
 *   - Idempotency via webhookId dedup against ghl_sync_log
 *   - Always returns 200 OK immediately, processes asynchronously
 *
 * SECURITY: This module runs SERVER-SIDE ONLY.
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import * as ghlService from '../lib/ghl-service.js';
import {
  ghlContactToHalaCustomer,
  ghlOpportunityToHalaWorkspace,
  ghlBusinessToHalaCustomer,
} from '../lib/ghl-mapper.js';

const router = Router();

// ─── SUPABASE CLIENT ────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured');
  return createClient(url, key);
}

// ─── GHL PUBLIC KEYS FOR SIGNATURE VERIFICATION ─────────────────────────────

const GHL_ED25519_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=
-----END PUBLIC KEY-----`;

const GHL_RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAokvo/r9tVgcfZ5DysOSC
Frm602qYV0MaAiNnX9O8KxMbiyRKWeL9JpCpVpt4XHIcBOK4u3cLSqJGOLaPuXw6
dO0t6Q/ZVdAV5Phz+ZtzPL16iCGeK9po6D6JHBpbi989mmzMryUnQJezlYJ3DVfB
csedpinheNnyYeFXolrJvcsjDtfAeRx5ByHQmTnSdFUzuAnC9/GepgLT9SM4nCpv
uxmZMxrJt5Rw+VUaQ9B8JSvbMPpez4peKaJPZHBbU3OdeCVx5klVXXZQGNHOs8gF
3kvoV5rTnXV0IknLBXlcKKAQLZcY/Q9rG6Ifi9c+5vqlvHPCUJFT5XUGG5RKgOKU
J062fRtN+rLYZUV+BjafxQauvC8wSWeYja63VSUruvmNj8xkx2zE/Juc+yjLjTXp
IocmaiFeAO6fUtNjDeFVkhf5LNb59vECyrHD2SQIrhgXpO4Q3dVNA5rw576PwTzN
h/AMfHKIjE4xQA1SZuYJmNnmVZLIZBlQAF9Ntd03rfadZ+yDiOXCCs9FkHibELhC
HULgCsnuDJHcrGNd5/Ddm5hxGQ0ASitgHeMZ0kcIOwKDOzOU53lDza6/Y09T7sYJ
PQe7z0cvj7aE4B+Ax1ZoZGPzpJlZtGXCsu9aTEGEnKzmsFqwcSsnw3JB31IGKAyk
T1hhTiaCeIY/OwwwNUY2yvcCAwEAAQ==
-----END PUBLIC KEY-----`;

// ─── SIGNATURE VERIFICATION ─────────────────────────────────────────────────

function verifyGhlSignature(payload: string, signature: string): boolean {
  if (!signature || signature === 'N/A') return false;
  try {
    const payloadBuffer = Buffer.from(payload, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'base64');
    return crypto.verify(null, payloadBuffer, GHL_ED25519_PUBLIC_KEY, signatureBuffer);
  } catch {
    return false;
  }
}

function verifyLegacySignature(payload: string, signature: string): boolean {
  if (!signature || signature === 'N/A') return false;
  try {
    const verifier = crypto.createVerify('SHA256');
    verifier.update(payload);
    return verifier.verify(GHL_RSA_PUBLIC_KEY, signature, 'base64');
  } catch {
    return false;
  }
}

function verifyWebhookSignature(payload: string, headers: Record<string, any>): boolean {
  // In development, skip verification if no signatures present
  const ghlSig = headers['x-ghl-signature'];
  const legacySig = headers['x-wh-signature'];

  if (ghlSig) return verifyGhlSignature(payload, ghlSig);
  if (legacySig) return verifyLegacySignature(payload, legacySig);

  // If no signature headers present, allow in development mode
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[GHL Webhook] No signature header — allowed in development mode');
    return true;
  }

  return false;
}

// ─── WEBHOOK ENDPOINT ───────────────────────────────────────────────────────

router.post('/ghl', async (req: Request, res: Response) => {
  const rawBody = JSON.stringify(req.body);

  // 1. Verify signature
  if (!verifyWebhookSignature(rawBody, req.headers)) {
    console.error('[GHL Webhook] Invalid signature — rejecting');
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  // 2. Always respond 200 immediately (GHL best practice)
  res.status(200).json({ success: true });

  // 3. Process asynchronously
  setImmediate(() => {
    processWebhook(req.body).catch((err) => {
      console.error('[GHL Webhook] Processing error:', err.message);
    });
  });
});

// ─── ASYNC WEBHOOK PROCESSOR ────────────────────────────────────────────────

async function processWebhook(body: any): Promise<void> {
  const eventType = body.type as string;
  const webhookId = body.webhookId as string;
  const data = body.data ?? body;

  if (!eventType) {
    console.warn('[GHL Webhook] No event type in payload');
    return;
  }

  const supabase = getSupabase();

  // Idempotency check
  if (webhookId) {
    const { data: existing } = await supabase
      .from('ghl_sync_log')
      .select('id')
      .eq('webhook_id', webhookId)
      .eq('status', 'success')
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`[GHL Webhook] Duplicate webhookId=${webhookId}, skipping`);
      return;
    }
  }

  // Create sync log entry
  const logId = crypto.randomUUID();
  const logEntry = {
    id: logId,
    direction: 'inbound',
    event_type: eventType,
    ghl_entity_type: resolveEntityType(eventType),
    ghl_entity_id: data.id ?? '',
    status: 'processing',
    request_payload: body,
    webhook_id: webhookId ?? null,
    idempotency_key: webhookId ? `wh-${webhookId}` : `wh-${eventType}-${data.id}-${Date.now()}`,
    created_at: new Date().toISOString(),
  };

  await supabase.from('ghl_sync_log').insert(logEntry);

  try {
    switch (eventType) {
      case 'ContactCreate':
        await handleContactCreate(supabase, data, logId);
        break;
      case 'ContactUpdate':
        await handleContactUpdate(supabase, data, logId);
        break;
      case 'ContactDelete':
        await handleContactDelete(supabase, data, logId);
        break;
      case 'OpportunityCreate':
        await handleOpportunityCreate(supabase, data, logId);
        break;
      case 'OpportunityStageUpdate':
      case 'OpportunityStatusUpdate':
      case 'OpportunityMonetaryValueUpdate':
        await handleOpportunityUpdate(supabase, data, eventType, logId);
        break;
      case 'OpportunityDelete':
        await handleOpportunityDelete(supabase, data, logId);
        break;
      default:
        console.log(`[GHL Webhook] Unhandled event type: ${eventType}`);
        await updateSyncLog(supabase, logId, 'skipped', null, `Unhandled event type: ${eventType}`);
        return;
    }

    await updateSyncLog(supabase, logId, 'success');
    console.log(`[GHL Webhook] ✅ ${eventType} processed for ${data.id}`);
  } catch (err: any) {
    console.error(`[GHL Webhook] ❌ ${eventType} failed:`, err.message);
    await updateSyncLog(supabase, logId, 'failed', null, err.message);
  }
}

// ─── EVENT HANDLERS ─────────────────────────────────────────────────────────

async function handleContactCreate(supabase: any, data: any, logId: string): Promise<void> {
  const contact = ghlService.mapContactFromWebhook(data);
  const halaCustomer = ghlContactToHalaCustomer(contact);

  // Check if this contact is already mapped
  const { data: existingMap } = await supabase
    .from('ghl_entity_map')
    .select('*')
    .eq('ghl_entity_type', 'contact')
    .eq('ghl_entity_id', contact.id)
    .limit(1);

  if (existingMap && existingMap.length > 0) {
    // Update existing customer
    await supabase
      .from('customer_master')
      .update({
        name: halaCustomer.name,
        contact_email: halaCustomer.contactEmail,
        contact_phone: halaCustomer.contactPhone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingMap[0].hala_entity_id);

    await supabase
      .from('ghl_entity_map')
      .update({ last_synced_at: new Date().toISOString(), sync_status: 'active' })
      .eq('id', existingMap[0].id);

    await updateSyncLog(supabase, logId, 'success', { action: 'updated', halaCustomerId: existingMap[0].hala_entity_id });
    return;
  }

  // Create new customer
  const customerId = crypto.randomUUID();
  await supabase.from('customer_master').insert({
    id: customerId,
    name: halaCustomer.name,
    contact_email: halaCustomer.contactEmail,
    contact_phone: halaCustomer.contactPhone,
    industry: halaCustomer.industry,
    city: halaCustomer.city,
    country: halaCustomer.country,
    ghl_contact_id: contact.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Create entity map
  await supabase.from('ghl_entity_map').insert({
    id: crypto.randomUUID(),
    ghl_entity_type: 'contact',
    ghl_entity_id: contact.id,
    hala_entity_type: 'customer',
    hala_entity_id: customerId,
    ghl_contact_id: contact.id,
    ghl_business_id: contact.businessId ?? null,
    sync_status: 'active',
    metadata: { source: 'webhook', firstName: contact.firstName, lastName: contact.lastName },
  });

  await updateSyncLog(supabase, logId, 'success', { action: 'created', halaCustomerId: customerId });
}

async function handleContactUpdate(supabase: any, data: any, logId: string): Promise<void> {
  const contact = ghlService.mapContactFromWebhook(data);

  // Find existing mapping
  const { data: existingMap } = await supabase
    .from('ghl_entity_map')
    .select('*')
    .eq('ghl_entity_type', 'contact')
    .eq('ghl_entity_id', contact.id)
    .limit(1);

  if (!existingMap || existingMap.length === 0) {
    // No mapping — treat as create
    await handleContactCreate(supabase, data, logId);
    return;
  }

  const halaCustomer = ghlContactToHalaCustomer(contact);
  await supabase
    .from('customer_master')
    .update({
      name: halaCustomer.name,
      contact_email: halaCustomer.contactEmail,
      contact_phone: halaCustomer.contactPhone,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existingMap[0].hala_entity_id);

  await supabase
    .from('ghl_entity_map')
    .update({ last_synced_at: new Date().toISOString(), sync_status: 'active' })
    .eq('id', existingMap[0].id);

  await updateSyncLog(supabase, logId, 'success', { action: 'updated', halaCustomerId: existingMap[0].hala_entity_id });
}

async function handleContactDelete(supabase: any, data: any, logId: string): Promise<void> {
  const contactId = data.id ?? data.contactId ?? '';
  if (!contactId) return;

  // Soft-delete: mark entity map as deleted (don't hard-delete the customer)
  await supabase
    .from('ghl_entity_map')
    .update({ sync_status: 'deleted', updated_at: new Date().toISOString() })
    .eq('ghl_entity_type', 'contact')
    .eq('ghl_entity_id', contactId);

  await updateSyncLog(supabase, logId, 'success', { action: 'soft_deleted', ghlContactId: contactId });
}

async function handleOpportunityCreate(supabase: any, data: any, logId: string): Promise<void> {
  const opp = ghlService.mapOpportunityFromWebhook(data);

  // Check if already mapped
  const { data: existingMap } = await supabase
    .from('ghl_entity_map')
    .select('*')
    .eq('ghl_entity_type', 'opportunity')
    .eq('ghl_entity_id', opp.id)
    .limit(1);

  if (existingMap && existingMap.length > 0) {
    console.log(`[GHL Webhook] Opportunity ${opp.id} already mapped, skipping create`);
    await updateSyncLog(supabase, logId, 'skipped', { reason: 'already_mapped' });
    return;
  }

  // Resolve contact → customer
  let customerId = '';
  let customerName = '';

  if (opp.contactId) {
    // Look up existing contact mapping
    const { data: contactMap } = await supabase
      .from('ghl_entity_map')
      .select('*')
      .eq('ghl_entity_type', 'contact')
      .eq('ghl_entity_id', opp.contactId)
      .limit(1);

    if (contactMap && contactMap.length > 0) {
      customerId = contactMap[0].hala_entity_id;
      // Fetch customer name
      const { data: customer } = await supabase
        .from('customer_master')
        .select('name')
        .eq('id', customerId)
        .limit(1);
      customerName = customer?.[0]?.name ?? '';
    } else {
      // Contact not yet synced — fetch from GHL and create
      try {
        const ghlContact = await ghlService.getContact(opp.contactId);
        const halaCustomer = ghlContactToHalaCustomer(ghlContact);
        customerId = crypto.randomUUID();
        customerName = halaCustomer.name;

        await supabase.from('customer_master').insert({
          id: customerId,
          name: halaCustomer.name,
          contact_email: halaCustomer.contactEmail,
          contact_phone: halaCustomer.contactPhone,
          ghl_contact_id: ghlContact.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        await supabase.from('ghl_entity_map').insert({
          id: crypto.randomUUID(),
          ghl_entity_type: 'contact',
          ghl_entity_id: ghlContact.id,
          hala_entity_type: 'customer',
          hala_entity_id: customerId,
          ghl_contact_id: ghlContact.id,
          ghl_business_id: ghlContact.businessId ?? null,
          sync_status: 'active',
          metadata: { source: 'auto_resolved_from_opportunity' },
        });
      } catch (err: any) {
        console.warn(`[GHL Webhook] Could not fetch contact ${opp.contactId}:`, err.message);
        // Create with minimal info
        customerId = crypto.randomUUID();
        customerName = opp.name;
        await supabase.from('customer_master').insert({
          id: customerId,
          name: opp.name,
          ghl_contact_id: opp.contactId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }
  } else {
    // No contact — create a placeholder customer
    customerId = crypto.randomUUID();
    customerName = opp.name;
    await supabase.from('customer_master').insert({
      id: customerId,
      name: opp.name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  // Resolve stage name from pipeline stage ID
  let stageName = '';
  if (opp.pipelineId && opp.pipelineStageId) {
    try {
      const pipelines = await ghlService.getPipelines();
      const pipeline = pipelines.find(p => p.id === opp.pipelineId);
      const stage = pipeline?.stages.find(s => s.id === opp.pipelineStageId);
      stageName = stage?.name ?? '';
    } catch {
      // Ignore — stage will resolve to default
    }
  }

  // Create workspace
  const workspace = ghlOpportunityToHalaWorkspace(opp, customerId, customerName, stageName);
  const workspaceId = crypto.randomUUID();

  await supabase.from('commercial_workspaces').insert({
    id: workspaceId,
    title: workspace.title,
    customer_id: workspace.customerId,
    customer_name: workspace.customerName,
    stage: workspace.stage,
    estimated_value: workspace.estimatedValue,
    owner: workspace.owner,
    source: workspace.source,
    status: workspace.status,
    ghl_opportunity_id: opp.id,
    ghl_contact_id: opp.contactId || null,
    ghl_business_id: opp.businessId ?? null,
    ghl_pipeline_id: opp.pipelineId || null,
    ghl_pipeline_stage_id: opp.pipelineStageId || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Create entity map with ALL three GHL IDs
  await supabase.from('ghl_entity_map').insert({
    id: crypto.randomUUID(),
    ghl_entity_type: 'opportunity',
    ghl_entity_id: opp.id,
    hala_entity_type: 'workspace',
    hala_entity_id: workspaceId,
    ghl_contact_id: opp.contactId || null,
    ghl_opportunity_id: opp.id,
    ghl_business_id: opp.businessId ?? null,
    sync_status: 'active',
    metadata: {
      source: 'webhook',
      pipelineId: opp.pipelineId,
      pipelineStageId: opp.pipelineStageId,
      stageName,
      monetaryValue: opp.monetaryValue,
    },
  });

  await updateSyncLog(supabase, logId, 'success', {
    action: 'created',
    halaWorkspaceId: workspaceId,
    halaCustomerId: customerId,
  });

  console.log(`[GHL Webhook] Created workspace ${workspaceId} from opportunity ${opp.id}`);
}

async function handleOpportunityUpdate(
  supabase: any,
  data: any,
  eventType: string,
  logId: string,
): Promise<void> {
  const oppId = data.id ?? data.opportunityId ?? '';
  if (!oppId) return;

  // Find existing mapping
  const { data: existingMap } = await supabase
    .from('ghl_entity_map')
    .select('*')
    .eq('ghl_entity_type', 'opportunity')
    .eq('ghl_entity_id', oppId)
    .limit(1);

  if (!existingMap || existingMap.length === 0) {
    // Not mapped yet — treat as create
    await handleOpportunityCreate(supabase, data, logId);
    return;
  }

  const workspaceId = existingMap[0].hala_entity_id;
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };

  if (eventType === 'OpportunityStageUpdate') {
    const newStageId = data.pipelineStageId ?? data.pipeline_stage_id;
    if (newStageId) {
      updates.ghl_pipeline_stage_id = newStageId;
      // Try to resolve stage name
      try {
        const pipelineId = data.pipelineId ?? existingMap[0].metadata?.pipelineId;
        if (pipelineId) {
          const pipelines = await ghlService.getPipelines();
          const pipeline = pipelines.find(p => p.id === pipelineId);
          const stage = pipeline?.stages.find(s => s.id === newStageId);
          if (stage) {
            const { resolveHalaStage } = await import('../lib/ghl-mapper.js');
            updates.stage = resolveHalaStage(stage.name);
          }
        }
      } catch { /* ignore */ }
    }
  }

  if (eventType === 'OpportunityStatusUpdate') {
    const status = data.status?.toLowerCase();
    if (status === 'won') updates.status = 'won';
    else if (status === 'lost') updates.status = 'lost';
    else if (status === 'abandoned') updates.status = 'abandoned';
    else updates.status = 'active';
  }

  if (eventType === 'OpportunityMonetaryValueUpdate') {
    const value = Number(data.monetaryValue ?? data.monetary_value ?? 0);
    if (value > 0) updates.estimated_value = value;
  }

  await supabase
    .from('commercial_workspaces')
    .update(updates)
    .eq('id', workspaceId);

  await supabase
    .from('ghl_entity_map')
    .update({ last_synced_at: new Date().toISOString(), sync_status: 'active' })
    .eq('id', existingMap[0].id);

  await updateSyncLog(supabase, logId, 'success', {
    action: 'updated',
    eventType,
    halaWorkspaceId: workspaceId,
  });
}

async function handleOpportunityDelete(supabase: any, data: any, logId: string): Promise<void> {
  const oppId = data.id ?? data.opportunityId ?? '';
  if (!oppId) return;

  await supabase
    .from('ghl_entity_map')
    .update({ sync_status: 'deleted', updated_at: new Date().toISOString() })
    .eq('ghl_entity_type', 'opportunity')
    .eq('ghl_entity_id', oppId);

  await updateSyncLog(supabase, logId, 'success', { action: 'soft_deleted', ghlOpportunityId: oppId });
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function resolveEntityType(eventType: string): string {
  if (eventType.startsWith('Contact')) return 'contact';
  if (eventType.startsWith('Opportunity')) return 'opportunity';
  if (eventType.startsWith('Business')) return 'business';
  return 'unknown';
}

async function updateSyncLog(
  supabase: any,
  logId: string,
  status: string,
  responsePayload?: any,
  error?: string,
): Promise<void> {
  const update: Record<string, any> = {
    status,
    processed_at: new Date().toISOString(),
  };
  if (responsePayload) update.response_payload = responsePayload;
  if (error) update.error = error;

  await supabase.from('ghl_sync_log').update(update).eq('id', logId);
}

export const ghlWebhookRoutes = router;
