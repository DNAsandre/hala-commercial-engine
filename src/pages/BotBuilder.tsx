/**
 * BOT BUILDER PAGE — /system/bot-builder[?id=<bot id>]
 * Design: Swiss Precision Instrument — Deep navy + warm white
 *
 * SC-01 Wave 06 (T15, manifest rows B-13..B-19): the bot DEFINITION builder.
 * Without an id it CREATES a new definition (B-14); with an id it loads the
 * recorded definition (B-13) and publishes edits as a new immutable version
 * row (B-15). All persistence goes through the T13 service layer
 * (src/lib/bot-admin.ts) — this page issues no direct database writes.
 *
 *   B-14 create   — createBot: ai_bots insert + version 1 + current_version_id,
 *                   every step read-back confirmed; success ONLY from the
 *                   confirmed result, then the created bot is LOADED from the
 *                   database (reload truth).
 *   B-15 publish  — publishBotVersion: ai_bots update + version latest+1 with a
 *                   mandatory change note + the current_version_id REPOINT the
 *                   old app forgot (its consumers kept serving the stale
 *                   instruction after every publish). After publish the page
 *                   re-reads and shows the new version as current.
 *   B-16 provider — options come from the LIVE ai_providers read, never a
 *                   hardcoded list. Recorded ids that match no provider record
 *                   (live data holds legacy "prov-openai" and NULL values) are
 *                   rendered verbatim with an honest unmatched/unrecorded
 *                   state — never "undefined", never silently remapped.
 *   B-17 actions  — allowed_actions is READ from and WRITTEN to the version
 *                   row. (A Wave-04 comment here claimed the column does not
 *                   exist; that claim was wrong about the live schema and has
 *                   been deleted — the column is live and populated.)
 *   B-18 chaining — chain_config {next_bot_id, prompt_user, chain_label} read
 *                   and written per version; {} when no chain; no self-chain.
 *   Knowledge       — pasted text belongs to this bot definition and is stored
 *                   directly on each immutable ai_bot_versions row.
 *
 * HONESTY RULES (carried from Wave 04, still binding):
 *  - The bot read is three-state: loading, "no such record visible" and
 *    "read failed" are different screens.
 *  - No configuration value is invented: a null column renders as
 *    "not recorded", never as a plausible default (the old loader substituted
 *    'gpt-4o' / 20 / 10 / 30 / 0.7 / 2000).
 *  - Recorded scope values (domains/regions/roles) can never vanish: the
 *    selectable option lists are the union of the established vocabulary and
 *    whatever the record actually holds (`pdf_studio` among them).
 *  - UI success comes ONLY from a confirmed service result
 *    (status "completed"). A failed or partial outcome surfaces the service's
 *    exact reason and the page stays put.
 *  - Definitions only — no execution path in this build: nothing here invokes
 *    a bot, and no wording implies a bot runs (architect correction #5).
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { Link, useLocation, useSearch } from 'wouter';
import { cleanHref } from '@clean/lib/clean-routing';
import { supabase } from '@/lib/supabase';
import {
  Bot, Save, ArrowLeft, Shield, Cpu, Database, FileText, Zap,
  AlertTriangle, History, BookOpen, Link2,
} from 'lucide-react';
import {
  createBot,
  describeBotProvider,
  publishBotVersion,
  readAiBots,
  readAiProviders,
  readBotConfiguration,
  validateBotDefinition,
  type AiBotRecord,
  type AiProviderRecord,
  type BotConfigurationRead,
  type BotDefinitionFields,
  type BotVersionDraft,
  type RecordRead,
} from '@/lib/bot-admin';

// ─────────────────────────────────────────────────────────────
// Established selection vocabularies (old builder lists). They are FORM
// AFFORDANCES — choices offered to a human — not stored records. `pdf_studio`
// is added to the old DOMAINS list because it is a real recorded domain on the
// live rows (33 of 40 live bots carry it; manifest B-01 note): omitting it
// made recorded scope invisible in Wave 04 (defect E).
// ─────────────────────────────────────────────────────────────

const REGIONS = ['East', 'Central', 'West'];
const ROLES = ['admin', 'manager', 'sales', 'ops', 'finance', 'viewer'];
const DOMAINS = [
  'dashboard', 'crm_pipeline', 'customers', 'proposals', 'tenders', 'renewals',
  'slas', 'pnl', 'documents', 'commercial_os', 'approvals', 'escalations', 'pdf_studio',
];
const ACTION_MODES = ['suggest', 'draft', 'explain'];
const MONITOR_OUTPUTS = ['signal_event', 'report_snapshot', 'dashboard_annotation'];

const MODE_DESCRIPTIONS: Record<string, string> = {
  suggest: 'Recommend options for human consideration',
  draft: 'Generate draft text for human review and editing',
  explain: 'Explain concepts, clauses, or data in plain language',
  signal_event: 'Generate threshold/trend/anomaly signals for human review',
  report_snapshot: 'Create periodic report snapshots (read-only)',
  dashboard_annotation: 'Add annotations to dashboard views (advisory only)',
};

/** Sentinel select values ("" is not a legal Radix Select item value). */
export const NO_PROVIDER_VALUE = '__no_provider_recorded__';
export const NO_MODEL_VALUE = '__no_model_recorded__';
const NO_CHAIN_VALUE = 'none';

/** Renders a recorded value, or an explicit "not recorded" marker. */
function recorded(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "not recorded";
  return String(value);
}

