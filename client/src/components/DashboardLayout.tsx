/*
 * DashboardLayout — Persistent sidebar navigation
 * Design: Swiss Precision Instrument
 * Deep navy sidebar, warm white content area
 * IBM Plex Sans typography, 8px grid
 */

import { Link, useLocation } from "wouter";
import { useState } from "react";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  FileText,
  FileCheck,
  ShieldCheck,
  Calculator,
  RefreshCw,
  FolderOpen,
  Gavel,
  ArrowRightLeft,
  Settings,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Bell,
  Search,
  LogOut,
  Edit3,
  Wrench,
  Bot,
} from "lucide-react";
import { currentUser, getRoleLabel, signals } from "@/lib/store";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, group: "core" },
  { path: "/workspaces", label: "Workspaces", icon: Briefcase, group: "core" },
  { path: "/customers", label: "Customers", icon: Users, group: "core" },
  { path: "/quotes", label: "Quotes", icon: FileText, group: "deals" },
  { path: "/proposals", label: "Proposals", icon: FileCheck, group: "deals" },
  { path: "/pnl", label: "P&L Calculator", icon: Calculator, group: "deals" },
  { path: "/approvals", label: "Approvals", icon: ShieldCheck, group: "deals" },
  { path: "/editor", label: "Editor", icon: Edit3, group: "authoring" },
  { path: "/documents", label: "Documents", icon: FolderOpen, group: "output" },
  { path: "/tenders", label: "Tenders", icon: Gavel, group: "output" },
  { path: "/handover", label: "Handover", icon: ArrowRightLeft, group: "output" },
  { path: "/crm-sync", label: "CRM Sync", icon: RefreshCw, group: "system" },
  { path: "/admin", label: "Governance", icon: Settings, group: "system" },
  { path: "/admin-panel", label: "Admin Panel", icon: Wrench, group: "system" },
  { path: "/audit", label: "Audit Trail", icon: ClipboardList, group: "system" },
];

const groupLabels: Record<string, string> = {
  core: "CORE",
  deals: "DEAL ENGINE",
  authoring: "AUTHORING",
  output: "OUTPUT",
  system: "SYSTEM",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const redCount = signals.filter(s => s.severity === "red").length;

  const groups = ["core", "deals", "authoring", "output", "system"];

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
          {groups.map(group => (
            <div key={group} className="mb-3">
              {!collapsed && (
                <div className="px-2 mb-1.5 text-[10px] font-semibold tracking-wider text-sidebar-foreground/40 uppercase">
                  {groupLabels[group]}
                </div>
              )}
              {navItems
                .filter(item => item.group === group)
                .map(item => {
                  const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                  const Icon = item.icon;
                  return (
                    <Link key={item.path} href={item.path}>
                      <div
                        className={cn(
                          "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors mb-0.5",
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        )}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {!collapsed && <span>{item.label}</span>}
                      </div>
                    </Link>
                  );
                })}
            </div>
          ))}
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
              {currentUser.name.split(" ").map(n => n[0]).join("")}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-xs font-medium text-white truncate">{currentUser.name}</div>
                <div className="text-[10px] text-sidebar-foreground/50 truncate">{getRoleLabel(currentUser.role)}</div>
              </div>
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
              {redCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                  {redCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
