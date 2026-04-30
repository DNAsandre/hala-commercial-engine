/*
 * Document Engine — PDF Compiler, Versioning, CRM Export
 * Swiss Precision Instrument Design
 * Generates Hala-branded PDFs for all document types
 *
 * Sprint 6 Fix: All previews open in-app modal, never new tab/print dialog.
 */

import { useState, useCallback } from "react";
import { Link } from "wouter";
import {
  FileText,
  Download,
  Plus,
  Eye,
  Send,
  FileCheck,
  Calculator,
  Users,
  ClipboardList,
  CheckCircle,
  Clock,
  AlertTriangle,
  X,
  ArrowLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  workspaces,
  customers,
  quotes,
  proposals,
} from "@/lib/store";
import {
  generateQuotePDF,
  generateProposalPDF,
  generatePnLPDF,
  generateECRScorecardPDF,
  generateSLAPDF,
} from "@/lib/pdf-compiler";
import type { PDFDocumentType } from "@/lib/pdf-compiler";
import { navigationV1 } from "@/components/DashboardLayout";

interface GeneratedDoc {
  id: string;
  name: string;
  type: PDFDocumentType;
  workspace?: string;
  customer: string;
  date: string;
  version: number;
  crmExported: boolean;
}

const mockGeneratedDocs: GeneratedDoc[] = [
  { id: "d1", name: "Unilever Arabia — Warehousing Quote v1", type: "quote", workspace: "Unilever Dammam New SOW", customer: "Unilever Arabia", date: "2026-02-08", version: 1, crmExported: true },
  { id: "d2", name: "Aramco Services — VAS Expansion Proposal v3", type: "proposal", workspace: "Aramco Dhahran VAS Expansion", customer: "Aramco Services", date: "2026-01-15", version: 3, crmExported: true },
  { id: "d3", name: "Sadara Chemical — Quote v2", type: "quote", workspace: "Sadara Contract Renewal 2025", customer: "Sadara Chemical", date: "2026-01-20", version: 2, crmExported: false },
  { id: "d4", name: "Ma'aden Jubail — P&L Summary", type: "pnl", workspace: "Ma'aden Jubail Expansion 2500PP", customer: "Ma'aden", date: "2026-02-10", version: 1, crmExported: false },
  { id: "d5", name: "Nestlé KSA — SLA Draft v1", type: "sla", workspace: "Nestlé Jeddah Cold Chain", customer: "Nestlé KSA", date: "2026-02-11", version: 1, crmExported: false },
  { id: "d6", name: "SABIC — ECR Scorecard", type: "ecr_scorecard", customer: "SABIC", date: "2026-02-12", version: 1, crmExported: false },
  { id: "d7", name: "Almarai — ECR Scorecard", type: "ecr_scorecard", customer: "Almarai", date: "2026-02-12", version: 1, crmExported: false },
  { id: "d8", name: "Bayer Middle East — Proposal v1", type: "proposal", workspace: "Bayer Pharma Logistics", customer: "Bayer Middle East", date: "2026-02-09", version: 1, crmExported: true },
];

const typeIcons: Record<PDFDocumentType, React.ElementType> = {
  quote: FileText,
  proposal: FileCheck,
  pnl: Calculator,
  ecr_scorecard: Users,
  sla: ClipboardList,
  composer: FileText,
};

const typeLabels: Record<PDFDocumentType, string> = {
  quote: "Quote",
  proposal: "Proposal",
  pnl: "P&L Summary",
  ecr_scorecard: "ECR Scorecard",
  sla: "SLA",
  composer: "Composed Document",
};

const typeColors: Record<PDFDocumentType, string> = {
  quote: "bg-blue-100 text-blue-800",
  proposal: "bg-indigo-100 text-indigo-800",
  pnl: "bg-emerald-100 text-emerald-800",
  ecr_scorecard: "bg-violet-100 text-violet-800",
  sla: "bg-teal-100 text-teal-800",
  composer: "bg-amber-100 text-amber-800",
};

