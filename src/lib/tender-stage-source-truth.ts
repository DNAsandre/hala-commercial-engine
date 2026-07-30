export type TenderInternalStageKey =
  | 'identified'
  | 'qualification'
  | 'bid_no_bid'
  | 'solution_design'
  | 'pnl_pricing'
  | 'tender_drafting'
  | 'internal_review'
  | 'approval_matrix'
  | 'final_approved'
  | 'submitted'
  | 'clarification'
  | 'client_evaluation'
  | 'negotiation'
  | 'awarded'
  | 'lost_withdrawn';

export interface TenderInternalStageDefinition {
  value: TenderInternalStageKey;
  label: string;
  purpose: string;
  outputs: readonly string[];
  nextAction: string;
  storageFacets: readonly string[];
  navigation: 'open';
}

export type TenderStageTruth = Record<TenderInternalStageKey, Record<string, unknown>>;

export interface TenderLifecycleMemory {
  submission: Record<string, unknown>;
  clarification: Record<string, unknown>;
  client_evaluation: Record<string, unknown>;
  negotiation: Record<string, unknown>;
  awarded: Record<string, unknown>;
  lost_withdrawn: Record<string, unknown>;
}

export const TENDER_INTERNAL_STAGES: readonly TenderInternalStageDefinition[] = [
  {
    value: 'identified',
    label: 'Identified',
    purpose: 'Capture the Tender identity, source, customer context, dates, and initial document findings.',
    outputs: ['Tender brief', 'Initial assessment'],
    nextAction: 'Continue capturing or browse any other stage.',
    storageFacets: ['commercial_tickets identity/contact columns', 'type_details.identified', 'type_details.sow_data'],
    navigation: 'open',
  },
  {
    value: 'qualification',
    label: 'Qualification',
    purpose: 'Record scope, technical fit, customer fit, risks, and clarifications.',
    outputs: ['Qualification facts', 'Risk and clarification record'],
    nextAction: 'Review the captured qualification facts.',
    storageFacets: ['type_details.sow_qualification_data', 'type_details.technical_qualification_data', 'type_details.customer_fit_data', 'type_details.risk_snapshot_data'],
    navigation: 'open',
  },
  {
    value: 'bid_no_bid',
    label: 'Bid / No-Bid',
    purpose: 'Record the human Bid / No-Bid decision, reasoning, strategy, and resource facts.',
    outputs: ['Decision record', 'Win strategy and resource context'],
    nextAction: 'Record or revise the human decision.',
    storageFacets: ['type_details.bid_no_bid_data'],
    navigation: 'open',
  },
  {
    value: 'solution_design',
    label: 'Solution Design',
    purpose: 'Capture the operational, staffing, systems, scope, KPI, and assumption design.',
    outputs: ['Solution models', 'Scope and assumption record'],
    nextAction: 'Continue the solution design.',
    storageFacets: ['type_details.solution_design_data'],
    navigation: 'open',
  },
  {
    value: 'pnl_pricing',
    label: 'P&L / Pricing',
    purpose: 'Capture cost inputs, scenarios, pricing, margin, terms, and pricing decisions.',
    outputs: ['P&L scenarios', 'Pricing and commercial terms'],
    nextAction: 'Review or revise pricing information.',
    storageFacets: ['commercial_tickets commercial columns', 'type_details.pricing'],
    navigation: 'open',
  },
  {
    value: 'tender_drafting',
    label: 'Tender Drafting',
    purpose: 'Prepare the Tender structure, response blocks, source mapping, and appendices.',
    outputs: ['Tender structure', 'Draft response content'],
    nextAction: 'Continue manual drafting and source mapping.',
    storageFacets: ['type_details.tender_drafting'],
    navigation: 'open',
  },
  {
    value: 'internal_review',
    label: 'Internal Review',
    purpose: 'Record human review comments, decisions, exceptions, and reviewer history.',
    outputs: ['Review facts', 'Exceptions and comments'],
    nextAction: 'Record or revise review findings.',
    storageFacets: ['type_details.internal_review', 'type_details.tender_drafting.proposal_blocks', 'type_details.tender_drafting.departmental_reviews'],
    navigation: 'open',
  },
  {
    value: 'approval_matrix',
    label: 'Approval Matrix',
    purpose: 'Record the human-selected approval participants, decisions, comments, and history.',
    outputs: ['Approval participants', 'Approval decision history'],
    nextAction: 'Record or revise approval facts.',
    storageFacets: ['type_details.approval_matrix'],
    navigation: 'open',
  },
  {
    value: 'final_approved',
    label: 'Final Approved',
    purpose: 'Record the final human approval fact and the version or reference it applies to.',
    outputs: ['Final approval record', 'Submission preparation context'],
    nextAction: 'Confirm or revise the final approval record.',
    storageFacets: ['type_details.final_approved'],
    navigation: 'open',
  },
  {
    value: 'submitted',
    label: 'Submitted',
    purpose: 'Record submission details, recipients, versions, attachments, and receipt facts.',
    outputs: ['Submission record', 'Submitted version and receipt'],
    nextAction: 'Maintain the submission record.',
    storageFacets: ['type_details.submission'],
    navigation: 'open',
  },
  {
    value: 'clarification',
    label: 'Clarification',
    purpose: 'Record customer questions, responses, status, and commercial impact.',
    outputs: ['Clarification log', 'Response and impact record'],
    nextAction: 'Maintain clarification questions and responses.',
    storageFacets: ['type_details.clarification'],
    navigation: 'open',
  },
  {
    value: 'client_evaluation',
    label: 'Client Evaluation',
    purpose: 'Record evaluation requests, customer feedback, BAFO, status, and margin impact.',
    outputs: ['Evaluation history', 'Customer requests and BAFO context'],
    nextAction: 'Maintain the client evaluation record.',
    storageFacets: ['type_details.client_evaluation'],
    navigation: 'open',
  },
  {
    value: 'negotiation',
    label: 'Negotiation',
    purpose: 'Record negotiation events, requested changes, revised terms, versions, and margin impact.',
    outputs: ['Negotiation history', 'Revised term and version context'],
    nextAction: 'Maintain the negotiation record.',
    storageFacets: ['type_details.negotiation_data'],
    navigation: 'open',
  },
  {
    value: 'awarded',
    label: 'Awarded',
    purpose: 'Record award, contract, SLA, and handover preparation facts.',
    outputs: ['Award record', 'Contract and handover context'],
    nextAction: 'Maintain the award and handover record.',
    storageFacets: ['type_details.awarded_data'],
    navigation: 'open',
  },
  {
    value: 'lost_withdrawn',
    label: 'Lost / Withdrawn',
    purpose: 'Record loss or withdrawal facts, lessons, competitor context, and rebid potential.',
    outputs: ['Outcome record', 'Lessons and future opportunity context'],
    nextAction: 'Maintain the outcome and lessons record.',
    storageFacets: ['type_details.lost_withdrawn_data'],
    navigation: 'open',
  },
];

