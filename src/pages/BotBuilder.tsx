/**
 * BOT BUILDER PAGE
 * Design: Swiss Precision Instrument — Deep navy + warm white
 * 6 Sections: Identity, Instructions, Allowed Actions, Knowledge Base, Connectors, Provider & Model
 * All configuration explicit, versioned, auditable.
 */
import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Link, useLocation, useSearch } from 'wouter';
import { cleanHref } from '@clean/lib/clean-routing';
import {
  Bot, Save, ArrowLeft, Shield, Cpu, Database, FileText, Settings, Zap,
  Lock, Eye, Pencil, AlertTriangle, CheckCircle2, Info, History,
  ChevronRight, Plus, Trash2, BookOpen, Table, Plug, Link2
} from 'lucide-react';
// SC-01 Wave 02 closure (SX-001/SX-004/SX-011): bot-governance (mock) and
// ai-client are excluded. UI value types are declared locally from this
// page own literal values; providers are read directly from ai_providers.
//
// SC-01 Wave 04 corrections on this page:
//  1. The bot read is three-state. Previously a failed read and a bot id that
//     does not exist both logged to the console and left the header saying
//     "Loading recorded configuration…" indefinitely.
//  2. No configuration value is invented. The old loader substituted
//     'gpt-4o' / 20 / 10 / 30 / temperature 0.7 / 2000 tokens for columns that
//     were null, and the header printed "Version 1" for a bot with no version
//     rows at all — all displayed as though they were the bot's stored setup.
//  3. Sections whose values are page constants rather than stored
//     configuration (Allowed Actions) now say so.
//  4. SC-01 Wave 04 (defect D): "No provider record has this id" was stated
//     even when the ai_providers read itself failed. A failed read and a
//     missing record are different facts and now read differently.
//  5. SC-01 Wave 04 (defect E): the recorded `system_instruction` is rendered.
//     It was queried and mapped, then discarded in favour of a page constant,
//     so whatever the database stored never reached the screen. Domains,
//     regions and roles are rendered FROM THE RECORD rather than from fixed
//     page lists, which had silently dropped any recorded value not on the
//     list (`pdf_studio` among them) while the sidebar still counted it.
import {
  readAiProviders,
  readBotConfiguration,
  describeBotProvider,
  type AiProviderRecord,
  type BotConfigurationRead,
  type RecordRead,
} from '@/lib/ops-runtime';

type BotTypeEnum = "action" | "monitor";
type ActionBotMode = "suggest" | "draft" | "explain";
type MonitorBotOutput = "signal_event" | "report_snapshot" | "dashboard_annotation";
type ConnectorType = "finance" | "ops" | "tableau" | "crm" | "custom";

/** Renders a recorded value, or an explicit "not recorded" marker. */
function recorded(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "not recorded";
  return String(value);
}

/**
 * SC-01 Wave 04 (defect E). The page previously held fixed `DOMAINS`,
 * `REGIONS` and `ROLES` arrays and rendered a badge per constant, highlighting
 * the ones the record happened to contain. Any recorded value absent from the
 * constant simply vanished: a bot scoped to `pdf_studio` rendered zero domain
 * badges while the sidebar stated "Domains: 1 recorded". The scope lists are
 * now rendered from the record, so a stored value can never disappear and the
 * count can never describe something the reader cannot see.
 *
 * Exported so the mapping from a stored record to what the page displays can
 * be asserted directly — this package has no DOM test environment.
 */
export interface BotBuilderView {
  /** The instruction stored on the latest version row, or null. */
  systemInstruction: string | null;
  customInstruction: string;
  safetyRules: string;
  temperature: number | null;
  maxTokens: number | null;
  knowledgeBaseIds: string[];
  domains: string[];
  regions: string[];
  roles: string[];
}

export function deriveBotBuilderView(read: BotConfigurationRead): BotBuilderView | null {
  if (read.status !== 'loaded') return null;
  const latest = read.versions[0];
  return {
    systemInstruction: latest?.systemInstruction ?? null,
    customInstruction: latest?.customInstruction ?? '',
    safetyRules: latest?.safetyRules ?? '',
    temperature: latest?.temperature ?? null,
    maxTokens: latest?.maxTokens ?? null,
    knowledgeBaseIds: latest?.knowledgeBaseIds ?? [],
    domains: read.bot.domainsAllowed,
    regions: read.bot.regionsAllowed,
    roles: read.bot.rolesAllowed,
  };
}

