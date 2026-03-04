/**
 * Dashboard Global Filters — Time range, customer segment, workspace type
 */
import { Calendar, Filter, X } from "lucide-react";

export interface DashboardFilterState {
  timeRange: "30d" | "90d" | "180d" | "1y" | "all";
  customerSegment: "all" | "A" | "B" | "C" | "D";
  workspaceType: "all" | "commercial" | "tender";
}

interface DashboardFiltersProps {
  filters: DashboardFilterState;
  onChange: (filters: DashboardFilterState) => void;
}

const TIME_OPTIONS = [
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
  { value: "180d", label: "6 Months" },
  { value: "1y", label: "1 Year" },
  { value: "all", label: "All Time" },
] as const;

const SEGMENT_OPTIONS = [
  { value: "all", label: "All Grades" },
  { value: "A", label: "Grade A" },
  { value: "B", label: "Grade B" },
  { value: "C", label: "Grade C" },
  { value: "D", label: "Grade D" },
] as const;

const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "commercial", label: "Commercial" },
  { value: "tender", label: "Tenders" },
] as const;

export default function DashboardFilters({ filters, onChange }: DashboardFiltersProps) {
  const hasActiveFilters = filters.timeRange !== "all" || filters.customerSegment !== "all" || filters.workspaceType !== "all";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Filter className="w-3.5 h-3.5" />
        <span className="text-xs font-medium">Filters</span>
      </div>

      {/* Time Range */}
      <div className="flex items-center bg-muted/50 rounded-lg border border-border overflow-hidden">
        {TIME_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange({ ...filters, timeRange: opt.value })}
            className={`text-[11px] px-2.5 py-1.5 transition-colors ${
              filters.timeRange === opt.value
                ? "bg-foreground text-background font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Customer Segment */}
      <select
        value={filters.customerSegment}
        onChange={e => onChange({ ...filters, customerSegment: e.target.value as DashboardFilterState["customerSegment"] })}
        className="text-[11px] px-2.5 py-1.5 rounded-lg border border-border bg-muted/50 text-foreground appearance-none cursor-pointer hover:bg-muted transition-colors"
      >
        {SEGMENT_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* Workspace Type */}
      <select
        value={filters.workspaceType}
        onChange={e => onChange({ ...filters, workspaceType: e.target.value as DashboardFilterState["workspaceType"] })}
        className="text-[11px] px-2.5 py-1.5 rounded-lg border border-border bg-muted/50 text-foreground appearance-none cursor-pointer hover:bg-muted transition-colors"
      >
        {TYPE_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* Clear */}
      {hasActiveFilters && (
        <button
          onClick={() => onChange({ timeRange: "all", customerSegment: "all", workspaceType: "all" })}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
        >
          <X className="w-3 h-3" />
          Clear
        </button>
      )}
    </div>
  );
}
