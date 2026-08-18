/**
 * SC-01 W02-T03 clean-owned replacement — Commercial Workspace Governance Config.
 * Advisory display ONLY: documents governance reference configuration; it never
 * enforces, gates, or blocks anything.
 * Data source: commercial_governance_config via lib/supabase-governance-data.
 * The legacy hardcoded config tables are NOT ported; with no stored entries the
 * component renders an explicit, honest empty state.
 */
import { useEffect, useState } from "react";
import { Shield, Info, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  fetchCommercialGovernanceConfigResult,
  type GovernanceConfigEntry,
  type GovernanceRead,
} from "@/lib/supabase-governance-data";
/* SC-01 Wave 06 (T14): `new Date(x).toLocaleString()` renders the literal
 * string "Invalid Date" for a malformed stored value; the shared formatter
 * degrades to an honest placeholder instead. */
import { formatRecordedDateTime } from "@/lib/ops-runtime";

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 1);
  } catch {
    return String(value);
  }
}

export default function CommercialGovernanceConfig() {
  /* SC-01 Wave 04: the previous empty state read "No entries exist ... (or the
   * store could not be read)", which merged a real zero with a failed read into
   * one sentence a human cannot act on. The read now reports which happened. */
  const [read, setRead] = useState<GovernanceRead<GovernanceConfigEntry> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCommercialGovernanceConfigResult().then(r => { if (!cancelled) setRead(r); });
    return () => { cancelled = true; };
  }, []);

  const loading = read === null;
  const entries = read?.rows ?? [];
  const categories = Array.from(new Set(entries.map(e => e.category || "Uncategorized")));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-serif font-bold flex items-center gap-2"><Shield className="w-5 h-5 text-[var(--color-hala-navy)]" /> Commercial Workspace Config</h3>
          <p className="text-xs text-muted-foreground">Stored governance reference configuration for the commercial workspace</p>
        </div>
        <div className="flex items-center gap-2">
          {entries.length > 0 && <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">Supabase-Backed</Badge>}
          <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">Advisory Display Only</Badge>
        </div>
      </div>

      {/* Advisory banner */}
      <Card className="border-2 border-blue-200 shadow-none bg-blue-50/50">
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-blue-800 mb-0.5">Advisory display only</div>
              <p className="text-xs text-blue-700 leading-relaxed">
                This page documents stored governance reference configuration.
                It does not enforce rules, change runtime behavior, or block any action.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--color-hala-navy)]" />
          <span className="text-sm text-muted-foreground">Loading governance configuration…</span>
        </div>
      ) : read.status === "error" ? (
        /* Failed read — visibly different from a real zero. */
        <Card className="border border-red-200 bg-red-50/40 shadow-none">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-red-700 mb-0.5">Commercial governance configuration could not be read</div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Nothing is listed. The number of recorded configuration entries is unknown — it is not zero.
                </p>
                <p className="text-[11px] font-mono text-muted-foreground break-all mt-1">{read.error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : entries.length === 0 ? (
        /* Honest empty state — the read succeeded and returned zero rows. */
        <Card className="border shadow-none bg-muted/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold mb-0.5">No commercial governance configuration is visible to this account</div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The read of <span className="font-mono">commercial_governance_config</span> succeeded and returned zero
                  rows. Rows hidden by row-level security would not appear here, so this is not a statement that the
                  store is empty.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {categories.map(cat => {
            const catEntries = entries.filter(e => (e.category || "Uncategorized") === cat);
            return (
              <Card key={cat} className="border shadow-none">
                <CardHeader className="pb-2 border-b">
                  <CardTitle className="text-sm font-serif flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[var(--color-hala-navy)]" /> {cat}
                    <Badge variant="outline" className="text-[9px]">{catEntries.length} entr{catEntries.length !== 1 ? "ies" : "y"}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-3 space-y-2">
                  {catEntries.map(e => (
                    <div key={e.id} className="rounded-lg border p-2.5 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold font-mono">{e.config_key}</span>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className={`text-[8px] ${e.is_active ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-slate-500 bg-slate-50 border-slate-200"}`}>
                            {e.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                      {e.description && <p className="text-[11px] text-muted-foreground">{e.description}</p>}
                      <pre className="text-[10px] bg-muted/30 rounded p-2 whitespace-pre-wrap break-words font-mono">{formatValue(e.config_value)}</pre>
                      {e.updated_at && (
                        <p className="text-[9px] text-muted-foreground">Updated {formatRecordedDateTime(e.updated_at)}</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
