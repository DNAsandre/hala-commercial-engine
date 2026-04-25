/**
 * Supabase Edge Function — GHL API Proxy
 * 
 * Proxies requests to GoHighLevel / DNA Supersystems API
 * keeping the API key server-side (never exposed to browser).
 * 
 * SECURITY: Endpoint allowlist prevents arbitrary API access.
 * Only scoped endpoints (contacts, opportunities, pipelines) are permitted.
 * 
 * Deploy: supabase functions deploy ghl-proxy
 * Set secret: supabase secrets set GHL_API_KEY=<your-key>
 * Set secret: supabase secrets set GHL_LOCATION_ID=<your-location-id>
 * 
 * Request body:
 * {
 *   "endpoint": "/contacts/",
 *   "method": "GET",
 *   "params": { "query": "SABIC" },
 *   "body": null
 * }
 */

// @ts-nocheck — Deno runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";

// ── SECURITY: Endpoint Allowlist ─────────────────────────────
// Only these URL patterns are permitted through the proxy.
// Each entry: { pattern: RegExp, methods: allowed HTTP methods }
const ALLOWED_ENDPOINTS: { pattern: RegExp; methods: string[] }[] = [
  // Contacts — list, get, create, update
  { pattern: /^\/contacts\/?$/, methods: ["GET", "POST"] },
  { pattern: /^\/contacts\/[a-zA-Z0-9_-]+$/, methods: ["GET", "PUT"] },
  // Opportunities — search, create, update
  { pattern: /^\/opportunities\/search\/?$/, methods: ["GET"] },
  { pattern: /^\/opportunities\/pipelines\/?$/, methods: ["GET"] },
  { pattern: /^\/opportunities\/?$/, methods: ["GET", "POST"] },
  { pattern: /^\/opportunities\/[a-zA-Z0-9_-]+$/, methods: ["GET", "PUT"] },
];

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT"]);

function isEndpointAllowed(endpoint: string, method: string): boolean {
  // Normalize: strip query params, trailing slashes for matching
  const cleanPath = endpoint.split("?")[0].replace(/\/+$/, "") || "/";
  const normalizedPath = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;

  return ALLOWED_ENDPOINTS.some(
    (rule) => rule.pattern.test(normalizedPath) && rule.methods.includes(method)
  );
}

// ── CORS ─────────────────────────────────────────────────────
// In production, replace "*" with your actual domain
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
    const apiKey = Deno.env.get("GHL_API_KEY");
    const defaultLocationId = Deno.env.get("GHL_LOCATION_ID") || "";

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GHL_API_KEY not configured. Run: supabase secrets set GHL_API_KEY=<key>" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { endpoint, method = "GET", params = {}, body = null } = await req.json();

    // ── Validate endpoint ────────────────────────────────────
    if (!endpoint || typeof endpoint !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'endpoint' in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Validate method ──────────────────────────────────────
    const upperMethod = String(method).toUpperCase();
    if (!ALLOWED_METHODS.has(upperMethod)) {
      return new Response(
        JSON.stringify({ error: `HTTP method '${method}' is not allowed. Permitted: GET, POST, PUT` }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Security gate: endpoint allowlist ─────────────────────
    if (!isEndpointAllowed(endpoint, upperMethod)) {
      console.warn(`[ghl-proxy] BLOCKED: ${upperMethod} ${endpoint}`);
      return new Response(
        JSON.stringify({
          error: `Endpoint '${endpoint}' with method '${upperMethod}' is not in the allowed list. ` +
                 `Only contacts and opportunities endpoints are permitted.`,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Path traversal protection ────────────────────────────
    if (endpoint.includes("..") || endpoint.includes("//") || endpoint.includes("\\")) {
      return new Response(
        JSON.stringify({ error: "Invalid endpoint path" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Inject default locationId if not provided
    if (!params.locationId && !params.location_id && defaultLocationId) {
      params.locationId = defaultLocationId;
    }

    // Build URL
    const url = new URL(endpoint, GHL_BASE_URL);
    if (params && upperMethod === "GET") {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    }

    // Make GHL API call
    const ghlRes = await fetch(url.toString(), {
      method: upperMethod,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Version": GHL_API_VERSION,
        "Content-Type": "application/json",
      },
      body: (upperMethod !== "GET" && body) ? JSON.stringify({ ...body, ...(upperMethod === "POST" ? params : {}) }) : undefined,
    });

    const responseData = await ghlRes.json();

    return new Response(
      JSON.stringify(responseData),
      {
        status: ghlRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Proxy error: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
