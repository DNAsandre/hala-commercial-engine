import type { Proposal, Workspace } from "./store";

// Development rule: proposal identity scopes where data belongs. It must not
// lock stages, hide tabs, block tracker movement, or create approval gates.

export interface ActiveProposalIdentity {
  proposalId: string;
  routeId: string;
  workspaceId: string;
  customerId: string;
  customerName: string;
  title: string;
  crmOpportunityId: string | null;
  source: "proposal_route" | "crm_ticket";
}

export interface ProposalIdentityResolution {
  ok: boolean;
  identity: ActiveProposalIdentity | null;
  reason: string;
}

function cleanId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function resolveActiveProposalIdentity({
  routeId,
  workspace,
  isProposalRoute,
}: {
  routeId: string | undefined;
  workspace: Workspace | null | undefined;
  isProposalRoute: boolean;
}): ProposalIdentityResolution {
  const cleanRouteId = cleanId(routeId);
  if (!cleanRouteId) {
    return {
      ok: false,
      identity: null,
      reason: "No proposal route ID was supplied.",
    };
  }

  if (!workspace) {
    return {
      ok: false,
      identity: null,
      reason: "No workspace or proposal ticket was resolved for this route.",
    };
  }

  const crmTicketId = cleanId(workspace.crmDealId);
  const proposalId = crmTicketId || cleanRouteId;
  const customerId = cleanId(workspace.customerId) || proposalId;
  const customerName = cleanId(workspace.customerName) || cleanId(workspace.title) || "Not captured";

  return {
    ok: true,
    identity: {
      proposalId,
      routeId: cleanRouteId,
      workspaceId: cleanId(workspace.id) || cleanRouteId,
      customerId,
      customerName,
      title: cleanId(workspace.title) || customerName,
      crmOpportunityId: crmTicketId || null,
      source: crmTicketId ? "crm_ticket" : "proposal_route",
    },
    reason: "Active proposal context resolved. This does not create stage gates or workflow locks.",
  };
}

export function isProposalInActiveScope(proposal: Proposal, identity: ActiveProposalIdentity): boolean {
  return proposal.id === identity.proposalId ||
    proposal.id === identity.routeId ||
    proposal.workspaceId === identity.proposalId ||
    proposal.workspaceId === identity.workspaceId ||
    proposal.workspaceId === identity.routeId;
}

export function filterProposalsForActiveIdentity(
  proposals: Proposal[],
  identity: ActiveProposalIdentity | null
): Proposal[] {
  if (!identity) return proposals;
  return proposals.filter(proposal => isProposalInActiveScope(proposal, identity));
}
