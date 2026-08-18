import { Link } from "wouter";
import { cleanHref } from "@clean/lib/clean-routing";
import { ArrowLeft } from "lucide-react";
/**
 * BOT REGISTRY PAGE — /system/bots
 * Design: Swiss Precision Instrument — Deep navy + warm white
 *
 * SC-01 Wave 06 (T15, manifest rows B-01..B-06): this page is the bot
 * DEFINITION registry. It lists the persisted `ai_bots` records and performs
 * the real definition-management writes through the T13 service layer
 * (src/lib/bot-admin.ts):
 *
 *   B-03 enable/disable — setBotStatus, read-back confirmed
 *   B-04 archive        — archiveBot, read-back confirmed
 *   B-05 duplicate      — duplicateBot (full copy incl. FPS-008 columns
 *                         + current version row), every step confirmed
 *   B-06 delete         — deleteBot (draft/disabled only), zero-row = failure
 *
 * HONESTY RULES CARRIED FROM WAVE 04 (unchanged):
 *  - Reads are three-state: LOADING, FAILED READ and REAL EMPTY are three
 *    visibly different screens, and no counter is asserted unless the rows
 *    behind it were actually read.
 *  - No per-bot runtime metrics: `ai_bots` records no run count, cost, error
 *    rate or last-run time, and this build never invokes a bot (manifest B-12).
 *  - Provider labels are resolved honestly against the ai_providers rows that
 *    were actually read (describeBotProvider).
 *
 * WAVE 06 WRITE RULES (the codebase's law):
 *  - No optimistic mutation. The list changes ONLY after the service confirms
 *    the stored row AND the page re-reads from the database (reload truth).
 *  - UI success comes ONLY from a confirmed service result
 *    (status "stored" / "completed"). Anything else surfaces the service's
 *    honest reason and the display does not change.
 *  - Status language describes the DEFINITION record (stored configuration).
 *    Nothing on this page runs, executes or activates a bot — there is no
 *    invocation path in this build (architect correction #5, 2026-08-18).
 *  - Provider records are METADATA: their recorded enabled/disabled value is
 *    displayed as data. There is no provider toggle — enable/disable of a
 *    provider is rejected scope (architect correction #4; manifest B-08).
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useLocation } from 'wouter';
import {
  Bot, ShieldAlert, PowerOff, Cpu, Eye, Pencil,
  AlertTriangle, XCircle, Clock, DollarSign, Search,
  Radio, WifiOff, Copy, Archive, AlertOctagon, Bot as BotIcon
} from 'lucide-react';
import {
  BOT_DELETABLE_STATUSES,
  archiveBot,
  deleteBot,
  describeBotProvider,
  duplicateBot,
  readAiBots,
  readAiProviders,
  setBotStatus,
  summariseProviderUsage,
  type AiBotRecord,
  type AiProviderRecord,
  type BotToggleStatus,
  type RecordRead,
} from '@/lib/bot-admin';

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  draft: 'bg-amber-100 text-amber-800 border-amber-200',
  disabled: 'bg-slate-100 text-slate-600 border-slate-200',
  archived: 'bg-slate-50 text-slate-400 border-slate-100',
};

// ─────────────────────────────────────────────────────────────
// Registry action logic — exported so the write rules can be
// asserted without a DOM (no DOM test environment exists here).
// Every function returns an outcome the component applies:
// ok:true  → toast the message and RE-READ from the database;
// ok:false → toast the reason; the rendered list is NOT touched.
// ─────────────────────────────────────────────────────────────

export interface RegistryActionOutcome {
  ok: boolean;
  message: string;
}

/** The status the registry toggle writes next (old-app rule: anything
 *  non-active toggles to "active"; "active" toggles to "disabled"). */
export function toggleTargetStatus(currentStatus: string): BotToggleStatus {
  return currentStatus === 'active' ? 'disabled' : 'active';
}

/** Delete is offered only for draft/disabled definitions (manifest B-06). */
export function canDeleteBot(status: string): boolean {
  return BOT_DELETABLE_STATUSES.has(status);
}

/**
 * B-03: write the definition's status and report ONLY the confirmed stored
 * value. A resolved-but-zero-row write ("not_stored") is a failure — the
 * definition keeps its previous displayed status and the reason is shown.
 */
export async function performBotStatusToggle(
  bot: Pick<AiBotRecord, 'id' | 'name' | 'status'>,
): Promise<RegistryActionOutcome> {
  const target = toggleTargetStatus(bot.status);
  const result = await setBotStatus(bot.id, target);
  if (result.status === 'stored') {
    return {
      ok: true,
      message:
        `Stored: definition "${bot.name}" now records status "${target}". ` +
        'This is stored configuration only — no bot runs in this build.',
    };
  }
  return {
    ok: false,
    message: `The status of "${bot.name}" was not changed. ${result.error}`,
  };
}

