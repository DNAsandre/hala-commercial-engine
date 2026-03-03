/*
 * DashboardLayout — Persistent sidebar navigation
 * Design: Swiss Precision Instrument
 * Deep navy sidebar, warm white content area
 * IBM Plex Sans typography, 8px grid
 *
 * Navigation Simplification v1:
 *   When navigationV1 flag is ON, sidebar shows only:
 *     CORE: Dashboard, Customers, Workspaces, Tenders
 *     SYSTEM: Governance, Admin, Audit Trail
 *   All other routes remain accessible via direct URL.
 *
 * Sidebar Navigation Guard:
 *   When the DocumentComposer has unsaved changes (isDirty),
 *   sidebar links show the UnsavedChangesModal before navigating.
 */

import { useLocation } from "wouter";
import { useState, useCallback } from "react";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  FileText,
  FileCheck,
  FileSignature,
  ShieldCheck,
  Calculator,
  RefreshCw,
  FolderOpen,
  Gavel,
  Kanban,
  ArrowRightLeft,
  Settings,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Bell,
  Search,
  Edit3,
  Wrench,
  Bot,
  Radio,
  Activity,
  Star,
  Database,
  Layers,
  Camera,
  BarChart3,
  Plug,
  RotateCcw,
  Shield,
  TrendingDown,
  Dna,
  LogOut,
  AlertTriangle,
} from "lucide-react";
import { getRoleLabel } from "@/lib/store";
import { useSignals } from "@/hooks/useSupabase";
import { useEffect, useRef } from "react";
import { fetchOpenEscalationCount } from "@/lib/escalation-engine";
import { useAuth } from "@/contexts/AuthContext";
import { useComposerDirty } from "@/contexts/ComposerDirtyContext";
import UnsavedChangesModal from "@/components/UnsavedChangesModal";
import { cn } from "@/lib/utils";

// ============================================================
// FEATURE FLAG
// ============================================================
export const navigationV1 = true; // default ON — set to false to restore legacy sidebar

// ============================================================
// FULL NAV ITEMS (legacy — all items)
// ============================================================
const allNavItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, group: "core" },
  { path: "/workspaces", label: "Workspaces", icon: Briefcase, group: "core" },
  { path: "/customers", label: "Customers", icon: Users, group: "core" },
  { path: "/quotes", label: "Quotes", icon: FileText, group: "deals" },
  { path: "/proposals", label: "Proposals", icon: FileCheck, group: "deals" },
  { path: "/pnl", label: "P&L Calculator", icon: Calculator, group: "deals" },
  { path: "/slas", label: "SLAs", icon: FileSignature, group: "deals" },
  { path: "/approvals", label: "Approvals", icon: ShieldCheck, group: "deals" },
  { path: "/editor", label: "Document Composer", icon: Edit3, group: "authoring" },
  { path: "/template-manager", label: "Templates", icon: Layers, group: "authoring" },
  { path: "/branding-profiles", label: "Branding", icon: Star, group: "authoring" },
  { path: "/block-library", label: "Block Library", icon: Database, group: "authoring" },
  { path: "/block-builder", label: "Block Builder", icon: Wrench, group: "authoring" },
  { path: "/variables", label: "Variables", icon: Edit3, group: "authoring" },
  { path: "/documents", label: "Documents", icon: FolderOpen, group: "output" },
  { path: "/tenders", label: "Tenders", icon: Gavel, group: "output" },
  { path: "/tender-board", label: "Tender Board", icon: Kanban, group: "output" },
  { path: "/handover", label: "Handover", icon: ArrowRightLeft, group: "output" },
  { path: "/crm-sync", label: "CRM Sync", icon: RefreshCw, group: "system" },
  { path: "/admin", label: "Governance", icon: Settings, group: "system", adminOnly: true },
  { path: "/admin-panel", label: "Admin Panel", icon: Wrench, group: "system", adminOnly: true },
  { path: "/audit", label: "Audit Trail", icon: ClipboardList, group: "system" },
  { path: "/bot-registry", label: "Bot Governance", icon: Bot, group: "bots", adminOnly: true },
  { path: "/signal-engine", label: "Signal Engine", icon: Radio, group: "bots", adminOnly: true },
  { path: "/bot-audit", label: "Bot Audit", icon: Activity, group: "bots", adminOnly: true },
  { path: "/ecr", label: "ECR Dashboard", icon: Star, group: "ecr" },
  { path: "/ecr-metrics", label: "Metrics", icon: Database, group: "ecr", adminOnly: true },
  { path: "/ecr-rule-sets", label: "Rule Sets", icon: Layers, group: "ecr", adminOnly: true },
  { path: "/ecr-snapshots", label: "Snapshots", icon: Camera, group: "ecr", adminOnly: true },
  { path: "/ecr-scoring", label: "Scoring", icon: BarChart3, group: "ecr" },
  { path: "/ecr-connectors", label: "Connectors", icon: Plug, group: "ecr", adminOnly: true },
  { path: "/ecr-upgrades", label: "ECR Upgrades", icon: Dna, group: "ecr", adminOnly: true },
  { path: "/renewals", label: "Renewals", icon: RotateCcw, group: "renewals" },
  { path: "/renewal-gates", label: "Policy Gates", icon: Shield, group: "renewals", adminOnly: true },
  { path: "/revenue-exposure", label: "Revenue Exposure", icon: TrendingDown, group: "renewals" },
];

