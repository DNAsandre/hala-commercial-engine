/**
 * Stage 1 — QUALIFIED
 * Determine if this opportunity deserves commercial resources.
 *
 * Tabs: Qualification Summary | Customer Fit | Opportunity Brief | Required Info
 */
import { ClipboardList, Target, BookOpen, CheckCircle2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Section, FieldRow, FieldInput, FieldTextarea, FieldSelect, FitSelector,
  ReadinessBadge, SignalCard,
} from "../ui-primitives";
import type {
  QualificationSummary, CustomerFit, OpportunityBrief, RequiredInfoItem,
  ProposalWorkspaceData,
} from "../proposal-workspace-state";
import { calcQualificationReadiness } from "../proposal-workspace-state";

// ═══════════════════════════════════════════════════════════
// TAB: Qualification Summary
// ═══════════════════════════════════════════════════════════

export function QualificationSummaryTab({
  data, onChange,
}: {
  data: QualificationSummary;
  onChange: (d: QualificationSummary) => void;
}) {
  const u = (field: keyof QualificationSummary, val: string | number) =>
    onChange({ ...data, [field]: val });

  const filled = [data.opportunityName, data.customer, data.region, data.serviceType, data.expectedCloseDate].filter(Boolean).length;

  return (
    <div className="space-y-1">
      <Section title="Opportunity Details" defaultOpen
        badge={<Badge variant="outline" className="text-[9px]">{filled}/5 fields</Badge>}
        icon={<ClipboardList className="w-4 h-4 text-blue-500" />}
      >
        <div className="space-y-0.5">
          <FieldRow label="Opportunity Name"><FieldInput value={data.opportunityName} onChange={v => u("opportunityName", v)} placeholder="e.g. ACME Corp 3PL Warehousing" /></FieldRow>
          <FieldRow label="Customer"><FieldInput value={data.customer} onChange={v => u("customer", v)} placeholder="Customer name" /></FieldRow>
          <FieldRow label="Region"><FieldSelect value={data.region} onChange={v => u("region", v)} options={[
            { value: "riyadh", label: "Riyadh" }, { value: "jeddah", label: "Jeddah" },
            { value: "dammam", label: "Dammam" }, { value: "central", label: "Central" },
            { value: "western", label: "Western" }, { value: "eastern", label: "Eastern" },
          ]} /></FieldRow>
          <FieldRow label="Industry"><FieldInput value={data.industry} onChange={v => u("industry", v)} placeholder="e.g. FMCG, Retail, Pharma" /></FieldRow>
          <FieldRow label="Service Type"><FieldSelect value={data.serviceType} onChange={v => u("serviceType", v)} options={[
            { value: "warehousing", label: "Warehousing" }, { value: "transport", label: "Transport" },
            { value: "3pl", label: "3PL (Full)" }, { value: "vas", label: "VAS" },
            { value: "cold_chain", label: "Cold Chain" }, { value: "custom", label: "Custom" },
          ]} /></FieldRow>
        </div>
      </Section>

      <Section title="Commercial Indicators" defaultOpen
        icon={<Target className="w-4 h-4 text-indigo-500" />}
      >
        <div className="space-y-0.5">
          <FieldRow label="Est. Revenue (SAR)"><FieldInput type="number" value={data.estimatedRevenue || ""} onChange={v => u("estimatedRevenue", Number(v))} placeholder="0" /></FieldRow>
          <FieldRow label="Est. Pallets"><FieldInput type="number" value={data.estimatedPallets || ""} onChange={v => u("estimatedPallets", Number(v))} placeholder="0" /></FieldRow>
          <FieldRow label="Close Date"><FieldInput type="date" value={data.expectedCloseDate} onChange={v => u("expectedCloseDate", v)} /></FieldRow>
          <FieldRow label="CRM Ref"><FieldInput value={data.crmRef} onChange={v => u("crmRef", v)} placeholder="e.g. CRM-2026-0045" /></FieldRow>
          <FieldRow label="Lead Source"><FieldSelect value={data.leadSource} onChange={v => u("leadSource", v)} options={[
            { value: "inbound", label: "Inbound" }, { value: "referral", label: "Referral" },
            { value: "existing", label: "Existing Client" }, { value: "tender", label: "Tender" },
            { value: "cold", label: "Cold Outreach" },
          ]} /></FieldRow>
        </div>
      </Section>

      <Section title="Qualification Confidence" defaultOpen={false}>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <input
              type="range" min="0" max="100" value={data.qualificationConfidence}
              onChange={e => u("qualificationConfidence", Number(e.target.value))}
              className="flex-1 h-2 accent-indigo-600"
            />
            <span className={`text-sm font-bold min-w-[40px] text-right ${
              data.qualificationConfidence >= 70 ? "text-emerald-600" :
              data.qualificationConfidence >= 40 ? "text-amber-600" : "text-red-600"
            }`}>{data.qualificationConfidence}%</span>
          </div>
          <p className="text-[10px] text-muted-foreground/60">
            How confident are you this opportunity is qualified enough to pursue? Advisory only — does not block progress.
          </p>
        </div>
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB: Customer Fit
// ═══════════════════════════════════════════════════════════

export function CustomerFitTab({
  data, onChange,
}: {
  data: CustomerFit;
  onChange: (d: CustomerFit) => void;
}) {
  const u = (field: keyof CustomerFit, val: string) =>
    onChange({ ...data, [field]: val });

  const fitCount = [data.icpFit, data.strategicFit, data.regionFit, data.capabilityFit, data.relationshipStrength].filter(Boolean).length;

  return (
    <div className="space-y-1">
      <Section title="Fit Assessment" defaultOpen
        badge={<Badge variant="outline" className="text-[9px]">{fitCount}/5 assessed</Badge>}
        icon={<Target className="w-4 h-4 text-teal-500" />}
      >
        <div className="space-y-2">
          <FieldRow label="ICP Fit"><FitSelector value={data.icpFit} onChange={v => u("icpFit", v)} /></FieldRow>
          <FieldRow label="Strategic Fit"><FitSelector value={data.strategicFit} onChange={v => u("strategicFit", v)} /></FieldRow>
          <FieldRow label="Region Fit"><FitSelector value={data.regionFit} onChange={v => u("regionFit", v)} /></FieldRow>
          <FieldRow label="Capability Fit"><FitSelector value={data.capabilityFit} onChange={v => u("capabilityFit", v)} /></FieldRow>
          <FieldRow label="Relationship"><FitSelector value={data.relationshipStrength} onChange={v => u("relationshipStrength", v)} /></FieldRow>
        </div>
      </Section>

      <Section title="Competitive Landscape" defaultOpen={false}>
        <FieldRow label="Competitor">
          <FieldSelect value={data.competitorPresence} onChange={v => u("competitorPresence", v)} options={[
            { value: "none", label: "No known competition" },
            { value: "low", label: "Some competition" },
            { value: "high", label: "Highly contested" },
            { value: "incumbent", label: "Incumbent present" },
          ]} />
        </FieldRow>
        <FieldRow label="Overall Fit">
          <div className="flex gap-1">
            {(["green", "amber", "red"] as const).map(c => (
              <button key={c} onClick={() => u("fitScore", data.fitScore === c ? "" : c)}
                className={`px-3 py-1 rounded text-[10px] font-medium border transition-all ${
                  data.fitScore === c
                    ? c === "green" ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                      : c === "amber" ? "bg-amber-100 border-amber-300 text-amber-700"
                      : "bg-red-100 border-red-300 text-red-700"
                    : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50"
                }`}
              >{c === "green" ? "✓ Green" : c === "amber" ? "⚠ Amber" : "✕ Red"}</button>
            ))}
          </div>
        </FieldRow>

        {/* ── Competitive Intelligence Pipeline ── */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Competitive Intelligence Pipeline</p>
          <div className="space-y-2.5">
            {/* Checkbox 1: Scrapper Bot Send */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={data.scrapperBotSent}
                onChange={e => onChange({ ...data, scrapperBotSent: e.target.checked })}
                className="w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span className={`text-xs font-medium ${data.scrapperBotSent ? "text-foreground" : "text-muted-foreground"}`}>
                Scrapper Bot Send
              </span>
              {data.scrapperBotSent && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-auto" />}
            </label>

            {/* Checkbox 2: AI Competitive Research Done */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={data.aiResearchDone}
                onChange={e => onChange({ ...data, aiResearchDone: e.target.checked })}
                className="w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span className={`text-xs font-medium ${data.aiResearchDone ? "text-foreground" : "text-muted-foreground"}`}>
                AI Competitive Research Done
              </span>
              {data.aiResearchDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-auto" />}
            </label>

            {/* Checkbox 3: Competitive Analysis Done */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={data.competitiveAnalysisDone}
                onChange={e => onChange({ ...data, competitiveAnalysisDone: e.target.checked })}
                className="w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span className={`text-xs font-medium ${data.competitiveAnalysisDone ? "text-foreground" : "text-muted-foreground"}`}>
                Competitive Analysis Done
              </span>
              {data.competitiveAnalysisDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-auto" />}
            </label>

            {/* Strategic Findings — unlocks when all 3 above are checked */}
            <div className={`mt-2 transition-all duration-200 ${
              data.scrapperBotSent && data.aiResearchDone && data.competitiveAnalysisDone
                ? "opacity-100" : "opacity-40 pointer-events-none"
            }`}>
              <label className="flex items-center gap-3 mb-2">
                <input
                  type="checkbox"
                  checked={data.scrapperBotSent && data.aiResearchDone && data.competitiveAnalysisDone}
                  disabled
                  className="w-4 h-4 rounded border-border text-emerald-600 cursor-default"
                />
                <span className={`text-xs font-semibold ${
                  data.scrapperBotSent && data.aiResearchDone && data.competitiveAnalysisDone
                    ? "text-foreground" : "text-muted-foreground"
                }`}>
                  Strategic Findings
                </span>
                {data.scrapperBotSent && data.aiResearchDone && data.competitiveAnalysisDone && (
                  <Badge variant="outline" className="text-[8px] border-emerald-300 text-emerald-700 bg-emerald-50 ml-auto">Unlocked</Badge>
                )}
              </label>
              {data.scrapperBotSent && data.aiResearchDone && data.competitiveAnalysisDone && (
                <textarea
                  value={data.strategicFindings}
                  onChange={e => onChange({ ...data, strategicFindings: e.target.value })}
                  placeholder="Enter strategic findings from competitive analysis…"
                  rows={4}
                  className="w-full text-xs bg-muted/30 border border-border rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50 resize-y"
                />
              )}
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB: Opportunity Brief
// ═══════════════════════════════════════════════════════════

export function OpportunityBriefTab({
  data, onChange,
}: {
  data: OpportunityBrief;
  onChange: (d: OpportunityBrief) => void;
}) {
  const u = (field: keyof OpportunityBrief, val: string) =>
    onChange({ ...data, [field]: val });

  return (
    <div className="space-y-1">
      <Section title="Customer Context" defaultOpen icon={<BookOpen className="w-4 h-4 text-violet-500" />}>
        <div className="space-y-0.5">
          <FieldRow label="Customer Need"><FieldTextarea value={data.customerNeed} onChange={v => u("customerNeed", v)} placeholder="What does the customer actually need?" /></FieldRow>
          <FieldRow label="Why Now"><FieldTextarea value={data.whyNow} onChange={v => u("whyNow", v)} placeholder="Why is this urgent? Contract expiry, growth, pain?" rows={2} /></FieldRow>
          <FieldRow label="Scope Summary"><FieldTextarea value={data.scopeSummary} onChange={v => u("scopeSummary", v)} placeholder="High-level scope description" /></FieldRow>
        </div>
      </Section>

      <Section title="Decision Landscape" defaultOpen={false}>
        <div className="space-y-0.5">
          <FieldRow label="Key Stakeholders"><FieldTextarea value={data.keyStakeholders} onChange={v => u("keyStakeholders", v)} placeholder="Decision makers, influencers, contacts" rows={2} /></FieldRow>
          <FieldRow label="Decision Timeline"><FieldInput value={data.decisionTimeline} onChange={v => u("decisionTimeline", v)} placeholder="e.g. Q3 2026, Within 60 days" /></FieldRow>
          <FieldRow label="Constraints"><FieldTextarea value={data.knownConstraints} onChange={v => u("knownConstraints", v)} placeholder="Budget limits, regulatory, location, etc." rows={2} /></FieldRow>
        </div>
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB: Required Info
// ═══════════════════════════════════════════════════════════

export function RequiredInfoTab({
  data, onChange,
}: {
  data: RequiredInfoItem[];
  onChange: (d: RequiredInfoItem[]) => void;
}) {
  const completed = data.filter(r => r.complete).length;

  const toggle = (idx: number) => {
    const next = [...data];
    next[idx] = { ...next[idx], complete: !next[idx].complete };
    onChange(next);
  };

  const updateNotes = (idx: number, notes: string) => {
    const next = [...data];
    next[idx] = { ...next[idx], notes };
    onChange(next);
  };

  return (
    <div className="space-y-1">
      <Section title="Information Checklist" defaultOpen
        badge={
          <Badge variant="outline" className={`text-[9px] ${
            completed === data.length ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
            completed >= data.length / 2 ? "border-amber-200 bg-amber-50 text-amber-700" :
            "border-red-200 bg-red-50 text-red-700"
          }`}>
            {completed}/{data.length} complete
          </Badge>
        }
        icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
      >
        <div className="space-y-1.5">
          {data.map((item, i) => (
            <div key={item.key} className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
              item.complete ? "border-emerald-200 bg-emerald-50/30" : "border-border"
            }`}>
              <button onClick={() => toggle(i)} className="mt-0.5 shrink-0">
                <CheckCircle2 className={`w-4 h-4 transition-colors ${
                  item.complete ? "text-emerald-500" : "text-muted-foreground/30"
                }`} />
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${item.complete ? "line-through text-muted-foreground/60" : ""}`}>{item.label}</p>
                <input
                  value={item.notes}
                  onChange={e => updateNotes(i, e.target.value)}
                  placeholder="Notes..."
                  className="w-full mt-1 px-2 py-1 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {completed < data.length && (
        <SignalCard
          type="info"
          message={`${data.length - completed} required info items still missing`}
          recommendation="Complete the checklist to improve qualification confidence. This does not block progress."
        />
      )}
    </div>
  );
}