// ─────────────────────────────────────────────────────────────
// Pure page logic — exported so it can be asserted without a DOM
// (this package has no DOM test environment).
// ─────────────────────────────────────────────────────────────

/**
 * Union of an established vocabulary and recorded/selected values, vocabulary
 * order first. A recorded value absent from the vocabulary stays offered and
 * visible — a stored selection can never vanish from the form (Wave 04
 * defect E: fixed page lists silently dropped `pdf_studio`).
 */
export function selectionUnion(
  vocabulary: readonly string[],
  recordedValues: readonly string[],
): string[] {
  const out = [...vocabulary];
  for (const value of recordedValues) {
    if (!out.includes(value)) out.push(value);
  }
  return out;
}

/**
 * What the page displays/edits for a loaded bot, derived from the stored
 * record only — no invented defaults. The four Wave-06 version fields
 * (allowed_actions, provider_id, model, permission_snapshot) were added to the
 * version projection by T13; this view carries allowed_actions, the chain
 * fields and the connector snapshot into the form.
 */
export interface BotBuilderView {
  /** The instruction stored on the latest version row, or null. */
  systemInstruction: string | null;
  customInstruction: string;
  safetyRules: string;
  temperature: number | null;
  maxTokens: number | null;
  knowledgeBaseText: string;
  domains: string[];
  regions: string[];
  roles: string[];
  /** Recorded allowed_actions selection on the latest version row (B-17). */
  allowedActions: string[];
  /** Recorded connector snapshot, carried forward verbatim on publish (B-20). */
  connectorSnapshot: Record<string, unknown>;
  /** 'none' when the latest version records no chain (B-18). */
  chainNextBotId: string;
  chainPromptUser: boolean;
  chainLabel: string;
}

export function deriveBotBuilderView(read: BotConfigurationRead): BotBuilderView | null {
  if (read.status !== 'loaded') return null;
  const latest = read.versions[0];
  const chain = (latest?.chainConfig ?? null) as
    | { next_bot_id?: unknown; prompt_user?: unknown; chain_label?: unknown }
    | null;
  const chainNextBotId =
    chain && typeof chain.next_bot_id === 'string' && chain.next_bot_id !== ''
      ? chain.next_bot_id
      : NO_CHAIN_VALUE;
  return {
    systemInstruction: latest?.systemInstruction ?? null,
    customInstruction: latest?.customInstruction ?? '',
    safetyRules: latest?.safetyRules ?? '',
    temperature: latest?.temperature ?? null,
    maxTokens: latest?.maxTokens ?? null,
    knowledgeBaseText: latest?.knowledgeBaseText ?? '',
    domains: read.bot.domainsAllowed,
    regions: read.bot.regionsAllowed,
    roles: read.bot.rolesAllowed,
    allowedActions: latest?.allowedActions ?? [],
    connectorSnapshot: latest?.connectorSnapshot ?? {},
    chainNextBotId,
    chainPromptUser: chainNextBotId === NO_CHAIN_VALUE ? true : chain?.prompt_user !== false,
    chainLabel:
      chainNextBotId !== NO_CHAIN_VALUE && typeof chain?.chain_label === 'string'
        ? chain.chain_label
        : '',
  };
}

/** Everything the form edits, in one plain object (the submit input). */
export interface BuilderFormState {
  name: string;
  displayName: string;
  type: string;
  purpose: string;
  domains: string[];
  regions: string[];
  roles: string[];
  providerId: string | null;
  model: string | null;
  rateLimit: number | null;
  costCap: number | null;
  timeoutSec: number | null;
  systemInstruction: string;
  customInstruction: string;
  safetyRules: string;
  temperature: number | null;
  maxTokens: number | null;
  allowedActions: string[];
  knowledgeBaseText: string;
  connectorSnapshot: Record<string, unknown>;
  chainNextBotId: string;
  chainPromptUser: boolean;
  chainLabel: string;
  changeNote: string;
}

export function buildDefinitionFields(form: BuilderFormState): BotDefinitionFields {
  return {
    name: form.name,
    displayName: form.displayName,
    type: form.type,
    purpose: form.purpose,
    domainsAllowed: form.domains,
    regionsAllowed: form.regions,
    rolesAllowed: form.roles,
    providerId: form.providerId,
    model: form.model,
    rateLimit: form.rateLimit,
    costCap: form.costCap,
    timeoutSec: form.timeoutSec,
  };
}

export function buildVersionDraft(form: BuilderFormState): BotVersionDraft {
  return {
    // Empty text is recorded as null ("not recorded"), never as ''.
    systemInstruction: form.systemInstruction.trim() === '' ? null : form.systemInstruction,
    customInstruction: form.customInstruction.trim() === '' ? null : form.customInstruction,
    safetyRules: form.safetyRules.trim() === '' ? null : form.safetyRules,
    temperature: form.temperature,
    maxTokens: form.maxTokens,
    allowedActions: form.allowedActions,
    providerId: form.providerId,
    model: form.model,
    // Carried forward verbatim from the loaded version — never invented (B-20).
    connectorSnapshot: form.connectorSnapshot,
    // Established old-contract snapshot of the scope fields at publish time.
    permissionSnapshot: {
      domainsAllowed: form.domains,
      regionsAllowed: form.regions,
      rolesAllowed: form.roles,
    },
    knowledgeBaseText: form.knowledgeBaseText.trim() === '' ? null : form.knowledgeBaseText,
    // 'none' → null, which the service stores as {} (the established
    // "no chain" value, manifest B-18).
    chainConfig:
      form.chainNextBotId && form.chainNextBotId !== NO_CHAIN_VALUE
        ? {
            next_bot_id: form.chainNextBotId,
            prompt_user: form.chainPromptUser,
            chain_label: form.chainLabel,
          }
        : null,
    changeNote: form.changeNote,
  };
}

