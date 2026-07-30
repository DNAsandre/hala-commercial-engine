import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type JsonObject,
  type TenderSourceAuditRecord,
  type TenderSourceAuditWrite,
  type TenderSourceRecordStore,
  type TenderSourceRow,
  type TenderSourceUpdateResult,
} from './tender-source-record';

function notesFor(event: TenderSourceAuditWrite): string {
  return JSON.stringify({
    contract: 'W2-S001-v1',
    actor_id: event.actorId,
    origin: event.origin,
    previous_revision: event.previousRevision,
    new_revision: event.newRevision,
    changed_field_paths: event.changedFieldPaths,
    evidence_ids: event.evidenceIds,
    suggestion_ids: event.suggestionIds,
    note: event.note ?? null,
  });
}

export function createSupabaseTenderSourceRecordStore(
  client: SupabaseClient<any>,
): TenderSourceRecordStore {
  const readActiveTender = async (tenderId: string): Promise<TenderSourceRow | null> => {
    const { data, error } = await client
      .from('commercial_tickets')
      .select('*')
      .eq('id', tenderId)
      .eq('ticket_type', 'tender')
      .eq('active', true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? data as TenderSourceRow : null;
  };

  const updateActiveTender = async (args: {
    tenderId: string;
    expectedRevision: string;
    patch: JsonObject;
  }): Promise<TenderSourceUpdateResult> => {
    const { data, error } = await client
      .from('commercial_tickets')
      .update(args.patch)
      .eq('id', args.tenderId)
      .eq('ticket_type', 'tender')
      .eq('active', true)
      .eq('updated_at', args.expectedRevision)
      .select('*')
      .maybeSingle();

    if (error) return { status: 'failed', error: error.message };
    if (data) return { status: 'saved', row: data as TenderSourceRow };

    const current = await readActiveTender(args.tenderId);
    if (!current) return { status: 'not_found', error: 'Active Tender not found.' };
    if (current.updated_at !== args.expectedRevision) return { status: 'stale', row: current };
    return {
      status: 'failed',
      row: current,
      error: 'Tender save affected no row. The entered values remain available for retry.',
    };
  };

  const insertAudit = async (event: TenderSourceAuditWrite): Promise<{ id?: string; error?: string }> => {
    const { data, error } = await client
      .from('commercial_ticket_audit')
      .insert({
        ticket_id: event.tenderId,
        action: event.action,
        field_changed: event.changedFieldPaths.join(', '),
        old_value: event.previousRevision,
        new_value: event.newRevision,
        user_name: event.actorName,
        notes: notesFor(event),
      })
      .select('id')
      .maybeSingle();
    return error ? { error: error.message } : { id: data?.id };
  };

  const listAudit = async (tenderId: string): Promise<TenderSourceAuditRecord[]> => {
    const { data, error } = await client
      .from('commercial_ticket_audit')
      .select('id,ticket_id,action,field_changed,old_value,new_value,user_name,notes,created_at')
      .eq('ticket_id', tenderId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as TenderSourceAuditRecord[];
  };

  return { readActiveTender, updateActiveTender, insertAudit, listAudit };
}
