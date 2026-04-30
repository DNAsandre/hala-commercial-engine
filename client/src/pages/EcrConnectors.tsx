import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
/**
 * ECR CONNECTOR MANAGEMENT SCREEN — Admin
 * Design: Swiss Precision Instrument — Deep navy + warm white
 * Register connectors, enable/disable, map metrics to external fields,
 * view health status. All connectors default disabled.
 */
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Plus, Plug, Link2, Shield, AlertTriangle, CheckCircle2,
  XCircle, Settings, Database, ArrowRight, Eye, Lock
} from 'lucide-react';
import {
  type EcrConnector, type EcrMetricMapping, type ConnectorType, type ConnectorStatus
} from '@/lib/ecr';
import { useEcrMetrics } from '@/hooks/useSupabase';
import { Loader2 as Spinner } from 'lucide-react';

const connectorTypeConfig: Record<ConnectorType, { label: string; color: string; icon: string }> = {
  finance: { label: 'Finance', color: 'bg-emerald-100 text-emerald-700', icon: '💰' },
  ops: { label: 'Operations', color: 'bg-blue-100 text-blue-700', icon: '⚙️' },
  tableau: { label: 'Tableau', color: 'bg-orange-100 text-orange-700', icon: '📊' },
  crm: { label: 'CRM', color: 'bg-purple-100 text-purple-700', icon: '👥' },
  custom: { label: 'Custom', color: 'bg-slate-100 text-slate-700', icon: '🔧' },
};

