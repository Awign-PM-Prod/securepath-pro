import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/Layout/AppLayout";
import { LoadingFallback, ErrorFallback } from "@/components/LoadingFallback";
import Index from "./pages/Index";
import TestPage from "./pages/TestPage";
import Login from "./pages/Login";
import Unauthorized from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";

// Dashboard imports
import SuperAdminDashboard from "./pages/dashboards/SuperAdminDashboard";
import OpsDashboard from "./pages/dashboards/OpsDashboard";
import VendorTeamDashboard from "./pages/dashboards/VendorTeamDashboard";
import QCDashboard from "./pages/dashboards/QCDashboard";
import VendorDashboard from "./pages/dashboards/VendorDashboard";
import GigWorkerDashboard from "./pages/dashboards/GigWorkerDashboard";
import ClientDashboard from "./pages/dashboards/ClientDashboard";
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
                {/* Test route */}
                <Route path="/" element={<TestPage />} />
                <Route path="/original" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/unauthorized" element={<Unauthorized />} />
                
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
                    <AppLayout />
                  </ProtectedRoute>
                }>
                  <Route index element={<QCDashboard />} />
                </Route>

                <Route path="/vendor" element={
                  <ProtectedRoute allowedRoles={['vendor']}>
                    <AppLayout />
                  </ProtectedRoute>
                }>
                  <Route index element={<VendorDashboard />} />
                </Route>

                <Route path="/gig" element={
                  <ProtectedRoute allowedRoles={['gig_worker']}>
                    <AppLayout />
                  </ProtectedRoute>
                }>
                  <Route index element={<GigWorkerDashboard />} />
                </Route>

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
