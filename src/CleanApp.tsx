/**
 * CleanApp — route tree for the clean app surface.
 *
 * MOUNTED AT /clean VIA wouter's <Router base="/clean">.
 * Every path below is base-relative. This is the containment mechanism: a reused
 * component that emits <Link href="/tenders"> resolves to /clean/tenders and
 * therefore cannot escape into the legacy surface. Raw <a href> tags bypass the
 * base — the only two in the copied pages (TenderWorkspace "Final Pack Studio",
 * PdfStudio "Back to Tender") were converted to <Link> in the copies.
 *
 * NO-GATE DOCTRINE: no route here is conditional on readiness, completeness,
 * approval or score. Role guards on /system/* are ACCESS CONTROL only.
 *
 * NOTHING IN THE LEGACY APP WAS DELETED OR MODIFIED to build this.
 */

import React, { Suspense } from "react";
import { Route, Router, Switch, Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import PageErrorBoundary from "@/components/PageErrorBoundary";
import CleanLayout from "./CleanLayout";
import CleanRequireRole from "./CleanRequireRole";
import { CLEAN_ADMIN_ROLES } from "./config/nav";

// ── Authored clean pages (light) ──
import CleanDashboard from "./pages/Dashboard";
import CleanRenewals from "./pages/Renewals";

// ── Copied pages (heavy — lazy loaded, mirroring App.tsx's strategy) ──
const CrmPipeline = React.lazy(() => import("./pages/CrmPipeline"));
const CustomerCommandCenter = React.lazy(() => import("./pages/CustomerCommandCenter"));
const TenderOverview = React.lazy(() => import("./pages/TenderOverview"));
const ProposalOverview = React.lazy(() => import("./pages/ProposalOverview"));
const TenderPortfolio = React.lazy(() => import("./pages/TenderPortfolio"));
const ProposalPortfolio = React.lazy(() => import("./pages/ProposalPortfolio"));
const TenderWorkspace = React.lazy(() => import("./pages/TenderWorkspace"));
const ProposalWorkspace = React.lazy(() => import("./pages/ProposalWorkspace"));
const PdfStudio = React.lazy(() => import("./pages/PdfStudio"));
const GovernanceConsole = React.lazy(() => import("./pages/GovernanceConsole"));
const Admin = React.lazy(() => import("./pages/Admin"));
const AuditTrail = React.lazy(() => import("./pages/AuditTrail"));
const Bots = React.lazy(() => import("./pages/Bots"));
const BotBuilder = React.lazy(() => import("./pages/BotBuilder"));
const BotAudit = React.lazy(() => import("./pages/BotAudit"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function LazyPage({ children }: { children: React.ReactNode }) {
  return (
    <PageErrorBoundary>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </PageErrorBoundary>
  );
}

/** Admin-guarded lazy page. Access control, not workflow gating. */
function AdminPage({ children }: { children: React.ReactNode }) {
  return (
    <LazyPage>
      <CleanRequireRole roles={CLEAN_ADMIN_ROLES}>{children}</CleanRequireRole>
    </LazyPage>
  );
}

function CleanNotFound() {
  return (
    <div className="py-24 text-center">
      <h2 className="text-lg font-semibold">Page not found</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        This route is not part of the clean app surface.
      </p>
    </div>
  );
}

export default function CleanApp() {
  return (
    <Router base="/clean">
      <CleanLayout>
        <Switch>
          <Route path="/">{() => <Redirect to="/dashboard" />}</Route>
          <Route path="/dashboard" component={CleanDashboard} />
          <Route path="/crm-pipeline">{() => <LazyPage><CrmPipeline /></LazyPage>}</Route>

          {/* Customers */}
          <Route path="/customers/tenders">{() => <LazyPage><TenderOverview /></LazyPage>}</Route>
          <Route path="/customers/proposals">{() => <LazyPage><ProposalOverview /></LazyPage>}</Route>
          <Route path="/customers/renewals" component={CleanRenewals} />
          <Route path="/customers">{() => <LazyPage><CustomerCommandCenter /></LazyPage>}</Route>

          {/* Workspaces */}
          <Route path="/workspaces/tenders">{() => <LazyPage><TenderPortfolio /></LazyPage>}</Route>
          <Route path="/workspaces/proposals">{() => <LazyPage><ProposalPortfolio /></LazyPage>}</Route>
          <Route path="/workspaces/renewals" component={CleanRenewals} />

          {/* Tender workspace + FinalStudio handoff.
              Specific route first so /tenders/:id cannot shadow it. */}
          <Route path="/tenders/:tenderId/final-pack">{() => <LazyPage><PdfStudio /></LazyPage>}</Route>
          <Route path="/tenders/:id">{() => <LazyPage><TenderWorkspace /></LazyPage>}</Route>
          <Route path="/tenders">{() => <Redirect to="/workspaces/tenders" />}</Route>

          {/* Proposal workspace — composer-free rebuild.
              Reached from PipelineCard, which emits /proposals/:id. */}
          <Route path="/proposals/:id">{() => <LazyPage><ProposalWorkspace /></LazyPage>}</Route>
          <Route path="/proposals">{() => <Redirect to="/workspaces/proposals" />}</Route>

          {/* PDF Studio — standalone entry (no tenderId → StartScreen path) */}
          <Route path="/pdf-studio">{() => <LazyPage><PdfStudio /></LazyPage>}</Route>

          {/* System — admin only */}
          <Route path="/system/governance">{() => <AdminPage><GovernanceConsole /></AdminPage>}</Route>
          <Route path="/system/admin">{() => <AdminPage><Admin /></AdminPage>}</Route>
          <Route path="/system/audit">{() => <AdminPage><AuditTrail /></AdminPage>}</Route>
          <Route path="/system/bots">{() => <AdminPage><Bots /></AdminPage>}</Route>
          <Route path="/system/bot-builder">{() => <AdminPage><BotBuilder /></AdminPage>}</Route>
          <Route path="/system/bot-audit">{() => <AdminPage><BotAudit /></AdminPage>}</Route>

          <Route component={CleanNotFound} />
        </Switch>
      </CleanLayout>
    </Router>
  );
}
