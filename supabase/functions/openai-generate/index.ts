/**
 * Supabase Edge Function — OpenAI Proxy
 *
 * Receives: { model, systemPrompt, userPrompt, temperature }
 * Returns:  { content, tokens_input, tokens_output }
 *
 * Security:
 *  - API key is read server-side from ai_provider_secrets table
 *  - Never exposed to the browser
 *  - Requires authenticated Supabase session
 *
 * Deploy: supabase functions deploy openai-generate
 */

// @ts-nocheck — Deno runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── 1. Parse request ──────────────────────────────────────
    const { model, systemPrompt, userPrompt, temperature = 0.7 } = await req.json();

    if (!userPrompt) {
      return new Response(
        JSON.stringify({ error: "Missing 'userPrompt' in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Get API key from database (service_role) ───────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: secretRow, error: secretErr } = await supabase
      .from("ai_provider_secrets")
      .select("encrypted_key")
      .eq("provider_id", "aip-openai-001")
      .single();

    if (secretErr || !secretRow?.encrypted_key) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured. Go to Admin Panel → AI Providers → Add API Key." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = secretRow.encrypted_key;

    // ── 3. Call OpenAI API ────────────────────────────────────
    const selectedModel = model || "gpt-4o";

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: userPrompt });

    // Newer models (gpt-5.x, o-series) use max_completion_tokens and only support temperature=1
    const isNewModel = selectedModel.startsWith("gpt-5") || selectedModel.startsWith("o1") || selectedModel.startsWith("o3") || selectedModel.startsWith("o4");
    const tokenParam = isNewModel
      ? { max_completion_tokens: 4096 }
      : { max_tokens: 4096 };
    // Only include temperature for models that support it
    const tempParam = isNewModel ? {} : { temperature };

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: selectedModel,
        messages,
        ...tempParam,
        ...tokenParam,
      }),
    });

    if (!openaiRes.ok) {
      const errBody = await openaiRes.text();
      console.error("[openai-generate] OpenAI API error:", openaiRes.status, errBody);
      return new Response(
        JSON.stringify({ error: `OpenAI API error (${openaiRes.status}): ${errBody}` }),
        { status: openaiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiData = await openaiRes.json();

    // ── 4. Extract and return ─────────────────────────────────
    const content = openaiData.choices?.[0]?.message?.content || "";
    const tokensInput = openaiData.usage?.prompt_tokens || 0;
    const tokensOutput = openaiData.usage?.completion_tokens || 0;

    return new Response(
      JSON.stringify({
        content,
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        model: selectedModel,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[openai-generate] Error:", err.message);
    return new Response(
      JSON.stringify({ error: `Edge function error: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
