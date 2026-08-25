/**
 * PackSelector.tsx
 * ────────────────
 * FPS-013 — Pack type selection UI for Final Pack Studio.
 *
 * 5 pack type cards + pricing scenario dropdown + existing instances list.
 * No stage checks. No bot checks. No fake data. No blocking.
 *
 * Source-truth safety:
 * - Reads commercial_tickets (via final-pack-loader) — never writes
 * - Creates doc_instances rows (via useFinalPackInstance)
 */

import { useState, useEffect, useCallback } from "react";
import {
  FileText, FileStack, Scale, Briefcase, Globe,
  AlertTriangle, Loader2, ChevronRight,
} from "lucide-react";
import { loadTenderPack, normalizeCommercialTicketDetails, type PackType, type BlockSnapshot } from "@/lib/final-pack-loader";
import { useFinalPackInstance, type FinalPackInstance } from "@/hooks/useFinalPackInstance";
import { supabase } from "@/lib/supabase";

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

interface PackSelectorProps {
  tenderId: string;
  sourceKind?: "tender" | "proposal";
  onInstanceReady: (instance: FinalPackInstance) => void;
}

interface PackTypeOption {
  key: PackType;
  label: string;
  description: string;
  icon: typeof FileText;
}

interface PricingScenarioOption {
  id: string;
  name: string;
  type: string;
  recommended: string;
}

// ═══════════════════════════════════════════════════════════
// Pack type definitions
// ═══════════════════════════════════════════════════════════

const PACK_TYPES: PackTypeOption[] = [
  {
    key: "combined_proposal",
    label: "Full Commercial Proposal",
    description: "Comprehensive proposal with cover, scope, pricing, terms, annexures",
    icon: FileStack,
  },
  {
    key: "quotation",
    label: "Standard Quotation",
    description: "Concise quotation with pricing schedule, scope, and terms",
    icon: FileText,
  },
  {
    key: "sla",
    label: "Service Level Agreement",
    description: "SLA with KPIs, penalties, escalation matrix, and legal clauses",
    icon: Scale,
  },
  {
    key: "msa",
    label: "Master Service Agreement",
    description: "Legal MSA with clauses, liability, and governance framework",
    icon: Briefcase,
  },
  {
    key: "bilingual_quotation",
    // PADW T06c (PDS-08): the card previously promised "English and Arabic"
    // while the renderer produces English-only, LTR, with no VAT columns. The
    // label now states reality until AR/VAT rendering is actually built.
    label: "Quotation (Bilingual layout — English only for now)",
    description:
      "Quotation pack. Arabic rendering and the VAT breakdown table are not built yet — output is English-only.",
    icon: Globe,
  },
];

// ═══════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════