export default function EcrConnectors() {
  const { data: liveMetrics, loading: metricsLoading } = useEcrMetrics();
  // Connectors don't have a DB table yet — start empty instead of mock
  const [connectors, setConnectors] = useState<EcrConnector[]>([]);
  const [mappings, setMappings] = useState<EcrMetricMapping[]>([]);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);

  // Register form
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<ConnectorType>('custom');
  const [newHost, setNewHost] = useState('');
  const [newPort, setNewPort] = useState('443');

  const activeMetrics = liveMetrics.filter(m => m.active);

  if (metricsLoading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Spinner className="w-8 h-8 animate-spin text-slate-400" /></div>;
  }

  const handleToggleConnector = (id: string) => {
    setConnectors(prev => prev.map(c =>
      c.id === id ? { ...c, status: c.status === 'enabled' ? 'disabled' : 'enabled' as ConnectorStatus } : c
    ));
    toast.success('Connector status updated');
  };

  const handleRegister = () => {
    if (!newName) {
      toast.error('Connector name is required');
      return;
    }
    const newConnector: EcrConnector = {
      id: `econ-${crypto.randomUUID()}`,
      name: newName,
      type: newType,
      status: 'disabled',
      readOnly: true,
      configJson: { host: newHost, port: newPort },
      createdAt: new Date().toISOString(),
    };
    setConnectors(prev => [...prev, newConnector]);
    setShowRegisterDialog(false);
    setNewName('');
    setNewHost('');
    toast.success('Connector registered (disabled by default)');
  };

  const getConnectorMappings = (connectorId: string) => {
    return mappings
      .filter(mm => mm.connectorId === connectorId)
      .map(mm => {
        const metric = liveMetrics.find(m => m.id === mm.metricId);
        return { ...mm, metricName: metric?.displayName || 'Unknown', metricKey: metric?.metricKey || '' };
      });
  };

  const getHealthStatus = (connector: EcrConnector) => {
    if (connector.status === 'disabled') return { label: 'Disabled', color: 'text-slate-400', icon: <XCircle className="w-4 h-4" /> };
    // Simulated health — in production this would ping the connector
    return { label: 'Healthy', color: 'text-emerald-600', icon: <CheckCircle2 className="w-4 h-4" /> };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-4">
        <Link href="/ecr">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to ECR Dashboard
          </Button>
        </Link>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif text-slate-900">ECR Connectors</h1>
          <p className="text-sm text-slate-500 mt-1">Future integration points. Register connectors and map metrics to external data fields. All connectors default disabled.</p>
        </div>
        <Button onClick={() => setShowRegisterDialog(true)}>
          <Plus className="w-4 h-4 mr-2" /> Register Connector
        </Button>
      </div>

      {/* Phase Notice */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-blue-800 text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span className="font-medium">Phase 1 (Current):</span>
            <span className="text-blue-700">ECR works without live integrations. Connectors are registered but disabled. Data is entered manually or via spreadsheet.</span>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Registered</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{connectors.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Enabled</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{connectors.filter(c => c.status === 'enabled').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Metric Mappings</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{mappings.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Read-Only</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{connectors.filter(c => c.readOnly).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Connector Cards */}
      <div className="space-y-4">
        {connectors.map(connector => {
          const typeConfig = connectorTypeConfig[connector.type];
          const health = getHealthStatus(connector);
          const connMappings = getConnectorMappings(connector.id);
          const isSelected = selectedConnector === connector.id;

          return (
            <Card key={connector.id} className={`${connector.status === 'disabled' ? 'opacity-75' : ''} hover:shadow-sm transition-shadow`}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${typeConfig.color}`}>
                      {typeConfig.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{connector.name}</h3>
                        <Badge variant="outline" className={`text-xs ${typeConfig.color}`}>{typeConfig.label}</Badge>
                        {connector.readOnly && (
                          <Badge variant="outline" className="text-xs bg-slate-50 text-slate-500">
                            <Eye className="w-3 h-3 mr-1" /> Read-Only
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span className={`flex items-center gap-1 ${health.color}`}>
                          {health.icon} {health.label}
                        </span>
                        <span>Host: {connector.configJson.host || '—'}</span>
                        <span>{connMappings.length} metric mappings</span>
                        <span>Registered: {new Date(connector.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedConnector(isSelected ? null : connector.id)}
                    >
                      <Settings className="w-3.5 h-3.5 mr-1" /> Mappings
                    </Button>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{connector.status === 'enabled' ? 'Enabled' : 'Disabled'}</span>
                      <Switch
                        checked={connector.status === 'enabled'}
                        onCheckedChange={() => handleToggleConnector(connector.id)}
                      />
                    </div>
                  </div>
                </div>

                {/* Metric Mappings */}
                {isSelected && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Link2 className="w-4 h-4" /> Metric Mappings
                    </h4>

                    {connMappings.length > 0 ? (
                      <div className="space-y-2">
                        {connMappings.map(mm => (
                          <div key={mm.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-700">{mm.metricName}</p>
                              <code className="text-xs text-slate-400 font-mono">{mm.metricKey}</code>
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-300" />
                            <div className="flex-1">
                              <code className="text-sm font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded">{mm.externalFieldName}</code>
                              <p className="text-xs text-slate-400 mt-0.5">Transform: {JSON.stringify(mm.transformationLogic)}</p>
                            </div>
                            <Badge variant="outline" className={`text-xs ${mm.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                              {mm.active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center bg-slate-50 rounded-lg">
                        <Database className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm text-slate-500">No metric mappings configured</p>
                        <p className="text-xs text-slate-400 mt-1">Map ECR metrics to external data fields from this connector</p>
                      </div>
                    )}

                    {/* Unmapped Metrics */}
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider mt-4 mb-2">Available Metrics (Not Mapped)</p>
                      <div className="flex flex-wrap gap-2">
                        {activeMetrics
                          .filter(m => !connMappings.some(mm => mm.metricId === m.id))
                          .map(m => (
                            <Button
                              key={m.id}
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => toast.info(`Mapping configuration for "${m.displayName}" will be available in Phase 2`)}
                            >
                              <Plus className="w-3 h-3 mr-1" /> {m.displayName}
                            </Button>
                          ))
                        }
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Provider Interface */}
      <Card>
        <CardContent className="py-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Data Provider Interface</h3>
          <div className="p-4 bg-slate-50 rounded-lg border font-mono text-sm">
            <p className="text-slate-600">{'// All providers implement this interface'}</p>
            <p className="text-slate-900 mt-1">{'interface EcrDataProvider {'}</p>
            <p className="text-slate-900 ml-4">{'get_customer_metrics(customer_id, period)'}</p>
            <p className="text-slate-900">{'}'}</p>
            <p className="text-slate-600 mt-3">{'// Default providers (Phase 1):'}</p>
            <p className="text-emerald-700">{'ManualProvider    ✓ Active'}</p>
            <p className="text-emerald-700">{'SpreadsheetProvider ✓ Active'}</p>
            <p className="text-slate-600 mt-2">{'// Future providers (Phase 2):'}</p>
            <p className="text-slate-400">{'FinanceProvider    ○ Planned'}</p>
            <p className="text-slate-400">{'OpsProvider        ○ Planned'}</p>
            <p className="text-slate-400">{'TableauProvider    ○ Planned'}</p>
          </div>
          <p className="text-xs text-slate-400 mt-2">Switching to connector mode only changes source_mode. The score engine remains unchanged.</p>
        </CardContent>
      </Card>

      {/* No AI Notice */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-amber-800 text-sm">
            <Shield className="w-4 h-4" />
            <span className="font-medium">Connector Safety:</span>
            <span className="text-amber-700">Connectors provide data only. They cannot modify scoring logic, weights, or grades. All connector data is source-tracked and auditable.</span>
          </div>
        </CardContent>
      </Card>

      {/* Register Dialog */}
      <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Register New Connector</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Connector Name</Label>
              <Input placeholder="e.g., SAP Finance System" value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={newType} onValueChange={v => setNewType(v as ConnectorType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="ops">Operations</SelectItem>
                  <SelectItem value="tableau">Tableau</SelectItem>
                  <SelectItem value="crm">CRM</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Host</Label>
                <Input placeholder="e.g., sap.hala.sa" value={newHost} onChange={e => setNewHost(e.target.value)} />
              </div>
              <div>
                <Label>Port</Label>
                <Input placeholder="443" value={newPort} onChange={e => setNewPort(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              New connectors are registered as disabled and read-only by default.
              Enable after configuring metric mappings.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegisterDialog(false)}>Cancel</Button>
            <Button onClick={handleRegister}>Register Connector</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