export type BuilderSubmitOutcome =
  | { ok: true; botId: string; versionNumber: number; message: string }
  | { ok: false; message: string };

/**
 * B-14: create the definition through the service. Success comes ONLY from
 * the confirmed operation result (status "completed") — a failed or partial
 * outcome returns the service's exact reason and creates no success signal.
 */
export async function submitCreateBot(form: BuilderFormState): Promise<BuilderSubmitOutcome> {
  const problems = validateBotDefinition(buildDefinitionFields(form));
  if (problems.length > 0) {
    return { ok: false, message: `Nothing was created: ${problems.join(' ')}` };
  }
  const result = await createBot({
    ...buildDefinitionFields(form),
    version: buildVersionDraft(form),
  });
  if (result.status === 'completed') {
    return {
      ok: true,
      botId: result.value.botId,
      versionNumber: result.value.version,
      message:
        `Stored: bot definition created as draft (id "${result.value.botId}") with version 1 — ` +
        'all three steps confirmed by the database.',
    };
  }
  return { ok: false, message: result.error };
}

/**
 * B-15: publish the edited definition as a new version through the service
 * (which also repoints current_version_id — the old app's forgotten step).
 * Success comes ONLY from the confirmed operation result.
 */
export async function submitPublishVersion(
  botId: string,
  form: BuilderFormState,
): Promise<BuilderSubmitOutcome> {
  const result = await publishBotVersion(botId, buildDefinitionFields(form), buildVersionDraft(form));
  if (result.status === 'completed') {
    return {
      ok: true,
      botId,
      versionNumber: result.value.version,
      message:
        `Stored: version ${result.value.version} published and current_version_id repointed — ` +
        'all steps confirmed by the database.',
    };
  }
  return { ok: false, message: result.error };
}

export interface ProviderOption {
  value: string;
  label: string;
  /** False for a recorded id that matches no provider record (verbatim). */
  matched: boolean;
}

/**
 * B-16: provider options from the rows actually read, plus the recorded id
 * rendered VERBATIM when it matches no provider record. Live data fact
 * (2026-08-18): 34 bots record "aip-openai-001" (matches), 2 record legacy
 * "prov-openai" (matches nothing), 4 record NULL. The unmatched id is offered
 * as itself — never remapped to a "probably intended" provider.
 */
export function deriveProviderOptions(
  providers: readonly AiProviderRecord[],
  recordedProviderId: string | null,
): ProviderOption[] {
  const options: ProviderOption[] = providers.map(p => ({
    value: p.id,
    label: `${p.displayName}${p.enabled ? '' : ' (recorded disabled)'}`,
    matched: true,
  }));
  if (recordedProviderId && !providers.some(p => p.id === recordedProviderId)) {
    options.unshift({
      value: recordedProviderId,
      label: `${recordedProviderId} (recorded value — no matching provider record)`,
      matched: false,
    });
  }
  return options;
}

/**
 * B-16: model options from the selected provider's recorded models array,
 * plus the recorded model verbatim when it is absent from that array (or when
 * no provider is selected at all).
 */
export function deriveModelOptions(
  providers: readonly AiProviderRecord[],
  selectedProviderId: string | null,
  recordedModel: string | null,
): ProviderOption[] {
  const provider = selectedProviderId
    ? providers.find(p => p.id === selectedProviderId)
    : undefined;
  const models = provider?.models ?? [];
  const options: ProviderOption[] = models.map(m => ({ value: m, label: m, matched: true }));
  if (recordedModel && !models.includes(recordedModel)) {
    options.unshift({
      value: recordedModel,
      label: provider
        ? `${recordedModel} (recorded value — not in this provider's model list)`
        : `${recordedModel} (recorded value)`,
      matched: false,
    });
  }
  return options;
}

