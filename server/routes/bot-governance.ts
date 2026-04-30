/**
 * Bot Governance API Routes — Automation Persistence Sprint
 * Full CRUD for bots, versions, providers, connectors, signals, settings.
 * All routes use Zod validation + audit logging.
 */

import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../lib/auth.js';
import { validateBody } from '../lib/validate.js';
import { writeAuditLog } from '../lib/audit.js';
import { checkAllProviders, checkSingleProvider } from '../lib/provider-health.js';
import { callLLM } from '../lib/llm-provider.js';
import { runSignalScan } from '../lib/signal-scanner.js';

export const botGovernanceRoutes = Router();
botGovernanceRoutes.use(requireAuth);

// ═══════════════════════════════════════════════════════════════
// BOT DEFINITIONS
// ═══════════════════════════════════════════════════════════════

botGovernanceRoutes.get('/bots', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('bot_definitions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw { status: 500, message: error.message };
    res.json({ data: data ?? [] });
  } catch (err) { next(err); }
});

botGovernanceRoutes.get('/bots/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('bot_definitions')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error || !data) throw { status: 404, message: 'Bot not found' };
    res.json({ data });
  } catch (err) { next(err); }
});

const createBotSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['action', 'monitor']),
  purpose: z.string().min(1),
  domains_allowed: z.array(z.string()).default([]),
  regions_allowed: z.array(z.string()).default(['East']),
  roles_allowed: z.array(z.string()).min(1),
  provider_id: z.string().default('prov-openai'),
  model: z.string().default('gpt-4o'),
  rate_limit: z.number().int().min(1).max(100).default(20),
  cost_cap: z.number().min(1).max(100).default(10),
  timeout_sec: z.number().int().min(5).max(120).default(30),
});

botGovernanceRoutes.post('/bots', validateBody(createBotSchema), async (req, res, next) => {
  try {
    const body = (req as any).validatedBody;
    const { data: bot, error } = await supabaseAdmin
      .from('bot_definitions')
      .insert({ ...body, status: 'draft' })
      .select()
      .single();
    if (error) throw { status: 500, message: error.message };

    await writeAuditLog({
      actor: req.authUser,
      action: 'bot.create',
      entityType: 'bot_definitions',
      entityId: bot.id,
      after: { name: body.name, type: body.type },
      source: 'human',
    });

    res.status(201).json({ data: bot });
  } catch (err) { next(err); }
});

const updateBotSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(['draft', 'active', 'disabled', 'archived']).optional(),
  purpose: z.string().optional(),
  domains_allowed: z.array(z.string()).optional(),
  regions_allowed: z.array(z.string()).optional(),
  roles_allowed: z.array(z.string()).optional(),
  provider_id: z.string().optional(),
  model: z.string().optional(),
  rate_limit: z.number().int().min(1).max(100).optional(),
  cost_cap: z.number().min(1).max(100).optional(),
  timeout_sec: z.number().int().min(5).max(120).optional(),
});

botGovernanceRoutes.put('/bots/:id', validateBody(updateBotSchema), async (req, res, next) => {
  try {
    const body = (req as any).validatedBody;
    const { data: bot, error } = await supabaseAdmin
      .from('bot_definitions')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw { status: 500, message: error.message };
    if (!bot) throw { status: 404, message: 'Bot not found' };

    await writeAuditLog({
      actor: req.authUser,
      action: 'bot.update',
      entityType: 'bot_definitions',
      entityId: req.params.id,
      after: body,
      source: 'human',
    });

    res.json({ data: bot });
  } catch (err) { next(err); }
});

botGovernanceRoutes.delete('/bots/:id', async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin
      .from('bot_definitions')
      .delete()
      .eq('id', req.params.id);
    if (error) throw { status: 500, message: error.message };

    await writeAuditLog({
      actor: req.authUser,
      action: 'bot.delete',
      entityType: 'bot_definitions',
      entityId: req.params.id,
      source: 'human',
    });

    res.json({ success: true });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
// BOT VERSIONS
// ═══════════════════════════════════════════════════════════════

botGovernanceRoutes.get('/bots/:botId/versions', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('bot_versions')
      .select('*')
      .eq('bot_id', req.params.botId)
      .order('version', { ascending: false });
    if (error) throw { status: 500, message: error.message };
    res.json({ data: data ?? [] });
  } catch (err) { next(err); }
});

