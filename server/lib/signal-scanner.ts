/**
 * Signal Scanner — Sprint 3 (S3-06)
 *
 * Reads real business data from workspaces, quotes, and customers tables.
 * Evaluates active signal_rules against actual metrics.
 * Generates signal_events when thresholds are breached.
 * Respects cooldown periods to prevent duplicate alerts.
 */

import { supabaseAdmin } from './supabase.js';

interface ScanResult {
  scanned: number;
  triggered: number;
  events: {
    ruleId: string;
    ruleName: string;
    botId: string;
    severity: string;
    metric: string;
    message: string;
  }[];
  errors: string[];
}

/**
 * Run signal scanner: evaluate all enabled rules against real business data.
 */
export async function runSignalScan(): Promise<ScanResult> {
  const result: ScanResult = { scanned: 0, triggered: 0, events: [], errors: [] };

  // 1. Load active signal rules
  const { data: rules, error: rulesErr } = await supabaseAdmin
    .from('signal_rules')
    .select('*')
    .eq('enabled', true);

  if (rulesErr || !rules?.length) {
    if (rulesErr) result.errors.push(`Failed to load rules: ${rulesErr.message}`);
    return result;
  }

  // 2. Load business data
  const [workspaces, quotes, customers] = await Promise.all([
    supabaseAdmin.from('workspaces').select('*').then(r => r.data || []),
    supabaseAdmin.from('quotes').select('*').then(r => r.data || []),
    supabaseAdmin.from('customers').select('*').then(r => r.data || []),
  ]);

  // 3. Build metric snapshots from real data
  const metrics = buildMetricSnapshots(workspaces, quotes, customers);

  // 4. Load recent events for cooldown checking
  const { data: recentEvents } = await supabaseAdmin
    .from('signal_events')
    .select('rule_id, triggered_at')
    .gte('triggered_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const recentEventMap = new Map<string, string>();
  for (const ev of recentEvents || []) {
    const existing = recentEventMap.get(ev.rule_id);
    if (!existing || ev.triggered_at > existing) {
      recentEventMap.set(ev.rule_id, ev.triggered_at);
    }
  }

  // 5. Evaluate each rule
  for (const rule of rules) {
    result.scanned++;

    // Check cooldown
    const lastTriggered = recentEventMap.get(rule.id);
    if (lastTriggered && rule.cooldown_minutes) {
      const cooldownMs = rule.cooldown_minutes * 60 * 1000;
      const elapsed = Date.now() - new Date(lastTriggered).getTime();
      if (elapsed < cooldownMs) continue; // Still in cooldown
    }

    // Evaluate rule against metrics
    const breaches = evaluateRule(rule, metrics);

    for (const breach of breaches) {
      const eventId = `se-scan-${crypto.randomUUID().substring(0, 8)}`;
      const event = {
        id: eventId,
        rule_id: rule.id,
        bot_id: rule.bot_id,
        severity: rule.severity || 'needs_review',
        metric: rule.metric,
        threshold_triggered: breach.thresholdDisplay,
        time_range_analyzed: `Scanner run at ${new Date().toISOString()}`,
        message: breach.message,
        acknowledged: false,
        explainability: breach.explainability,
        suggested_action: breach.suggestedAction,
      };

      const { error: insertErr } = await supabaseAdmin
        .from('signal_events')
        .insert(event);

      if (insertErr) {
        result.errors.push(`Failed to insert event for rule ${rule.id}: ${insertErr.message}`);
      } else {
        result.triggered++;
        result.events.push({
          ruleId: rule.id,
          ruleName: rule.name,
          botId: rule.bot_id,
          severity: event.severity,
          metric: rule.metric,
          message: breach.message,
        });
      }
    }
  }

  return result;
}

// ── Metric Snapshot Builder ─────────────────────────────────

interface MetricSnapshot {
  entity: string;
  entityId: string;
  metric: string;
  value: number;
  context: Record<string, unknown>;
}

function buildMetricSnapshots(
  workspaces: any[],
  quotes: any[],
  customers: any[],
): MetricSnapshot[] {
  const snapshots: MetricSnapshot[] = [];

  // Workspace metrics: GP%, revenue, deal value
  for (const ws of workspaces) {
    if (ws.gross_profit_percent != null) {
      snapshots.push({
        entity: ws.customer_name || ws.name || ws.id,
        entityId: ws.id,
        metric: 'gross_profit_percent',
        value: Number(ws.gross_profit_percent),
        context: { workspace: ws.name, customer: ws.customer_name },
      });
    }
    if (ws.cost_to_serve != null) {
      snapshots.push({
        entity: ws.customer_name || ws.name || ws.id,
        entityId: ws.id,
        metric: 'cost_to_serve',
        value: Number(ws.cost_to_serve),
        context: { workspace: ws.name, customer: ws.customer_name },
      });
    }
  }

  // Quote metrics: margin, value
  for (const qt of quotes) {
    const gp = qt.gross_profit_percent ?? qt.gp_percent ?? qt.margin_percent;
    if (gp != null) {
      snapshots.push({
        entity: qt.customer_name || qt.reference || qt.id,
        entityId: qt.id,
        metric: 'gross_profit_percent',
        value: Number(gp),
        context: { quote: qt.reference, customer: qt.customer_name },
      });
    }
  }

  // Customer metrics: DSO, contract expiry, ECR score
  for (const cust of customers) {
    if (cust.dso_days != null) {
      snapshots.push({
        entity: cust.name,
        entityId: cust.id,
        metric: 'dso_days',
        value: Number(cust.dso_days),
        context: { customer: cust.name },
      });
    }
    if (cust.contract_expiry || cust.contractExpiry) {
      const expiry = new Date(cust.contract_expiry || cust.contractExpiry);
      const daysToExpiry = Math.floor((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysToExpiry > 0) {
        snapshots.push({
          entity: cust.name,
          entityId: cust.id,
          metric: 'days_to_expiry',
          value: daysToExpiry,
          context: { customer: cust.name, expiryDate: expiry.toISOString().split('T')[0] },
        });
      }
    }
    if (cust.ecr_score != null || cust.ecrScore != null) {
      snapshots.push({
        entity: cust.name,
        entityId: cust.id,
        metric: 'ecr_score',
        value: Number(cust.ecr_score ?? cust.ecrScore),
        context: { customer: cust.name },
      });
    }
  }

  return snapshots;
}

// ── Rule Evaluator ──────────────────────────────────────────

interface Breach {
  thresholdDisplay: string;
  message: string;
  explainability: string;
  suggestedAction: string;
}

function evaluateRule(rule: any, metrics: MetricSnapshot[]): Breach[] {
  const breaches: Breach[] = [];
  const relevant = metrics.filter(m => m.metric === rule.metric);

  if (relevant.length === 0) return breaches;

  for (const snapshot of relevant) {
    let breached = false;

    if (rule.type === 'threshold' && rule.threshold != null) {
      const threshold = Number(rule.threshold);

      // Determine direction based on metric semantics
      if (['gross_profit_percent', 'days_to_expiry', 'ecr_score'].includes(rule.metric)) {
        // These are "lower is worse" — breach when value drops BELOW threshold
        breached = snapshot.value < threshold;
      } else if (['dso_days', 'cost_to_serve'].includes(rule.metric)) {
        // These are "higher is worse" — breach when value EXCEEDS threshold
        breached = snapshot.value > threshold;
      }
    } else if (rule.type === 'anomaly' && rule.threshold != null) {
      // Anomaly: value deviates by more than threshold% from baseline
      // For now, treat as threshold-style check
      breached = snapshot.value > Number(rule.threshold);
    }

    if (breached) {
      const metricLabel = formatMetricLabel(rule.metric);
      const valueStr = formatMetricValue(rule.metric, snapshot.value);
      const thresholdStr = formatMetricValue(rule.metric, Number(rule.threshold));

      breaches.push({
        thresholdDisplay: `${metricLabel} = ${valueStr} (threshold: ${thresholdStr})`,
        message: `${snapshot.entity} — ${metricLabel} at ${valueStr}, ${rule.type === 'threshold' ? 'breaching' : 'anomaly detected at'} ${thresholdStr} threshold.`,
        explainability: `${metricLabel} measured at ${valueStr} for ${snapshot.entity}. Rule "${rule.name}" triggered.`,
        suggestedAction: generateSuggestedAction(rule, snapshot),
      });
    }
  }

  return breaches;
}

function formatMetricLabel(metric: string): string {
  const labels: Record<string, string> = {
    gross_profit_percent: 'GP%',
    cost_to_serve: 'Cost to Serve',
    dso_days: 'DSO',
    days_to_expiry: 'Days to Expiry',
    ecr_score: 'ECR Score',
  };
  return labels[metric] || metric;
}

function formatMetricValue(metric: string, value: number): string {
  if (metric === 'gross_profit_percent') return `${value.toFixed(1)}%`;
  if (metric === 'dso_days') return `${Math.round(value)} days`;
  if (metric === 'days_to_expiry') return `${Math.round(value)} days`;
  if (metric === 'cost_to_serve') return `SAR ${value.toLocaleString()}`;
  if (metric === 'ecr_score') return value.toFixed(1);
  return String(value);
}

function generateSuggestedAction(rule: any, snapshot: MetricSnapshot): string {
  const metric = rule.metric;
  const severity = rule.severity;

  if (metric === 'gross_profit_percent' && severity === 'escalate') {
    return `Escalate ${snapshot.entity} margin erosion to CEO/CFO. Review pricing and cost structure immediately.`;
  }
  if (metric === 'gross_profit_percent') {
    return `Review ${snapshot.entity} deal economics. Investigate cost drivers and consider pricing adjustment.`;
  }
  if (metric === 'days_to_expiry' && severity === 'escalate') {
    return `URGENT: Schedule immediate renewal meeting with ${snapshot.entity}. Contract expiring soon.`;
  }
  if (metric === 'days_to_expiry') {
    return `Schedule renewal discussion with ${snapshot.entity}. Prepare renewal terms and value proposition.`;
  }
  if (metric === 'dso_days') {
    return `Initiate payment collection follow-up for ${snapshot.entity}. Review outstanding invoices.`;
  }
  if (metric === 'ecr_score') {
    return `Review customer health indicators for ${snapshot.entity}. Investigate declining engagement.`;
  }
  return `Review ${formatMetricLabel(metric)} for ${snapshot.entity}. Take corrective action as needed.`;
}
