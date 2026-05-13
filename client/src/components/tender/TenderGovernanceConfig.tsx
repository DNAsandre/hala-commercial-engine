/*
 * TND-011: Tender Governance Mock Configuration
 * Extracted component for the Governance Console.
 * SUPA-009: Now loads config from Supabase with inline fallback.
 * Development mode only — no real enforcement.
 */
import { useState, useEffect, useMemo } from "react";
import { Shield, FileText, Users, CheckCircle, AlertTriangle, Info, Package, Lock, Settings, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchTenderGovernanceConfig, type GovernanceConfigEntry } from "@/lib/supabase-governance-data";

// ─── MOCK DATA ─────────────────────────────────────────────

const TENDER_TEMPLATES = [
  { id: "tt-1", name: "Single-Pack Logistics Tender", packModel: "single_pack", masterPack: false, childPacks: [], defaultRuntime: "Development Mock", notes: "Standard single-pack logistics tender." },
  { id: "tt-2", name: "Multi-Pack Transport Tender", packModel: "multi_pack", masterPack: true, childPacks: ["Bulk Transportation Pack", "PGP Transportation Pack"], defaultRuntime: "Development Mock", notes: "Linde-style split-pack tender. Internal master + external child packs." },
  { id: "tt-3", name: "Warehousing Tender", packModel: "single_pack", masterPack: false, childPacks: [], defaultRuntime: "Development Mock", notes: "Warehousing and storage services tender." },
  { id: "tt-4", name: "Renewal Tender", packModel: "single_pack", masterPack: false, childPacks: [], defaultRuntime: "Development Mock", notes: "Contract renewal tender — references prior SLA/contract." },
  { id: "tt-5", name: "Clarification Response Pack", packModel: "response_pack", masterPack: false, childPacks: [], defaultRuntime: "Development Mock", notes: "Post-submission clarification response. Not a full tender." },
];

const GATE_RULES = [
  { id: "gr-1", name: "All required placeholders populated", doctrine: true, local: "Marker", preview: "Warning", staging: "Soft Simulation", production: "Configurable Enforcement", override: true, approver: "Tender Owner" },
  { id: "gr-2", name: "OBK signed/stamped and native Excel ready", doctrine: true, local: "Marker", preview: "Warning", staging: "Soft Simulation", production: "Production Enforcement Future", override: false, approver: "Commercial Director" },
  { id: "gr-3", name: "Bid Statement signed/stamped", doctrine: true, local: "Tooltip", preview: "Warning", staging: "Soft Simulation", production: "Configurable Enforcement", override: true, approver: "Commercial Director" },
  { id: "gr-4", name: "Transition Plan populated and reviewed", doctrine: false, local: "Marker", preview: "Warning", staging: "Soft Simulation", production: "Configurable Enforcement", override: true, approver: "Operations Reviewer" },
  { id: "gr-5", name: "Compliance Pack collated", doctrine: true, local: "Marker", preview: "Warning", staging: "Soft Simulation", production: "Production Enforcement Future", override: false, approver: "Document Controller" },
  { id: "gr-6", name: "Internal master pack not externally submitted", doctrine: true, local: "Tooltip", preview: "Warning", staging: "Soft Simulation", production: "Production Enforcement Future", override: false, approver: "System" },
  { id: "gr-7", name: "Separate Bulk and PGP email threads required", doctrine: true, local: "Marker", preview: "Warning", staging: "Soft Simulation", production: "Production Enforcement Future", override: false, approver: "Tender Owner" },
];

const REQUIRED_DOCS = [
  { doc: "Final Tender Pack PDF", pack: "All", native: true, signed: false, stamp: false, gate: "—" },
  { doc: "OBK Native Excel", pack: "Bulk / PGP", native: true, signed: false, stamp: false, gate: "OBK signed/stamped" },
  { doc: "OBK Signed/Stamped PDF", pack: "Bulk / PGP", native: false, signed: true, stamp: true, gate: "OBK signed/stamped" },
  { doc: "Bid Statement Signed/Stamped PDF", pack: "All", native: false, signed: true, stamp: true, gate: "Bid Statement signed" },
  { doc: "Transition Plan", pack: "All", native: true, signed: false, stamp: false, gate: "Transition Plan reviewed" },
  { doc: "Continuous Improvement Proposal Form", pack: "All", native: true, signed: false, stamp: false, gate: "—" },
  { doc: "Compliance Pack", pack: "All", native: true, signed: false, stamp: false, gate: "Compliance Pack collated" },
  { doc: "Commercial Registration", pack: "All", native: false, signed: true, stamp: false, gate: "Compliance Pack collated" },
  { doc: "VAT Certificate", pack: "All", native: false, signed: true, stamp: false, gate: "Compliance Pack collated" },
  { doc: "ISO Certificates", pack: "All", native: false, signed: true, stamp: false, gate: "Compliance Pack collated" },
  { doc: "Insurance Certificates", pack: "All", native: false, signed: true, stamp: false, gate: "Compliance Pack collated" },
  { doc: "ADR Class 2 Certifications", pack: "All", native: false, signed: true, stamp: false, gate: "Compliance Pack collated" },
  { doc: "Reference Credentials", pack: "All", native: true, signed: false, stamp: false, gate: "—" },
  { doc: "Performance Guarantee Confirmation", pack: "All", native: false, signed: true, stamp: true, gate: "—" },
];

