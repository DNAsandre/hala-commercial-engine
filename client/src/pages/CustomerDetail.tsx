/**
 * Customer Detail — Client Master File
 * Swiss Precision Instrument Design
 *
 * Tabs: Profile, ECR Scorecard, Revenue History, Workspaces, Tenders,
 *       Documents (Client Vault), Opportunities
 *
 * Documents tab = Client Master Vault with folder hierarchy, search,
 * filters, upload, version history, and metadata hover.
 */

import { useState, useMemo } from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  ArrowLeft, Printer, Star, TrendingUp, TrendingDown, Minus, ExternalLink,
  FolderOpen, FileText, Upload, Search, Filter, Archive, Eye, Clock,
  ChevronRight, ChevronDown, Gavel, Briefcase, Link2, Plus, X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { customers, workspaces, formatSAR, formatPercent, calculateECR, getStageLabel, getStageColor } from "@/lib/store";
import { generateECRScorecardPDF, openPDFPreview } from "@/lib/pdf-compiler";
import {
  getEcrCustomerIdByName, getLatestScore, getCustomerScores,
  getGradeBg, getGradeColor, mockSnapshots, mockRuleSets,
} from "@/lib/ecr";
import {
  getAllDocumentsByCustomer, getDocumentCounts, getVaultStats,
  searchDocuments, uploadDocument, archiveDocument, hasRealFile,
  initializeMockFiles,
  DOCUMENT_CATEGORIES, DOCUMENT_STATUSES,
  getFileTypeColor, getCategoryIcon,
  type UnifiedDocument, type DocumentCategory, type DocumentStatus,
} from "@/lib/document-vault";
import { DocumentViewer, UploadDialog } from "@/components/DocumentViewer";
import {
  getTendersByCustomer, getTenderStatusDisplayName, getTenderStatusColor,
  type Tender,
} from "@/lib/tender-engine";

