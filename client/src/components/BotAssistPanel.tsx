/**
 * BotAssistPanel — Floating AI Assistant Panel (S3-07)
 * 
 * Slide-in panel from the right edge of the viewport.
 * Chat-like interface for invoking bots from Dashboard/Workspace.
 * 
 * Features:
 *   - Bot selector dropdown (loads active bots from API)
 *   - Chat history (user prompts + bot responses)
 *   - Accept / Reject buttons on each response
 *   - Workspace context auto-injected when provided
 *   - Visual indicator for stub vs real AI responses
 * 
 * Design: Glassmorphism panel, enterprise SaaS aesthetic
 */

import { useState, useCallback, useEffect, useRef } from "react";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  X, Bot, Send, Sparkles, Loader2, Check, XCircle,
  MessageSquare, ChevronRight, User, Zap, Copy,
} from "lucide-react";
import { api } from "@/lib/api-client";

// ============================================================
// TYPES
// ============================================================

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  botName?: string;
  isStub?: boolean;
  cost?: number;
  latencyMs?: number;
  accepted?: boolean | null;
  invocationId?: string;
}

interface BotOption {
  id: string;
  name: string;
  display_name?: string;
  purpose: string;
  provider_id: string;
  model: string;
  status?: string;
}

// ============================================================
// PROPS
// ============================================================

interface BotAssistPanelProps {
  open: boolean;
  onClose: () => void;
  workspaceContext?: {
    workspaceId: string;
    customerName: string;
    dealValue?: number;
    scope?: string;
  } | null;
}

// ============================================================
// COMPONENT
// ============================================================

