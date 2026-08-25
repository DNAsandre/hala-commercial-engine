/**
 * One clean-owned entry point for tracker destination discovery and safe writes.
 * It contains no bot, model, prompt, provider, workflow gate, or automation.
 */
import { supabase } from "./supabase";
import { PROPOSAL_MANIFEST } from "./destination-manifest/proposal-manifest";
import { TENDER_MANIFEST } from "./destination-manifest/tender-manifest";
import type { FieldDescriptor, ProcessManifest, RowIdentitySpec } from "./destination-manifest/manifest-types";
import {
  applyProposalFieldPatch,
  createProposalFieldPatchDeps,
  type ProposalFieldPatchOutcome,
  type ProposalFieldPatchRequest,
} from "./proposal-field-patch";
import {
  applyTenderFieldPatch,
  type TenderFieldPatchOutcome,
  type TenderFieldPatchRequest,
} from "./tender-field-patch";
import { computeRowFingerprint } from "./row-fingerprint";
import { createSupabaseTenderSourceRecordStore } from "./supabase-tender-source-record";
import {
  buildProvenanceKey,
  createSupabaseProvenanceTicketStore,
  readProvenance,
  recordProvenance,
  type ReadProvenanceResult,
  type RecordProvenanceRequest,
  type RecordProvenanceResult,
} from "./provenance-sidecar";

export const DESTINATION_MANIFESTS = {
  tender: TENDER_MANIFEST,
  proposal: PROPOSAL_MANIFEST,
} as const;

const allFields = new Map<string, FieldDescriptor>(
  [...TENDER_MANIFEST.fields, ...PROPOSAL_MANIFEST.fields].map((field) => [field.id, field]),
);

export interface RepeatedDestinationLevel {
  persistencePath: string;
  rowIdentity: RowIdentitySpec;
}

export function getDestinationField(fieldId: string): FieldDescriptor | undefined {
  return allFields.get(fieldId);
}

/**
 * Returns one identity contract per [] level. A future extraction caller uses
 * these contracts to compute stable row identities before submitting a patch.
 */
export function getRepeatedDestinationLevels(fieldId: string): RepeatedDestinationLevel[] {
  const descriptor = getDestinationField(fieldId);
  if (!descriptor) return [];
  const manifest: ProcessManifest = descriptor.process === "tender"
    ? TENDER_MANIFEST
    : PROPOSAL_MANIFEST;
  const levels: RepeatedDestinationLevel[] = [];
  let walked = "";
  for (const rawSegment of descriptor.persistencePath.split(".")) {
    walked = walked ? `${walked}.${rawSegment}` : rawSegment;
    if (!rawSegment.endsWith("[]")) continue;
    const levelDescriptor = manifest.fields.find(
      (field) => field.persistencePath === walked && field.rowIdentity,
    );
    const rowIdentity = levelDescriptor?.rowIdentity
      ?? (walked === descriptor.persistencePath ? descriptor.rowIdentity : undefined);
    if (!rowIdentity) {
      throw new Error(`Destination "${fieldId}" has no row identity for "${walked}".`);
    }
    levels.push({ persistencePath: walked, rowIdentity });
  }
  return levels;
}

export function fingerprintDestinationRow(
  row: Record<string, unknown>,
  rowIdentity: RowIdentitySpec,
): string {
  return computeRowFingerprint(row, rowIdentity);
}

const tenderDeps = {
  store: createSupabaseTenderSourceRecordStore(supabase),
  computeRowFingerprint,
};
const proposalDeps = createProposalFieldPatchDeps(computeRowFingerprint);
const provenanceDeps = {
  store: createSupabaseProvenanceTicketStore(supabase),
};

export { buildProvenanceKey };

export function applyTenderDestinationPatch(
  request: TenderFieldPatchRequest,
): Promise<TenderFieldPatchOutcome> {
  return applyTenderFieldPatch(TENDER_MANIFEST, tenderDeps, request);
}

export function applyProposalDestinationPatch(
  request: ProposalFieldPatchRequest,
): Promise<ProposalFieldPatchOutcome> {
  return applyProposalFieldPatch(PROPOSAL_MANIFEST, proposalDeps, request);
}

export function recordDestinationProvenance(
  request: RecordProvenanceRequest,
): Promise<RecordProvenanceResult> {
  return recordProvenance(provenanceDeps, request);
}

export function readDestinationProvenance(
  ticketId: string,
  processKind: "tender" | "proposal",
): Promise<ReadProvenanceResult> {
  return readProvenance(provenanceDeps, ticketId, processKind);
}