const gradeColors: Record<string, string> = { A: "bg-emerald-100 text-emerald-800", B: "bg-blue-100 text-blue-800", C: "bg-amber-100 text-amber-800", D: "bg-orange-100 text-orange-800", F: "bg-red-100 text-red-800" };

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [, forceUpdate] = useState(0);
  const c = customers.find(x => x.id === id);
  if (!c) return <div className="p-6"><h1 className="text-xl font-serif">Customer not found</h1><Link href="/customers"><Button variant="outline" className="mt-4"><ArrowLeft className="w-4 h-4 mr-1.5" />Back</Button></Link></div>;

  const custWorkspaces = workspaces.filter(w => w.customerId === c.id);
  const ecr = calculateECR(c.dso, c.contractValue2025, 22, 0.7, 0.6);

  // ECR v1 integration
  const ecrCustId = getEcrCustomerIdByName(c.name);
  const ecrLatest = ecrCustId ? getLatestScore(ecrCustId) : undefined;
  const ecrScores = ecrCustId ? getCustomerScores(ecrCustId) : [];
  const ecrSnapshots = ecrCustId ? mockSnapshots.filter(s => s.customerId === ecrCustId) : [];

  let ecrTrend: 'up' | 'down' | 'stable' = 'stable';
  if (ecrScores.length >= 2) {
    const sorted = [...ecrScores].sort((a, b) => new Date(b.computedAt).getTime() - new Date(a.computedAt).getTime());
    const diff = sorted[0].totalScore - sorted[1].totalScore;
    if (diff > 2) ecrTrend = 'up';
    else if (diff < -2) ecrTrend = 'down';
  }
  const activeRuleSet = mockRuleSets.find(rs => rs.status === 'active');

  // Tenders for this customer
  const custTenders = getTendersByCustomer(c.id);

  // Documents — vault state
  const [vaultSearch, setVaultSearch] = useState("");
  const [vaultCategory, setVaultCategory] = useState<string>("all");
  const [vaultStatus, setVaultStatus] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null);
  const [viewerDoc, setViewerDoc] = useState<UnifiedDocument | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  // Initialize mock files
  useState(() => { initializeMockFiles(); });

  const vaultStats = getVaultStats(c.id);
  const docCounts = getDocumentCounts(c.id);

  const filteredDocs = useMemo(() => {
    return searchDocuments({
      customerId: c.id,
      category: vaultCategory !== "all" ? vaultCategory as DocumentCategory : undefined,
      status: vaultStatus !== "all" ? vaultStatus as DocumentStatus : undefined,
      search: vaultSearch || undefined,
      includeArchived: showArchived,
    });
  }, [c.id, vaultSearch, vaultCategory, vaultStatus, showArchived]);

  // Group docs by category for folder view
  const docsByCategory = useMemo(() => {
    const grouped: Record<string, UnifiedDocument[]> = {};
    for (const cat of DOCUMENT_CATEGORIES) {
      const docs = filteredDocs.filter(d => d.category === cat);
      if (docs.length > 0) grouped[cat] = docs;
    }
    return grouped;
  }, [filteredDocs]);

  const handleArchive = (doc: UnifiedDocument) => {
    archiveDocument(doc.id);
    toast.success(`"${doc.name}" archived`);
    setViewerDoc(null);
    forceUpdate(n => n + 1);
  };

  return (
    <TooltipProvider>
      <div className="p-6 max-w-[1400px] mx-auto">
        {/* ═══ Header ═══ */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/customers"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-serif font-bold">{c.name}</h1>
              <Badge variant="outline" className={`text-xs ${gradeColors[c.grade] || ""}`}>Grade {c.grade}</Badge>
              {ecrLatest && (
                <Badge variant="outline" className={`text-xs ${getGradeBg(ecrLatest.grade)}`}>
                  <Star className="w-3 h-3 mr-1" />
                  ECR {ecrLatest.grade} · {ecrLatest.totalScore.toFixed(1)}
                </Badge>
              )}
              <span className={`text-xs font-medium ${c.status === "Active" ? "rag-green" : "rag-red"}`}>{c.status}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{c.code} — {c.industry} — {c.region}</p>
          </div>
          <Button variant="outline" onClick={() => { const html = generateECRScorecardPDF(c); openPDFPreview(html, `ECR Scorecard — ${c.name}`); }}>
            <Printer className="w-4 h-4 mr-1.5" />ECR Scorecard PDF
          </Button>
        </div>

        {/* ═══ KPI Strip ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          {[
            { l: "Contract Value", v: formatSAR(c.contractValue2025) },
            { l: "Monthly Revenue", v: formatSAR(c.expectedMonthlyRevenue) },
            { l: "DSO", v: `${c.dso} days`, color: c.dso > 60 ? "rag-red" : c.dso > 45 ? "rag-amber" : undefined },
            { l: "Pallets", v: c.palletContracted.toLocaleString() },
            { l: "ECR Score", v: ecrLatest ? `${ecrLatest.totalScore.toFixed(1)} (${ecrLatest.grade})` : `${ecr.score.toFixed(0)}%`, color: ecrLatest ? getGradeColor(ecrLatest.grade) : undefined },
            { l: "Payment", v: c.paymentStatus, color: c.paymentStatus === "Bad" ? "rag-red" : c.paymentStatus === "Acceptable" ? "rag-amber" : "rag-green" },
          ].map(kpi => (
            <Card key={kpi.l} className="border border-border shadow-none"><CardContent className="p-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{kpi.l}</p>
              <p className={`data-value text-lg font-semibold mt-0.5 ${kpi.color || ""}`}>{kpi.v}</p>
            </CardContent></Card>
          ))}
        </div>

        {/* ═══ Tabs ═══ */}
        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="ecr">
              ECR Scorecard
              {ecrLatest && <Badge variant="outline" className={`ml-1.5 text-[10px] ${getGradeBg(ecrLatest.grade)}`}>{ecrLatest.grade}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="workspaces">Workspaces ({custWorkspaces.length})</TabsTrigger>
            <TabsTrigger value="tenders">Tenders ({custTenders.length})</TabsTrigger>
            <TabsTrigger value="documents">
              <FolderOpen className="w-3.5 h-3.5 mr-1" />Documents ({vaultStats.totalDocuments})
            </TabsTrigger>
            <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          </TabsList>

          {/* ═══ Profile Tab ═══ */}
          <TabsContent value="profile">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border border-border shadow-none"><CardHeader className="pb-3"><CardTitle className="text-base font-serif">Company Details</CardTitle></CardHeader><CardContent className="pt-0 space-y-2">
                {[{ l: "Group", v: c.group }, { l: "City", v: c.city }, { l: "Region", v: c.region }, { l: "Industry", v: c.industry }, { l: "Account Owner", v: c.accountOwner }, { l: "Service Type", v: c.serviceType }, { l: "Facility", v: c.facility }].map(r => (
                  <div key={r.l} className="flex justify-between text-sm"><span className="text-muted-foreground">{r.l}</span><span className="font-medium">{r.v}</span></div>
                ))}
              </CardContent></Card>
              <Card className="border border-border shadow-none"><CardHeader className="pb-3"><CardTitle className="text-base font-serif">Contract & Contact</CardTitle></CardHeader><CardContent className="pt-0 space-y-2">
                {[{ l: "Contract Expiry", v: c.contractExpiry }, { l: "Rate/Pallet", v: `SAR ${c.ratePerPallet}` }, { l: "Contact Name", v: c.contactName }, { l: "Email", v: c.contactEmail }, { l: "Phone", v: c.contactPhone }].map(r => (
                  <div key={r.l} className="flex justify-between text-sm"><span className="text-muted-foreground">{r.l}</span><span className="font-medium">{r.v}</span></div>
                ))}
              </CardContent></Card>
            </div>
          </TabsContent>

          {/* ═══ ECR Scorecard Tab ═══ */}
          <TabsContent value="ecr">
            {ecrLatest ? (
              <div className="space-y-4">
                <Card className="border border-border shadow-none">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-serif flex items-center gap-2">
                        <Star className="w-4 h-4 text-amber-500" />ECR v1 — Existing Customer Rating
                      </CardTitle>
                      <Button variant="outline" size="sm" onClick={() => navigate('/ecr-scoring')}>
                        <ExternalLink className="w-3.5 h-3.5 mr-1" /> Full ECR Details
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-6 p-4 rounded-lg bg-muted mb-4">
                      <div className={`w-16 h-16 rounded-xl flex items-center justify-center border-2 ${getGradeBg(ecrLatest.grade)}`}>
                        <span className="text-3xl font-bold">{ecrLatest.grade}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-3xl font-bold text-foreground">{ecrLatest.totalScore.toFixed(1)}</span>
                          <span className="text-sm text-muted-foreground">/ 100</span>
                          {ecrTrend === 'up' && <TrendingUp className="w-5 h-5 text-emerald-600" />}
                          {ecrTrend === 'down' && <TrendingDown className="w-5 h-5 text-red-500" />}
                          {ecrTrend === 'stable' && <Minus className="w-5 h-5 text-slate-400" />}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Rule Set: {activeRuleSet?.name} · Confidence: {ecrLatest.confidenceScore}% · Computed: {new Date(ecrLatest.computedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {ecrScores.length > 1 && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Score History</p>
                        <div className="flex items-end gap-1 h-12">
                          {[...ecrScores].sort((a, b) => new Date(a.computedAt).getTime() - new Date(b.computedAt).getTime()).map(s => (
                            <div key={s.id} className="flex flex-col items-center gap-0.5 flex-1">
                              <span className="text-[10px] text-muted-foreground">{s.totalScore.toFixed(0)}</span>
                              <div className={`w-full rounded-t ${s.grade === 'A' ? 'bg-emerald-400' : s.grade === 'B' ? 'bg-blue-400' : s.grade === 'C' ? 'bg-amber-400' : 'bg-red-400'}`} style={{ height: `${(s.totalScore / 100) * 32}px` }} />
                              <span className="text-[9px] text-muted-foreground">{new Date(s.computedAt).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="mt-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Input Snapshots ({ecrSnapshots.length})</p>
                      <div className="space-y-1.5">
                        {ecrSnapshots.map(snap => {
                          const score = ecrScores.find(s => s.snapshotId === snap.id);
                          return (
                            <div key={snap.id} className="flex items-center justify-between p-2.5 rounded border border-border text-sm">
                              <div><span className="font-medium">{snap.periodStart} → {snap.periodEnd}</span><span className="text-xs text-muted-foreground ml-2">by {snap.createdBy}</span></div>
                              {score && <Badge variant="outline" className={`text-xs ${getGradeBg(score.grade)}`}>{score.grade} · {score.totalScore.toFixed(1)}</Badge>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="border border-border shadow-none"><CardHeader className="pb-3"><CardTitle className="text-base font-serif">ECR Classification Scorecard</CardTitle></CardHeader><CardContent className="pt-0">
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 mb-4 text-sm text-blue-800">
                  <Star className="w-4 h-4 inline mr-1" />
                  No ECR v1 score available. Showing legacy scorecard. <Button variant="link" className="text-blue-700 p-0 h-auto text-sm" onClick={() => navigate('/ecr-snapshots')}>Create a snapshot →</Button>
                </div>
                <div className="space-y-4">
                  {[{ criteria: "DSO (Days Sales Outstanding)", weight: "30%", score: c.dso <= 30 ? "1.0" : c.dso <= 45 ? "0.5" : "0.0", detail: `${c.dso} days` },
                    { criteria: "Contract Value", weight: "30%", score: c.contractValue2025 > 2000000 ? "1.0" : c.contractValue2025 > 1000000 ? "0.7" : "0.3", detail: formatSAR(c.contractValue2025) },
                    { criteria: "Potential Growth", weight: "10%", score: "0.7", detail: "Volume + Services" },
                    { criteria: "Cost of Acquisition", weight: "10%", score: "0.6", detail: "Operational" }
                  ].map(row => (
                    <div key={row.criteria} className="flex items-center justify-between p-3 rounded border border-border">
                      <div><p className="text-sm font-medium">{row.criteria}</p><p className="text-xs text-muted-foreground">{row.detail}</p></div>
                      <div className="text-right"><span className="data-value text-sm font-semibold">{row.score}</span><p className="text-[10px] text-muted-foreground">Weight: {row.weight}</p></div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                    <span className="text-sm font-semibold">Total ECR Score</span>
                    <div className="flex items-center gap-3">
                      <span className="data-value text-xl font-bold">{ecr.score.toFixed(0)}%</span>
                      <Badge className={`${gradeColors[ecr.grade] || ""}`}>Grade {ecr.grade}</Badge>
                    </div>
                  </div>
                </div>
              </CardContent></Card>
            )}
          </TabsContent>

          {/* ═══ Revenue History Tab ═══ */}
          <TabsContent value="revenue">
            <Card className="border border-border shadow-none"><CardHeader className="pb-3"><CardTitle className="text-base font-serif">Revenue History</CardTitle></CardHeader><CardContent className="pt-0">
              <div className="space-y-3">
                {[{ year: "2023", rev: c.revenue2023 }, { year: "2024", rev: c.revenue2024 }, { year: "2025 (YTD)", rev: c.revenue2025 }].map(r => {
                  const maxRev = Math.max(c.revenue2023, c.revenue2024, c.revenue2025 * 2);
                  const width = maxRev > 0 ? (r.rev / maxRev) * 100 : 0;
                  return (
                    <div key={r.year}>
                      <div className="flex justify-between mb-1"><span className="text-sm font-medium">{r.year}</span><span className="data-value text-sm">{formatSAR(r.rev)}</span></div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${width}%` }} /></div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 grid grid-cols-3 gap-4">
                {[{ l: "Contracted", v: c.palletContracted }, { l: "Occupied", v: c.palletOccupied }, { l: "Potential", v: c.palletPotential }].map(p => (
                  <div key={p.l} className="text-center p-3 rounded border border-border"><p className="text-[10px] text-muted-foreground uppercase">{p.l} Pallets</p><p className="data-value text-lg font-semibold mt-1">{p.v.toLocaleString()}</p></div>
                ))}
              </div>
            </CardContent></Card>
          </TabsContent>

          {/* ═══ Workspaces Tab ═══ */}
          <TabsContent value="workspaces">
            {custWorkspaces.length > 0 ? <div className="space-y-2">{custWorkspaces.map(w => (
              <Link key={w.id} href={`/workspaces/${w.id}`}><div className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3"><div className={`rag-dot ${w.ragStatus === "red" ? "rag-dot-red" : w.ragStatus === "amber" ? "rag-dot-amber" : "rag-dot-green"}`} /><div><p className="text-sm font-medium">{w.title}</p><p className="text-xs text-muted-foreground">{getStageLabel(w.stage)}</p></div></div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={`text-[10px] ${getStageColor(w.stage)}`}>{getStageLabel(w.stage)}</Badge>
                  <span className="data-value text-sm">{formatSAR(w.estimatedValue)}</span>
                </div>
              </div></Link>
            ))}</div> : <Card className="border border-border shadow-none"><CardContent className="py-12 text-center text-sm text-muted-foreground">No active workspaces for this customer</CardContent></Card>}
          </TabsContent>

          {/* ═══ Tenders Tab ═══ */}
          <TabsContent value="tenders">
            {custTenders.length > 0 ? (
              <div className="space-y-2">
                {custTenders.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate("/tenders")}>
                    <div className="flex items-center gap-3">
                      <Gavel className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{t.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Deadline: {t.submissionDeadline} · Owner: {t.assignedOwner}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={`text-[10px] ${getTenderStatusColor(t.status)}`}>
                        {getTenderStatusDisplayName(t.status)}
                      </Badge>
                      <span className="data-value text-sm">{formatSAR(t.estimatedValue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Card className="border border-border shadow-none">
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  No tenders linked to this customer
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ═══ Documents Tab — Client Master Vault ═══ */}
          <TabsContent value="documents">
            {/* Vault Stats Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
              {[
                { l: "Documents", v: String(vaultStats.totalDocuments), icon: FileText },
                { l: "Versions", v: String(vaultStats.totalVersions), icon: Clock },
                { l: "Categories", v: `${vaultStats.categoriesUsed} / ${DOCUMENT_CATEGORIES.length}`, icon: FolderOpen },
                { l: "Linked WS", v: String(vaultStats.linkedWorkspaces), icon: Link2 },
                { l: "Linked Tenders", v: String(vaultStats.linkedTenders), icon: Gavel },
                { l: "Archived", v: String(vaultStats.archivedDocuments), icon: Archive },
              ].map(s => (
                <Card key={s.l} className="border border-border shadow-none">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <s.icon className="w-3 h-3 text-muted-foreground" />
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{s.l}</p>
                    </div>
                    <p className="data-value text-lg font-semibold">{s.v}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Search & Filter Bar */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Search documents..." value={vaultSearch} onChange={e => setVaultSearch(e.target.value)} className="pl-8 h-8 text-sm" />
              </div>
              <Select value={vaultCategory} onValueChange={setVaultCategory}>
                <SelectTrigger className="w-[160px] h-8 text-sm"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {DOCUMENT_CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{getCategoryIcon(cat)} {cat} ({docCounts[cat]})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={vaultStatus} onValueChange={setVaultStatus}>
                <SelectTrigger className="w-[130px] h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {DOCUMENT_STATUSES.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant={showArchived ? "default" : "outline"} size="sm" className="h-8 text-xs" onClick={() => setShowArchived(!showArchived)}>
                <Archive className="w-3 h-3 mr-1" />{showArchived ? "Showing Archived" : "Show Archived"}
              </Button>
              <Button size="sm" className="h-8 text-xs ml-auto" onClick={() => setShowUpload(true)}>
                <Upload className="w-3 h-3 mr-1" />Upload Document
              </Button>
            </div>

            {/* Upload Dialog */}
            <UploadDialog
              open={showUpload}
              onClose={() => setShowUpload(false)}
              onUpload={({ name, category, file, notes, tags }) => {
                uploadDocument({
                  name,
                  category: category as DocumentCategory,
                  customerId: c.id,
                  customerName: c.name,
                  file,
                  notes,
                  tags,
                });
                toast.success(`Document "${name}" uploaded to ${category}`);
                forceUpdate(n => n + 1);
              }}
            />

            {/* Folder View */}
            {Object.keys(docsByCategory).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(docsByCategory).map(([cat, docs]) => (
                  <Card key={cat} className="border border-border shadow-none">
                    <div
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setExpandedFolder(expandedFolder === cat ? null : cat)}
                    >
                      {expandedFolder === cat ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      <span className="text-base">{getCategoryIcon(cat as DocumentCategory)}</span>
                      <span className="text-sm font-medium">{cat}</span>
                      <Badge variant="secondary" className="text-[10px] ml-auto">{docs.length}</Badge>
                    </div>
                    {expandedFolder === cat && (
                      <div className="border-t border-border">
                        {docs.map(doc => (
                          <Tooltip key={doc.id}>
                            <TooltipTrigger asChild>
                              <div
                                className={`flex items-center gap-3 px-4 py-2.5 transition-colors border-b border-border last:border-b-0 ${
                                  hasRealFile(doc) ? "hover:bg-muted/30 cursor-pointer" : "opacity-60"
                                }`}
                                onClick={() => { if (hasRealFile(doc)) setViewerDoc(doc); }}
                              >
                                <Badge variant="outline" className={`text-[9px] shrink-0 ${getFileTypeColor(doc.fileType)}`}>{doc.fileType}</Badge>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{doc.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{doc.fileName} · v{doc.currentVersion} · {doc.uploadedBy} · {doc.uploadDate}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {doc.workspaceId && (
                                    <Badge variant="outline" className="text-[9px] border-blue-200 text-blue-700">
                                      <Briefcase className="w-2.5 h-2.5 mr-0.5" />WS
                                    </Badge>
                                  )}
                                  {doc.tenderId && (
                                    <Badge variant="outline" className="text-[9px] border-violet-200 text-violet-700">
                                      <Gavel className="w-2.5 h-2.5 mr-0.5" />TN
                                    </Badge>
                                  )}
                                  <Badge variant={doc.status === "Final" ? "default" : doc.status === "Draft" ? "secondary" : doc.status === "Archived" ? "outline" : "secondary"} className="text-[9px]">
                                    {doc.status}
                                  </Badge>
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs p-3">
                              <div className="space-y-1.5 text-xs">
                                <p className="font-semibold">{doc.name}</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                  <span className="text-muted-foreground">Category:</span><span>{doc.category}</span>
                                  <span className="text-muted-foreground">File:</span><span>{doc.fileName}</span>
                                  <span className="text-muted-foreground">Size:</span><span>{doc.fileSize}</span>
                                  <span className="text-muted-foreground">Version:</span><span>v{doc.currentVersion}</span>
                                  <span className="text-muted-foreground">Uploaded:</span><span>{doc.uploadDate}</span>
                                  <span className="text-muted-foreground">By:</span><span>{doc.uploadedBy}</span>
                                  <span className="text-muted-foreground">Permission:</span><span>{doc.permissionLevel}</span>
                                  {doc.workspaceName && <><span className="text-muted-foreground">Workspace:</span><span>{doc.workspaceName}</span></>}
                                  {doc.tenderName && <><span className="text-muted-foreground">Tender:</span><span>{doc.tenderName}</span></>}
                                </div>
                                {doc.notes && <p className="text-muted-foreground mt-1 italic">{doc.notes}</p>}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border border-border shadow-none">
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  {vaultSearch || vaultCategory !== "all" || vaultStatus !== "all"
                    ? "No documents match the current filters"
                    : "No documents in the vault for this customer"}
                </CardContent>
              </Card>
            )}

            {/* Document Viewer Modal */}
            <DocumentViewer document={viewerDoc} open={!!viewerDoc} onClose={() => setViewerDoc(null)} />
          </TabsContent>

          {/* ═══ Opportunities Tab ═══ */}
          <TabsContent value="opportunities">
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
                <Briefcase className="w-4 h-4 inline mr-1" />
                Opportunities are derived from active Workspaces and Tenders. Each workspace represents a commercial opportunity in the pipeline.
              </div>
              {custWorkspaces.length > 0 || custTenders.length > 0 ? (
                <div className="space-y-2">
                  {custWorkspaces.map(w => (
                    <Link key={w.id} href={`/workspaces/${w.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Briefcase className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{w.title}</p>
                            <p className="text-xs text-muted-foreground">Workspace · {getStageLabel(w.stage)} · {w.owner}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={`text-[10px] ${getStageColor(w.stage)}`}>{getStageLabel(w.stage)}</Badge>
                          <span className="data-value text-sm">{formatSAR(w.estimatedValue)}</span>
                          <span className="text-xs text-muted-foreground">GP {formatPercent(w.gpPercent)}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                  {custTenders.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate("/tenders")}>
                      <div className="flex items-center gap-3">
                        <Gavel className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{t.title}</p>
                          <p className="text-xs text-muted-foreground">Tender · {getTenderStatusDisplayName(t.status)} · {t.assignedOwner}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={`text-[10px] ${getTenderStatusColor(t.status)}`}>{getTenderStatusDisplayName(t.status)}</Badge>
                        <span className="data-value text-sm">{formatSAR(t.estimatedValue)}</span>
                        <span className="text-xs text-muted-foreground">{t.probabilityPercent}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Card className="border border-border shadow-none">
                  <CardContent className="py-12 text-center text-sm text-muted-foreground">
                    No opportunities for this customer
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
