import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import PageErrorBoundary from "./components/PageErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import DashboardLayout from "./components/DashboardLayout";
import { ComposerDirtyProvider } from "./contexts/ComposerDirtyContext";
import RequireRole from "./components/RequireRole";
import { Loader2 } from "lucide-react";

// ── Eagerly loaded (lightweight, frequently visited) ──────────
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import Login from "./pages/Login";

// ── Lazy loaded (heavy pages) ─────────────────────────────────
const WorkspaceDetail = React.lazy(() => import("./pages/WorkspaceDetail"));
const CustomerDetail = React.lazy(() => import("./pages/CustomerDetail"));
const Quotes = React.lazy(() => import("./pages/Quotes"));
const Proposals = React.lazy(() => import("./pages/Proposals"));
const SLAs = React.lazy(() => import("./pages/SLAs"));
const Approvals = React.lazy(() => import("./pages/Approvals"));
const PnLCalculator = React.lazy(() => import("./pages/PnLCalculator"));
const CRMSync = React.lazy(() => import("./pages/CRMSync"));
const Documents = React.lazy(() => import("./pages/Documents"));
const Tenders = React.lazy(() => import("./pages/Tenders"));
const Commercial = React.lazy(() => import("./pages/Commercial"));
const TenderBoard = React.lazy(() => import("./pages/TenderBoard"));
const TendersOverview = React.lazy(() => import("./pages/TendersOverview"));
const CommercialOverview = React.lazy(() => import("./pages/CommercialOverview"));
const RenewalsOverview = React.lazy(() => import("./pages/RenewalsOverview"));
const Handover = React.lazy(() => import("./pages/Handover"));
const AdminGovernance = React.lazy(() => import("./pages/AdminGovernance"));
const AdminPanel = React.lazy(() => import("./pages/AdminPanel"));
const AuditTrail = React.lazy(() => import("./pages/AuditTrail"));
const Editor = React.lazy(() => import("./pages/Editor"));
const BotRegistry = React.lazy(() => import("./pages/BotRegistry"));
const BotBuilder = React.lazy(() => import("./pages/BotBuilder"));
const SignalEngine = React.lazy(() => import("./pages/SignalEngine"));
const BotAudit = React.lazy(() => import("./pages/BotAudit"));
const EcrDashboard = React.lazy(() => import("./pages/EcrDashboard"));
const EcrMetrics = React.lazy(() => import("./pages/EcrMetrics"));
const EcrRuleSets = React.lazy(() => import("./pages/EcrRuleSets"));
const EcrSnapshots = React.lazy(() => import("./pages/EcrSnapshots"));
const EcrScoring = React.lazy(() => import("./pages/EcrScoring"));
const EcrConnectors = React.lazy(() => import("./pages/EcrConnectors"));
const Renewals = React.lazy(() => import("./pages/Renewals"));
const RenewalDetail = React.lazy(() => import("./pages/RenewalDetail"));
const RenewalGates = React.lazy(() => import("./pages/RenewalGates"));
const RevenueExposure = React.lazy(() => import("./pages/RevenueExposure"));
const EcrUpgrades = React.lazy(() => import("./pages/EcrUpgrades"));
const TemplateManager = React.lazy(() => import("./pages/TemplateManager"));
const BrandingProfiles = React.lazy(() => import("./pages/BrandingProfiles"));
const BlockLibrary = React.lazy(() => import("./pages/BlockLibrary"));
const BlockBuilder = React.lazy(() => import("./pages/BlockBuilder"));
const VariablesManager = React.lazy(() => import("./pages/VariablesManager"));
const TemplateDesigner = React.lazy(() => import("./pages/TemplateDesigner"));
const OutputStudio = React.lazy(() => import("./pages/OutputStudio"));
const GlobalEscalations = React.lazy(() => import("./pages/GlobalEscalations"));
const AIProviders = React.lazy(() => import("./pages/AIProviders"));
const EditorBotBuilder = React.lazy(() => import("./pages/EditorBotBuilder"));
const KnowledgebaseManager = React.lazy(() => import("./pages/KnowledgebaseManager"));
const CRMSyncConsole = React.lazy(() => import("./pages/CRMSyncConsole"));
const PDFStudio = React.lazy(() => import("./pages/PDFStudio"));
const DocumentVault = React.lazy(() => import("./pages/DocumentVault"));

