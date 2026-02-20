import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
/**
 * BOT REGISTRY PAGE
 * Design: Swiss Precision Instrument — Deep navy + warm white
 * Sections: Global Controls, Bot List, Provider Status, Connector Status
 * All controls are explicit, configurable, auditable, reversible.
 */
import { useState } from 'react';
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
  mockBots, mockProviders, mockConnectors, mockGlobalSettings, mockSignalEvents,
  toggleGlobalKillSwitch, toggleBotStatus, toggleProviderEnabled, toggleConnectorEnabled,
  getActiveSignalCount, getTotalBotCost, HARD_ACTION_DENY_LIST,
  type Bot as BotType, type BotStatus
} from '@/lib/bot-governance';

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

export default function BotRegistry() {
  const [, navigate] = useLocation();
  const [killSwitch, setKillSwitch] = useState(mockGlobalSettings.globalKillSwitch);
  const [bots, setBots] = useState([...mockBots]);
  const [providers, setProviders] = useState([...mockProviders]);
  const [connectors, setConnectors] = useState([...mockConnectors]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [, setRefresh] = useState(0);

  const handleKillSwitch = (active: boolean) => {
    if (active) {
      if (!confirm('⚠️ ACTIVATING GLOBAL KILL SWITCH\n\nThis will immediately disable ALL bot invocations across the entire system.\n\nNo bot can run until this is deactivated.\n\nAre you sure?')) return;
    }
    toggleGlobalKillSwitch(active, 'Amin Al-Rashid');
    setKillSwitch(active);
    toast[active ? 'error' : 'success'](
      active ? 'Global Kill Switch ACTIVATED — All bots disabled' : 'Global Kill Switch deactivated — Bots can now run'
    );
  };

  const handleBotToggle = (botId: string, currentStatus: BotStatus) => {
    const newStatus: BotStatus = currentStatus === 'active' ? 'disabled' : 'active';
    toggleBotStatus(botId, newStatus);
    setBots(prev => prev.map(b => b.id === botId ? { ...b, status: newStatus, updatedAt: new Date().toISOString() } : b));
    toast.success(`Bot ${newStatus === 'active' ? 'enabled' : 'disabled'}`);
  };

  const handleProviderToggle = (providerId: string, enabled: boolean) => {
    if (!enabled) {
      const affectedBots = bots.filter(b => b.providerId === providerId && b.status === 'active');
      if (affectedBots.length > 0 && !confirm(`Disabling this provider will prevent ${affectedBots.length} active bot(s) from running. Continue?`)) return;
    }
    toggleProviderEnabled(providerId, enabled);
    setProviders(prev => prev.map(p => p.id === providerId ? { ...p, enabled } : p));
    toast.success(`Provider ${enabled ? 'enabled' : 'disabled'}`);
  };

  const handleConnectorToggle = (connectorId: string, enabled: boolean) => {
    toggleConnectorEnabled(connectorId, enabled);
    setConnectors(prev => prev.map(c => c.id === connectorId ? { ...c, enabled } : c));
    toast.success(`Connector ${enabled ? 'enabled' : 'disabled'}`);
  };

  const filteredBots = bots.filter(b => {
    if (searchQuery && !b.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (typeFilter !== 'all' && b.type !== typeFilter) return false;
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    return true;
  });

  const activeCount = bots.filter(b => b.status === 'active').length;
  const signalCount = getActiveSignalCount();
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
                    ? `ACTIVE — All bot invocations blocked. Activated by ${mockGlobalSettings.killSwitchActivatedBy || 'system'}`
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
                <p className="text-xs text-slate-400">Cap: ${mockGlobalSettings.maxDailyCostUsd}/day</p>
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
                        <Button variant="ghost" size="sm" onClick={() => toast.info('Bot cloned (feature coming soon)')}>
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toast.info('Bot archived (feature coming soon)')}>
                          <Archive className="w-3 h-3" />
                        </Button>
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
          {mockSignalEvents.map(event => (
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
                    <Button variant="outline" size="sm" onClick={() => {
                      event.acknowledged = true;
                      event.acknowledgedBy = 'Amin Al-Rashid';
                      event.acknowledgedAt = new Date().toISOString();
                      setRefresh(r => r + 1);
                      toast.success('Signal acknowledged');
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
