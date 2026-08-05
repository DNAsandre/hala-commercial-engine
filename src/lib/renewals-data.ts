/**
 * renewals-data.ts — SC-01 Wave 04, lane T07-B (renewals).
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * `src/pages/Renewals.tsx` previously performed **no read at all**. It rendered a
 * fixed sentence from `getEmptyRenewalState()` (`src/lib/process-isolation.ts:285`)
 * and told the reader the surface "has no data to show and will stay empty".
 * That is a permanent placeholder asserting a business fact — that there are no
 * renewal records — without ever asking the database.
 *
 * This module asks the database, and reports which of three different things
 * happened. Wave 04's core rule: **a failed read is not an empty result.**
 *
 * WHAT IS ACTUALLY IN THE SCHEMA (probed 2026-08-05 against the configured
 * project with the anon key; every column below was confirmed individually by a
 * PostgREST `select=<column>` returning HTTP 200, and rejected candidates
 * returned 42703):
 *
 *   renewal_workspaces -> id, created_at, updated_at, customer_id, customer_name,
 *                         baseline_id, status, owner, workspace_id, decision,
 *                         pricing, sla_terms
 *   contract_baselines -> id, created_at, customer_id, customer_name, status,
 *                         created_by
 *
 * Both tables EXIST (HTTP 200) and returned `content-range: * /0` to an
 * unauthenticated client. Zero rows to anon does **not** prove the tables are
 * empty — row-level security may hide rows. Authenticated visibility is
 * unverified: there is no authenticated browser session in this environment.
 *
 * There is no `contracts` table and no `renewals` table in this project
 * (both PGRST205). This module does not create, design, or migrate anything.
 *
 * NOTE ON THE EXISTING FETCHERS: `fetchRenewalWorkspaces` / `fetchContractBaselines`
 * in `src/lib/supabase-data.ts:1033` and `:1046` short-circuit to a hardcoded
 * empty array whenever `PROCESS_ISOLATION_ENABLED` is true (it is,
 * `src/lib/process-isolation.ts:3`), so they can never report a read outcome.
 * They also map columns that do not exist (`renewal_decision`, `owner_user_id`,
 * `owner_name`) and substitute `new Date()` for a missing `created_at`. That
 * file is outside this lane's write allowlist, so this module is standalone and
 * does not call it.
 *
 * NO-GATE: this module only reads. It blocks, locks, and enforces nothing.
 */

import { supabase } from "./supabase";
import { handleSupabaseError, setFetchError, clearFetchError } from "@/lib/supabase-error";

// ── Column projections (only columns proven to exist) ───────────────────────

export const RENEWAL_WORKSPACE_COLUMNS =
  "id,customer_id,customer_name,baseline_id,status,owner,decision,created_at,updated_at";

export const CONTRACT_BASELINE_COLUMNS =
  "id,customer_id,customer_name,status,created_at,created_by";

// ── Row shapes (exactly the projected columns, nothing invented) ────────────

