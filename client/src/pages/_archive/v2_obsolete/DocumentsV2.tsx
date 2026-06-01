import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Upload, Filter, ExternalLink, Plus, RefreshCw } from "lucide-react";

// ─── CATEGORIES ───────────────────────────────────────────────
const DOC_CATEGORIES = [
  { value: "technical", label: "Technical" },
  { value: "commercial", label: "Commercial" },
  { value: "legal", label: "Legal" },
  { value: "finance", label: "Finance" },
  { value: "submission_pack", label: "Submission Pack" },
  { value: "proposal_draft", label: "Proposal Draft" },
  { value: "pricing_sheet", label: "Pricing Sheet" },
  { value: "sla_draft", label: "SLA Draft" },
  { value: "contract_draft", label: "Contract Draft" },
  { value: "compliance_cert", label: "Compliance Cert" },
  { value: "insurance_cert", label: "Insurance Cert" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "expired", label: "Expired" },
];

function categoryLabel(val: string) {
  return DOC_CATEGORIES.find(c => c.value === val)?.label || val;
}

interface DocRow {
  id: string;
  parent_type: string;
  parent_id: string;
  document_type: string;
  file_name: string;
  uploaded_by: string;
  status: string;
  notes: string;
  file_url: string | null;
  created_at: string;
  updated_at: string;
}

export default function DocumentsV2() {
  const user = getCurrentUser();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterParent, setFilterParent] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);

  // Upload form
  const [parentType, setParentType] = useState("proposal");
  const [parentId, setParentId] = useState("");
  const [fileName, setFileName] = useState("");
  const [docType, setDocType] = useState("technical");
  const [docNotes, setDocNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Parent records for dropdown
  const [proposals, setProposals] = useState<any[]>([]);
  const [tenders, setTenders] = useState<any[]>([]);

  useEffect(() => {
    loadDocs();
    loadParents();
  }, []);

  async function loadDocs() {
    setLoading(true);
    let query = supabase
      .from("commercial_v2_documents")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (filterCategory !== "all") query = query.eq("document_type", filterCategory);
    if (filterParent !== "all") query = query.eq("parent_type", filterParent);
    if (filterStatus !== "all") query = query.eq("status", filterStatus);

    const { data, error } = await query;
    if (error) console.error("Failed to load docs:", error);
    setDocs((data ?? []) as DocRow[]);
    setLoading(false);
  }

  async function loadParents() {
    const [{ data: p }, { data: t }] = await Promise.all([
      supabase.from("commercial_v2_proposals").select("id, customer_name").order("created_at", { ascending: false }).limit(100),
      supabase.from("commercial_v2_tenders").select("id, customer_name, tender_ref").order("created_at", { ascending: false }).limit(100),
    ]);
    setProposals(p || []);
    setTenders(t || []);
  }

  useEffect(() => {
    loadDocs();
  }, [filterCategory, filterParent, filterStatus]);

  async function handleUpload() {
    if (!fileName.trim() || !parentId) return;
    setSubmitting(true);
    try {
      await supabase.rpc("commercial_v2_create_document", {
        params: JSON.stringify({
          parent_type: parentType,
          parent_id: parentId,
          document_type: docType,
          file_name: fileName,
          uploaded_by: user?.name || "system",
          notes: docNotes,
        }),
      });
      setUploadOpen(false);
      setFileName(""); setDocNotes(""); setParentId("");
      loadDocs();
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  }

  async function handleStatusChange(docId: string, newStatus: string) {
    await supabase.from("commercial_v2_documents")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", docId);
    loadDocs();
  }

  const filtered = docs.filter(d => {
    if (!search) return true;
    const s = search.toLowerCase();
    return d.file_name?.toLowerCase().includes(s) ||
      d.uploaded_by?.toLowerCase().includes(s) ||
      d.notes?.toLowerCase().includes(s);
  });

  const parentRecords = parentType === "proposal" ? proposals : tenders;

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Documents V.2</h1>
          <p className="text-sm text-muted-foreground">
            Metadata-first document registry — all records parent-linked to Proposal or Tender
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={loadDocs} className="gap-1">
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setUploadOpen(true)} className="gap-1">
            <Plus className="h-3 w-3" /> Add Document
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Search filename, uploader..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-64"
        />
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {DOC_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterParent} onValueChange={setFilterParent}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Parent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Parents</SelectItem>
            <SelectItem value="proposal">Proposal</SelectItem>
            <SelectItem value="tender">Tender</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} documents</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
          <FileText className="h-8 w-8 opacity-30" />
          <p>No documents found</p>
          <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)} className="gap-1">
            <Plus className="h-3 w-3" /> Add First Document
          </Button>
        </div>
      ) : (
        <div className="rounded border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Uploaded By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium text-sm">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      {d.file_name || "Unnamed"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {categoryLabel(d.document_type)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {d.parent_type}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground ml-1 font-mono">
                      {d.parent_id?.slice(0, 8)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{d.uploaded_by || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(d.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Select value={d.status} onValueChange={v => handleStatusChange(d.id, v)}>
                      <SelectTrigger className="w-28 h-7 text-[10px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {d.notes || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Document</DialogTitle>
            <DialogDescription>
              Register a new document record. Select parent (Proposal or Tender) and category.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">File Name *</Label>
              <Input value={fileName} onChange={e => setFileName(e.target.value)} placeholder="e.g. SABIC_SOW_v2.pdf" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Parent Type *</Label>
                <Select value={parentType} onValueChange={v => { setParentType(v); setParentId(""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="proposal">Proposal</SelectItem>
                    <SelectItem value="tender">Tender</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Parent Record *</Label>
                <Select value={parentId} onValueChange={setParentId}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {parentRecords.map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.customer_name || "Unnamed"} ({r.id.slice(0, 6)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Category *</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea value={docNotes} onChange={e => setDocNotes(e.target.value)} rows={2} placeholder="Version, description, changes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={!fileName.trim() || !parentId || submitting}>
              {submitting ? "Saving..." : "Add Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}