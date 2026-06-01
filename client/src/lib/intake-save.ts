/**
 * Intake Save — Supabase CRUD for commercial_tickets
 *
 * All writes go through this module. No direct Supabase calls
 * from UI components. Every mutation records an audit entry.
 *
 * Doctrine:
 *   - No mock data
 *   - No auto-execution of SQL
 *   - Empty strings are coerced to null before save
 *   - Audit trail is mandatory for every write
 */

import { supabase } from "./supabase";
import type {
  CommercialTicket,
  CommercialTicketAudit,
  UnifiedTicketType,
  SourceType,
  LineageStatus,
  AuditAction,
} from "./unified-ticket-types";
import {
  DEFAULT_CRM_PIPELINE_STAGE,
  DEFAULT_INTERNAL_STAGE,
} from "./unified-ticket-types";

const SUPABASE_WRITE_TIMEOUT_MS = 15000;

// ── Helpers ────────────────────────────────────────────────────

/** Coerce empty/blank strings to null (doctrine: empty string is not truth) */
function nullIfBlank(val: string | null | undefined): string | null {
  if (val === null || val === undefined) return null;
  const trimmed = val.trim();
  return trimmed === "" ? null : trimmed;
}

/** Clean a ticket payload before saving — enforces doctrine */
async function withTimeout<T>(
  operation: PromiseLike<T>,
  label: string,
  timeoutMs = SUPABASE_WRITE_TIMEOUT_MS
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(`${label} timed out after ${timeoutMs / 1000}s`)),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function requireAuthenticatedSession(): Promise<string | null> {
  try {
    const result = await withTimeout(supabase.auth.getSession(), "Supabase session check", 8000);

    if (result.error) {
      return `Session check failed: ${result.error.message}`;
    }

    if (!result.data.session) {
      return "No active Supabase session. Please log out, log back in, and try again.";
    }

    return null;
  } catch (err) {
    return err instanceof Error
      ? `Session check failed: ${err.message}`
      : "Session check failed for an unknown reason";
  }
}

function sanitizePayload(
  data: Partial<Omit<CommercialTicket, "id" | "created_at" | "updated_at">>
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};

  // String fields: coerce blanks to null
  const stringFields = [
    "ticket_title", "customer_name", "customer_id", "contact_name",
    "contact_email", "contact_phone", "company", "owner", "region",
    "industry", "crm_pipeline_stage", "internal_stage", "target_date",
    "notes", "source_type", "source_reference", "source_file",
    "source_sheet", "source_row_id", "source_document_id",
    "lineage_notes", "verified_by", "quarantined_reason",
    "legacy_workspace_id", "legacy_opportunity_id", "legacy_tender_id",
  ] as const;

  for (const field of stringFields) {
    if (field in data) {
      clean[field] = nullIfBlank(data[field as keyof typeof data] as string | null);
    }
  }

  // Numeric fields: pass through as-is (null = unknown, 0 = confirmed zero)
  const numericFields = ["estimated_value", "target_gp_percent", "probability_percent"] as const;
  for (const field of numericFields) {
    if (field in data) {
      clean[field] = data[field as keyof typeof data] ?? null;
    }
  }

  // Boolean fields
  if ("active" in data) clean.active = data.active;
  if ("created_from_intake" in data) clean.created_from_intake = data.created_from_intake;

  // Typed fields
  if ("ticket_type" in data) clean.ticket_type = data.ticket_type;
  if ("lineage_status" in data) clean.lineage_status = data.lineage_status;
  if ("team_members" in data) clean.team_members = data.team_members ?? [];
  if ("type_details" in data) clean.type_details = data.type_details ?? {};
  if ("verified_at" in data) clean.verified_at = data.verified_at;

  return clean;
}

// ── Audit ──────────────────────────────────────────────────────

async function writeAudit(params: {
  ticket_id: string;
  action: AuditAction;
  field_changed?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  user_name: string;
  notes?: string | null;
}): Promise<void> {
  const { error } = await withTimeout(
    supabase.from("commercial_ticket_audit").insert({
      ticket_id: params.ticket_id,
      action: params.action,
      field_changed: params.field_changed ?? null,
      old_value: params.old_value ?? null,
      new_value: params.new_value ?? null,
      user_name: params.user_name,
      notes: params.notes ?? null,
    }),
    "Audit write"
  );

  if (error) {
    console.error("[intake-save] Audit write failed:", error.message);
  }
}

// ── CRUD Operations ────────────────────────────────────────────

/** Create a new commercial ticket from the intake modal */
export async function createTicket(
  data: {
    ticket_type: UnifiedTicketType;
    ticket_title?: string | null;
    customer_name?: string | null;
    customer_id?: string | null;
    contact_name?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    company?: string | null;
    owner?: string | null;
    region?: string | null;
    industry?: string | null;
    crm_pipeline_stage?: string | null;
    internal_stage?: string | null;
    estimated_value?: number | null;
    target_gp_percent?: number | null;
    probability_percent?: number | null;
    target_date?: string | null;
    notes?: string | null;
    type_details?: Record<string, unknown>;
    source_type?: SourceType | null;
    source_reference?: string | null;
    source_file?: string | null;
    source_sheet?: string | null;
    source_row_id?: string | null;
    source_document_id?: string | null;
  },
  userName: string
): Promise<{ data: CommercialTicket | null; error: string | null }> {
  const sessionError = await requireAuthenticatedSession();
  if (sessionError) {
    return { data: null, error: sessionError };
  }

  const payload = sanitizePayload({
    ...data,
    crm_pipeline_stage: data.crm_pipeline_stage ?? DEFAULT_CRM_PIPELINE_STAGE,
    internal_stage: data.internal_stage ?? DEFAULT_INTERNAL_STAGE[data.ticket_type],
    lineage_status: "unverified" as LineageStatus,
    created_from_intake: true,
    active: true,
  });

  let row: CommercialTicket | null = null;
  let error: { message: string } | null = null;

  try {
    const result = await withTimeout(
      supabase
        .from("commercial_tickets")
        .insert(payload)
        .select()
        .single(),
      "Ticket save"
    );

    row = result.data as CommercialTicket | null;
    error = result.error;
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Ticket save failed for an unknown reason",
    };
  }

  if (error) {
    return { data: null, error: error.message };
  }

  if (!row?.id) {
    return { data: null, error: "Ticket save returned no ticket id" };
  }

  // Audit
  try {
    await writeAudit({
      ticket_id: row.id,
      action: "created",
      user_name: userName,
      notes: `Created ${data.ticket_type} ticket via intake modal`,
    });
  } catch (err) {
    console.error("[intake-save] Audit write timed out or failed:", err);
  }

  return { data: row, error: null };
}