/** B-04: archive = status "archived" on the definition record, confirmed. */
export async function performArchiveBot(
  bot: Pick<AiBotRecord, 'id' | 'name'>,
): Promise<RegistryActionOutcome> {
  const result = await archiveBot(bot.id);
  if (result.status === 'stored') {
    return {
      ok: true,
      message:
        `Stored: definition "${bot.name}" is archived. It stays listed under the ` +
        '"Archived" status filter. An archived pdf_studio bot also leaves FinalStudio discovery, ' +
        'which lists active definitions only.',
    };
  }
  return { ok: false, message: `"${bot.name}" was not archived. ${result.error}` };
}

/** B-05: duplicate as a confirmed draft copy (definition + current version). */
export async function performDuplicateBot(
  bot: Pick<AiBotRecord, 'id' | 'name'>,
): Promise<RegistryActionOutcome> {
  const result = await duplicateBot(bot.id);
  if (result.status === 'completed') {
    const versionNote = result.value.copiedVersion
      ? 'its current version row was copied with it'
      : 'the source has no version row, so the copy is definition-only too';
    return {
      ok: true,
      message: `Stored: "${result.value.name}" created as a draft copy (${versionNote}).`,
    };
  }
  return { ok: false, message: `"${bot.name}" was not duplicated. ${result.error}` };
}

/** B-06: delete a draft/disabled definition; a zero-row delete is an error. */
export async function performDeleteBot(
  bot: Pick<AiBotRecord, 'id' | 'name' | 'status'>,
): Promise<RegistryActionOutcome> {
  const result = await deleteBot(bot.id);
  if (result.status === 'completed') {
    return {
      ok: true,
      message:
        `Deleted: definition "${bot.name}" and its ${result.value.deletedVersionCount} ` +
        `version row(s) were removed (confirmed by the database).`,
    };
  }
  return { ok: false, message: `"${bot.name}" was not deleted. ${result.error}` };
}

/** Client-side filter over the rows that were actually read (manifest B-02).
 *  Archived definitions are not vanished: they appear under "all" and under
 *  the dedicated "archived" status filter (manifest B-04). */
export function filterBots(
  bots: readonly AiBotRecord[],
  filters: { searchQuery: string; typeFilter: string; statusFilter: string },
): AiBotRecord[] {
  return bots.filter(b => {
    if (filters.searchQuery && !b.name.toLowerCase().includes(filters.searchQuery.toLowerCase())) return false;
    if (filters.typeFilter !== 'all' && b.type !== filters.typeFilter) return false;
    if (filters.statusFilter !== 'all' && b.status !== filters.statusFilter) return false;
    return true;
  });
}

