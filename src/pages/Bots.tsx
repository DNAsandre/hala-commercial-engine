import { Link } from "wouter";
import { cleanHref } from "@clean/lib/clean-routing";
import { ArrowLeft } from "lucide-react";
/**
 * BOT REGISTRY PAGE
 * Design: Swiss Precision Instrument — Deep navy + warm white
 * Sections: Global Controls, Bot List, Provider Status, Connector Status
 * All controls are explicit, configurable, auditable, reversible.
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
  Bot, ShieldAlert, Power, PowerOff, Activity, Cpu, Database, Eye, Pencil,
  AlertTriangle, CheckCircle2, XCircle, Clock, DollarSign, Zap, Search,
  Filter, ToggleLeft, ToggleRight, Radio, Wifi, WifiOff, Shield,
  Copy, Archive, Upload, ChevronRight, AlertOctagon, Bot as BotIcon
} from 'lucide-react';
// SC-01 Wave 02 boundary correction (SX-001/SX-004/SX-011): bot-governance
// (mock) and ai-client are excluded from this build. Bot and AI records are
// displayed as REAL READ-ONLY records (ai_bots / ai_providers) or honest
// empty states. Bot activation, status mutation, archive, delete, cloning
// and infrastructure-control writes are current-wave excluded write paths -
// no such write exists in this page. No old-server calls.
//
// SC-01 Wave 04 corrections on this page:
//  1. Reads go through ops-runtime's three-state readers, so LOADING, a FAILED
//     READ and a REAL EMPTY set are three visibly different screens. Before
//     this, all three rendered as "0 total registered" with no explanation.
//  2. Per-bot runtime metrics are gone. `ai_bots` has no last_run_at,
//     total_invocations, cost_usage or error_rate column — the old mapper
//     defaulted them to 0/null and the card printed "0 runs · $0.00 · Never"
//     as if that were recorded operational history of bots that have never
//     been invoked by this build at all.
//  3. The provider label is resolved honestly. `ai_bots.provider_id` holds
//     values like "prov-openai" while `ai_providers.id` holds
//     "aip-openai-001", so the previous `provider?.name` printed the literal
//     string "undefined" for every bot on the page.
//  4. SC-01 Wave 04 (defect D): a failed `ai_providers` read used to be
//     indistinguishable from "no provider record has this id", and a failed
//     `ai_bots` read printed a confident "0" bot records against every
//     provider. Both now say that the read failed.
import {
  describeBotProvider,
  readAiBots,
  readAiProviders,
  type AiBotRecord,
  type AiProviderRecord,
  type RecordRead,
} from '@/lib/ops-runtime';

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  draft: 'bg-amber-100 text-amber-800 border-amber-200',
  disabled: 'bg-slate-100 text-slate-600 border-slate-200',
  archived: 'bg-slate-50 text-slate-400 border-slate-100',
};

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

  const filteredBots = bots.filter(b => {
    if (searchQuery && !b.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (typeFilter !== 'all' && b.type !== typeFilter) return false;
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    return true;
  });

  const activeCount = bots.filter(b => b.status === 'active').length;

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
        {/* SC-01 boundary correction: bot creation is a current-wave excluded
            write path — no creation entry point exists on this page. */}
      </div>

      {/* Read-only / no-execution banner. There is no bot invocation path in
          this build, so there is nothing for a kill switch to switch off. */}
      <Card className="border-2 border-slate-200">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                <PowerOff className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">No bot execution in this build</h3>
                <p className="text-sm text-slate-500 max-w-3xl">
                  This page lists persisted bot records only. Nothing on it invokes a bot, activates a provider or
                  produces an AI result, and no control here changes a stored record. A global kill switch is
                  therefore not configured — there is no running behaviour for it to stop. Bot execution is deferred
                  to Sprint X.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">Read-only</Badge>
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
                        {/* SC-01 Wave 02 boundary correction (SX-011): bot records are
                            read-only in this build. Activation, status
                            mutation, archive, delete and cloning are
                            current-wave excluded write paths. */}
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">Read-only in this build</Badge>
                        <Button variant="outline" size="sm" onClick={() => navigate(cleanHref(`/system/bot-builder?id=${bot.id}`))}>
                          <Eye className="w-3 h-3 mr-1" /> View
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          )}
        </TabsContent>

        {/* Providers Tab */}
        <TabsContent value="providers" className="space-y-4">
          {providersRead === null || providersRead.status !== 'loaded' ? (
            <ReadStatePanel read={providersRead} subject="AI provider records" onRetry={() => setReloadKey(k => k + 1)} />
          ) : (
          <div className="grid grid-cols-3 gap-4">
            {providers.map(provider => (
              <Card key={provider.id} className={`${!provider.enabled ? 'opacity-60' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{provider.displayName}</CardTitle>
                    <Switch checked={provider.enabled} disabled aria-readonly="true" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {/* SC-01 boundary correction: only recorded fields are
                        shown. Health, rate limits and cost are not measured
                        in this build and are not claimed. */}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Enabled (recorded)</span>
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
                          were actually read. If that read failed, `bots` is []
                          and "0" would be an assertion about data nobody
                          saw. */}
                      <p className="text-xs text-slate-400">
                        Bot records whose provider_id equals this provider id:{' '}
                        {botsLoaded
                          ? bots.filter(b => b.providerId === provider.id).length
                          : botsRead === null
                            ? 'bot records not read yet'
                            : 'unknown — the bot records could not be read'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          )}
        </TabsContent>

        {/* Connectors Tab — there is no connector store in this build. The
            previous markup mapped over an array that was never populated, so
            the tab rendered as a blank panel with no explanation. */}
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
