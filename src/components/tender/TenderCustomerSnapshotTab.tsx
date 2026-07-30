/**
 * TenderCustomerSnapshotTab - Identified Stage, Stage Task 2.
 *
 * Data sources: current tender workspace and users table.
 * Persistence: updateTenderProbability, updateTenderTeamMembers, updateTenderSowData.
 * Persistent state comes from the current tender workspace only.
 */

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { getTenderLocalCustomerLink } from "@/lib/tender-local-intelligence";
import { useUsers } from "@/hooks/useSupabase";
import {
  updateTenderProbability,
  updateTenderTeamMembers,
} from "@/lib/supabase-tender-actions";
import { toast } from "sonner";
import {
  AlertCircle,
  Building2,
  ClipboardList,
  FileText,
  Loader2,
  MapPin,
  Save,
  SlidersHorizontal,
  Target,
  UserCheck,
  Users as UsersIcon,
  UserX,
} from "lucide-react";
import ScopeOfWorkCapture from "./ScopeOfWorkCapture";
import {
  IdentifiedSectionCard,
  IdentifiedStageShell,
  type IdentifiedStageMetric,
  type IdentifiedSectionTab,
} from "./IdentifiedStageShared";

type SectionKey = "metadata" | "sow" | "ownership" | "strategic";