// ============================================================
// SIMPLIFIED NAV ITEMS (navigationV1)
// ============================================================
const simplifiedNavItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, group: "core" },
  { path: "/customers", label: "Customers", icon: Users, group: "core" },
  { path: "/workspaces", label: "Workspaces", icon: Briefcase, group: "core" },
  { path: "/tenders", label: "Tenders", icon: Gavel, group: "core" },
  { path: "/escalations", label: "Escalations", icon: AlertTriangle, group: "core" },
  { path: "/admin", label: "Governance", icon: Settings, group: "system", adminOnly: true },
  { path: "/admin-panel", label: "Admin", icon: Wrench, group: "system", adminOnly: true },
  { path: "/audit", label: "Audit Trail", icon: ClipboardList, group: "system" },
];

const allGroupLabels: Record<string, string> = {
  core: "CORE",
  deals: "DEAL ENGINE",
  authoring: "DOCUMENT COMPOSER",
  output: "OUTPUT",
  system: "SYSTEM",
  bots: "BOT GOVERNANCE",
  ecr: "CUSTOMER RATING",
  renewals: "RENEWAL ENGINE",
};

const simplifiedGroupLabels: Record<string, string> = {
  core: "CORE",
  system: "SYSTEM",
};

const allGroups = ["core", "deals", "authoring", "output", "system", "bots", "ecr", "renewals"];
const simplifiedGroups = ["core", "system"];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { appUser: currentUser, signOut } = useAuth();
  const effectiveUser = currentUser || { id: "u1", name: "Loading...", email: "", role: "admin", region: "East" };
  const { data: signals } = useSignals();
  const redCount = signals.filter(s => s.severity === "red").length;

  // Escalation open count for notification badge
  const [openEscalationCount, setOpenEscalationCount] = useState(0);
  const escalationPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const load = () => fetchOpenEscalationCount().then(setOpenEscalationCount).catch(() => {});
    load();
    escalationPollRef.current = setInterval(load, 30_000); // refresh every 30s
    return () => { if (escalationPollRef.current) clearInterval(escalationPollRef.current); };
  }, []);
  const totalBadge = redCount + openEscalationCount;

  // Sidebar navigation guard via ComposerDirtyContext
  const { guardedNavigate, showModal, closeModal, discardAndNavigate, saveAndNavigate, isSaving } = useComposerDirty();

  const isAdmin = effectiveUser.role === "admin";
  const navItems = (navigationV1 ? simplifiedNavItems : allNavItems).filter(item => !('adminOnly' in item && item.adminOnly) || isAdmin);
  const groupLabels = navigationV1 ? simplifiedGroupLabels : allGroupLabels;
  const groups = navigationV1 ? simplifiedGroups : allGroups;

  const handleNavClick = useCallback((e: React.MouseEvent, path: string) => {
    e.preventDefault();
    guardedNavigate(() => navigate(path));
  }, [guardedNavigate, navigate]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-200 ease-out border-r border-sidebar-border",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Logo */}
        <div className="flex items-center h-14 px-4 border-b border-sidebar-border">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center">
                <span className="text-white font-bold text-sm font-serif">H</span>
              </div>
              <div>
                <div className="text-sm font-semibold text-white leading-tight">Hala Commercial</div>
                <div className="text-[10px] text-sidebar-foreground/60 leading-tight">Engine v1.0</div>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center mx-auto">
              <span className="text-white font-bold text-sm font-serif">H</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {groups.map(group => {
            const groupItems = navItems.filter(item => item.group === group);
            if (groupItems.length === 0) return null;
            return (
              <div key={group} className="mb-3">
                {!collapsed && (
                  <div className="px-2 mb-1.5 text-[10px] font-semibold tracking-wider text-sidebar-foreground/40 uppercase">
                    {groupLabels[group]}
                  </div>
                )}
                {groupItems.map(item => {
                  const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.path}
                      href={item.path}
                      onClick={(e) => handleNavClick(e, item.path)}
                      className={cn(
                        "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors mb-0.5 cursor-pointer",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!collapsed && (
                        <span className="flex-1 flex items-center justify-between">
                          <span>{item.label}</span>
                          {item.path === "/escalations" && openEscalationCount > 0 && (
                            <span className="ml-auto w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                              {openEscalationCount}
                            </span>
                          )}
                        </span>
                      )}
                      {collapsed && item.path === "/escalations" && openEscalationCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold flex items-center justify-center">
                          {openEscalationCount}
                        </span>
                      )}
                    </a>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-10 border-t border-sidebar-border text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {/* User */}
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-semibold text-sidebar-accent-foreground shrink-0">
              {effectiveUser.name.split(" ").map(n => n[0]).join("")}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-white truncate">{effectiveUser.name}</div>
                <div className="text-[10px] text-sidebar-foreground/50 truncate">{getRoleLabel(effectiveUser.role as any)}</div>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={signOut}
                className="p-1.5 rounded-md hover:bg-sidebar-accent/50 text-sidebar-foreground/50 hover:text-white transition-colors"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search workspaces, customers, deals..."
                className="pl-9 pr-4 py-1.5 text-sm bg-muted rounded-md border-0 w-72 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>CRM Sync: <span className="text-foreground font-medium">2 min ago</span></span>
            </div>
            <button className="relative p-1.5 rounded-md hover:bg-muted transition-colors">
              <Bell className="w-4.5 h-4.5 text-muted-foreground" />
              {totalBadge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                  {totalBadge}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-background p-6">
          {children}
        </main>
      </div>

      {/* Sidebar Navigation Guard Modal */}
      <UnsavedChangesModal
        open={showModal}
        saving={isSaving}
        onSaveAndLeave={saveAndNavigate}
        onLeaveWithoutSaving={discardAndNavigate}
        onCancel={closeModal}
      />
    </div>
  );
}
