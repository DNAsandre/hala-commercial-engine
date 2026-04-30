/**
 * LLM Provider Adapter — Sprint 3
 * 
 * Unified interface for calling OpenAI, Anthropic, and Google AI.
 * Handles rate limiting, cost tracking, and timeout enforcement.
 * 
 * API keys are read from environment variables:
 *   OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY
 * 
 * Falls back to stub output if no API key is configured.
 */

export interface LLMRequest {
  provider: string;      // 'prov-openai' | 'prov-anthropic' | 'prov-google'
  model: string;         // 'gpt-4o', 'claude-3.5-sonnet', etc.
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface LLMResponse {
  output: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  latencyMs: number;
  isStub: boolean;
}

// Cost per 1K tokens (input/output) — approximate 2026 pricing
const COST_TABLE: Record<string, { input: number; output: number }> = {
  'gpt-4o':              { input: 0.005,  output: 0.015  },
  'gpt-4o-mini':         { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo':         { input: 0.01,   output: 0.03   },
  'claude-3.5-sonnet':   { input: 0.003,  output: 0.015  },
  'claude-3-haiku':      { input: 0.00025, output: 0.00125 },
  'gemini-2.0-flash':    { input: 0.0001, output: 0.0004 },
  'gemini-1.5-pro':      { input: 0.00125, output: 0.005  },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const costs = COST_TABLE[model] || { input: 0.001, output: 0.003 };
  return (inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output;
}

function getApiKey(provider: string): string | null {
  switch (provider) {
    case 'prov-openai':    return process.env.OPENAI_API_KEY || null;
    case 'prov-anthropic': return process.env.ANTHROPIC_API_KEY || null;
    case 'prov-google':    return process.env.GOOGLE_API_KEY || null;
    default:               return null;
  }
}

/**
 * Call an LLM provider. Returns real output if API key is available,
 * otherwise returns a clearly-labeled stub response.
 */
export async function callLLM(req: LLMRequest): Promise<LLMResponse> {
  const start = Date.now();
  const apiKey = getApiKey(req.provider);
  const timeout = req.timeoutMs || 30000;

  if (!apiKey) {
    return {
      output: `[STUB — No ${req.provider} API key configured] This is a placeholder response. Configure the API key in your .env file to enable real AI responses. The system prompt and user context have been validated and would be sent to ${req.model}.`,
      provider: req.provider,
      model: req.model,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      latencyMs: Date.now() - start,
      isStub: true,
    };
  }

  try {
    if (req.provider === 'prov-openai') {
      return await callOpenAI(apiKey, req, timeout);
    } else if (req.provider === 'prov-anthropic') {
      return await callAnthropic(apiKey, req, timeout);
    } else if (req.provider === 'prov-google') {
      return await callGoogle(apiKey, req, timeout);
    } else {
      throw new Error(`Unknown provider: ${req.provider}`);
    }
  } catch (err: any) {
    return {
      output: `[ERROR] LLM call failed: ${err.message || 'Unknown error'}. The system is operational but the AI provider did not respond. Please try again or check provider health.`,
      provider: req.provider,
      model: req.model,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      latencyMs: Date.now() - start,
      isStub: true,
    };
  }
}

// ── OpenAI ──────────────────────────────────────────────────

async function callOpenAI(apiKey: string, req: LLMRequest, timeoutMs: number): Promise<LLMResponse> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: req.model,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 2000,
    }),
    signal: controller.signal,
  });

  clearTimeout(timer);
  const latencyMs = Date.now() - start;

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
    throw new Error(err.error?.message || `OpenAI HTTP ${response.status}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  const usage = data.usage || {};

  return {
    output: choice?.message?.content || '[No output generated]',
    provider: req.provider,
    model: req.model,
    inputTokens: usage.prompt_tokens || 0,
    outputTokens: usage.completion_tokens || 0,
    cost: estimateCost(req.model, usage.prompt_tokens || 0, usage.completion_tokens || 0),
    latencyMs,
    isStub: false,
  };
}

// ── Anthropic ───────────────────────────────────────────────

async function callAnthropic(apiKey: string, req: LLMRequest, timeoutMs: number): Promise<LLMResponse> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: req.model,
      system: req.systemPrompt,
      messages: [{ role: 'user', content: req.userPrompt }],
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 2000,
    }),
    signal: controller.signal,
  });

  clearTimeout(timer);
  const latencyMs = Date.now() - start;

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
    throw new Error(err.error?.message || `Anthropic HTTP ${response.status}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text || '[No output generated]';
  const usage = data.usage || {};

  return {
    output: content,
    provider: req.provider,
    model: req.model,
    inputTokens: usage.input_tokens || 0,
    outputTokens: usage.output_tokens || 0,
    cost: estimateCost(req.model, usage.input_tokens || 0, usage.output_tokens || 0),
    latencyMs,
    isStub: false,
  };
}

// ── Google AI ───────────────────────────────────────────────

async function callGoogle(apiKey: string, req: LLMRequest, timeoutMs: number): Promise<LLMResponse> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const modelName = req.model.startsWith('models/') ? req.model : `models/${req.model}`;
  const url = `https://generativelanguage.googleapis.com/v1/${modelName}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: req.systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: req.userPrompt }] }],
      generationConfig: {
        temperature: req.temperature ?? 0.7,
        maxOutputTokens: req.maxTokens ?? 2000,
      },
    }),
    signal: controller.signal,
  });

  clearTimeout(timer);
  const latencyMs = Date.now() - start;

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
    throw new Error(err.error?.message || `Google AI HTTP ${response.status}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '[No output generated]';
  const usage = data.usageMetadata || {};

  return {
    output: content,
    provider: req.provider,
    model: req.model,
    inputTokens: usage.promptTokenCount || 0,
    outputTokens: usage.candidatesTokenCount || 0,
    cost: estimateCost(req.model, usage.promptTokenCount || 0, usage.candidatesTokenCount || 0),
    latencyMs,
    isStub: false,
  };
}
