/**
 * Sprint 9 — AI Provider Integration
 *
 * Unified client wrapper for OpenAI and Google AI (Gemini).
 * All API calls route through Supabase Edge Functions — no API keys
 * are ever exposed in the client bundle.
 *
 * Features:
 *  - Provider routing (openai / google)
 *  - Rate limit protection (client-side throttle)
 *  - Usage logging (ai_usage_logs table)
 *  - Audit trail integration
 *  - Disabled-provider guard
 *
 * Design: Swiss Precision Instrument
 * Deep navy accents, IBM Plex Sans typography
 */

import { supabase } from "./supabase";
import { getCurrentUser } from "./auth-state";
import { syncAuditEntry } from "./supabase-sync";
import { nanoid } from "nanoid";

// ============================================================
// TYPES
// ============================================================

export type AIProviderName = "openai" | "google";

export interface AIProvider {
  id: string;
  name: AIProviderName;
  displayName: string;
  modelDefault: string;
  models: string[];
  enabled: boolean;
  config: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface AIUsageLog {
  id: string;
  userId: string;
  userName: string | null;
  provider: string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  latencyMs: number | null;
  workspaceId: string | null;
  action: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

export interface AIGenerateRequest {
  provider: AIProviderName;
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  workspaceId?: string;
  action?: string;
}

export interface AIGenerateResponse {
  content: string;
  tokensInput: number;
  tokensOutput: number;
  model: string;
  provider: AIProviderName;
  latencyMs: number;
}

// ============================================================
// RATE LIMITER (Client-side throttle)
// ============================================================

interface RateLimitState {
  tokens: number;
  lastRefill: number;
}

const RATE_LIMIT_CONFIG = {
  maxTokens: 10,       // max 10 requests in the window
  refillRate: 2,        // 2 requests per second refill
  refillInterval: 1000, // refill every second
};

const rateLimitState: RateLimitState = {
  tokens: RATE_LIMIT_CONFIG.maxTokens,
  lastRefill: Date.now(),
};

function checkRateLimit(): boolean {
  const now = Date.now();
  const elapsed = now - rateLimitState.lastRefill;
  const refills = Math.floor(elapsed / RATE_LIMIT_CONFIG.refillInterval);

  if (refills > 0) {
    rateLimitState.tokens = Math.min(
      RATE_LIMIT_CONFIG.maxTokens,
      rateLimitState.tokens + refills * RATE_LIMIT_CONFIG.refillRate
    );
    rateLimitState.lastRefill = now;
  }

  if (rateLimitState.tokens <= 0) return false;
  rateLimitState.tokens -= 1;
  return true;
}

// ============================================================
// PROVIDER CACHE
// ============================================================

let providerCache: AIProvider[] | null = null;
let providerCacheTime = 0;
const CACHE_TTL = 30_000; // 30 seconds

// ============================================================
// DB HELPERS — camelCase ↔ snake_case
// ============================================================

function mapProviderRow(row: any): AIProvider {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    modelDefault: row.model_default,
    models: row.models || [],
    enabled: row.enabled,
    config: row.config || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapUsageRow(row: any): AIUsageLog {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    provider: row.provider,
    model: row.model,
    tokensInput: row.tokens_input,
    tokensOutput: row.tokens_output,
    latencyMs: row.latency_ms,
    workspaceId: row.workspace_id,
    action: row.action,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

// ============================================================
// FETCH PROVIDERS
// ============================================================

export async function fetchAIProviders(forceRefresh = false): Promise<AIProvider[]> {
  if (!forceRefresh && providerCache && Date.now() - providerCacheTime < CACHE_TTL) {
    return providerCache;
  }

  const { data, error } = await supabase
    .from("ai_providers")
    .select("*")
    .order("name");

  if (error) {
    console.error("[ai-client] fetchAIProviders error:", error.message);
    // Return cached data if available, otherwise return defaults
    if (providerCache) return providerCache;
    return getDefaultProviders();
  }

  providerCache = (data || []).map(mapProviderRow);
  providerCacheTime = Date.now();
  return providerCache;
}

/** Default providers when DB is not yet migrated */
function getDefaultProviders(): AIProvider[] {
  return [
    {
      id: "aip-openai-001",
      name: "openai",
      displayName: "OpenAI",
      modelDefault: "gpt-4o",
      models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
      enabled: true,
      config: { max_tokens: 4096, endpoint: "openai-generate" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "aip-google-001",
      name: "google",
      displayName: "Google AI (Gemini)",
      modelDefault: "gemini-1.5-pro",
      models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"],
      enabled: true,
      config: { max_tokens: 4096, endpoint: "google-generate" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}

// ============================================================
// UPDATE PROVIDER
// ============================================================

export async function updateAIProvider(
  providerId: string,
  updates: Partial<Pick<AIProvider, "enabled" | "modelDefault" | "config">>
): Promise<AIProvider | null> {
  const row: Record<string, any> = { updated_at: new Date().toISOString() };
  if (updates.enabled !== undefined) row.enabled = updates.enabled;
  if (updates.modelDefault !== undefined) row.model_default = updates.modelDefault;
  if (updates.config !== undefined) row.config = updates.config;

  const { data, error } = await supabase
    .from("ai_providers")
    .update(row)
    .eq("id", providerId)
    .select()
    .single();

  if (error) {
    console.error("[ai-client] updateAIProvider error:", error.message);
    return null;
  }

  // Invalidate cache
  providerCache = null;

  // Audit
  const user = getCurrentUser();
  await syncAuditEntry({
    id: nanoid(),
    entityType: "ai_provider",
    entityId: providerId,
    action: "ai_provider_updated",
    userId: user.id,
    userName: user.name,
    details: `Updated AI provider: ${JSON.stringify(updates)}`,
  });

  return data ? mapProviderRow(data) : null;
}

// ============================================================
// FETCH USAGE LOGS
// ============================================================

export async function fetchAIUsageLogs(options?: {
  provider?: string;
  limit?: number;
}): Promise<AIUsageLog[]> {
  let query = supabase
    .from("ai_usage_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(options?.limit || 50);

  if (options?.provider) {
    query = query.eq("provider", options.provider);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[ai-client] fetchAIUsageLogs error:", error.message);
    return [];
  }

  return (data || []).map(mapUsageRow);
}

/** Get aggregate usage stats */
export async function fetchAIUsageStats(): Promise<{
  totalCalls: number;
  totalTokensIn: number;
  totalTokensOut: number;
  byProvider: Record<string, { calls: number; tokensIn: number; tokensOut: number }>;
}> {
  const { data, error } = await supabase
    .from("ai_usage_logs")
    .select("provider, tokens_input, tokens_output");

  if (error || !data) {
    return { totalCalls: 0, totalTokensIn: 0, totalTokensOut: 0, byProvider: {} };
  }

  const byProvider: Record<string, { calls: number; tokensIn: number; tokensOut: number }> = {};
  let totalCalls = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;

  for (const row of data) {
    totalCalls++;
    totalTokensIn += row.tokens_input || 0;
    totalTokensOut += row.tokens_output || 0;

    if (!byProvider[row.provider]) {
      byProvider[row.provider] = { calls: 0, tokensIn: 0, tokensOut: 0 };
    }
    byProvider[row.provider].calls++;
    byProvider[row.provider].tokensIn += row.tokens_input || 0;
    byProvider[row.provider].tokensOut += row.tokens_output || 0;
  }

  return { totalCalls, totalTokensIn, totalTokensOut, byProvider };
}

// ============================================================
// LOG USAGE
// ============================================================

async function logUsage(entry: {
  provider: string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  latencyMs: number;
  workspaceId?: string;
  action?: string;
  status: string;
  errorMessage?: string;
}): Promise<void> {
  const user = getCurrentUser();

  const row = {
    id: nanoid(),
    user_id: user.id,
    user_name: user.name,
    provider: entry.provider,
    model: entry.model,
    tokens_input: entry.tokensInput,
    tokens_output: entry.tokensOutput,
    latency_ms: entry.latencyMs,
    workspace_id: entry.workspaceId || null,
    action: entry.action || null,
    status: entry.status,
    error_message: entry.errorMessage || null,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("ai_usage_logs").insert(row);
  if (error) {
    console.error("[ai-client] logUsage error:", error.message);
  }
}

// ============================================================
// EDGE FUNCTION CALLERS
// ============================================================

/**
 * Calls the Supabase Edge Function for the given provider.
 * The Edge Function holds the API key securely — never exposed to client.
 */
async function callEdgeFunction(
  functionName: string,
  payload: {
    model: string;
    systemPrompt: string;
    userPrompt: string;
    temperature: number;
  }
): Promise<{ content: string; tokens_input: number; tokens_output: number }> {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: payload,
  });

  if (error) {
    throw new Error(`Edge function "${functionName}" failed: ${error.message}`);
  }

  if (!data || typeof data.content !== "string") {
    throw new Error(`Edge function "${functionName}" returned invalid response`);
  }

  return {
    content: data.content,
    tokens_input: data.tokens_input ?? 0,
    tokens_output: data.tokens_output ?? 0,
  };
}

// ============================================================
// MAIN GENERATE FUNCTION
// ============================================================

/**
 * Unified AI generation — routes to the correct provider's Edge Function.
 *
 * Security:
 *  - No API keys in client bundle
 *  - All calls go through Supabase Edge Functions
 *  - Rate limited on client side
 *  - Every call logged to ai_usage_logs
 *  - Audit trail entry created
 */
export async function generateAI(request: AIGenerateRequest): Promise<AIGenerateResponse> {
  // 1. Rate limit check
  if (!checkRateLimit()) {
    throw new Error("Rate limit exceeded. Please wait a moment before trying again.");
  }

  // 2. Fetch provider config
  const providers = await fetchAIProviders();
  const provider = providers.find((p) => p.name === request.provider);

  if (!provider) {
    throw new Error(`Unknown AI provider: ${request.provider}`);
  }

  // 3. Check if provider is enabled
  if (!provider.enabled) {
    throw new Error(`AI provider "${provider.displayName}" is currently disabled. Contact your administrator.`);
  }

  // 4. Resolve model
  const model = request.model || provider.modelDefault;
  const temperature = request.temperature ?? 0.7;

  // 5. Determine edge function name
  const edgeFunctionName = provider.config?.endpoint || `${request.provider}-generate`;

  // 6. Call edge function
  const startTime = Date.now();
  let result: { content: string; tokens_input: number; tokens_output: number };

  try {
    result = await callEdgeFunction(edgeFunctionName, {
      model,
      systemPrompt: request.systemPrompt,
      userPrompt: request.userPrompt,
      temperature,
    });
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;

    // Log failed attempt
    await logUsage({
      provider: request.provider,
      model,
      tokensInput: 0,
      tokensOutput: 0,
      latencyMs,
      workspaceId: request.workspaceId,
      action: request.action,
      status: "error",
      errorMessage: err.message,
    });

    throw err;
  }

  const latencyMs = Date.now() - startTime;

  // 7. Log successful usage
  await logUsage({
    provider: request.provider,
    model,
    tokensInput: result.tokens_input,
    tokensOutput: result.tokens_output,
    latencyMs,
    workspaceId: request.workspaceId,
    action: request.action,
    status: "success",
  });

  // 8. Audit trail
  const user = getCurrentUser();
  await syncAuditEntry({
    id: nanoid(),
    entityType: "ai_usage",
    entityId: request.provider,
    action: "ai_generate",
    userId: user.id,
    userName: user.name,
    details: `AI generation via ${provider.displayName} (${model}): ${result.tokens_input + result.tokens_output} tokens`,
  });

  return {
    content: result.content,
    tokensInput: result.tokens_input,
    tokensOutput: result.tokens_output,
    model,
    provider: request.provider,
    latencyMs,
  };
}

// ============================================================
// TEST CONNECTION
// ============================================================

/**
 * Test connection to a provider by sending a minimal prompt.
 * Returns { success, latencyMs, error? }
 */
export async function testProviderConnection(
  providerName: AIProviderName,
  model?: string
): Promise<{ success: boolean; latencyMs: number; error?: string; content?: string }> {
  const startTime = Date.now();

  try {
    const result = await generateAI({
      provider: providerName,
      model,
      systemPrompt: "You are a helpful assistant. Respond in exactly one sentence.",
      userPrompt: "Say hello and confirm you are working.",
      temperature: 0,
      action: "test_connection",
    });

    return {
      success: true,
      latencyMs: result.latencyMs,
      content: result.content,
    };
  } catch (err: any) {
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      error: err.message,
    };
  }
}
