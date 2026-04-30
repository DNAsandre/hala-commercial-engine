/**
 * Seed Script — Automation Subsystem
 * Idempotently inserts default bots, providers, connectors, signal rules, and sample events.
 * Run: npx tsx scripts/seed-bots.ts
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('🤖 Seeding Automation subsystem...\n');

  // ─── Providers ─────────────────────────────────────────
  const providers = [
    { id: 'prov-openai', name: 'OpenAI', enabled: true, api_endpoint: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'], cost_per_token: 0.00003, max_rate_per_minute: 60, status: 'healthy' },
    { id: 'prov-anthropic', name: 'Anthropic', enabled: true, api_endpoint: 'https://api.anthropic.com/v1', models: ['claude-3.5-sonnet', 'claude-3-haiku'], cost_per_token: 0.000025, max_rate_per_minute: 40, status: 'healthy' },
    { id: 'prov-google', name: 'Google AI', enabled: false, api_endpoint: 'https://generativelanguage.googleapis.com/v1', models: ['gemini-2.0-flash', 'gemini-1.5-pro'], cost_per_token: 0.00002, max_rate_per_minute: 30, status: 'offline' },
  ];

  const { error: provErr } = await supabase.from('bot_providers').upsert(providers, { onConflict: 'id' });
  console.log(provErr ? `  ❌ Providers: ${provErr.message}` : `  ✅ Providers: ${providers.length} upserted`);

  // ─── Connectors ────────────────────────────────────────
  const connectors = [
    { id: 'conn-finance', type: 'finance', name: 'Finance System (SAP)', enabled: true, access_mode: 'read_only', endpoint: 'https://sap.hala.com/api', status: 'connected' },
    { id: 'conn-ops', type: 'ops', name: 'Operations (WMS)', enabled: true, access_mode: 'read_only', endpoint: 'https://wms.hala.com/api', status: 'connected' },
    { id: 'conn-tableau', type: 'tableau', name: 'Tableau Analytics', enabled: false, access_mode: 'read_only', endpoint: 'https://tableau.hala.com/api', status: 'disconnected' },
    { id: 'conn-crm', type: 'crm', name: 'Zoho CRM', enabled: true, access_mode: 'read_only', endpoint: 'https://www.zohoapis.com/crm/v2', status: 'connected' },
    { id: 'conn-custom', type: 'custom', name: 'Custom Data Lake', enabled: false, access_mode: 'none', endpoint: '', status: 'disconnected' },
  ];

  const { error: connErr } = await supabase.from('bot_connectors').upsert(connectors, { onConflict: 'id' });
  console.log(connErr ? `  ❌ Connectors: ${connErr.message}` : `  ✅ Connectors: ${connectors.length} upserted`);

  // ─── Bots ──────────────────────────────────────────────
  const bots = [
    { id: 'bot-proposal-drafter', name: 'Proposal Drafter', type: 'action', status: 'active', purpose: 'Generates draft proposal sections from meeting transcripts and customer data. Outputs require human review and acceptance.', domains_allowed: ['proposals', 'quotes'], regions_allowed: ['East', 'Central', 'West'], roles_allowed: ['commercial_director', 'sales_head', 'salesman'], provider_id: 'prov-openai', model: 'gpt-4o', rate_limit: 20, cost_cap: 10, timeout_sec: 30, total_invocations: 156, cost_usage: 3.45, error_rate: 0.02 },
    { id: 'bot-sla-explainer', name: 'SLA Clause Explainer', type: 'action', status: 'active', purpose: 'Explains SLA clauses in plain language for client-facing discussions. Suggest mode only.', domains_allowed: ['slas'], regions_allowed: ['*'], roles_allowed: ['*'], provider_id: 'prov-anthropic', model: 'claude-3.5-sonnet', rate_limit: 30, cost_cap: 5, timeout_sec: 15, total_invocations: 89, cost_usage: 1.20, error_rate: 0.01 },
    { id: 'bot-margin-monitor', name: 'Margin Monitor', type: 'monitor', status: 'active', purpose: 'Scans deal pipeline for margin erosion, GP% drops below threshold, and cost anomalies. Generates signals for human review.', domains_allowed: ['dashboard', 'quotes', 'workspace'], regions_allowed: ['East', 'Central', 'West'], roles_allowed: ['commercial_director', 'finance'], provider_id: 'prov-openai', model: 'gpt-4o-mini', rate_limit: 10, cost_cap: 8, timeout_sec: 60, total_invocations: 312, cost_usage: 5.80, error_rate: 0.005 },
    { id: 'bot-renewal-scanner', name: 'Renewal Risk Scanner', type: 'monitor', status: 'active', purpose: 'Monitors contract expiry dates and customer health signals to flag renewal risks 90/60/30 days before expiry.', domains_allowed: ['dashboard', 'customers'], regions_allowed: ['*'], roles_allowed: ['commercial_director', 'sales_head'], provider_id: 'prov-anthropic', model: 'claude-3-haiku', rate_limit: 5, cost_cap: 3, timeout_sec: 45, total_invocations: 67, cost_usage: 0.95, error_rate: 0.0 },
    { id: 'bot-quote-helper', name: 'Quote Rate Suggester', type: 'action', status: 'draft', purpose: 'Suggests competitive rates based on historical pricing data and market benchmarks. Draft mode — all suggestions require human approval.', domains_allowed: ['quotes'], regions_allowed: ['East'], roles_allowed: ['salesman', 'sales_head'], provider_id: 'prov-openai', model: 'gpt-4o-mini', rate_limit: 15, cost_cap: 5, timeout_sec: 20, total_invocations: 0, cost_usage: 0, error_rate: 0.0 },
    { id: 'bot-sla-breach-monitor', name: 'SLA Breach Predictor', type: 'monitor', status: 'disabled', purpose: 'Analyzes operational data to predict potential SLA breaches before they occur.', domains_allowed: ['slas', 'dashboard'], regions_allowed: ['East', 'Central'], roles_allowed: ['ops_head', 'commercial_director'], provider_id: 'prov-google', model: 'gemini-2.0-flash', rate_limit: 8, cost_cap: 4, timeout_sec: 30, total_invocations: 0, cost_usage: 0, error_rate: 0.0 },
  ];

  const { error: botErr } = await supabase.from('bot_definitions').upsert(bots, { onConflict: 'id' });
  console.log(botErr ? `  ❌ Bots: ${botErr.message}` : `  ✅ Bots: ${bots.length} upserted`);

  // ─── Signal Rules ──────────────────────────────────────
  const signalRules = [
    { id: 'sr-1', bot_id: 'bot-margin-monitor', name: 'GP% Below 22%', type: 'threshold', metric: 'gross_profit_percent', threshold: 22, severity: 'needs_review', notify_roles: ['commercial_director', 'sales_head'], enabled: true, description: 'Triggers when any active deal GP% falls below 22% threshold', condition: '< 22%', time_window: '24h', cooldown_minutes: 60, time_range_hours: 24 },
    { id: 'sr-2', bot_id: 'bot-margin-monitor', name: 'GP% Below 10%', type: 'threshold', metric: 'gross_profit_percent', threshold: 10, severity: 'escalate', notify_roles: ['commercial_director', 'ceo', 'cfo'], enabled: true, description: 'Immediate escalation when GP% drops below 10%', condition: '< 10%', time_window: '1h', cooldown_minutes: 15, time_range_hours: 1 },
    { id: 'sr-3', bot_id: 'bot-margin-monitor', name: 'Cost Spike Detection', type: 'anomaly', metric: 'cost_to_serve', threshold: 15, trend_direction: 'up', severity: 'needs_review', notify_roles: ['commercial_director', 'finance'], enabled: true, description: 'Detects >15% week-over-week cost increase anomalies', condition: '> 15% WoW', time_window: '7d', cooldown_minutes: 120, time_range_hours: 168 },
    { id: 'sr-4', bot_id: 'bot-renewal-scanner', name: 'Contract Expiry 90 Days', type: 'threshold', metric: 'days_to_expiry', threshold: 90, severity: 'fyi', notify_roles: ['sales_head'], enabled: true, description: 'Early warning for contracts expiring within 90 days', condition: '< 90 days', time_window: '24h', cooldown_minutes: 1440, time_range_hours: 24 },
    { id: 'sr-5', bot_id: 'bot-renewal-scanner', name: 'Contract Expiry 30 Days', type: 'threshold', metric: 'days_to_expiry', threshold: 30, severity: 'escalate', notify_roles: ['commercial_director', 'sales_head'], enabled: true, description: 'Critical alert for contracts expiring within 30 days', condition: '< 30 days', time_window: '24h', cooldown_minutes: 720, time_range_hours: 24 },
    { id: 'sr-6', bot_id: 'bot-renewal-scanner', name: 'Customer Health Decline', type: 'trend', metric: 'ecr_score', trend_direction: 'down', severity: 'needs_review', notify_roles: ['commercial_director'], enabled: true, description: 'Detects declining ECR scores over 30-day window', condition: 'declining trend', time_window: '30d', cooldown_minutes: 1440, time_range_hours: 720 },
    { id: 'sr-7', bot_id: 'bot-margin-monitor', name: 'DSO Above 45 Days', type: 'threshold', metric: 'dso_days', threshold: 45, severity: 'needs_review', notify_roles: ['finance', 'commercial_director'], enabled: true, description: 'Flags customers with DSO exceeding 45-day threshold', condition: '> 45 days', time_window: '24h', cooldown_minutes: 240, time_range_hours: 24 },
  ];

  const { error: srErr } = await supabase.from('signal_rules').upsert(signalRules, { onConflict: 'id' });
  console.log(srErr ? `  ❌ Signal Rules: ${srErr.message}` : `  ✅ Signal Rules: ${signalRules.length} upserted`);

  // ─── Sample Signal Events ──────────────────────────────
  const signalEvents = [
    { id: 'se-1', rule_id: 'sr-1', bot_id: 'bot-margin-monitor', severity: 'needs_review', metric: 'gross_profit_percent', threshold_triggered: 'GP% = 19.7% (threshold: 22%)', time_range_analyzed: 'Last 24 hours', message: "Ma'aden Jubail Expansion deal GP% at 19.7% — below 22% threshold.", acknowledged: false, explainability: 'GP% dropped from 24.1% to 19.7% over the past 24 hours.', suggested_action: 'Review revised transport cost estimates.' },
    { id: 'se-2', rule_id: 'sr-2', bot_id: 'bot-margin-monitor', severity: 'escalate', metric: 'gross_profit_percent', threshold_triggered: 'GP% = 8.5% (threshold: 10%)', time_range_analyzed: 'Last 1 hour', message: 'Al-Rajhi Emergency Storage deal GP% at 8.5% — CEO/CFO approval required.', acknowledged: true, acknowledged_by: 'Amin Al-Rashid', explainability: 'GP% dropped to 8.5% due to expedited handling surcharges.', suggested_action: 'Escalate to CEO/CFO for margin recovery decision.' },
    { id: 'se-3', rule_id: 'sr-4', bot_id: 'bot-renewal-scanner', severity: 'fyi', metric: 'days_to_expiry', threshold_triggered: '78 days remaining', time_range_analyzed: 'Daily scan', message: 'Nestlé Riyadh contract expires in 78 days.', acknowledged: false, explainability: 'ECR grade B+. No renewal conversation logged.', suggested_action: 'Schedule renewal discussion.' },
    { id: 'se-4', rule_id: 'sr-7', bot_id: 'bot-margin-monitor', severity: 'needs_review', metric: 'dso_days', threshold_triggered: 'DSO = 68 days (threshold: 45)', time_range_analyzed: 'Last 24 hours', message: 'Al-Rajhi Steel DSO at 68 days — above 45-day threshold.', acknowledged: true, acknowledged_by: 'Amin Al-Rashid', explainability: '3 outstanding invoices totaling SAR 2.1M.', suggested_action: 'Initiate payment collection escalation.' },
    { id: 'se-5', rule_id: 'sr-5', bot_id: 'bot-renewal-scanner', severity: 'escalate', metric: 'days_to_expiry', threshold_triggered: '22 days remaining', time_range_analyzed: 'Daily scan', message: 'Almarai Dammam contract expires in 22 days. CRITICAL.', acknowledged: false, explainability: 'ECR grade A. Annual value SAR 4.8M. No renewal activity.', suggested_action: 'URGENT: Schedule immediate renewal meeting.' },
  ];

  const { error: seErr } = await supabase.from('signal_events').upsert(signalEvents, { onConflict: 'id' });
  console.log(seErr ? `  ❌ Signal Events: ${seErr.message}` : `  ✅ Signal Events: ${signalEvents.length} upserted`);

  // ─── Global Settings ───────────────────────────────────
  const { error: settErr } = await supabase
    .from('bot_global_settings')
    .upsert({ id: 'settings', global_kill_switch: false, max_concurrent_bots: 5, max_daily_cost_usd: 50, audit_retention_days: 365, require_human_acceptance: true }, { onConflict: 'id' });
  console.log(settErr ? `  ❌ Settings: ${settErr.message}` : `  ✅ Global Settings: initialized`);

  console.log('\n🎯 Seed complete!');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
