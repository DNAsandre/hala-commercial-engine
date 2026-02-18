/**
 * ECR RULE SET SCREEN — Admin
 * Design: Swiss Precision Instrument — Deep navy + warm white
 * Create/edit rule sets, adjust weights with 100% validation,
 * activate rule sets, view version history.
 */
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import {
  Plus, CheckCircle2, Archive, FileEdit, Scale, AlertTriangle,
  Clock, User, ChevronDown, ChevronUp, Shield, Layers, Lock
} from 'lucide-react';
import {
  mockRuleSets, mockRuleWeights, mockMetrics,
  getTotalWeight, getRuleSetWeights,
  type EcrRuleSet, type EcrRuleWeight, type RuleSetStatus
} from '@/lib/ecr';

const statusConfig: Record<RuleSetStatus, { label: string; color: string; icon: React.ReactNode }> = {
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  draft: { label: 'Draft', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <FileEdit className="w-3.5 h-3.5" /> },
  archived: { label: 'Archived', color: 'bg-slate-100 text-slate-500 border-slate-200', icon: <Archive className="w-3.5 h-3.5" /> },
  locked: { label: 'Locked', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
};

export default function EcrRuleSets() {
  const [ruleSets, setRuleSets] = useState<EcrRuleSet[]>(mockRuleSets);
  const [weights, setWeights] = useState<EcrRuleWeight[]>(mockRuleWeights);
  const [expandedId, setExpandedId] = useState<string | null>('rs-2'); // Active one expanded by default
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const activeMetrics = mockMetrics.filter(m => m.active);

  const handleCreateRuleSet = () => {
    if (!newName) {
      toast.error('Rule set name is required');
      return;
    }
    const maxVersion = Math.max(...ruleSets.map(rs => rs.versionNumber), 0);
    const newRuleSet: EcrRuleSet = {
      id: `rs-${Date.now()}`,
      versionNumber: maxVersion + 1,
      name: newName,
      description: newDesc,
      status: 'draft',
      createdBy: 'Amin Al-Rashid',
      createdAt: new Date().toISOString(),
    };
    // Create default weights from active metrics
    const newWeights: EcrRuleWeight[] = activeMetrics.map((m, i) => ({
      id: `rw-new-${Date.now()}-${i}`,
      ruleSetId: newRuleSet.id,
      metricId: m.id,
      weight: m.defaultWeight,
      createdAt: new Date().toISOString(),
    }));
    setRuleSets(prev => [...prev, newRuleSet]);
    setWeights(prev => [...prev, ...newWeights]);
    setShowCreateDialog(false);
    setNewName('');
    setNewDesc('');
    setExpandedId(newRuleSet.id);
    toast.success(`Rule set v${newRuleSet.versionNumber} created`);
  };

  const handleActivate = (id: string) => {
    const ruleSetWeights = weights.filter(w => w.ruleSetId === id);
    const total = ruleSetWeights.reduce((sum, w) => sum + w.weight, 0);
    if (total !== 100) {
      toast.error(`Cannot activate: weights total ${total}%, must be exactly 100%`);
      return;
    }
    setRuleSets(prev => prev.map(rs => ({
      ...rs,
      status: rs.id === id ? 'active' : (rs.status === 'active' ? 'archived' : rs.status),
    })));
    toast.success('Rule set activated. Previous active set archived.');
  };

  const handleWeightChange = (ruleSetId: string, metricId: string, newWeight: number) => {
    setWeights(prev => prev.map(w =>
      w.ruleSetId === ruleSetId && w.metricId === metricId
        ? { ...w, weight: newWeight }
        : w
    ));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif text-slate-900">ECR Rule Sets</h1>
          <p className="text-sm text-slate-500 mt-1">Versioned scoring formulas. Weights must total 100%. Only one rule set can be active.</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" /> Create Rule Set
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Total Versions</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{ruleSets.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Active Rule Set</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              {ruleSets.find(rs => rs.status === 'active')?.name || 'None'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Active Metrics</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{activeMetrics.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Rule Set Cards */}
      <div className="space-y-4">
        {ruleSets.sort((a, b) => b.versionNumber - a.versionNumber).map(rs => {
          const isExpanded = expandedId === rs.id;
          const rsWeights = weights.filter(w => w.ruleSetId === rs.id);
          const totalW = rsWeights.reduce((sum, w) => sum + w.weight, 0);
          const isValid = totalW === 100;
          const status = statusConfig[rs.status];

          return (
            <Card key={rs.id} className={`${rs.status === 'archived' ? 'opacity-70' : ''} transition-shadow hover:shadow-sm`}>
              <CardContent className="py-4">
                {/* Header Row */}
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : rs.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${rs.status === 'active' ? 'bg-emerald-100' : rs.status === 'draft' ? 'bg-amber-100' : 'bg-slate-100'}`}>
                      <Layers className={`w-5 h-5 ${rs.status === 'active' ? 'text-emerald-600' : rs.status === 'draft' ? 'text-amber-600' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{rs.name}</h3>
                        <Badge variant="outline" className={`text-xs ${status.color}`}>
                          {status.icon}
                          <span className="ml-1">{status.label}</span>
                        </Badge>
                        <span className="text-xs text-slate-400">v{rs.versionNumber}</span>
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">{rs.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right text-xs text-slate-400">
                      <div className="flex items-center gap-1"><User className="w-3 h-3" />{rs.createdBy}</div>
                      <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(rs.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div className={`text-sm font-semibold px-3 py-1 rounded ${isValid ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {totalW}%
                    </div>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                </div>

                {/* Expanded: Weight Editor */}
                {isExpanded && (
                  <div className="mt-6 pt-4 border-t space-y-4">
                    {/* Weight Validation Bar */}
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-slate-600">Total Weight Allocation</span>
                          <span className={`text-sm font-bold ${isValid ? 'text-emerald-600' : totalW > 100 ? 'text-red-600' : 'text-amber-600'}`}>
                            {totalW}% / 100%
                          </span>
                        </div>
                        <Progress value={Math.min(totalW, 100)} className={`h-2 ${totalW > 100 ? '[&>div]:bg-red-500' : isValid ? '[&>div]:bg-emerald-500' : '[&>div]:bg-amber-500'}`} />
                      </div>
                      {!isValid && (
                        <div className="flex items-center gap-1 text-xs text-amber-600">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {totalW > 100 ? `${totalW - 100}% over` : `${100 - totalW}% remaining`}
                        </div>
                      )}
                    </div>

                    {/* Metric Weights */}
                    <div className="space-y-3">
                      {activeMetrics.map(metric => {
                        const rw = rsWeights.find(w => w.metricId === metric.id);
                        const weight = rw?.weight ?? 0;
                        const isLocked = rs.status === 'archived' || rs.status === 'active';

                        return (
                          <div key={metric.id} className="flex items-center gap-4 p-3 rounded-lg bg-slate-50/50 border border-slate-100">
                            <div className="w-48 min-w-48">
                              <p className="text-sm font-medium text-slate-700">{metric.displayName}</p>
                              <p className="text-xs text-slate-400">{metric.unit}</p>
                            </div>
                            <div className="flex-1">
                              <Slider
                                value={[weight]}
                                onValueChange={([v]) => {
                                  if (!isLocked) handleWeightChange(rs.id, metric.id, v);
                                }}
                                max={50}
                                step={1}
                                disabled={isLocked}
                                className="w-full"
                              />
                            </div>
                            <div className="w-20 text-right">
                              {isLocked ? (
                                <span className="text-sm font-semibold text-slate-600">{weight}%</span>
                              ) : (
                                <Input
                                  type="number"
                                  value={weight}
                                  onChange={e => handleWeightChange(rs.id, metric.id, Number(e.target.value))}
                                  min={0}
                                  max={100}
                                  className="w-20 text-right text-sm h-8"
                                />
                              )}
                            </div>
                            {isLocked && <Lock className="w-3.5 h-3.5 text-slate-300" />}
                          </div>
                        );
                      })}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="text-xs text-slate-400">
                        {rs.status === 'active' && 'This is the active rule set. Weights are locked.'}
                        {rs.status === 'archived' && 'Archived rule sets are read-only.'}
                        {rs.status === 'draft' && 'Adjust weights and activate when ready.'}
                      </div>
                      {rs.status === 'draft' && (
                        <Button
                          onClick={() => handleActivate(rs.id)}
                          disabled={!isValid}
                          className={isValid ? '' : 'opacity-50'}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Activate Rule Set
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* No AI Notice */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-amber-800 text-sm">
            <Shield className="w-4 h-4" />
            <span className="font-medium">Deterministic:</span>
            <span className="text-amber-700">Rule sets define the exact formula. Score = Σ(normalized_value × weight / 100). No AI involvement in weight selection or score computation.</span>
          </div>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Create New Rule Set</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input placeholder="e.g., ECR Enhanced v4" value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea placeholder="Describe the changes in this version..." value={newDesc} onChange={e => setNewDesc(e.target.value)} />
            </div>
            <p className="text-xs text-slate-500">
              New rule sets start in Draft status with default weights from the metric dictionary.
              Adjust weights and activate when ready. Activating will archive the current active set.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateRuleSet}>Create Rule Set</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