export const TENDER_INTERNAL_STAGE_KEYS = TENDER_INTERNAL_STAGES.map(stage => stage.value);

const STAGE_KEY_SET = new Set<TenderInternalStageKey>(TENDER_INTERNAL_STAGE_KEYS);

const STAGE_ALIASES: Record<string, TenderInternalStageKey> = {
  new: 'identified',
  qualifying: 'qualification',
  bid: 'bid_no_bid',
  bid_or_no_bid: 'bid_no_bid',
  solution: 'solution_design',
  p_l_pricing: 'pnl_pricing',
  p_and_l_pricing: 'pnl_pricing',
  pricing: 'pnl_pricing',
  proposal_preparation: 'tender_drafting',
  drafting: 'tender_drafting',
  review: 'internal_review',
  approval: 'approval_matrix',
  approved: 'final_approved',
  submission: 'submitted',
  technical_review: 'client_evaluation',
  commercial_review: 'client_evaluation',
  contract_negotiation: 'negotiation',
  award: 'awarded',
  lost: 'lost_withdrawn',
  withdrawn: 'lost_withdrawn',
  discontinued: 'lost_withdrawn',
};

function recordOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function isTenderInternalStageKey(value: unknown): value is TenderInternalStageKey {
  return typeof value === 'string' && STAGE_KEY_SET.has(value as TenderInternalStageKey);
}

export function normalizeTenderInternalStage(value: unknown): TenderInternalStageKey {
  if (typeof value !== 'string' || !value.trim()) return 'identified';
  const key = normalizeKey(value);
  if (isTenderInternalStageKey(key)) return key;
  return STAGE_ALIASES[key] ?? 'identified';
}

export function projectTenderStageTruth(rawDetails: unknown): TenderStageTruth {
  const details = recordOrEmpty(rawDetails);
  const drafting = recordOrEmpty(details.tender_drafting);
  const approvalMatrix = Object.keys(recordOrEmpty(details.approval_matrix)).length
    ? recordOrEmpty(details.approval_matrix)
    : recordOrEmpty(drafting.approval_matrix);

  return {
    identified: {
      identified: recordOrEmpty(details.identified),
      sow_data: recordOrEmpty(details.sow_data),
    },
    qualification: {
      sow_qualification_data: recordOrEmpty(details.sow_qualification_data),
      technical_qualification_data: recordOrEmpty(details.technical_qualification_data),
      customer_fit_data: recordOrEmpty(details.customer_fit_data),
      risk_snapshot_data: recordOrEmpty(details.risk_snapshot_data),
    },
    bid_no_bid: recordOrEmpty(details.bid_no_bid_data),
    solution_design: recordOrEmpty(details.solution_design_data),
    pnl_pricing: recordOrEmpty(details.pricing),
    tender_drafting: drafting,
    internal_review: {
      ...recordOrEmpty(details.internal_review),
      proposal_blocks: Array.isArray(drafting.proposal_blocks) ? drafting.proposal_blocks : [],
      departmental_reviews: recordOrEmpty(drafting.departmental_reviews),
    },
    approval_matrix: approvalMatrix,
    final_approved: recordOrEmpty(details.final_approved),
    submitted: recordOrEmpty(details.submission ?? details.submitted),
    clarification: recordOrEmpty(details.clarification),
    client_evaluation: recordOrEmpty(details.client_evaluation),
    negotiation: recordOrEmpty(details.negotiation_data ?? details.negotiation),
    awarded: recordOrEmpty(details.awarded_data ?? details.awarded),
    lost_withdrawn: recordOrEmpty(details.lost_withdrawn_data ?? details.lost_withdrawn),
  };
}

export function projectTenderLifecycleMemory(rawDetails: unknown): TenderLifecycleMemory {
  const stageTruth = projectTenderStageTruth(rawDetails);
  return {
    submission: stageTruth.submitted,
    clarification: stageTruth.clarification,
    client_evaluation: stageTruth.client_evaluation,
    negotiation: stageTruth.negotiation,
    awarded: stageTruth.awarded,
    lost_withdrawn: stageTruth.lost_withdrawn,
  };
}