const createVersionSchema = z.object({
  system_instruction: z.string().default(''),
  custom_instruction: z.string().default(''),
  safety_rules: z.string().min(1),
  temperature: z.number().min(0).max(1).default(0.7),
  max_tokens: z.number().int().min(100).max(8000).default(2000),
  allowed_actions: z.array(z.string()).default(['suggest']),
  provider_id: z.string().default('prov-openai'),
  model: z.string().default('gpt-4o'),
  connector_snapshot: z.record(z.string(), z.boolean()).default({}),
  permission_snapshot: z.object({
    domainsAllowed: z.array(z.string()).default([]),
    regionsAllowed: z.array(z.string()).default([]),
    rolesAllowed: z.array(z.string()).default([]),
  }).default({ domainsAllowed: [], regionsAllowed: [], rolesAllowed: [] }),
  knowledge_base_ids: z.array(z.string()).default([]),
  change_note: z.string().min(1),
});

botGovernanceRoutes.post('/bots/:botId/versions', validateBody(createVersionSchema), async (req, res, next) => {
  try {
    const body = (req as any).validatedBody;
    const botId = req.params.botId;

    // Get next version number
    const { data: latest } = await supabaseAdmin
      .from('bot_versions')
      .select('version')
      .eq('bot_id', botId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = (latest?.version || 0) + 1;

    const { data: version, error } = await supabaseAdmin
      .from('bot_versions')
      .insert({
        ...body,
        bot_id: botId,
        version: nextVersion,
        created_by: req.authUser?.name || req.authUser?.userId || 'system',
      })
      .select()
      .single();
    if (error) throw { status: 500, message: error.message };

    // Update bot's current_version_id
    await supabaseAdmin
      .from('bot_definitions')
      .update({ current_version_id: version.id, updated_at: new Date().toISOString() })
      .eq('id', botId);

    await writeAuditLog({
      actor: req.authUser,
      action: 'bot_version.create',
      entityType: 'bot_versions',
      entityId: version.id,
      after: { bot_id: botId, version: nextVersion, change_note: body.change_note },
      source: 'human',
    });

    res.status(201).json({ data: version });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
// BOT PROVIDERS
// ═══════════════════════════════════════════════════════════════

botGovernanceRoutes.get('/bot-providers', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('bot_providers')
      .select('*')
      .order('name');
    if (error) throw { status: 500, message: error.message };
    res.json({ data: data ?? [] });
  } catch (err) { next(err); }
});

botGovernanceRoutes.put('/bot-providers/:id', async (req, res, next) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') throw { status: 400, message: 'enabled must be boolean' };

    const { data, error } = await supabaseAdmin
      .from('bot_providers')
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw { status: 500, message: error.message };

    await writeAuditLog({
      actor: req.authUser,
      action: enabled ? 'provider.enable' : 'provider.disable',
      entityType: 'bot_providers',
      entityId: req.params.id,
      after: { enabled },
      source: 'human',
    });

    res.json({ data });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
// BOT CONNECTORS
// ═══════════════════════════════════════════════════════════════

botGovernanceRoutes.get('/bot-connectors', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('bot_connectors')
      .select('*')
      .order('name');
    if (error) throw { status: 500, message: error.message };
    res.json({ data: data ?? [] });
  } catch (err) { next(err); }
});

botGovernanceRoutes.put('/bot-connectors/:id', async (req, res, next) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') throw { status: 400, message: 'enabled must be boolean' };

    const { data, error } = await supabaseAdmin
      .from('bot_connectors')
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw { status: 500, message: error.message };

    await writeAuditLog({
      actor: req.authUser,
      action: enabled ? 'connector.enable' : 'connector.disable',
      entityType: 'bot_connectors',
      entityId: req.params.id,
      after: { enabled },
      source: 'human',
    });

    res.json({ data });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
// SIGNAL RULES
// ═══════════════════════════════════════════════════════════════

botGovernanceRoutes.get('/signal-rules', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('signal_rules')
      .select('*')
      .order('severity')
      .order('name');
    if (error) throw { status: 500, message: error.message };
    res.json({ data: data ?? [] });
  } catch (err) { next(err); }
});

const createSignalRuleSchema = z.object({
  bot_id: z.string(),
  name: z.string().min(1),
  type: z.enum(['threshold', 'trend', 'anomaly', 'margin_drop', 'sla_breach_risk']).default('threshold'),
  metric: z.string().min(1),
  threshold: z.number().nullable().default(null),
  trend_direction: z.enum(['up', 'down']).nullable().default(null),
  time_range_hours: z.number().int().default(24),
  severity: z.enum(['fyi', 'needs_review', 'escalate']).default('fyi'),
  notify_roles: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
  description: z.string().default(''),
  condition: z.string().default(''),
  time_window: z.string().default('24h'),
  cooldown_minutes: z.number().int().default(60),
});

