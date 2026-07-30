/**
 * InternalReviewStage — Stage 7 Router
 *
 * Routes activeTab to: Dashboard, Ops Review, Finance Review, Legal Review, Exceptions.
 * Follows the exact pattern of TenderDraftingStage.tsx.
 *
 * No AI. No mock data.
 */
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import InternalReviewDashboardTab from "./InternalReviewDashboardTab";
import InternalReviewExceptionsTab from "./InternalReviewExceptionsTab";
import DepartmentalReviewTab from "./DepartmentalReviewTab";

interface StageProps {
  ws: TenderWorkspace;
  activeTab: string;
  reload: () => void;
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
}

// TODO: RBAC — filter visible tabs by user role when authentication is implemented.
// Ops reviewer should only see operations_review, Finance only finance_review, etc.

export default function InternalReviewStage({ ws, activeTab, reload, onOpenDocuments, onOpenGlobalIntel }: StageProps) {
  if (activeTab === "review_dashboard")
    return <InternalReviewDashboardTab ws={ws} reload={reload} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} />;
  if (activeTab === "operations_review")
    return <DepartmentalReviewTab ws={ws} department="ops" requiredVolumes={["Technical", "Shared"]} reload={reload} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} />;
  if (activeTab === "finance_review")
    return <DepartmentalReviewTab ws={ws} department="finance" requiredVolumes={["Commercial", "Shared"]} reload={reload} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} />;
  if (activeTab === "legal_review")
    return <DepartmentalReviewTab ws={ws} department="legal" requiredVolumes={["Technical", "Commercial", "Shared", "Appendix"]} reload={reload} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} />;
  if (activeTab === "exceptions")
    return <InternalReviewExceptionsTab ws={ws} reload={reload} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} />;
  return <p className="text-sm text-muted-foreground text-center py-8">No Internal Review view configured for this tab.</p>;
}
