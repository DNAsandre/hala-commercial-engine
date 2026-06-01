/**
 * Supabase Edge Function — Google AI (Gemini) Proxy
 *
 * Receives: { model, systemPrompt, userPrompt, temperature }
 * Returns:  { content, tokens_input, tokens_output }
 *
 * Security:
 *  - API key is read server-side from ai_provider_secrets table
 *  - Never exposed to the browser
 *
 * Deploy: supabase functions deploy google-generate
 */

// @ts-nocheck — Deno runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { model, systemPrompt, userPrompt, temperature = 0.7 } = await req.json();

    if (!userPrompt) {
      return new Response(
        JSON.stringify({ error: "Missing 'userPrompt' in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get API key from database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: secretRow, error: secretErr } = await supabase
      .from("ai_provider_secrets")
      .select("encrypted_key")
      .eq("provider_id", "aip-google-001")
      .single();

    if (secretErr || !secretRow?.encrypted_key) {
      return new Response(
        JSON.stringify({ error: "Google AI API key not configured. Go to Admin Panel → AI Providers → Add API Key." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = secretRow.encrypted_key;
    const selectedModel = model || "gemini-2.5-pro";

    // Build Gemini request
    const contents = [];
    if (systemPrompt) {
      contents.push({ role: "user", parts: [{ text: `System instruction: ${systemPrompt}` }] });
      contents.push({ role: "model", parts: [{ text: "Understood. I will follow these instructions." }] });
    }
    contents.push({ role: "user", parts: [{ text: userPrompt }] });

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error("[google-generate] Gemini API error:", geminiRes.status, errBody);
      return new Response(
        JSON.stringify({ error: `Gemini API error (${geminiRes.status}): ${errBody}` }),
        { status: geminiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiData = await geminiRes.json();

    const content = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const tokensInput = geminiData.usageMetadata?.promptTokenCount || 0;
    const tokensOutput = geminiData.usageMetadata?.candidatesTokenCount || 0;

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
    console.error("[google-generate] Error:", err.message);
    return new Response(
      JSON.stringify({ error: `Edge function error: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