export interface RenewalWorkspaceRow {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  baseline_id: string | null;
  status: string | null;
  owner: string | null;
  decision: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ContractBaselineRow {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  status: string | null;
  created_at: string | null;
  created_by: string | null;
}

// ── Read outcomes ──────────────────────────────────────────────────────────

/**
 * - `ok`          — the read succeeded. `rows` is the real set, possibly empty.
 * - `unavailable` — the relation is not present in this project (PGRST205 / 42P01).
 * - `error`       — the read failed for any other reason (including permission).
 */
export type ReadOutcome<T> =
  | { status: "ok"; rows: T[] }
  | { status: "unavailable"; rows: []; message: string }
  | { status: "error"; rows: []; message: string };

const MISSING_TABLE_CODES = new Set(["PGRST205", "42P01"]);

interface SupabaseishError {
  code?: string;
  message?: string;
}

function toOutcome<T>(
  operation: string,
  data: unknown,
  error: SupabaseishError | null | undefined,
  relation: string,
): ReadOutcome<T> {
  if (error) {
    handleSupabaseError(operation, { message: error.message ?? "Unknown error", code: error.code }, {
      silent: true,
    });
    setFetchError(operation, { message: error.message ?? "Unknown error", code: error.code });
    if (MISSING_TABLE_CODES.has(error.code ?? "")) {
      return {
        status: "unavailable",
        rows: [],
        message: `The "${relation}" table is not present in this environment.`,
      };
    }
    return { status: "error", rows: [], message: error.message ?? `Could not read "${relation}".` };
  }
  clearFetchError(operation);
  return { status: "ok", rows: (data ?? []) as T[] };
}

// ── Reads ──────────────────────────────────────────────────────────────────

export async function fetchRenewalWorkspaceRows(): Promise<ReadOutcome<RenewalWorkspaceRow>> {
  const { data, error } = await supabase
    .from("renewal_workspaces")
    .select(RENEWAL_WORKSPACE_COLUMNS)
    .order("created_at", { ascending: false });
  return toOutcome<RenewalWorkspaceRow>("fetchRenewalWorkspaceRows", data, error, "renewal_workspaces");
}

export async function fetchContractBaselineRows(): Promise<ReadOutcome<ContractBaselineRow>> {
  const { data, error } = await supabase
    .from("contract_baselines")
    .select(CONTRACT_BASELINE_COLUMNS)
    .order("created_at", { ascending: false });
  return toOutcome<ContractBaselineRow>("fetchContractBaselineRows", data, error, "contract_baselines");
}

export interface RenewalsOverview {
  workspaces: ReadOutcome<RenewalWorkspaceRow>;
  baselines: ReadOutcome<ContractBaselineRow>;
}

export async function loadRenewalsOverview(): Promise<RenewalsOverview> {
  const [workspaces, baselines] = await Promise.all([
    fetchRenewalWorkspaceRows(),
    fetchContractBaselineRows(),
  ]);
  return { workspaces, baselines };
}

// ── View state ─────────────────────────────────────────────────────────────

export interface ReadFailure {
  /** The relation the failure is about, in the user's words. */
  source: string;
  status: "unavailable" | "error";
  message: string;
}

/**
 * Four visibly different outcomes. `loading` is produced by the page before the
 * read resolves; the other three come from {@link deriveRenewalsViewState}.
 *
 * `records` may still carry failures: if one relation read and the other did
 * not, the page shows the rows it really has AND says the other read failed.
 * It must never silently present a partial set as the whole set.
 */
export type RenewalsViewState =
  | { kind: "loading" }
  | {
      kind: "records";
      workspaces: RenewalWorkspaceRow[];
      baselines: ContractBaselineRow[];
      failures: ReadFailure[];
    }
  | { kind: "empty" }
  | { kind: "unreadable"; failures: ReadFailure[] };

function failureOf<T>(source: string, outcome: ReadOutcome<T>): ReadFailure | null {
  if (outcome.status === "ok") return null;
  return { source, status: outcome.status, message: outcome.message };
}

export function deriveRenewalsViewState(overview: RenewalsOverview): RenewalsViewState {
  const failures = [
    failureOf("renewal_workspaces", overview.workspaces),
    failureOf("contract_baselines", overview.baselines),
  ].filter((f): f is ReadFailure => f !== null);

  const workspaces = overview.workspaces.status === "ok" ? overview.workspaces.rows : [];
  const baselines = overview.baselines.status === "ok" ? overview.baselines.rows : [];

  if (workspaces.length > 0 || baselines.length > 0) {
    return { kind: "records", workspaces, baselines, failures };
  }

  // No rows. Only call that "empty" if BOTH reads actually succeeded.
  if (failures.length > 0) {
    return { kind: "unreadable", failures };
  }

  return { kind: "empty" };
}
