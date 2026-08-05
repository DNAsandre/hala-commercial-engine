/*
 * Admin Panel — System Configuration, User Management, Integration Settings
 * Navigation Simplification v1: Now also serves as the gateway to
 *   Document System (Templates, Variables, Block Library, Block Builder, Branding)
 *   Automation (Bots, Bot Builder, Bot Audit)
 *   ECR (ECR Dashboard, ECR Config)
 */
import { useState, useCallback, useEffect } from "react";
import { Link } from "wouter";
import { cleanHref } from "@clean/lib/clean-routing";
import {
  Users, Settings, Database, Link2, Bell, Shield, Key, Globe,
  Edit3, Trash2, Check, RefreshCw, Server, HardDrive, Warehouse,
  Mail, Building2, UserPlus, Search, ChevronRight, X,
  Layers, Wrench, Star, Bot, Radio, Activity, BarChart3,
  FileText, Palette, BookOpen, Blocks, Variable, Eye, EyeOff,
  RotateCcw, Lock, UserCheck, UserX, Brain, Zap, DollarSign,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useUsers } from "@/hooks/useSupabase";
import { Loader2 } from "lucide-react";
// CLEAN APP: inlined — see GovernanceConsole.tsx for rationale. Avoids pulling
// the legacy DashboardLayout (and its denylisted route array) into the bundle.
const navigationV1 = true;
import { fetchCollections, type KBCollection } from "@/lib/knowledgebase";
import { fetchConnectionsResult, getSyncHealthStats, type CrmConnectionsResult } from "@/lib/crm-sync-engine";
import { toast } from "sonner";
import {
  adminCreateUser,
  adminUpdateUser,
  adminResetPassword,
  adminDeactivateUser,
  adminReactivateUser,
} from "@/lib/admin-api";
import { useAuth } from "@/contexts/AuthContext";
// SC-01 Wave 02 closure (SX-001/SX-011): ai-client is excluded. Provider
// records are read directly from the established ai_providers table; provider
// enable/model/test controls are AI-infrastructure controls and refuse
// honestly (deferred to Sprint X). Key storage keeps the established
// store_provider_secret vault RPC.
type AIProviderName = "openai" | "google";
interface AIProvider {
  id: string;
  name: AIProviderName;
  displayName: string;
  modelDefault: string;
  models: string[];
  enabled: boolean;
  config?: { api_key_configured?: boolean; api_key_last4?: string } & Record<string, unknown>;
}
const AI_PROVIDER_CONTROL_UNAVAILABLE =
  "Provider controls are not available in this build (deferred to Sprint X - SX-011).";

/**
 * SC-01 Wave 04: the provider read goes through ops-runtime's three-state
 * reader. The previous helper swallowed every failure into `[]`, so a broken
 * read rendered as "there are no AI providers" — which is not the same thing.
 */
function toAdminProvider(row: AiProviderRecord): AIProvider {
  return {
    id: row.id,
    name: (row.name === "google" ? "google" : "openai") as AIProviderName,
    displayName: row.displayName,
    modelDefault: row.modelDefault,
    models: row.models,
    enabled: row.enabled,
    config: row.config as AIProvider["config"],
  };
}
import { supabase } from "@/lib/supabase";
// SC-01 W03-2: the Admin panel's last four old-server HTTP calls (register rows
// 42, 61, 62) are replaced by the clean-owned ops runtime. No api-client import
// remains on this page.
import {
  CLEAN_SERVER_PROBE_NAME,
  SUPABASE_PROBE_NAME,
  readAiProviders,
  readIntegrationStatus,
  readSystemHealth,
  readSystemSettings,
  saveSystemSettings,
  type AiProviderRecord,
  type IntegrationReport,
  type Probe,
  type RecordRead,
  type SystemHealthReport,
} from "@/lib/ops-runtime";
import { getFetchError } from "@/lib/supabase-error";
import { fetchEditorBots } from "@/lib/supabase-data";
import FacilitiesAdmin from "@/pages/FacilitiesAdmin";

function FacilitiesEmbed() {
  return <FacilitiesAdmin />;
}

/* ─── User field guards ────────────────────────────────────────────────────
 * SC-01 Wave 04 (defect C). `users.name`, `.email` and `.role` are nullable
 * columns, and the Users tab called `.toLowerCase()` on all three inside the
 * search filter and `.split(" ")` on the name to build the avatar initials.
 * A single null column threw a TypeError during render and took the WHOLE
 * Users tab down — no list, no error, no recovery. A missing field must
 * degrade to an honest placeholder instead.
 */
export const USER_FIELD_NOT_RECORDED = "not recorded";

export function userField(value: unknown): string {
  return typeof value === "string" && value.trim() !== "" ? value : USER_FIELD_NOT_RECORDED;
}

