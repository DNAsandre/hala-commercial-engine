/**
 * Provider Health Check — Sprint 3
 * 
 * Pings each LLM provider's API to determine real health status.
 * Updates bot_providers.status and last_health_check in DB.
 * 
 * Strategy: Make a minimal API call (list models or a tiny completion)
 * to each provider. If it responds within timeout → healthy.
 * If slow → degraded. If fails → offline.
 */

import { supabaseAdmin } from './supabase.js';

interface HealthResult {
  providerId: string;
  status: 'healthy' | 'degraded' | 'offline';
  latencyMs: number;
  error?: string;
}

const HEALTH_TIMEOUT_MS = 8000;
const DEGRADED_THRESHOLD_MS = 3000;

/**
 * Check health of a single provider by making a lightweight API call.
 */
async function checkProvider(provider: {
  id: string;
  name: string;
  api_endpoint: string;
}): Promise<HealthResult> {
  const start = Date.now();

  // Determine which API to ping based on provider ID
  try {
    const apiKey = process.env[`${provider.id.replace('prov-', '').toUpperCase()}_API_KEY`]
      || process.env[`${provider.name.toUpperCase().replace(/\s+/g, '_')}_API_KEY`];

    if (!apiKey) {
      return {
        providerId: provider.id,
        status: 'offline',
        latencyMs: Date.now() - start,
        error: 'No API key configured',
      };
    }

    let url: string;
    let headers: Record<string, string>;

    if (provider.id === 'prov-openai') {
      url = 'https://api.openai.com/v1/models';
      headers = { 'Authorization': `Bearer ${apiKey}` };
    } else if (provider.id === 'prov-anthropic') {
      url = 'https://api.anthropic.com/v1/messages';
      headers = {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      };
    } else if (provider.id === 'prov-google') {
      url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
      headers = {};
    } else {
      // Generic health check — just try to reach the endpoint
      url = provider.api_endpoint;
      headers = { 'Authorization': `Bearer ${apiKey}` };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

    const response = await fetch(url, {
      method: provider.id === 'prov-anthropic' ? 'POST' : 'GET',
      headers,
      signal: controller.signal,
      ...(provider.id === 'prov-anthropic' ? {
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      } : {}),
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    // For Anthropic, a 401/403 still means the service is reachable
    if (response.ok || response.status === 401 || response.status === 403) {
      return {
        providerId: provider.id,
        status: latencyMs > DEGRADED_THRESHOLD_MS ? 'degraded' : 'healthy',
        latencyMs,
      };
    }

    // 429 = rate limited but service is alive
    if (response.status === 429) {
      return {
        providerId: provider.id,
        status: 'degraded',
        latencyMs,
        error: 'Rate limited',
      };
    }

    return {
      providerId: provider.id,
      status: 'offline',
      latencyMs,
      error: `HTTP ${response.status}`,
    };
  } catch (err: any) {
    return {
      providerId: provider.id,
      status: 'offline',
      latencyMs: Date.now() - start,
      error: err.name === 'AbortError' ? 'Timeout' : (err.message || 'Unknown error'),
    };
  }
}

/**
 * Check all providers and update their status in the database.
 */
export async function checkAllProviders(): Promise<HealthResult[]> {
  const { data: providers } = await supabaseAdmin
    .from('bot_providers')
    .select('id, name, api_endpoint, enabled')
    .order('id');

  if (!providers?.length) return [];

  const results: HealthResult[] = [];

  for (const provider of providers) {
    if (!provider.enabled) {
      // Disabled providers are always offline
      results.push({
        providerId: provider.id,
        status: 'offline',
        latencyMs: 0,
        error: 'Provider disabled',
      });
      continue;
    }

    const result = await checkProvider(provider);
    results.push(result);

    // Update DB
    await supabaseAdmin
      .from('bot_providers')
      .update({
        status: result.status,
        last_health_check: new Date().toISOString(),
      })
      .eq('id', provider.id);
  }

  return results;
}

/**
 * Check a single provider by ID.
 */
export async function checkSingleProvider(providerId: string): Promise<HealthResult | null> {
  const { data: provider } = await supabaseAdmin
    .from('bot_providers')
    .select('id, name, api_endpoint, enabled')
    .eq('id', providerId)
    .maybeSingle();

  if (!provider) return null;

  if (!provider.enabled) {
    return {
      providerId: provider.id,
      status: 'offline',
      latencyMs: 0,
      error: 'Provider disabled',
    };
  }

  const result = await checkProvider(provider);

  await supabaseAdmin
    .from('bot_providers')
    .update({
      status: result.status,
      last_health_check: new Date().toISOString(),
    })
    .eq('id', provider.id);

  return result;
}