const COMPLIANCE_CATEGORIES = [
  "Scope", "Vehicle Specifications", "Driver Requirements", "Safety / HSE", "ADR / GDP",
  "Management Standards", "Insurance", "KPI / PL Consequences", "Pricing / OBK", "Bid Validity",
  "Performance Guarantee", "Transition", "Continuous Improvement", "Legal Terms", "Submission Format",
];

const ROLE_MATRIX = [
  { role: "Commercial Director", review: true, mockApprove: true, futureOverride: true, secondApproval: false, notes: "Final tender approval authority" },
  { role: "Tender Owner", review: true, mockApprove: true, futureOverride: true, secondApproval: true, notes: "Day-to-day tender execution lead" },
  { role: "Sales Owner", review: true, mockApprove: false, futureOverride: false, secondApproval: false, notes: "Customer relationship, pricing input" },
  { role: "Document Controller", review: true, mockApprove: true, futureOverride: false, secondApproval: false, notes: "Document completeness and format" },
  { role: "Finance Reviewer", review: true, mockApprove: true, futureOverride: false, secondApproval: true, notes: "OBK pricing, bank guarantees" },
  { role: "Legal Reviewer", review: true, mockApprove: true, futureOverride: false, secondApproval: true, notes: "Contract terms, MSA review" },
  { role: "Operations Reviewer", review: true, mockApprove: true, futureOverride: false, secondApproval: false, notes: "Transition plan, capacity" },
  { role: "HSE Reviewer", review: true, mockApprove: true, futureOverride: false, secondApproval: false, notes: "LTIFR, safety compliance" },
  { role: "Admin", review: true, mockApprove: false, futureOverride: false, secondApproval: false, notes: "System configuration only" },
];

// ─── SUB-PANELS ────────────────────────────────────────────