/**
 * Admin-only routes: require "admin" role.
 */
const ADMIN_ROLES = ["admin"];

/** Compact loading spinner for page transitions */
function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

/** Wraps lazy pages with Suspense + per-page error boundary */
function LazyPage({ children }: { children: React.ReactNode }) {
  return (
    <PageErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </PageErrorBoundary>
  );
}

function AppRouter() {
  return (
    <Switch>
      {/* ── Eagerly loaded (no Suspense needed) ──────────────── */}
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      {/* /workspaces → redirect to dedicated Commercial Pipeline */}
      <Route path="/workspaces">{() => <Redirect to="/commercial" />}</Route>
      <Route path="/customers" component={Customers} />

      {/* ── Lazy loaded public routes ────────────────────────── */}
      <Route path="/workspaces/:id">{() => <LazyPage><WorkspaceDetail /></LazyPage>}</Route>
      <Route path="/customers/:id">{() => <LazyPage><CustomerDetail /></LazyPage>}</Route>
      <Route path="/quotes">{() => <LazyPage><Quotes /></LazyPage>}</Route>
      <Route path="/proposals">{() => <LazyPage><Proposals /></LazyPage>}</Route>
      <Route path="/slas">{() => <LazyPage><SLAs /></LazyPage>}</Route>
      <Route path="/approvals">{() => <LazyPage><Approvals /></LazyPage>}</Route>
      <Route path="/pnl">{() => <LazyPage><PnLCalculator /></LazyPage>}</Route>
      <Route path="/crm-sync">{() => <LazyPage><CRMSync /></LazyPage>}</Route>
      <Route path="/documents">{() => <LazyPage><Documents /></LazyPage>}</Route>
      <Route path="/tenders">{() => <LazyPage><Tenders /></LazyPage>}</Route>
      <Route path="/commercial">{() => <LazyPage><Commercial /></LazyPage>}</Route>
      <Route path="/tenders-overview">{() => <LazyPage><TendersOverview /></LazyPage>}</Route>
      <Route path="/commercial-overview">{() => <LazyPage><CommercialOverview /></LazyPage>}</Route>
      <Route path="/renewals-overview">{() => <LazyPage><RenewalsOverview /></LazyPage>}</Route>
      <Route path="/tender-board">{() => <LazyPage><TenderBoard /></LazyPage>}</Route>
      <Route path="/handover">{() => <LazyPage><Handover /></LazyPage>}</Route>
      <Route path="/editor">{() => <LazyPage><Editor /></LazyPage>}</Route>
      <Route path="/renewals">{() => <LazyPage><Renewals /></LazyPage>}</Route>
      <Route path="/renewals/:id">{() => <LazyPage><RenewalDetail /></LazyPage>}</Route>
      <Route path="/ecr">{() => <LazyPage><EcrDashboard /></LazyPage>}</Route>
      <Route path="/ecr-scoring">{() => <LazyPage><EcrScoring /></LazyPage>}</Route>
      <Route path="/composer/:docInstanceId/view">{() => <LazyPage><OutputStudio /></LazyPage>}</Route>
      <Route path="/escalations">{() => <LazyPage><GlobalEscalations /></LazyPage>}</Route>
      <Route path="/pdf-studio">{() => <LazyPage><PDFStudio /></LazyPage>}</Route>
      <Route path="/document-vault">{() => <LazyPage><DocumentVault /></LazyPage>}</Route>

      {/* ── Admin-only routes (lazy + role guard) ────────────── */}
      <Route path="/admin">{() => <LazyPage><RequireRole roles={ADMIN_ROLES} component={AdminGovernance} /></LazyPage>}</Route>
      <Route path="/admin-panel">{() => <LazyPage><RequireRole roles={ADMIN_ROLES} component={AdminPanel} /></LazyPage>}</Route>
      <Route path="/audit">{() => <LazyPage><RequireRole roles={ADMIN_ROLES} component={AuditTrail} /></LazyPage>}</Route>
      <Route path="/bot-registry">{() => <LazyPage><RequireRole roles={ADMIN_ROLES} component={BotRegistry} /></LazyPage>}</Route>
      <Route path="/bot-builder">{() => <LazyPage><RequireRole roles={ADMIN_ROLES} component={BotBuilder} /></LazyPage>}</Route>
      <Route path="/signal-engine">{() => <LazyPage><RequireRole roles={ADMIN_ROLES} component={SignalEngine} /></LazyPage>}</Route>
      <Route path="/bot-audit">{() => <LazyPage><RequireRole roles={ADMIN_ROLES} component={BotAudit} /></LazyPage>}</Route>
      <Route path="/ecr-metrics">{() => <LazyPage><RequireRole roles={ADMIN_ROLES} component={EcrMetrics} /></LazyPage>}</Route>
      <Route path="/ecr-rule-sets">{() => <LazyPage><RequireRole roles={ADMIN_ROLES} component={EcrRuleSets} /></LazyPage>}</Route>
      <Route path="/ecr-snapshots">{() => <LazyPage><RequireRole roles={ADMIN_ROLES} component={EcrSnapshots} /></LazyPage>}</Route>
      <Route path="/ecr-connectors">{() => <LazyPage><RequireRole roles={ADMIN_ROLES} component={EcrConnectors} /></LazyPage>}</Route>
      <Route path="/renewal-gates">{() => <LazyPage><RequireRole roles={ADMIN_ROLES} component={RenewalGates} /></LazyPage>}</Route>
      <Route path="/revenue-exposure">{() => <LazyPage><RequireRole roles={ADMIN_ROLES} component={RevenueExposure} /></LazyPage>}</Route>
      <Route path="/ecr-upgrades">{() => <LazyPage><RequireRole roles={ADMIN_ROLES} component={EcrUpgrades} /></LazyPage>}</Route>
      <Route path="/template-manager">{() => <LazyPage><RequireRole roles={ADMIN_ROLES} component={TemplateManager} /></LazyPage>}</Route>
      <Route path="/branding-profiles">{() => <LazyPage><RequireRole roles={ADMIN_ROLES} component={BrandingProfiles} /></LazyPage>}</Route>
      <Route path="/block-library">{() => <LazyPage><RequireRole roles={ADMIN_ROLES} component={BlockLibrary} /></LazyPage>}</Route>
      <Route path="/block-builder">{() => <LazyPage><RequireRole roles={ADMIN_ROLES} component={BlockBuilder} /></LazyPage>}</Route>
      <Route path="/variables">{() => <LazyPage><RequireRole roles={ADMIN_ROLES} component={VariablesManager} /></LazyPage>}</Route>
      <Route path="/templates/:templateId/designer">{() => <LazyPage><RequireRole roles={ADMIN_ROLES} component={TemplateDesigner} /></LazyPage>}</Route>
      <Route path="/ai-providers">{() => <LazyPage><RequireRole roles={ADMIN_ROLES} component={AIProviders} /></LazyPage>}</Route>
      <Route path="/editor-bot-builder">{() => <LazyPage><RequireRole roles={ADMIN_ROLES} component={EditorBotBuilder} /></LazyPage>}</Route>
      <Route path="/knowledgebase">{() => <LazyPage><RequireRole roles={ADMIN_ROLES} component={KnowledgebaseManager} /></LazyPage>}</Route>
      <Route path="/crm-sync-console">{() => <LazyPage><RequireRole roles={ADMIN_ROLES} component={CRMSyncConsole} /></LazyPage>}</Route>

      {/* ── 404 ─────────────────────────────────────────────── */}
      <Route component={NotFound} />
    </Switch>
  );
}

/** Loading spinner shown while checking auth session */
function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

/** Route guard: redirects to /login if not authenticated */
function ProtectedApp() {
  const { session, loading } = useAuth();

  if (loading) return <AuthLoading />;
  if (!session) return <Redirect to="/login" />;

  return (
    <ComposerDirtyProvider>
      <DashboardLayout>
        <AppRouter />
      </DashboardLayout>
    </ComposerDirtyProvider>
  );
}

/** Public login route: redirects to / if already authenticated */
function PublicLogin() {
  const { session, loading } = useAuth();

  if (loading) return <AuthLoading />;
  if (session) return <Redirect to="/" />;

  return <Login />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Switch>
              <Route path="/login" component={PublicLogin} />
              <Route>
                <ProtectedApp />
              </Route>
            </Switch>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
