/**
 * CleanLayout — the clean app shell.
 *
 * AUTHORED, NOT COPIED. DashboardLayout could not be reused because:
 *   1. Its nav arrays (allNavItems / simplifiedNavItems) are module-local and
 *      neither exported nor accepted as a prop — there is no seam to pass a
 *      clean nav through.
 *   2. It hard-imports ComposerDirtyContext, UnsavedChangesModal, BotAssistPanel
 *      and GlobalCRMSyncIndicator at module level.
 *   3. Its allNavItems array embeds five denylisted routes (/editor,
 *      /template-manager, /block-library, /block-builder, /variables).
 *
 * Visual language is deliberately matched to DashboardLayout so the clean app
 * looks like the same product.
 *
 * DELIBERATE OMISSIONS vs DashboardLayout:
 *   - No ComposerDirtyContext / guardedNavigate / UnsavedChangesModal
 *   - No BotAssistPanel + floating FAB (server bot_definitions stack)
 *   - No GlobalCRMSyncIndicator (pulls crm-sync-engine, 1015 lines)
 *   - No global search box (it navigated to /customers?q= outside the surface)
 *   - Each collapsible group owns its expand state (DashboardLayout shared one
 *     `opsExpanded` across all groups, so opening one opened all)
 *   - adminOnly filtering applies to every item (DashboardLayout filtered only
 *     top-level items and rendered all children unconditionally)
 */

import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, GitBranch, Users, FileSearch, FileText, RefreshCw,
  Briefcase, FolderOpen, Repeat, FileOutput, ShieldCheck, Settings,
  ScrollText, Bot, Wrench, ClipboardCheck,
  ChevronDown, ChevronLeft, ChevronRight, LogOut, Menu, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { CLEAN_NAV, type CleanNavItem } from "./config/nav";
import { cleanHref } from "./lib/clean-routing";

/** Explicit icon map — avoids `import * as` which would defeat tree-shaking. */
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  pipeline: GitBranch,
  users: Users,
  tenderOverview: FileSearch,
  proposalOverview: FileText,
  renewals: RefreshCw,
  tenderPortfolio: Briefcase,
  proposalPortfolio: FolderOpen,
  renewalsWorkspace: Repeat,
  pdfStudio: FileOutput,
  governance: ShieldCheck,
  admin: Settings,
  audit: ScrollText,
  bots: Bot,
  botBuilder: Wrench,
  botAudit: ClipboardCheck,
};

/**
 * Longest-prefix match. Plain startsWith would light up "Customer Command
 * Center" (/customers) while the user is on /customers/tenders.
 */
function useActiveHref(candidates: string[]): string | null {
  const [location] = useLocation();
  let best: string | null = null;
  for (const href of candidates) {
    if (location === href || location.startsWith(href + "/")) {
      if (!best || href.length > best.length) best = href;
    }
  }
  return best;
}

export default function CleanLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const { appUser, signOut } = useAuth();

  const role = appUser?.role ?? "";
  const visible = (item: CleanNavItem) => !item.roles || item.roles.includes(role);

  const allHrefs = CLEAN_NAV.flatMap((g) => g.items.filter(visible).map((i) => i.href));
  const activeHref = useActiveHref(allHrefs);

  const isGroupOpen = (label: string) => openGroups[label] ?? true;
  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !(prev[label] ?? true) }));

  const renderItem = (item: CleanNavItem, small = false, mobile = false) => {
    const Icon = ICONS[item.icon] ?? FileText;
    const active = activeHref === item.href;
    return (
      <Link
        key={item.href}
        href={cleanHref(item.href)}
        onClick={() => { if (mobile) setMobileOpen(false); }}
        className={cn(
          "flex items-center gap-2.5 rounded-md transition-colors mb-0.5 cursor-pointer",
          small ? "px-2.5 py-1.5 text-xs" : "px-2.5 py-2 text-sm",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            : small
              ? "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        )}
      >
        <Icon className={cn("shrink-0", small ? "w-3.5 h-3.5" : "w-4 h-4")} />
        {(mobile || !collapsed) && <span>{item.label}</span>}
      </Link>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        className={cn(
          "hidden md:flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-200 ease-out border-r border-sidebar-border",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Brand */}
        <div className="flex items-center h-14 px-4 border-b border-sidebar-border">
          <div className={cn("flex items-center gap-2", collapsed && "mx-auto")}>
            <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center">
              <span className="text-white font-bold text-sm font-serif">H</span>
            </div>
            {!collapsed && (
              <div>
                <div className="text-sm font-semibold text-white leading-tight">Hala Commercial</div>
                <div className="text-[10px] text-sidebar-foreground/60 leading-tight">Clean App</div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {CLEAN_NAV.map((group, gi) => {
            const items = group.items.filter(visible);
            if (items.length === 0) return null;

            // Ungrouped items render flat.
            if (!group.label) {
              return <div key={`g${gi}`} className="mb-3">{items.map((i) => renderItem(i))}</div>;
            }

            const open = isGroupOpen(group.label);
            const groupActive = items.some((i) => i.href === activeHref);

            return (
              <div key={group.label} className="mb-3">
                {collapsed ? (
                  items.map((i) => renderItem(i))
                ) : (
                  <>
                    <button
                      onClick={() => toggleGroup(group.label!)}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-2 py-1.5 rounded-md text-[10px] font-semibold tracking-wider uppercase transition-colors",
                        groupActive
                          ? "text-sidebar-foreground/70"
                          : "text-sidebar-foreground/40 hover:text-sidebar-foreground/70"
                      )}
                    >
                      <span className="flex-1 text-left">{group.label}</span>
                      <ChevronDown className={cn("w-3 h-3 transition-transform", !open && "-rotate-90")} />
                    </button>
                    {open && (
                      <div className="ml-2 pl-2 border-l border-sidebar-foreground/10">
                        {items.map((i) => renderItem(i, true))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-10 border-t border-sidebar-border text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {/* User */}
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-semibold text-sidebar-accent-foreground shrink-0">
              {(appUser?.name ?? "?").split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-white truncate">{appUser?.name ?? "Loading…"}</div>
                  <div className="text-[10px] text-sidebar-foreground/50 truncate">{appUser?.role ?? ""}</div>
                </div>
                <button
                  onClick={signOut}
                  className="p-1.5 rounded-md hover:bg-sidebar-accent/50 text-sidebar-foreground/50 hover:text-white transition-colors"
                  title="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button className="absolute inset-0 bg-black/35" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-white/10"><span className="text-sm font-bold text-white font-serif">H</span></div>
                <div><div className="text-sm font-semibold text-white">Hala Commercial</div><div className="text-[10px] text-sidebar-foreground/60">Clean App</div></div>
              </div>
              <button className="p-2 text-sidebar-foreground/70 hover:text-white" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X className="h-4 w-4" /></button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              {CLEAN_NAV.map((group, index) => {
                const items = group.items.filter(visible);
                if (items.length === 0) return null;
                return (
                  <div key={group.label || index} className="mb-4">
                    {group.label && <div className="px-2 py-1 text-[10px] font-semibold uppercase text-sidebar-foreground/45">{group.label}</div>}
                    {items.map((item) => renderItem(item, Boolean(group.label), true))}
                  </div>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="min-w-0 flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-border bg-card flex items-center gap-3 px-3 md:px-6 shrink-0">
          <button className="md:hidden p-2 -ml-1 rounded hover:bg-muted" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
          <div className="truncate text-sm font-medium text-muted-foreground">Hala Commercial Engine — Clean App</div>
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-background p-3 md:p-6">{children}</main>
      </div>
    </div>
  );
}
