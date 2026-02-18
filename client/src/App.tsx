import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
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

function AppRouter() {
  return (
    <Switch>
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
      <Route path="/admin" component={AdminGovernance} />
      <Route path="/admin-panel" component={AdminPanel} />
      <Route path="/audit" component={AuditTrail} />
      <Route path="/bot-registry" component={BotRegistry} />
      <Route path="/bot-builder" component={BotBuilder} />
      <Route path="/signal-engine" component={SignalEngine} />
      <Route path="/bot-audit" component={BotAudit} />
      <Route path="/ecr" component={EcrDashboard} />
      <Route path="/ecr-metrics" component={EcrMetrics} />
      <Route path="/ecr-rule-sets" component={EcrRuleSets} />
      <Route path="/ecr-snapshots" component={EcrSnapshots} />
      <Route path="/ecr-scoring" component={EcrScoring} />
      <Route path="/ecr-connectors" component={EcrConnectors} />
      <Route path="/renewals" component={Renewals} />
      <Route path="/renewals/:id" component={RenewalDetail} />
      <Route path="/renewal-gates" component={RenewalGates} />
      <Route path="/revenue-exposure" component={RevenueExposure} />
      <Route path="/ecr-upgrades" component={EcrUpgrades} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Switch>
            <Route path="/login" component={Login} />
            <Route>
              <DashboardLayout>
                <AppRouter />
              </DashboardLayout>
            </Route>
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
