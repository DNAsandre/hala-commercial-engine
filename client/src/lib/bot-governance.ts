/**
 * BOT GOVERNANCE & MONITOR SYSTEM
 * ================================
 * Design: Swiss Precision Instrument — Deep navy + warm white
 * Doctrine: Human-First. AI assists. Humans decide.
 * Bots have ZERO inherent authority. Everything explicit, configurable, auditable, reversible, versioned.
 *
 * ⚠️ FUTURE WIRE — ENTIRE FILE IS MOCK DATA
 * ════════════════════════════════════════════
 * All data in this file (bots, providers, connectors, invocations, signals, knowledge base)
 * is hardcoded in-memory. NOTHING persists across page reloads.
 *
 * TARGET WIRING:
 *   mockBots[]           → Supabase `ai_bots` table
 *   mockProviders[]      → Supabase `ai_providers` table
 *   mockConnectors[]     → Supabase `ai_connectors` table (CRM, D365, WHM, Docking App)
 *   mockBotVersions[]    → Supabase `ai_bot_versions` table
 *   mockSignalRules[]    → Supabase `ai_signal_rules` table
 *   mockSignalEvents[]   → Supabase `ai_signal_events` table
 *   mockInvocations[]    → Supabase `ai_invocations` table
 *   mockGlobalSettings   → Supabase `ai_global_settings` table
 *   generateMockOutput() → Real AI provider API (OpenAI/Anthropic)
 *
 * DO NOT add more hardcoded data. Wire to Supabase when ready.
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

export const mockProviders: BotProvider[] = [];

export const mockConnectors: Connector[] = [];

export const mockKnowledgeBase: KnowledgeBaseEntry[] = [];

export const mockBots: Bot[] = [];

export const mockBotVersions: BotVersion[] = [];

export const mockSignalRules: SignalRule[] = [];

export const mockSignalEvents: SignalEvent[] = [];

export const mockInvocations: BotInvocation[] = [];

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
