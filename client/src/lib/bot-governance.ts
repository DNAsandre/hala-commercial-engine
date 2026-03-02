/**
 * BOT GOVERNANCE & MONITOR SYSTEM
 * ================================
 * Design: Swiss Precision Instrument — Deep navy + warm white
 * Doctrine: Human-First. AI assists. Humans decide.
 * Bots have ZERO inherent authority. Everything explicit, configurable, auditable, reversible, versioned.
 */

// ============================================================
// SECTION 9 — DATABASE ENTITIES (TypeScript interfaces)
// ============================================================

export type BotType = 'action' | 'monitor';
export type BotStatus = 'draft' | 'active' | 'disabled' | 'archived';
export type ActionBotMode = 'suggest' | 'draft' | 'explain';
export type MonitorBotOutput = 'signal_event' | 'report_snapshot' | 'dashboard_annotation';
export type SignalSeverity = 'fyi' | 'needs_review' | 'escalate';
export type SignalRuleType = 'threshold' | 'trend' | 'anomaly' | 'margin_drop' | 'sla_breach_risk';
export type ConnectorType = 'finance' | 'ops' | 'tableau' | 'crm' | 'custom';

// HARD ACTION DENY LIST — System-level, cannot be overridden
export const HARD_ACTION_DENY_LIST = [
  'approve',
  'override_policy_gate',
  'modify_pricing',
  'change_gp_percent',
  'change_sla_scope',
  'move_stages',
  'trigger_approvals',
  'trigger_workflows',
  'send_external_webhooks',
  'deploy',
  'modify_commercial_data',
  'change_stages',
  'override_anything',
  'modify_sla_versions',
  'trigger_deployment',
  'trigger_approval_workflows',
] as const;

export type DeniedAction = typeof HARD_ACTION_DENY_LIST[number];

// --- Bot Entity ---
export interface Bot {
  id: string;
  name: string;
  type: BotType;
  status: BotStatus;
  purpose: string;
  domainsAllowed: string[];
  regionsAllowed: string[];
  rolesAllowed: string[];
  currentVersionId: string;
  providerId: string;
  model: string;
  rateLimit: number;
  costCap: number;
  timeout: number;
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
  errorRate: number;
  costUsage: number;
  totalInvocations: number;
}

// --- Bot Version (immutable snapshot) ---
export interface BotVersion {
  id: string;
  botId: string;
  version: number;
  systemInstruction: string;
  customInstruction: string;
  safetyRules: string;
  temperature: number;
  maxTokens: number;
  allowedActions: ActionBotMode[] | MonitorBotOutput[];
  providerId: string;
  model: string;
  connectorSnapshot: Record<ConnectorType, boolean>;
  permissionSnapshot: {
    domainsAllowed: string[];
    regionsAllowed: string[];
    rolesAllowed: string[];
  };
  knowledgeBaseIds: string[];
  createdAt: string;
  createdBy: string;
  changeNote: string;
}

// --- Bot Invocation Log ---
export interface BotInvocation {
  id: string;
  botId: string;
  botVersionId: string;
  userId: string;
  userRole: string;
  timestamp: string;
  context: string;
  contextType: 'proposal' | 'sla' | 'dashboard' | 'quote' | 'report' | 'workspace';
  inputPayloadHash: string;
  knowledgeSourcesUsed: string[];
  connectorCallsMade: ConnectorType[];
  output: string;
  accepted: boolean | null;
  edited: boolean;
  cost: number;
  latencyMs: number;
  gateChecks: {
    globalKillSwitch: boolean;
    providerEnabled: boolean;
    botEnabled: boolean;
    connectorsEnabled: boolean;
    rbacPassed: boolean;
  };
}

// --- Bot Provider ---
export interface BotProvider {
  id: string;
  name: string;
  enabled: boolean;
  apiEndpoint: string;
  models: string[];
  costPerToken: number;
  maxRatePerMinute: number;
  status: 'healthy' | 'degraded' | 'offline';
  lastHealthCheck: string;
}

// --- Connector ---
export interface Connector {
  id: string;
  type: ConnectorType;
  name: string;
  enabled: boolean;
  accessMode: 'read_only' | 'none';
  endpoint: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSyncAt: string;
}

// --- Signal Rule ---
export interface SignalRule {
  id: string;
  botId: string;
  name: string;
  type: SignalRuleType;
  metric: string;
  threshold: number | null;
  trendDirection: 'up' | 'down' | null;
  timeRangeHours: number;
  severity: SignalSeverity;
  notifyRoles: string[];
  enabled: boolean;
  description: string;
  condition: string;
  timeWindow: string;
  cooldownMinutes: number;
}

// --- Signal Event ---
export interface SignalEvent {
  id: string;
  ruleId: string;
  botId: string;
  timestamp: string;
  severity: SignalSeverity;
  metric: string;
  thresholdTriggered: string;
  timeRangeAnalyzed: string;
  message: string;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  explainability: string;
  suggestedAction: string;
}

// --- Global Bot Settings ---
export interface GlobalBotSettings {
  globalKillSwitch: boolean;
  killSwitchActivatedBy: string | null;
  killSwitchActivatedAt: string | null;
  maxConcurrentBots: number;
  maxDailyCostUsd: number;
  auditRetentionDays: number;
  requireHumanAcceptance: boolean;
}

