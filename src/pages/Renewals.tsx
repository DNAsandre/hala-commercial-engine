/**
 * Renewals — SC-01 Wave 04, lane T07-B.
 *
 * WHAT THIS PAGE USED TO DO (and why it changed)
 * ----------------------------------------------
 * The previous version performed no read. It printed a fixed sentence from
 * `getEmptyRenewalState()` and told the reader the surface "has no data to show
 * and will stay empty until renewals are re-enabled". Two problems:
 *
 *  1. It asserted a business fact — that no renewal records exist — that it had
 *     never checked against the database.
 *  2. Its own header cited `lib/renewal-engine.ts:169-175` as the reason. **That
 *     file does not exist in this application**; it was carried over from the
 *     old app. A claim sourced from a file that is not here is not evidence.
 *
 * `renewal_workspaces` and `contract_baselines` DO exist in the configured
 * project. This page now reads them and shows one of four visibly different
 * states: loading, real records, a genuine zero-record state, or a read that
 * failed. It renders no renewal date, value, owner, customer, status or counter
 * that did not come out of those tables.
 *
 * HONEST LIMITS, stated in the UI as well as here:
 *  - Zero rows to an unauthenticated client does not prove the tables are empty;
 *    row-level security may hide rows. Authenticated visibility is unverified.
 *  - Creating a renewal is still refused at the write path
 *    (`src/lib/intake-save.ts:191-193`). That is stated as what it is — a write
 *    restriction — not as the reason the list is empty.
 *
 * NO-GATE: read-only. This page blocks nothing and enforces nothing.
 */

import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, ArrowRight, Inbox, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cleanHref } from "@clean/lib/clean-routing";
import {
  deriveRenewalsViewState,
  loadRenewalsOverview,
  type RenewalsViewState,
} from "@/lib/renewals-data";

const ACTIVE_SURFACES = [
  { href: "/crm-pipeline", label: "CRM Pipeline" },
  { href: "/workspaces/tenders", label: "Tender Portfolio Overview" },
  { href: "/workspaces/proposals", label: "Proposal Portfolio Overview" },
];

function dash(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  return v === "" ? "—" : v;
}

/** Renders a date only if one is stored. Never substitutes "today". */
function storedDate(value: string | null | undefined): string {
  if (!value) return "—";
  return String(value).slice(0, 10);
}

function FailureList({ failures }: { failures: { source: string; status: string; message: string }[] }) {
  return (
    <ul className="mt-2 space-y-1 text-xs text-destructive/90">
      {failures.map((f) => (
        <li key={f.source}>
          <span className="font-mono">{f.source}</span>
          {f.status === "unavailable" ? " is not present in this environment" : " could not be read"}
          {": "}
          {f.message}
        </li>
      ))}
    </ul>
  );
}

/**
 * Pure presentational view. Every state it can show is a function of `state`
 * alone, which is what makes the three-state distinction testable without a DOM
 * environment.
 */
export function RenewalsView({
  state,
  onRetry,
}: {
  state: RenewalsViewState;
  onRetry?: () => void;
}) {
  return (
    <div className="max-w-[900px]">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold font-serif">Renewals</h1>
        {state.kind === "records" && (
          <Badge variant="outline" className="text-xs">
            {state.workspaces.length} renewal {state.workspaces.length === 1 ? "workspace" : "workspaces"}
            {" · "}
            {state.baselines.length} contract {state.baselines.length === 1 ? "baseline" : "baselines"}
          </Badge>
        )}
      </div>

      {state.kind === "loading" && (
        <Card className="mb-6">
          <CardContent className="flex items-center gap-3 p-5">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Checking stored renewal records…
            </p>
          </CardContent>
        </Card>
      )}

      {state.kind === "unreadable" && (
        <Card className="mb-6 border-destructive/40 bg-destructive/5">
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <p className="text-sm font-medium text-destructive">
                Renewal records could not be read.
              </p>
            </div>
            <p className="mt-2 text-xs text-destructive/90">
              This is a failed read, not a result. It is unknown whether any renewal records exist.
            </p>
            <FailureList failures={state.failures} />
            {onRetry && (
              <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={onRetry}>
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {state.kind === "empty" && (
        <Card className="mb-6 border-dashed">
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">No renewal records are stored or visible.</p>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Both reads succeeded and returned zero rows: <span className="font-mono">renewal_workspaces</span>{" "}
              and <span className="font-mono">contract_baselines</span> hold nothing that this session
              is allowed to see. Rows may exist and be hidden from this session by row-level
              security — that has not been verified.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              This surface is not yet populated. It is not a finished renewals feature. Creating a
              renewal is currently refused at the write path
              (<span className="font-mono">src/lib/intake-save.ts</span>), so no renewal can be
              started from this application yet.
            </p>
            {onRetry && (
              <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={onRetry}>
                <RefreshCw className="h-3.5 w-3.5" />
                Check again
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {state.kind === "records" && (
        <>
          {state.failures.length > 0 && (
            <Card className="mb-4 border-destructive/40 bg-destructive/5">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-destructive">
                  Part of this page could not be read. What is shown below is incomplete.
                </p>
                <FailureList failures={state.failures} />
              </CardContent>
            </Card>
          )}

          <div className="mb-2 text-xs font-medium text-muted-foreground">
            Renewal workspaces ({state.workspaces.length})
          </div>
          {state.workspaces.length === 0 ? (
            <p className="mb-6 text-xs text-muted-foreground">
              No renewal workspace rows were returned.
            </p>
          ) : (
            <div className="mb-6 space-y-2">
              {state.workspaces.map((w) => (
                <Card key={w.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <span className="text-sm font-medium">{dash(w.customer_name)}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{w.id}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
                      <span>Status: {dash(w.status)}</span>
                      <span>Decision: {dash(w.decision)}</span>
                      <span>Owner: {dash(w.owner)}</span>
                      <span>Updated: {storedDate(w.updated_at)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="mb-2 text-xs font-medium text-muted-foreground">
            Contract baselines ({state.baselines.length})
          </div>
          {state.baselines.length === 0 ? (
            <p className="mb-6 text-xs text-muted-foreground">
              No contract baseline rows were returned.
            </p>
          ) : (
            <div className="mb-6 space-y-2">
              {state.baselines.map((b) => (
                <Card key={b.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <span className="text-sm font-medium">{dash(b.customer_name)}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{b.id}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
                      <span>Status: {dash(b.status)}</span>
                      <span>Created: {storedDate(b.created_at)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <div className="text-xs font-medium text-muted-foreground">Active surfaces</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {ACTIVE_SURFACES.map((s) => (
          <Link
            key={s.href}
            href={cleanHref(s.href)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:bg-muted"
          >
            {s.label}
            <ArrowRight className="h-3 w-3" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function CleanRenewals() {
  const [state, setState] = useState<RenewalsViewState>({ kind: "loading" });

  const load = useCallback(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    void loadRenewalsOverview()
      .then((overview) => {
        if (cancelled) return;
        setState(deriveRenewalsViewState(overview));
      })
      .catch((err: unknown) => {
        // A thrown read (network failure, client not configured) must land in
        // the failed-read state, never in "no records".
        if (cancelled) return;
        setState({
          kind: "unreadable",
          failures: [
            {
              source: "renewal_workspaces / contract_baselines",
              status: "error",
              message: err instanceof Error ? err.message : String(err),
            },
          ],
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  return <RenewalsView state={state} onRetry={load} />;
}
