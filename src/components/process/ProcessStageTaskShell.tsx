import { createContext, useContext, type ReactNode } from "react";
import { BarChart3, ChevronDown, FolderOpen, PanelRightOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export interface ProcessStageSectionTab<T extends string> {
  key: T;
  label: string;
  icon: ReactNode;
}

export interface ProcessStageMetric {
  label: string;
  value: string;
}

interface ProcessStageTaskShellProps<T extends string> {
  stageTitle: string;
  stageBadge: string;
  activeSection: T;
  onSectionChange: (section: T) => void;
  sectionTabs: ProcessStageSectionTab<T>[];
  stageIntelOpen: boolean;
  onStageIntelOpenChange: (open: boolean) => void;
  metrics: ProcessStageMetric[];
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
  saved?: boolean;
  unsaved?: boolean;
  actionSlot?: ReactNode;
  stageIntelContent?: ReactNode;
  children?: ReactNode;
}

const ProcessStageIntelligenceContext = createContext<ReactNode>(null);

export function ProcessStageIntelligenceProvider({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <ProcessStageIntelligenceContext.Provider value={content}>
      {children}
    </ProcessStageIntelligenceContext.Provider>
  );
}

export function ProcessStageIntelligenceSlot() {
  return <>{useContext(ProcessStageIntelligenceContext)}</>;
}

export function ProcessStageTaskShell<T extends string>({
  stageTitle,
  stageBadge,
  activeSection,
  onSectionChange,
  sectionTabs,
  stageIntelOpen,
  onStageIntelOpenChange,
  metrics,
  onOpenDocuments,
  onOpenGlobalIntel,
  saved,
  unsaved,
  actionSlot,
  stageIntelContent,
  children,
}: ProcessStageTaskShellProps<T>) {
  const contextualStageIntelContent = useContext(ProcessStageIntelligenceContext);
  const resolvedStageIntelContent = stageIntelContent ?? contextualStageIntelContent;
  const statusBadge = unsaved
    ? {
        label: "Unsaved",
        className: "border-amber-400 bg-amber-500/15 text-amber-200",
      }
    : saved
      ? {
          label: "Saved",
          className: "border-emerald-400 bg-emerald-500/15 text-emerald-200",
        }
      : {
          label: "Not Saved",
          className: "border-slate-500 bg-slate-500/15 text-slate-200",
        };

  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-hidden">
      <Card className="gap-0 overflow-hidden border-border bg-card py-0 shadow-none">
        <CardContent className="p-0">
          <div className="-mx-px -mt-px flex flex-wrap items-center justify-between gap-3 rounded-t-lg border-b border-[#1f3f6f] bg-[#0b1726] px-4 py-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                {stageTitle}
              </span>
              <Badge variant="outline" className="h-5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2 text-[9px] font-medium text-slate-200">
                {stageBadge}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {onOpenDocuments && (
                <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-[#17365d] hover:text-white" onClick={onOpenDocuments}>
                  <FolderOpen className="w-3.5 h-3.5" />
                  Open Documents
                </Button>
              )}
              {onOpenGlobalIntel && (
                <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-[#17365d] hover:text-white" onClick={onOpenGlobalIntel}>
                  <BarChart3 className="w-3.5 h-3.5" />
                  Global Intelligence
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={`h-7 gap-1.5 rounded-md px-2.5 text-[11px] font-medium shadow-sm ${
                  stageIntelOpen
                    ? "border-blue-400 bg-blue-600 text-white hover:bg-blue-500 hover:text-white"
                    : "border-[#2f5f9d] bg-[#102844]/80 text-slate-50 hover:bg-[#17365d] hover:text-white"
                }`}
                onClick={() => onStageIntelOpenChange(!stageIntelOpen)}
              >
                <PanelRightOpen className="w-3.5 h-3.5" />
                {stageIntelOpen ? "Hide Stage Intel" : "Show Stage Intel"}
              </Button>
              <Badge
                variant="outline"
                data-testid="stage-save-status"
                className={`h-7 rounded-md px-2.5 text-[11px] font-medium ${statusBadge.className}`}
              >
                {statusBadge.label}
              </Badge>
              {actionSlot}
            </div>
          </div>

          {stageIntelOpen && (
            <div className="border-b border-border bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                {metrics.map(metric => (
                  <div key={metric.label} className="min-w-0 rounded-md border border-border bg-muted/20 p-3">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{metric.label}</p>
                    <p className="mt-1 truncate text-xs font-medium text-foreground">{metric.value}</p>
                  </div>
                ))}
              </div>
              {resolvedStageIntelContent && (
                <div className="mt-3">
                  {resolvedStageIntelContent}
                </div>
              )}
            </div>
          )}

          <div className="flex items-end gap-0 overflow-x-auto border-b-2 border-[#075eea] bg-card px-3 pt-3">
            {sectionTabs.map(section => (
              <button
                key={section.key}
                type="button"
                onClick={() => onSectionChange(section.key)}
                className={`min-h-16 min-w-[138px] rounded-t-lg border border-b-0 px-3 py-2 text-center text-[11px] font-medium leading-tight transition-colors ${
                  activeSection === section.key
                    ? "mb-[-2px] border-[#075eea] bg-[#075eea]/10 text-[#075eea] shadow-[0_-1px_0_rgba(7,94,234,.22)]"
                    : "border-slate-200 bg-slate-50/45 text-muted-foreground hover:border-slate-300 hover:bg-[#075eea]/10 hover:text-[#075eea]"
                }`}
              >
                <span className={`mb-1 flex justify-center ${activeSection === section.key ? "text-[#0b73ff]" : "text-slate-400"}`}>{section.icon}</span>
                <span className="block whitespace-normal text-center">{section.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {children && (
        <div className="min-w-0 space-y-4 p-4">
          {children}
        </div>
      )}
    </div>
  );
}

export function ProcessStageSectionCard({
  title,
  icon,
  badge,
  actionSlot,
  hidden,
  children,
}: {
  title: string;
  icon: ReactNode;
  badge?: string;
  actionSlot?: ReactNode;
  hidden?: boolean;
  children: ReactNode;
}) {
  return (
    <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${hidden ? "hidden" : ""}`}>
      <CardHeader className="p-0">
        <div className="flex w-full items-center gap-2 border-b border-border bg-muted/20 px-4 py-3 text-left group">
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
          <span className="text-slate-400">{icon}</span>
          <span className="text-xs font-semibold transition-colors group-hover:text-foreground">{title}</span>
          {badge && <Badge variant="outline" className="ml-auto text-[8px]">{badge}</Badge>}
          {actionSlot && <div className={badge ? "ml-2" : "ml-auto"}>{actionSlot}</div>}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {children}
      </CardContent>
    </Card>
  );
}

export function ProcessStageEmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}
