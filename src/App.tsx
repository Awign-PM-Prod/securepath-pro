import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/Layout/AppLayout";
import Index from "./pages/Index";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
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
);

export default App;
