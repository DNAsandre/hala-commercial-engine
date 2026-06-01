import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Activity, ArrowRight, SkipForward, FileText, AlertTriangle, CheckCircle, Clock, Upload, MessageSquare, Zap } from "lucide-react";

type EntityType = "ticket" | "proposal" | "tender" | "approval" | "document";
type ActionType =
  | "ticket_created"
  | "stage_moved"
  | "stage_skipped"
  | "converted_to_proposal"
  | "converted_to_tender"
  | "approval_overridden"
  | "approval_approved"
  | "approval_rejected"
  | "document_uploaded"
  | "document_status_changed"
  | "missing_info_logged"
  | "note_added"
  | "qualification_updated"
  | "outcome_set";

interface ActivityRow {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  action: ActionType;
  stage_from: string | null;
  stage_to: string | null;
  skipped: boolean;
  notes: string;
  user_name: string;
  linked_workspace_id: string | null;
  linked_tender_ws_id: string | null;
  linked_ticket_id: string | null;
  linked_proposal_id: string | null;
  linked_tender_id: string | null;
  linked_approval_id: string | null;
  created_at: string;
}

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; desc: (r: ActivityRow) => string }> = {
  ticket_created:        { label: "Created",       color: "bg-gray-100 text-gray-700 border-gray-300", icon: <Zap className="h-3 w-3" />,          desc: (r) => `Lead entered Pipeline V.2` },
  stage_moved:          { label: "Stage Moved",   color: "bg-blue-100 text-blue-800 border-blue-300",  icon: <ArrowRight className="h-3 w-3" />,     desc: (r) => `${r.stage_from || "?"} → ${r.stage_to || "?"}` },
  stage_skipped:        { label: "Skipped",       color: "bg-orange-100 text-orange-800 border-orange-300", icon: <SkipForward className="h-3 w-3" />, desc: (r) => `${r.stage_from || "?"} → ${r.stage_to || "?"} (skipped)` },
  converted_to_proposal:{ label: "Routed",        color: "bg-purple-100 text-purple-800 border-purple-300", icon: <FileText className="h-3 w-3" />,    desc: (r) => `→ Proposal V.2` },
  converted_to_tender:  { label: "Routed",        color: "bg-purple-100 text-purple-800 border-purple-300", icon: <FileText className="h-3 w-3" />,    desc: (r) => `→ Tender V.2` },
  approval_overridden:  { label: "Override",      color: "bg-amber-100 text-amber-800 border-amber-300", icon: <AlertTriangle className="h-3 w-3" />,   desc: (r: ActivityRow) => `${r.notes || "override logged"}` },
  approval_approved:    { label: "Approved",      color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: <CheckCircle className="h-3 w-3" />,    desc: (r: ActivityRow) => `${r.notes || "approved"}` },
  approval_rejected:    { label: "Rejected",      color: "bg-red-100 text-red-800 border-red-300", icon: <AlertTriangle className="h-3 w-3" />,   desc: (r: ActivityRow) => `${r.notes || "rejected"}` },
  document_uploaded:    { label: "Uploaded",      color: "bg-green-100 text-green-800 border-green-300", icon: <Upload className="h-3 w-3" />,        desc: (r) => `${r.notes || "document uploaded"}` },
  document_status_changed:{ label: "Status Chg", color: "bg-blue-100 text-blue-800 border-blue-300",  icon: <CheckCircle className="h-3 w-3" />,    desc: (r) => `${r.notes || ""}` },
  missing_info_logged:  { label: "Missing Info",  color: "bg-red-100 text-red-800 border-red-300",      icon: <AlertTriangle className="h-3 w-3" />,   desc: (r) => `${r.notes || ""}` },
  note_added:           { label: "Note",          color: "bg-gray-100 text-gray-600 border-gray-300",   icon: <MessageSquare className="h-3 w-3" />,   desc: (r) => `${r.notes || ""}` },
  qualification_updated:{ label: "Qualified",     color: "bg-teal-100 text-teal-800 border-teal-300",   icon: <CheckCircle className="h-3 w-3" />,     desc: (r) => `${r.notes || ""}` },
  outcome_set:          { label: "Outcome",       color: "bg-gray-100 text-gray-700 border-gray-300",   icon: <CheckCircle className="h-3 w-3" />,     desc: (r) => `${r.notes || ""}` },
};