/** Loading / failed / empty are rendered by this one component everywhere. */
function ReadStatePanel({
  read, subject, onRetry,
}: { read: RecordRead<unknown> | null; subject: string; onRetry: () => void }) {
  if (read === null) {
    return (
      <Card><CardContent className="py-10 text-center text-sm text-slate-500">Reading {subject}…</CardContent></Card>
    );
  }
  if (read.status === 'error' || read.status === 'unavailable') {
    return (
      <Card className="border-red-200 bg-red-50/40">
        <CardContent className="py-8 space-y-2 text-center">
          <XCircle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-sm font-semibold text-red-700">{subject} could not be read</p>
          <p className="text-xs text-slate-500 max-w-xl mx-auto">
            Nothing is listed and no totals are shown. The number of records is unknown — it is not zero.
          </p>
          <p className="text-[11px] font-mono text-slate-500 break-all">{read.error}</p>
          <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="py-10 text-center space-y-1">
        <Bot className="w-8 h-8 text-slate-300 mx-auto" />
        <p className="text-sm font-medium">No {subject} are visible to this account</p>
        <p className="text-xs text-slate-500 max-w-xl mx-auto">
          The read succeeded and returned zero rows. Records hidden by row-level security would not appear here.
        </p>
      </CardContent>
    </Card>
  );
}

export default function BotRegistry() {
  const [, navigate] = useLocation();
  const [botsRead, setBotsRead] = useState<RecordRead<AiBotRecord> | null>(null);
  const [providersRead, setProvidersRead] = useState<RecordRead<AiProviderRecord> | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  /** Bot id with a write in flight — that bot's controls wait for the result. */
  const [pendingBotId, setPendingBotId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setBotsRead(null);
    setProvidersRead(null);
    (async () => {
      const [b, p] = await Promise.all([readAiBots(), readAiProviders()]);
      if (!mounted) return;
      setBotsRead(b);
      setProvidersRead(p);
    })();
    return () => { mounted = false; };
  }, [reloadKey]);

  const bots = botsRead?.rows ?? [];
  const providers = providersRead?.rows ?? [];
  const botsLoaded = botsRead !== null && (botsRead.status === 'loaded' || botsRead.status === 'empty');

  const filteredBots = filterBots(bots, { searchQuery, typeFilter, statusFilter });
  const activeCount = bots.filter(b => b.status === 'active').length;
  const providerUsage = botsLoaded ? summariseProviderUsage(providers, bots) : null;

  /** Apply an action outcome: confirmed → toast + RE-READ from the database;
   *  anything else → the reason is shown and the rendered list is untouched. */
  const runAction = async (
    botId: string,
    action: () => Promise<RegistryActionOutcome>,
  ) => {
    setPendingBotId(botId);
    try {
      const outcome = await action();
      if (outcome.ok) {
        toast.success(outcome.message);
        setReloadKey(k => k + 1); // reload truth: the list re-reads ai_bots
      } else {
        toast.error(outcome.message);
      }
    } finally {
      setPendingBotId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-4">
        <Link href={cleanHref("/system/admin")}>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Admin
          </Button>
        </Link>
      </div>
      <div className="flex items-center justify-between">
        <div>
          {/* CLEAN APP: H1 renamed to "Bots" per approved product decision.
              The three System bot surfaces are Bots / Bot Builder / Bot Audit.
              "Bot Governance" is deliberately not used as a page label. */}
          <h1 className="text-2xl font-bold font-serif text-slate-900">Bots</h1>
          <p className="text-sm text-slate-500 mt-1">Human-First. AI assists. Humans decide. Bots have zero inherent authority.</p>
        </div>
        {/* B-14 entry point: the Bot Builder create workflow. */}
        <Button onClick={() => navigate(cleanHref('/system/bot-builder'))} className="bg-[#1B2A4A] hover:bg-[#2a3d66]">
          <BotIcon className="w-4 h-4 mr-2" /> Create New Bot
        </Button>
      </div>

      {/* Scope disclosure: definition management, no execution path. */}
      <Card className="border-2 border-slate-200">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                <PowerOff className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Definitions only — no execution path in this build</h3>
                <p className="text-sm text-slate-500 max-w-3xl">
                  This page manages persisted bot definition records: status, archive, duplicate and delete are
                  changes to stored configuration in <span className="font-mono">ai_bots</span>. Nothing on it
                  invokes a bot, calls a model or produces an AI result — a definition recorded "active" is a
                  configuration value, not a running process. A global kill switch is therefore not configured:
                  there is no running behaviour for it to stop. Bot execution is deferred to Sprint X.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Row — only counts that are computed from records actually read.
          While the read is pending or failed, no number is asserted. */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Bots recorded "active"</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{botsLoaded ? activeCount : '—'}</p>
                <p className="text-xs text-slate-400">
                  {botsLoaded
                    ? `${bots.length} bot records read`
                    : botsRead === null ? 'Reading…' : 'Read failed — count unknown'}
                </p>
              </div>
              <Cpu className="w-8 h-8 text-[#1B2A4A] opacity-40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Signal Events</p>
                <p className="text-2xl font-bold text-slate-400 mt-1">—</p>
                <p className="text-xs text-slate-400">No signal store in this build</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-slate-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Total Cost (USD)</p>
                <p className="text-2xl font-bold text-slate-400 mt-1">—</p>
                <p className="text-xs text-slate-400">Not tracked in this build</p>
              </div>
              <DollarSign className="w-8 h-8 text-[#1B2A4A] opacity-40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Denied Actions</p>
                <p className="text-2xl font-bold text-slate-400 mt-1">—</p>
                <p className="text-xs text-slate-400">Not configured in this build</p>
              </div>
              <ShieldAlert className="w-8 h-8 text-red-400 opacity-60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="bots">
        <TabsList>
          <TabsTrigger value="bots">Bot Registry</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="connectors">Connectors</TabsTrigger>
          <TabsTrigger value="signals">Signal Events</TabsTrigger>
          <TabsTrigger value="deny-list">Hard Deny List</TabsTrigger>
        </TabsList>

        {/* Bot Registry Tab */}
        <TabsContent value="bots" className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search bots..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="action">Action Bots</SelectItem>
                <SelectItem value="monitor">Monitor Bots</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
                {/* Archived definitions stay reachable here (manifest B-04). */}
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!botsLoaded || bots.length === 0 ? (
            <ReadStatePanel read={botsRead} subject="bot records" onRetry={() => setReloadKey(k => k + 1)} />
          ) : (
          <div className="space-y-3">
            {filteredBots.length === 0 && (
              <Card><CardContent className="py-10 text-center text-sm text-slate-500">
                No bot records match the current filters. {bots.length} records were read.
              </CardContent></Card>
            )}
            {filteredBots.map(bot => {
              const providerLabel = describeBotProvider(bot.providerId, providersRead);
              const pending = pendingBotId === bot.id;
              return (
                <Card key={bot.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bot.type === 'action' ? 'bg-blue-100' : 'bg-[#075eea]/15'}`}>
                          {bot.type === 'action' ? <Pencil className="w-5 h-5 text-blue-600" /> : <Eye className="w-5 h-5 text-[#075eea]" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-900">{bot.name}</h3>
                            <Badge variant="outline" className={statusColors[bot.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}>
                              {bot.status || 'no status recorded'}
                            </Badge>
                            <Badge variant="outline" className={bot.type === 'action' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-[#075eea]/10 text-[#075eea] border-[#075eea]/20'}>
                              {bot.type || 'no type recorded'}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">{bot.purpose || 'No purpose recorded'}</p>
                          {/* Recorded configuration only. `ai_bots` stores no
                              run count, cost, error rate or last-run time, and
                              this build never invokes a bot, so no runtime
                              figure is shown. */}
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                            <span className={`flex items-center gap-1 ${providerLabel.state === 'matched' ? '' : 'text-amber-600'}`}>
                              <Cpu className="w-3 h-3" />{providerLabel.label}
                            </span>
                            <span className="flex items-center gap-1">Model: {bot.model ?? 'not recorded'}</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Updated {bot.updatedAt ? new Date(bot.updatedAt).toLocaleDateString() : 'not recorded'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {pending && <span className="text-xs text-slate-400">Writing…</span>}
                        {/* B-03: definition status toggle. The switch reflects
                            the STORED status and only changes after the write
                            is confirmed and the list is re-read — there is no
                            optimistic flip. Archived definitions have no
                            toggle (old registry rule). */}
                        {bot.status !== 'archived' && (
                          <Switch
                            checked={bot.status === 'active'}
                            disabled={pending}
                            aria-label={`Definition status for ${bot.name}: currently "${bot.status}". Toggling stores "${toggleTargetStatus(bot.status)}" — configuration only, nothing runs.`}
                            onCheckedChange={() => runAction(bot.id, () => performBotStatusToggle(bot))}
                          />
                        )}
                        <Button variant="outline" size="sm" disabled={pending}
                          onClick={() => navigate(cleanHref(`/system/bot-builder?id=${bot.id}`))}>
                          <Pencil className="w-3 h-3 mr-1" /> Edit
                        </Button>
                        {/* B-05: duplicate as draft. */}
                        <Button variant="ghost" size="sm" disabled={pending} title="Duplicate as a draft definition"
                          onClick={() => runAction(bot.id, () => performDuplicateBot(bot))}>
                          <Copy className="w-3 h-3" />
                        </Button>
                        {/* B-04: archive. */}
                        {bot.status !== 'archived' && (
                          <Button variant="ghost" size="sm" disabled={pending} title="Archive this definition (stays listed under the Archived filter)"
                            onClick={() => {
                              if (!confirm(`Archive the definition "${bot.name}"? It stays listed under the "Archived" status filter. An archived pdf_studio bot also leaves FinalStudio discovery, which lists active definitions only.`)) return;
                              void runAction(bot.id, () => performArchiveBot(bot));
                            }}>
                            <Archive className="w-3 h-3" />
                          </Button>
                        )}
                        {/* B-06: delete — draft/disabled definitions only. */}
                        {canDeleteBot(bot.status) && (
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" disabled={pending}
                            title="Delete this draft/disabled definition and its version rows"
                            onClick={() => {
                              if (!confirm(`Delete the definition "${bot.name}" and its version rows? This cannot be undone.`)) return;
                              void runAction(bot.id, () => performDeleteBot(bot));
                            }}>
                            <XCircle className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          )}
        </TabsContent>

        {/* Providers Tab — provider records are METADATA. The recorded
            enabled/disabled value is displayed as data; no control here
            activates or deactivates a provider (rejected scope — architect
            correction #4; manifest B-08). Provider/model SELECTION for a bot
            definition lives in the Bot Builder (B-16). */}
        <TabsContent value="providers" className="space-y-4">
          {providersRead === null || providersRead.status !== 'loaded' ? (
            <ReadStatePanel read={providersRead} subject="AI provider records" onRetry={() => setReloadKey(k => k + 1)} />
          ) : (
          <>
          <div className="grid grid-cols-3 gap-4">
            {providers.map(provider => {
              const matched = providerUsage?.matchedByProvider[provider.id];
              return (
              <Card key={provider.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{provider.displayName}</CardTitle>
                    <Badge
                      variant="outline"
                      className={provider.enabled
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'}
                    >
                      recorded {provider.enabled ? 'enabled' : 'disabled'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {/* Recorded fields only. Health, rate limits and cost are
                        not measured in this build and are not claimed. The
                        enabled value is stored metadata — this build neither
                        activates nor deactivates a provider. */}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Provider id</span>
                      <span className="font-mono text-xs text-slate-700">{provider.id}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Enabled (recorded value)</span>
                      <span className="font-medium text-slate-700">{provider.enabled ? "Yes" : "No"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Models</span>
                      <span className="text-slate-700">{provider.models.length} recorded</span>
                    </div>
                    <div className="pt-2 border-t">
                      <p className="text-xs text-slate-400">Models: {provider.models.join(', ')}</p>
                    </div>
                    <div className="pt-1">
                      {/* A count of zero is only stated when the bot records
                          were actually read. If that read failed, "0" would be
                          an assertion about data nobody saw. */}
                      <p className="text-xs text-slate-400">
                        Bot definitions whose provider_id equals this provider id:{' '}
                        {matched
                          ? `${matched.total} (${matched.active} recorded active)`
                          : botsRead === null
                            ? 'bot records not read yet'
                            : 'unknown — the bot records could not be read'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
          {/* The recorded provider_id values on ai_bots do not all match a
              provider record (live data holds legacy and null ids). Those
              populations are stated rather than silently dropped. */}
          {providerUsage && (providerUsage.unmatched.length > 0 || providerUsage.unrecorded.total > 0) && (
            <Card className="border-amber-200 bg-amber-50/40">
              <CardContent className="py-3 space-y-1">
                <p className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Bot definitions not counted against any provider card above
                </p>
                {providerUsage.unmatched.map(u => (
                  <p key={u.providerId} className="text-xs text-amber-800">
                    {u.total} definition(s) record provider_id <span className="font-mono">"{u.providerId}"</span>, which
                    matches no provider record ({u.active} recorded active).
                  </p>
                ))}
                {providerUsage.unrecorded.total > 0 && (
                  <p className="text-xs text-amber-800">
                    {providerUsage.unrecorded.total} definition(s) record no provider id at all
                    ({providerUsage.unrecorded.active} recorded active).
                  </p>
                )}
              </CardContent>
            </Card>
          )}
          </>
          )}
        </TabsContent>

        {/* Connectors Tab — there is no connector store in this build. The
            old page mapped over an array that was never populated, so the tab
            rendered as a blank panel with no explanation. */}
        <TabsContent value="connectors" className="space-y-4">
          <Card>
            <CardContent className="py-10 text-center space-y-1">
              <WifiOff className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-medium">No connector records exist in this build</p>
              <p className="text-xs text-slate-500 max-w-xl mx-auto">
                This build has no connector store to read, so no connector is listed and none is claimed to be
                connected or disconnected. There is also no bot invocation path, so no connector could be called.
                Connector configuration is deferred to Sprint X.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Signal Events Tab — same: no signal store exists. */}
        <TabsContent value="signals" className="space-y-4">
          <Card>
            <CardContent className="py-10 text-center space-y-1">
              <Radio className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-medium">No signal event records exist in this build</p>
              <p className="text-xs text-slate-500 max-w-xl mx-auto">
                Signal events are produced by monitor-bot execution, which this build does not perform. There is no
                signal store to read and nothing is inferred. Deferred to Sprint X.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hard Deny List Tab */}
        <TabsContent value="deny-list" className="space-y-4">
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-800 flex items-center gap-2">
                <AlertOctagon className="w-5 h-5" />
                System-Level Hard Action Deny List
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                System-level action deny policies are not configured in this build (deferred to Sprint X).
              </p>
              <div className="mt-4 p-3 bg-white rounded border border-red-200">
                <p className="text-xs text-muted-foreground font-medium">
                  No deny-list enforcement exists in this build: there is no
                  bot invocation path to block. System-level deny policies are
                  deferred to Sprint X.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
