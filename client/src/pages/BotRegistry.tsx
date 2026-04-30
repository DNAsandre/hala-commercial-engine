import { Link } from "wouter";
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
import {
  toggleGlobalKillSwitch, toggleBotStatus, toggleProviderEnabled, toggleConnectorEnabled,
  getTotalBotCost, HARD_ACTION_DENY_LIST,
  type Bot as BotType, type BotStatus
} from '@/lib/bot-governance';
import { api } from '@/lib/api-client';

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  draft: 'bg-amber-100 text-amber-800 border-amber-200',
  disabled: 'bg-slate-100 text-slate-600 border-slate-200',
  archived: 'bg-slate-50 text-slate-400 border-slate-100',
};

const providerStatusColors: Record<string, string> = {
  healthy: 'text-emerald-600',
  degraded: 'text-amber-500',
  offline: 'text-red-500',
};

// Map DB snake_case to component camelCase
function mapBot(row: any): BotType {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    purpose: row.purpose,
    domainsAllowed: row.domains_allowed || row.domainsAllowed || [],
    regionsAllowed: row.regions_allowed || row.regionsAllowed || [],
    rolesAllowed: row.roles_allowed || row.rolesAllowed || [],
    currentVersionId: row.current_version_id || row.currentVersionId || '',
    providerId: row.provider_id || row.providerId || '',
    model: row.model,
    rateLimit: row.rate_limit ?? row.rateLimit ?? 20,
    costCap: row.cost_cap ?? row.costCap ?? 10,
    timeout: row.timeout_sec ?? row.timeout ?? 30,
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || '',
    lastRunAt: row.last_run_at || row.lastRunAt || null,
    errorRate: row.error_rate ?? row.errorRate ?? 0,
    costUsage: row.cost_usage ?? row.costUsage ?? 0,
    totalInvocations: row.total_invocations ?? row.totalInvocations ?? 0,
  };
}