const ENTITY_LABELS: Record<EntityType, string> = {
  ticket:   "Ticket",
  proposal: "Proposal",
  tender:   "Tender",
  approval: "Approval",
  document: "Document",
};

export default function ActivityV2() {
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEntity, setFilterEntity] = useState<string>("all");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    loadActivities();
  }, [filterEntity, filterAction]);

  async function loadActivities() {
    setLoading(true);
    let query = supabase
      .from("commercial_v2_activity")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (filterEntity !== "all") {
      query = query.eq("entity_type", filterEntity);
    }
    if (filterAction !== "all") {
      query = query.eq("action", filterAction);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Failed to load activity:", error);
      setLoading(false);
      return;
    }

    setActivities((data ?? []) as ActivityRow[]);
    setPage(0);
    setLoading(false);
  }

  const filtered = activities.filter((a) => {
    if (search) {
      const s = search.toLowerCase();
      if (!a.notes?.toLowerCase().includes(s) && !a.user_name?.toLowerCase().includes(s) && !a.action?.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Activity Log V.2</h1>
          <p className="text-sm text-muted-foreground">
            Read-only timeline — all V.2 actions, no hard gates, no legacy mutation
          </p>
        </div>
        <Badge variant="outline" className="text-xs border-purple-300 text-purple-700 bg-purple-50">
          BETA
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Search notes, user, action..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <Select value={filterEntity} onValueChange={setFilterEntity}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Entity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            <SelectItem value="ticket">Ticket</SelectItem>
            <SelectItem value="proposal">Proposal</SelectItem>
            <SelectItem value="tender">Tender</SelectItem>
            <SelectItem value="approval">Approval</SelectItem>
            <SelectItem value="document">Document</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="ticket_created">Ticket Created</SelectItem>
            <SelectItem value="stage_moved">Stage Moved</SelectItem>
            <SelectItem value="stage_skipped">Stage Skipped</SelectItem>
            <SelectItem value="converted_to_proposal">Converted → Proposal</SelectItem>
            <SelectItem value="converted_to_tender">Converted → Tender</SelectItem>
            <SelectItem value="approval_overridden">Approval Overridden</SelectItem>
            <SelectItem value="document_uploaded">Document Uploaded</SelectItem>
            <SelectItem value="qualification_updated">Qualification Updated</SelectItem>
            <SelectItem value="outcome_set">Outcome Set</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={loadActivities}>
          Refresh
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} events
        </span>
      </div>

      {/* Timeline table */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          Loading...
        </div>
      ) : paginated.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
          <Activity className="h-8 w-8 opacity-30" />
          <p>No activity found</p>
        </div>
      ) : (
        <>
          <div className="rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Skipped</TableHead>
                  <TableHead>Lineage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((a) => {
                  const config = ACTION_CONFIG[a.action] ?? {
                    label: a.action,
                    color: "bg-gray-100 text-gray-600 border-gray-300",
                    icon: <Activity className="h-3 w-3" />,
                    desc: (r: ActivityRow) => r.notes || "",
                  };
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(a.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {ENTITY_LABELS[a.entity_type] ?? a.entity_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${config.color} gap-1`}>
                          {config.icon}
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                        {config.desc(a)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.user_name || "—"}</TableCell>
                      <TableCell>
                        {a.skipped && (
                          <SkipForward className="h-3 w-3 text-orange-500" />
                        )}
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">
                        {a.linked_ticket_id ? <span className="font-mono" title="Lead Ticket">T:{a.linked_ticket_id.slice(0,6)}</span> : ""}
                        {a.linked_proposal_id ? <span className="font-mono ml-1" title="Proposal">P:{a.linked_proposal_id.slice(0,6)}</span> : ""}
                        {a.linked_tender_id ? <span className="font-mono ml-1" title="Tender">Tn:{a.linked_tender_id.slice(0,6)}</span> : ""}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}