/** Number-input parsing: empty → null (not recorded); no NaN can escape. */
export function parseNumberInput(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Recorded scope values, or an honest statement that none are recorded. */
function ScopeToggleBadges({
  options, selected, onToggle, subject,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  subject: string;
}) {
  if (options.length === 0) {
    return <p className="text-xs text-slate-500 mt-1">No {subject} are available to select.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {options.map(v => (
        <Badge
          key={v}
          variant={selected.includes(v) ? 'default' : 'outline'}
          className={`cursor-pointer ${selected.includes(v) ? 'bg-[#1B2A4A]' : ''}`}
          onClick={() => onToggle(v)}
        >
          {v}
        </Badge>
      ))}
    </div>
  );
}

export default function BotBuilder() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const editId = params.get('id');

  // Three-state read of the bot's recorded configuration (edit mode).
  const [botRead, setBotRead] = useState<BotConfigurationRead | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [providersRead, setProvidersRead] = useState<RecordRead<AiProviderRecord> | null>(null);
  const [allBotsRead, setAllBotsRead] = useState<RecordRead<AiBotRecord> | null>(null);
  const [versionHistory, setVersionHistory] = useState<Array<{ id: string; version: number | null; changeNote: string; createdAt: string; createdBy: string }>>([]);

  const existingBot = botRead?.status === 'loaded' ? botRead.bot : null;

  // Section 1: Identity
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  /** True when the raw name/display_name split could not be read and both
   *  fields were initialised from the recorded display label. */
  const [identityCollapsed, setIdentityCollapsed] = useState(false);
  const [type, setType] = useState<string>('action');
  const [purpose, setPurpose] = useState('');
  const [domains, setDomains] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  // Option lists: established vocabulary ∪ whatever the record holds, so a
  // recorded value can never vanish from the form.
  const [domainOptions, setDomainOptions] = useState<string[]>([...DOMAINS]);
  const [regionOptions, setRegionOptions] = useState<string[]>([...REGIONS]);
  const [roleOptions, setRoleOptions] = useState<string[]>([...ROLES]);

  // Section 2: Instructions — editable; loaded values come from the stored
  // latest version row and publish carries them into the next version.
  const [systemInstruction, setSystemInstruction] = useState('');
  const [customInstruction, setCustomInstruction] = useState('');
  const [safetyRules, setSafetyRules] = useState('');
  const [temperature, setTemperature] = useState<number | null>(null);
  const [maxTokens, setMaxTokens] = useState<number | null>(null);
  /** True in edit mode when the loaded bot has no version rows at all. */
  const noVersionRows = botRead?.status === 'loaded' && botRead.versions.length === 0;

  // Section 3: Allowed actions — recorded per-version selection (B-17).
  const [allowedActions, setAllowedActions] = useState<string[]>([]);
  const [recordedActions, setRecordedActions] = useState<string[]>([]);

  // Section 4: knowledge authored for this bot and version.
  const [knowledgeBaseText, setKnowledgeBaseText] = useState('');

  // Section 5: Connector snapshot — displayed as data, carried forward
  // verbatim on publish (manifest B-20: no connector store exists to pick
  // from, and connector access is invocation-time behaviour).
  const [connectorSnapshot, setConnectorSnapshot] = useState<Record<string, unknown>>({});

  // Section 6: Provider & model (B-16) — null = the record stores no value.
  const [providerId, setProviderId] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [rateLimit, setRateLimit] = useState<number | null>(null);
  const [costCap, setCostCap] = useState<number | null>(null);
  const [timeoutSec, setTimeoutSec] = useState<number | null>(null);

  // Section 7: Chaining (B-18)
  const [chainNextBotId, setChainNextBotId] = useState(NO_CHAIN_VALUE);
  const [chainPromptUser, setChainPromptUser] = useState(true);
  const [chainLabel, setChainLabel] = useState('');

  // Change note (mandatory for publish; service enforces it too).
  const [changeNote, setChangeNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!editId) {
      // Create mode: a blank form, no read. (Also the reset path when
      // navigating from an edit URL back to plain /system/bot-builder.)
      setBotRead(null);
      setVersionHistory([]);
      setName('');
      setDisplayName('');
      setIdentityCollapsed(false);
      setType('action');
      setPurpose('');
      setDomains([]);
      setRegions([]);
      setRoles([]);
      setDomainOptions([...DOMAINS]);
      setRegionOptions([...REGIONS]);
      setRoleOptions([...ROLES]);
      setSystemInstruction('');
      setCustomInstruction('');
      setSafetyRules('');
      setTemperature(null);
      setMaxTokens(null);
      setAllowedActions([]);
      setRecordedActions([]);
      setKnowledgeBaseText('');
      setConnectorSnapshot({});
      setProviderId(null);
      setModel(null);
      setRateLimit(null);
      setCostCap(null);
      setTimeoutSec(null);
      setChainNextBotId(NO_CHAIN_VALUE);
      setChainPromptUser(true);
      setChainLabel('');
      setChangeNote('');
      return;
    }
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
      //
      // Identity columns: the mapped record collapses display_name ?? name
      // into one label, but the form edits BOTH columns (manifest B-15 note:
      // live rows distinguish name "test-bot-verify" from display_name
      // "Test Bot Verify", and the old page's mirroring overwrote the
      // distinction on every save). A supplemental READ of the two raw
      // columns keeps them separate; if it fails, both fields fall back to
      // the recorded display label and the difference is stated.
      const identityRes = await supabase
        .from('ai_bots')
        .select('id, name, display_name')
        .eq('id', editId)
        .maybeSingle();
      if (!mounted) return;
      const identity = identityRes.error
        ? null
        : (identityRes.data as { name?: string | null; display_name?: string | null } | null);
      if (identity) {
        setName(identity.name ?? '');
        setDisplayName(identity.display_name ?? '');
        setIdentityCollapsed(false);
      } else {
        setName(b.name);
        setDisplayName(b.name);
        setIdentityCollapsed(true);
      }
      setType(b.type === 'monitor' ? 'monitor' : 'action');
      setPurpose(b.purpose);
      setDomains(view.domains);
      setRegions(view.regions);
      setRoles(view.roles);
      setDomainOptions(selectionUnion(DOMAINS, view.domains));
      setRegionOptions(selectionUnion(REGIONS, view.regions));
      setRoleOptions(selectionUnion(ROLES, view.roles));
      setProviderId(b.providerId ?? null);
      setModel(b.model ?? null);
      setRateLimit(b.rateLimit);
      setCostCap(b.costCap);
      setTimeoutSec(b.timeoutSec);

      setSystemInstruction(view.systemInstruction ?? '');
      setCustomInstruction(view.customInstruction);
      setSafetyRules(view.safetyRules);
      setTemperature(view.temperature);
      setMaxTokens(view.maxTokens);
      setAllowedActions(view.allowedActions);
      setRecordedActions(view.allowedActions);
      setKnowledgeBaseText(view.knowledgeBaseText);
      setConnectorSnapshot(view.connectorSnapshot);
      setChainNextBotId(view.chainNextBotId);
      setChainPromptUser(view.chainPromptUser);
      setChainLabel(view.chainLabel);
      setChangeNote('');

      setVersionHistory(result.versions.map(v => ({
        id: v.id, version: v.version, changeNote: v.changeNote,
        createdAt: v.createdAt, createdBy: v.createdBy,
      })));
    })();
    return () => { mounted = false; };
  }, [editId, reloadKey]);

  // Providers — live ai_providers read (same source as Admin → AI Providers).
  useEffect(() => {
    let mounted = true;
    readAiProviders().then(r => {
      if (!mounted) return;
      setProvidersRead(r);
    });
    return () => { mounted = false; };
  }, [reloadKey]);

  // All bots for the chain dropdown — the classified service read, so a
  // failed read is stated rather than rendered as an empty dropdown.
  useEffect(() => {
    let mounted = true;
    readAiBots().then(r => {
      if (!mounted) return;
      setAllBotsRead(r);
    });
    return () => { mounted = false; };
  }, [reloadKey]);

  const collectForm = (): BuilderFormState => ({
    name,
    displayName,
    type,
    purpose,
    domains,
    regions,
    roles,
    providerId,
    model,
    rateLimit,
    costCap,
    timeoutSec,
    systemInstruction,
    customInstruction,
    safetyRules,
    temperature,
    maxTokens,
    allowedActions,
    knowledgeBaseText,
    connectorSnapshot,
    chainNextBotId,
    chainPromptUser,
    chainLabel,
    changeNote,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const form = collectForm();
      const outcome = editId
        ? await submitPublishVersion(editId, form)
        : await submitCreateBot(form);
      if (!outcome.ok) {
        // The service's reason verbatim — including exact partial outcomes
        // ("the bot record WAS created but its first version row was NOT").
        toast.error(outcome.message);
        return;
      }
      toast.success(outcome.message);
      if (editId) {
        // Reload truth: re-read the stored configuration; the new version
        // appears in the history and as the recorded current version.
        setReloadKey(k => k + 1);
      } else {
        // Reload truth for create: LOAD the created bot from the database.
        navigate(cleanHref(`/system/bot-builder?id=${outcome.botId}`));
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleIn = (setter: (fn: (prev: string[]) => string[]) => void) => (value: string) =>
    setter(prev => (prev.includes(value) ? prev.filter(x => x !== value) : [...prev, value]));

  const backLink = (
    <div className="mb-4">
      <Link href={cleanHref("/system/bots")}>
        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Bots
        </Button>
      </Link>
    </div>
  );

  /* Edit mode: loading, "no such bot", and "read failed" are three different
     screens (unchanged Wave 04 behaviour). */
  if (editId && botRead === null) {
    return (
      <div className="space-y-6">
        {backLink}
        <Card><CardContent className="py-12 text-center text-sm text-slate-500">Reading the recorded bot configuration…</CardContent></Card>
      </div>
    );
  }

  if (editId && botRead && botRead.status === 'error') {
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

  if (editId && botRead && botRead.status === 'not_found') {
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
  const providers = providersRead?.rows ?? [];
  const providersReadable =
    providersRead !== null && (providersRead.status === 'loaded' || providersRead.status === 'empty');
  const providerOptions = deriveProviderOptions(providers, providerId);
  const modelOptions = deriveModelOptions(providers, providerId, model);
  const providerLabel = describeBotProvider(providerId, providersRead);
  const selectedProvider = providers.find(p => p.id === providerId);

  const chainBots = (allBotsRead?.rows ?? []).filter(b => b.id !== editId);
  const chainTargetUnmatched =
    chainNextBotId !== NO_CHAIN_VALUE && !chainBots.some(b => b.id === chainNextBotId);

  const actionVocabulary = type === 'action' ? ACTION_MODES : MONITOR_OUTPUTS;
  const actionOptions = selectionUnion(
    actionVocabulary,
    selectionUnion(recordedActions, allowedActions),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      {backLink}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold font-serif text-slate-900">
              {editId ? `Edit: ${existingBot?.name}` : 'Create New Bot'}
            </h1>
            {/* No version number is invented: a bot with no rows in
                ai_bot_versions previously displayed "Version 1". */}
            <p className="text-sm text-slate-500">
              {editId
                ? versionHistory.length === 0
                  ? 'No version rows recorded for this bot — saving publishes version 1'
                  : `Version ${recorded(latestVersion?.version)} of ${versionHistory.length} recorded — saving publishes version ${typeof latestVersion?.version === 'number' ? latestVersion.version + 1 : 'latest + 1'}`
                : 'All new bots start in Draft status'}
              {' — definitions only; no execution path in this build'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="outline" disabled={saving} onClick={() => navigate(cleanHref("/system/bots"))}>Cancel</Button>
          <Button className="bg-[#1B2A4A] hover:bg-[#2a3d66]" disabled={saving} onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Writing…' : editId ? 'Publish New Version' : 'Create Bot'}
          </Button>
        </div>
      </div>

      {noVersionRows && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="py-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              This bot has no rows in <span className="font-mono">ai_bot_versions</span>. Instructions, temperature,
              token limit, knowledge sources and connector snapshot below start empty because nothing is recorded —
              they are not defaults the bot would use. Saving publishes version 1.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Main Form — 2 columns */}
        <div className="space-y-6 xl:col-span-2">

          {/* Section 1: Identity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Bot className="w-4 h-4" /> 1. Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label>Bot Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., proposal-drafter" />
                </div>
                <div>
                  {/* Edited explicitly — NOT mirrored from the name (manifest
                      B-15 note: live rows distinguish name from display_name).
                      Blank falls back to the name on save. */}
                  <Label>Display Name</Label>
                  <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g., Proposal Drafter (blank = same as name)" />
                </div>
              </div>
              {identityCollapsed && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> The raw name / display_name split could not be read, so both
                  fields show the recorded display label. Saving stores the values exactly as shown here.
                </p>
              )}
              <div>
                <Label>Bot Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="action">Action Bot (Suggest / Draft / Explain)</SelectItem>
                    <SelectItem value="monitor">Monitor Bot (Read-only signals)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Purpose</Label>
                <Textarea value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Describe what this bot does and its boundaries..." rows={3} />
              </div>
              <div>
                {/* The option list is the established vocabulary PLUS every
                    value the record holds, so a recorded domain such as
                    `pdf_studio` can never vanish from the form. */}
                <Label>Allowed Domains</Label>
                <ScopeToggleBadges options={domainOptions} selected={domains} onToggle={toggleIn(setDomains)} subject="domains" />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label>Regions Allowed</Label>
                  <ScopeToggleBadges options={regionOptions} selected={regions} onToggle={toggleIn(setRegions)} subject="regions" />
                </div>
                <div>
                  <Label>Roles Allowed to Invoke</Label>
                  <ScopeToggleBadges options={roleOptions} selected={roles} onToggle={toggleIn(setRoles)} subject="roles" />
                  <p className="text-[10px] text-slate-500 mt-1">Stored scope configuration — nothing invokes a bot in this build.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><FileText className="w-4 h-4" /> 2. Instructions</CardTitle>
              <CardDescription>
                Stored on each version row. Publishing writes these values to a new
                <span className="font-mono"> ai_bot_versions</span> row; earlier versions stay unchanged.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="flex items-center gap-2">
                  System Instruction
                  <span className="text-xs text-slate-400 font-normal">(stored on the version row)</span>
                </Label>
                <Textarea
                  value={systemInstruction}
                  onChange={e => setSystemInstruction(e.target.value)}
                  placeholder={editId
                    ? (noVersionRows
                        ? 'No version rows are recorded for this bot, so no system instruction is stored against it.'
                        : 'The latest version row records no system instruction.')
                    : 'The stored instruction for this bot. Leaving it empty records no instruction — this build holds no default instruction that a bot would use.'}
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <Label>Custom Instruction</Label>
                <Textarea value={customInstruction} onChange={e => setCustomInstruction(e.target.value)}
                  placeholder="Additional instructions stored with this version (empty records none)" rows={4} />
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  Safety / Refusal Rules <span className="text-xs text-slate-400 font-normal">(optional)</span>
                </Label>
                <Textarea value={safetyRules} onChange={e => setSafetyRules(e.target.value)}
                  placeholder="Define what this bot must NEVER do (empty records none)" rows={4}
                  />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  {/* A null temperature is stated as not recorded rather than
                      shown as a value with the slider at that position. */}
                  <Label>Temperature: {recorded(temperature)}</Label>
                  <Slider value={[temperature ?? 0]} onValueChange={([v]) => setTemperature(v)}
                    min={0} max={1} step={0.1} className="mt-2" />
                  <p className="text-xs text-slate-400 mt-1">Lower = more deterministic, Higher = more creative. Stored configuration only.</p>
                </div>
                <div>
                  <Label>Max Tokens</Label>
                  <Input type="number" value={maxTokens ?? ''} min={100} max={8000}
                    placeholder="not recorded"
                    onChange={e => setMaxTokens(parseNumberInput(e.target.value))} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Allowed Actions (B-17) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Zap className="w-4 h-4" /> 3. Allowed Actions</CardTitle>
              <CardDescription>
                Recorded per-version selection (<span className="font-mono">ai_bot_versions.allowed_actions</span>).
                Stored configuration only — nothing executes, applies or blocks any action in this build.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-slate-600 mb-3">
                  {type === 'action'
                    ? 'Doctrine action-bot modes (the recorded selection is stored with each version):'
                    : 'Doctrine monitor-bot output types (the recorded selection is stored with each version):'}
                </p>
                {actionOptions.map(mode => (
                  <div key={mode} className="flex items-center gap-3 p-3 border rounded">
                    <Checkbox checked={allowedActions.includes(mode)}
                      onCheckedChange={() => toggleIn(setAllowedActions)(mode)} />
                    <div>
                      <p className={`font-medium ${actionVocabulary.includes(mode) ? 'capitalize' : 'font-mono text-sm'}`}>{mode}</p>
                      <p className="text-xs text-slate-400">
                        {MODE_DESCRIPTIONS[mode] ??
                          "Recorded value on this bot's latest version (not part of the standard vocabulary) — kept verbatim."}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-xs text-red-700 font-medium flex items-center gap-1">
                  <Shield className="w-3 h-3" /> System-level action deny policies are not configured in this build (deferred to Sprint X).
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Section 4: knowledge authored for this bot. */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="w-4 h-4" /> 4. Knowledge Base</CardTitle>
              <CardDescription>
                Paste the reference material this bot must know. It is stored with this bot version, not in a separate Admin library.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label htmlFor="bot-knowledge-base">Knowledge Base</Label>
              <Textarea
                id="bot-knowledge-base"
                value={knowledgeBaseText}
                onChange={event => setKnowledgeBaseText(event.target.value)}
                placeholder="Paste the facts, services, policies, examples, and reference material this bot should use."
                rows={12}
                className="font-mono text-sm"
              />
              <p className="text-xs text-slate-500">
                {knowledgeBaseText.trim().length > 0
                  ? `${knowledgeBaseText.length.toLocaleString()} characters will be stored with this version.`
                  : 'No knowledge base is recorded for this bot version.'}
              </p>
            </CardContent>
          </Card>

          {/* Section 5: Connector snapshot — recorded data only. There is no
              connector store in this build to pick from, and connector access
              is invocation-time behaviour (manifest B-20, recorded not
              migrated). The snapshot is carried forward verbatim on publish. */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Database className="w-4 h-4" /> 5. Connector Snapshot (recorded)</CardTitle>
              <CardDescription>
                No connector store exists in this build, so no connector can be selected here. The snapshot recorded
                on the latest version row is shown below and carried forward verbatim when a new version is published.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(connectorSnapshot).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(connectorSnapshot).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between p-2 border rounded text-sm">
                      <span className="font-mono text-xs">{key}</span>
                      <span className="text-slate-500 text-xs">recorded: {String(value)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 p-3">
                  {editId
                    ? 'The latest version row records no connector snapshot ({} is stored with the next version).'
                    : 'A new bot starts with an empty connector snapshot ({}).'}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Section 6: Provider & Model (B-16) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Cpu className="w-4 h-4" /> 6. Provider & Model Selection</CardTitle>
              <CardDescription>
                Options come from the live <span className="font-mono">ai_providers</span> records. Selection is stored
                configuration on the definition and its versions — this build never calls a provider.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {providersReadable ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label>Provider</Label>
                    <Select
                      value={providerId ?? NO_PROVIDER_VALUE}
                      onValueChange={v => setProviderId(v === NO_PROVIDER_VALUE ? null : v)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_PROVIDER_VALUE}>No provider recorded</SelectItem>
                        {providerOptions.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {providerLabel.state === 'unmatched' && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> The recorded id <span className="font-mono">{providerId}</span> matches
                        no provider record. It is kept verbatim unless a listed provider is selected.
                      </p>
                    )}
                    {selectedProvider && !selectedProvider.enabled && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> This provider record is marked disabled (recorded metadata; nothing runs either way).
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Model</Label>
                    <Select
                      value={model ?? NO_MODEL_VALUE}
                      onValueChange={v => setModel(v === NO_MODEL_VALUE ? null : v)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_MODEL_VALUE}>No model recorded</SelectItem>
                        {modelOptions.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!providerId && model && (
                      <p className="text-xs text-amber-600 mt-1">
                        A model is recorded without a provider id; it is shown verbatim.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* A failed provider read and "no provider has this id" are
                      different facts (Wave 04 defect D). When the read failed
                      the recorded values are kept verbatim and no option list
                      is invented. */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <Label>Provider (recorded on the bot record)</Label>
                      <Input value={providerId ?? 'not recorded'} readOnly className="font-mono text-xs" />
                    </div>
                    <div>
                      <Label>Model (recorded)</Label>
                      <Input value={model ?? 'not recorded'} readOnly className="font-mono text-xs" />
                    </div>
                  </div>
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {providersRead === null
                      ? 'Reading the provider records…'
                      : `The provider records could not be read (${'error' in providersRead ? providersRead.error : 'unknown error'}), so no selection list can be offered. The recorded values above are kept verbatim and are still written on save.`}
                  </p>
                  {providersRead !== null && (
                    <Button variant="outline" size="sm" onClick={() => setReloadKey(k => k + 1)}>Retry</Button>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label>Rate Limit (per min)</Label>
                  <Input type="number" value={rateLimit ?? ''} min={1} max={100} placeholder="not recorded"
                    onChange={e => setRateLimit(parseNumberInput(e.target.value))} />
                </div>
                <div>
                  <Label>Cost Cap (USD)</Label>
                  <Input type="number" value={costCap ?? ''} min={1} max={100} placeholder="not recorded"
                    onChange={e => setCostCap(parseNumberInput(e.target.value))} />
                </div>
                <div>
                  <Label>Timeout (seconds)</Label>
                  <Input type="number" value={timeoutSec ?? ''} min={5} max={120} placeholder="not recorded"
                    onChange={e => setTimeoutSec(parseNumberInput(e.target.value))} />
                </div>
              </div>
              <p className="text-xs text-slate-400">
                These are stored configuration values only. This build never applies them: no rate limit, cost cap or
                timeout is exercised, because no bot is invoked.
              </p>
            </CardContent>
          </Card>

          {/* Section 7: Bot Chaining (B-18) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Link2 className="w-4 h-4" /> 7. Bot Chaining Pipeline</CardTitle>
              <CardDescription>
                Recorded chain configuration, stored per version
                (<span className="font-mono">ai_bot_versions.chain_config</span>). This build never runs a bot, so no
                chain is executed and no next bot is offered anywhere in the application.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Next Bot in Chain</Label>
                <Select value={chainNextBotId} onValueChange={setChainNextBotId}>
                  <SelectTrigger><SelectValue placeholder="No chain recorded" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CHAIN_VALUE}>No chain recorded</SelectItem>
                    {/* The recorded target is kept verbatim even when the bot
                        list read failed or no longer contains it. */}
                    {chainTargetUnmatched && (
                      <SelectItem value={chainNextBotId}>
                        {chainNextBotId} (recorded value — not in the bot list that was read)
                      </SelectItem>
                    )}
                    {chainBots.map(b => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} ({b.type}) {b.status !== 'active' ? `— ${b.status}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {allBotsRead !== null && (allBotsRead.status === 'error' || allBotsRead.status === 'unavailable') && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> The bot list could not be read ({allBotsRead.error}), so only
                    the recorded value is offered.
                  </p>
                )}
                <p className="text-[10px] text-slate-500 mt-1">Recorded value only — no chained run is offered or performed by this build.</p>
              </div>
              {chainNextBotId !== NO_CHAIN_VALUE && (
                <>
                  <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">Prompt user before chaining (recorded flag)</p>
                      <p className="text-[10px] text-slate-500">Stored as <span className="font-mono">prompt_user</span> in the chain configuration.</p>
                    </div>
                    <Switch checked={chainPromptUser} onCheckedChange={setChainPromptUser} />
                  </div>
                  <div>
                    <Label>Chain Button Label (recorded text)</Label>
                    <Input value={chainLabel} onChange={e => setChainLabel(e.target.value)} placeholder="e.g., Auto-draft all blocks" />
                    <p className="text-[10px] text-slate-500 mt-1">Stored as <span className="font-mono">chain_label</span>. No button uses it in this build.</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Change note — mandatory for publishing a new version (B-15). */}
          {editId && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><History className="w-4 h-4" /> Version Change Note</CardTitle>
                <CardDescription>Required — every published version records why it exists.</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea value={changeNote} onChange={e => setChangeNote(e.target.value)}
                  placeholder="Describe what changed in this version..." rows={2} />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Sidebar — Version History & Summary */}
        <div className="space-y-4">
          {/* Bot Summary */}
          <Card className="bg-slate-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Bot Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Type</span><Badge variant="outline">{type}</Badge></div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <Badge variant="outline">{editId ? recorded(existingBot?.status) : 'draft (on create)'}</Badge>
              </div>
              {/* These counts describe exactly the badge lists rendered in
                  section 1, which are the values that will be stored. */}
              <div className="flex justify-between gap-2"><span className="text-slate-500 shrink-0">Domains</span><span className="text-right">{domains.length > 0 ? domains.join(', ') : 'none selected'}</span></div>
              <div className="flex justify-between gap-2"><span className="text-slate-500 shrink-0">Regions</span><span className="text-right">{regions.length > 0 ? regions.join(', ') : 'none selected'}</span></div>
              <div className="flex justify-between gap-2"><span className="text-slate-500 shrink-0">Roles</span><span className="text-right">{roles.length > 0 ? roles.join(', ') : 'none selected'}</span></div>
              <div className="flex justify-between gap-2"><span className="text-slate-500 shrink-0">Provider</span><span className={`text-right ${providerLabel.state === 'matched' ? '' : 'text-amber-600'}`}>{providerLabel.label}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Model</span><span>{model ?? 'not recorded'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Allowed actions</span><span>{allowedActions.length} selected</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Knowledge</span><span>{knowledgeBaseText.trim().length > 0 ? `${knowledgeBaseText.length.toLocaleString()} characters` : 'Not provided'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Connector snapshot keys</span><span>{Object.keys(connectorSnapshot).length}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Temperature</span><span>{recorded(temperature)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Max Tokens</span><span>{recorded(maxTokens)}</span></div>
            </CardContent>
          </Card>

          {/* Scope disclosure */}
          <Card className="border border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4" /> Definitions Only</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Definitions only — no execution path in this build. This page stores bot configuration records;
                runtime invocation, permission checks and invocation logging are deferred to Sprint X and are not
                active behaviour here.
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
                  {versionHistory.map(v => {
                    const isCurrent = existingBot?.currentVersionId === v.id;
                    return (
                      <div key={v.id} className={`p-2 rounded border text-xs ${isCurrent ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            v{recorded(v.version)}
                            {isCurrent && (
                              <Badge variant="outline" className="ml-2 text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                                current
                              </Badge>
                            )}
                          </span>
                          <span className="text-slate-400">{v.createdAt ? new Date(v.createdAt).toLocaleDateString() : 'no date recorded'}</span>
                        </div>
                        <p className="text-slate-500 mt-1">{v.changeNote || 'No change note recorded'}</p>
                        <p className="text-slate-400 mt-0.5">By: {v.createdBy || 'not recorded'}</p>
                      </div>
                    );
                  })}
                  {existingBot && existingBot.currentVersionId &&
                    !versionHistory.some(v => v.id === existingBot.currentVersionId) && (
                    <p className="text-[10px] text-amber-600">
                      The recorded current_version_id (<span className="font-mono">{existingBot.currentVersionId}</span>)
                      matches none of the version rows read for this bot.
                    </p>
                  )}
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
    </div>
  );
}