/** Update a ticket's fields */
export async function updateTicket(
  ticketId: string,
  updates: Partial<Omit<CommercialTicket, "id" | "created_at" | "updated_at">>,
  userName: string,
  changeNotes?: string
): Promise<{ data: CommercialTicket | null; error: string | null }> {
  const payload = sanitizePayload(updates);

  const { data: row, error } = await supabase
    .from("commercial_tickets")
    .update(payload)
    .eq("id", ticketId)
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  await writeAudit({
    ticket_id: ticketId,
    action: "updated",
    field_changed: Object.keys(updates).join(", "),
    user_name: userName,
    notes: changeNotes ?? null,
  });

  return { data: row as CommercialTicket, error: null };
}

/** Change pipeline/internal stage with audit */
export async function changeStage(
  ticketId: string,
  field: "crm_pipeline_stage" | "internal_stage",
  oldValue: string | null,
  newValue: string,
  userName: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("commercial_tickets")
    .update({ [field]: newValue })
    .eq("id", ticketId);

  if (error) return { error: error.message };

  await writeAudit({
    ticket_id: ticketId,
    action: "stage_changed",
    field_changed: field,
    old_value: oldValue,
    new_value: newValue,
    user_name: userName,
  });

  return { error: null };
}

/** Verify lineage — promote to operational views */
export async function verifyLineage(
  ticketId: string,
  userName: string,
  notes?: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("commercial_tickets")
    .update({
      lineage_status: "verified" as LineageStatus,
      verified_by: userName,
      verified_at: new Date().toISOString(),
      lineage_notes: notes ?? null,
    })
    .eq("id", ticketId);

  if (error) return { error: error.message };

  await writeAudit({
    ticket_id: ticketId,
    action: "lineage_verified",
    user_name: userName,
    notes: notes ?? "Lineage verified by user",
  });

  return { error: null };
}

/** Reject lineage — quarantine from operational views */
export async function rejectLineage(
  ticketId: string,
  userName: string,
  reason: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("commercial_tickets")
    .update({
      lineage_status: "rejected" as LineageStatus,
      quarantined_reason: reason,
      lineage_notes: reason,
    })
    .eq("id", ticketId);

  if (error) return { error: error.message };

  await writeAudit({
    ticket_id: ticketId,
    action: "lineage_rejected",
    user_name: userName,
    notes: reason,
  });

  return { error: null };
}

/** Soft-delete (deactivate) a ticket */
export async function deactivateTicket(
  ticketId: string,
  userName: string,
  reason?: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("commercial_tickets")
    .update({ active: false })
    .eq("id", ticketId);

  if (error) return { error: error.message };

  await writeAudit({
    ticket_id: ticketId,
    action: "deactivated",
    user_name: userName,
    notes: reason ?? "Deactivated by user",
  });

  return { error: null };
}

// ── Read Operations ────────────────────────────────────────────

/** Fetch all active tickets (for operational views) */
export async function fetchActiveTickets(): Promise<{
  data: CommercialTicket[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("commercial_tickets")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as CommercialTicket[], error: null };
}

/** Fetch active operational tickets, excluding rejected records */
export async function fetchOperationalTickets(): Promise<{
  data: CommercialTicket[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("commercial_tickets")
    .select("*")
    .eq("active", true)
    .neq("lineage_status", "rejected")
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as CommercialTicket[], error: null };
}

/** Fetch active operational tickets by type, excluding rejected records */
export async function fetchOperationalTicketsByType(
  ticketType: UnifiedTicketType
): Promise<{
  data: CommercialTicket[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("commercial_tickets")
    .select("*")
    .eq("ticket_type", ticketType)
    .eq("active", true)
    .neq("lineage_status", "rejected")
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as CommercialTicket[], error: null };
}

/** Fetch only verified active tickets (for pipeline/CRM views) */
export async function fetchVerifiedTickets(): Promise<{
  data: CommercialTicket[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("commercial_tickets")
    .select("*")
    .eq("active", true)
    .eq("lineage_status", "verified")
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as CommercialTicket[], error: null };
}

/** Fetch quarantined tickets (for review surface) */
export async function fetchQuarantinedTickets(): Promise<{
  data: CommercialTicket[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("commercial_tickets")
    .select("*")
    .eq("active", true)
    .neq("lineage_status", "verified")
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as CommercialTicket[], error: null };
}

/** Fetch audit trail for a ticket */
export async function fetchTicketAudit(
  ticketId: string
): Promise<{ data: CommercialTicketAudit[]; error: string | null }> {
  const { data, error } = await supabase
    .from("commercial_ticket_audit")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as CommercialTicketAudit[], error: null };
}
