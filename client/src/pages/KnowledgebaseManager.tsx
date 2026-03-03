/**
 * Admin — Knowledgebase Manager
 * Sprint 11: Collections, document upload/paste, chunk viewer
 *
 * Design: Swiss Precision Instrument
 * Deep navy accents, IBM Plex Sans typography
 */
import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import {
  Database, Plus, Trash2, FileText, Upload, ChevronRight, ChevronDown,
  Eye, Search, BookOpen, Layers, X, FolderOpen, Hash, Clock,
  ArrowLeft, AlertTriangle, CheckCircle, Loader2, Copy,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  fetchCollections,
  createCollection,
  deleteCollection,
  fetchDocuments,
  addDocument,
  softDeleteDocument,
  fetchChunksForDocument,
  type KBCollection,
  type KBDocument,
  type KBChunk,
} from "@/lib/knowledgebase";

// ── Collection List View ──────────────────────────────────────

function CollectionCard({
  collection,
  onSelect,
  onDelete,
}: {
  collection: KBCollection;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <Card
      className="cursor-pointer hover:border-[#1B2A4A]/30 transition-colors group"
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[#1B2A4A]/5 flex items-center justify-center flex-shrink-0 mt-0.5">
              <FolderOpen className="w-5 h-5 text-[#1B2A4A]" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate">{collection.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{collection.description}</p>
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="outline" className="text-[10px]">
                  <FileText className="w-3 h-3 mr-1" />
                  {collection.doc_count || 0} docs
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  <Hash className="w-3 h-3 mr-1" />
                  {collection.chunk_count || 0} chunks
                </Badge>
                <Badge
                  variant={collection.visibility === "admin-only" ? "destructive" : "secondary"}
                  className="text-[10px]"
                >
                  {collection.visibility}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Create Collection Dialog ──────────────────────────────────

function CreateCollectionForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"internal" | "admin-only">("internal");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error("Collection name is required"); return; }
    setCreating(true);
    try {
      await createCollection({ name: name.trim(), description: description.trim(), visibility });
      toast.success(`Collection "${name}" created`);
      onCreated();
    } catch (err) {
      toast.error("Failed to create collection");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card className="border-dashed border-[#1B2A4A]/30">
      <CardContent className="p-4 space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Collection
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Legal Templates"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Visibility</Label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as "internal" | "admin-only")}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Internal (all users)</SelectItem>
                <SelectItem value="admin-only">Admin Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-xs">Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What kind of documents will this collection contain?"
            className="mt-1"
            rows={2}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" onClick={handleCreate} disabled={creating}>
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
            Create
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Document List + Upload View ───────────────────────────────

function CollectionDetail({
  collection,
  onBack,
}: {
  collection: KBCollection;
  onBack: () => void;
}) {
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [chunks, setChunks] = useState<Map<string, KBChunk[]>>(new Map());

  const loadDocs = useCallback(async () => {
    setLoading(true);
    const docs = await fetchDocuments(collection.id);
    setDocuments(docs);
    setLoading(false);
  }, [collection.id]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleDelete = async (docId: string) => {
    await softDeleteDocument(docId, collection.id);
    toast.success("Document removed");
    loadDocs();
  };

  const handleExpandDoc = async (docId: string) => {
    if (expandedDoc === docId) {
      setExpandedDoc(null);
      return;
    }
    setExpandedDoc(docId);
    if (!chunks.has(docId)) {
      const docChunks = await fetchChunksForDocument(docId);
      setChunks(prev => {
        const next = new Map(prev);
        next.set(docId, docChunks);
        return next;
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-lg font-serif font-semibold flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-[#1B2A4A]" />
              {collection.name}
            </h2>
            <p className="text-xs text-muted-foreground">{collection.description}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setShowPaste(true); setShowUpload(false); }}>
            <Copy className="w-3.5 h-3.5 mr-1.5" /> Paste Text
          </Button>
          <Button size="sm" onClick={() => { setShowUpload(true); setShowPaste(false); }}>
            <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload File
          </Button>
        </div>
      </div>

      {/* Upload Form */}
      {showUpload && (
        <UploadForm
          collectionId={collection.id}
          onDone={() => { setShowUpload(false); loadDocs(); }}
          onCancel={() => setShowUpload(false)}
        />
      )}

      {/* Paste Form */}
      {showPaste && (
        <PasteForm
          collectionId={collection.id}
          onDone={() => { setShowPaste(false); loadDocs(); }}
          onCancel={() => setShowPaste(false)}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-[#1B2A4A]">{documents.length}</div>
            <div className="text-[10px] text-muted-foreground">Documents</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-blue-600">{collection.chunk_count || 0}</div>
            <div className="text-[10px] text-muted-foreground">Chunks</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-emerald-600">
              {documents.reduce((sum, d) => sum + (d.size || 0), 0) > 1000
                ? `${(documents.reduce((sum, d) => sum + (d.size || 0), 0) / 1000).toFixed(1)}K`
                : documents.reduce((sum, d) => sum + (d.size || 0), 0)}
            </div>
            <div className="text-[10px] text-muted-foreground">Characters</div>
          </CardContent>
        </Card>
      </div>

      {/* Document List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : documents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <BookOpen className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No documents yet. Upload a file or paste text to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {documents.map(doc => (
            <Card key={doc.id} className="overflow-hidden">
              <div
                className="p-3 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => handleExpandDoc(doc.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-4 h-4 text-[#1B2A4A] flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{doc.title}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px]">{doc.source_type}</Badge>
                      <span className="text-[10px] text-muted-foreground">{doc.chunk_count} chunks</span>
                      <span className="text-[10px] text-muted-foreground">
                        {doc.size ? `${(doc.size / 1000).toFixed(1)}K chars` : ""}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  {expandedDoc === doc.id
                    ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>

              {/* Expanded: show chunks */}
              {expandedDoc === doc.id && (
                <div className="border-t bg-muted/20 p-3 space-y-2">
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    Chunks ({chunks.get(doc.id)?.length || 0})
                  </div>
                  {(chunks.get(doc.id) || []).map(chunk => (
                    <div key={chunk.id} className="bg-background rounded-md p-2.5 border text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-[10px]">
                          <Hash className="w-3 h-3 mr-0.5" />
                          Chunk {chunk.chunk_index}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {chunk.content.length} chars
                        </span>
                      </div>
                      <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {chunk.content.substring(0, 300)}
                        {chunk.content.length > 300 ? "..." : ""}
                      </p>
                    </div>
                  ))}
                  {(!chunks.get(doc.id) || chunks.get(doc.id)!.length === 0) && (
                    <p className="text-xs text-muted-foreground text-center py-2">No chunks generated</p>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Upload Form ───────────────────────────────────────────────

function UploadForm({
  collectionId,
  onDone,
  onCancel,
}: {
  collectionId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) { toast.error("Please select a file"); return; }
    if (!title.trim()) { toast.error("Please enter a title"); return; }

    // Only support .txt and .md for v1
    if (!file.name.endsWith(".txt") && !file.name.endsWith(".md")) {
      toast.error("Only .txt and .md files are supported in v1");
      return;
    }

    setUploading(true);
    try {
      const text = await file.text();
      if (!text.trim()) {
        toast.error("File is empty");
        setUploading(false);
        return;
      }

      const result = await addDocument({
        collectionId,
        title: title.trim(),
        sourceType: "upload",
        textContent: text,
        mime: file.type || "text/plain",
      });

      toast.success(`Uploaded "${title}" — ${result.chunks.length} chunks created`);
      onDone();
    } catch (err) {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="border-dashed border-blue-300">
      <CardContent className="p-4 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Upload className="w-4 h-4" /> Upload Document
        </h3>
        <div>
          <Label className="text-xs">Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Standard T&C Template v3"
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">File (.txt or .md)</Label>
          <Input
            type="file"
            accept=".txt,.md"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="mt-1"
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          v1 supports .txt and .md files. PDF support coming in v1.1.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" onClick={handleUpload} disabled={uploading}>
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
            Upload & Chunk
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Paste Form ────────────────────────────────────────────────

function PasteForm({
  collectionId,
  onDone,
  onCancel,
}: {
  collectionId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Please enter a title"); return; }
    if (!text.trim()) { toast.error("Please enter some text content"); return; }

    setSaving(true);
    try {
      const result = await addDocument({
        collectionId,
        title: title.trim(),
        sourceType: "manual",
        textContent: text.trim(),
      });

      toast.success(`Added "${title}" — ${result.chunks.length} chunks created`);
      onDone();
    } catch (err) {
      toast.error("Failed to add document");
    } finally {
      setSaving(false);
    }
  };

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  return (
    <Card className="border-dashed border-emerald-300">
      <CardContent className="p-4 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Copy className="w-4 h-4" /> Paste Text Document
        </h3>
        <div>
          <Label className="text-xs">Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. SLA Framework Reference"
            className="mt-1"
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Content</Label>
            <span className="text-[10px] text-muted-foreground">{wordCount} words</span>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your document text here..."
            className="mt-1 font-mono text-xs"
            rows={8}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle className="w-3.5 h-3.5 mr-1" />}
            Save & Chunk
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function KnowledgebaseManager() {
  const [collections, setCollections] = useState<KBCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState<KBCollection | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");

  const loadCollections = useCallback(async () => {
    setLoading(true);
    const cols = await fetchCollections();
    setCollections(cols);
    setLoading(false);
  }, []);

  useEffect(() => { loadCollections(); }, [loadCollections]);

  const handleDelete = async (colId: string) => {
    if (!confirm("Delete this collection and all its documents?")) return;
    await deleteCollection(colId);
    toast.success("Collection deleted");
    loadCollections();
  };

  const filtered = collections.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.description.toLowerCase().includes(search.toLowerCase())
  );

  // Detail view
  if (selectedCollection) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <CollectionDetail
          collection={selectedCollection}
          onBack={() => { setSelectedCollection(null); loadCollections(); }}
        />
      </div>
    );
  }

  // List view
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-[#1B2A4A] flex items-center gap-3">
            <Database className="w-6 h-6" />
            Knowledgebase Manager
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage document collections used by AI bots for context retrieval and citations
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> New Collection
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-[#1B2A4A]">{collections.length}</div>
            <div className="text-[10px] text-muted-foreground">Collections</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {collections.reduce((s, c) => s + (c.doc_count || 0), 0)}
            </div>
            <div className="text-[10px] text-muted-foreground">Documents</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-emerald-600">
              {collections.reduce((s, c) => s + (c.chunk_count || 0), 0)}
            </div>
            <div className="text-[10px] text-muted-foreground">Total Chunks</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-amber-600">
              {collections.filter(c => c.visibility === "admin-only").length}
            </div>
            <div className="text-[10px] text-muted-foreground">Admin-Only</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search collections..."
          className="pl-9"
        />
      </div>

      {/* Create Form */}
      {showCreate && (
        <CreateCollectionForm
          onCreated={() => { setShowCreate(false); loadCollections(); }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Collections Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Database className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? "No collections match your search" : "No collections yet. Create one to get started."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(col => (
            <CollectionCard
              key={col.id}
              collection={col}
              onSelect={() => setSelectedCollection(col)}
              onDelete={() => handleDelete(col.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