const SECTION_TABS: IdentifiedSectionTab<SectionKey>[] = [
  { key: "metadata", label: "Customer Metadata", icon: <Building2 className="w-3.5 h-3.5" /> },
  { key: "sow", label: "Scope of Work Capture", icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { key: "ownership", label: "Assigned Ownership", icon: <UsersIcon className="w-3.5 h-3.5" /> },
  { key: "strategic", label: "Strategic Context & Fit", icon: <Target className="w-3.5 h-3.5" /> },
];

interface Props {
  ws: TenderWorkspace;
  reload?: () => void;
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
}

export default function TenderCustomerSnapshotTab({ ws, reload, onOpenDocuments, onOpenGlobalIntel }: Props) {
  const { data: systemUsers, loading: usersLoading } = useUsers();
  const t = ws.tender;
  const customerLink = getTenderLocalCustomerLink(ws);

  const [activeSection, setActiveSection] = useState<SectionKey>("metadata");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

  const [probability, setProbability] = useState<number>(t.probabilityPercent ?? 0);
  const [probDirty, setProbDirty] = useState(false);
  const [probSaving, setProbSaving] = useState(false);
  const prevProb = useRef(t.probabilityPercent ?? 0);

  useEffect(() => {
    if (!probDirty) {
      setProbability(t.probabilityPercent ?? 0);
      prevProb.current = t.probabilityPercent ?? 0;
    }
  }, [t.probabilityPercent, probDirty]);

  const handleProbChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setProbability(Number(e.target.value));
    setProbDirty(true);
  }, []);

  const saveProb = useCallback(async () => {
    setProbSaving(true);
    try {
      const r = await updateTenderProbability(t.id, prevProb.current, probability, "Manual update from Customer Snapshot");
      if (r.success) {
        prevProb.current = probability;
        setProbDirty(false);
        toast.success(`Win probability updated to ${probability}%`);
        reload?.();
      } else {
        toast.error("Failed to save probability", { description: r.error });
      }
    } catch (error: any) {
      toast.error("Failed to save probability", { description: error?.message || "Unexpected save error." });
    } finally {
      setProbSaving(false);
    }
  }, [t.id, probability, reload]);

  const [selectedMembers, setSelectedMembers] = useState<string[]>(t.assignedTeamMembers ?? []);
  const [selectedOwner, setSelectedOwner] = useState<string>(t.assignedOwner || "");
  const [ownerDirty, setOwnerDirty] = useState(false);
  const [ownerSaving, setOwnerSaving] = useState(false);

  useEffect(() => {
    if (!ownerDirty) {
      setSelectedMembers(t.assignedTeamMembers ?? []);
      setSelectedOwner(t.assignedOwner || "");
    }
  }, [t.assignedTeamMembers, t.assignedOwner, ownerDirty]);

  const toggleUser = useCallback((name: string) => {
    setSelectedMembers(prev => prev.includes(name) ? prev.filter(user => user !== name) : [...prev, name]);
    setOwnerDirty(true);
  }, []);

  const setLead = useCallback((name: string) => {
    setSelectedOwner(name);
    setSelectedMembers(prev => prev.includes(name) ? prev : [...prev, name]);
    setOwnerDirty(true);
  }, []);

  const saveOwnership = useCallback(async () => {
    setOwnerSaving(true);
    try {
      const r = await updateTenderTeamMembers(t.id, selectedOwner, selectedMembers, "Updated from Customer Snapshot");
      if (r.success) {
        setOwnerDirty(false);
        toast.success("Ownership updated");
        reload?.();
      } else {
        toast.error("Failed to save ownership", { description: r.error });
      }
    } catch (error: any) {
      toast.error("Failed to save ownership", { description: error?.message || "Unexpected save error." });
    } finally {
      setOwnerSaving(false);
    }
  }, [t.id, selectedOwner, selectedMembers, reload]);

  const activeUsers = (systemUsers || []).filter((u: any) => u.status !== "inactive");
  const probColor = probability >= 60 ? "text-emerald-700" : probability >= 30 ? "text-amber-700" : probability > 0 ? "text-red-600" : "text-slate-500";
  const displayRegion = customerLink.region || t.region || "Not available";

  const sowData = (t.sowData || {}) as any;
  const sowSections = [
    sowData.scope_summary,
    Array.isArray(sowData.service_lines) && sowData.service_lines.length > 0 ? sowData.service_lines : null,
    sowData.warehousing,
    Array.isArray(sowData.transport_lanes) && sowData.transport_lanes.length > 0 ? sowData.transport_lanes : null,
    Array.isArray(sowData.technology) && sowData.technology.length > 0 ? sowData.technology : null,
    Array.isArray(sowData.sla_kpis) && sowData.sla_kpis.length > 0 ? sowData.sla_kpis : null,
    Array.isArray(sowData.sites) && sowData.sites.length > 0 ? sowData.sites : null,
    Array.isArray(sowData.compliance) && sowData.compliance.length > 0 ? sowData.compliance : null,
    Array.isArray(sowData.clarifications) && sowData.clarifications.length > 0 ? sowData.clarifications : null,
    sowData.internal_notes,
  ];
  const sowFilled = sowSections.filter(value => value !== null && value !== undefined && (typeof value !== "string" || value.trim().length > 0)).length;
  const intelMetrics: IdentifiedStageMetric[] = [
    { label: "Customer", value: t.customerName || "Not captured" },
    { label: "Region", value: displayRegion },
    { label: "SOW Sections", value: `${sowFilled}/10 captured` },
    { label: "Owner", value: selectedOwner || "Unassigned" },
    { label: "Win Probability", value: `${probability}%` },
  ];

  return (
    <IdentifiedStageShell
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      sectionTabs={SECTION_TABS}
      stageIntelOpen={stageIntelOpen}
      onStageIntelOpenChange={setStageIntelOpen}
      metrics={intelMetrics}
      onOpenDocuments={onOpenDocuments}
      onOpenGlobalIntel={onOpenGlobalIntel}
      unsaved={ownerDirty || probDirty}
    >
      <IdentifiedSectionCard
        title="Customer Metadata"
        icon={<Building2 className="w-3.5 h-3.5 text-[#075eea]" />}
        badge="Tender record"
        hidden={activeSection !== "metadata"}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Customer Name</p>
            <div className="text-sm font-medium">{t.customerName || "Unknown"}</div>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tender Region</p>
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              <Badge variant="outline" className="bg-slate-50 text-[10px] text-slate-600">{displayRegion}</Badge>
              <span className="text-[9px] text-muted-foreground/50">Business geography only</span>
            </div>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Customer Link</p>
            <div className="text-sm">{customerLink.matchStatusLabel}</div>
          </div>
        </div>
      </IdentifiedSectionCard>

      <div className={activeSection !== "sow" ? "hidden" : ""}>
        <ScopeOfWorkCapture ws={ws} reload={reload} />
      </div>

      <IdentifiedSectionCard
        title="Assigned Ownership"
        icon={<UsersIcon className="w-3.5 h-3.5 text-[#075eea]" />}
        badge={ownerDirty ? "Unsaved" : undefined}
        hidden={activeSection !== "ownership"}
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm font-medium">{selectedOwner || "Unassigned"}</span>
          <span className="text-[10px] text-muted-foreground">(Lead)</span>
        </div>
        {usersLoading ? (
          <div className="flex items-center gap-1.5 py-2">
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Loading users...</span>
          </div>
        ) : activeUsers.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-2.5">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <p className="text-[10px] text-amber-700">No users available.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {activeUsers.map((u: any) => {
                const isSelected = selectedMembers.includes(u.name);
                const isLead = selectedOwner === u.name;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleUser(u.name)}
                    onDoubleClick={() => setLead(u.name)}
                    className={`inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-all ${
                      isLead
                        ? "border-[#075eea]/30 bg-[#075eea]/15 text-[#064fc4] ring-1 ring-[#075eea]/30"
                        : isSelected
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                    title={`${u.name}${u.role ? ` - ${u.role.replace(/_/g, " ")}` : ""}\nClick to select - Double-click to set as lead`}
                  >
                    {isLead ? <UserCheck className="h-3 w-3" /> : isSelected ? <UserX className="h-3 w-3" /> : null}
                    {u.name}
                    {u.role && <span className={`text-[9px] ${isSelected ? "opacity-70" : "opacity-50"}`}>{u.role.replace(/_/g, " ")}</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-[9px] text-muted-foreground/60">Click to select - Double-click to set lead</p>
          </div>
        )}
        {ownerDirty && (
          <Button size="sm" className="mt-2 h-8 gap-1.5 text-xs" onClick={saveOwnership} disabled={ownerSaving}>
            {ownerSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Ownership
          </Button>
        )}
      </IdentifiedSectionCard>

      <IdentifiedSectionCard
        title="Strategic Context & Fit"
        icon={<Target className="w-3.5 h-3.5 text-[#075eea]" />}
        hidden={activeSection !== "strategic"}
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-[#075eea]" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Initial Win Probability</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-end gap-2">
                <span className={`font-mono text-3xl font-bold tabular-nums ${probColor}`}>{probability}%</span>
                {probDirty && <Badge variant="outline" className="mb-1 border-amber-300 bg-amber-50 text-[9px] text-amber-700">Unsaved</Badge>}
              </div>
              <div className="space-y-1.5">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={probability}
                  onChange={handleProbChange}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full accent-[#075eea]"
                  style={{ background: `linear-gradient(to right, ${probability >= 60 ? "#059669" : probability >= 30 ? "#d97706" : "#dc2626"} ${probability}%, #e2e8f0 ${probability}%)` }}
                />
                <div className="flex justify-between font-mono text-[9px] text-muted-foreground/50">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>
              </div>
              {probDirty && (
                <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={saveProb} disabled={probSaving}>
                  {probSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save Probability
                </Button>
              )}
              <p className="text-[10px] text-muted-foreground">
                Saved to <code className="rounded bg-muted px-1 font-mono text-[9px]">tenders.probability_percent</code>. Advisory only.
              </p>
            </div>
          </div>

          <div>
            <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <FileText className="h-3.5 w-3.5" /> Intake Notes
            </p>
            <div className="min-h-[60px] rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              {t.notes ? t.notes : <span className="italic text-muted-foreground">Strategic notes not captured yet.</span>}
            </div>
          </div>
        </div>
      </IdentifiedSectionCard>
    </IdentifiedStageShell>
  );
}
