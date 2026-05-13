import { Link, useLocation } from "wouter";
import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Boxes,
  ClipboardList,
  Database,
  FileSpreadsheet,
  LineChart,
  Lock,
  Loader2,
  ShieldOff,
  TableProperties,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const COMMERCIAL_OS_MODE_LABELS = [
  "Excel Source-of-Truth Mode",
  "Formula-native comparison mode",
  "Read-only MVP shell",
  "No CRM sync",
  "No gates/enforcement",
] as const;

const navItems = [
  { path: "/commercial-os", label: "Dashboard", icon: BarChart3 },
  { path: "/commercial-os/pipeline", label: "Pipeline", icon: TableProperties },
  { path: "/commercial-os/capacity", label: "Capacity", icon: Boxes },
  { path: "/commercial-os/forecast", label: "Forecast", icon: LineChart },
  { path: "/commercial-os/revenue", label: "Revenue", icon: Database },
  { path: "/commercial-os/actions", label: "Actions", icon: ClipboardList },
];

export function CommercialOsShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const [location] = useLocation();

  return (
    <div className="min-h-full bg-background">
      <div className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-5 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                  DATA-002B Live Read
                </Badge>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {COMMERCIAL_OS_MODE_LABELS.map((label) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs font-medium text-muted-foreground"
                >
                  {label === "No CRM sync" ? (
                    <ShieldOff className="h-3.5 w-3.5 text-amber-600" />
                  ) : label === "No gates/enforcement" ? (
                    <Lock className="h-3.5 w-3.5 text-amber-600" />
                  ) : label === "Formula-native comparison mode" ? (
                    <BarChart3 className="h-3.5 w-3.5 text-blue-600" />
                  ) : label === "Read-only MVP shell" ? (
                    <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  )}
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto pb-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location === item.path;
              return (
                <Link key={item.path} href={item.path}>
                  <div
                    className={cn(
                      "inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-5 py-6 lg:px-8">{children}</main>
    </div>
  );
}

export function MockOnlyNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800",
        className
      )}
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        Rows marked <span className="font-semibold">MOCK_UI_ONLY</span> are layout placeholders only.
        They are not seeded data, not Supabase records, and not business truth.
      </span>
    </div>
  );
}

export function EmptySourceState({ label }: { label: string }) {
  return (
    <Card className="border-dashed shadow-none">
      <CardContent className="flex min-h-32 flex-col items-center justify-center gap-2 p-6 text-center">
        <FileSpreadsheet className="h-8 w-8 text-muted-foreground/60" />
        <div>
          <p className="text-sm font-semibold text-foreground">No rows found for the selected batch</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {label} is empty for this import batch. No fallback mock data is shown.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function LoadingState({ label = "Commercial OS data" }: { label?: string }) {
  return (
    <Card className="shadow-none">
      <CardContent className="flex min-h-32 items-center justify-center gap-3 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading {label}...
      </CardContent>
    </Card>
  );
}

export function ErrorState({ error }: { error: string }) {
  return (
    <Card className="border-red-200 bg-red-50 shadow-none">
      <CardContent className="flex min-h-24 items-start gap-3 p-4 text-sm text-red-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">Read-only Supabase load failed</p>
          <p className="mt-1 text-xs">{error}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function SourceCell({
  sourceFile,
  sourceSheet,
  sourceRow,
}: {
  sourceFile?: string;
  sourceSheet?: string;
  sourceRow?: number | null;
}) {
  const parts = [sourceFile, sourceSheet, sourceRow ? `row ${sourceRow}` : ""].filter(Boolean);
  return <span className="text-xs text-muted-foreground">{parts.length ? parts.join(" / ") : "--"}</span>;
}

export function DataTable({
  columns,
  children,
}: {
  columns: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              {columns.map((column) => (
                <th key={column} className="whitespace-nowrap px-3 py-3 font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function MockBadge() {
  return (
    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-700">
      MOCK_UI_ONLY
    </Badge>
  );
}

export function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        <p className="mt-2 text-xs text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}
