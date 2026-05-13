/*
 * CW-012: Commercial Workspace v2 Governance Config
 * Extracted component for the Governance Console.
 * SUPA-009: Now loads config from Supabase with inline fallback.
 * Development mode only — no real enforcement.
 * Pattern: follows TenderGovernanceConfig exactly.
 */
import { useState, useEffect } from "react";
import { Shield, DollarSign, Users, CheckCircle, AlertTriangle, Info, TrendingDown, Settings, ChevronDown, ChevronRight, BarChart3, FileText, Scale, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchCommercialGovernanceConfig, type GovernanceConfigEntry } from "@/lib/supabase-governance-data";

// ─── MOCK CONFIG DATA ──────────────────────────────────────

const QUOTE_RULES = [
  { rule: "P&L basis should be visible before proposal confidence", category: "Visibility", owner: "Commercial / Finance" },
  { rule: "Multiple quote scenarios are allowed and encouraged", category: "Process", owner: "Commercial" },
  { rule: "Cost base is owned by Ops / Finance — Commercial cannot override cost", category: "Ownership", owner: "Operations / Finance" },
  { rule: "Selling strategy and pricing is owned by Commercial", category: "Ownership", owner: "Commercial" },
  { rule: "Quote scenario status drives downstream proposal eligibility", category: "Process", owner: "System" },
  { rule: "Risk reserve methodology must be documented per scenario", category: "Compliance", owner: "Finance" },
];

const MARGIN_AUTHORITY = [
  { band: "GP ≥ 22%", authority: "Regional / Local Authority", severity: "green", roles: ["Salesman", "Regional Sales Head"], escalation: "No escalation needed" },
  { band: "GP < 22%", authority: "Commercial / Ops Review", severity: "amber", roles: ["Commercial Director", "Ops Manager"], escalation: "Future review required" },
  { band: "GP < 13%", authority: "Director / Finance Escalation", severity: "orange", roles: ["Director Ops", "Director Commercial", "Finance"], escalation: "Future director approval required" },
  { band: "GP < 10%", authority: "CEO / CFO Escalation", severity: "red", roles: ["CEO", "CFO"], escalation: "Future executive approval required" },
];

const ECR_RULES = [
  { dimension: "Financial Strength", weight: "25%", inputs: "DSO, payment history, credit exposure", gradeImpact: "DSO > 60d → C or below" },
  { dimension: "Operational Behavior", weight: "25%", inputs: "Demand patterns, planning maturity", gradeImpact: "Reactive demand → C or below" },
  { dimension: "Strategic Fit", weight: "25%", inputs: "Sector alignment, corridor value", gradeImpact: "Strategic sector → B or above" },
  { dimension: "Commercial Fit", weight: "25%", inputs: "Margin potential, capacity fit", gradeImpact: "Low margin + constrained → C" },
];

const CAPACITY_RULES = [
  { rule: "Capacity fit score influences quote confidence but does not block testing", type: "Process" },
  { rule: "Effective required positions must be considered (not just raw pallet count)", type: "Calculation" },
  { rule: "Utilization after must be compared against 85% target threshold", type: "Threshold" },
  { rule: "Warehouse constraints include: stackability, height restriction, compatibility, special handling, QC staging, put-away, shift coverage, LFS discipline", type: "Constraint List" },
  { rule: "Ops owner must be identified per scenario", type: "Ownership" },
  { rule: "Promise gaps must be surfaced before proposal", type: "Visibility" },
];

const PRICING_POSTURES = [
  { posture: "Premium", desc: "Strong margin, strategic value, customer willing to pay", color: "text-emerald-700 bg-emerald-50" },
  { posture: "Balanced", desc: "Near threshold, protect price, confirm ops capacity", color: "text-blue-700 bg-blue-50" },
  { posture: "Aggressive", desc: "Entry pricing to win volume — margin risk flagged", color: "text-amber-700 bg-amber-50" },
  { posture: "Reprice", desc: "Current pricing unacceptable — must reprice before proposal", color: "text-orange-700 bg-orange-50" },
  { posture: "Walk Away", desc: "Risk outweighs return — consider exit", color: "text-red-700 bg-red-50" },
];

const PROPOSAL_RULES = [
  { rule: "Proposal must link to a quote scenario", category: "Linkage" },
  { rule: "Negotiation rounds are normal business — not a sign of failure", category: "Process" },
  { rule: "Future gates warn but do not block testing", category: "Gate" },
  { rule: "Client-facing flag must be set explicitly — internal drafts are default", category: "Safety" },
  { rule: "Margin delta from quote must be tracked per proposal version", category: "Tracking" },
];

