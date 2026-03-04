import React from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import DashboardLayout from "./components/DashboardLayout";
import { ComposerDirtyProvider } from "./contexts/ComposerDirtyContext";
import RequireRole from "./components/RequireRole";
import Dashboard from "./pages/Dashboard";
import Workspaces from "./pages/Workspaces";
import WorkspaceDetail from "./pages/WorkspaceDetail";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Quotes from "./pages/Quotes";
import Proposals from "./pages/Proposals";
import SLAs from "./pages/SLAs";
import Approvals from "./pages/Approvals";
import PnLCalculator from "./pages/PnLCalculator";
import CRMSync from "./pages/CRMSync";
import Documents from "./pages/Documents";
import Tenders from "./pages/Tenders";
import TenderBoard from "./pages/TenderBoard";
import Handover from "./pages/Handover";
import AdminGovernance from "./pages/AdminGovernance";
import AdminPanel from "./pages/AdminPanel";
import AuditTrail from "./pages/AuditTrail";
import Editor from "./pages/Editor";
import Login from "./pages/Login";
import BotRegistry from "./pages/BotRegistry";
import BotBuilder from "./pages/BotBuilder";
import SignalEngine from "./pages/SignalEngine";
import BotAudit from "./pages/BotAudit";
import EcrDashboard from "./pages/EcrDashboard";
import EcrMetrics from "./pages/EcrMetrics";
import EcrRuleSets from "./pages/EcrRuleSets";
import EcrSnapshots from "./pages/EcrSnapshots";
import EcrScoring from "./pages/EcrScoring";
import EcrConnectors from "./pages/EcrConnectors";
import Renewals from "./pages/Renewals";
import RenewalDetail from "./pages/RenewalDetail";
import RenewalGates from "./pages/RenewalGates";
import RevenueExposure from "./pages/RevenueExposure";
import EcrUpgrades from "./pages/EcrUpgrades";
import TemplateManager from "./pages/TemplateManager";
import BrandingProfiles from "./pages/BrandingProfiles";
import BlockLibrary from "./pages/BlockLibrary";
import BlockBuilder from "./pages/BlockBuilder";
import VariablesManager from "./pages/VariablesManager";
import TemplateDesigner from "./pages/TemplateDesigner";
import OutputStudio from "./pages/OutputStudio";
import GlobalEscalations from "./pages/GlobalEscalations";
import AIProviders from "./pages/AIProviders";
import EditorBotBuilder from "./pages/EditorBotBuilder";
import KnowledgebaseManager from "./pages/KnowledgebaseManager";
import CRMSyncConsole from "./pages/CRMSyncConsole";
import PDFStudio from "./pages/PDFStudio";
import { Loader2 } from "lucide-react";

/**
 * Admin-only routes: require "admin" role.
 * These pages manage system configuration, governance rules, bot behavior,
 * and audit trails — they should not be accessible to sales/viewer users.
 */
const ADMIN_ROLES = ["admin"];

function AppRouter() {
  return (
    <Switch>
      {/* ── Public (any authenticated user) ─────────────────── */}
      <Route path="/" component={Dashboard} />
      <Route path="/workspaces" component={Workspaces} />
      <Route path="/workspaces/:id" component={WorkspaceDetail} />
      <Route path="/customers" component={Customers} />
      <Route path="/customers/:id" component={CustomerDetail} />
      <Route path="/quotes" component={Quotes} />
      <Route path="/proposals" component={Proposals} />
      <Route path="/slas" component={SLAs} />
      <Route path="/approvals" component={Approvals} />
      <Route path="/pnl" component={PnLCalculator} />
      <Route path="/crm-sync" component={CRMSync} />
      <Route path="/documents" component={Documents} />
      <Route path="/tenders" component={Tenders} />
      <Route path="/tender-board" component={TenderBoard} />
      <Route path="/handover" component={Handover} />
      <Route path="/editor" component={Editor} />
      <Route path="/renewals" component={Renewals} />
      <Route path="/renewals/:id" component={RenewalDetail} />
      <Route path="/ecr" component={EcrDashboard} />
      <Route path="/ecr-scoring" component={EcrScoring} />
      <Route path="/composer/:docInstanceId/view" component={OutputStudio} />
      <Route path="/escalations" component={GlobalEscalations} />
      <Route path="/pdf-studio" component={PDFStudio} />

      {/* ── Admin-only routes ───────────────────────────────── */}
      <Route path="/admin">{() => <RequireRole roles={ADMIN_ROLES} component={AdminGovernance} />}</Route>
      <Route path="/admin-panel">{() => <RequireRole roles={ADMIN_ROLES} component={AdminPanel} />}</Route>
      <Route path="/audit">{() => <RequireRole roles={ADMIN_ROLES} component={AuditTrail} />}</Route>
      <Route path="/bot-registry">{() => <RequireRole roles={ADMIN_ROLES} component={BotRegistry} />}</Route>
      <Route path="/bot-builder">{() => <RequireRole roles={ADMIN_ROLES} component={BotBuilder} />}</Route>
      <Route path="/signal-engine">{() => <RequireRole roles={ADMIN_ROLES} component={SignalEngine} />}</Route>
      <Route path="/bot-audit">{() => <RequireRole roles={ADMIN_ROLES} component={BotAudit} />}</Route>
      <Route path="/ecr-metrics">{() => <RequireRole roles={ADMIN_ROLES} component={EcrMetrics} />}</Route>
      <Route path="/ecr-rule-sets">{() => <RequireRole roles={ADMIN_ROLES} component={EcrRuleSets} />}</Route>
      <Route path="/ecr-snapshots">{() => <RequireRole roles={ADMIN_ROLES} component={EcrSnapshots} />}</Route>
      <Route path="/ecr-connectors">{() => <RequireRole roles={ADMIN_ROLES} component={EcrConnectors} />}</Route>
      <Route path="/renewal-gates">{() => <RequireRole roles={ADMIN_ROLES} component={RenewalGates} />}</Route>
      <Route path="/revenue-exposure">{() => <RequireRole roles={ADMIN_ROLES} component={RevenueExposure} />}</Route>
      <Route path="/ecr-upgrades">{() => <RequireRole roles={ADMIN_ROLES} component={EcrUpgrades} />}</Route>
      <Route path="/template-manager">{() => <RequireRole roles={ADMIN_ROLES} component={TemplateManager} />}</Route>
      <Route path="/branding-profiles">{() => <RequireRole roles={ADMIN_ROLES} component={BrandingProfiles} />}</Route>
      <Route path="/block-library">{() => <RequireRole roles={ADMIN_ROLES} component={BlockLibrary} />}</Route>
      <Route path="/block-builder">{() => <RequireRole roles={ADMIN_ROLES} component={BlockBuilder} />}</Route>
      <Route path="/variables">{() => <RequireRole roles={ADMIN_ROLES} component={VariablesManager} />}</Route>
      <Route path="/templates/:templateId/designer">{() => <RequireRole roles={ADMIN_ROLES} component={TemplateDesigner} />}</Route>
      <Route path="/ai-providers">{() => <RequireRole roles={ADMIN_ROLES} component={AIProviders} />}</Route>
      <Route path="/editor-bot-builder">{() => <RequireRole roles={ADMIN_ROLES} component={EditorBotBuilder} />}</Route>
      <Route path="/knowledgebase">{() => <RequireRole roles={ADMIN_ROLES} component={KnowledgebaseManager} />}</Route>
      <Route path="/crm-sync-console">{() => <RequireRole roles={ADMIN_ROLES} component={CRMSyncConsole} />}</Route>

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
