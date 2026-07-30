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
import { fetchCommercialGovernanceConfig, type GovernanceConfigEntry } from "@/lib/supabase-governance-data";

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
  const [entries, setEntries] = useState<GovernanceConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchCommercialGovernanceConfig();
      if (!cancelled) {
        setEntries(data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
      ) : entries.length === 0 ? (
        /* Honest empty state — exclusive of any config listing */
        <Card className="border shadow-none bg-muted/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold mb-0.5">No commercial governance configuration recorded</div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  No entries exist in the commercial governance configuration store
                  (or the store could not be read). Nothing is displayed until real
                  configuration entries are recorded by a human administrator.
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
                        <p className="text-[9px] text-muted-foreground">Updated {new Date(e.updated_at).toLocaleString()}</p>
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