export default function Documents() {
  const [generateOpen, setGenerateOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<PDFDocumentType>("quote");
  const [selectedWorkspace, setSelectedWorkspace] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [docs] = useState(mockGeneratedDocs);

  // In-app PDF preview state (replaces window.open + print)
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");

  /** Open PDF in an in-app modal instead of a new browser tab */
  const openInAppPreview = useCallback((html: string, title: string) => {
    setPreviewHtml(html);
    setPreviewTitle(title);
    setPreviewOpen(true);
  }, []);

  /** Download the generated HTML as a file */
  const handleDownloadHtml = useCallback(() => {
    if (!previewHtml) return;
    const blob = new Blob([previewHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${previewTitle.replace(/[^a-zA-Z0-9]/g, "_")}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Document downloaded");
  }, [previewHtml, previewTitle]);

  const handleGenerate = () => {
    if (selectedType === "ecr_scorecard") {
      const customer = customers.find(c => c.id === selectedCustomer);
      if (!customer) {
        toast.error("Please select a customer");
        return;
      }
      const html = generateECRScorecardPDF(customer);
      openInAppPreview(html, `ECR Scorecard — ${customer.name}`);
      toast.success("ECR Scorecard generated", { description: `${customer.name} — Grade ${customer.grade}` });
    } else {
      const ws = workspaces.find(w => w.id === selectedWorkspace);
      if (!ws) {
        toast.error("Please select a workspace");
        return;
      }
      const customer = customers.find(c => c.id === ws.customerId);
      if (!customer) {
        toast.error("Customer not found for workspace");
        return;
      }

      if (selectedType === "quote") {
        const quote = quotes.find(q => q.workspaceId === ws.id);
        if (!quote) {
          toast.error("No quote found for this workspace");
          return;
        }
        const html = generateQuotePDF(quote, ws, customer);
        openInAppPreview(html, `Quote — ${customer.name}`);
        toast.success("Quote PDF generated", { description: `${customer.name} — v${quote.version}` });
      } else if (selectedType === "proposal") {
        const proposal = proposals.find(p => p.workspaceId === ws.id);
        if (!proposal) {
          toast.error("No proposal found for this workspace");
          return;
        }
        const html = generateProposalPDF(proposal, ws, customer);
        openInAppPreview(html, `Proposal — ${customer.name}`);
        toast.success("Proposal PDF generated", { description: `${customer.name} — v${proposal.version}` });
      } else if (selectedType === "pnl") {
        const quote = quotes.find(q => q.workspaceId === ws.id);
        if (!quote) {
          toast.error("No quote found for P&L calculation");
          return;
        }
        const html = generatePnLPDF(ws, customer, quote);
        openInAppPreview(html, `P&L Summary — ${customer.name}`);
        toast.success("P&L Summary generated", { description: customer.name });
      } else if (selectedType === "sla") {
        const html = generateSLAPDF(ws, customer);
        openInAppPreview(html, `SLA — ${customer.name}`);
        toast.success("SLA document generated", { description: customer.name });
      }
    }
    setGenerateOpen(false);
  };

  const handleExportToCRM = (doc: GeneratedDoc) => {
    toast.success("Exported to Zoho CRM", {
      description: `${doc.name} attached to CRM deal record`,
    });
  };

  const handlePreview = (doc: GeneratedDoc) => {
    // Generate HTML and open in-app modal (NOT new tab)
    if (doc.type === "ecr_scorecard") {
      const customer = customers.find(c => c.name === doc.customer);
      if (customer) {
        const html = generateECRScorecardPDF(customer);
        openInAppPreview(html, doc.name);
      }
    } else {
      const ws = workspaces.find(w => w.title === doc.workspace);
      if (ws) {
        const customer = customers.find(c => c.id === ws.customerId);
        if (customer) {
          if (doc.type === "quote") {
            const quote = quotes.find(q => q.workspaceId === ws.id);
            if (quote) openInAppPreview(generateQuotePDF(quote, ws, customer), doc.name);
          } else if (doc.type === "proposal") {
            const proposal = proposals.find(p => p.workspaceId === ws.id);
            if (proposal) openInAppPreview(generateProposalPDF(proposal, ws, customer), doc.name);
          } else if (doc.type === "pnl") {
            const quote = quotes.find(q => q.workspaceId === ws.id);
            if (quote) openInAppPreview(generatePnLPDF(ws, customer, quote), doc.name);
          } else if (doc.type === "sla") {
            openInAppPreview(generateSLAPDF(ws, customer), doc.name);
          }
        }
      }
    }
    toast.info("Opening document preview...");
  };

  const filteredDocs = (type: string) =>
    type === "all" ? docs : docs.filter(d => d.type === type);

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Prototype Data Banner */}
      <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-4 py-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Legacy shell — placeholder data only</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
            This page displays sample documents and is not connected to the live document pipeline. Use the Document Composer inside a workspace to generate real outputs.
          </p>
        </div>
      </div>

      {/* Legacy Banner */}
      {navigationV1 && (
        <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 flex items-center gap-2">
          <span className="text-xs text-amber-800">This page is now accessible via <a href="/admin" className="underline font-semibold hover:text-amber-900">Admin</a> or <a href="/workspaces" className="underline font-semibold hover:text-amber-900">Workspace</a>.</span>
        </div>
      )}
      {/* Back Button */}
      <div className="mb-4">
        <Link href="/admin-panel">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Admin
          </Button>
        </Link>
      </div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold">Document Engine</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            PDF compiler, versioning, and CRM export — {docs.length} documents
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="default"
            onClick={() => setGenerateOpen(true)}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Generate PDF
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {(["quote", "proposal", "pnl", "ecr_scorecard", "sla"] as PDFDocumentType[]).map(type => {
          const Icon = typeIcons[type];
          const count = docs.filter(d => d.type === type).length;
          return (
            <Card key={type} className="border border-border shadow-none">
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${typeColors[type]}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-lg font-bold font-mono">{count}</div>
                  <div className="text-[10px] text-muted-foreground">{typeLabels[type]}s</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Document List */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All ({docs.length})</TabsTrigger>
          <TabsTrigger value="quote">Quotes</TabsTrigger>
          <TabsTrigger value="proposal">Proposals</TabsTrigger>
          <TabsTrigger value="pnl">P&L</TabsTrigger>
          <TabsTrigger value="ecr_scorecard">ECR</TabsTrigger>
          <TabsTrigger value="sla">SLAs</TabsTrigger>
        </TabsList>

        {["all", "quote", "proposal", "pnl", "ecr_scorecard", "sla"].map(tab => (
          <TabsContent key={tab} value={tab}>
            <Card className="border border-border shadow-none">
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {filteredDocs(tab).map(doc => {
                    const Icon = typeIcons[doc.type];
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center gap-4 p-4 hover:bg-accent/30 transition-colors group cursor-pointer"
                        onClick={() => handlePreview(doc)}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${typeColors[doc.type]}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{doc.name}</span>
                            <Badge variant="outline" className={`text-[10px] shrink-0 ${typeColors[doc.type]}`}>
                              {typeLabels[doc.type]}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            {doc.workspace && (
                              <span className="text-xs text-muted-foreground truncate">{doc.workspace}</span>
                            )}
                            <span className="text-xs text-muted-foreground">v{doc.version}</span>
                            <span className="text-xs text-muted-foreground font-mono">{doc.date}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {doc.crmExported ? (
                            <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 gap-1">
                              <CheckCircle className="w-3 h-3" />
                              CRM
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 gap-1">
                              <Clock className="w-3 h-3" />
                              Pending
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => { e.stopPropagation(); handlePreview(doc); }}
                            title="Preview document"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs px-2"
                            onClick={(e) => { e.stopPropagation(); handleExportToCRM(doc); }}
                            title="Export to Zoho CRM"
                          >
                            <Send className="w-3.5 h-3.5 mr-1" />
                            CRM
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* CRM Export Info */}
      <Card className="border border-border shadow-none mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-serif flex items-center gap-2">
            <Send className="w-4 h-4" />
            CRM Export Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg border border-border">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium">Exported</span>
              </div>
              <div className="text-2xl font-bold font-mono">{docs.filter(d => d.crmExported).length}</div>
              <p className="text-xs text-muted-foreground mt-1">Documents synced to Zoho CRM</p>
            </div>
            <div className="p-3 rounded-lg border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium">Pending Export</span>
              </div>
              <div className="text-2xl font-bold font-mono">{docs.filter(d => !d.crmExported).length}</div>
              <p className="text-xs text-muted-foreground mt-1">Ready for CRM attachment</p>
            </div>
            <div className="p-3 rounded-lg border border-border">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">CRM Status</span>
              </div>
              <div className="text-sm font-medium mt-1">Mock Mode</div>
              <p className="text-xs text-muted-foreground mt-1">Connect Zoho API to enable live export</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generate PDF Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Generate PDF Document</DialogTitle>
            <DialogDescription>
              Select a document type and source to compile a Hala-branded PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Document Type
              </label>
              <Select value={selectedType} onValueChange={(v) => setSelectedType(v as PDFDocumentType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quote">Quote</SelectItem>
                  <SelectItem value="proposal">Proposal</SelectItem>
                  <SelectItem value="pnl">P&L Summary</SelectItem>
                  <SelectItem value="sla">SLA</SelectItem>
                  <SelectItem value="ecr_scorecard">ECR Scorecard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedType !== "ecr_scorecard" ? (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Workspace
                </label>
                <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select workspace..." />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map(ws => (
                      <SelectItem key={ws.id} value={ws.id}>
                        {ws.customerName} — {ws.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Customer
                </label>
                <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.filter(c => c.status === "Active").map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} — Grade {c.grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="p-3 rounded-lg bg-muted text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">What you'll get:</p>
              {selectedType === "quote" && <p>Professional quote with pricing schedule, financial summary, approval requirements, and terms.</p>}
              {selectedType === "proposal" && <p>Full commercial proposal with executive summary, scope of work, and workspace details.</p>}
              {selectedType === "pnl" && <p>P&L breakdown with revenue lines, cost categories, and profitability analysis.</p>}
              {selectedType === "sla" && <p>Service Level Agreement with KPIs, targets, penalties, and escalation matrix.</p>}
              {selectedType === "ecr_scorecard" && <p>Customer classification scorecard with 5-criteria ECR scoring, grade, and performance data.</p>}
            </div>

            <Button className="w-full" onClick={handleGenerate}>
              <FileText className="w-4 h-4 mr-1.5" />
              Generate & Preview
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* In-App PDF Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogTitle className="sr-only">{previewTitle || 'Document Preview'}</DialogTitle>
          <div className="px-6 pt-5 pb-3 border-b border-border/50 flex items-center justify-between flex-shrink-0">
            <div>
              <h3 className="text-lg font-serif font-semibold">{previewTitle}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Generated PDF preview — in-app viewer</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" onClick={handleDownloadHtml} className="gap-1.5">
                <Download className="h-3.5 w-3.5" />
                Download
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPreviewOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-muted/30">
            {previewHtml ? (
              <iframe
                srcDoc={previewHtml}
                className="w-full h-full min-h-[600px] border-0"
                title={previewTitle}
                sandbox="allow-same-origin"
              />
            ) : (
              <div className="flex items-center justify-center h-full min-h-[400px]">
                <p className="text-muted-foreground">No preview available</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
