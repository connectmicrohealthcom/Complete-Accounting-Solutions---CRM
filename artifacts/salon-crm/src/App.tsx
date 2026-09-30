import { ProtectedRoute } from "@/components/protected-route";
import { Layout } from "@/components/layout";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Appointments from "@/pages/appointments";
import Calendar from "@/pages/calendar";
import Clients from "@/pages/clients";
import ClientForm from "@/pages/client-form";
import ClientProfile from "@/pages/client-profile";
import Services from "@/pages/services";
import Staff from "@/pages/staff";
import StaffForm from "@/pages/staff-form";
import StaffProfile from "@/pages/staff-profile";
import StaffFinancials from "@/pages/staff-financials";
import StaffTips from "@/pages/staff-tips";
import Payroll from "@/pages/payroll";
import Sales from "@/pages/sales";
import Inventory from "@/pages/inventory";
import Loyalty from "@/pages/loyalty";
import Settings from "@/pages/settings";
import FinancePaymentSummary from "@/pages/finance-payment-summary";
import FinanceExpenses from "@/pages/finance-expenses";
import FinanceReports from "@/pages/finance-reports";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />

      <Route path="/dashboard">
        <ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>
      </Route>
      <Route path="/calendar">
        <ProtectedRoute><Layout><Calendar /></Layout></ProtectedRoute>
      </Route>
      <Route path="/appointments">
        <ProtectedRoute><Layout><Appointments /></Layout></ProtectedRoute>
      </Route>

      <Route path="/clients/new">
        <ProtectedRoute><Layout><ClientForm /></Layout></ProtectedRoute>
      </Route>
      <Route path="/clients/:id">
        <ProtectedRoute><Layout><ClientProfile /></Layout></ProtectedRoute>
      </Route>
      <Route path="/clients">
        <ProtectedRoute><Layout><Clients /></Layout></ProtectedRoute>
      </Route>

      <Route path="/services">
        <ProtectedRoute><Layout><Services /></Layout></ProtectedRoute>
      </Route>

      <Route path="/tips">
        <ProtectedRoute><Layout><StaffTips /></Layout></ProtectedRoute>
      </Route>
      <Route path="/payroll">
        <ProtectedRoute><Layout><Payroll /></Layout></ProtectedRoute>
      </Route>

      {/* Staff routes — financials must come before :id */}
      <Route path="/staff/new">
        <ProtectedRoute><Layout><StaffForm /></Layout></ProtectedRoute>
      </Route>
      <Route path="/staff/:id/financials">
        <ProtectedRoute><Layout><StaffFinancials /></Layout></ProtectedRoute>
      </Route>
      <Route path="/staff/:id">
        <ProtectedRoute><Layout><StaffProfile /></Layout></ProtectedRoute>
      </Route>
      <Route path="/staff">
        <ProtectedRoute><Layout><Staff /></Layout></ProtectedRoute>
      </Route>

      <Route path="/sales">
        <ProtectedRoute><Layout><Sales /></Layout></ProtectedRoute>
      </Route>
      <Route path="/inventory">
        <ProtectedRoute><Layout><Inventory /></Layout></ProtectedRoute>
      </Route>
      <Route path="/loyalty">
        <ProtectedRoute><Layout><Loyalty /></Layout></ProtectedRoute>
      </Route>

      <Route path="/finance/payments">
        <ProtectedRoute><Layout><FinancePaymentSummary /></Layout></ProtectedRoute>
      </Route>
      <Route path="/finance/expenses">
        <ProtectedRoute><Layout><FinanceExpenses /></Layout></ProtectedRoute>
      </Route>
      <Route path="/finance/reports">
        <ProtectedRoute><Layout><FinanceReports /></Layout></ProtectedRoute>
      </Route>

      <Route path="/settings">
        <ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>
      </Route>

      <Route path="/">
        <ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRouter />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