// --- Knowledge Base Entry ---
export interface KnowledgeBaseEntry {
  id: string;
  name: string;
  type: 'document' | 'data_table' | 'connector';
  scopeRegion: string[];
  scopeRole: string[];
  version: number;
  lastUpdated: string;
}

// ============================================================
// SECTION 8 — RUNTIME INVOCATION FLOW
// ============================================================

export interface InvocationResult {
  success: boolean;
  blocked: boolean;
  blockReason: string | null;
  output: string | null;
  invocationId: string | null;
}

export function executeRuntimeInvocationFlow(
  botId: string,
  userId: string,
  userRole: string,
  context: string,
  contextType: BotInvocation['contextType'],
  inputPayload: string,
): InvocationResult {
  const settings = mockGlobalSettings;
  const bot = mockBots.find(b => b.id === botId);
  const provider = bot ? mockProviders.find(p => p.id === bot.providerId) : null;

  // Step 1: Check Global Kill Switch
  if (settings.globalKillSwitch) {
    logInvocationBlock(botId, userId, userRole, 'Global kill switch is active');
    return { success: false, blocked: true, blockReason: 'Global kill switch is active. All bot invocations are disabled.', output: null, invocationId: null };
  }

  // Step 2: Check Provider Enabled
  if (!provider || !provider.enabled) {
    logInvocationBlock(botId, userId, userRole, 'Provider is disabled');
    return { success: false, blocked: true, blockReason: `Provider "${provider?.name || 'unknown'}" is disabled. No bots using this provider can run.`, output: null, invocationId: null };
  }

  // Step 3: Check Bot Enabled
  if (!bot || bot.status !== 'active') {
    logInvocationBlock(botId, userId, userRole, 'Bot is not active');
    return { success: false, blocked: true, blockReason: `Bot "${bot?.name || 'unknown'}" is ${bot?.status || 'not found'}. Only active bots can be invoked.`, output: null, invocationId: null };
  }

  // Step 4: Check Connector Enabled
  const version = mockBotVersions.find(v => v.id === bot.currentVersionId);
  if (version) {
    const disabledConnectors = Object.entries(version.connectorSnapshot)
      .filter(([type, enabled]) => enabled && !mockConnectors.find(c => c.type === type as ConnectorType)?.enabled)
      .map(([type]) => type);
    if (disabledConnectors.length > 0) {
      logInvocationBlock(botId, userId, userRole, `Required connectors disabled: ${disabledConnectors.join(', ')}`);
      return { success: false, blocked: true, blockReason: `Required connectors are disabled: ${disabledConnectors.join(', ')}`, output: null, invocationId: null };
    }
  }

  // Step 5: Check RBAC
  if (!bot.rolesAllowed.includes(userRole) && !bot.rolesAllowed.includes('*')) {
    logInvocationBlock(botId, userId, userRole, 'RBAC check failed');
    return { success: false, blocked: true, blockReason: `Role "${userRole}" is not authorized to invoke this bot.`, output: null, invocationId: null };
  }

  // Step 6: Load immutable bot_version (already loaded above)
  // Step 7: Enforce allowed actions (checked at action level)
  // Step 8: Execute via provider adapter (mock)
  // Step 9: Log invocation

  const invocationId = `inv-${crypto.randomUUID()}`;
  const invocation: BotInvocation = {
    id: invocationId,
    botId: bot.id,
    botVersionId: bot.currentVersionId,
    userId,
    userRole,
    timestamp: new Date().toISOString(),
    context,
    contextType,
    inputPayloadHash: hashPayload(inputPayload),
    knowledgeSourcesUsed: version?.knowledgeBaseIds || [],
    connectorCallsMade: version ? Object.entries(version.connectorSnapshot).filter(([, v]) => v).map(([k]) => k as ConnectorType) : [],
    output: generateMockOutput(bot.type, bot.name),
    accepted: null,
    edited: false,
    cost: Math.random() * 0.05,
    latencyMs: Math.floor(Math.random() * 2000) + 500,
    gateChecks: {
      globalKillSwitch: false,
      providerEnabled: true,
      botEnabled: true,
      connectorsEnabled: true,
      rbacPassed: true,
    },
  };

  mockInvocations.unshift(invocation);

  // Step 10: Return output (requires human acceptance)
  return {
    success: true,
    blocked: false,
    blockReason: null,
    output: invocation.output,
    invocationId,
  };
}

function logInvocationBlock(botId: string, userId: string, userRole: string, reason: string) {
  const entry: BotInvocation = {
    id: `inv-blocked-${crypto.randomUUID()}`,
    botId,
    botVersionId: '',
    userId,
    userRole,
    timestamp: new Date().toISOString(),
    context: 'blocked',
    contextType: 'workspace',
    inputPayloadHash: '',
    knowledgeSourcesUsed: [],
    connectorCallsMade: [],
    output: `BLOCKED: ${reason}`,
    accepted: false,
    edited: false,
    cost: 0,
    latencyMs: 0,
    gateChecks: {
      globalKillSwitch: reason.includes('kill switch'),
      providerEnabled: !reason.includes('Provider'),
      botEnabled: !reason.includes('not active'),
      connectorsEnabled: !reason.includes('connector'),
      rbacPassed: !reason.includes('RBAC'),
    },
  };
  mockInvocations.unshift(entry);
}

