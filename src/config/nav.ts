/**
 * CLEAN APP NAVIGATION CONFIG
 *
 * Source of truth for the clean app sidebar. Derived verbatim from the
 * Claude Clean App Migration Brief (2026-07-28) sections 2 and 4.
 *
 * ROUTING NOTE
 * Superseded by SC-01.6: the standalone application operates from its OWN root.
 * There is no "/clean" prefix and no wouter base (see src/CleanApp.tsx). Every
 * path below is a real top-level route: "/dashboard" renders at "/dashboard".
 * `cleanHref` in src/lib/clean-routing.ts normalizes any surviving prototype
 * form ("~/clean/x", "/clean/x") back to the root-based path.
 *
 * DOCTRINE
 *  - ONLY approved surfaces appear here. No legacy composer / PDF Studio /
 *    document / template / block-library / variables / commercial-os routes.
 *  - Nothing here creates a business gate. Role guards are access control
 *    (admin-only system pages), NOT workflow gating.
 *  - Adding an item here is a scope change and requires Codex approval.
 */

export type CleanNavItem = {
  /** Base-relative route path. Rendered under /clean. */
  href: string;
  /** Sidebar label. Wording is approved — do not paraphrase. */
  label: string;
  /** Icon key resolved by CleanLayout's ICONS map. */
  icon: string;
  /** Restrict to these app roles. Undefined = all authenticated users. */
  roles?: string[];
};

export type CleanNavGroup = {
  label: string | null;
  items: CleanNavItem[];
};

/** Roles permitted on the System section. Mirrors ADMIN_ROLES in App.tsx. */
export const CLEAN_ADMIN_ROLES = ["admin"];

export const CLEAN_NAV: CleanNavGroup[] = [
  {
    label: null,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/crm-pipeline", label: "CRM Pipeline", icon: "pipeline" },
    ],
  },
  {
    label: "Customers",
    items: [
      { href: "/customers", label: "Customer Command Center", icon: "users" },
      { href: "/customers/tenders", label: "Tender Overview", icon: "tenderOverview" },
      { href: "/customers/proposals", label: "Proposal Overview", icon: "proposalOverview" },
      { href: "/customers/renewals", label: "Renewals Overview", icon: "renewals" },
    ],
  },
  {
    label: "Workspaces",
    items: [
      { href: "/workspaces/tenders", label: "Tender Portfolio Overview", icon: "tenderPortfolio" },
      { href: "/workspaces/proposals", label: "Proposal Portfolio Overview", icon: "proposalPortfolio" },
      { href: "/workspaces/renewals", label: "Renewals Workspace", icon: "renewalsWorkspace" },
    ],
  },
  {
    label: null,
    items: [{ href: "/pdf-studio", label: "PDF Studio", icon: "pdfStudio" }],
  },
  {
    label: "System",
    items: [
      { href: "/system/governance", label: "Governance Console", icon: "governance", roles: CLEAN_ADMIN_ROLES },
      { href: "/system/admin", label: "Admin", icon: "admin", roles: CLEAN_ADMIN_ROLES },
      { href: "/system/audit", label: "Audit Trail", icon: "audit", roles: CLEAN_ADMIN_ROLES },
      { href: "/system/bots", label: "Bots", icon: "bots", roles: CLEAN_ADMIN_ROLES },
      { href: "/system/bot-builder", label: "Bot Builder", icon: "botBuilder", roles: CLEAN_ADMIN_ROLES },
      { href: "/system/bot-audit", label: "Bot Audit", icon: "botAudit", roles: CLEAN_ADMIN_ROLES },
    ],
  },
];

/** Flat list of every route the clean sidebar can reach. Used by verification. */
export const CLEAN_NAV_ROUTES = CLEAN_NAV.flatMap((g) => g.items.map((i) => i.href));
