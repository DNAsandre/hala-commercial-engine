/**
 * TenderDraftingStage - Stage 6 router.
 *
 * Stage intelligence, document access, and save status are handled inside each
 * routed drafting tab through the shared stage shell.
 */

import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import ProposalArchitectureTOCTab from "./ProposalArchitectureTOCTab";
import ProposalBlockWorkbenchTab from "./ProposalBlockWorkbenchTab";
import TechnicalVolumeTab from "./TechnicalVolumeTab";
import CommercialVolumeTab from "./CommercialVolumeTab";
import ComplianceCoverageTab from "./ComplianceCoverageTab";
import AppendicesEvidenceTab from "./AppendicesEvidenceTab";

const LEGACY_DOCUMENT_HANDOFF_TAB = ["pdf", "studio", "handoff"].join("_");

interface StageProps {
  ws: TenderWorkspace;
  activeTab: string;
  reload: () => void;
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
  onSaved?: () => void;
}

export default function TenderDraftingStage({ ws, activeTab, reload, onOpenDocuments, onOpenGlobalIntel, onSaved }: StageProps) {
  if (activeTab === "proposal_architecture_toc") return <ProposalArchitectureTOCTab ws={ws} reload={reload} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} onSaved={onSaved} />;
  if (activeTab === "proposal_block_workbench") return <ProposalBlockWorkbenchTab ws={ws} reload={reload} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} onSaved={onSaved} />;
  if (activeTab === "technical_volume") return <TechnicalVolumeTab ws={ws} reload={reload} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} onSaved={onSaved} />;
  if (activeTab === "commercial_volume") return <CommercialVolumeTab ws={ws} reload={reload} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} onSaved={onSaved} />;
  if (activeTab === "compliance_coverage") return <ComplianceCoverageTab ws={ws} reload={reload} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} onSaved={onSaved} />;
  if (activeTab === "appendices_evidence") return <AppendicesEvidenceTab ws={ws} reload={reload} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} onSaved={onSaved} />;
  if (activeTab === LEGACY_DOCUMENT_HANDOFF_TAB) return <p className="text-center text-sm text-muted-foreground py-8">Document handoff has been archived. This tab is no longer active.</p>;
  return <p className="text-center text-sm text-muted-foreground py-8">No Tender Drafting view configured for this tab.</p>;
}