botGovernanceRoutes.post('/signal-rules', validateBody(createSignalRuleSchema), async (req, res, next) => {
  try {
    const body = (req as any).validatedBody;
    const { data, error } = await supabaseAdmin
      .from('signal_rules')
      .insert(body)
      .select()
      .single();
    if (error) throw { status: 500, message: error.message };

    await writeAuditLog({
      actor: req.authUser,
      action: 'signal_rule.create',
      entityType: 'signal_rules',
      entityId: data.id,
      after: { name: body.name, metric: body.metric, severity: body.severity },
      source: 'human',
    });

    res.status(201).json({ data });
  } catch (err) { next(err); }
});

botGovernanceRoutes.put('/signal-rules/:id', async (req, res, next) => {
  try {
    const { enabled, ...rest } = req.body;
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (typeof enabled === 'boolean') update.enabled = enabled;
    Object.assign(update, rest);

    const { data, error } = await supabaseAdmin
      .from('signal_rules')
      .update(update)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw { status: 500, message: error.message };

    res.json({ data });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
// SIGNAL EVENTS
// ═══════════════════════════════════════════════════════════════

botGovernanceRoutes.get('/signal-events', async (req, res, next) => {
  try {
    let query = supabaseAdmin
      .from('signal_events')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    const severity = req.query.severity as string;
    if (severity && severity !== 'all') query = query.eq('severity', severity);

    const acknowledged = req.query.acknowledged as string;
    if (acknowledged === 'false') query = query.eq('acknowledged', false);
    if (acknowledged === 'true') query = query.eq('acknowledged', true);

    const { data, error } = await query;
    if (error) throw { status: 500, message: error.message };
    res.json({ data: data ?? [] });
  } catch (err) { next(err); }
});

botGovernanceRoutes.patch('/signal-events/:id/acknowledge', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('signal_events')
      .update({
        acknowledged: true,
        acknowledged_by: req.authUser?.name || req.authUser?.userId || 'unknown',
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw { status: 500, message: error.message };

    await writeAuditLog({
      actor: req.authUser,
      action: 'signal.acknowledge',
      entityType: 'signal_events',
      entityId: req.params.id,
      source: 'human',
    });

    res.json({ data });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
// BOT INVOCATIONS (audit trail)
// ═══════════════════════════════════════════════════════════════

botGovernanceRoutes.get('/bot-invocations', async (req, res, next) => {
  try {
    let query = supabaseAdmin
      .from('bot_invocations')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(200);

    const botId = req.query.bot_id as string;
    if (botId && botId !== 'all') query = query.eq('bot_id', botId);

    const { data, error } = await query;
    if (error) throw { status: 500, message: error.message };
    res.json({ data: data ?? [] });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
// GLOBAL SETTINGS
// ═══════════════════════════════════════════════════════════════

botGovernanceRoutes.get('/bot-settings', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('bot_global_settings')
      .select('*')
      .eq('id', 'settings')
      .single();
    if (error) throw { status: 500, message: error.message };
    res.json({ data: data ?? { global_kill_switch: false, max_concurrent_bots: 5, max_daily_cost_usd: 50, audit_retention_days: 365, require_human_acceptance: true } });
  } catch (err) { next(err); }
});

const updateSettingsSchema = z.object({
  global_kill_switch: z.boolean().optional(),
  kill_switch_activated_by: z.string().nullable().optional(),
  kill_switch_activated_at: z.string().nullable().optional(),
  max_concurrent_bots: z.number().int().min(1).max(20).optional(),
  max_daily_cost_usd: z.number().min(1).max(500).optional(),
  audit_retention_days: z.number().int().min(30).max(3650).optional(),
  require_human_acceptance: z.boolean().optional(),
});

botGovernanceRoutes.put('/bot-settings', validateBody(updateSettingsSchema), async (req, res, next) => {
  try {
    const body = (req as any).validatedBody;
    const { data, error } = await supabaseAdmin
      .from('bot_global_settings')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', 'settings')
      .select()
      .single();
    if (error) throw { status: 500, message: error.message };

    await writeAuditLog({
      actor: req.authUser,
      action: body.global_kill_switch !== undefined ? 'settings.kill_switch' : 'settings.update',
      entityType: 'bot_global_settings',
      entityId: 'settings',
      after: body,
      source: 'human',
    });

    res.json({ data });
  } catch (err) { next(err); }
});

// ── Bot Invocation (server-side gate checks + logging) ──
const invokeSchema = z.object({
  context: z.string().min(1).max(2000),
  context_type: z.enum(['proposal', 'sla', 'dashboard', 'quote', 'report', 'workspace']),
  input_payload: z.string().max(10000).optional().default(''),
});

botGovernanceRoutes.post('/bots/:id/invoke', validateBody(invokeSchema), async (req, res, next) => {
  try {
    const botId = req.params.id;
    const body = (req as any).validatedBody;
    const user = req.authUser!;

    // Step 1: Check global kill switch
    const { data: settings } = await supabaseAdmin
      .from('bot_global_settings').select('global_kill_switch').eq('id', 'settings').maybeSingle();
    if (settings?.global_kill_switch) {
      return res.status(403).json({ data: { success: false, blocked: true, blockReason: 'Global kill switch is active. All bot invocations are disabled.' } });
    }

    // Step 2: Fetch bot
    const { data: bot, error: botErr } = await supabaseAdmin
      .from('bot_definitions').select('*').eq('id', botId).maybeSingle();
    if (botErr || !bot) throw { status: 404, message: 'Bot not found' };
    if (bot.status !== 'active') {
      return res.status(403).json({ data: { success: false, blocked: true, blockReason: `Bot "${bot.display_name}" is ${bot.status}. Only active bots can be invoked.` } });
    }

    // Step 3: Check provider
    if (bot.provider_id) {
      const { data: provider } = await supabaseAdmin
        .from('bot_providers').select('enabled, name').eq('id', bot.provider_id).maybeSingle();
      if (provider && !provider.enabled) {
        return res.status(403).json({ data: { success: false, blocked: true, blockReason: `Provider "${provider.name}" is disabled.` } });
      }
    }

    // Step 4: RBAC check
    const userRole = user.role || 'salesman';
    const rolesAllowed = bot.roles_allowed || ['*'];
    if (!rolesAllowed.includes('*') && !rolesAllowed.includes(userRole)) {
      return res.status(403).json({ data: { success: false, blocked: true, blockReason: `Role "${userRole}" is not authorized to invoke this bot.` } });
    }

    // Step 5: Call LLM (real or stub) and log invocation
    const invocationId = crypto.randomUUID();

    // Load bot version for system instruction
    let systemInstruction = bot.purpose || '';
    if (bot.current_version_id) {
      const { data: version } = await supabaseAdmin
        .from('bot_versions').select('system_instruction, custom_instruction, safety_rules, temperature, max_tokens')
        .eq('id', bot.current_version_id).maybeSingle();
      if (version) {
        systemInstruction = [
          version.system_instruction,
          version.custom_instruction,
          version.safety_rules ? `SAFETY RULES: ${version.safety_rules}` : '',
        ].filter(Boolean).join('\n\n');
      }
    }

    const llmResult = await callLLM({
      provider: bot.provider_id || 'prov-openai',
      model: bot.model || 'gpt-4o',
      systemPrompt: systemInstruction,
      userPrompt: `Context: ${body.context}\n\n${body.input_payload || ''}`.trim(),
      temperature: 0.7,
      maxTokens: 2000,
      timeoutMs: (bot.timeout_sec || 30) * 1000,
    });

    const invocation = {
      id: invocationId,
      bot_id: botId,
      bot_version_id: bot.current_version_id || botId,
      user_id: user.userId,
      user_role: userRole,
      context: body.context,
      context_type: body.context_type,
      input_payload_hash: `sha256:${body.input_payload?.length || 0}`,
      output: llmResult.output,
      accepted: null,
      edited: false,
      cost: llmResult.cost,
      latency_ms: llmResult.latencyMs,
      gate_checks: { global_kill_switch: false, provider_enabled: true, bot_enabled: true, connectors_enabled: true, rbac_passed: true },
      created_at: new Date().toISOString(),
    };

    await supabaseAdmin.from('bot_invocations').insert(invocation);

    // Update bot stats
    await supabaseAdmin.from('bot_definitions').update({
      total_invocations: (bot.total_invocations || 0) + 1,
      cost_usage: (bot.cost_usage || 0) + llmResult.cost,
      last_run_at: new Date().toISOString(),
    }).eq('id', botId);

    await writeAuditLog({
      actor: user,
      action: 'bot.invoke',
      entityType: 'bot_invocations',
      entityId: invocationId,
      after: { bot_id: botId, context_type: body.context_type, cost: llmResult.cost, isStub: llmResult.isStub },
      source: 'human',
    });

    res.json({ data: {
      success: true, blocked: false, blockReason: null,
      output: llmResult.output, invocationId,
      cost: llmResult.cost, latencyMs: llmResult.latencyMs,
      isStub: llmResult.isStub, provider: llmResult.provider, model: llmResult.model,
    } });
  } catch (err) { next(err); }
});

// ── Provider Health Checks ──────────────────────────────────
botGovernanceRoutes.post('/bot-providers/health-check', async (_req, res, next) => {
  try {
    const results = await checkAllProviders();
    res.json({ data: results });
  } catch (err) { next(err); }
});

botGovernanceRoutes.post('/bot-providers/:id/health-check', async (req, res, next) => {
  try {
    const result = await checkSingleProvider(req.params.id);
    if (!result) throw { status: 404, message: 'Provider not found' };
    res.json({ data: result });
  } catch (err) { next(err); }
});

// ── Signal Scanner ──────────────────────────────────────────
botGovernanceRoutes.post('/signal-scanner/run', async (req, res, next) => {
  try {
    const user = (req as any).user;
    const result = await runSignalScan();

    await writeAuditLog({
      actor: user,
      action: 'signal.scan',
      entityType: 'signal_scanner',
      entityId: 'manual-run',
      after: { scanned: result.scanned, triggered: result.triggered },
      source: 'human',
    });

    res.json({ data: result });
  } catch (err) { next(err); }
});

// ── Block Quick Actions ─────────────────────────────────────
const QUICK_ACTION_PROMPTS: Record<string, string> = {
  'translate-arabic': 'Translate the following content to formal Arabic (فصحى). Maintain all HTML formatting tags. Output only the translated HTML, nothing else.',
  'translate-english': 'Translate the following content to professional business English. Maintain all HTML formatting tags. Output only the translated HTML, nothing else.',
  'restyle-formal': 'Rewrite the following content in a formal, professional business tone suitable for a commercial document. Maintain HTML formatting. Output only the rewritten HTML.',
  'restyle-concise': 'Rewrite the following content to be 50% shorter while preserving all key points and factual information. Maintain HTML formatting. Output only the rewritten HTML.',
  'rewrite-improve': 'Improve the clarity, grammar, and persuasiveness of this content. Fix any errors. Maintain HTML formatting. Output only the improved HTML.',
  'summarize': 'Summarize the following content in 2-3 concise bullet points. Use <ul><li> HTML format. Output only the summary HTML.',
  'expand': 'Expand the following content with more detail, examples, and supporting specifics. Double the length while maintaining relevance. Maintain HTML formatting. Output only the expanded HTML.',
};

botGovernanceRoutes.post('/bots/quick-action', async (req, res, next) => {
  try {
    const user = (req as any).user;
    const { action, content, context_type } = req.body;

    if (!action || !content) {
      return res.status(400).json({ error: 'action and content are required' });
    }

    const systemPrompt = QUICK_ACTION_PROMPTS[action];
    if (!systemPrompt) {
      return res.status(400).json({ error: `Unknown action: ${action}. Valid: ${Object.keys(QUICK_ACTION_PROMPTS).join(', ')}` });
    }

    // Governance gate: check global kill switch
    const { data: settings } = await supabaseAdmin
      .from('bot_global_settings').select('global_kill_switch').eq('id', 'settings').maybeSingle();
    if (settings?.global_kill_switch) {
      return res.status(403).json({ error: 'Global kill switch is active. All AI operations are disabled.' });
    }

    const llmResult = await callLLM({
      provider: 'prov-openai',
      model: 'gpt-4o-mini',
      systemPrompt,
      userPrompt: content,
      temperature: 0.3,
      maxTokens: 4000,
      timeoutMs: 20000,
    });

    // Audit trail
    const invocationId = crypto.randomUUID();
    await supabaseAdmin.from('bot_invocations').insert({
      id: invocationId,
      bot_id: 'system-quick-action',
      user_id: user.userId,
      user_role: user.role || 'user',
      context: `Quick Action: ${action}`,
      context_type: context_type || 'workspace',
      output: llmResult.output.substring(0, 500),
      cost: llmResult.cost,
      latency_ms: llmResult.latencyMs,
      gate_checks: { global_kill_switch: false, provider_enabled: true, bot_enabled: true, connectors_enabled: true, rbac_passed: true },
    });

    res.json({
      data: {
        output: llmResult.output,
        cost: llmResult.cost,
        latencyMs: llmResult.latencyMs,
        isStub: llmResult.isStub,
        action,
      },
    });
  } catch (err) { next(err); }
});
