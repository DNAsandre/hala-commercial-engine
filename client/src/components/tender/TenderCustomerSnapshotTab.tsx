/**
 * TenderCustomerSnapshotTab — Customer Metadata + Scope of Work Capture
 *
 * Architecture:
 * 1. Customer Metadata — auto-filled from CRM (read-only)
 * 2. Scope of Work Capture — structured SOW capture module (ScopeOfWorkCapture)
 * 3. Assigned Ownership — team/lead assignment (manual)
 * 4. Strategic Context & Fit — probability, intake notes
 *
 * Data sources: tenders table, commercial_opportunities, users table
 * Persistence: updateTenderProbability, updateTenderTeamMembers, updateTenderSowData
 * No localStorage. No fake data.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { useCommercialOsData } from "@/hooks/useCommercialOsData";
import { useUsers } from "@/hooks/useSupabase";
import {
  updateTenderProbability,
  updateTenderTeamMembers,
} from "@/lib/supabase-tender-actions";
import { toast } from "sonner";
import {
  Loader2, Users as UsersIcon, Building2, MapPin, Target, FileText,
  Save, AlertCircle, SlidersHorizontal, UserCheck, UserX,
} from "lucide-react";
import ScopeOfWorkCapture from "./ScopeOfWorkCapture";

interface Props { ws: TenderWorkspace; reload?: () => void; }

export default function TenderCustomerSnapshotTab({ ws, reload }: Props) {
  const { data: commercialData, loading } = useCommercialOsData();
  const { data: systemUsers, loading: usersLoading } = useUsers();
  const t = ws.tender;

  // ── Win Probability ──────────────────────────────────────────
  const [probability, setProbability] = useState<number>(t.probabilityPercent ?? 0);
  const [probDirty, setProbDirty] = useState(false);
  const [probSaving, setProbSaving] = useState(false);
  const prevProb = useRef(t.probabilityPercent ?? 0);

  useEffect(() => { if (!probDirty) { setProbability(t.probabilityPercent ?? 0); prevProb.current = t.probabilityPercent ?? 0; } }, [t.probabilityPercent, probDirty]);
  const handleProbChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { setProbability(Number(e.target.value)); setProbDirty(true); }, []);
  const saveProb = useCallback(async () => {
    setProbSaving(true);
    const r = await updateTenderProbability(t.id, prevProb.current, probability, "Manual update from Customer Snapshot");
    setProbSaving(false);
    if (r.success) { prevProb.current = probability; setProbDirty(false); toast.success(`Win probability updated to ${probability}%`); reload?.(); }
    else toast.error("Failed to save probability", { description: r.error });
  }, [t.id, probability, reload]);

  // ── Ownership ────────────────────────────────────────────────
  const [selectedMembers, setSelectedMembers] = useState<string[]>(t.assignedTeamMembers ?? []);
  const [selectedOwner, setSelectedOwner] = useState<string>(t.assignedOwner || "");
  const [ownerDirty, setOwnerDirty] = useState(false);
  const [ownerSaving, setOwnerSaving] = useState(false);

  useEffect(() => { if (!ownerDirty) { setSelectedMembers(t.assignedTeamMembers ?? []); setSelectedOwner(t.assignedOwner || ""); } }, [t.assignedTeamMembers, t.assignedOwner, ownerDirty]);
  const toggleUser = useCallback((n: string) => { setSelectedMembers(p => p.includes(n) ? p.filter(x => x !== n) : [...p, n]); setOwnerDirty(true); }, []);
  const setLead = useCallback((n: string) => { setSelectedOwner(n); setSelectedMembers(p => p.includes(n) ? p : [...p, n]); setOwnerDirty(true); }, []);
  const saveOwnership = useCallback(async () => {
    setOwnerSaving(true);
    const r = await updateTenderTeamMembers(t.id, selectedOwner, selectedMembers, "Updated from Customer Snapshot");
    setOwnerSaving(false);
    if (r.success) { setOwnerDirty(false); toast.success("Ownership updated"); reload?.(); }
    else toast.error("Failed to save ownership", { description: r.error });
  }, [t.id, selectedOwner, selectedMembers, reload]);


  if (loading) return (
    <div className="flex items-center justify-center p-8 text-muted-foreground gap-2">
      <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Loading...</span>
    </div>
  );

  const linkedOpp = commercialData.opportunities.find(
    o => o.customerName.toLowerCase() === t.customerName.toLowerCase() || o.opportunityName.toLowerCase().includes(t.title.toLowerCase())
  );
  const activeUsers = (systemUsers || []).filter((u: any) => u.status !== "inactive");
  const probColor = probability >= 60 ? "text-emerald-700" : probability >= 30 ? "text-amber-700" : probability > 0 ? "text-red-600" : "text-slate-500";

  return (
    <div className="space-y-4">

      {/* ═══ SECTION A — Customer Metadata (Auto-filled, Read-only) ═══ */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            Customer Metadata
            <Badge variant="outline" className="text-[9px] bg-slate-50 text-slate-500 ml-auto">Auto-filled from CRM</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Customer Name</p>
            <div className="text-sm font-medium">{t.customerName || "Unknown"}</div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">CRM Region</p>
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600">{linkedOpp?.region || t.region || "Not available"}</Badge>
              <span className="text-[9px] text-muted-foreground/50">Business geography only</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Existing Account</p>
            <div className="text-sm">{linkedOpp ? "Yes — linked opportunity" : "Not linked"}</div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ SECTION B — Scope of Work Capture ═══ */}
      <ScopeOfWorkCapture ws={ws} reload={reload} />

      {/* ═══ SECTION C — Assigned Ownership ═══ */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <UsersIcon className="w-4 h-4 text-indigo-600" />
            Assigned Ownership
            {ownerDirty && <Badge variant="outline" className="text-[9px] border-amber-300 bg-amber-50 text-amber-700">Unsaved</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium">{selectedOwner || "Unassigned"}</span>
            <span className="text-[10px] text-muted-foreground">(Lead)</span>
          </div>
          {usersLoading ? (
            <div className="flex items-center gap-1.5 py-2"><Loader2 className="w-3 h-3 animate-spin text-muted-foreground" /><span className="text-xs text-muted-foreground">Loading users...</span></div>
          ) : activeUsers.length === 0 ? (
            <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50"><div className="flex items-start gap-2"><AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" /><p className="text-[10px] text-amber-700">No users available.</p></div></div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {activeUsers.map((u: any) => {
                  const isSel = selectedMembers.includes(u.name); const isLd = selectedOwner === u.name;
                  return (
                    <button key={u.id} onClick={() => toggleUser(u.name)} onDoubleClick={() => setLead(u.name)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all cursor-pointer border ${isLd ? "bg-indigo-100 text-indigo-800 border-indigo-300 ring-1 ring-indigo-400/30" : isSel ? "bg-emerald-50 text-emerald-800 border-emerald-300" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}
                      title={`${u.name}${u.role ? ` — ${u.role.replace(/_/g, " ")}` : ""}\nClick to select · Double-click to set as lead`}>
                      {isLd ? <UserCheck className="w-3 h-3" /> : isSel ? <UserX className="w-3 h-3" /> : null}
                      {u.name}
                      {u.role && <span className={`text-[9px] ${isSel ? "opacity-70" : "opacity-50"}`}>{u.role.replace(/_/g, " ")}</span>}
                    </button>
                  );
                })}
              </div>
              <p className="text-[9px] text-muted-foreground/60">Click to select · Double-click to set lead</p>
            </div>
          )}
          {ownerDirty && (
            <Button size="sm" className="gap-1.5 h-8 text-xs mt-2" onClick={saveOwnership} disabled={ownerSaving}>
              {ownerSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Ownership
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ═══ SECTION D — Strategic Context & Fit ═══ */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Target className="w-4 h-4 text-indigo-600" />
            Strategic Context & Fit
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid gap-6 md:grid-cols-2">
          {/* Win Probability */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Initial Win Probability</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-end gap-2">
                <span className={`text-3xl font-bold font-mono tabular-nums ${probColor}`}>{probability}%</span>
                {probDirty && <Badge variant="outline" className="text-[9px] border-amber-300 bg-amber-50 text-amber-700 mb-1">Unsaved</Badge>}
              </div>
              <div className="space-y-1.5">
                <input type="range" min={0} max={100} step={5} value={probability} onChange={handleProbChange}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer accent-indigo-600"
                  style={{ background: `linear-gradient(to right, ${probability >= 60 ? '#059669' : probability >= 30 ? '#d97706' : '#dc2626'} ${probability}%, #e2e8f0 ${probability}%)` }} />
                <div className="flex justify-between text-[9px] text-muted-foreground/50 font-mono"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
              </div>
              {probDirty && (
                <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={saveProb} disabled={probSaving}>
                  {probSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Probability
                </Button>
              )}
              <p className="text-[10px] text-muted-foreground">Saved to <code className="font-mono bg-muted px-1 rounded text-[9px]">tenders.probability_percent</code>. Advisory only.</p>
            </div>
          </div>
          {/* Intake Notes */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Intake Notes
            </p>
            <div className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200 min-h-[60px]">
              {t.notes ? t.notes : <span className="italic text-muted-foreground">Strategic notes not captured yet.</span>}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
