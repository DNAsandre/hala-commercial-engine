import { type ReactNode } from "react";
import {
  TenderStageEmptyState,
  TenderStageSectionCard,
  TenderStageTaskShell,
  type TenderStageMetric,
  type TenderStageSectionTab,
} from "./TenderStageTaskShell";

export type IdentifiedSectionTab<T extends string> = TenderStageSectionTab<T>;
export type IdentifiedStageMetric = TenderStageMetric;

interface IdentifiedStageShellProps<T extends string> {
  activeSection: T;
  onSectionChange: (section: T) => void;
  sectionTabs: IdentifiedSectionTab<T>[];
  stageIntelOpen: boolean;
  onStageIntelOpenChange: (open: boolean) => void;
  metrics: IdentifiedStageMetric[];
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
  unsaved?: boolean;
  actionSlot?: ReactNode;
  children: ReactNode;
}

export function IdentifiedStageShell<T extends string>({
  activeSection,
  onSectionChange,
  sectionTabs,
  stageIntelOpen,
  onStageIntelOpenChange,
  metrics,
  onOpenDocuments,
  onOpenGlobalIntel,
  unsaved,
  actionSlot,
  children,
}: IdentifiedStageShellProps<T>) {
  return (
    <TenderStageTaskShell
      stageTitle="Identified Stage Menu"
      stageBadge="Stage 1"
      activeSection={activeSection}
      onSectionChange={onSectionChange}
      sectionTabs={sectionTabs}
      stageIntelOpen={stageIntelOpen}
      onStageIntelOpenChange={onStageIntelOpenChange}
      metrics={metrics}
      onOpenDocuments={onOpenDocuments}
      onOpenGlobalIntel={onOpenGlobalIntel}
      unsaved={unsaved}
      actionSlot={actionSlot}
    >
      {children}
    </TenderStageTaskShell>
  );
}

export function IdentifiedSectionCard({
  title,
  icon,
  badge,
  hidden,
  children,
}: {
  title: string;
  icon: ReactNode;
  badge?: string;
  hidden?: boolean;
  children: ReactNode;
}) {
  return (
    <TenderStageSectionCard title={title} icon={icon} badge={badge} hidden={hidden}>
      {children}
    </TenderStageSectionCard>
  );
}

export function IdentifiedEmptyState({ text }: { text: string }) {
  return <TenderStageEmptyState text={text} />;
}
