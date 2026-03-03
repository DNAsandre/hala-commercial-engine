/**
 * EditorBotBuilder — Admin page for managing Editor AI bots
 * Sprint 11: Bot Builder Integration + KB Attachment + Test Bot with Retrieval
 *
 * Design: Swiss Precision Instrument
 * Full CRUD for EditorBot instances used by BlockAIPanel and DocumentAIPanel.
 * Manages system prompts, provider/model, allowed doc types, block types,
 * knowledgebase collection links with priority ordering, and enabled state.
 * Test Bot panel now performs real KB retrieval and shows citations.
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Bot, Plus, Pencil, Trash2, Save, Search,
  FileText, Shield, CheckCircle, RefreshCw, PenTool, Scale,
  Sparkles, Layers, Zap, Copy, Eye, Database, ArrowUp, ArrowDown,
  X, BookOpen, Hash, Loader2, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type EditorBot, type EditorBotType,
  editorBots, getBlockBots, getDocumentBots,
} from "@/lib/ai-runs";
import {
  fetchCollections,
  fetchBotKBLinks,
  linkBotToCollection,
  unlinkBotFromCollection,
  updateBotKBPriority,
  retrieveContext,
  formatRetrievedContext,
  extractCitations,
  createBotRun,
  type KBCollection,
  type BotKBLink,
  type RetrievedChunk,
} from "@/lib/knowledgebase";
import { generateBlockContent } from "@/lib/ai-runs";

const DOC_TYPES = ["quote", "proposal", "sla", "msa", "tender", "renewal", "service_order_transport", "service_order_warehouse"];
const PROVIDERS = [
  { value: "openai", label: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"] },
  { value: "google", label: "Google AI", models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"] },
];

const ICON_OPTIONS = [
  { value: "PenTool", label: "Pen Tool", Icon: PenTool },
  { value: "Shield", label: "Shield", Icon: Shield },
  { value: "FileText", label: "File Text", Icon: FileText },
  { value: "Scale", label: "Scale", Icon: Scale },
  { value: "CheckCircle", label: "Check Circle", Icon: CheckCircle },
  { value: "RefreshCw", label: "Refresh", Icon: RefreshCw },
  { value: "Sparkles", label: "Sparkles", Icon: Sparkles },
  { value: "Layers", label: "Layers", Icon: Layers },
  { value: "Zap", label: "Zap", Icon: Zap },
];

const BOT_TYPE_CONFIG: Record<EditorBotType, { label: string; color: string; icon: typeof FileText }> = {
  block: { label: "Block Bot", color: "bg-blue-100 text-blue-700 border-blue-200", icon: FileText },
  document: { label: "Document Bot", color: "bg-purple-100 text-purple-700 border-purple-200", icon: Layers },
};

interface EditorBotFormData {
  name: string;
  bot_type: EditorBotType;
  provider: "openai" | "google";
  model: string;
  system_prompt: string;
  knowledge_base_refs: string[];
  allowed_doc_types: string[];
  allowed_block_types: string[] | null;
  enabled: boolean;
  description: string;
  icon: string;
}

const emptyForm: EditorBotFormData = {
  name: "",
  bot_type: "block",
  provider: "openai",
  model: "gpt-4o",
  system_prompt: "",
  knowledge_base_refs: [],
  allowed_doc_types: ["quote", "proposal"],
  allowed_block_types: null,
  enabled: true,
  description: "",
  icon: "PenTool",
};

// ── KB Attachment Manager ─────────────────────────────────────

function KBAttachmentManager({
  botId,
  currentRefs,
  onRefsChange,
}: {
  botId: string | null;
  currentRefs: string[];
  onRefsChange: (refs: string[]) => void;
}) {
  const [collections, setCollections] = useState<KBCollection[]>([]);
  const [links, setLinks] = useState<BotKBLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const cols = await fetchCollections();
      setCollections(cols);
      if (botId) {
        const botLinks = await fetchBotKBLinks(botId);
        setLinks(botLinks);
      }
      setLoading(false);
    };
    load();
  }, [botId]);

  const attachedIds = new Set(links.map(l => l.collection_id));
  const unattached = collections.filter(c => !attachedIds.has(c.id));

  const handleAttach = async (colId: string) => {
    const maxPriority = links.length > 0 ? Math.max(...links.map(l => l.priority)) + 1 : 0;
    if (botId) {
      await linkBotToCollection(botId, colId, maxPriority);
    }
    const col = collections.find(c => c.id === colId);
    setLinks(prev => [...prev, { bot_id: botId || "", collection_id: colId, priority: maxPriority, collection_name: col?.name }]);
    onRefsChange([...currentRefs, col?.name || colId]);
  };

  const handleDetach = async (colId: string) => {
    if (botId) {
      await unlinkBotFromCollection(botId, colId);
    }
    const col = collections.find(c => c.id === colId);
    setLinks(prev => prev.filter(l => l.collection_id !== colId));
    onRefsChange(currentRefs.filter(r => r !== (col?.name || colId)));
  };

  const handleMovePriority = async (colId: string, direction: "up" | "down") => {
    const sorted = [...links].sort((a, b) => a.priority - b.priority);
    const idx = sorted.findIndex(l => l.collection_id === colId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const tempPriority = sorted[idx].priority;
    sorted[idx].priority = sorted[swapIdx].priority;
    sorted[swapIdx].priority = tempPriority;

    if (botId) {
      await updateBotKBPriority(botId, sorted[idx].collection_id, sorted[idx].priority);
      await updateBotKBPriority(botId, sorted[swapIdx].collection_id, sorted[swapIdx].priority);
    }

    setLinks([...sorted]);
  };

  if (loading) return <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin" /></div>;

  const sortedLinks = [...links].sort((a, b) => a.priority - b.priority);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[#1B2A4A] flex items-center gap-1.5">
        <Database className="w-4 h-4" /> Knowledgebase Collections
      </h3>

      {/* Attached collections with priority */}
      {sortedLinks.length > 0 ? (
        <div className="space-y-1.5">
          {sortedLinks.map((link, idx) => {
            const col = collections.find(c => c.id === link.collection_id);
            return (
              <div key={link.collection_id} className="flex items-center gap-2 p-2 rounded-md border bg-muted/30">
                <Badge variant="outline" className="text-[10px] w-6 h-5 flex items-center justify-center p-0">
                  {idx + 1}
                </Badge>
                <BookOpen className="w-3.5 h-3.5 text-[#1B2A4A] shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{link.collection_name || col?.name || link.collection_id}</div>
                  <div className="text-[10px] text-muted-foreground">{col?.doc_count || 0} docs · {col?.chunk_count || 0} chunks</div>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost" size="icon" className="h-6 w-6"
                    disabled={idx === 0}
                    onClick={() => handleMovePriority(link.collection_id, "up")}
                  >
                    <ArrowUp className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-6 w-6"
                    disabled={idx === sortedLinks.length - 1}
                    onClick={() => handleMovePriority(link.collection_id, "down")}
                  >
                    <ArrowDown className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-6 w-6 text-red-500"
                    onClick={() => handleDetach(link.collection_id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground py-2">No KB collections attached. Bot will run without context retrieval.</p>
      )}

      {/* Add collection */}
      {unattached.length > 0 && (
        <div>
          <Label className="text-[10px] text-muted-foreground">Attach Collection</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {unattached.map(col => (
              <Badge
                key={col.id}
                variant="outline"
                className="cursor-pointer text-[10px] hover:bg-[#1B2A4A]/5 transition-colors"
                onClick={() => handleAttach(col.id)}
              >
                <Plus className="w-3 h-3 mr-0.5" /> {col.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Priority order determines which collections are searched first. Higher priority collections contribute more to relevance scoring.
      </p>
    </div>
  );
}

// ── Test Bot Panel with KB Retrieval ──────────────────────────

function TestBotPanel({
  bot,
  onClose,
}: {
  bot: EditorBot;
  onClose: () => void;
}) {
  const [testPrompt, setTestPrompt] = useState("");
  const [testDocType, setTestDocType] = useState(bot.allowed_doc_types[0] || "quote");
  const [testOutput, setTestOutput] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [retrievedChunks, setRetrievedChunks] = useState<RetrievedChunk[]>([]);
  const [citations, setCitations] = useState<{ source: string; chunkIndex: number; snippet: string }[]>([]);
  const [showChunks, setShowChunks] = useState(false);

  const handleTest = async () => {
    if (!testPrompt.trim()) { toast.error("Enter a test prompt"); return; }
    setTestLoading(true);
    setTestOutput("");
    setRetrievedChunks([]);
    setCitations([]);

    try {
      // 1. Retrieve KB context
      const chunks = await retrieveContext(bot.id, testPrompt, 6);
      setRetrievedChunks(chunks);

      // 2. Format context for prompt
      const contextStr = formatRetrievedContext(chunks);

      // 3. Generate (uses real AI if available, falls back to mock)
      const genResult = await generateBlockContent(
        bot.id,
        testPrompt,
        "",
        testDocType,
        "commercial",
      );

      // 4. Append citations from KB context to output
      let output = genResult.content;
      if (chunks.length > 0) {
        const citationLines = chunks.slice(0, 3).map(c =>
          `[Source: ${c.document_title} #${c.chunk_index}]`
        );
        output += `\n\n---\nReferences:\n${citationLines.join("\n")}`;
      }

      setTestOutput(output);

      // 5. Extract citations
      const extracted = extractCitations(output);
      setCitations(extracted);

      // 6. Create bot_run trace
      createBotRun({
        bot_id: bot.id,
        bot_name: bot.name,
        doc_instance_id: null,
        workspace_id: null,
        scope: bot.bot_type,
        target_block_ids: null,
        prompt: testPrompt,
        provider: bot.provider,
        model: bot.model,
        kb_collections: chunks.map(c => c.collection_name),
        retrieved_chunks: chunks,
        output: { text: output },
        status: "draft",
      });

      toast.success(`Test complete — ${chunks.length} KB chunks retrieved`);
    } catch (err) {
      toast.error("Test failed");
      setTestOutput("Error: Test generation failed. Check Edge Function deployment.");
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" /> Test Bot — {bot.name}
          </DialogTitle>
          <DialogDescription>
            Send a test prompt with KB retrieval. The bot will search linked collections and generate output with citations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Bot Info */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px]">{bot.provider}/{bot.model}</Badge>
            <Badge variant="outline" className="text-[10px]">{bot.bot_type}</Badge>
            <Badge variant="outline" className="text-[10px]">{bot.knowledge_base_refs.length} KB refs</Badge>
          </div>

          {/* Prompt + Doc Type */}
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3">
              <Label className="text-xs">Test Prompt</Label>
              <Textarea
                value={testPrompt}
                onChange={e => setTestPrompt(e.target.value)}
                placeholder="Write a compelling introduction for a cold-chain logistics proposal..."
                rows={3}
              />
            </div>
            <div>
              <Label className="text-xs">Doc Type Context</Label>
              <Select value={testDocType} onValueChange={setTestDocType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bot.allowed_doc_types.map(dt => (
                    <SelectItem key={dt} value={dt}>{dt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            className="bg-[#1B2A4A] hover:bg-[#2a3d66] w-full"
            disabled={!testPrompt.trim() || testLoading}
            onClick={handleTest}
          >
            {testLoading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Retrieving & Generating...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> Run Test with KB Retrieval</>
            )}
          </Button>

          {/* Retrieved Chunks */}
          {retrievedChunks.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
                onClick={() => setShowChunks(!showChunks)}
              >
                <span className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" />
                  Retrieved KB Context ({retrievedChunks.length} chunks)
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {showChunks ? "Hide" : "Show"}
                </Badge>
              </button>
              {showChunks && (
                <div className="p-3 space-y-2 bg-blue-50/30">
                  {retrievedChunks.map((chunk, i) => (
                    <div key={chunk.chunk_id} className="bg-white rounded-md p-2.5 border text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px]">
                            <Hash className="w-3 h-3 mr-0.5" />#{chunk.chunk_index}
                          </Badge>
                          <span className="font-medium text-[10px]">{chunk.document_title}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] text-blue-600">
                          score: {chunk.relevance_score.toFixed(1)}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">
                        {chunk.content.substring(0, 200)}
                        {chunk.content.length > 200 ? "..." : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {retrievedChunks.length === 0 && testOutput && (
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-700">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              No KB context used — bot has no linked collections or no matching chunks found.
            </div>
          )}

          {/* Output */}
          {testOutput && (
            <div className="border rounded-lg p-3 bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-muted-foreground">Generated Output</span>
                {citations.length > 0 && (
                  <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200">
                    {citations.length} citations
                  </Badge>
                )}
              </div>
              <div className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                {testOutput}
              </div>
            </div>
          )}

          {/* Citations */}
          {citations.length > 0 && (
            <div className="border rounded-lg p-3 bg-emerald-50/50">
              <div className="text-[10px] font-semibold text-emerald-700 mb-1.5 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" /> Citations Extracted
              </div>
              <div className="space-y-1">
                {citations.map((c, i) => (
                  <div key={i} className="text-[10px] text-emerald-600">
                    [{c.source} #{c.chunkIndex}]
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function EditorBotBuilder() {
  const [bots, setBots] = useState<EditorBot[]>([...editorBots]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | EditorBotType>("all");
  const [showEditor, setShowEditor] = useState(false);
  const [editingBotId, setEditingBotId] = useState<string | null>(null);
  const [form, setForm] = useState<EditorBotFormData>({ ...emptyForm });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [testBot, setTestBot] = useState<EditorBot | null>(null);

  const filteredBots = useMemo(() => {
    return bots.filter(b => {
      if (filterType !== "all" && b.bot_type !== filterType) return false;
      if (searchQuery && !b.name.toLowerCase().includes(searchQuery.toLowerCase()) && !b.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [bots, filterType, searchQuery]);

  const blockBotCount = bots.filter(b => b.bot_type === "block").length;
  const docBotCount = bots.filter(b => b.bot_type === "document").length;
  const enabledCount = bots.filter(b => b.enabled).length;

  const handleCreate = () => {
    setEditingBotId(null);
    setForm({ ...emptyForm });
    setShowEditor(true);
  };

  const handleEdit = (bot: EditorBot) => {
    setEditingBotId(bot.id);
    setForm({
      name: bot.name,
      bot_type: bot.bot_type,
      provider: bot.provider,
      model: bot.model,
      system_prompt: bot.system_prompt,
      knowledge_base_refs: [...bot.knowledge_base_refs],
      allowed_doc_types: [...bot.allowed_doc_types],
      allowed_block_types: bot.allowed_block_types ? [...bot.allowed_block_types] : null,
      enabled: bot.enabled,
      description: bot.description,
      icon: bot.icon,
    });
    setShowEditor(true);
  };

  const handleDuplicate = (bot: EditorBot) => {
    const newBot: EditorBot = {
      ...bot,
      id: `ebot-${crypto.randomUUID().substring(0, 8)}`,
      name: `${bot.name} (Copy)`,
    };
    setBots(prev => [...prev, newBot]);
    editorBots.push(newBot);
    toast.success(`Duplicated "${bot.name}"`);
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("Bot name is required"); return; }
    if (!form.system_prompt.trim()) { toast.error("System prompt is required"); return; }
    if (!form.description.trim()) { toast.error("Description is required"); return; }
    if (form.allowed_doc_types.length === 0) { toast.error("At least one document type must be selected"); return; }

    if (editingBotId) {
      setBots(prev => prev.map(b => b.id === editingBotId ? { ...b, ...form } : b));
      const idx = editorBots.findIndex(b => b.id === editingBotId);
      if (idx >= 0) Object.assign(editorBots[idx], form);
      toast.success(`Bot "${form.name}" updated`);
    } else {
      const newBot: EditorBot = {
        ...form,
        id: `ebot-${crypto.randomUUID().substring(0, 8)}`,
      };
      setBots(prev => [...prev, newBot]);
      editorBots.push(newBot);
      toast.success(`Bot "${form.name}" created`);
    }
    setShowEditor(false);
  };

  const handleDelete = (botId: string) => {
    const bot = bots.find(b => b.id === botId);
    setBots(prev => prev.filter(b => b.id !== botId));
    const idx = editorBots.findIndex(b => b.id === botId);
    if (idx >= 0) editorBots.splice(idx, 1);
    toast.success(`Bot "${bot?.name}" deleted`);
    setShowDeleteConfirm(null);
  };

  const handleToggleEnabled = (botId: string) => {
    setBots(prev => prev.map(b => b.id === botId ? { ...b, enabled: !b.enabled } : b));
    const bot = editorBots.find(b => b.id === botId);
    if (bot) bot.enabled = !bot.enabled;
  };

  const providerModels = PROVIDERS.find(p => p.value === form.provider)?.models || [];

  const getIconComponent = (iconName: string) => {
    const found = ICON_OPTIONS.find(i => i.value === iconName);
    return found ? found.Icon : Bot;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif text-slate-900 flex items-center gap-2">
            <Bot className="w-6 h-6" /> Editor Bot Builder
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage AI bots used in the Document Composer for block and document-level content generation.
          </p>
        </div>
        <Button className="bg-[#1B2A4A] hover:bg-[#2a3d66]" onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" /> Create Bot
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-[#1B2A4A]">{bots.length}</div>
            <div className="text-xs text-muted-foreground">Total Bots</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{blockBotCount}</div>
            <div className="text-xs text-muted-foreground">Block Bots</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">{docBotCount}</div>
            <div className="text-xs text-muted-foreground">Document Bots</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-emerald-600">{enabledCount}</div>
            <div className="text-xs text-muted-foreground">Enabled</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search bots..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "block", "document"] as const).map(t => (
            <Button
              key={t}
              size="sm"
              variant={filterType === t ? "default" : "outline"}
              className={cn("text-xs h-8", filterType === t && "bg-[#1B2A4A]")}
              onClick={() => setFilterType(t)}
            >
              {t === "all" ? "All" : t === "block" ? "Block Bots" : "Document Bots"}
            </Button>
          ))}
        </div>
      </div>

      {/* Bot List */}
      <div className="space-y-3">
        {filteredBots.map(bot => {
          const typeCfg = BOT_TYPE_CONFIG[bot.bot_type];
          const BotIcon = getIconComponent(bot.icon);
          return (
            <Card key={bot.id} className={cn("transition-all", !bot.enabled && "opacity-60")}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                    bot.bot_type === "block" ? "bg-blue-100" : "bg-purple-100"
                  )}>
                    <BotIcon className={cn("w-5 h-5", bot.bot_type === "block" ? "text-blue-600" : "text-purple-600")} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-[#1B2A4A]">{bot.name}</span>
                      <Badge className={cn("text-[10px] border", typeCfg.color)}>{typeCfg.label}</Badge>
                      <Badge variant="outline" className="text-[10px]">{bot.provider}/{bot.model}</Badge>
                      {!bot.enabled && <Badge variant="outline" className="text-[10px] text-red-500 border-red-200">Disabled</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{bot.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {bot.allowed_doc_types.map(dt => (
                        <Badge key={dt} variant="outline" className="text-[9px] h-5">{dt}</Badge>
                      ))}
                    </div>
                    {bot.knowledge_base_refs.length > 0 && (
                      <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
                        <Database className="w-3 h-3" />
                        KB: {bot.knowledge_base_refs.join(", ")}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Switch
                      checked={bot.enabled}
                      onCheckedChange={() => handleToggleEnabled(bot.id)}
                    />
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setTestBot(bot)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleEdit(bot)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleDuplicate(bot)}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:text-red-700" onClick={() => setShowDeleteConfirm(bot.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredBots.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No bots found matching your filters.</p>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              {editingBotId ? "Edit Editor Bot" : "Create Editor Bot"}
            </DialogTitle>
            <DialogDescription>
              Configure the bot's identity, AI provider, system prompt, knowledgebase, and permissions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Identity */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-[#1B2A4A] flex items-center gap-1.5">
                <Bot className="w-4 h-4" /> Identity
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Bot Name *</Label>
                  <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Proposal Section Writer" />
                </div>
                <div>
                  <Label className="text-xs">Bot Type *</Label>
                  <Select value={form.bot_type} onValueChange={(v: EditorBotType) => setForm(p => ({ ...p, bot_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="block">Block Bot — generates content for individual blocks</SelectItem>
                      <SelectItem value="document">Document Bot — processes entire documents</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Description *</Label>
                <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief description of what this bot does" />
              </div>
              <div>
                <Label className="text-xs">Icon</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {ICON_OPTIONS.map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      onClick={() => setForm(p => ({ ...p, icon: value }))}
                      className={cn(
                        "w-8 h-8 rounded-md border flex items-center justify-center transition-colors",
                        form.icon === value ? "bg-[#1B2A4A] text-white border-[#1B2A4A]" : "bg-white text-muted-foreground border-border hover:bg-muted"
                      )}
                      title={label}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Separator />

            {/* Provider & Model */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-[#1B2A4A] flex items-center gap-1.5">
                <Zap className="w-4 h-4" /> Provider & Model
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Provider *</Label>
                  <Select value={form.provider} onValueChange={(v: "openai" | "google") => {
                    const models = PROVIDERS.find(p => p.value === v)?.models || [];
                    setForm(p => ({ ...p, provider: v, model: models[0] || "" }));
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROVIDERS.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Model *</Label>
                  <Select value={form.model} onValueChange={(v) => setForm(p => ({ ...p, model: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {providerModels.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* System Prompt */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-[#1B2A4A] flex items-center gap-1.5">
                <FileText className="w-4 h-4" /> System Prompt
              </h3>
              <Textarea
                value={form.system_prompt}
                onChange={e => setForm(p => ({ ...p, system_prompt: e.target.value }))}
                placeholder="You are a commercial proposal writer for Hala Supply Chain Services..."
                rows={6}
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                This prompt is prepended to every AI call. Include brand voice, output format, and safety constraints.
              </p>
            </div>

            <Separator />

            {/* Knowledgebase Collections */}
            <KBAttachmentManager
              botId={editingBotId}
              currentRefs={form.knowledge_base_refs}
              onRefsChange={(refs) => setForm(p => ({ ...p, knowledge_base_refs: refs }))}
            />

            <Separator />

            {/* Permissions */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-[#1B2A4A] flex items-center gap-1.5">
                <Shield className="w-4 h-4" /> Permissions
              </h3>
              <div>
                <Label className="text-xs">Allowed Document Types *</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {DOC_TYPES.map(dt => (
                    <Badge
                      key={dt}
                      variant={form.allowed_doc_types.includes(dt) ? "default" : "outline"}
                      className={cn("cursor-pointer text-xs", form.allowed_doc_types.includes(dt) && "bg-[#1B2A4A]")}
                      onClick={() => setForm(p => ({
                        ...p,
                        allowed_doc_types: p.allowed_doc_types.includes(dt)
                          ? p.allowed_doc_types.filter(x => x !== dt)
                          : [...p.allowed_doc_types, dt]
                      }))}
                    >
                      {dt}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs flex items-center gap-2">
                  Restrict to Block Types
                  <Switch
                    checked={form.allowed_block_types !== null}
                    onCheckedChange={(checked) => setForm(p => ({ ...p, allowed_block_types: checked ? [] : null }))}
                  />
                </Label>
                {form.allowed_block_types !== null && (
                  <Input
                    value={form.allowed_block_types.join(", ")}
                    onChange={e => setForm(p => ({ ...p, allowed_block_types: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }))}
                    placeholder="e.g., intro.narrative, legal.terms, scope.services"
                    className="mt-1 text-xs"
                  />
                )}
                <p className="text-[10px] text-muted-foreground mt-1">
                  Leave unrestricted to allow this bot on all block types. Restrict to limit which blocks the bot can edit.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Label className="text-xs">Enabled</Label>
                <Switch
                  checked={form.enabled}
                  onCheckedChange={(checked) => setForm(p => ({ ...p, enabled: checked }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditor(false)}>Cancel</Button>
            <Button className="bg-[#1B2A4A] hover:bg-[#2a3d66]" onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" /> {editingBotId ? "Update Bot" : "Create Bot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Bot</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this bot? This action cannot be undone. Any AI runs referencing this bot will retain their history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}>
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Bot Panel */}
      {testBot && (
        <TestBotPanel
          bot={testBot}
          onClose={() => setTestBot(null)}
        />
      )}
    </div>
  );
}