export default function BotAssistPanel({ open, onClose, workspaceContext }: BotAssistPanelProps) {
  const [bots, setBots] = useState<BotOption[]>([]);
  const [selectedBotId, setSelectedBotId] = useState("");
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem('bot-assist-messages');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load available bots
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api.botGovernance.listBots().then(res => {
      if (cancelled) return;
      const activeBots = (res.data || []).filter((b: any) => b.status === 'active' || b.enabled === true)
        .map((b: any) => ({ ...b, name: b.name || b.display_name || 'Unnamed Bot' }));
      setBots(activeBots);
      if (activeBots.length > 0 && !selectedBotId) {
        setSelectedBotId(activeBots[0].id);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [open]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Persist messages to sessionStorage so they survive panel close/reopen
  useEffect(() => {
    try {
      if (messages.length > 0) {
        sessionStorage.setItem('bot-assist-messages', JSON.stringify(messages));
      }
    } catch { /* quota exceeded — ignore */ }
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !selectedBotId || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: inputText.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);

    try {
      // Build context string
      let context = inputText.trim();
      if (workspaceContext) {
        context = `[Workspace: ${workspaceContext.customerName}${workspaceContext.dealValue ? ` | Deal: SAR ${workspaceContext.dealValue.toLocaleString()}` : ""}${workspaceContext.scope ? ` | Scope: ${workspaceContext.scope}` : ""}]\n\n${inputText.trim()}`;
      }

      const res = await api.botGovernance.invoke(selectedBotId, {
        context,
        context_type: workspaceContext ? "workspace" : "dashboard",
        input_payload: inputText.trim(),
      });

      const botName = bots.find(b => b.id === selectedBotId)?.name || bots.find(b => b.id === selectedBotId)?.display_name || "Bot";

      const assistMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: res.data?.output || "No response generated",
        timestamp: new Date().toISOString(),
        botName,
        isStub: res.data?.isStub || false,
        cost: res.data?.cost || 0,
        latencyMs: res.data?.latencyMs || 0,
        accepted: null,
        invocationId: res.data?.invocationId,
      };

      setMessages(prev => [...prev, assistMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Failed to get a response. Check that the bot is enabled and the provider is configured.",
        timestamp: new Date().toISOString(),
        botName: "System",
        isStub: true,
      };
      setMessages(prev => [...prev, errorMsg]);
      toast.error("Bot invocation failed");
    } finally {
      setIsLoading(false);
    }
  }, [inputText, selectedBotId, isLoading, bots, workspaceContext]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleAccept = useCallback((msgId: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, accepted: true } : m));
    toast.success("Response accepted");
  }, []);

  const handleReject = useCallback((msgId: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, accepted: false } : m));
    toast.info("Response rejected");
  }, []);

  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content.replace(/<[^>]*>/g, ""));
    toast.success("Copied to clipboard");
  }, []);

  if (!open) return null;

  return (
    <>
      {/* Panel — no backdrop, content stays fully interactive */}
      <div className="fixed top-0 right-0 h-full w-96 bg-white border-l border-gray-200 shadow-[-8px_0_30px_rgba(0,0,0,0.08)] z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-violet-50 to-white shrink-0">
          <div className="p-2 rounded-xl bg-violet-100">
            <Sparkles size={16} className="text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-[#1B2A4A]">AI Assistant</h3>
            <p className="text-[10px] text-gray-500">
              {workspaceContext
                ? `Context: ${workspaceContext.customerName}`
                : "General — ask anything"}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Bot Selector */}
        <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50 shrink-0">
          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Active Bot</label>
          <Select value={selectedBotId} onValueChange={setSelectedBotId}>
            <SelectTrigger className="h-8 text-xs bg-white">
              <SelectValue placeholder="Select a bot..." />
            </SelectTrigger>
            <SelectContent>
              {bots.map(bot => (
                <SelectItem key={bot.id} value={bot.id}>
                  <div className="flex items-center gap-2">
                    <Bot size={12} className="text-violet-500" />
                    <span>{bot.name || bot.display_name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <MessageSquare size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-400 font-medium">No messages yet</p>
                <p className="text-xs text-gray-300 mt-1">Ask the AI assistant a question to get started</p>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={14} className="text-violet-600" />
                  </div>
                )}
                <div className={`max-w-[85%] ${msg.role === "user"
                  ? "bg-[#1B2A4A] text-white rounded-2xl rounded-tr-md px-3 py-2"
                  : "bg-gray-50 border border-gray-200 rounded-2xl rounded-tl-md overflow-hidden"
                }`}>
                  {msg.role === "user" ? (
                    <p className="text-xs leading-relaxed">{msg.content}</p>
                  ) : (
                    <>
                      <div className="px-3 pt-2 pb-1.5">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-[10px] font-semibold text-gray-700">{msg.botName}</span>
                          {msg.isStub && (
                            <Badge className="text-[7px] h-3 bg-gray-200 text-gray-500 border-0">STUB</Badge>
                          )}
                          {!msg.isStub && msg.cost != null && (
                            <Badge className="text-[7px] h-3 bg-emerald-100 text-emerald-700 border-0">
                              ${msg.cost.toFixed(4)}
                            </Badge>
                          )}
                          {msg.latencyMs != null && msg.latencyMs > 0 && (
                            <span className="text-[8px] text-gray-400">{(msg.latencyMs / 1000).toFixed(1)}s</span>
                          )}
                        </div>
                        <div
                          className="prose prose-xs max-w-none text-gray-700"
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.content) }}
                        />
                      </div>
                      {msg.accepted === null && (
                        <div className="flex items-center gap-1 px-2 py-1.5 border-t border-gray-100 bg-gray-50/80">
                          <Button size="sm" onClick={() => handleAccept(msg.id)}
                            className="h-6 text-[9px] bg-emerald-600 hover:bg-emerald-700 text-white flex-1">
                            <Check size={10} className="mr-0.5" /> Accept
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleReject(msg.id)}
                            className="h-6 text-[9px] border-red-200 text-red-600 hover:bg-red-50 flex-1">
                            <XCircle size={10} className="mr-0.5" /> Reject
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleCopy(msg.content)}
                            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600">
                            <Copy size={10} />
                          </Button>
                        </div>
                      )}
                      {msg.accepted === true && (
                        <div className="flex items-center gap-1 px-3 py-1 border-t border-emerald-100 bg-emerald-50/50">
                          <Check size={10} className="text-emerald-600" />
                          <span className="text-[9px] text-emerald-700 font-medium">Accepted</span>
                        </div>
                      )}
                      {msg.accepted === false && (
                        <div className="flex items-center gap-1 px-3 py-1 border-t border-red-100 bg-red-50/50">
                          <XCircle size={10} className="text-red-500" />
                          <span className="text-[9px] text-red-600 font-medium">Rejected</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-lg bg-[#1B2A4A] flex items-center justify-center shrink-0 mt-0.5">
                    <User size={14} className="text-white" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                  <Loader2 size={14} className="text-violet-600 animate-spin" />
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-tl-md px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-[10px] text-gray-400">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="px-4 py-3 border-t border-gray-200 bg-white shrink-0">
          {workspaceContext && (
            <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded bg-violet-50 border border-violet-100">
              <Zap size={10} className="text-violet-500" />
              <span className="text-[9px] text-violet-700">
                Context: {workspaceContext.customerName}
                {workspaceContext.dealValue ? ` · SAR ${workspaceContext.dealValue.toLocaleString()}` : ""}
              </span>
            </div>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask the AI assistant..."
              className="text-xs min-h-[36px] max-h-[120px] resize-none flex-1"
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={!inputText.trim() || isLoading || !selectedBotId}
              size="sm"
              className="h-9 w-9 p-0 bg-violet-600 hover:bg-violet-700 text-white shrink-0"
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </Button>
          </div>
          <p className="text-[9px] text-gray-400 mt-1.5 text-center">
            AI responses are advisory only. Always verify critical information.
          </p>
        </div>
      </div>
    </>
  );
}
