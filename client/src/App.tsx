import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CompanyProvider } from "./contexts/CompanyContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Documents from "./pages/Documents";
import BankStatements from "./pages/BankStatements";
import Transactions from "./pages/Transactions";
import IncomeStatement from "./pages/IncomeStatement";
import Financials from "./pages/Financials";
import Advisors from "./pages/Advisors";
import Companies from "./pages/Companies";

function DashboardRoutes() {
  return (
    <CompanyProvider>
      <DashboardLayout>
        <Switch>
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/documents" component={Documents} />
          <Route path="/bank-statements" component={BankStatements} />
          <Route path="/transactions" component={Transactions} />
          <Route path="/income-statement" component={IncomeStatement} />
          <Route path="/financials" component={Financials} />
          <Route path="/advisors" component={Advisors} />
          <Route path="/companies" component={Companies} />
          <Route component={NotFound} />
        </Switch>
      </DashboardLayout>
    </CompanyProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/404" component={NotFound} />
      <Route>
        <DashboardRoutes />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