const SLA_RULES = [
  { rule: "SLA should reflect locked pricing and agreed commercial terms", category: "Linkage" },
  { rule: "SLA must expose promise gaps between quoted and deliverable", category: "Visibility" },
  { rule: "Ops review is a future gate — warning only in MVP", category: "Gate" },
  { rule: "Legal review is a future gate — warning only in MVP", category: "Gate" },
  { rule: "KPI readiness and responsibility matrix must be scored", category: "Readiness" },
  { rule: "SLA escalation matrix must be drafted before client-facing", category: "Process" },
];

const ESCALATION_RULES = [
  { signal: "Red signal (Critical/High)", behavior: "Mock escalation created — does not block testing", bypass: true },
  { signal: "Amber signal (Medium)", behavior: "Future review warning — testing may continue", bypass: true },
  { signal: "Green signal (Low)", behavior: "No escalation needed", bypass: false },
  { signal: "Testing bypass", behavior: "Available on all mock escalations — logs bypass usage", bypass: true },
];

const RUNTIME_LADDER = [
  { mode: "Marker", desc: "Visual indicator only. No user interaction required.", env: "Local", color: "bg-gray-100 text-gray-700" },
  { mode: "Tooltip", desc: "Hover/info tooltip explains the rule. No action required.", env: "Local", color: "bg-gray-100 text-gray-700" },
  { mode: "Warning", desc: "Toast or banner warns user. Continue button available.", env: "Preview", color: "bg-amber-100 text-amber-700" },
  { mode: "Soft Simulation Future", desc: "Simulates enforcement but does not block. Logs decision.", env: "Staging", color: "bg-blue-100 text-blue-700" },
  { mode: "Configurable Enforcement Future", desc: "Admin can enable/disable enforcement per gate.", env: "Production", color: "bg-orange-100 text-orange-700" },
  { mode: "Production Enforcement Future", desc: "Hard enforcement. Cannot be disabled without CEO approval.", env: "Production", color: "bg-red-100 text-red-700" },
];

const ROLE_MATRIX = [
  { role: "Commercial Director", canReview: true, mockApprove: true, futureOverride: true, notes: "GP < 22% approval authority. Customer grade override." },
  { role: "Regional Manager", canReview: true, mockApprove: true, futureOverride: false, notes: "GP ≥ 22% local authority. Create workspaces." },
  { role: "Sales Owner", canReview: true, mockApprove: false, futureOverride: false, notes: "Quote creation, proposal drafting, customer relationship." },
  { role: "Finance Reviewer", canReview: true, mockApprove: true, futureOverride: false, notes: "P&L review, cost base validation, risk reserve." },
  { role: "Operations Reviewer", canReview: true, mockApprove: true, futureOverride: false, notes: "Capacity fit, SLA ops review, delivery feasibility." },
  { role: "Legal Reviewer", canReview: true, mockApprove: true, futureOverride: false, notes: "SLA legal review, contract terms." },
  { role: "HSE Reviewer", canReview: true, mockApprove: false, futureOverride: false, notes: "Safety and compliance inputs." },
  { role: "Customer Care", canReview: true, mockApprove: false, futureOverride: false, notes: "Activity monitoring, escalation visibility." },
  { role: "Admin", canReview: true, mockApprove: false, futureOverride: false, notes: "System configuration only." },
];

// ─── SUB-PANELS ────────────────────────────────────────────

