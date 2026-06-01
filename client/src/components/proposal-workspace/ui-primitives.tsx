/**
 * Shared UI primitives for the Proposal Workspace commercial cockpit.
 * Collapsible sections, field groups, readiness badges, RAG selectors.
 */
import { useState, type ReactNode } from "react";
import { ChevronDown, CheckCircle2, AlertTriangle, Info, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ── Collapsible Section ──
export function Section({
  title, badge, children, defaultOpen = true, icon,
}: {
  title: string; badge?: ReactNode; children: ReactNode; defaultOpen?: boolean; icon?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-lg mb-3 bg-background">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-muted/30 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold">{title}</span>
          {badge}
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}

// ── Field Row ──
export function FieldRow({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 items-start py-1.5">
      <label className="text-xs font-medium text-muted-foreground pt-2 select-none">{label}</label>
      <div>
        {children}
        {hint && <p className="text-[10px] text-muted-foreground/50 mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}

// ── Text Input ──
export function FieldInput({
  value, onChange, placeholder, type = "text", className = "",
}: {
  value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-indigo-300 transition-colors ${className}`}
    />
  );
}

// ── Textarea ──
export function FieldTextarea({
  value, onChange, placeholder, rows = 3,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-indigo-300 resize-none transition-colors"
    />
  );
}

// ── Select ──
export function FieldSelect({
  value, onChange, options, placeholder = "Select...",
}: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-indigo-300 transition-colors"
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ── Readiness Badge ──
export function ReadinessBadge({ score, label }: { score: number; label?: string }) {
  const color = score >= 70 ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : score >= 40 ? "border-amber-200 bg-amber-50 text-amber-700"
    : "border-red-200 bg-red-50 text-red-700";
  const icon = score >= 70 ? <CheckCircle2 className="w-3 h-3" />
    : score >= 40 ? <AlertTriangle className="w-3 h-3" />
    : <Circle className="w-3 h-3" />;
  return (
    <Badge variant="outline" className={`text-[9px] gap-1 ${color}`}>
      {icon} {label || "Readiness"}: {score}%
    </Badge>
  );
}

// ── RAG Dot ──
export function RagDot({ status }: { status: "green" | "amber" | "red" | "" }) {
  if (!status) return <Circle className="w-3 h-3 text-muted-foreground/30" />;
  const c = status === "green" ? "text-emerald-500" : status === "amber" ? "text-amber-500" : "text-red-500";
  return <div className={`w-3 h-3 rounded-full ${status === "green" ? "bg-emerald-500" : status === "amber" ? "bg-amber-500" : "bg-red-500"}`} />;
}

// ── Fit Selector ──
const FIT_OPTIONS = [
  { value: "strong", label: "Strong" },
  { value: "moderate", label: "Moderate" },
  { value: "weak", label: "Weak" },
];

export function FitSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1">
      {FIT_OPTIONS.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(value === o.value ? "" : o.value)}
          className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all border ${
            value === o.value
              ? o.value === "strong" ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                : o.value === "moderate" ? "bg-amber-100 border-amber-300 text-amber-700"
                : "bg-red-100 border-red-300 text-red-700"
              : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}



// ── Signal Card ──
export function SignalCard({ type, message, recommendation }: { type: "warning" | "info" | "critical"; message: string; recommendation: string }) {
  const cfg = type === "critical"
    ? { border: "border-red-200 bg-red-50", icon: <AlertTriangle className="w-3.5 h-3.5 text-red-500" />, text: "text-red-700" }
    : type === "warning"
    ? { border: "border-amber-200 bg-amber-50", icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />, text: "text-amber-700" }
    : { border: "border-blue-200 bg-blue-50", icon: <Info className="w-3.5 h-3.5 text-blue-500" />, text: "text-blue-700" };
  return (
    <div className={`flex items-start gap-2.5 p-3 rounded-lg border ${cfg.border}`}>
      <div className="mt-0.5">{cfg.icon}</div>
      <div>
        <p className={`text-xs font-medium ${cfg.text}`}>{message}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">→ {recommendation}</p>
      </div>
    </div>
  );
}

// ── Number formatter ──
export function formatSAR(val: number): string {
  return `SAR ${val.toLocaleString("en", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