export default function BotRegistry() {
  const [, navigate] = useLocation();
  const [killSwitch, setKillSwitch] = useState(false);
  const [bots, setBots] = useState<BotType[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [connectors, setConnectors] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [signalEvents, setSignalEvents] = useState<any[]>([]);

  // Load from API on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [botsRes, provRes, connRes, settRes, eventsRes] = await Promise.all([
          api.botGovernance.listBots(),
          api.botGovernance.listProviders(),
          api.botGovernance.listConnectors(),
          api.botGovernance.getSettings(),
          api.botGovernance.listSignalEvents(),
        ]);
        if (!mounted) return;
        setBots((botsRes.data || []).map(mapBot));
        setProviders((provRes.data || []).map((p: any) => ({
          id: p.id, name: p.name, enabled: p.enabled, apiEndpoint: p.api_endpoint || '', models: p.models || [],
          costPerToken: p.cost_per_token ?? 0, maxRatePerMinute: p.max_rate_per_minute ?? 30,
          status: p.status || 'offline', lastHealthCheck: p.last_health_check || '',
        })));
        setConnectors((connRes.data || []).map((c: any) => ({
          id: c.id, type: c.type, name: c.name, enabled: c.enabled, accessMode: c.access_mode || 'read_only',
          endpoint: c.endpoint || '', status: c.status || 'disconnected', lastSyncAt: c.last_sync_at || '',
        })));
        if (settRes.data) setKillSwitch(settRes.data.global_kill_switch ?? false);
        setSignalEvents((eventsRes.data || []).map((e: any) => ({
          id: e.id, ruleId: e.rule_id || '', botId: e.bot_id, severity: e.severity, metric: e.metric,
          thresholdTriggered: e.threshold_triggered || '', timeRangeAnalyzed: e.time_range_analyzed || '',
          message: e.message, timestamp: e.triggered_at || e.created_at,
          acknowledged: e.acknowledged, acknowledgedBy: e.acknowledged_by || null,
          acknowledgedAt: e.acknowledged_at || null,
          explainability: e.explainability || '', suggestedAction: e.suggested_action || '',
        })));
      } catch { /* empty state is honest */ }
    })();
    return () => { mounted = false; };
  }, []);

  const handleKillSwitch = async (active: boolean) => {
    if (active) {
      if (!confirm('⚠️ ACTIVATING GLOBAL KILL SWITCH\n\nThis will immediately disable ALL bot invocations across the entire system.\n\nNo bot can run until this is deactivated.\n\nAre you sure?')) return;
    }
    toggleGlobalKillSwitch(active, 'Amin Al-Rashid');
    setKillSwitch(active);
    toast[active ? 'error' : 'success'](
      active ? 'Global Kill Switch ACTIVATED — All bots disabled' : 'Global Kill Switch deactivated — Bots can now run'
    );
    try {
      await api.botGovernance.updateSettings({
        global_kill_switch: active,
        kill_switch_activated_by: active ? 'Amin Al-Rashid' : null,
        kill_switch_activated_at: active ? new Date().toISOString() : null,
      });
    } catch { /* API not available — in-memory already updated */ }
  };

  const handleBotToggle = async (botId: string, currentStatus: BotStatus) => {
    const newStatus: BotStatus = currentStatus === 'active' ? 'disabled' : 'active';
    toggleBotStatus(botId, newStatus);
    setBots(prev => prev.map(b => b.id === botId ? { ...b, status: newStatus, updatedAt: new Date().toISOString() } : b));
    try {
      await api.botGovernance.updateBot(botId, { status: newStatus });
      toast.success(`Bot ${newStatus === 'active' ? 'enabled' : 'disabled'}`);
    } catch {
      // Rollback optimistic update
      toggleBotStatus(botId, currentStatus);
      setBots(prev => prev.map(b => b.id === botId ? { ...b, status: currentStatus } : b));
      toast.error(`Failed to ${newStatus === 'active' ? 'enable' : 'disable'} bot — reverted`);
    }
  };

  const handleProviderToggle = async (providerId: string, enabled: boolean) => {
    if (!enabled) {
      const affectedBots = bots.filter(b => b.providerId === providerId && b.status === 'active');
      if (affectedBots.length > 0 && !confirm(`Disabling this provider will prevent ${affectedBots.length} active bot(s) from running. Continue?`)) return;
    }
    toggleProviderEnabled(providerId, enabled);
    setProviders(prev => prev.map(p => p.id === providerId ? { ...p, enabled } : p));
    try {
      await api.botGovernance.updateProvider(providerId, { enabled });
      toast.success(`Provider ${enabled ? 'enabled' : 'disabled'}`);
    } catch {
      toggleProviderEnabled(providerId, !enabled);
      setProviders(prev => prev.map(p => p.id === providerId ? { ...p, enabled: !enabled } : p));
      toast.error(`Failed to update provider — reverted`);
    }
  };

  const handleConnectorToggle = async (connectorId: string, enabled: boolean) => {
    toggleConnectorEnabled(connectorId, enabled);
    setConnectors(prev => prev.map(c => c.id === connectorId ? { ...c, enabled } : c));
    try {
      await api.botGovernance.updateConnector(connectorId, { enabled });
      toast.success(`Connector ${enabled ? 'enabled' : 'disabled'}`);
    } catch {
      toggleConnectorEnabled(connectorId, !enabled);
      setConnectors(prev => prev.map(c => c.id === connectorId ? { ...c, enabled: !enabled } : c));
      toast.error(`Failed to update connector — reverted`);
    }
  };

  const filteredBots = bots.filter(b => {
    if (searchQuery && !b.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (typeFilter !== 'all' && b.type !== typeFilter) return false;
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    return true;
  });

  const activeCount = bots.filter(b => b.status === 'active').length;
  const signalCount = signalEvents.filter(e => !e.acknowledged).length;
  const totalCost = getTotalBotCost();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-4">
        <Link href="/admin-panel">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Admin
          </Button>
        </Link>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif text-slate-900">Bot Governance</h1>
          <p className="text-sm text-slate-500 mt-1">Human-First. AI assists. Humans decide. Bots have zero inherent authority.</p>
        </div>
        <Button onClick={() => navigate('/bot-builder')} className="bg-[#1B2A4A] hover:bg-[#2a3d66]">
          <BotIcon className="w-4 h-4 mr-2" /> Create New Bot
        </Button>
      </div>

      {/* Global Kill Switch Banner */}
      <Card className={`border-2 ${killSwitch ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {killSwitch ? (
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <PowerOff className="w-6 h-6 text-red-600 animate-pulse" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Power className="w-6 h-6 text-emerald-600" />
                </div>
              )}
              <div>
                <h3 className="font-semibold text-lg">Global Bot Kill Switch</h3>
                <p className="text-sm text-slate-500">
                  {killSwitch
                    ? `ACTIVE — All bot invocations blocked.`
                    : 'Inactive — Bots can run according to their individual permissions'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium ${killSwitch ? 'text-red-600' : 'text-emerald-600'}`}>
                {killSwitch ? 'ALL BOTS DISABLED' : 'System Active'}
              </span>
              <Switch
                checked={killSwitch}
                onCheckedChange={handleKillSwitch}
                className="data-[state=checked]:bg-red-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Active Bots</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{activeCount}</p>
                <p className="text-xs text-slate-400">{bots.length} total registered</p>
              </div>
              <Cpu className="w-8 h-8 text-[#1B2A4A] opacity-40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Active Signals</p>
                <p className={`text-2xl font-bold mt-1 ${signalCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{signalCount}</p>
                <p className="text-xs text-slate-400">Unacknowledged</p>
              </div>
              <AlertTriangle className={`w-8 h-8 ${signalCount > 0 ? 'text-amber-500' : 'text-slate-300'}`} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Total Cost (USD)</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">${totalCost.toFixed(2)}</p>
                <p className="text-xs text-slate-400">Cap: $50/day</p>
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
                <p className="text-2xl font-bold text-red-600 mt-1">{HARD_ACTION_DENY_LIST.length}</p>
                <p className="text-xs text-slate-400">System-level blocks</p>
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

          <div className="space-y-3">
            {filteredBots.map(bot => {
              const provider = providers.find(p => p.id === bot.providerId);
              return (
                <Card key={bot.id} className={`${killSwitch ? 'opacity-50' : ''} hover:shadow-md transition-shadow`}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bot.type === 'action' ? 'bg-blue-100' : 'bg-purple-100'}`}>
                          {bot.type === 'action' ? <Pencil className="w-5 h-5 text-blue-600" /> : <Eye className="w-5 h-5 text-purple-600" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-900">{bot.name}</h3>
                            <Badge variant="outline" className={statusColors[bot.status]}>{bot.status}</Badge>
                            <Badge variant="outline" className={bot.type === 'action' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}>
                              {bot.type}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">{bot.purpose}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                            <span className="flex items-center gap-1"><Cpu className="w-3 h-3" />{provider?.name} / {bot.model}</span>
                            <span className="flex items-center gap-1"><Activity className="w-3 h-3" />{bot.totalInvocations} runs</span>
                            <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />${bot.costUsage.toFixed(2)}</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{bot.lastRunAt ? new Date(bot.lastRunAt).toLocaleDateString() : 'Never'}</span>
                            {bot.errorRate > 0 && <span className="flex items-center gap-1 text-amber-500"><AlertTriangle className="w-3 h-3" />{(bot.errorRate * 100).toFixed(1)}% errors</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={bot.status === 'active'}
                          onCheckedChange={() => handleBotToggle(bot.id, bot.status)}
                          disabled={killSwitch || bot.status === 'archived'}
                        />
                        <Button variant="outline" size="sm" onClick={() => navigate(`/bot-builder?id=${bot.id}`)}>
                          <Pencil className="w-3 h-3 mr-1" /> Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={async () => {
                          try {
                            const { data: cloned } = await api.botGovernance.createBot({
                              name: `${bot.name} (Copy)`,
                              type: bot.type,
                              purpose: bot.purpose,
                              domains_allowed: bot.domainsAllowed,
                              regions_allowed: bot.regionsAllowed,
                              roles_allowed: bot.rolesAllowed,
                              provider_id: bot.providerId,
                              model: bot.model,
                              rate_limit: bot.rateLimit,
                              cost_cap: bot.costCap,
                              timeout_sec: bot.timeout,
                            });
                            if (cloned) {
                              setBots(prev => [{ ...bot, id: cloned.id, name: `${bot.name} (Copy)`, status: 'draft' as const }, ...prev]);
                              toast.success(`Bot "${bot.name}" cloned as draft`);
                            }
                          } catch {
                            setBots(prev => [{ ...bot, id: `clone-${Date.now()}`, name: `${bot.name} (Copy)`, status: 'draft' as const }, ...prev]);
                            toast.success(`Bot "${bot.name}" cloned (local only)`);
                          }
                        }}>
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={async () => {
                          setBots(prev => prev.map(b => b.id === bot.id ? { ...b, status: 'archived' as const } : b));
                          toast.success(`Bot "${bot.name}" archived`);
                          try { await api.botGovernance.updateBot(bot.id, { status: 'archived' }); } catch { /* fallback */ }
                        }} disabled={bot.status === 'archived'}>
                          <Archive className="w-3 h-3" />
                        </Button>
                        {(bot.status === 'draft' || bot.status === 'disabled') && (
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={async () => {
                            if (!confirm(`Delete bot "${bot.name}"? This cannot be undone.`)) return;
                            setBots(prev => prev.filter(b => b.id !== bot.id));
                            toast.success(`Bot "${bot.name}" deleted`);
                            try { await api.botGovernance.deleteBot(bot.id); } catch { /* fallback */ }
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
        </TabsContent>

        {/* Providers Tab */}
        <TabsContent value="providers" className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {providers.map(provider => (
              <Card key={provider.id} className={`${!provider.enabled ? 'opacity-60' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{provider.name}</CardTitle>
                    <Switch
                      checked={provider.enabled}
                      onCheckedChange={(v) => handleProviderToggle(provider.id, v)}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Status</span>
                      <span className={`font-medium flex items-center gap-1 ${providerStatusColors[provider.status]}`}>
                        {provider.status === 'healthy' ? <CheckCircle2 className="w-3 h-3" /> : provider.status === 'degraded' ? <AlertTriangle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {provider.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Models</span>
                      <span className="text-slate-700">{provider.models.length} available</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Rate Limit</span>
                      <span className="text-slate-700">{provider.maxRatePerMinute}/min</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Cost/Token</span>
                      <span className="text-slate-700">${provider.costPerToken}</span>
                    </div>
                    <div className="pt-2 border-t">
                      <p className="text-xs text-slate-400">Models: {provider.models.join(', ')}</p>
                    </div>
                    <div className="pt-1">
                      <p className="text-xs text-slate-400">
                        Bots using: {bots.filter(b => b.providerId === provider.id).length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Connectors Tab */}
        <TabsContent value="connectors" className="space-y-4">
          <div className="grid grid-cols-5 gap-4">
            {connectors.map(connector => (
              <Card key={connector.id} className={`${!connector.enabled ? 'opacity-60' : ''}`}>
                <CardContent className="py-4 text-center">
                  <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center ${connector.enabled ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                    {connector.status === 'connected' ? <Wifi className="w-5 h-5 text-emerald-600" /> : <WifiOff className="w-5 h-5 text-slate-400" />}
                  </div>
                  <h4 className="font-medium text-sm mt-3">{connector.name}</h4>
                  <p className="text-xs text-slate-400 mt-1">{connector.type.toUpperCase()}</p>
                  <Badge variant="outline" className={`mt-2 text-xs ${connector.status === 'connected' ? 'bg-emerald-50 text-emerald-700' : connector.status === 'error' ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-500'}`}>
                    {connector.status}
                  </Badge>
                  <p className="text-xs text-slate-400 mt-2">Access: {connector.accessMode.replace('_', ' ')}</p>
                  <div className="mt-3">
                    <Switch
                      checked={connector.enabled}
                      onCheckedChange={(v) => handleConnectorToggle(connector.id, v)}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="py-3">
              <div className="flex items-center gap-2 text-amber-800 text-sm">
                <Shield className="w-4 h-4" />
                <span className="font-medium">Monitor bots can only use connectors in read-only mode.</span>
                <span className="text-amber-600">If a connector is disabled, no bot can access it regardless of individual bot permissions.</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Signal Events Tab */}
        <TabsContent value="signals" className="space-y-4">
          {signalEvents.map(event => (
            <Card key={event.id} className={`${!event.acknowledged ? 'border-l-4' : ''} ${event.severity === 'escalate' ? 'border-l-red-500' : event.severity === 'needs_review' ? 'border-l-amber-500' : 'border-l-blue-400'}`}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={event.severity === 'escalate' ? 'bg-red-100 text-red-800 border-red-200' : event.severity === 'needs_review' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-blue-100 text-blue-800 border-blue-200'}>
                        {event.severity === 'escalate' ? '🔴 ESCALATE' : event.severity === 'needs_review' ? '🟡 NEEDS REVIEW' : '🔵 FYI'}
                      </Badge>
                      <span className="text-xs text-slate-400">{new Date(event.timestamp).toLocaleString()}</span>
                      {event.acknowledged && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">✓ Acknowledged</Badge>}
                    </div>
                    <p className="text-sm font-medium text-slate-900 mt-2">{event.message}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                      <span>Metric: {event.metric}</span>
                      <span>Threshold: {event.thresholdTriggered}</span>
                      <span>Range: {event.timeRangeAnalyzed}</span>
                      <span>Bot: {bots.find(b => b.id === event.botId)?.name}</span>
                    </div>
                  </div>
                  {!event.acknowledged && (
                    <Button variant="outline" size="sm" onClick={async () => {
                      setSignalEvents(prev => prev.map(e => e.id === event.id ? { ...e, acknowledged: true, acknowledgedBy: 'Amin Al-Rashid', acknowledgedAt: new Date().toISOString() } : e));
                      try {
                        await api.botGovernance.acknowledgeSignal(event.id);
                        toast.success('Signal acknowledged');
                      } catch {
                        setSignalEvents(prev => prev.map(e => e.id === event.id ? { ...e, acknowledged: false, acknowledgedBy: null, acknowledgedAt: null } : e));
                        toast.error('Failed to acknowledge — reverted');
                      }
                    }}>
                      Acknowledge
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
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
              <p className="text-sm text-red-700 mb-4">
                These actions are permanently blocked for ALL bots at the system level. This list cannot be modified, overridden, or bypassed.
                Enforcement is at the API level, not UI level.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {HARD_ACTION_DENY_LIST.map(action => (
                  <div key={action} className="flex items-center gap-2 py-2 px-3 bg-white rounded border border-red-200">
                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span className="text-sm font-mono text-red-800">{action}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-white rounded border border-red-200">
                <p className="text-xs text-red-600 font-medium">
                  IMMUTABLE — This deny list is hardcoded and cannot be modified through any admin interface.
                  Any bot attempt to execute these actions will be blocked and logged as a security event.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
