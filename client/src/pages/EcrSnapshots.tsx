import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
/**
 * ECR INPUT SNAPSHOT SCREEN
 * Design: Swiss Precision Instrument — Deep navy + warm white
 * Create snapshots, enter manual values, upload spreadsheets,
 * view source mode per field, see connector-fed fields (future).
 */
import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Plus, Camera, FileSpreadsheet, User, Clock, ChevronDown, ChevronUp,
  Database, Upload, Shield, Eye, Pencil, Check, X
} from 'lucide-react';
import {
  mockSnapshots, mockInputValues, mockMetrics, mockScores,
  ecrCustomerNames, getSourceModeLabel, getSourceModeColor,
  computeEcrScore, getGradeBg,
  type EcrInputSnapshot, type EcrInputValue, type SourceMode
} from '@/lib/ecr';

export default function EcrSnapshots() {
  const [snapshots, setSnapshots] = useState<EcrInputSnapshot[]>(mockSnapshots);
  const [inputValues, setInputValues] = useState<EcrInputValue[]>(mockInputValues);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null);
  const [customerFilter, setCustomerFilter] = useState<string>('all');

  // Create snapshot form
  const [newCustomerId, setNewCustomerId] = useState('cust-sabic');
  const [newPeriodStart, setNewPeriodStart] = useState('2025-04-01');
  const [newPeriodEnd, setNewPeriodEnd] = useState('2025-06-30');

  // Editing values
  const [editValues, setEditValues] = useState<Record<string, number>>({});

  const activeMetrics = mockMetrics.filter(m => m.active);
  const customerIds = Object.keys(ecrCustomerNames);

  const filteredSnapshots = useMemo(() => {
    let result = [...snapshots];
    if (customerFilter !== 'all') {
      result = result.filter(s => s.customerId === customerFilter);
    }
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [snapshots, customerFilter]);

  const handleCreateSnapshot = () => {
    const newSnapshot: EcrInputSnapshot = {
      id: `snap-${Date.now()}`,
      customerId: newCustomerId,
      periodStart: newPeriodStart,
      periodEnd: newPeriodEnd,
      createdBy: 'Amin Al-Rashid',
      createdAt: new Date().toISOString(),
    };
    setSnapshots(prev => [...prev, newSnapshot]);
    setShowCreateDialog(false);
    setExpandedId(newSnapshot.id);
    setEditingSnapshotId(newSnapshot.id);
    // Initialize empty edit values
    const initial: Record<string, number> = {};
    activeMetrics.forEach(m => { initial[m.id] = 0; });
    setEditValues(initial);
    toast.success('Snapshot created. Enter metric values below.');
  };

  const handleStartEdit = (snapshotId: string) => {
    const vals = inputValues.filter(v => v.snapshotId === snapshotId);
    const initial: Record<string, number> = {};
    activeMetrics.forEach(m => {
      const existing = vals.find(v => v.metricId === m.id);
      initial[m.id] = existing?.value ?? 0;
    });
    setEditValues(initial);
    setEditingSnapshotId(snapshotId);
  };

  const handleSaveValues = (snapshotId: string) => {
    const newValues: EcrInputValue[] = activeMetrics.map((m, i) => ({
      id: `iv-${Date.now()}-${i}`,
      snapshotId,
      metricId: m.id,
      value: editValues[m.id] ?? 0,
      sourceMode: 'manual' as SourceMode,
      sourceReference: 'Manual entry',
      capturedBy: 'Amin Al-Rashid',
      capturedAt: new Date().toISOString(),
    }));
    // Remove old values for this snapshot and add new ones
    setInputValues(prev => [
      ...prev.filter(v => v.snapshotId !== snapshotId),
      ...newValues,
    ]);
    setEditingSnapshotId(null);
    toast.success('Metric values saved');
  };

  const handleSpreadsheetUpload = (snapshotId: string) => {
    toast.info('Spreadsheet upload: In production, this would parse an Excel/CSV file and populate metric values. For now, values are entered manually.');
  };

  const getSnapshotScore = (snapshotId: string) => {
    const vals = inputValues.filter(v => v.snapshotId === snapshotId);
    if (vals.length === 0) return null;
    return computeEcrScore(snapshotId, 'rs-2', mockMetrics, undefined, inputValues);
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
          <h1 className="text-2xl font-bold font-serif text-slate-900">ECR Input Snapshots</h1>
          <p className="text-sm text-slate-500 mt-1">Capture metric values per customer per period. Each snapshot is immutable once scored.</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" /> Create Snapshot
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Total Snapshots</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{snapshots.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Customers Covered</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{new Set(snapshots.map(s => s.customerId)).size}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Active Metrics</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{activeMetrics.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Input Values</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{inputValues.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={customerFilter} onValueChange={setCustomerFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Filter by customer" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Customers</SelectItem>
            {customerIds.map(id => (
              <SelectItem key={id} value={id}>{ecrCustomerNames[id]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Snapshot Cards */}
      <div className="space-y-3">
        {filteredSnapshots.map(snap => {
          const isExpanded = expandedId === snap.id;
          const isEditing = editingSnapshotId === snap.id;
          const vals = inputValues.filter(v => v.snapshotId === snap.id);
          const score = getSnapshotScore(snap.id);
          const hasValues = vals.length > 0;

          return (
            <Card key={snap.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-4">
                {/* Header */}
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => { if (!isEditing) setExpandedId(isExpanded ? null : snap.id); }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Camera className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{ecrCustomerNames[snap.customerId] || snap.customerId}</h3>
                        <span className="text-xs text-slate-400">
                          {snap.periodStart} → {snap.periodEnd}
                        </span>
                        {score && (
                          <Badge variant="outline" className={`text-xs font-bold ${getGradeBg(score.grade)}`}>
                            {score.grade} ({score.totalScore.toFixed(1)})
                          </Badge>
                        )}
                        {!hasValues && (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-600 border-amber-200">No values</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" />{snap.createdBy}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(snap.createdAt).toLocaleDateString()}</span>
                        <span>{vals.length}/{activeMetrics.length} metrics filled</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditing && (
                      <Button variant="outline" size="sm" onClick={e => { e.stopPropagation(); handleStartEdit(snap.id); setExpandedId(snap.id); }}>
                        <Pencil className="w-3.5 h-3.5 mr-1" /> Edit Values
                      </Button>
                    )}
                    {!isEditing && (
                      isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded: Metric Values */}
                {(isExpanded || isEditing) && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    {isEditing && (
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleSpreadsheetUpload(snap.id)}>
                            <Upload className="w-3.5 h-3.5 mr-1" /> Upload Spreadsheet
                          </Button>
                          <span className="text-xs text-slate-400">Or enter values manually below</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => setEditingSnapshotId(null)}>
                            <X className="w-3.5 h-3.5 mr-1" /> Cancel
                          </Button>
                          <Button size="sm" onClick={() => handleSaveValues(snap.id)}>
                            <Check className="w-3.5 h-3.5 mr-1" /> Save Values
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="grid gap-2">
                      {/* Table Header */}
                      <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 rounded">
                        <div className="col-span-3">Metric</div>
                        <div className="col-span-1">Unit</div>
                        <div className="col-span-2">Value</div>
                        <div className="col-span-2">Source</div>
                        <div className="col-span-2">Reference</div>
                        <div className="col-span-2">Captured</div>
                      </div>

                      {activeMetrics.map(metric => {
                        const val = vals.find(v => v.metricId === metric.id);
                        const isConnectorFed = metric.defaultSourceMode === 'connector';

                        return (
                          <div key={metric.id} className="grid grid-cols-12 gap-2 px-3 py-2 items-center border-b border-slate-50 last:border-0">
                            <div className="col-span-3">
                              <p className="text-sm font-medium text-slate-700">{metric.displayName}</p>
                              <p className="text-xs text-slate-400 font-mono">{metric.metricKey}</p>
                            </div>
                            <div className="col-span-1">
                              <span className="text-xs text-slate-500">{metric.unit}</span>
                            </div>
                            <div className="col-span-2">
                              {isEditing ? (
                                <Input
                                  type="number"
                                  value={editValues[metric.id] ?? 0}
                                  onChange={e => setEditValues(prev => ({ ...prev, [metric.id]: Number(e.target.value) }))}
                                  min={metric.minValue}
                                  max={metric.maxValue}
                                  step={metric.unit === 'band' ? 1 : 0.1}
                                  className="h-8 text-sm"
                                />
                              ) : (
                                <span className="text-sm font-semibold text-slate-900">
                                  {val ? `${val.value}${metric.unit === '%' ? '%' : metric.unit === 'days' ? ' days' : ''}` : '—'}
                                </span>
                              )}
                            </div>
                            <div className="col-span-2">
                              {val ? (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${getSourceModeColor(val.sourceMode)}`}>
                                  {getSourceModeLabel(val.sourceMode)}
                                </span>
                              ) : isConnectorFed ? (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">Connector (Future)</span>
                              ) : (
                                <span className="text-xs text-slate-300">—</span>
                              )}
                            </div>
                            <div className="col-span-2">
                              <span className="text-xs text-slate-500 truncate block">{val?.sourceReference || '—'}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-xs text-slate-400">
                                {val ? `${val.capturedBy} · ${new Date(val.capturedAt).toLocaleDateString()}` : '—'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Score Preview */}
                    {score && !isEditing && (
                      <div className="mt-4 p-4 rounded-lg bg-slate-50 border">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider">Computed Score</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-3xl font-bold text-slate-900">{score.totalScore.toFixed(1)}</span>
                              <Badge variant="outline" className={`text-lg font-bold px-3 py-1 ${getGradeBg(score.grade)}`}>
                                Grade {score.grade}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-500">Confidence</p>
                            <p className="text-lg font-semibold text-slate-700">{score.confidenceScore}%</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredSnapshots.length === 0 && (
        <Card className="bg-slate-50">
          <CardContent className="py-12 text-center">
            <Database className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No snapshots found</p>
          </CardContent>
        </Card>
      )}

      {/* No AI Notice */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-amber-800 text-sm">
            <Shield className="w-4 h-4" />
            <span className="font-medium">Source Tracking:</span>
            <span className="text-amber-700">Every input value records its source (manual, spreadsheet, or connector). All inputs are auditable and reproducible.</span>
          </div>
        </CardContent>
      </Card>

      {/* Create Snapshot Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Create New Snapshot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Customer</Label>
              <Select value={newCustomerId} onValueChange={setNewCustomerId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {customerIds.map(id => (
                    <SelectItem key={id} value={id}>{ecrCustomerNames[id]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Period Start</Label>
                <Input type="date" value={newPeriodStart} onChange={e => setNewPeriodStart(e.target.value)} />
              </div>
              <div>
                <Label>Period End</Label>
                <Input type="date" value={newPeriodEnd} onChange={e => setNewPeriodEnd(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              After creating the snapshot, you can enter metric values manually or upload a spreadsheet.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateSnapshot}>Create Snapshot</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
