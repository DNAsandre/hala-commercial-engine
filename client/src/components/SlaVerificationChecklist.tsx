/**
 * SlaVerificationChecklist — Human-first SLA verification.
 * Shown on SLA-related screens and Workspace Contract tab.
 * Gates stage advancement to "Contract Ready" unless all required items checked.
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, ShieldCheck, ShieldAlert, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getCurrentUser } from "@/lib/auth-state";
import type { Workspace } from "@/lib/store";
import {
  type SlaVerificationChecklist as ChecklistType,
  type SlaChecklistItem,
  createDefaultChecklist,
  isChecklistComplete,
  fetchSlaChecklist,
  upsertSlaChecklist,
} from "@/lib/sla-integrity";

interface SlaVerificationChecklistProps {
  workspace: Workspace;
  /** Called when checklist completion state changes */
  onCompletionChange?: (completed: boolean) => void;
  /** Compact mode for sidebar display */
  compact?: boolean;
}

export function SlaVerificationChecklistComponent({
  workspace,
  onCompletionChange,
  compact = false,
}: SlaVerificationChecklistProps) {
  const [checklist, setChecklist] = useState<ChecklistType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const user = getCurrentUser();

  // Load checklist from Supabase
  const loadChecklist = useCallback(async () => {
    setLoading(true);
    try {
      let existing = await fetchSlaChecklist(workspace.id);
      if (!existing) {
        // Create default checklist
        existing = createDefaultChecklist(workspace.id);
        await upsertSlaChecklist(existing);
      }
      setChecklist(existing);
      onCompletionChange?.(isChecklistComplete(existing));
    } catch {
      // Fallback to local default
      const fallback = createDefaultChecklist(workspace.id);
      setChecklist(fallback);
    } finally {
      setLoading(false);
    }
  }, [workspace.id, onCompletionChange]);

  useEffect(() => {
    loadChecklist();
  }, [loadChecklist]);

  const handleToggleItem = useCallback(async (itemId: string, checked: boolean) => {
    if (!checklist) return;

    const updatedItems: SlaChecklistItem[] = checklist.items.map(item =>
      item.id === itemId
        ? {
            ...item,
            checked,
            checkedBy: checked ? user.name : undefined,
            checkedAt: checked ? new Date().toISOString() : undefined,
          }
        : item
    );

    const updatedChecklist: ChecklistType = {
      ...checklist,
      items: updatedItems,
      updatedAt: new Date().toISOString(),
    };

    // Check if all required items are now complete
    const complete = isChecklistComplete(updatedChecklist);
    if (complete && !checklist.completed) {
      updatedChecklist.completed = true;
      updatedChecklist.completedBy = user.name;
      updatedChecklist.completedAt = new Date().toISOString();
    } else if (!complete) {
      updatedChecklist.completed = false;
      updatedChecklist.completedBy = undefined;
      updatedChecklist.completedAt = undefined;
    }

    setChecklist(updatedChecklist);
    onCompletionChange?.(complete);

    // Persist to Supabase
    setSaving(true);
    try {
      await upsertSlaChecklist(updatedChecklist);
    } catch {
      toast.error("Failed to save checklist update");
    } finally {
      setSaving(false);
    }
  }, [checklist, user.name, onCompletionChange]);

  if (loading) {
    return (
      <Card className={compact ? "border-0 shadow-none" : ""}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading checklist...</span>
        </CardContent>
      </Card>
    );
  }

  if (!checklist) return null;

  const completed = isChecklistComplete(checklist);
  const checkedCount = checklist.items.filter(i => i.checked).length;
  const totalCount = checklist.items.length;
  const requiredCount = checklist.items.filter(i => !i.label.toLowerCase().includes("(optional)")).length;
  const requiredChecked = checklist.items.filter(i => i.checked && !i.label.toLowerCase().includes("(optional)")).length;

  return (
    <Card className={compact ? "border-0 shadow-none" : ""}>
      <CardHeader className={compact ? "px-0 pt-0 pb-3" : "pb-3"}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <ClipboardCheck className="h-4 w-4" />
            SLA Verification Checklist
          </CardTitle>
          <div className="flex items-center gap-2">
            {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            <Badge
              variant={completed ? "default" : "secondary"}
              className={completed ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : ""}
            >
              {completed ? (
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> Complete
                </span>
              ) : (
                `${requiredChecked}/${requiredCount} required`
              )}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={loadChecklist}
              title="Refresh checklist"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {!completed && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <ShieldAlert className="h-3 w-3 text-amber-500" />
            All required items must be verified before advancing to Contract Ready.
          </p>
        )}
      </CardHeader>
      <CardContent className={compact ? "px-0 pb-0" : ""}>
        <div className="space-y-3">
          {checklist.items.map((item) => {
            const isOptional = item.label.toLowerCase().includes("(optional)");
            return (
              <div
                key={item.id}
                className={`flex items-start gap-3 rounded-md p-2 transition-colors ${
                  item.checked ? "bg-emerald-50/50" : "hover:bg-muted/50"
                }`}
              >
                <Checkbox
                  id={item.id}
                  checked={item.checked}
                  onCheckedChange={(checked) =>
                    handleToggleItem(item.id, checked === true)
                  }
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <label
                    htmlFor={item.id}
                    className={`text-sm cursor-pointer select-none ${
                      item.checked ? "line-through text-muted-foreground" : "text-foreground"
                    }`}
                  >
                    {item.label}
                    {isOptional && (
                      <span className="ml-1 text-xs text-muted-foreground">(not required for gate)</span>
                    )}
                  </label>
                  {item.checked && item.checkedBy && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Verified by {item.checkedBy}
                      {item.checkedAt && ` · ${new Date(item.checkedAt).toLocaleString()}`}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="mt-4 space-y-1">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                completed ? "bg-emerald-500" : "bg-amber-500"
              }`}
              style={{ width: `${(checkedCount / totalCount) * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-right">
            {checkedCount}/{totalCount} items checked
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