/** Recorded scope values, or an honest statement that none are recorded. */
function RecordedScopeBadges({ values, subject }: { values: string[]; subject: string }) {
  if (values.length === 0) {
    return <p className="text-xs text-slate-500 mt-1">No {subject} are recorded on this bot record.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {values.map(v => (
        <Badge key={v} variant="default" className="bg-[#1B2A4A]">{v}</Badge>
      ))}
    </div>
  );
}

export default function BotBuilder() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const editId = params.get('id');

  // Three-state read of the bot's recorded configuration.
  const [botRead, setBotRead] = useState<BotConfigurationRead | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [apiProviders, setApiProviders] = useState<AiProviderRecord[]>([]);
  const [providersRead, setProvidersRead] = useState<RecordRead<AiProviderRecord> | null>(null);
  const [apiConnectors] = useState<any[]>([]);
  const [apiKnowledgeBase] = useState<any[]>([]);
  const [versionHistory, setVersionHistory] = useState<Array<{ id: string; version: number | null; changeNote: string; createdAt: string; createdBy: string }>>([]);

  const existingBot = botRead?.status === 'loaded' ? botRead.bot : null;

  useEffect(() => {
    if (!editId) return;
    let mounted = true;
    setBotRead(null);
    (async () => {
      const result = await readBotConfiguration(editId);
      if (!mounted) return;
      setBotRead(result);
      if (result.status !== 'loaded') return;

      const b = result.bot;
      const view = deriveBotBuilderView(result)!;
      // Recorded values only — a null column stays null and renders as
      // "not recorded" rather than as a plausible-looking default.
      setName(b.name);
      setType(b.type === 'monitor' ? 'monitor' : 'action');
      setPurpose(b.purpose);
      setDomains(view.domains);
      setRegions(view.regions);
      setRoles(view.roles);
      setProviderId(b.providerId ?? '');
      setModel(b.model ?? '');
      setRateLimit(b.rateLimit);
      setCostCap(b.costCap);
      setTimeoutSec(b.timeoutSec);

      // The stored system instruction reaches the screen. It was read and
      // mapped by readBotConfiguration and then thrown away.
      setSystemInstruction(view.systemInstruction);
      setCustomInstruction(view.customInstruction);
      setSafetyRules(view.safetyRules);
      setTemperature(view.temperature);
      setMaxTokens(view.maxTokens);
      setSelectedKB(view.knowledgeBaseIds);

      const latest = result.versions[0];
      if (latest) {
        if (latest.connectorSnapshot) setConnectorState(latest.connectorSnapshot as any);
        if (latest.chainConfig) {
          setChainNextBotId((latest.chainConfig as any).next_bot_id || 'none');
          setChainPromptUser((latest.chainConfig as any).prompt_user !== false);
          setChainLabel((latest.chainConfig as any).chain_label || '');
        }
      }
      setVersionHistory(result.versions.map(v => ({
        id: v.id, version: v.version, changeNote: v.changeNote,
        createdAt: v.createdAt, createdBy: v.createdBy,
      })));
    })();
    return () => { mounted = false; };
  }, [editId, reloadKey]);

  // Load providers (same source as Admin → AI Providers tab)
  useEffect(() => {
    let mounted = true;
    readAiProviders().then(r => {
      if (!mounted) return;
      setProvidersRead(r);
      setApiProviders(r.rows);
    });
    return () => { mounted = false; };
  }, []);

  // Load all bots for chain dropdown
  useEffect(() => {
    let mounted = true;
    supabase.from('ai_bots').select('id, name, display_name, type, status, domains_allowed').order('name').then(({ data }) => {
      if (!mounted || !data) return;
      setAllBots(data);
    });
    return () => { mounted = false; };
  }, []);

  // Section 1: Identity
  const [name, setName] = useState('');
  const [type, setType] = useState<BotTypeEnum>('action');
  const [purpose, setPurpose] = useState('');
  const [domains, setDomains] = useState<string[]>([]);
  // No fabricated default: an empty list means nothing is recorded yet.
  const [regions, setRegions] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);

  // Section 2: Instructions.
  // `ai_bot_versions.system_instruction` is queried and mapped by
  // readBotConfiguration; the page used to display a hard-coded page constant
  // in its place, so the stored instruction never reached the screen.
  const [systemInstruction, setSystemInstruction] = useState<string | null>(null);
  const [customInstruction, setCustomInstruction] = useState('');
  const [safetyRules, setSafetyRules] = useState('');
  // null = the version row records no value for this field.
  const [temperature, setTemperature] = useState<number | null>(null);
  const [maxTokens, setMaxTokens] = useState<number | null>(null);

  // Section 3: Allowed Actions — page constants, NOT stored configuration.
  // `ai_bots` / `ai_bot_versions` record no per-bot action-mode or
  // monitor-output selection, so these boxes describe the doctrine's mode
  // vocabulary and are labelled as such rather than shown as this bot's setup.
  const [actionModes] = useState<ActionBotMode[]>([]);
  const [monitorOutputs] = useState<MonitorBotOutput[]>([]);

  // Section 4: Knowledge Base
  const [selectedKB, setSelectedKB] = useState<string[]>([]);

  // Section 5: Connectors
  const [connectorState, setConnectorState] = useState<Record<ConnectorType, boolean>>(
    { finance: false, ops: false, tableau: false, crm: false, custom: false }
  );

  // Section 6: Provider & Model — no implicit defaults. An empty string means
  // the bot record stores no value for that field.
  const [providerId, setProviderId] = useState('');
  const [model, setModel] = useState('');
  const [rateLimit, setRateLimit] = useState<number | null>(null);
  const [costCap, setCostCap] = useState<number | null>(null);
  const [timeoutSec, setTimeoutSec] = useState<number | null>(null);

  const providerLabel = describeBotProvider(providerId || null, providersRead);
  const selectedProvider = apiProviders.find(p => p.id === providerId);

  const [changeNote] = useState('');

  // Section 7: Bot Chaining
  const [chainNextBotId, setChainNextBotId] = useState('none');
  const [chainPromptUser, setChainPromptUser] = useState(true);
  const [chainLabel, setChainLabel] = useState('');
  const [allBots, setAllBots] = useState<any[]>([]);

  // SC-01 boundary correction (SX-011): bot creation and editing are
  // current-wave excluded write paths. Without an existing bot id there is
  // nothing to view - show an honest unavailable state, never an editable
  // creation form. With an id, the recorded configuration renders inside a
  // disabled <fieldset>, which makes every native input, textarea, select,
  // switch, checkbox, slider and button genuinely inert at the DOM level.
  if (!editId) {
    return (
      <div className="space-y-6">
        <div className="mb-4">
          <Link href={cleanHref("/system/bots")}>
            <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Bots
            </Button>
          </Link>
        </div>
        <Card className="border border-dashed">
          <CardContent className="py-12 text-center space-y-2">
            <Bot className="w-8 h-8 mx-auto text-muted-foreground opacity-40" />
            <h2 className="text-base font-semibold">Bot creation is not available in this build</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Creating and editing bots is deferred to Sprint X (SX-011). Open an
              existing bot from the Bots page to view its recorded configuration
              read-only.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* Loading, "no such bot", and "read failed" are three different screens. */
  const backLink = (
    <div className="mb-4">
      <Link href={cleanHref("/system/bots")}>
        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Bots
        </Button>
      </Link>
    </div>
  );

  if (botRead === null) {
    return (
      <div className="space-y-6">
        {backLink}
        <Card><CardContent className="py-12 text-center text-sm text-slate-500">Reading the recorded bot configuration…</CardContent></Card>
      </div>
    );
  }

  if (botRead.status === 'error') {
    return (
      <div className="space-y-6">
        {backLink}
        <Card className="border-red-200 bg-red-50/40">
          <CardContent className="py-10 text-center space-y-2">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
            <h2 className="text-base font-semibold text-red-700">This bot's configuration could not be read</h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Nothing is shown below. It is unknown whether a bot with id <span className="font-mono">{editId}</span> exists.
            </p>
            <p className="text-[11px] font-mono text-slate-500 break-all">{botRead.error}</p>
            <Button variant="outline" size="sm" onClick={() => setReloadKey(k => k + 1)}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (botRead.status === 'not_found') {
    return (
      <div className="space-y-6">
        {backLink}
        <Card className="border border-dashed">
          <CardContent className="py-12 text-center space-y-2">
            <Bot className="w-8 h-8 mx-auto text-muted-foreground opacity-40" />
            <h2 className="text-base font-semibold">No bot record with this id is visible to this account</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              The read succeeded and returned no row for id <span className="font-mono">{editId}</span>. A record hidden
              by row-level security would also produce this result, so this is not proof the bot does not exist.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const latestVersion = versionHistory[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-4">
        <Link href={cleanHref("/system/admin")}>
          <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Admin
          </Button>
        </Link>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(cleanHref('/system/bots'))}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Registry
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-serif text-slate-900">View: {existingBot?.name}</h1>
            {/* No version number is invented: a bot with no rows in
                ai_bot_versions previously displayed "Version 1". */}
            <p className="text-sm text-slate-500">
              {versionHistory.length === 0
                ? "No version rows recorded for this bot"
                : `Version ${recorded(latestVersion?.version)} of ${versionHistory.length} recorded`}
              {" — read-only view; editing is deferred to Sprint X"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] text-muted-foreground">Read-only in this build</Badge>
          <Button variant="outline" onClick={() => navigate(cleanHref("/system/bots"))}>Back</Button>
        </div>
      </div>

      {versionHistory.length === 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="py-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              This bot has no rows in <span className="font-mono">ai_bot_versions</span>. Instructions, temperature,
              token limit, knowledge sources and connector selection below are therefore shown as not recorded — they
              are not defaults that the bot would use.
            </p>
          </CardContent>
        </Card>
      )}

      <fieldset disabled aria-readonly="true" className="contents">
      <div className="grid grid-cols-3 gap-6">
        {/* Main Form — 2 columns (read-only: disabled fieldset) */}
        <div className="col-span-2 space-y-6">

          {/* Section 1: Identity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Bot className="w-4 h-4" /> 1. Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Bot Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Proposal Drafter" />
                </div>
                <div>
                  <Label>Bot Type</Label>
                  <Select value={type} onValueChange={(v: BotTypeEnum) => setType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="action">Action Bot (Suggest / Draft / Explain)</SelectItem>
                      <SelectItem value="monitor">Monitor Bot (Read-only signals)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Purpose</Label>
                <Textarea value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Describe what this bot does and its boundaries..." rows={3} />
              </div>
              <div>
                {/* Rendered from the bot record, not from a fixed page list.
                    A domain such as `pdf_studio` used to be dropped on the
                    floor while the sidebar counted it. */}
                <Label>Allowed Domains <span className="text-xs text-slate-400 font-normal">(recorded on the bot record)</span></Label>
                <RecordedScopeBadges values={domains} subject="domains" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Regions Allowed <span className="text-xs text-slate-400 font-normal">(recorded)</span></Label>
                  <RecordedScopeBadges values={regions} subject="regions" />
                </div>
                <div>
                  <Label>Roles Allowed to Invoke <span className="text-xs text-slate-400 font-normal">(recorded)</span></Label>
                  <RecordedScopeBadges values={roles} subject="roles" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><FileText className="w-4 h-4" /> 2. Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                {/* SC-01 Wave 04 (defect E): this rendered a page constant
                    labelled "Base template — locked" while the value actually
                    stored in ai_bot_versions.system_instruction was read,
                    mapped and discarded. The stored text is shown. */}
                <Label className="flex items-center gap-2">
                  System Instruction <Lock className="w-3 h-3 text-slate-400" />
                  <span className="text-xs text-slate-400 font-normal">(recorded on the latest version row, read-only)</span>
                </Label>
                {systemInstruction ? (
                  <div className="mt-1 p-3 bg-slate-50 border rounded text-sm text-slate-600 font-mono leading-relaxed whitespace-pre-wrap">
                    {systemInstruction}
                  </div>
                ) : (
                  <div className="mt-1 p-3 bg-slate-50 border border-dashed rounded text-sm text-slate-500">
                    {versionHistory.length === 0
                      ? "No version rows are recorded for this bot, so no system instruction is stored against it."
                      : "The latest version row records no system instruction."}
                    {" "}Nothing is substituted for it: this build holds no default instruction that the bot would use.
                  </div>
                )}
              </div>
              <div>
                <Label>Custom Instruction <span className="text-xs text-slate-400 font-normal">(recorded value, read-only)</span></Label>
                <Textarea value={customInstruction} onChange={e => setCustomInstruction(e.target.value)}
                  placeholder="Not recorded on the latest version row" rows={4} />
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  Safety / Refusal Rules <span className="text-xs text-slate-400 font-normal">(recorded value, read-only)</span>
                </Label>
                <Textarea value={safetyRules} onChange={e => setSafetyRules(e.target.value)}
                  placeholder="Not recorded on the latest version row" rows={4}
                  />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  {/* A null temperature is stated as not recorded rather than
                      shown as 0.7 with the slider at that position. */}
                  <Label>Temperature: {recorded(temperature)}</Label>
                  <Slider value={[temperature ?? 0]} min={0} max={1} step={0.1} className="mt-2" />
                </div>
                <div>
                  <Label>Max Tokens</Label>
                  <Input value={recorded(maxTokens)} readOnly />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Allowed Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Zap className="w-4 h-4" /> 3. Allowed Actions</CardTitle>
              {/* The old description claimed all other actions were "hard
                  blocked at the system level". Nothing is blocked here: this
                  build has no bot execution path to block. */}
              <CardDescription>
                Doctrine reference. These modes are page constants, not per-bot stored configuration — no bot record
                selects any of them, and nothing here is applied or blocked by this build.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {type === 'action' ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 mb-3">The doctrine defines these action-bot modes (selection is not recorded per bot):</p>
                  {(['suggest', 'draft', 'explain'] as ActionBotMode[]).map(mode => (
                    <div key={mode} className="flex items-center gap-3 p-3 border rounded">
                      <Checkbox checked={actionModes.includes(mode)} />
                      <div>
                        <p className="font-medium capitalize">{mode}</p>
                        <p className="text-xs text-slate-400">
                          {mode === 'suggest' ? 'Recommend options for human consideration' :
                           mode === 'draft' ? 'Generate draft text for human review and editing' :
                           'Explain concepts, clauses, or data in plain language'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 mb-3">The doctrine defines these monitor-bot output types (selection is not recorded per bot):</p>
                  {(['signal_event', 'report_snapshot', 'dashboard_annotation'] as MonitorBotOutput[]).map(output => (
                    <div key={output} className="flex items-center gap-3 p-3 border rounded">
                      <Checkbox checked={monitorOutputs.includes(output)} />
                      <div>
                        <p className="font-medium font-mono text-sm">{output}</p>
                        <p className="text-xs text-slate-400">
                          {output === 'signal_event' ? 'Generate threshold/trend/anomaly signals for human review' :
                           output === 'report_snapshot' ? 'Create periodic report snapshots (read-only)' :
                           'Add annotations to dashboard views (advisory only)'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-xs text-red-700 font-medium flex items-center gap-1">
                  <Shield className="w-3 h-3" /> System-level action deny policies are not configured in this build (deferred to Sprint X).
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Knowledge Base */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="w-4 h-4" /> 4. Knowledge Base Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {apiKnowledgeBase.length > 0 ? apiKnowledgeBase.map((kb: any) => (
                  <div key={kb.id} className="flex items-center gap-3 p-3 border rounded hover:bg-slate-50">
                    <Checkbox checked={selectedKB.includes(kb.id)}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedKB(prev => [...prev, kb.id]);
                        else setSelectedKB(prev => prev.filter(id => id !== kb.id));
                      }} />
                    <div className={`w-8 h-8 rounded flex items-center justify-center ${kb.type === 'document' ? 'bg-blue-100' : kb.type === 'data_table' ? 'bg-emerald-100' : 'bg-[#075eea]/15'}`}>
                      {kb.type === 'document' ? <FileText className="w-4 h-4 text-blue-600" /> :
                       kb.type === 'data_table' ? <Table className="w-4 h-4 text-emerald-600" /> :
                       <Plug className="w-4 h-4 text-[#075eea]" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{kb.name}</p>
                      <p className="text-xs text-slate-400">v{kb.version} · Updated {kb.lastUpdated} · Scope: {kb.scopeRegion?.join(', ') || 'All'}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{String(kb.type).replace('_', ' ')}</Badge>
                  </div>
                )) : <p className="text-sm text-slate-500 p-3">No knowledge base entries found — configure knowledge sources in the Admin panel.</p>}
              </div>
            </CardContent>
          </Card>

          {/* Section 5: Connector Access */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Database className="w-4 h-4" /> 5. Connector Access</CardTitle>
              <CardDescription>Each connector must be explicitly enabled. All default OFF. {type === 'monitor' ? 'Monitor bots: read-only mode only.' : ''}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {apiConnectors.length > 0 ? apiConnectors.map((conn: any) => (
                  <div key={conn.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded flex items-center justify-center ${connectorState[conn.type as ConnectorType] ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                        <Database className={`w-4 h-4 ${connectorState[conn.type as ConnectorType] ? 'text-emerald-600' : 'text-slate-400'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{conn.name}</p>
                        <p className="text-xs text-slate-400">{conn.type.toUpperCase()} · {conn.status} · {type === 'monitor' ? 'Read-only' : 'Read-only or None'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!conn.enabled && <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700">Connector disabled globally</Badge>}
                      <Switch
                        checked={connectorState[conn.type as ConnectorType]}
                        onCheckedChange={(v) => setConnectorState(prev => ({ ...prev, [conn.type]: v }))}
                      />
                    </div>
                  </div>
                )) : <p className="text-sm text-slate-500 p-3">No connectors found — run the automation migration sprint to create connector records.</p>}
              </div>
            </CardContent>
          </Card>

          {/* Section 6: Provider & Model */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Cpu className="w-4 h-4" /> 6. Provider & Model Selection</CardTitle>
              <CardDescription>No implicit defaults in production. All must be explicitly selected.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* The recorded provider_id is displayed verbatim. In the live
                  data it is a value such as "prov-openai" while ai_providers
                  ids are "aip-openai-001", so a select bound to the provider
                  list simply rendered blank. The mismatch is now stated. */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Provider (recorded on the bot record)</Label>
                  <Input value={providerId || "not recorded"} readOnly className="font-mono text-xs" />
                  {/* SC-01 Wave 04 (defect D): "No provider record has this
                      id" is a statement about records that were read. When the
                      ai_providers read itself failed, the page said it anyway. */}
                  {providerLabel.state === 'unmatched' && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> The provider records were read and none has this id, so no provider details can be shown for it.
                    </p>
                  )}
                  {providerLabel.state === 'unreadable' && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> The provider records could not be read
                      {providersRead && 'error' in providersRead ? ` (${providersRead.error})` : ''}, so it is unknown
                      whether a provider record has this id. This is not a claim that none does.
                    </p>
                  )}
                  {providerLabel.state === 'unread' && (
                    <p className="text-xs text-slate-500 mt-1">Reading the provider records…</p>
                  )}
                  {selectedProvider && !selectedProvider.enabled && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Matching provider record is marked disabled.
                    </p>
                  )}
                </div>
                <div>
                  <Label>Model (recorded)</Label>
                  <Input value={model || "not recorded"} readOnly className="font-mono text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Rate Limit (per min)</Label>
                  <Input value={recorded(rateLimit)} readOnly />
                </div>
                <div>
                  <Label>Cost Cap (USD)</Label>
                  <Input value={recorded(costCap)} readOnly />
                </div>
                <div>
                  <Label>Timeout (seconds)</Label>
                  <Input value={recorded(timeoutSec)} readOnly />
                </div>
              </div>
              <p className="text-xs text-slate-400">
                These are stored configuration values only. This build never applies them: no rate limit, cost cap or
                timeout is exercised, because no bot is invoked.
              </p>
            </CardContent>
          </Card>

          {/* Section 7: Bot Chaining */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Link2 className="w-4 h-4" /> 7. Bot Chaining Pipeline</CardTitle>
              {/* The old description said the next bot "runs automatically".
                  Nothing runs: this build has no bot execution path, so a
                  recorded chain configuration is inert. */}
              <CardDescription>
                Recorded chain configuration from the latest version row. This build never runs a bot, so no chain is
                executed and no next bot is offered anywhere in the application.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Next Bot in Chain</Label>
                <Select value={chainNextBotId} onValueChange={setChainNextBotId}>
                  <SelectTrigger><SelectValue placeholder="No chain — runs independently" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No chain — runs independently</SelectItem>
                    {allBots
                      .filter(b => b.id !== editId) // can't chain to self
                      .map(b => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.display_name || b.name} ({b.type}) {b.status !== 'active' ? `— ${b.status}` : ''}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-500 mt-1">Recorded value only — no chained run is offered or performed by this build.</p>
              </div>
              {chainNextBotId && chainNextBotId !== 'none' && (
                <>
                  <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">Prompt user before chaining</p>
                      <p className="text-[10px] text-slate-500">Show a dialog asking the user to confirm before running the next bot</p>
                    </div>
                    <Switch checked={chainPromptUser} onCheckedChange={setChainPromptUser} />
                  </div>
                  <div>
                    <Label>Chain Button Label</Label>
                    <Input value={chainLabel} onChange={e => setChainLabel(e.target.value)} placeholder="e.g., Auto-draft all blocks" />
                    <p className="text-[10px] text-slate-500 mt-1">The text shown on the “run next bot” button in the chain dialog.</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Version change note. This was an empty, editable "describe what
              changed" box with no save path — an invitation to write text that
              could never be stored. It now shows the note recorded against the
              latest version row, or says that none is recorded. */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><History className="w-4 h-4" /> Recorded Change Note (latest version)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                {latestVersion?.changeNote || (versionHistory.length === 0
                  ? "No version rows are recorded for this bot."
                  : "The latest version row records no change note.")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar — Version History & Summary */}
        <div className="space-y-4">
          {/* Bot Summary */}
          <Card className="bg-slate-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Bot Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Type</span><Badge variant="outline">{recorded(existingBot?.type)}</Badge></div>
              <div className="flex justify-between"><span className="text-slate-500">Status</span><Badge variant="outline">{recorded(existingBot?.status)}</Badge></div>
              {/* These counts describe exactly the badge lists rendered in
                  section 1, which are themselves the recorded values. */}
              <div className="flex justify-between gap-2"><span className="text-slate-500 shrink-0">Domains</span><span className="text-right">{domains.length > 0 ? domains.join(', ') : 'none recorded'}</span></div>
              <div className="flex justify-between gap-2"><span className="text-slate-500 shrink-0">Regions</span><span className="text-right">{regions.length > 0 ? regions.join(', ') : 'none recorded'}</span></div>
              <div className="flex justify-between gap-2"><span className="text-slate-500 shrink-0">Roles</span><span className="text-right">{roles.length > 0 ? roles.join(', ') : 'none recorded'}</span></div>
              <div className="flex justify-between gap-2"><span className="text-slate-500 shrink-0">Provider</span><span className={`text-right ${providerLabel.state === 'matched' ? '' : 'text-amber-600'}`}>{providerLabel.label}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Model</span><span>{model || 'not recorded'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Knowledge</span><span>{selectedKB.length} recorded</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Connectors enabled in snapshot</span><span>{Object.values(connectorState).filter(Boolean).length}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Temperature</span><span>{recorded(temperature)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Max Tokens</span><span>{recorded(maxTokens)}</span></div>
            </CardContent>
          </Card>

          {/* Runtime Flow */}
          <Card className="border border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4" /> Runtime Invocation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                No bot invocation or enforcement path exists in this build.
                Runtime execution, permission checks and invocation logging are
                deferred to Sprint X and are not active behavior here.
              </p>
            </CardContent>
          </Card>

          {/* Version History */}
          {versionHistory.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><History className="w-4 h-4" /> Version History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* The per-version "Rollback to vN" button is removed: it
                      never rolled anything back — it raised a "coming soon"
                      toast — and offering it implies a capability this build
                      does not have. */}
                  {versionHistory.map((v, i) => (
                    <div key={v.id} className={`p-2 rounded border text-xs ${i === 0 ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">v{recorded(v.version)}</span>
                        <span className="text-slate-400">{v.createdAt ? new Date(v.createdAt).toLocaleDateString() : 'no date recorded'}</span>
                      </div>
                      <p className="text-slate-500 mt-1">{v.changeNote || 'No change note recorded'}</p>
                      <p className="text-slate-400 mt-0.5">By: {v.createdBy || 'not recorded'}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Hard Deny Reminder */}
          <Card className="bg-red-50 border-red-200">
            <CardContent className="py-3">
              <p className="text-xs text-red-700 font-medium flex items-center gap-1">
                <Shield className="w-3 h-3" /> Action deny policies not configured in this build
              </p>
              <p className="text-xs text-red-600 mt-1">
                No bot invocation path exists in this build, so no bot can act
                at all; deny policies arrive with Sprint X.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      </fieldset>
    </div>
  );
}
