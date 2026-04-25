/**
 * VersionHistoryPanel — Displays version history for a document instance
 * 
 * Fetches all versions from doc_instance_versions table and displays them
 * in a collapsible panel. Users can view version details and restore
 * previous versions.
 *
 * Design: Swiss Precision Instrument — compact, data-dense, navy accents
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  History, ChevronDown, ChevronRight, RotateCcw,
  Clock, User, Layers, AlertTriangle,
} from "lucide-react";

interface VersionData {
  id: string;
  doc_instance_id: string;
  version_number: number;
  blocks: any[];
  bindings: any;
  created_by: string;
  created_at: string;
}

interface VersionHistoryPanelProps {
  docInstanceId: string;
  currentVersion: number;
  onRestore: (version: VersionData) => void;
}

export default function VersionHistoryPanel({
  docInstanceId,
  currentVersion,
  onRestore,
}: VersionHistoryPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [versions, setVersions] = useState<VersionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<VersionData | null>(null);

  const fetchVersions = useCallback(async () => {
    if (!docInstanceId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("doc_instance_versions")
        .select("*")
        .eq("doc_instance_id", docInstanceId)
        .order("version_number", { ascending: false });

      if (error) {
        console.error("VersionHistoryPanel fetch error:", error);
        setVersions([]);
      } else {
        setVersions(
          (data || []).map((v: any) => ({
            id: v.id,
            doc_instance_id: v.doc_instance_id,
            version_number: v.version_number,
            blocks: typeof v.blocks === "string" ? JSON.parse(v.blocks) : (v.blocks || []),
            bindings: typeof v.bindings === "string" ? JSON.parse(v.bindings) : (v.bindings || {}),
            created_by: v.created_by,
            created_at: v.created_at,
          }))
        );
      }
    } catch (e) {
      console.error("VersionHistoryPanel error:", e);
    } finally {
      setLoading(false);
    }
  }, [docInstanceId]);

  // Fetch when expanded
  useEffect(() => {
    if (expanded) {
      fetchVersions();
    }
  }, [expanded, fetchVersions]);

  // Re-fetch when currentVersion changes (new save)
  useEffect(() => {
    if (expanded) {
      fetchVersions();
    }
  }, [currentVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      }) + " " + d.toLocaleTimeString("en-US", {
        hour: "2-digit", minute: "2-digit",
      });
    } catch (err) {
      console.warn('[VersionHistory] formatDate fallback:', err);
      return iso;
    }
  };

  const relativeTime = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return "just now";
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      const diffDay = Math.floor(diffHr / 24);
      return `${diffDay}d ago`;
    } catch (err) {
      console.warn('[VersionHistory] relativeTime fallback:', err);
      return "";
    }
  };

  return (
    <div className="border-b border-gray-200">
      {/* Header — toggle expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-white/50 transition-colors"
      >
        <h3 className="text-xs font-semibold text-[#1B2A4A] flex items-center gap-1.5">
          <History size={12} /> Version History
        </h3>
        <div className="flex items-center gap-1.5">
          {versions.length > 0 && (
            <Badge variant="outline" className="text-[9px] h-4 px-1.5">
              {versions.length}
            </Badge>
          )}
          {expanded ? (
            <ChevronDown size={12} className="text-gray-400" />
          ) : (
            <ChevronRight size={12} className="text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-4 h-4 border-2 border-[#1B2A4A]/20 border-t-[#1B2A4A] rounded-full animate-spin" />
              <span className="text-[10px] text-gray-400 ml-2">Loading versions…</span>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-4">
              <Clock size={16} className="mx-auto text-gray-300 mb-1" />
              <p className="text-[10px] text-gray-400">No saved versions yet</p>
              <p className="text-[10px] text-gray-300">Versions appear after saving</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[240px]">
              <div className="space-y-1">
                {versions.map((v) => {
                  const isCurrent = v.version_number === currentVersion;
                  return (
                    <div
                      key={v.id}
                      className={`rounded-lg border p-2 transition-colors ${
                        isCurrent
                          ? "bg-white border-[#1B2A4A]/20 shadow-sm"
                          : "bg-white/50 border-gray-100 hover:border-gray-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-[#1B2A4A]">
                            v{v.version_number}
                          </span>
                          {isCurrent && (
                            <Badge className="text-[8px] h-3.5 bg-[#1B2A4A] text-white px-1">
                              current
                            </Badge>
                          )}
                        </div>
                        {!isCurrent && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmRestore(v)}
                            className="h-5 px-1.5 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <RotateCcw size={9} className="mr-0.5" />
                            Restore
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-gray-400">
                        <span className="flex items-center gap-0.5">
                          <User size={8} />
                          {v.created_by}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Clock size={8} />
                          {relativeTime(v.created_at)}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Layers size={8} />
                          {v.blocks.length} blocks
                        </span>
                      </div>
                      <div className="text-[9px] text-gray-300 mt-0.5">
                        {formatDate(v.created_at)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {/* Refresh button */}
          {versions.length > 0 && (
            <button
              onClick={fetchVersions}
              className="w-full mt-1.5 text-[10px] text-gray-400 hover:text-gray-600 transition-colors py-1"
            >
              Refresh
            </button>
          )}
        </div>
      )}

      {/* Restore confirmation dialog */}
      <Dialog open={!!confirmRestore} onOpenChange={(o) => { if (!o) setConfirmRestore(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle size={20} />
              Restore Version {confirmRestore?.version_number}?
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 pt-2">
              This will replace your current document content with the blocks from version {confirmRestore?.version_number}.
              Your current unsaved changes will be lost. You can save after restoring to create a new version.
            </DialogDescription>
          </DialogHeader>
          {confirmRestore && (
            <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Version</span>
                <span className="font-medium">v{confirmRestore.version_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Saved by</span>
                <span className="font-medium">{confirmRestore.created_by}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Saved at</span>
                <span className="font-medium">{formatDate(confirmRestore.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Blocks</span>
                <span className="font-medium">{confirmRestore.blocks.length}</span>
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="ghost"
              onClick={() => setConfirmRestore(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (confirmRestore) {
                  onRestore(confirmRestore);
                  setConfirmRestore(null);
                }
              }}
              className="bg-[#1B2A4A] hover:bg-[#2A3F6A] text-white"
            >
              <RotateCcw size={14} className="mr-2" />
              Restore Version {confirmRestore?.version_number}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