function QuoteRulesPanel() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Mock quote governance rules. These define how quote scenarios should be created, reviewed, and progressed.</p>
      {QUOTE_RULES.map((r, i) => (
        <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg border border-border">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium">{r.rule}</span>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-[8px]">{r.category}</Badge>
              <span className="text-[10px] text-muted-foreground">Owner: {r.owner}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MarginAuthorityPanel() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Margin authority matrix — GP% bands define escalation requirements. All thresholds are mock/future governance.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-muted/40">
              <th className="text-left p-2.5 font-semibold">GP% Band</th>
              <th className="text-left p-2.5 font-semibold">Authority Level</th>
              <th className="text-left p-2.5 font-semibold">Required Roles</th>
              <th className="text-left p-2.5 font-semibold">Escalation</th>
            </tr>
          </thead>
          <tbody>
            {MARGIN_AUTHORITY.map((m, i) => (
              <tr key={i} className={`border-t border-border ${m.severity === "red" ? "bg-red-50/30" : m.severity === "orange" ? "bg-orange-50/30" : ""}`}>
                <td className="p-2.5 font-mono font-semibold">{m.band}</td>
                <td className="p-2.5">
                  <Badge variant="outline" className={`text-[9px] ${
                    m.severity === "red" ? "bg-red-50 text-red-700 border-red-200" :
                    m.severity === "orange" ? "bg-orange-50 text-orange-700 border-orange-200" :
                    m.severity === "amber" ? "bg-amber-50 text-amber-700 border-amber-200" :
                    "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}>{m.authority}</Badge>
                </td>
                <td className="p-2.5 text-muted-foreground">{m.roles.join(", ")}</td>
                <td className="p-2.5 text-muted-foreground">{m.escalation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EcrRulesPanel() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Customer Score / ECR decomposition rules. Four dimensions contribute equally to the overall customer grade.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-muted/40">
              <th className="text-left p-2.5 font-semibold">Dimension</th>
              <th className="text-center p-2.5 font-semibold">Weight</th>
              <th className="text-left p-2.5 font-semibold">Inputs</th>
              <th className="text-left p-2.5 font-semibold">Grade Impact</th>
            </tr>
          </thead>
          <tbody>
            {ECR_RULES.map((r, i) => (
              <tr key={i} className={`border-t border-border ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                <td className="p-2.5 font-medium">{r.dimension}</td>
                <td className="p-2.5 text-center font-mono">{r.weight}</td>
                <td className="p-2.5 text-muted-foreground">{r.inputs}</td>
                <td className="p-2.5 text-muted-foreground">{r.gradeImpact}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50 flex items-start gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
        <span className="text-xs text-amber-800">Customer grade override is a future capability. Only Commercial Director role will have override authority.</span>
      </div>
    </div>
  );
}

function CapacityRulesPanel() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Capacity fit rules govern how warehouse capacity influences commercial decisions.</p>
      {CAPACITY_RULES.map((r, i) => (
        <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg border border-border">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium">{r.rule}</span>
            <Badge variant="outline" className="text-[8px] ml-2">{r.type}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

function PostureRulesPanel() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Pricing posture definitions. Posture is derived from margin, customer score, and capacity signals.</p>
      {PRICING_POSTURES.map(p => (
        <div key={p.posture} className={`p-2.5 rounded-lg border border-border flex items-start gap-2`}>
          <Badge variant="outline" className={`text-[9px] shrink-0 mt-0.5 ${p.color}`}>{p.posture}</Badge>
          <span className="text-xs text-muted-foreground">{p.desc}</span>
        </div>
      ))}
    </div>
  );
}

function ProposalSlaRulesPanel() {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Proposal Rules</h4>
        {PROPOSAL_RULES.map((r, i) => (
          <div key={i} className="flex items-start gap-2 p-2 rounded border border-border">
            <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="text-xs">{r.rule}</span>
              <Badge variant="outline" className="text-[8px] ml-2">{r.category}</Badge>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-1.5"><Scale className="w-3.5 h-3.5" /> SLA Rules</h4>
        {SLA_RULES.map((r, i) => (
          <div key={i} className="flex items-start gap-2 p-2 rounded border border-border">
            <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="text-xs">{r.rule}</span>
              <Badge variant="outline" className="text-[8px] ml-2">{r.category}</Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EscalationRulesPanel() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Mock escalation engine rules. Red signals create mock escalations but never block testing.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-muted/40">
              <th className="text-left p-2.5 font-semibold">Signal</th>
              <th className="text-left p-2.5 font-semibold">Behavior</th>
              <th className="text-center p-2.5 font-semibold w-20">Bypass</th>
            </tr>
          </thead>
          <tbody>
            {ESCALATION_RULES.map((r, i) => (
              <tr key={i} className={`border-t border-border ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                <td className="p-2.5 font-medium">{r.signal}</td>
                <td className="p-2.5 text-muted-foreground">{r.behavior}</td>
                <td className="p-2.5 text-center">{r.bypass ? <Badge variant="outline" className="text-[8px] bg-emerald-50 text-emerald-700">Available</Badge> : <span className="text-muted-foreground/30">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RuntimePanel() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Runtime mode ladder — how governance behavior escalates across environments.</p>
      <div className="space-y-2">
        {RUNTIME_LADDER.map((r, i) => (
          <Card key={i} className={`border shadow-none border-l-4 ${
            r.mode.includes("Production") ? "border-l-red-400" :
            r.mode.includes("Configurable") ? "border-l-orange-400" :
            r.mode.includes("Soft") ? "border-l-blue-400" :
            r.mode.includes("Warning") ? "border-l-amber-400" :
            "border-l-gray-300"
          }`}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold">{r.mode}</span>
                <Badge variant="outline" className={`text-[8px] ${r.color}`}>{r.env}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{r.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800">Current MVP operates in Marker/Tooltip mode only. No gate blocks the user. All signals are development-mode indicators.</p>
      </div>
    </div>
  );
}

function CommercialRoleMatrixPanel() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Commercial Workspace role matrix. Shows review, mock approval, and future override capabilities per role.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-muted/40">
              <th className="text-left p-2.5 font-semibold">Role</th>
              <th className="text-center p-2.5 font-semibold">Can Review</th>
              <th className="text-center p-2.5 font-semibold">Mock Approve</th>
              <th className="text-center p-2.5 font-semibold">Future Override</th>
              <th className="text-left p-2.5 font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody>
            {ROLE_MATRIX.map((r, i) => (
              <tr key={r.role} className={`border-t border-border ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                <td className="p-2.5 font-medium">{r.role}</td>
                <td className="p-2.5 text-center">{r.canReview ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600 mx-auto" /> : <span className="text-muted-foreground/30">—</span>}</td>
                <td className="p-2.5 text-center">{r.mockApprove ? <CheckCircle className="w-3.5 h-3.5 text-blue-600 mx-auto" /> : <span className="text-muted-foreground/30">—</span>}</td>
                <td className="p-2.5 text-center">{r.futureOverride ? <CheckCircle className="w-3.5 h-3.5 text-amber-600 mx-auto" /> : <span className="text-muted-foreground/30">—</span>}</td>
                <td className="p-2.5 text-muted-foreground">{r.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── MAIN EXPORT ───────────────────────────────────────────

export default function CommercialGovernanceConfig() {
  const [sbConfig, setSbConfig] = useState<GovernanceConfigEntry[]>([]);
  const [fromSupabase, setFromSupabase] = useState(false);

  useEffect(() => {
    (async () => {
      const data = await fetchCommercialGovernanceConfig();
      if (data.length > 0) {
        setSbConfig(data);
        setFromSupabase(true);
      }
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-serif font-bold flex items-center gap-2"><Shield className="w-5 h-5 text-[var(--color-hala-navy)]" /> Commercial Workspace Config</h3>
          <p className="text-xs text-muted-foreground">Mock governance configuration for quotes, margins, ECR, capacity, proposals, SLAs, and escalations</p>
        </div>
        <div className="flex items-center gap-2">
          {fromSupabase && <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">✓ Supabase-Backed</Badge>}
          <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">Development Mode</Badge>
        </div>
      </div>

      {/* Development Banner */}
      <Card className="border-2 border-amber-200 shadow-none bg-amber-50/50">
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-amber-800 mb-0.5">Development mode: Commercial Workspace configuration is mock-only</div>
              <p className="text-xs text-amber-700 leading-relaxed">
                It documents future governance behavior but does not enforce rules.
                No toggles change runtime behavior. No production enforcement.
                {fromSupabase ? ' Reference config loaded from Supabase.' : ' All values are read-only mock data.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="quotes" className="space-y-3">
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="quotes" className="text-xs gap-1"><DollarSign className="w-3 h-3" /> Quote Rules</TabsTrigger>
          <TabsTrigger value="margin" className="text-xs gap-1"><TrendingDown className="w-3 h-3" /> Margin Authority</TabsTrigger>
          <TabsTrigger value="ecr" className="text-xs gap-1"><BarChart3 className="w-3 h-3" /> ECR Rules</TabsTrigger>
          <TabsTrigger value="capacity" className="text-xs gap-1"><Settings className="w-3 h-3" /> Capacity</TabsTrigger>
          <TabsTrigger value="posture" className="text-xs gap-1"><TrendingDown className="w-3 h-3" /> Posture</TabsTrigger>
          <TabsTrigger value="proposal_sla" className="text-xs gap-1"><FileText className="w-3 h-3" /> Proposal & SLA</TabsTrigger>
          <TabsTrigger value="escalation" className="text-xs gap-1"><Zap className="w-3 h-3" /> Escalation</TabsTrigger>
          <TabsTrigger value="runtime" className="text-xs gap-1"><Settings className="w-3 h-3" /> Runtime</TabsTrigger>
          <TabsTrigger value="roles" className="text-xs gap-1"><Users className="w-3 h-3" /> Role Matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="quotes"><QuoteRulesPanel /></TabsContent>
        <TabsContent value="margin"><MarginAuthorityPanel /></TabsContent>
        <TabsContent value="ecr"><EcrRulesPanel /></TabsContent>
        <TabsContent value="capacity"><CapacityRulesPanel /></TabsContent>
        <TabsContent value="posture"><PostureRulesPanel /></TabsContent>
        <TabsContent value="proposal_sla"><ProposalSlaRulesPanel /></TabsContent>
        <TabsContent value="escalation"><EscalationRulesPanel /></TabsContent>
        <TabsContent value="runtime"><RuntimePanel /></TabsContent>
        <TabsContent value="roles"><CommercialRoleMatrixPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
