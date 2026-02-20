import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
/**
 * ECR METRIC DICTIONARY — Admin Screen
 * Design: Swiss Precision Instrument — Deep navy + warm white
 * CRUD for metrics, weights, source modes, mapping slots.
 * Metrics define all possible scoring inputs for the ECR system.
 */
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Plus, Search, Pencil, ToggleLeft, Database, FileSpreadsheet,
  User, Link2, Hash, Percent, Clock, BarChart3, Shield, Info
} from 'lucide-react';
import {
  mockMetrics, mockMetricMappings, mockConnectors, mockRuleWeights,
  getSourceModeLabel, getSourceModeColor, getActiveRuleSet,
  type EcrMetric, type SourceMode, type MetricUnit
} from '@/lib/ecr';
import { getEvolutionControls } from '@/lib/ecr-evolution';

const unitIcons: Record<MetricUnit, React.ReactNode> = {
  '%': <Percent className="w-3.5 h-3.5" />,
  'days': <Clock className="w-3.5 h-3.5" />,
  'number': <Hash className="w-3.5 h-3.5" />,
  'band': <BarChart3 className="w-3.5 h-3.5" />,
};

export default function EcrMetrics() {
  const [metrics, setMetrics] = useState<EcrMetric[]>(mockMetrics);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editingMetric, setEditingMetric] = useState<EcrMetric | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  // New metric form state
  const [formKey, setFormKey] = useState('');
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formUnit, setFormUnit] = useState<MetricUnit>('%');
  const [formMin, setFormMin] = useState(0);
  const [formMax, setFormMax] = useState(100);
  const [formWeight, setFormWeight] = useState(0);
  const [formSource, setFormSource] = useState<SourceMode>('manual');

  const filteredMetrics = useMemo(() => {
    return metrics.filter(m => {
      if (!showInactive && !m.active) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!m.displayName.toLowerCase().includes(q) && !m.metricKey.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [metrics, searchQuery, showInactive]);

  const activeCount = metrics.filter(m => m.active).length;
  const totalWeight = metrics.filter(m => m.active).reduce((sum, m) => sum + m.defaultWeight, 0);

  const handleToggleActive = (id: string) => {
    setMetrics(prev => prev.map(m =>
      m.id === id ? { ...m, active: !m.active, updatedAt: new Date().toISOString() } : m
    ));
    toast.success('Metric status updated');
  };

  const handleAddMetric = () => {
    if (!formKey || !formName) {
      toast.error('Metric key and display name are required');
      return;
    }
    if (metrics.some(m => m.metricKey === formKey)) {
      toast.error('Metric key already exists');
      return;
    }
    const newMetric: EcrMetric = {
      id: `met-${Date.now()}`,
      metricKey: formKey,
      displayName: formName,
      description: formDesc,
      unit: formUnit,
      minValue: formMin,
      maxValue: formMax,
      defaultWeight: formWeight,
      defaultSourceMode: formSource,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setMetrics(prev => [...prev, newMetric]);
    setShowAddDialog(false);
    resetForm();
    toast.success('Metric added successfully');
  };

  const handleEditMetric = () => {
    if (!editingMetric) return;
    setMetrics(prev => prev.map(m =>
      m.id === editingMetric.id ? { ...editingMetric, updatedAt: new Date().toISOString() } : m
    ));
    setEditingMetric(null);
    toast.success('Metric updated');
  };

  const resetForm = () => {
    setFormKey('');
    setFormName('');
    setFormDesc('');
    setFormUnit('%');
    setFormMin(0);
    setFormMax(100);
    setFormWeight(0);
    setFormSource('manual');
  };

  const getMappings = (metricId: string) => {
    return mockMetricMappings
      .filter(mm => mm.metricId === metricId)
      .map(mm => {
        const connector = mockConnectors.find(c => c.id === mm.connectorId);
        return { ...mm, connectorName: connector?.name || 'Unknown', connectorType: connector?.type || 'custom' };
      });
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
          <h1 className="text-2xl font-bold font-serif text-slate-900">ECR Metric Dictionary</h1>
          <p className="text-sm text-slate-500 mt-1">Define all possible scoring inputs. Metrics are the building blocks of ECR.</p>
        </div>
        <Button onClick={() => { resetForm(); setShowAddDialog(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Metric
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Total Metrics</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{metrics.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Active</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Default Weight Sum</p>
            <p className={`text-2xl font-bold mt-1 ${totalWeight === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>{totalWeight}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Connector Mappings</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{mockMetricMappings.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search metrics..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Switch checked={showInactive} onCheckedChange={setShowInactive} />
          <span>Show inactive</span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="space-y-3">
        {filteredMetrics.map(metric => {
          const mappings = getMappings(metric.id);
          return (
            <Card key={metric.id} className={`${!metric.active ? 'opacity-60' : ''} hover:shadow-sm transition-shadow`}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center text-slate-600">
                        {unitIcons[metric.unit]}
                      </div>
                      <h3 className="font-semibold text-slate-900">{metric.displayName}</h3>
                      <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-mono">{metric.metricKey}</code>
                      {metric.active ? (
                        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-slate-100 text-slate-500">Inactive</Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 ml-9">{metric.description}</p>

                    <div className="flex items-center gap-6 mt-3 ml-9 text-xs text-slate-500">
                      <span>Unit: <span className="font-medium text-slate-700">{metric.unit}</span></span>
                      <span>Range: <span className="font-medium text-slate-700">{metric.minValue} – {metric.maxValue}</span></span>
                      <span>Default Weight: <span className="font-medium text-slate-700">{metric.defaultWeight}%</span></span>
                      <span className={`px-1.5 py-0.5 rounded ${getSourceModeColor(metric.defaultSourceMode)}`}>
                        {getSourceModeLabel(metric.defaultSourceMode)}
                      </span>
                    </div>

                    {/* Evolution Indicators (Screen 2 enhancement) */}
                    <div className="flex items-center gap-4 mt-3 ml-9">
                      {(() => {
                        const activeRS = getActiveRuleSet();
                        const isRequired = activeRS ? mockRuleWeights.some(w => w.ruleSetId === activeRS.id && w.metricId === metric.id && w.weight > 0) : false;
                        const evoControls = activeRS ? getEvolutionControls(activeRS.id) : null;
                        const hasDefaultConfig = evoControls?.missing_metric_mode === 'default_value';
                        return (
                          <>
                            <span className={`text-xs px-2 py-0.5 rounded border ${isRequired ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                              {isRequired ? 'Required by active rule set' : 'Not in active rule set'}
                            </span>
                            {hasDefaultConfig && (
                              <span className="text-xs px-2 py-0.5 rounded border bg-violet-50 text-violet-700 border-violet-200">
                                Default value: configured
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    {/* Mapping Slots */}
                    {mappings.length > 0 && (
                      <div className="mt-3 ml-9">
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Connector Mappings (Future)</p>
                        <div className="flex gap-2">
                          {mappings.map(mm => (
                            <div key={mm.id} className="flex items-center gap-1.5 text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-200">
                              <Link2 className="w-3 h-3" />
                              <span>{mm.connectorName}</span>
                              <span className="text-purple-400">→</span>
                              <code className="font-mono text-[10px]">{mm.externalFieldName}</code>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button variant="outline" size="sm" onClick={() => setEditingMetric({ ...metric })}>
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                    </Button>
                    <Switch checked={metric.active} onCheckedChange={() => handleToggleActive(metric.id)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredMetrics.length === 0 && (
        <Card className="bg-slate-50">
          <CardContent className="py-12 text-center">
            <Database className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No metrics match your search</p>
          </CardContent>
        </Card>
      )}

      {/* No AI Notice */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-amber-800 text-sm">
            <Shield className="w-4 h-4" />
            <span className="font-medium">No AI Creep:</span>
            <span className="text-amber-700">Metrics define scoring inputs only. No LLM may calculate, modify, or adjust ECR scores. Score computation is purely arithmetic.</span>
          </div>
        </CardContent>
      </Card>

      {/* Add Metric Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Add New Metric</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Metric Key</Label>
                <Input placeholder="e.g., gp_percent" value={formKey} onChange={e => setFormKey(e.target.value)} className="font-mono" />
              </div>
              <div>
                <Label>Display Name</Label>
                <Input placeholder="e.g., Gross Profit %" value={formName} onChange={e => setFormName(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea placeholder="Describe what this metric measures..." value={formDesc} onChange={e => setFormDesc(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Unit</Label>
                <Select value={formUnit} onValueChange={v => setFormUnit(v as MetricUnit)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="%">% (Percentage)</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="band">Band (1-5)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Min Value</Label>
                <Input type="number" value={formMin} onChange={e => setFormMin(Number(e.target.value))} />
              </div>
              <div>
                <Label>Max Value</Label>
                <Input type="number" value={formMax} onChange={e => setFormMax(Number(e.target.value))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Default Weight (%)</Label>
                <Input type="number" value={formWeight} onChange={e => setFormWeight(Number(e.target.value))} min={0} max={100} />
              </div>
              <div>
                <Label>Default Source Mode</Label>
                <Select value={formSource} onValueChange={v => setFormSource(v as SourceMode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual Entry</SelectItem>
                    <SelectItem value="spreadsheet">Spreadsheet Upload</SelectItem>
                    <SelectItem value="connector">Connector (Future)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddMetric}>Add Metric</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Metric Dialog */}
      <Dialog open={!!editingMetric} onOpenChange={open => { if (!open) setEditingMetric(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Edit Metric: {editingMetric?.displayName}</DialogTitle>
          </DialogHeader>
          {editingMetric && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Metric Key</Label>
                  <Input value={editingMetric.metricKey} disabled className="font-mono bg-slate-50" />
                </div>
                <div>
                  <Label>Display Name</Label>
                  <Input value={editingMetric.displayName} onChange={e => setEditingMetric({ ...editingMetric, displayName: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={editingMetric.description} onChange={e => setEditingMetric({ ...editingMetric, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Unit</Label>
                  <Select value={editingMetric.unit} onValueChange={v => setEditingMetric({ ...editingMetric, unit: v as MetricUnit })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="%">% (Percentage)</SelectItem>
                      <SelectItem value="days">Days</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="band">Band (1-5)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Min Value</Label>
                  <Input type="number" value={editingMetric.minValue} onChange={e => setEditingMetric({ ...editingMetric, minValue: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Max Value</Label>
                  <Input type="number" value={editingMetric.maxValue} onChange={e => setEditingMetric({ ...editingMetric, maxValue: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Default Weight (%)</Label>
                  <Input type="number" value={editingMetric.defaultWeight} onChange={e => setEditingMetric({ ...editingMetric, defaultWeight: Number(e.target.value) })} min={0} max={100} />
                </div>
                <div>
                  <Label>Default Source Mode</Label>
                  <Select value={editingMetric.defaultSourceMode} onValueChange={v => setEditingMetric({ ...editingMetric, defaultSourceMode: v as SourceMode })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual Entry</SelectItem>
                      <SelectItem value="spreadsheet">Spreadsheet Upload</SelectItem>
                      <SelectItem value="connector">Connector (Future)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMetric(null)}>Cancel</Button>
            <Button onClick={handleEditMetric}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