function TemplatesPanel() {
  const [expanded, setExpanded] = useState<string | null>("tt-2");
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Mock tender templates. These define the default pack model, child packs, and runtime mode for new tenders.</p>
      {TENDER_TEMPLATES.map(t => {
        const isExp = expanded === t.id;
        return (
          <Card key={t.id} className={`border shadow-none transition-all ${t.id === "tt-2" ? "border-l-4 border-l-blue-400" : ""}`}>
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-3 cursor-pointer" onClick={() => setExpanded(isExp ? null : t.id)}>
                <div className="flex items-center gap-2">
                  {isExp ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{t.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px]">{t.packModel.replace(/_/g, " ")}</Badge>
                  <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">Mock</Badge>
                </div>
              </div>
              {isExp && (
                <div className="border-t border-border p-3 bg-muted/20 space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-muted-foreground">Pack Model:</span> <span className="font-medium">{t.packModel.replace(/_/g, " ")}</span></div>
                    <div><span className="text-muted-foreground">Internal Master:</span> <span className="font-medium">{t.masterPack ? "Yes" : "No"}</span></div>
                    <div><span className="text-muted-foreground">Default Runtime:</span> <span className="font-medium">{t.defaultRuntime}</span></div>
                    <div><span className="text-muted-foreground">Child Packs:</span> <span className="font-medium">{t.childPacks.length > 0 ? t.childPacks.join(", ") : "—"}</span></div>
                  </div>
                  <p className="text-muted-foreground">{t.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function GateRulesPanel() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Mock gate rule configuration. Shows how each gate behaves per environment. No toggles change runtime behavior yet.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-muted/40">
              <th className="text-left p-2.5 font-semibold">Gate Name</th>
              <th className="text-center p-2.5 font-semibold w-16">Doctrine</th>
              <th className="text-center p-2.5 font-semibold">Local</th>
              <th className="text-center p-2.5 font-semibold">Preview</th>
              <th className="text-center p-2.5 font-semibold">Staging</th>
              <th className="text-center p-2.5 font-semibold">Production</th>
              <th className="text-center p-2.5 font-semibold w-16">Override</th>
              <th className="text-left p-2.5 font-semibold">Approver</th>
            </tr>
          </thead>
          <tbody>
            {GATE_RULES.map((g, i) => (
              <tr key={g.id} className={`border-t border-border ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                <td className="p-2.5 font-medium">{g.name}</td>
                <td className="p-2.5 text-center">{g.doctrine ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600 mx-auto" /> : <span className="text-muted-foreground">—</span>}</td>
                <td className="p-2.5 text-center"><Badge variant="outline" className="text-[8px] bg-gray-50">{g.local}</Badge></td>
                <td className="p-2.5 text-center"><Badge variant="outline" className="text-[8px] bg-amber-50 text-amber-700 border-amber-200">{g.preview}</Badge></td>
                <td className="p-2.5 text-center"><Badge variant="outline" className="text-[8px] bg-blue-50 text-blue-700 border-blue-200">{g.staging}</Badge></td>
                <td className="p-2.5 text-center"><Badge variant="outline" className={`text-[8px] ${g.production.includes("Future") ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{g.production.length > 20 ? g.production.replace("Configurable ", "Conf. ").replace(" Future", "") : g.production}</Badge></td>
                <td className="p-2.5 text-center">{g.override ? <Badge variant="outline" className="text-[8px] bg-emerald-50 text-emerald-700">Yes</Badge> : <Badge variant="outline" className="text-[8px] bg-red-50 text-red-700">No</Badge>}</td>
                <td className="p-2.5 text-muted-foreground">{g.approver}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800">All environment modes are read-only mock values. No toggles change runtime behavior. Production enforcement requires explicit approval and backend implementation.</p>
      </div>
    </div>
  );
}

function RequiredDocsPanel() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Required document set for Multi-Pack Transport Tender. Shows native, signed, and stamp requirements per document.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-muted/40">
              <th className="text-left p-2.5 font-semibold">Document</th>
              <th className="text-center p-2.5 font-semibold">Pack Type</th>
              <th className="text-center p-2.5 font-semibold w-16">Native</th>
              <th className="text-center p-2.5 font-semibold w-16">Signed</th>
              <th className="text-center p-2.5 font-semibold w-16">Stamp</th>
              <th className="text-left p-2.5 font-semibold">Future Gate</th>
            </tr>
          </thead>
          <tbody>
            {REQUIRED_DOCS.map((d, i) => (
              <tr key={i} className={`border-t border-border ${d.doc.includes("OBK") ? "bg-amber-50/30" : i % 2 === 0 ? "" : "bg-muted/10"}`}>
                <td className="p-2.5 font-medium">{d.doc}</td>
                <td className="p-2.5 text-center"><Badge variant="outline" className="text-[8px]">{d.pack}</Badge></td>
                <td className="p-2.5 text-center">{d.native ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600 mx-auto" /> : <span className="text-muted-foreground/30">—</span>}</td>
                <td className="p-2.5 text-center">{d.signed ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600 mx-auto" /> : <span className="text-muted-foreground/30">—</span>}</td>
                <td className="p-2.5 text-center">{d.stamp ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600 mx-auto" /> : <span className="text-muted-foreground/30">—</span>}</td>
                <td className="p-2.5 text-muted-foreground">{d.gate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComplianceCategoriesPanel() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Tender compliance categories used in the Compliance Matrix. Each item in the matrix is assigned one of these categories.</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {COMPLIANCE_CATEGORIES.map((cat, i) => (
          <div key={cat} className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card">
            <span className="text-[10px] font-mono text-muted-foreground w-5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
            <span className="text-xs font-medium">{cat}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoleMatrixPanel() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Tender-specific role matrix. Shows review, approval, and override capabilities per role.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-muted/40">
              <th className="text-left p-2.5 font-semibold">Role</th>
              <th className="text-center p-2.5 font-semibold">Can Review</th>
              <th className="text-center p-2.5 font-semibold">Mock Approve</th>
              <th className="text-center p-2.5 font-semibold">Future Override</th>
              <th className="text-center p-2.5 font-semibold">2nd Approval</th>
              <th className="text-left p-2.5 font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody>
            {ROLE_MATRIX.map((r, i) => (
              <tr key={r.role} className={`border-t border-border ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                <td className="p-2.5 font-medium">{r.role}</td>
                <td className="p-2.5 text-center">{r.review ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600 mx-auto" /> : <span className="text-muted-foreground/30">—</span>}</td>
                <td className="p-2.5 text-center">{r.mockApprove ? <CheckCircle className="w-3.5 h-3.5 text-blue-600 mx-auto" /> : <span className="text-muted-foreground/30">—</span>}</td>
                <td className="p-2.5 text-center">{r.futureOverride ? <CheckCircle className="w-3.5 h-3.5 text-amber-600 mx-auto" /> : <span className="text-muted-foreground/30">—</span>}</td>
                <td className="p-2.5 text-center">{r.secondApproval ? <Badge variant="outline" className="text-[8px] bg-amber-50 text-amber-700">Required</Badge> : <span className="text-muted-foreground/30">—</span>}</td>
                <td className="p-2.5 text-muted-foreground">{r.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DoctrineRuntimePanel() {
  const items = [
    { term: "Doctrine Required", desc: "Rule belongs in the future-state tender process. It is a structural compliance requirement that should eventually be enforced.", color: "border-l-emerald-400" },
    { term: "Runtime Mode", desc: "How the app behaves in the current environment. Modes escalate from Marker → Tooltip → Warning → Soft Simulation → Configurable Enforcement → Production Enforcement.", color: "border-l-blue-400" },
    { term: "Current MVP", desc: "Mock markers, warnings, and testing bypass only. No gate blocks the user. No enforcement is active. All signals are development-mode indicators.", color: "border-l-amber-400" },
    { term: "Production Enforcement", desc: "Requires explicit approval, backend implementation, and environment-specific rollout. Cannot be activated from the admin panel during development.", color: "border-l-red-400" },
  ];
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Understanding the difference between doctrine requirements and runtime behavior.</p>
      <div className="space-y-2">
        {items.map(item => (
          <Card key={item.term} className={`border shadow-none border-l-4 ${item.color}`}>
            <CardContent className="p-3">
              <div className="text-sm font-semibold mb-1">{item.term}</div>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="p-3 rounded-lg bg-muted/30 border border-border">
        <div className="text-xs font-semibold mb-2">Environment Runtime Defaults</div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { env: "Local", mode: "Marker / Tooltip", color: "bg-gray-100 text-gray-700" },
            { env: "Preview", mode: "Warning", color: "bg-amber-100 text-amber-700" },
            { env: "Staging", mode: "Soft Simulation", color: "bg-blue-100 text-blue-700" },
            { env: "Production", mode: "Enforcement Future", color: "bg-red-100 text-red-700" },
          ].map(e => (
            <div key={e.env} className="text-center p-2 rounded border border-border">
              <div className="text-[10px] text-muted-foreground mb-1">{e.env}</div>
              <Badge variant="outline" className={`text-[8px] ${e.color}`}>{e.mode}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN EXPORT ───────────────────────────────────────────

export default function TenderGovernanceConfig() {
  const [sbConfig, setSbConfig] = useState<GovernanceConfigEntry[]>([]);
  const [fromSupabase, setFromSupabase] = useState(false);

  useEffect(() => {
    (async () => {
      const data = await fetchTenderGovernanceConfig();
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
          <h3 className="text-lg font-serif font-bold flex items-center gap-2"><Shield className="w-5 h-5 text-[var(--color-hala-navy)]" /> Tender Configuration</h3>
          <p className="text-xs text-muted-foreground">Mock governance configuration for tender templates, gates, documents, compliance, and roles</p>
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
              <div className="text-sm font-semibold text-amber-800 mb-0.5">Development mode: mock configuration only</div>
              <p className="text-xs text-amber-700 leading-relaxed">
                This configuration documents future governance behavior but does not enforce rules yet.
                No toggles change runtime behavior. No production enforcement.
                {fromSupabase ? ' Reference config loaded from Supabase.' : ' All values are read-only mock data.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="templates" className="space-y-3">
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="templates" className="text-xs gap-1"><Package className="w-3 h-3" /> Templates</TabsTrigger>
          <TabsTrigger value="gates" className="text-xs gap-1"><Shield className="w-3 h-3" /> Gate Rules</TabsTrigger>
          <TabsTrigger value="docs" className="text-xs gap-1"><FileText className="w-3 h-3" /> Req. Documents</TabsTrigger>
          <TabsTrigger value="compliance" className="text-xs gap-1"><CheckCircle className="w-3 h-3" /> Compliance</TabsTrigger>
          <TabsTrigger value="roles" className="text-xs gap-1"><Users className="w-3 h-3" /> Role Matrix</TabsTrigger>
          <TabsTrigger value="doctrine" className="text-xs gap-1"><Settings className="w-3 h-3" /> Doctrine</TabsTrigger>
        </TabsList>

        <TabsContent value="templates"><TemplatesPanel /></TabsContent>
        <TabsContent value="gates"><GateRulesPanel /></TabsContent>
        <TabsContent value="docs"><RequiredDocsPanel /></TabsContent>
        <TabsContent value="compliance"><ComplianceCategoriesPanel /></TabsContent>
        <TabsContent value="roles"><RoleMatrixPanel /></TabsContent>
        <TabsContent value="doctrine"><DoctrineRuntimePanel /></TabsContent>
      </Tabs>
    </div>
  );
}