/** Avatar initials. A name that is absent yields "?" rather than a crash. */
export function userInitials(name: unknown): string {
  if (typeof name !== "string") return "?";
  const initials = name
    .split(" ")
    .map(part => part.trim()[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2);
  return initials || "?";
}

/** Search across the three text columns, skipping any that are not recorded. */
export function matchesUserSearch(user: { name?: unknown; email?: unknown; role?: unknown }, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") return true;
  return [user.name, user.email, user.role].some(
    value => typeof value === "string" && value.toLowerCase().includes(q),
  );
}

/* ─── CRM Sync Embed ───────────────────────────────────────────────────────
 * SC-01 Wave 04, Wave 03 observation 1.
 *
 * `crm_connections` does not exist in this project (PGRST205, confirmed live).
 * The previous implementation called fetchConnections(), which collapses that
 * failure to `[]`, so the panel rendered a failed read as a truthful
 * "0 Connections" beside three zeroed health counters — a fabricated healthy
 * picture of a subsystem that has no storage at all.
 *
 * It now uses fetchConnectionsResult() and renders the connection read and the
 * health counters as one honest unit: while the connection read is not `ok`,
 * getSyncHealthStats() is not presented as health, because its snapshot is
 * only ever filled by a successful crm_sync_events_v2 read that likewise
 * cannot happen here.
 *
 * Provisioning the table, seeding connections and designing synchronization
 * are explicitly OUT of scope for this wave. Reporting the truth is not.
 */
function CRMSyncEmbed() {
  const [read, setRead] = useState<CrmConnectionsResult | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setRead(null);
    fetchConnectionsResult().then((r) => { if (!cancelled) setRead(r); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  // 1. LOADING — nothing is known yet.
  if (read === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-xs">Reading CRM connection records…</span>
      </div>
    );
  }

  // 2. UNAVAILABLE / ERROR — no counter is shown, because no count is known.
  if (read.status !== "ok") {
    const unavailable = read.status === "unavailable";
    return (
      <Card className={`border shadow-none ${unavailable ? "border-amber-200 bg-amber-50/40" : "border-red-200 bg-red-50/40"}`}>
        <CardContent className="p-6 space-y-2">
          <p className={`text-sm font-semibold ${unavailable ? "text-amber-800" : "text-red-700"}`}>
            {unavailable
              ? "CRM connection storage is not provisioned in this build"
              : "CRM connections could not be read"}
          </p>
          <p className="text-xs text-muted-foreground max-w-2xl">
            {unavailable
              ? "The crm_connections table does not exist in this project, so the number of CRM connections is unknown — it is not zero. Sync health counters are not shown, because there is no connection or sync-event data to compute them from."
              : "The connection read failed, so the number of CRM connections is unknown — it is not zero. Sync health counters are not shown, because they would be computed from data that was never read."}
          </p>
          <p className="text-[11px] font-mono text-muted-foreground break-all">{read.message}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setReloadKey(k => k + 1)}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // 3. OK — real records (possibly a genuine zero).
  const crmConns = read.connections;
  const stats = getSyncHealthStats();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-[#1B2A4A]">{crmConns.length}</div><div className="text-xs text-muted-foreground">Connections</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-emerald-600">{stats.success}</div><div className="text-xs text-muted-foreground">Synced</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-red-600">{stats.failed}</div><div className="text-xs text-muted-foreground">Failed</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-amber-600">{stats.retrying}</div><div className="text-xs text-muted-foreground">Retrying</div></CardContent></Card>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Sync counters are computed from the sync events read in this session. Zero means no matching
        event was read — it is not a claim that a synchronization ran and succeeded.
      </p>
      {crmConns.length === 0 && (
        <Card className="border border-border shadow-none">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">The read succeeded and no CRM connection records are visible to this account.</p>
            <p className="text-xs text-muted-foreground mt-1">Records hidden by row-level security would not appear here.</p>
          </CardContent>
        </Card>
      )}
      <div className="space-y-2">
        {crmConns.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{c.provider === "zoho" ? "\ud83d\udfe0" : "\ud83d\udfe2"}</span>
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.base_url}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={c.health_status === "connected" ? "default" : c.health_status === "configuring" ? "outline" : "destructive"} className="text-xs">
                  {c.health_status}
                </Badge>
                <Badge variant={c.enabled ? "default" : "secondary"} className="text-xs">{c.enabled ? "Active" : "Disabled"}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ─── Knowledgebase read state ─────────────────────────────────────────────
 * SC-01 Wave 04 (defect D). `fetchCollections` (src/lib/knowledgebase.ts:92-94)
 * THROWS on a failed read — it does not return []. The previous comment here
 * claimed the opposite, and the effect had no `.catch`, so a rejected promise
 * left `kbLoading` true forever: the Knowledgebase tab spun indefinitely and a
 * read failure was indistinguishable from loading.
 *
 * `lib/knowledgebase.ts` is not on this lane's write allowlist, so the throw is
 * handled here at the call site and the three outcomes are kept apart.
 */
export type KnowledgebaseEmbedRead =
  | { status: "loaded"; collections: KBCollection[] }
  | { status: "empty" }
  | { status: "error"; error: string };

export async function loadKnowledgebaseCollections(): Promise<KnowledgebaseEmbedRead> {
  try {
    const collections = await fetchCollections();
    if (collections.length === 0) return { status: "empty" };
    return { status: "loaded", collections };
  } catch (err) {
    return { status: "error", error: err instanceof Error ? err.message : String(err) };
  }
}

function KnowledgebaseEmbed() {
  const [read, setRead] = useState<KnowledgebaseEmbedRead | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setRead(null);
    loadKnowledgebaseCollections().then((r) => { if (!cancelled) setRead(r); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  // 1. LOADING — nothing is known yet.
  if (read === null) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  // 2. FAILED READ — no count is shown, because no count is known.
  if (read.status === "error") {
    return (
      <Card className="border border-red-200 bg-red-50/40 shadow-none">
        <CardContent className="p-6 space-y-2">
          <p className="text-sm font-semibold text-red-700">Knowledgebase collections could not be read</p>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Nothing is listed and no totals are shown. The number of recorded collections is unknown — it is not zero.
          </p>
          <p className="text-[11px] font-mono text-muted-foreground break-all">{read.error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setReloadKey(k => k + 1)}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // 3. REAL EMPTY — the read succeeded and returned nothing.
  if (read.status === "empty") {
    return (
      <Card className="border border-border shadow-none">
        <CardContent className="p-6 text-center space-y-1">
          <p className="text-sm font-medium">No knowledgebase collections are visible to this account</p>
          <p className="text-xs text-muted-foreground max-w-xl mx-auto">
            The read of the knowledgebase collections succeeded and returned zero rows. Collections hidden by
            row-level security would not appear here, so this is not a statement that none exist.
          </p>
        </CardContent>
      </Card>
    );
  }

  const collections = read.collections;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-[#1B2A4A]">{collections.length}</div>
            <div className="text-xs text-muted-foreground">Collections</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{collections.reduce((s, c) => s + (c.doc_count || 0), 0)}</div>
            <div className="text-xs text-muted-foreground">Documents</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-emerald-600">{collections.reduce((s, c) => s + (c.chunk_count || 0), 0)}</div>
            <div className="text-xs text-muted-foreground">Total Chunks</div>
          </CardContent>
        </Card>
      </div>
      <div className="space-y-2">
        {collections.map(col => (
          <Card key={col.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{col.name}</div>
                <div className="text-[10px] text-muted-foreground">{col.doc_count || 0} docs · {col.chunk_count || 0} chunks · {col.visibility}</div>
              </div>
              <Badge variant={col.visibility === "admin-only" ? "destructive" : "secondary"} className="text-[10px]">{col.visibility}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Use the full page to create collections, upload documents, and manage chunks for AI bot context retrieval.</p>
    </div>
  );
}

function AIProvidersEmbed() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [read, setRead] = useState<RecordRead<AiProviderRecord> | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [showKeyInput, setShowKeyInput] = useState<Record<string, boolean>>({});
  const [savingKeyId, setSavingKeyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRead(null);
    readAiProviders().then((r) => {
      if (cancelled) return;
      setRead(r);
      setProviders(r.rows.map(toAdminProvider));
    });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const handleToggle = async (id: string, enabled: boolean) => {
    void id; void enabled;
    toast.error(AI_PROVIDER_CONTROL_UNAVAILABLE);
  };

  const handleModelChange = async (id: string, model: string) => {
    void id; void model;
    toast.error(AI_PROVIDER_CONTROL_UNAVAILABLE);
  };

  const handleTest = async (name: AIProviderName, id: string) => {
    void name; void id;
    toast.error("Provider connection testing is not available in this build (deferred to Sprint X - SX-001/SX-011).");
  };

  const handleSaveApiKey = async (id: string) => {
    const key = apiKeyInputs[id]?.trim();
    if (!key) { toast.error("API key cannot be empty"); return; }
    setSavingKeyId(id);
    try {
      // Store key in Supabase Vault via RPC (encrypted at rest, never in client-readable columns)
      const { data, error } = await supabase.rpc('store_provider_secret', {
        p_provider_id: id,
        p_secret_key: key,
      });
      setSavingKeyId(null);
      if (error) {
        console.error('[AdminPanel] store_provider_secret error:', error.message, error.code, error.hint);
        toast.error(`Failed to save API key: ${error.message}`);
        return;
      }
      const last4 = data?.last4 || key.slice(-4);
      const provider = providers.find(p => p.id === id);
      const updatedConfig = { ...(provider?.config || {}), api_key_configured: true, api_key_last4: last4 };
      setProviders(ps => ps.map(p => p.id === id ? { ...p, config: updatedConfig } : p));
      setApiKeyInputs(prev => ({ ...prev, [id]: "" }));
      setShowKeyInput(prev => ({ ...prev, [id]: false }));
      toast.success("API key encrypted and stored securely");
    } catch (err: any) {
      setSavingKeyId(null);
      console.error('[AdminPanel] store_provider_secret exception:', err);
      toast.error(`Failed to save API key: ${err.message}`);
    }
  };

  const handleClearApiKey = async (id: string) => {
    if (!confirm("Remove the API key for this provider? AI calls will stop working.")) return;
    try {
      const { error } = await supabase.rpc('remove_provider_secret', { p_provider_id: id });
      if (error) {
        console.error('[AdminPanel] remove_provider_secret error:', error.message);
        toast.error(`Failed to remove API key: ${error.message}`);
        return;
      }
      const provider = providers.find(p => p.id === id);
      const updatedConfig = { ...(provider?.config || {}), api_key_configured: false, api_key_last4: '' };
      setProviders(ps => ps.map(p => p.id === id ? { ...p, config: updatedConfig } : p));
      toast.success("API key removed from vault");
    } catch (err: any) {
      toast.error(`Failed to remove API key: ${err.message}`);
    }
  };

  // Three visibly different states: loading / failed read / real empty.
  if (read === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <span className="text-xs">Reading AI provider records…</span>
      </div>
    );
  }

  if (read.status === "error" || read.status === "unavailable") {
    return (
      <Card className="border border-red-200 shadow-none">
        <CardContent className="p-6 space-y-2">
          <p className="text-sm font-semibold text-red-700">AI provider records could not be read</p>
          <p className="text-xs text-muted-foreground">
            The number of configured providers is unknown — it is not zero. No provider state is shown.
          </p>
          <p className="text-[11px] font-mono text-muted-foreground break-all">{read.error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setReloadKey(k => k + 1)}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (read.status === "empty") {
    return (
      <Card className="border border-border shadow-none">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground">The read succeeded and no AI provider records are visible to this account.</p>
          <p className="text-xs text-muted-foreground mt-1">Records hidden by row-level security would not appear here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {providers.map((p) => {
        const colors = p.name === "openai"
          ? { gradient: "from-emerald-500 to-teal-600", icon: "\uD83E\uDD16", border: p.enabled ? "border-emerald-300" : "border-border" }
          : { gradient: "from-blue-500 to-[#075eea]", icon: "\u2726", border: p.enabled ? "border-blue-300" : "border-border" };
        const hasKey = p.config?.api_key_configured === true;
        const keyLast4 = p.config?.api_key_last4 || "";
        return (
          <Card key={p.id} className={`border ${colors.border} transition-all ${!p.enabled ? "opacity-70" : ""}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors.gradient} flex items-center justify-center text-white text-lg`}>
                    {colors.icon}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{p.displayName}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{p.modelDefault}</div>
                  </div>
                </div>
                <Switch checked={p.enabled} onCheckedChange={(v) => handleToggle(p.id, v)} />
              </div>

              {/* API Key Status & Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Key className="w-3 h-3" />
                    {hasKey ? (
                      <span className="text-emerald-700 font-medium">API key configured (•••• {keyLast4})</span>
                    ) : (
                      <span className="text-red-600 font-medium">No API key — AI calls will fail</span>
                    )}
                  </div>
                  {hasKey ? (
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] text-red-500 hover:text-red-700 px-2" onClick={() => handleClearApiKey(p.id)}>
                      Remove
                    </Button>
                  ) : null}
                </div>

                {showKeyInput[p.id] ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="password"
                      placeholder={p.name === "openai" ? "sk-..." : "AIza..."}
                      value={apiKeyInputs[p.id] || ""}
                      onChange={(e) => setApiKeyInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                      className="h-8 text-xs font-mono flex-1"
                    />
                    <Button size="sm" className="h-8 text-xs" disabled={savingKeyId === p.id} onClick={() => handleSaveApiKey(p.id)}>
                      {savingKeyId === p.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Save"}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setShowKeyInput(prev => ({ ...prev, [p.id]: false }))}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="h-7 text-xs w-full gap-1" onClick={() => setShowKeyInput(prev => ({ ...prev, [p.id]: true }))}>
                    <Key className="w-3 h-3" />
                    {hasKey ? "Update API Key" : "Add API Key"}
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Select value={p.modelDefault} onValueChange={(v) => handleModelChange(p.id, v)}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {p.models.map((m) => <SelectItem key={m} value={m}><span className="font-mono text-xs">{m}</span></SelectItem>)}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  disabled={!p.enabled || testingId === p.id}
                  onClick={() => handleTest(p.name, p.id)}
                >
                  {testingId === p.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  Test
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ─── Settings Tab — persisted in the established `system_settings` table ───
 * SC-01 W03-2 (register row 62): replaces GET/PUT /api/system-settings on the
 * old Hala server with a direct, confirmed read/write via ops-runtime. A save
 * is only reported as saved once the database returns the stored row and that
 * row matches the submission. Read failures are surfaced, never papered over
 * with defaults that would let a user overwrite unknown stored state.
 */
const SETTINGS_DEFAULTS = {
  org_name: 'Hala Supply Chain Solutions',
  default_currency: 'SAR',
  default_region: 'East',
  fiscal_year_start: 'jan',
  logo_url: 'https://halascs.com/logo.png',
  pdf_footer: 'Hala Supply Chain Solutions — Confidential',
  primary_color: '#1B2A4A',
  accent_color: '#2563EB',
  feature_ai_authoring: true,
  feature_auto_crm_sync: true,
  feature_email_notifications: false,
  feature_audit_export: true,
  feature_dark_mode: false,
};

type SettingsLoadState =
  | { kind: "loading" }
  | { kind: "loaded"; updatedAt: string | null; filledFromDefaults: string[] }
  | { kind: "empty" }
  | { kind: "error"; error: string };

function SettingsTabContent() {
  const [s, setS] = useState({ ...SETTINGS_DEFAULTS });
  const [saved, setSaved] = useState({ ...SETTINGS_DEFAULTS });
  const [load, setLoad] = useState<SettingsLoadState>({ kind: "loading" });
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoad({ kind: "loading" });
    readSystemSettings().then(result => {
      if (cancelled) return;
      if (result.status === "error") {
        setLoad({ kind: "error", error: result.error });
        return;
      }
      if (result.status === "empty") {
        const base = { ...SETTINGS_DEFAULTS };
        setS(base);
        setSaved(base);
        setLoad({ kind: "empty" });
        return;
      }
      const stored = result.settings as Partial<typeof SETTINGS_DEFAULTS>;
      const merged = { ...SETTINGS_DEFAULTS, ...stored };
      const filledFromDefaults = Object.keys(SETTINGS_DEFAULTS).filter(
        k => !(k in stored),
      );
      setS(merged);
      setSaved(merged);
      setLoad({ kind: "loaded", updatedAt: result.updatedAt, filledFromDefaults });
    });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const isDirty = JSON.stringify(s) !== JSON.stringify(saved);

  const handleSave = async () => {
    setSaving(true);
    const result = await saveSystemSettings({ ...s });
    if (result.status === "saved") {
      const confirmed = { ...SETTINGS_DEFAULTS, ...(result.settings as Partial<typeof SETTINGS_DEFAULTS>) };
      setS(confirmed);
      setSaved(confirmed);
      setLoad({ kind: "loaded", updatedAt: result.updatedAt, filledFromDefaults: [] });
      toast.success("Settings saved", { description: "Confirmed by the stored row returned from the database." });
    } else {
      // Nothing is marked as saved — the previous saved baseline is kept.
      toast.error("Settings were NOT saved", { description: result.error });
    }
    setSaving(false);
  };

  const handleReset = () => {
    setS({ ...saved });
    toast("Settings reverted to last saved state");
  };

  const upd = (key: string, val: any) => setS(prev => ({ ...prev, [key]: val }));

  if (load.kind === "loading") return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  if (load.kind === "error") {
    return (
      <Card className="border border-red-200 shadow-none">
        <CardContent className="p-6 space-y-2">
          <p className="text-sm font-semibold text-red-700">Settings could not be read</p>
          <p className="text-xs text-muted-foreground">
            The stored settings row could not be read, so the current saved values are unknown.
            Editing is disabled to avoid overwriting state that has not been seen.
          </p>
          <p className="text-[11px] font-mono text-muted-foreground break-all">{load.error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setReloadKey(k => k + 1)}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {load.kind === "empty" ? (
        <Card className="border border-amber-200 bg-amber-50/50 shadow-none">
          <CardContent className="p-3">
            <p className="text-xs text-amber-800">
              No saved settings row exists yet. The values below are this build's defaults —
              nothing is stored until you press Save Settings.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-border shadow-none">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">
              Loaded from the stored settings row
              {load.updatedAt ? ` (last updated ${load.updatedAt})` : " (no update timestamp recorded)"}.
              {load.filledFromDefaults.length > 0
                ? ` Not stored, shown from build defaults: ${load.filledFromDefaults.join(", ")}.`
                : ""}
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="border border-border shadow-none">
        <CardHeader className="pb-3"><CardTitle className="text-base font-serif">General Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Organization Name</Label>
              <Input value={s.org_name} onChange={e => upd('org_name', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Default Currency</Label>
              <Select value={s.default_currency} onValueChange={v => upd('default_currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SAR">SAR — Saudi Riyal</SelectItem>
                  <SelectItem value="USD">USD — US Dollar</SelectItem>
                  <SelectItem value="AED">AED — UAE Dirham</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Default Region</Label>
              <Select value={s.default_region} onValueChange={v => upd('default_region', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="East">Eastern Province</SelectItem>
                  <SelectItem value="Central">Central Province</SelectItem>
                  <SelectItem value="West">Western Province</SelectItem>
                  <SelectItem value="Global">Global</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Fiscal Year Start</Label>
              <Select value={s.fiscal_year_start} onValueChange={v => upd('fiscal_year_start', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="jan">January</SelectItem>
                  <SelectItem value="apr">April</SelectItem>
                  <SelectItem value="jul">July</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Separator />
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Feature Flags</h4>
            <div className="flex items-center justify-between">
              <div><span className="text-sm">AI Authoring</span><p className="text-xs text-muted-foreground">Enable AI draft generation in the Commercial Editor</p></div>
              <Switch checked={s.feature_ai_authoring} onCheckedChange={v => upd('feature_ai_authoring', v)} />
            </div>
            <div className="flex items-center justify-between">
              <div><span className="text-sm">Auto CRM Sync</span><p className="text-xs text-muted-foreground">Automatically sync deals from Zoho CRM every 5 minutes</p></div>
              <Switch checked={s.feature_auto_crm_sync} onCheckedChange={v => upd('feature_auto_crm_sync', v)} />
            </div>
            <div className="flex items-center justify-between">
              <div><span className="text-sm">Email Notifications</span><p className="text-xs text-muted-foreground">Send email alerts for approvals and escalations</p></div>
              <Switch checked={s.feature_email_notifications} onCheckedChange={v => upd('feature_email_notifications', v)} />
            </div>
            <div className="flex items-center justify-between">
              <div><span className="text-sm">Audit Trail Export</span><p className="text-xs text-muted-foreground">Allow exporting audit trail as CSV/PDF</p></div>
              <Switch checked={s.feature_audit_export} onCheckedChange={v => upd('feature_audit_export', v)} />
            </div>
            <div className="flex items-center justify-between">
              <div><span className="text-sm">Navigation v1</span><p className="text-xs text-muted-foreground">Simplified sidebar — Workspace-centric navigation (currently {navigationV1 ? "ON" : "OFF"})</p></div>
              <Switch checked={navigationV1} onCheckedChange={() => toast("Feature flag change requires code deployment")} />
            </div>
            <div className="flex items-center justify-between">
              <div><span className="text-sm">Dark Mode</span><p className="text-xs text-muted-foreground">Enable dark theme option for users</p></div>
              <Switch checked={s.feature_dark_mode} onCheckedChange={v => upd('feature_dark_mode', v)} />
            </div>
          </div>
          <Separator />
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Document Branding</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Company Logo URL</Label>
                <Input value={s.logo_url} onChange={e => upd('logo_url', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">PDF Footer Text</Label>
                <Input value={s.pdf_footer} onChange={e => upd('pdf_footer', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Primary Brand Color</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={s.primary_color} onChange={e => upd('primary_color', e.target.value)} className="w-8 h-8 rounded-md border border-border cursor-pointer p-0" />
                  <Input value={s.primary_color} onChange={e => upd('primary_color', e.target.value)} className="font-mono text-xs" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Accent Color</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={s.accent_color} onChange={e => upd('accent_color', e.target.value)} className="w-8 h-8 rounded-md border border-border cursor-pointer p-0" />
                  <Input value={s.accent_color} onChange={e => upd('accent_color', e.target.value)} className="font-mono text-xs" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        {isDirty && <span className="text-xs text-amber-600 mr-2">● Unsaved changes</span>}
        <Button variant="outline" onClick={handleReset} disabled={!isDirty}>Reset</Button>
        <Button onClick={handleSave} disabled={!isDirty || saving}>
          {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
          Save Settings
        </Button>
      </div>
    </>
  );
}

function EditorBotsEmbed() {
  const [total, setTotal] = useState(0);
  const [blockCount, setBlockCount] = useState(0);
  const [docCount, setDocCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchEditorBots().then(bots => {
      if (cancelled) return;
      setTotal(bots.length);
      setBlockCount(bots.filter(b => b.bot_type === 'block').length);
      setDocCount(bots.filter(b => b.bot_type === 'document').length);
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-[#1B2A4A]">{total}</div>
            <div className="text-xs text-muted-foreground">Total Editor Bots</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{blockCount}</div>
            <div className="text-xs text-muted-foreground">Block Bots</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-[#075eea]">{docCount}</div>
            <div className="text-xs text-muted-foreground">Document Bots</div>
          </CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground">Use the full page to create, edit, test, and manage editor bots with system prompts, provider configuration, and document type permissions.</p>
    </>
  );
}

/* ─── System Module metadata (icons only) ─── */
const moduleMetadata: Record<string, { icon: React.ElementType; color: string }> = {
  [SUPABASE_PROBE_NAME]: { icon: Database, color: "text-emerald-600 bg-emerald-50" },
  [CLEAN_SERVER_PROBE_NAME]: { icon: Server, color: "text-blue-600 bg-blue-50" },
  "CRM Sync Engine": { icon: RefreshCw, color: "text-gray-400 bg-gray-50" },
  "Document Export Engine": { icon: HardDrive, color: "text-gray-400 bg-gray-50" },
  "Escalation Engine": { icon: Shield, color: "text-gray-400 bg-gray-50" },
  "Audit Logger": { icon: Database, color: "text-gray-400 bg-gray-50" },
  "AI Authoring": { icon: Brain, color: "text-gray-400 bg-gray-50" },
  "Notification Service": { icon: Bell, color: "text-gray-400 bg-gray-50" },
};

function ProbeCard({ probe }: { probe: Probe }) {
  const meta = moduleMetadata[probe.name] || { icon: Server, color: "text-gray-500 bg-gray-50" };
  const Icon = meta.icon;
  const badgeClass =
    probe.status === "ok" ? "bg-emerald-50 text-emerald-700" :
    probe.status === "failed" ? "bg-red-50 text-red-700" :
    "bg-gray-50 text-gray-500";
  const dotClass =
    probe.status === "ok" ? "bg-emerald-500" :
    probe.status === "failed" ? "bg-red-500" :
    "bg-gray-300";
  const label =
    probe.status === "ok" ? "Probe succeeded" :
    probe.status === "failed" ? "Probe failed" :
    "Not measured";

  return (
    <Card className="border border-border shadow-none">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${meta.color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <Badge variant="outline" className={`text-[10px] ${badgeClass}`}>
            {probe.status === "not_measured" ? "not measured" : probe.status}
          </Badge>
        </div>
        <h3 className="text-sm font-semibold mb-0.5">{probe.name}</h3>
        <p className="text-xs text-muted-foreground break-words">{probe.detail}</p>
        <div className="flex items-center gap-2 mt-3">
          <div className={`w-2 h-2 rounded-full ${dotClass}`} />
          <span className="text-[10px] text-muted-foreground">{label}</span>
        </div>
        {probe.measuredAt && (
          <p className="text-[10px] text-muted-foreground/70 mt-2">
            Measured {probe.measuredAt}
            {probe.latencyMs === null ? "" : ` — ${probe.latencyMs}ms`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* SC-01 W03-2 (register row 61): replaces GET /api/system-health. That endpoint
 * described the OLD server. This build reports on ITSELF only: two probes that
 * genuinely run (Supabase query, clean server /healthz). Every other subsystem
 * the old endpoint listed is shown as explicitly not measured — never assumed
 * running, never given a fabricated status or uptime. */
function SystemModulesTab() {
  const [report, setReport] = useState<SystemHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    readSystemHealth().then(r => {
      if (cancelled) return;
      setReport(r);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [reloadKey]);

  if (loading || !report) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Report generated {report.reportedAt}</p>
        <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setReloadKey(k => k + 1)}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Re-run probes
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {report.probes.map(p => <ProbeCard key={p.name} probe={p} />)}
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase text-muted-foreground">Not measured by this build</h4>
        <div className="grid grid-cols-3 gap-3">
          {report.notMeasured.map(p => <ProbeCard key={p.name} probe={p} />)}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Only the probes above are real measurements of this application. Nothing on this page reports
        on the previous Hala server, and no status is inferred or assumed.
      </p>
    </div>
  );
}

/* ─── Integration metadata (icons only — status comes from real probes) ─── */
const integrationIcons: Record<string, React.ElementType> = {
  "CRM connections": Link2,
  "Zoho Books": Building2,
  "WMS (Blue Yonder)": Database,
  "Email (SMTP)": Mail,
  "Supabase": Globe,
};

/* SC-01 W03-2 (register row 42): replaces GET /api/integration-status, which
 * described the OLD server's integrations. This build reports only what it can
 * genuinely observe: a live Supabase probe and a real read of the established
 * crm_connections table (whose stored health values are labelled as recorded,
 * not live). Integrations that do not exist here are shown as not measured —
 * never "active", never "demo", never a fabricated connection state. */
function IntegrationsTab() {
  const [report, setReport] = useState<IntegrationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    readIntegrationStatus().then(r => {
      if (cancelled) return;
      setReport(r);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [reloadKey]);

  if (loading || !report) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Report generated {report.reportedAt}</p>
        <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setReloadKey(k => k + 1)}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Re-check
        </Button>
      </div>

      {report.integrations.map(int => {
        const Icon = integrationIcons[int.name] || Globe;
        const badgeClass =
          int.status === "ok" ? "bg-emerald-50 text-emerald-700" :
          int.status === "failed" ? "bg-red-50 text-red-700" :
          "bg-gray-50 text-gray-500";
        const badgeLabel =
          int.status === "ok" ? "checked" :
          int.status === "failed" ? "check failed" :
          "not measured";
        return (
          <Card key={int.name} className="border border-border shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold">{int.name}</span>
                    <Badge variant="outline" className={`text-[10px] ${badgeClass}`}>{badgeLabel}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground break-words">{int.detail}</p>
                  <div className="flex items-start gap-1.5 mt-1">
                    <Key className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-[10px] text-muted-foreground font-mono break-all">{int.connectionInfo}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <p className="text-xs text-muted-foreground">
        "checked" means a real request succeeded just now. "not measured" means this build performs no
        check for that integration — it is not a claim that the integration is working or broken.
      </p>
    </div>
  );
}

/* ─── Document System links ─── */
// CLEAN APP: emptied. The sole remaining entry pointed at /documents, which the
// legacy app routes to ProcessFeedDisconnected (App.tsx:112) — a fail-closed
// placeholder the brief's denylist forbids as a clean destination.
const docSystemLinks: AdminLinkItem[] = [];

/* ─── Automation links ─── */
// CLEAN APP: reduced to the three approved System bot surfaces and repointed at
// clean routes. Removed: /signal-engine (ProcessFeedDisconnected),
// /ai-cost-ledger and /crm-sync (not in the approved clean surface, brief §2).
const automationLinks: AdminLinkItem[] = [
  { path: "/system/bots", label: "Bots", desc: "Manage AI bots, permissions, and authority boundaries", icon: Bot, count: "Manage" },
  { path: "/system/bot-builder", label: "Bot Builder", desc: "Visual builder for creating and configuring AI bots", icon: Wrench, count: "Builder" },
  { path: "/system/bot-audit", label: "Bot Audit", desc: "Review all bot actions, decisions, and override attempts", icon: Activity, count: "Audit log" },
];

/* ─── ECR links ─── */
// CLEAN APP: emptied. No /ecr* page is part of the approved clean surface
// (brief §2). Left in the legacy app, untouched.
const ecrLinks: AdminLinkItem[] = [];

type AdminLinkItem = { path: string; label: string; desc: string; icon: React.ElementType; count: string };

function AdminLinkCard({ item }: { item: AdminLinkItem }) {
  const Icon = item.icon;
  return (
    <Link href={cleanHref(item.path)}>
      <Card className="border border-border shadow-none hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{item.count}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <h3 className="text-sm font-semibold mb-0.5 group-hover:text-primary transition-colors">{item.label}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

/* ─── Role configuration ─── */
const roleOptions = [
  { value: "admin", label: "Admin CEO/CFO" },
  { value: "chief_commercial_officer", label: "Chief Commercial Officer" },
  { value: "commercial_director", label: "Commercial Director" },
  { value: "operations_director", label: "Operations Director" },
  { value: "regional_sales_head", label: "Regional Sales Head" },
  { value: "regional_ops_head", label: "Regional Ops Head" },
  { value: "national_bdm", label: "National Business Development Manager" },
  { value: "key_account_manager", label: "Key Account Manager" },
  { value: "salesman", label: "Salesman" },
  { value: "control_tower_manager", label: "Control Tower Manager" },
  { value: "control_tower_supervisor", label: "Control Tower Supervisor" },
  { value: "control_tower_analyst", label: "Control Tower Analyst" },
  { value: "warehouse_manager", label: "Warehouse Manager" },
  { value: "transport_manager", label: "Transport Manager" },
  { value: "compliance_manager", label: "Compliance Manager" },
  { value: "quality_manager", label: "Quality Manager" },
  { value: "hsse_manager", label: "HSSE Manager" },
  { value: "finance", label: "Finance" },
  { value: "legal", label: "Legal" },
  { value: "it_admin", label: "IT / Systems Admin" },
  { value: "tender_manager", label: "Tender Manager" },
  { value: "bid_manager", label: "Bid Manager" },
  { value: "proposal_specialist", label: "Proposal Specialist" },
  { value: "pricing_analyst", label: "Pricing Analyst" },
  { value: "customer_success_manager", label: "Customer Success Manager" },
  { value: "viewer", label: "Read Only / Viewer" },
];

const departmentOptions = [
  "Management", "Commercial", "Sales", "Operations", "Warehousing", "Transport",
  "Control Tower", "Freight Forwarding", "Customs Clearance", "Finance", "Legal",
  "Compliance", "Quality", "HSSE", "IT / Digital", "Tender / Bid Office",
  "Customer Success", "HR / People",
];

const regionOptions = [
  { value: "Central", label: "Central Province" },
  { value: "West", label: "Western Province" },
  { value: "East", label: "Eastern Province" },
  { value: "Nationwide", label: "Nationwide / KSA" },
  { value: "Global", label: "Global" },
];

const officeOptions = [
  "Riyadh", "Jeddah", "Dammam", "Jubail", "Al Khobar",
  "Riyadh Tayba Warehouse", "Jeddah Modon 3A Warehouse",
];

const roleColors: Record<string, string> = {
  admin: "bg-red-100 text-red-800",
  chief_commercial_officer: "bg-[#075eea]/15 text-[#064fc4]",
  commercial_director: "bg-[#075eea]/15 text-[#064fc4]",
  operations_director: "bg-blue-100 text-blue-800",
  regional_sales_head: "bg-emerald-100 text-emerald-800",
  regional_ops_head: "bg-teal-100 text-teal-800",
  national_bdm: "bg-emerald-100 text-emerald-800",
  key_account_manager: "bg-emerald-100 text-emerald-800",
  salesman: "bg-gray-100 text-gray-700",
  control_tower_manager: "bg-sky-100 text-sky-800",
  control_tower_supervisor: "bg-sky-100 text-sky-800",
  control_tower_analyst: "bg-sky-100 text-sky-800",
  warehouse_manager: "bg-orange-100 text-orange-800",
  transport_manager: "bg-orange-100 text-orange-800",
  compliance_manager: "bg-rose-100 text-rose-800",
  quality_manager: "bg-rose-100 text-rose-800",
  hsse_manager: "bg-rose-100 text-rose-800",
  finance: "bg-amber-100 text-amber-800",
  legal: "bg-[#075eea]/15 text-[#064fc4]",
  it_admin: "bg-slate-100 text-slate-700",
  tender_manager: "bg-cyan-100 text-cyan-800",
  bid_manager: "bg-cyan-100 text-cyan-800",
  proposal_specialist: "bg-cyan-100 text-cyan-800",
  pricing_analyst: "bg-amber-100 text-amber-800",
  customer_success_manager: "bg-lime-100 text-lime-800",
  viewer: "bg-gray-100 text-gray-500",
  director: "bg-[#075eea]/15 text-[#064fc4]",
  ceo_cfo: "bg-red-100 text-red-800",
};

/* ─── Edit User Modal ─── */
function EditUserModal({ user, onClose, onSaved }: { user: any; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [department, setDepartment] = useState(user.department || "");
  const [region, setRegion] = useState(user.region || "East");
  const [office, setOffice] = useState(user.office || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setSaving(true);
    const result = await adminUpdateUser({
      userId: user.id,
      authId: user.auth_id,
      name: name.trim(),
      email: email.trim(),
      role,
      department,
      region,
      office,
    });
    setSaving(false);
    if (result.success) {
      toast.success("User updated", { description: `${name} — ${role.replace(/_/g, " ")}` });
      onSaved();
      onClose();
    } else {
      toast.error("Failed to update user", { description: result.error });
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-serif">Edit User</CardTitle>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Full Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {roleOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Department</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {departmentOptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Region</Label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {regionOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Hala Office / Facility</Label>
              <Select value={office} onValueChange={setOffice}>
                <SelectTrigger><SelectValue placeholder="Select office..." /></SelectTrigger>
                <SelectContent>
                  {officeOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Separator />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Reset Password Modal ─── */
function ResetPasswordModal({ user, onClose }: { user: any; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleReset = async () => {
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      toast.error("Password must include uppercase, lowercase, and a number");
      return;
    }
    setSaving(true);
    const result = await adminResetPassword(user.auth_id, password);
    setSaving(false);
    if (result.success) {
      toast.success("Password reset", { description: `New password set for ${user.name}` });
      onClose();
    } else {
      toast.error("Failed to reset password", { description: result.error });
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-serif">Reset Password</CardTitle>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-[var(--color-hala-navy)] text-white flex items-center justify-center text-xs font-bold">
              {userInitials(user.name)}
            </div>
            <div>
              <div className="text-sm font-medium">{userField(user.name)}</div>
              <div className="text-xs text-muted-foreground">{userField(user.email)}</div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">New Password</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
                className="pr-10"
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleReset} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Lock className="w-3.5 h-3.5 mr-1" />}
              Reset Password
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminPanel() {
  const { data: users, loading, error: usersError, refetch } = useUsers();
  const { appUser } = useAuth();
  const [userSearch, setUserSearch] = useState("");
  const [showAddUser, setShowAddUser] = useState(false);
  const [userPage, setUserPage] = useState(1);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<any>(null);

  // Add user form state
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("salesman");
  const [newUserDepartment, setNewUserDepartment] = useState("Sales");
  const [newUserRegion, setNewUserRegion] = useState("East");
  const [newUserOffice, setNewUserOffice] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("Hala2026!");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [addingUser, setAddingUser] = useState(false);

  const isAdmin = appUser?.role === "admin";

  const handleAddUser = useCallback(async () => {
    if (!newUserName.trim() || !newUserEmail.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUserEmail.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (newUserPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (!/[A-Z]/.test(newUserPassword) || !/[a-z]/.test(newUserPassword) || !/[0-9]/.test(newUserPassword)) {
      toast.error("Password must include uppercase, lowercase, and a number");
      return;
    }
    setAddingUser(true);
    const result = await adminCreateUser({
      email: newUserEmail.trim(),
      password: newUserPassword,
      name: newUserName.trim(),
      role: newUserRole,
      department: newUserDepartment,
      region: newUserRegion,
      office: newUserOffice,
    });
    setAddingUser(false);
    if (result.success) {
      toast.success("User created", {
        description: `${newUserName} (${newUserEmail}) — ${newUserRole.replace(/_/g, " ")}`,
      });
      setShowAddUser(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserRole("salesman");
      setNewUserDepartment("Sales");
      setNewUserRegion("East");
      setNewUserOffice("");
      setNewUserPassword("Hala2026!");
      refetch();
    } else {
      toast.error("Failed to create user", { description: result.error });
    }
  }, [newUserName, newUserEmail, newUserPassword, newUserRole, newUserDepartment, newUserRegion, newUserOffice, refetch]);

  const handleDeactivate = useCallback(async (user: any) => {
    if (user.id === appUser?.id) {
      toast.error("You cannot deactivate your own account");
      return;
    }
    if (!confirm(`Are you sure you want to deactivate ${user.name}? They will no longer be able to sign in.`)) return;
    const result = await adminDeactivateUser(user.auth_id, user.id);
    if (result.success) {
      toast.success("User deactivated", { description: `${user.name} can no longer sign in` });
      refetch();
    } else {
      toast.error("Failed to deactivate user", { description: result.error });
    }
  }, [appUser, refetch]);

  const handleReactivate = useCallback(async (user: any) => {
    const result = await adminReactivateUser(user.auth_id, user.id);
    if (result.success) {
      toast.success("User reactivated", { description: `${user.name} can now sign in again` });
      refetch();
    } else {
      toast.error("Failed to reactivate user", { description: result.error });
    }
  }, [refetch]);

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

  /* SC-01 Wave 04 (requirement D): `fetchUsers` routes through safeFetchList,
   * which returns [] on failure and records the real error in the shared
   * fetch-error state. Without consulting it, a failed `users` read was
   * indistinguishable from an account with no team members. */
  const usersFetchError = usersError ?? getFetchError("fetchUsers")?.error.message ?? null;

  const filteredUsers = users.filter((u: any) => matchesUserSearch(u, userSearch));

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground mt-0.5">System configuration, user management, and integrations</p>
        </div>
      </div>

      <Tabs defaultValue={navigationV1 ? "automation" : "users"}>
        <TabsList className="flex flex-wrap h-auto gap-1 overflow-x-auto">
          {navigationV1 && (
            <>
              {/* [ARCHIVED] Document System tab removed — discontinued document-studio ecosystem */}
              <TabsTrigger value="automation"><Bot className="w-3.5 h-3.5 mr-1.5" />Automation</TabsTrigger>
              <TabsTrigger value="ecr"><BarChart3 className="w-3.5 h-3.5 mr-1.5" />ECR</TabsTrigger>
            </>
          )}
          <TabsTrigger value="users"><Users className="w-3.5 h-3.5 mr-1.5" />Users {usersFetchError ? "(unavailable)" : `(${users.length})`}</TabsTrigger>
          <TabsTrigger value="system"><Server className="w-3.5 h-3.5 mr-1.5" />System Modules</TabsTrigger>
          <TabsTrigger value="integrations"><Link2 className="w-3.5 h-3.5 mr-1.5" />Integrations</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="w-3.5 h-3.5 mr-1.5" />Settings</TabsTrigger>
          <TabsTrigger value="ai-providers"><Brain className="w-3.5 h-3.5 mr-1.5" />AI Providers</TabsTrigger>
          {/* CLEAN APP: "Editor Bots" tab removed — it managed editor_bots used by
              the Document Composer and linked to /editor-bot-builder. Denylisted. */}
          <TabsTrigger value="knowledgebase"><Database className="w-3.5 h-3.5 mr-1.5" />Knowledgebase</TabsTrigger>
          <TabsTrigger value="crm-sync"><Link2 className="w-3.5 h-3.5 mr-1.5" />CRM Sync</TabsTrigger>
          <TabsTrigger value="facilities"><Warehouse className="w-3.5 h-3.5 mr-1.5" />Facilities</TabsTrigger>
        </TabsList>

        {/* [ARCHIVED] Document System tab content removed — discontinued document-studio ecosystem */}

        {/* ─── Automation Tab (navigationV1 only) ─── */}
        {navigationV1 && (
          <TabsContent value="automation" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-serif font-semibold">Automation</h2>
                <p className="text-xs text-muted-foreground mt-0.5">AI bots, signal engine, and automated governance</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {automationLinks.map(item => (
                <AdminLinkCard key={item.path} item={item} />
              ))}
            </div>
          </TabsContent>
        )}

        {/* ─── ECR Tab (navigationV1 only) ─── */}
        {navigationV1 && (
          <TabsContent value="ecr" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-serif font-semibold">ECR — Enterprise Customer Rating</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Customer scoring, rule sets, and data connectors</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {ecrLinks.map(item => (
                <AdminLinkCard key={item.path} item={item} />
              ))}
            </div>
          </TabsContent>
        )}

        {/* ─── Users Tab — Full CRUD ─── */}
        <TabsContent value="users" className="space-y-4">
          {/* SC-01 Wave 04: a failed user read is now visibly different from
              an empty team. Without this the table simply said "No users
              match your search." for both. */}
          {usersFetchError && (
            <Card className="border border-red-200 bg-red-50/40 shadow-none">
              <CardContent className="p-4 space-y-1">
                <p className="text-sm font-semibold text-red-700">User records could not be read</p>
                <p className="text-xs text-muted-foreground">
                  The number of team members is unknown — it is not zero. The table below is empty because
                  the read failed, not because no users exist.
                </p>
                <p className="text-[11px] font-mono text-muted-foreground break-all">{usersFetchError}</p>
              </CardContent>
            </Card>
          )}
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={userSearch}
                onChange={e => { setUserSearch(e.target.value); setUserPage(1); }}
                className="pl-9 h-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Refresh
              </Button>
              {isAdmin && (
                <Button size="sm" onClick={() => setShowAddUser(!showAddUser)}>
                  <UserPlus className="w-4 h-4 mr-1.5" /> Add User
                </Button>
              )}
            </div>
          </div>

          {/* ─── Add User Form ─── */}
          {showAddUser && (
            <Card className="border-2 border-primary/20 shadow-none">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3">Create New Team Member</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Full Name *</Label>
                    <Input placeholder="e.g., Ahmed Al-Rashidi" value={newUserName} onChange={e => setNewUserName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Email *</Label>
                    <Input type="email" placeholder="e.g., ahmed@company.com" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Initial Password</Label>
                    <div className="relative">
                      <Input
                        type={showNewPassword ? "text" : "password"}
                        value={newUserPassword}
                        onChange={e => setNewUserPassword(e.target.value)}
                        className="pr-10"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Role</Label>
                    <Select value={newUserRole} onValueChange={setNewUserRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        {roleOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Department</Label>
                    <Select value={newUserDepartment} onValueChange={setNewUserDepartment}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        {departmentOptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Region</Label>
                    <Select value={newUserRegion} onValueChange={setNewUserRegion}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {regionOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Hala Office / Facility</Label>
                    <Select value={newUserOffice} onValueChange={setNewUserOffice}>
                      <SelectTrigger><SelectValue placeholder="Select office..." /></SelectTrigger>
                      <SelectContent>
                        {officeOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => {
                    setShowAddUser(false);
                    setNewUserName("");
                    setNewUserEmail("");
                    setNewUserRole("salesman");
                    setNewUserDepartment("Sales");
                    setNewUserRegion("East");
                    setNewUserOffice("");
                    setNewUserPassword("Hala2026!");
                  }}>Cancel</Button>
                  <Button size="sm" onClick={handleAddUser} disabled={addingUser}>
                    {addingUser ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                    Create User
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Users Table ─── */}
          <Card className="border border-border shadow-none">
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">User</th>
                    <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Role</th>
                    <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Department</th>
                    <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Region</th>
                    <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.slice((userPage - 1) * 10, userPage * 10).map((user: any) => {
                    const isInactive = user.status === "inactive";
                    return (
                      <tr key={user.id} className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${isInactive ? "opacity-50" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isInactive ? "bg-gray-300 text-gray-600" : "bg-[var(--color-hala-navy)] text-white"}`}>
                              {userInitials(user.name)}
                            </div>
                            <div>
                              <div className="text-sm font-medium">{userField(user.name)}</div>
                              <div className="text-xs text-muted-foreground">{userField(user.email)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-[10px] ${roleColors[user.role] || ""}`}>
                            {userField(user.role).replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{user.department || "—"}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{user.region || "All"}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-[10px] ${isInactive ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                            {isInactive ? "Inactive" : "Active"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isAdmin ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Edit user" onClick={() => setEditingUser(user)}>
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Reset password" onClick={() => setResetPasswordUser(user)}>
                                <Lock className="w-3.5 h-3.5" />
                              </Button>
                              {isInactive ? (
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700" title="Reactivate user" onClick={() => handleReactivate(user)}>
                                  <UserCheck className="w-3.5 h-3.5" />
                                </Button>
                              ) : (
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-600" title="Deactivate user" onClick={() => handleDeactivate(user)}>
                                  <UserX className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Admin only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredUsers.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  {usersFetchError
                    ? "No user records are shown because the read failed — see the message above."
                    : userSearch
                      ? "No users match your search."
                      : "The read succeeded and no user records are visible to this account. Records hidden by row-level security would not appear here."}
                </div>
              )}
              {filteredUsers.length > 10 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">Showing {Math.min((userPage - 1) * 10 + 1, filteredUsers.length)}–{Math.min(userPage * 10, filteredUsers.length)} of {filteredUsers.length}</span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-7 text-xs" disabled={userPage === 1} onClick={() => setUserPage(p => p - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" disabled={userPage * 10 >= filteredUsers.length} onClick={() => setUserPage(p => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {!isAdmin && (
            <p className="text-xs text-muted-foreground text-center">
              Only Admin users can create, edit, or deactivate team members.
            </p>
          )}
        </TabsContent>

        {/* ─── System Modules Tab ─── */}
        <TabsContent value="system" className="space-y-4">
          <SystemModulesTab />
        </TabsContent>

        {/* ─── Integrations Tab ─── */}
        <TabsContent value="integrations" className="space-y-3">
          <IntegrationsTab />
        </TabsContent>

        {/* ─── Settings Tab — Persistent ─── */}
        <TabsContent value="settings" className="space-y-4">
          <SettingsTabContent />
        </TabsContent>

        {/* ─── AI Providers Tab ─── */}
        <TabsContent value="ai-providers" className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-semibold">AI Provider Configuration</h2>
              <p className="text-xs text-muted-foreground">Manage AI model providers, or open the full management page</p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" disabled>
              <Brain className="w-3.5 h-3.5" />
              Embedded Only
            </Button>
          </div>
          <AIProvidersEmbed />
        </TabsContent>

        {/* CLEAN APP: Editor Bots tab content removed in full. It managed the
            legacy `editor_bots` table for Document Composer block/document AI and
            linked to /editor-bot-builder. Bot governance in the clean app runs
            through Bot Builder (ai_bots) under System. */}

        <TabsContent value="knowledgebase" className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-semibold">Knowledgebase</h2>
              <p className="text-xs text-muted-foreground">Manage document collections used by AI bots for context retrieval and citations</p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" disabled>
              <Database className="w-3.5 h-3.5" />
              Embedded Only
            </Button>
          </div>
          <KnowledgebaseEmbed />
        </TabsContent>

        <TabsContent value="crm-sync" className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-semibold">CRM Sync Console</h2>
              <p className="text-xs text-muted-foreground">Bi-directional CRM integration — Zoho CRM + DNA Supersystems</p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" disabled>
              <Link2 className="w-3.5 h-3.5" />
              Embedded Only
            </Button>
          </div>
          <CRMSyncEmbed />
        </TabsContent>

        {/* ─── Facilities Tab ─── */}
        <TabsContent value="facilities" className="space-y-4">
          <FacilitiesEmbed />
        </TabsContent>
      </Tabs>

      {/* ─── Modals ─── */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={() => refetch()}
        />
      )}
      {resetPasswordUser && (
        <ResetPasswordModal
          user={resetPasswordUser}
          onClose={() => setResetPasswordUser(null)}
        />
      )}
    </div>
  );
}