function hashPayload(payload: string): string {
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `sha256:${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

function generateMockOutput(type: BotType, botName: string): string {
  if (type === 'action') {
    return `[${botName}] Draft suggestion generated. This content requires human review and acceptance before it can be applied to the document. No modifications have been made to any commercial data.`;
  }
  return `[${botName}] Signal analysis complete. 3 metrics analyzed across the configured time range. Results are read-only and require human review.`;
}

// ============================================================
// MOCK DATA — Realistic bots, providers, connectors
// ============================================================

export const mockGlobalSettings: GlobalBotSettings = {
  globalKillSwitch: false,
  killSwitchActivatedBy: null,
  killSwitchActivatedAt: null,
  maxConcurrentBots: 5,
  maxDailyCostUsd: 50,
  auditRetentionDays: 365,
  requireHumanAcceptance: true,
};

export const mockProviders: BotProvider[] = [
  {
    id: 'prov-openai',
    name: 'OpenAI',
    enabled: true,
    apiEndpoint: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    costPerToken: 0.00003,
    maxRatePerMinute: 60,
    status: 'healthy',
    lastHealthCheck: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: 'prov-anthropic',
    name: 'Anthropic',
    enabled: true,
    apiEndpoint: 'https://api.anthropic.com/v1',
    models: ['claude-3.5-sonnet', 'claude-3-haiku'],
    costPerToken: 0.000025,
    maxRatePerMinute: 40,
    status: 'healthy',
    lastHealthCheck: new Date(Date.now() - 180000).toISOString(),
  },
  {
    id: 'prov-google',
    name: 'Google AI',
    enabled: false,
    apiEndpoint: 'https://generativelanguage.googleapis.com/v1',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro'],
    costPerToken: 0.00002,
    maxRatePerMinute: 30,
    status: 'offline',
    lastHealthCheck: new Date(Date.now() - 3600000).toISOString(),
  },
];

export const mockConnectors: Connector[] = [
  { id: 'conn-finance', type: 'finance', name: 'Finance System (SAP)', enabled: true, accessMode: 'read_only', endpoint: 'https://sap.hala.com/api', status: 'connected', lastSyncAt: new Date(Date.now() - 300000).toISOString() },
  { id: 'conn-ops', type: 'ops', name: 'Operations (WMS)', enabled: true, accessMode: 'read_only', endpoint: 'https://wms.hala.com/api', status: 'connected', lastSyncAt: new Date(Date.now() - 600000).toISOString() },
  { id: 'conn-tableau', type: 'tableau', name: 'Tableau Analytics', enabled: false, accessMode: 'read_only', endpoint: 'https://tableau.hala.com/api', status: 'disconnected', lastSyncAt: '' },
  { id: 'conn-crm', type: 'crm', name: 'Zoho CRM', enabled: true, accessMode: 'read_only', endpoint: 'https://www.zohoapis.com/crm/v2', status: 'connected', lastSyncAt: new Date(Date.now() - 900000).toISOString() },
  { id: 'conn-custom', type: 'custom', name: 'Custom Data Lake', enabled: false, accessMode: 'none', endpoint: '', status: 'disconnected', lastSyncAt: '' },
];

export const mockKnowledgeBase: KnowledgeBaseEntry[] = [
  { id: 'kb-1', name: 'Hala Rate Cards 2025', type: 'document', scopeRegion: ['East', 'Central', 'West'], scopeRole: ['*'], version: 3, lastUpdated: '2025-01-15' },
  { id: 'kb-2', name: 'SLA Templates Library', type: 'document', scopeRegion: ['*'], scopeRole: ['commercial_director', 'sales_head'], version: 2, lastUpdated: '2025-02-01' },
  { id: 'kb-3', name: 'Customer Master Table', type: 'data_table', scopeRegion: ['*'], scopeRole: ['*'], version: 12, lastUpdated: '2025-03-10' },
  { id: 'kb-4', name: 'P&L Template Structures', type: 'document', scopeRegion: ['*'], scopeRole: ['commercial_director', 'finance'], version: 5, lastUpdated: '2025-02-20' },
  { id: 'kb-5', name: 'Operational Cost Benchmarks', type: 'data_table', scopeRegion: ['East', 'Central'], scopeRole: ['ops_head', 'commercial_director'], version: 8, lastUpdated: '2025-03-01' },
];

export const mockBots: Bot[] = [
  {
    id: 'bot-proposal-drafter',
    name: 'Proposal Drafter',
    type: 'action',
    status: 'active',
    purpose: 'Generates draft proposal sections from meeting transcripts and customer data. Outputs require human review and acceptance.',
    domainsAllowed: ['proposals', 'quotes'],
    regionsAllowed: ['East', 'Central', 'West'],
    rolesAllowed: ['commercial_director', 'sales_head', 'salesman'],
    currentVersionId: 'bv-pd-3',
    providerId: 'prov-openai',
    model: 'gpt-4o',
    rateLimit: 20,
    costCap: 10,
    timeout: 30,
    createdAt: '2025-01-10T08:00:00Z',
    updatedAt: '2025-03-01T14:30:00Z',
    lastRunAt: new Date(Date.now() - 7200000).toISOString(),
    errorRate: 0.02,
    costUsage: 3.45,
    totalInvocations: 156,
  },
  {
    id: 'bot-sla-explainer',
    name: 'SLA Clause Explainer',
    type: 'action',
    status: 'active',
    purpose: 'Explains SLA clauses in plain language for client-facing discussions. Suggest mode only — cannot modify SLA content.',
    domainsAllowed: ['slas'],
    regionsAllowed: ['*'],
    rolesAllowed: ['*'],
    currentVersionId: 'bv-se-2',
    providerId: 'prov-anthropic',
    model: 'claude-3.5-sonnet',
    rateLimit: 30,
    costCap: 5,
    timeout: 15,
    createdAt: '2025-02-01T10:00:00Z',
    updatedAt: '2025-02-28T09:00:00Z',
    lastRunAt: new Date(Date.now() - 86400000).toISOString(),
    errorRate: 0.01,
    costUsage: 1.20,
    totalInvocations: 89,
  },
  {
    id: 'bot-margin-monitor',
    name: 'Margin Monitor',
    type: 'monitor',
    status: 'active',
    purpose: 'Scans deal pipeline for margin erosion, GP% drops below threshold, and cost anomalies. Generates signals for human review.',
    domainsAllowed: ['dashboard', 'quotes', 'workspace'],
    regionsAllowed: ['East', 'Central', 'West'],
    rolesAllowed: ['commercial_director', 'finance'],
    currentVersionId: 'bv-mm-4',
    providerId: 'prov-openai',
    model: 'gpt-4o-mini',
    rateLimit: 10,
    costCap: 8,
    timeout: 60,
    createdAt: '2025-01-20T12:00:00Z',
    updatedAt: '2025-03-05T16:00:00Z',
    lastRunAt: new Date(Date.now() - 3600000).toISOString(),
    errorRate: 0.005,
    costUsage: 5.80,
    totalInvocations: 312,
  },
  {
    id: 'bot-renewal-scanner',
    name: 'Renewal Risk Scanner',
    type: 'monitor',
    status: 'active',
    purpose: 'Monitors contract expiry dates and customer health signals to flag renewal risks 90/60/30 days before expiry.',
    domainsAllowed: ['dashboard', 'customers'],
    regionsAllowed: ['*'],
    rolesAllowed: ['commercial_director', 'sales_head'],
    currentVersionId: 'bv-rs-2',
    providerId: 'prov-anthropic',
    model: 'claude-3-haiku',
    rateLimit: 5,
    costCap: 3,
    timeout: 45,
    createdAt: '2025-02-15T08:00:00Z',
    updatedAt: '2025-03-01T11:00:00Z',
    lastRunAt: new Date(Date.now() - 14400000).toISOString(),
    errorRate: 0.0,
    costUsage: 0.95,
    totalInvocations: 67,
  },
  {
    id: 'bot-quote-helper',
    name: 'Quote Rate Suggester',
    type: 'action',
    status: 'draft',
    purpose: 'Suggests competitive rates based on historical pricing data and market benchmarks. Draft mode — all suggestions require human approval.',
    domainsAllowed: ['quotes'],
    regionsAllowed: ['East'],
    rolesAllowed: ['salesman', 'sales_head'],
    currentVersionId: 'bv-qh-1',
    providerId: 'prov-openai',
    model: 'gpt-4o-mini',
    rateLimit: 15,
    costCap: 5,
    timeout: 20,
    createdAt: '2025-03-10T09:00:00Z',
    updatedAt: '2025-03-10T09:00:00Z',
    lastRunAt: null,
    errorRate: 0,
    costUsage: 0,
    totalInvocations: 0,
  },
  {
    id: 'bot-sla-breach-monitor',
    name: 'SLA Breach Predictor',
    type: 'monitor',
    status: 'disabled',
    purpose: 'Analyzes operational data to predict potential SLA breaches before they occur. Generates escalation signals.',
    domainsAllowed: ['slas', 'dashboard'],
    regionsAllowed: ['East', 'Central'],
    rolesAllowed: ['ops_head', 'commercial_director'],
    currentVersionId: 'bv-sb-1',
    providerId: 'prov-google',
    model: 'gemini-2.0-flash',
    rateLimit: 8,
    costCap: 4,
    timeout: 30,
    createdAt: '2025-03-01T14:00:00Z',
    updatedAt: '2025-03-08T10:00:00Z',
    lastRunAt: null,
    errorRate: 0,
    costUsage: 0,
    totalInvocations: 0,
  },
];

export const mockBotVersions: BotVersion[] = [
  {
    id: 'bv-pd-3',
    botId: 'bot-proposal-drafter',
    version: 3,
    systemInstruction: 'You are a commercial proposal drafting assistant for Hala Supply Chain Services. You MUST NOT approve, override, modify pricing, change GP%, change SLA scope, move stages, trigger approvals, trigger workflows, send webhooks, or deploy anything. You generate draft text ONLY. All output requires human acceptance.',
    customInstruction: 'Focus on warehousing and logistics value propositions. Use Hala brand voice — professional, solution-oriented, client-focused. Reference specific operational capabilities when relevant.',
    safetyRules: 'MANDATORY: Never generate content that commits to pricing, timelines, or SLA terms. Always include "[DRAFT — REQUIRES REVIEW]" watermark. Never impersonate Hala staff. Never reference competitor pricing. Never generate legally binding language.',
    temperature: 0.7,
    maxTokens: 4000,
    allowedActions: ['suggest', 'draft'] as ActionBotMode[],
    providerId: 'prov-openai',
    model: 'gpt-4o',
    connectorSnapshot: { finance: false, ops: false, tableau: false, crm: true, custom: false },
    permissionSnapshot: { domainsAllowed: ['proposals', 'quotes'], regionsAllowed: ['East', 'Central', 'West'], rolesAllowed: ['commercial_director', 'sales_head', 'salesman'] },
    knowledgeBaseIds: ['kb-1', 'kb-2', 'kb-4'],
    createdAt: '2025-03-01T14:30:00Z',
    createdBy: 'Amin Al-Rashid',
    changeNote: 'Updated safety rules to include competitor pricing restriction. Added P&L template to knowledge base.',
  },
  {
    id: 'bv-pd-2',
    botId: 'bot-proposal-drafter',
    version: 2,
    systemInstruction: 'You are a commercial proposal drafting assistant for Hala Supply Chain Services. You MUST NOT approve, override, modify pricing, change GP%, change SLA scope, move stages, trigger approvals, trigger workflows, send webhooks, or deploy anything.',
    customInstruction: 'Focus on warehousing and logistics value propositions. Use Hala brand voice.',
    safetyRules: 'Never generate content that commits to pricing or timelines. Always include draft watermark.',
    temperature: 0.7,
    maxTokens: 3000,
    allowedActions: ['suggest', 'draft'] as ActionBotMode[],
    providerId: 'prov-openai',
    model: 'gpt-4o',
    connectorSnapshot: { finance: false, ops: false, tableau: false, crm: true, custom: false },
    permissionSnapshot: { domainsAllowed: ['proposals', 'quotes'], regionsAllowed: ['East', 'Central', 'West'], rolesAllowed: ['commercial_director', 'sales_head', 'salesman'] },
    knowledgeBaseIds: ['kb-1', 'kb-2'],
    createdAt: '2025-02-15T10:00:00Z',
    createdBy: 'Amin Al-Rashid',
    changeNote: 'Increased max tokens to 3000. Added SLA templates to knowledge base.',
  },
  {
    id: 'bv-se-2',
    botId: 'bot-sla-explainer',
    version: 2,
    systemInstruction: 'You explain SLA clauses in plain, non-legal language. You CANNOT modify SLA content, approve changes, or commit to terms. Explain mode only.',
    customInstruction: 'Explain clauses as if speaking to a client who is not familiar with logistics terminology. Be clear, concise, and helpful.',
    safetyRules: 'Never suggest modifications to SLA terms. Never imply Hala commitment. Always clarify this is an explanation, not legal advice.',
    temperature: 0.5,
    maxTokens: 2000,
    allowedActions: ['explain', 'suggest'] as ActionBotMode[],
    providerId: 'prov-anthropic',
    model: 'claude-3.5-sonnet',
    connectorSnapshot: { finance: false, ops: false, tableau: false, crm: false, custom: false },
    permissionSnapshot: { domainsAllowed: ['slas'], regionsAllowed: ['*'], rolesAllowed: ['*'] },
    knowledgeBaseIds: ['kb-2'],
    createdAt: '2025-02-28T09:00:00Z',
    createdBy: 'Amin Al-Rashid',
    changeNote: 'Lowered temperature for more consistent explanations.',
  },
  {
    id: 'bv-mm-4',
    botId: 'bot-margin-monitor',
    version: 4,
    systemInstruction: 'You are a read-only monitor bot that scans deal pipeline data for margin erosion patterns. You can ONLY create signal_event, report_snapshot, and dashboard_annotation outputs. You CANNOT modify any data.',
    customInstruction: 'Focus on GP% trends below 22% threshold, DSO anomalies above 45 days, and cost-to-serve increases above 5% month-over-month.',
    safetyRules: 'Read-only access only. Cannot modify opportunities, pricing, SLA versions, stages, or trigger any workflows. Output is advisory only.',
    temperature: 0.3,
    maxTokens: 1500,
    allowedActions: ['signal_event', 'report_snapshot', 'dashboard_annotation'] as MonitorBotOutput[],
    providerId: 'prov-openai',
    model: 'gpt-4o-mini',
    connectorSnapshot: { finance: true, ops: false, tableau: false, crm: true, custom: false },
    permissionSnapshot: { domainsAllowed: ['dashboard', 'quotes', 'workspace'], regionsAllowed: ['East', 'Central', 'West'], rolesAllowed: ['commercial_director', 'finance'] },
    knowledgeBaseIds: ['kb-3', 'kb-5'],
    createdAt: '2025-03-05T16:00:00Z',
    createdBy: 'Amin Al-Rashid',
    changeNote: 'Added finance connector for real-time cost data. Adjusted GP% threshold from 25% to 22%.',
  },
  {
    id: 'bv-rs-2',
    botId: 'bot-renewal-scanner',
    version: 2,
    systemInstruction: 'You are a read-only monitor bot that scans contract expiry dates and customer health metrics. You generate renewal risk signals only. You CANNOT modify any data or trigger any actions.',
    customInstruction: 'Flag contracts expiring within 90 days. Cross-reference with DSO, revenue trend, and ECR grade. Prioritize Grade A and B customers.',
    safetyRules: 'Read-only. Cannot modify contracts, customer records, or trigger renewal workflows. Advisory signals only.',
    temperature: 0.2,
    maxTokens: 1000,
    allowedActions: ['signal_event', 'report_snapshot'] as MonitorBotOutput[],
    providerId: 'prov-anthropic',
    model: 'claude-3-haiku',
    connectorSnapshot: { finance: false, ops: false, tableau: false, crm: true, custom: false },
    permissionSnapshot: { domainsAllowed: ['dashboard', 'customers'], regionsAllowed: ['*'], rolesAllowed: ['commercial_director', 'sales_head'] },
    knowledgeBaseIds: ['kb-3'],
    createdAt: '2025-03-01T11:00:00Z',
    createdBy: 'Amin Al-Rashid',
    changeNote: 'Added 30-day warning tier. Improved ECR grade cross-referencing.',
  },
  {
    id: 'bv-qh-1',
    botId: 'bot-quote-helper',
    version: 1,
    systemInstruction: 'You suggest competitive storage and transport rates based on historical data. You CANNOT set or modify pricing. Suggestions only.',
    customInstruction: 'Reference Hala rate cards and regional benchmarks. Consider customer volume tier and contract length.',
    safetyRules: 'Never output a final price. Always frame as suggestion range. Include disclaimer that pricing requires commercial director approval.',
    temperature: 0.6,
    maxTokens: 2000,
    allowedActions: ['suggest', 'draft'] as ActionBotMode[],
    providerId: 'prov-openai',
    model: 'gpt-4o-mini',
    connectorSnapshot: { finance: false, ops: false, tableau: false, crm: false, custom: false },
    permissionSnapshot: { domainsAllowed: ['quotes'], regionsAllowed: ['East'], rolesAllowed: ['salesman', 'sales_head'] },
    knowledgeBaseIds: ['kb-1', 'kb-5'],
    createdAt: '2025-03-10T09:00:00Z',
    createdBy: 'Amin Al-Rashid',
    changeNote: 'Initial version. Draft status — awaiting review before activation.',
  },
  {
    id: 'bv-sb-1',
    botId: 'bot-sla-breach-monitor',
    version: 1,
    systemInstruction: 'You analyze operational metrics to predict potential SLA breaches. Read-only monitor. Cannot modify any data or trigger actions.',
    customInstruction: 'Focus on delivery time KPIs, damage rates, and inventory accuracy metrics.',
    safetyRules: 'Read-only. Cannot modify SLAs, operational data, or trigger any remediation workflows.',
    temperature: 0.3,
    maxTokens: 1500,
    allowedActions: ['signal_event', 'report_snapshot'] as MonitorBotOutput[],
    providerId: 'prov-google',
    model: 'gemini-2.0-flash',
    connectorSnapshot: { finance: false, ops: true, tableau: false, crm: false, custom: false },
    permissionSnapshot: { domainsAllowed: ['slas', 'dashboard'], regionsAllowed: ['East', 'Central'], rolesAllowed: ['ops_head', 'commercial_director'] },
    knowledgeBaseIds: ['kb-5'],
    createdAt: '2025-03-08T10:00:00Z',
    createdBy: 'Amin Al-Rashid',
    changeNote: 'Initial version. Disabled — awaiting ops connector validation.',
  },
];

export const mockSignalRules: SignalRule[] = [
  { id: 'sr-1', botId: 'bot-margin-monitor', name: 'GP% Below 22%', type: 'threshold', metric: 'gross_profit_percent', threshold: 22, trendDirection: null, timeRangeHours: 24, severity: 'needs_review', notifyRoles: ['commercial_director', 'sales_head'], enabled: true, description: 'Triggers when any active deal GP% falls below 22% threshold', condition: '< 22%', timeWindow: '24h', cooldownMinutes: 60 },
  { id: 'sr-2', botId: 'bot-margin-monitor', name: 'GP% Below 10%', type: 'threshold', metric: 'gross_profit_percent', threshold: 10, trendDirection: null, timeRangeHours: 1, severity: 'escalate', notifyRoles: ['commercial_director', 'ceo', 'cfo'], enabled: true, description: 'Immediate escalation when GP% drops below 10% — requires CEO/CFO attention', condition: '< 10%', timeWindow: '1h', cooldownMinutes: 15 },
  { id: 'sr-3', botId: 'bot-margin-monitor', name: 'Cost Spike Detection', type: 'anomaly', metric: 'cost_to_serve', threshold: 15, trendDirection: 'up', timeRangeHours: 168, severity: 'needs_review', notifyRoles: ['commercial_director', 'finance'], enabled: true, description: 'Detects >15% week-over-week cost increase anomalies', condition: '> 15% WoW', timeWindow: '7d', cooldownMinutes: 120 },
  { id: 'sr-4', botId: 'bot-renewal-scanner', name: 'Contract Expiry 90 Days', type: 'threshold', metric: 'days_to_expiry', threshold: 90, trendDirection: null, timeRangeHours: 24, severity: 'fyi', notifyRoles: ['sales_head'], enabled: true, description: 'Early warning for contracts expiring within 90 days', condition: '< 90 days', timeWindow: '24h', cooldownMinutes: 1440 },
  { id: 'sr-5', botId: 'bot-renewal-scanner', name: 'Contract Expiry 30 Days', type: 'threshold', metric: 'days_to_expiry', threshold: 30, trendDirection: null, timeRangeHours: 24, severity: 'escalate', notifyRoles: ['commercial_director', 'sales_head'], enabled: true, description: 'Critical alert for contracts expiring within 30 days', condition: '< 30 days', timeWindow: '24h', cooldownMinutes: 720 },
  { id: 'sr-6', botId: 'bot-renewal-scanner', name: 'Customer Health Decline', type: 'trend', metric: 'ecr_score', threshold: null, trendDirection: 'down', timeRangeHours: 720, severity: 'needs_review', notifyRoles: ['commercial_director'], enabled: true, description: 'Detects declining ECR scores over 30-day window', condition: 'declining trend', timeWindow: '30d', cooldownMinutes: 1440 },
  { id: 'sr-7', botId: 'bot-margin-monitor', name: 'DSO Above 45 Days', type: 'threshold', metric: 'dso_days', threshold: 45, trendDirection: null, timeRangeHours: 24, severity: 'needs_review', notifyRoles: ['finance', 'commercial_director'], enabled: true, description: 'Flags customers with DSO exceeding 45-day threshold', condition: '> 45 days', timeWindow: '24h', cooldownMinutes: 240 },
];

export const mockSignalEvents: SignalEvent[] = [
  { id: 'se-1', ruleId: 'sr-1', botId: 'bot-margin-monitor', timestamp: new Date(Date.now() - 3600000).toISOString(), severity: 'needs_review', metric: 'gross_profit_percent', thresholdTriggered: 'GP% = 19.7% (threshold: 22%)', timeRangeAnalyzed: 'Last 24 hours', message: "Ma'aden Jubail Expansion deal GP% at 19.7% — below 22% threshold. Director approval will be required.", acknowledged: false, acknowledgedBy: null, acknowledgedAt: null, explainability: 'GP% for Ma\'aden Jubail dropped from 24.1% to 19.7% over the past 24 hours, 2.3pp below the 22% warning threshold.', suggestedAction: 'Review revised transport cost estimates and consider renegotiating rates.' },
  { id: 'se-2', ruleId: 'sr-2', botId: 'bot-margin-monitor', timestamp: new Date(Date.now() - 7200000).toISOString(), severity: 'escalate', metric: 'gross_profit_percent', thresholdTriggered: 'GP% = 8.5% (threshold: 10%)', timeRangeAnalyzed: 'Last 1 hour', message: 'Al-Rajhi Emergency Storage deal GP% at 8.5% — below 10% threshold. CEO/CFO approval required.', acknowledged: true, acknowledgedBy: 'Amin Al-Rashid', acknowledgedAt: new Date(Date.now() - 6000000).toISOString(), explainability: 'Al-Rajhi Emergency Storage GP% dropped to 8.5% due to expedited handling surcharges not passed through.', suggestedAction: 'Escalate to CEO/CFO for margin recovery decision.' },
  { id: 'se-3', ruleId: 'sr-4', botId: 'bot-renewal-scanner', timestamp: new Date(Date.now() - 14400000).toISOString(), severity: 'fyi', metric: 'days_to_expiry', thresholdTriggered: '78 days remaining (threshold: 90 days)', timeRangeAnalyzed: 'Daily scan', message: 'Nestlé Riyadh contract expires in 78 days. Renewal discussion recommended.', acknowledged: false, acknowledgedBy: null, acknowledgedAt: null, explainability: 'Nestlé Riyadh warehousing contract has 78 days remaining. Customer ECR grade B+. No renewal conversation logged.', suggestedAction: 'Schedule renewal discussion with Nestlé account manager.' },
  { id: 'se-4', ruleId: 'sr-7', botId: 'bot-margin-monitor', timestamp: new Date(Date.now() - 28800000).toISOString(), severity: 'needs_review', metric: 'dso_days', thresholdTriggered: 'DSO = 68 days (threshold: 45 days)', timeRangeAnalyzed: 'Last 24 hours', message: 'Al-Rajhi Steel DSO at 68 days — significantly above 45-day threshold. Payment collection action recommended.', acknowledged: true, acknowledgedBy: 'Amin Al-Rashid', acknowledgedAt: new Date(Date.now() - 25200000).toISOString(), explainability: 'Al-Rajhi Steel has 3 outstanding invoices totaling SAR 2.1M with average age of 68 days, exceeding 45-day threshold by 51%.', suggestedAction: 'Initiate payment collection escalation. Consider credit hold if DSO exceeds 75 days.' },
  { id: 'se-5', ruleId: 'sr-5', botId: 'bot-renewal-scanner', timestamp: new Date(Date.now() - 43200000).toISOString(), severity: 'escalate', metric: 'days_to_expiry', thresholdTriggered: '22 days remaining (threshold: 30 days)', timeRangeAnalyzed: 'Daily scan', message: 'Almarai Dammam contract expires in 22 days. CRITICAL — no renewal discussion initiated.', acknowledged: false, acknowledgedBy: null, acknowledgedAt: null, explainability: 'Almarai Dammam cold storage contract expires in 22 days. ECR grade A customer. Annual value SAR 4.8M. No renewal activity logged.', suggestedAction: 'URGENT: Schedule immediate renewal meeting with Almarai procurement.' },
];

export const mockInvocations: BotInvocation[] = [
  {
    id: 'inv-001',
    botId: 'bot-proposal-drafter',
    botVersionId: 'bv-pd-3',
    userId: 'user-amin',
    userRole: 'commercial_director',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    context: 'SABIC Jubail Warehousing Proposal — Executive Summary section',
    contextType: 'proposal',
    inputPayloadHash: 'sha256:a3f8b2c1',
    knowledgeSourcesUsed: ['kb-1', 'kb-4'],
    connectorCallsMade: ['crm'],
    output: 'Draft executive summary generated highlighting Hala\'s 15-year warehousing expertise in the Eastern Province, dedicated 50,000 sqm facility capability, and integrated WMS technology stack...',
    accepted: true,
    edited: true,
    cost: 0.024,
    latencyMs: 1850,
    gateChecks: { globalKillSwitch: false, providerEnabled: true, botEnabled: true, connectorsEnabled: true, rbacPassed: true },
  },
  {
    id: 'inv-002',
    botId: 'bot-margin-monitor',
    botVersionId: 'bv-mm-4',
    userId: 'system',
    userRole: 'system',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    context: 'Scheduled pipeline margin scan',
    contextType: 'dashboard',
    inputPayloadHash: 'sha256:b7e4d9f2',
    knowledgeSourcesUsed: ['kb-3', 'kb-5'],
    connectorCallsMade: ['finance', 'crm'],
    output: 'Scan complete. 2 signals generated: Ma\'aden GP% below threshold, Al-Rajhi GP% critical.',
    accepted: null,
    edited: false,
    cost: 0.008,
    latencyMs: 2340,
    gateChecks: { globalKillSwitch: false, providerEnabled: true, botEnabled: true, connectorsEnabled: true, rbacPassed: true },
  },
  {
    id: 'inv-003',
    botId: 'bot-sla-explainer',
    botVersionId: 'bv-se-2',
    userId: 'user-ahmed',
    userRole: 'salesman',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    context: 'Unilever SLA — Force Majeure clause explanation',
    contextType: 'sla',
    inputPayloadHash: 'sha256:c2a1e8d3',
    knowledgeSourcesUsed: ['kb-2'],
    connectorCallsMade: [],
    output: 'The Force Majeure clause means that if something completely unexpected and uncontrollable happens (like a natural disaster, war, or government action), both Hala and the client can temporarily pause their obligations without penalty...',
    accepted: true,
    edited: false,
    cost: 0.012,
    latencyMs: 980,
    gateChecks: { globalKillSwitch: false, providerEnabled: true, botEnabled: true, connectorsEnabled: true, rbacPassed: true },
  },
];

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

export function toggleGlobalKillSwitch(activate: boolean, userId: string): void {
  mockGlobalSettings.globalKillSwitch = activate;
  mockGlobalSettings.killSwitchActivatedBy = activate ? userId : null;
  mockGlobalSettings.killSwitchActivatedAt = activate ? new Date().toISOString() : null;
}

export function toggleBotStatus(botId: string, status: BotStatus): void {
  const bot = mockBots.find(b => b.id === botId);
  if (bot) {
    bot.status = status;
    bot.updatedAt = new Date().toISOString();
  }
}

export function toggleProviderEnabled(providerId: string, enabled: boolean): void {
  const provider = mockProviders.find(p => p.id === providerId);
  if (provider) {
    provider.enabled = enabled;
  }
}

export function toggleConnectorEnabled(connectorId: string, enabled: boolean): void {
  const connector = mockConnectors.find(c => c.id === connectorId);
  if (connector) {
    connector.enabled = enabled;
  }
}

export function acknowledgeSignal(eventId: string, userId: string): void {
  const event = mockSignalEvents.find(e => e.id === eventId);
  if (event) {
    event.acknowledged = true;
    event.acknowledgedBy = userId;
    event.acknowledgedAt = new Date().toISOString();
  }
}

export function getBotsByType(type: BotType): Bot[] {
  return mockBots.filter(b => b.type === type);
}

export function getVersionHistory(botId: string): BotVersion[] {
  return mockBotVersions.filter(v => v.botId === botId).sort((a, b) => b.version - a.version);
}

export function getSignalRulesForBot(botId: string): SignalRule[] {
  return mockSignalRules.filter(r => r.botId === botId);
}

export function getSignalEventsForBot(botId: string): SignalEvent[] {
  return mockSignalEvents.filter(e => e.botId === botId);
}

export function getInvocationsForBot(botId: string): BotInvocation[] {
  return mockInvocations.filter(i => i.botId === botId);
}

export function getActiveSignalCount(): number {
  return mockSignalEvents.filter(e => !e.acknowledged).length;
}

export function getTotalBotCost(): number {
  return mockBots.reduce((sum, b) => sum + b.costUsage, 0);
}
