/**
 * PipelineTicketCard + TicketPreviewPopup
 * Compact Kanban card and executive preview dialog.
 */
import { useState, useRef } from "react";
import {
  User, AlertTriangle, ExternalLink,
  CheckCircle2, Minus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useLocation } from "wouter";
import type { PipelineTicket, CrmStageLabel } from "@/lib/pipeline-tickets";

// ═══════════════════════════════════════════
// PIPELINE TICKET CARD (Kanban)
// ═══════════════════════════════════════════

interface CardProps {
  ticket: PipelineTicket;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
}

function formatSar(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

export function PipelineTicketCard({ ticket: t, onDragStart, onDragEnd, isDragging }: CardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const isTerminal = ["Closed Won", "Closed Lost", "Discontinued", "Go Live"].includes(t.crmStage);
  const didDrag = useRef(false);

  return (
    <>
      <div
        className={`
          group rounded-lg border bg-card shadow-sm hover:shadow-md cursor-pointer
          transition-all duration-150
          ${isDragging ? "opacity-40 scale-95 ring-2 ring-primary/30" : ""}
          ${t.riskLevel === "red" ? "border-l-2 border-l-red-400" : t.riskLevel === "amber" ? "border-l-2 border-l-amber-400" : "border-border"}
        `}
        draggable={!isTerminal}
        onMouseDown={() => { didDrag.current = false; }}
        onDragStart={e => { didDrag.current = true; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", t.id); onDragStart?.(); }}
        onDragEnd={onDragEnd}
        onMouseUp={() => { setTimeout(() => { if (!didDrag.current) setPreviewOpen(true); }, 0); }}
      >
        <div className="p-2.5 space-y-1.5">
          {/* Row 1: Customer + Type badge */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold truncate flex-1">{t.customerName}</span>
            <Badge variant="outline" className={`text-[8px] h-4 px-1 shrink-0 ${t.ticketType === "tender" ? "border-red-300 text-red-700 bg-red-50" : "border-[#075eea]/30 text-[#075eea] bg-[#075eea]/10"}`}>
              {t.ticketType === "tender" ? "Tender" : "Proposal"}
            </Badge>
            {t.lineageStatus && t.lineageStatus !== "verified" && (
              <Badge variant="outline" className="text-[8px] h-4 px-1 shrink-0 border-amber-300 text-amber-700 bg-amber-50">
                Source Review
              </Badge>
            )}
          </div>

          {/* Row 2: Opportunity title */}
          <p className="text-[9px] text-muted-foreground truncate">{t.opportunityName}</p>

          {/* Row 3: SAR + GP% */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-medium">{formatSar(t.sarValue)}</span>
            <span className={`text-[10px] font-mono font-bold ${t.gpPct >= 22 ? "text-emerald-600" : t.gpPct >= 10 ? "text-amber-600" : "text-red-600"}`}>
              {t.gpPct > 0 ? `${t.gpPct}%` : "—"}
            </span>
          </div>

          {/* Row 4: Risk + Internal stage */}
          <div className="flex items-center gap-1.5">
            {t.riskLevel !== "green" && (
              <Badge variant="outline" className={`text-[8px] h-3.5 px-1 ${t.riskLevel === "red" ? "border-red-300 text-red-700 bg-red-50" : "border-amber-300 text-amber-700 bg-amber-50"}`}>
                {t.riskLabel}
              </Badge>
            )}
            {t.internalStage && <Badge variant="outline" className="text-[8px] h-3.5 px-1 border-border">{t.internalStage}</Badge>}
          </div>

          {/* Row 5: Next action */}
          {t.nextAction && <p className="text-[8px] text-[#075eea] font-medium truncate">→ {t.nextAction}</p>}

          {/* Footer: Owner + Region + Days */}
          <div className="flex items-center justify-between pt-1 border-t border-border/40">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center">
                <span className="text-[7px] font-bold text-muted-foreground">{t.ownerInitials}</span>
              </div>
              <span className="text-[9px] text-muted-foreground">{t.region}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-[9px] ${t.daysInStage > 14 ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                {t.daysInStage}d
              </span>
              {t.syncStatus === "synced" && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Synced" />}
            </div>
          </div>
        </div>
      </div>

      {/* Preview Popup */}
      <TicketPreviewPopup ticket={t} open={previewOpen} onOpenChange={setPreviewOpen} />
    </>
  );
}

// ═══════════════════════════════════════════
// TICKET PREVIEW POPUP
// ═══════════════════════════════════════════

function GaugeMini({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-400";
  const textColor = pct >= 70 ? "text-emerald-600" : pct >= 40 ? "text-amber-600" : "text-red-500";
  return (
    <div className="rounded-lg border border-border p-4 bg-muted/10">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`text-sm font-bold ${textColor}`}>{Math.round(pct)}%</span>
      </div>
    </div>
  );
}

function StatusChip({ label, status }: { label: string; status: string }) {
  const isActive = status !== "—" && status !== "";
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        {isActive ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Minus className="w-4 h-4 text-muted-foreground/30" />}
        <span className={`text-xs font-medium ${isActive ? "" : "text-muted-foreground/50"}`}>{status}</span>
      </div>
    </div>
  );
}

function TicketPreviewPopup({ ticket: t, open, onOpenChange }: { ticket: PipelineTicket; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [, navigate] = useLocation();
  const marginHealth = t.gpPct >= 22 ? 85 : t.gpPct >= 10 ? 50 : 15;
  const timePressure = t.daysInStage <= 7 ? 80 : t.daysInStage <= 14 ? 50 : 20;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 gap-0 max-h-[90vh] overflow-y-auto">
        <DialogTitle className="sr-only">
          {t.ticketType === "tender" ? "Tender" : "Proposal"} Opportunity — {t.customerName}
        </DialogTitle>
        {/* Header */}
        <div className="px-8 py-5 border-b border-border bg-muted/20 sticky top-0 z-10">
          {/* Opportunity Type Heading */}
          <div className="flex items-center gap-2 mb-3">
            {t.ticketType === "tender" ? (
              <span className="text-xs font-bold uppercase tracking-widest text-red-600">Tender Opportunity</span>
            ) : (
              <span className="text-xs font-bold uppercase tracking-widest text-[#075eea]">Proposal Opportunity</span>
            )}
          </div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xl font-semibold">{t.customerName}</span>
            <Badge variant="outline" className={`text-xs px-2 py-0.5 ${t.ticketType === "tender" ? "border-red-300 text-red-700 bg-red-50" : "border-[#075eea]/30 text-[#075eea] bg-[#075eea]/10"}`}>
              {t.ticketType === "tender" ? "Tender" : "Proposal"}
            </Badge>
            {t.syncStatus === "synced" && <Badge variant="outline" className="text-xs px-2 py-0.5 border-emerald-300 text-emerald-700 bg-emerald-50">Synced</Badge>}
            {t.lineageStatus && t.lineageStatus !== "verified" && (
              <Badge variant="outline" className="text-xs px-2 py-0.5 border-amber-300 text-amber-700 bg-amber-50">
                Source Review
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{t.opportunityName}</p>
          <div className="flex items-center gap-4 mt-3 text-xs">
            <span className="text-muted-foreground">CRM: <strong className="text-foreground">{t.crmStage}</strong></span>
            <span className="text-muted-foreground/30">|</span>
            <span className="text-muted-foreground">Internal: <strong className="text-foreground">{t.internalStage}</strong></span>
            <span className="text-muted-foreground/30">|</span>
            <span className="text-muted-foreground flex items-center gap-1.5"><User className="w-4 h-4" />{t.owner}</span>
          </div>
        </div>

        {/* Executive Strip — only for proposals with real data */}
        {t.ticketType === "proposal" ? (
          <div className="px-8 py-5 border-b border-border">
            <div className="grid grid-cols-3 gap-4">
              <GaugeMini label="Margin Health" value={marginHealth} />
              <GaugeMini label="Time Pressure" value={timePressure} />
              <GaugeMini label="Readiness" value={t.probabilityPct} />
            </div>
          </div>
        ) : (
          <div className="px-8 py-4 border-b border-border">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Executive KPIs</p>
            <p className="text-xs text-muted-foreground/60">Not available — tender KPIs are not calculated without approved data sources.</p>
          </div>
        )}

        {/* Key Facts */}
        <div className="px-8 py-5 border-b border-border">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Key Facts</p>
          <div className="grid grid-cols-3 gap-x-8 gap-y-3">
            {[
              { l: "SAR Value", v: `SAR ${t.sarValue.toLocaleString()}` },
              { l: "GP%", v: t.gpPct > 0 ? `${t.gpPct}%` : "—" },
              { l: "Region", v: t.region || "—" },
              { l: "Service", v: t.serviceType },
              { l: "Pallets", v: t.volumePallets > 0 ? t.volumePallets.toLocaleString() : "—" },
              { l: "Expected Close", v: t.goLiveDate || "—" },
              { l: "Next Action", v: t.nextAction },
              { l: "Probability", v: `${t.probabilityPct}%` },
              { l: "Days in Stage", v: `${t.daysInStage}d` },
            ].map(f => (
              <div key={f.l} className="flex justify-between">
                <span className="text-xs text-muted-foreground">{f.l}</span>
                <span className="text-xs font-medium">{f.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Snapshot + Document Snapshot */}
        <div className="px-8 py-5 border-b border-border grid grid-cols-2 gap-8">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Risk Snapshot</p>
            {t.flags.length === 0 && <p className="text-sm text-muted-foreground/50">No active risks</p>}
            {t.flags.slice(0, 3).map((f, i) => (
              <div key={i} className="flex items-start gap-2 mb-2">
                <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${f.severity === "critical" || f.severity === "red" ? "text-red-500" : "text-amber-500"}`} />
                <span className="text-xs text-foreground/80">{f.message}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Documents</p>
            {t.ticketType === "proposal" ? (
              <>
                <StatusChip label="Quote" status={t.quoteStatus} />
                <StatusChip label="Proposal" status={t.proposalStatus} />
                <StatusChip label="SLA" status={t.slaStatus} />
                <StatusChip label="Contract" status={t.contractStatus} />
              </>
            ) : (
              <p className="text-xs text-muted-foreground/50">Not available</p>
            )}
          </div>
        </div>


        {/* Footer Actions */}
        <div className="px-8 py-4 flex items-center gap-3">
          <Button
            className="gap-2 h-9"
            onClick={() => {
              onOpenChange(false);
              if (t.ticketType === "tender") {
                navigate(`/tenders/${t.id}`);
              } else {
                navigate(`/proposals/${t.id}`);
              }
            }}
          >
            <ExternalLink className="w-4 h-4" />
            {t.ticketType === "tender" ? "Open Tender Workspace" : "Open Proposal Workspace"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
