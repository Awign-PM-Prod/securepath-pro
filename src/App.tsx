import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/Layout/AppLayout";
import { NoSidebarLayout } from "@/components/Layout/NoSidebarLayout";
import { LoadingFallback, ErrorFallback } from "@/components/LoadingFallback";
import Index from "./pages/Index";
import OTPAuth from "./pages/OTPAuth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import TestForgotPassword from "./pages/TestForgotPassword";
import Unauthorized from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";

// Dashboard imports
import SuperAdminDashboard from "./pages/dashboards/SuperAdminDashboard";
import OpsDashboard from "./pages/dashboards/OpsDashboard";
import VendorTeamDashboard from "./pages/dashboards/VendorTeamDashboard";
import QCDashboard from "./pages/dashboards/QCDashboard";
import VendorDashboard from "./pages/VendorDashboard";
import GigWorkerDashboard from "./pages/GigWorkerDashboard";
import GigWorkerAuth from "./pages/GigWorkerAuth";
import GigWorkerResetPassword from "./pages/GigWorkerResetPassword";
import Notifications from "./pages/Notifications";
import ClientDashboard from "./pages/dashboards/ClientDashboard";
import Reports from "./pages/dashboards/Reports";
import CaseManagement from "./pages/CaseManagement";
import AllocationManagement from "./pages/AllocationManagement";
import ClientManagement from "./pages/ClientManagement";
import ClientContractManagement from "./pages/ClientContractManagement";
import ContractTypeManagement from "./components/ClientContracts/ContractTypeManagement";
import PincodeTierManagement from "./pages/PincodeTierManagement";
import GigWorkerManagement from "./pages/GigWorkerManagement";
import VendorManagement from "./pages/VendorManagement";
import FormManagement from "./pages/FormManagement";
import DatabaseTest from "./pages/DatabaseTest";
import { TestSelect } from "./components/TestSelect";
import React from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    console.error('Error boundary caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error Boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return <ErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

const App = () => {
  console.log('App component rendering');
  
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                {/* Landing page - Login */}
                <Route path="/" element={<OTPAuth />} />
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/test-forgot-password" element={<TestForgotPassword />} />
                <Route path="/original" element={<Index />} />
                <Route path="/unauthorized" element={<Unauthorized />} />
                <Route path="/db-test" element={<DatabaseTest />} />
                
                {/* Protected routes with layout */}
                <Route path="/admin" element={
                  <ProtectedRoute allowedRoles={['super_admin']}>
                    <AppLayout />
                  </ProtectedRoute>
                }>
                  <Route index element={<SuperAdminDashboard />} />
                </Route>

                <Route path="/ops" element={
                  <ProtectedRoute allowedRoles={['ops_team']}>
                    <AppLayout />
                  </ProtectedRoute>
                }>
                  <Route index element={<OpsDashboard />} />
                  <Route path="cases" element={<CaseManagement />} />
                  <Route path="cases/create" element={<CaseManagement />} />
                  <Route path="cases/:caseId" element={<CaseManagement />} />
                  <Route path="cases/:caseId/edit" element={<CaseManagement />} />
                  <Route path="allocation" element={<AllocationManagement />} />
                  <Route path="clients" element={<ClientManagement />} />
                  <Route path="client-contracts" element={<ClientContractManagement />} />
                  <Route path="contract-types" element={<ContractTypeManagement />} />
                  <Route path="pincode-tiers" element={<PincodeTierManagement />} />
                  <Route path="gig-workers" element={<GigWorkerManagement />} />
                  <Route path="vendors" element={<VendorManagement />} />
                  <Route path="forms" element={<FormManagement />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="test-select" element={<TestSelect />} />
                </Route>

                <Route path="/vendor-team" element={
                  <ProtectedRoute allowedRoles={['vendor_team']}>
                    <AppLayout />
                  </ProtectedRoute>
                }>
                  <Route index element={<VendorTeamDashboard />} />
                </Route>

                <Route path="/qc" element={
                  <ProtectedRoute allowedRoles={['qc_team']}>
                    <NoSidebarLayout />
                  </ProtectedRoute>
                }>
                  <Route index element={<QCDashboard />} />
                </Route>

                <Route path="/vendor" element={
                  <ProtectedRoute allowedRoles={['vendor']}>
                    <NoSidebarLayout />
                  </ProtectedRoute>
                }>
                  <Route index element={<VendorDashboard />} />
                </Route>

                <Route path="/gig" element={
                  <ProtectedRoute allowedRoles={['gig_worker']}>
                    <NoSidebarLayout />
                  </ProtectedRoute>
                }>
                  <Route index element={<GigWorkerDashboard />} />
                  <Route path="notifications" element={<Notifications />} />
                </Route>

                {/* Public gig worker auth routes */}
                <Route path="/gig/setup" element={<GigWorkerAuth />} />
                <Route path="/gig/reset-password" element={<GigWorkerResetPassword />} />

                <Route path="/client" element={
                  <ProtectedRoute allowedRoles={['client']}>
                    <AppLayout />
                  </ProtectedRoute>
                }>
                  <Route index element={<ClientDashboard />} />
                </Route>

                {/* Catch-all route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
};

export default App;