export default function PackSelector({ tenderId, sourceKind = "tender", onInstanceReady }: PackSelectorProps) {
  const { createInstance, listInstances, loadInstance, instance, loading, error } =
    useFinalPackInstance();

  const [scenarios, setScenarios] = useState<PricingScenarioOption[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("");
  const [existingInstances, setExistingInstances] = useState<FinalPackInstance[]>([]);
  const [creating, setCreating] = useState(false);
  const [tenderTitle, setTenderTitle] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [loadingData, setLoadingData] = useState(true);
  // W04-T09 — three distinct outcomes for the source read:
  //   readError  → the read FAILED (unknown truth)
  //   notFound   → the read succeeded and the tender does not exist / is not visible
  //   otherwise  → real data
  const [readError, setReadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  // ── Load tender metadata + pricing scenarios ─────────
  useEffect(() => {
    let cancelled = false;

    async function loadTenderData() {
      setLoadingData(true);
      setReadError(null);
      setNotFound(false);

      // Fetch tender metadata (READ ONLY)
      const { data: tender, error: tenderErr } = await supabase
        .from("commercial_tickets")
        .select("ticket_title, customer_name, type_details")
        .eq("id", tenderId)
        .maybeSingle();

      if (cancelled) return;

      if (tenderErr) {
        setReadError(tenderErr.message);
      } else if (!tender) {
        setNotFound(true);
      }

      if (tender) {
        setTenderTitle(tender.ticket_title || "Not available");
        setCustomerName(tender.customer_name || "Not available");

        // Extract pricing scenarios.
        // PADW T06c (PDS-20): normalize FIRST — proposal tickets store their
        // P&L under type_details.proposal_workspace, so reading raw
        // td.pricing showed "no scenarios" for proposals whose created pack
        // then populated from the working P&L anyway (a dishonest empty
        // state that also removed the human's scenario choice).
        const td = normalizeCommercialTicketDetails(
          (tender.type_details as Record<string, any> | null) ?? {},
        );
        const pricingScenarios = (td?.pricing?.scenarios?.rows || []) as any[];
        const mapped: PricingScenarioOption[] = pricingScenarios.map((s: any) => ({
          id: s.id || "",
          name: s.scenario_name || "Unnamed scenario",
          type: s.scenario_type || "",
          recommended: s.recommended || "Not Assessed",
        }));
        setScenarios(mapped);

        // Default to selected/approved scenario
        const selectedId = td?.pricing?.scenarios?.selected_scenario?.selected_scenario_id;
        if (selectedId && mapped.some((s) => s.id === selectedId)) {
          setSelectedScenarioId(selectedId);
        } else if (mapped.length > 0) {
          setSelectedScenarioId(mapped[0].id);
        }
      }

      // Fetch existing FPS instances
      const existing = await listInstances(tenderId, sourceKind);
      if (!cancelled) {
        setExistingInstances(existing.instances);
        setListError(existing.error);
      }

      if (!cancelled) setLoadingData(false);
    }

    loadTenderData();
    return () => { cancelled = true; };
  }, [tenderId, sourceKind, listInstances]);

  // ── When instance is ready, notify parent ────────────
  useEffect(() => {
    if (instance) {
      onInstanceReady(instance);
    }
  }, [instance, onInstanceReady]);

  // ── Create new pack ──────────────────────────────────
  const handleCreatePack = useCallback(
    async (packType: PackType) => {
      setCreating(true);
      setCreateError(null);

      try {
        const snapshot: BlockSnapshot = await loadTenderPack(
          tenderId,
          packType,
          selectedScenarioId || undefined,
          sourceKind,
        );

        if (snapshot.error) {
          // W04-T09: this used to be console-only, so a failed build looked
          // exactly like nothing happening. Tell the human.
          console.error("[PackSelector] Loader error:", snapshot.error);
          setCreateError(`Could not build this document pack: ${snapshot.error}`);
          return;
        }

        await createInstance(tenderId, snapshot);
      } catch (err) {
        console.error("[PackSelector] Create failed:", err);
        setCreateError(
          err instanceof Error ? err.message : "Could not build this document pack.",
        );
      } finally {
        setCreating(false);
      }
    },
    [tenderId, sourceKind, selectedScenarioId, createInstance],
  );

  // ── Resume existing instance ─────────────────────────
  const handleResume = useCallback(
    async (instanceId: string) => {
      await loadInstance(instanceId);
    },
    [loadInstance],
  );

  // ── Loading state ────────────────────────────────────
  if (loadingData) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 text-muted-foreground mx-auto animate-spin" />
          <p className="text-sm text-muted-foreground">Loading tender data…</p>
        </div>
      </div>
    );
  }

  // ── Source read FAILED — unknown truth, honest recovery, no fake header ──
  if (readError) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
          <h2 className="text-base font-semibold text-foreground">
            Could not load this tender
          </h2>
          <p className="text-sm text-muted-foreground">
            The source record could not be read, so no document can be built from it yet.
            Details: {readError}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 rounded-md border border-border text-sm hover:bg-accent"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Read succeeded, tender genuinely not present/visible ──
  if (notFound) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto" />
          <h2 className="text-base font-semibold text-foreground">{sourceKind === "proposal" ? "Proposal" : "Tender"} not found</h2>
          <p className="text-sm text-muted-foreground">
            No {sourceKind} with id <span className="font-mono text-xs">{tenderId}</span> is
            visible to your account. It may have been removed, or you may not have access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8">
      {/* ── Source record header ── */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">{tenderTitle}</h2>
        <p className="text-sm text-muted-foreground mt-1">{customerName}</p>
      </div>

      {/* ── Pricing Scenario Selector ── */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          Pricing Scenario
        </label>
        {scenarios.length === 0 ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md fps-warning-banner">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>
              No pricing scenarios captured for this {sourceKind}. Pricing blocks will show
              {" \"Not captured yet\"."}
            </span>
          </div>
        ) : (
          <select
            id="fps-scenario-select"
            value={selectedScenarioId}
            onChange={(e) => setSelectedScenarioId(e.target.value)}
            className="w-full max-w-md px-3 py-2 rounded-md border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.type}){s.recommended === "Yes" ? " ★ Recommended" : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ── Existing Instances: read failure is stated, never shown as "none" ── */}
      {listError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-amber-500/40 bg-amber-500/5 text-amber-700 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            Existing documents for this {sourceKind} could not be listed ({listError}). Any that
            exist are not shown — creating a new pack still works.
          </span>
        </div>
      )}
      {existingInstances.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">Resume Existing</h3>
          <div className="space-y-2">
            {existingInstances.map((inst) => (
              <button
                key={inst.id}
                onClick={() => handleResume(inst.id)}
                disabled={loading}
                className="w-full flex items-center justify-between px-4 py-3 rounded-md border border-border bg-card hover:bg-accent/50 transition-colors text-left"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">{inst.display_title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatPackType(inst.pack_type)} · {inst.status} · updated{" "}
                    {formatDate(inst.updated_at)}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Pack Type Cards ── */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Create New Document Pack</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PACK_TYPES.map((pack) => {
            const Icon = pack.icon;
            return (
              <button
                key={pack.key}
                onClick={() => handleCreatePack(pack.key)}
                disabled={creating || loading}
                className="flex flex-col items-start gap-3 px-5 py-4 rounded-lg border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all text-left group disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-md bg-accent/60 group-hover:bg-primary/10 transition-colors">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {pack.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {pack.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Pack build failure (was silent) ── */}
      {createError && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-md border border-destructive/30 bg-destructive/5 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{createError}</span>
        </div>
      )}

      {/* ── Error Display ── */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-md border border-destructive/30 bg-destructive/5 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Creating State ── */}
      {creating && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-md border border-border bg-accent/30 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Building document pack…</span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════

function formatPackType(type: string): string {
  const labels: Record<string, string> = {
    combined_proposal: "Full Proposal",
    quotation: "Quotation",
    sla: "SLA",
    msa: "MSA",
    bilingual_quotation: "Bilingual Quote",
  };
  return labels[type] || type;
}

/**
 * W04-C4: the `catch` here never fired. `toLocaleDateString` on an unparseable
 * date does not throw — it RETURNS the string "Invalid Date", which rendered
 * verbatim in the pack list. Guard on the timestamp instead.
 */
export function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}
