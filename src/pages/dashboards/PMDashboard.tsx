import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, 
  Building2, 
  Briefcase, 
  FileText, 
  CheckCircle, 
  Clock, 
  XCircle,
  Activity,
  TrendingUp,
  UserCheck,
  Send,
  Database,
  BarChart3,
  Calendar
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PMDashboardStats {
  // User Statistics
  totalUsers: number;
  superAdmins: number;
  opsTeam: number;
  vendorTeam: number;
  qcTeam: number;
  vendors: number;
  gigWorkers: number;
  clients: number;
  
  // Case Statistics
  totalCases: number;
  casesByStatus: {
    new: number;
    created: number;
    auto_allocated: number;
    accepted: number;
    in_progress: number;
    submitted: number;
    qc_pending: number;
    qc_passed: number;
    qc_failed: number;
    completed: number;
    cancelled: number;
  };
  
  // Activity Statistics
  totalSubmissions: number;
  totalQCReviews: number;
  totalAllocations: number;
  
  // Recent Activity (Last 7 days)
  casesCreatedLast7Days: number;
  casesCompletedLast7Days: number;
  submissionsLast7Days: number;
  qcReviewsLast7Days: number;
  
  // Active Entities
  activeVendors: number;
  activeGigWorkers: number;
  activeClients: number;
}

export default function PMDashboard() {
  const [stats, setStats] = useState<PMDashboardStats>({
    totalUsers: 0,
    superAdmins: 0,
    opsTeam: 0,
    vendorTeam: 0,
    qcTeam: 0,
    vendors: 0,
    gigWorkers: 0,
    clients: 0,
    totalCases: 0,
    casesByStatus: {
      new: 0,
      created: 0,
      auto_allocated: 0,
      accepted: 0,
      in_progress: 0,
      submitted: 0,
      qc_pending: 0,
      qc_passed: 0,
      qc_failed: 0,
      completed: 0,
      cancelled: 0,
    },
    totalSubmissions: 0,
    totalQCReviews: 0,
    totalAllocations: 0,
    casesCreatedLast7Days: 0,
    casesCompletedLast7Days: 0,
    submissionsLast7Days: 0,
    qcReviewsLast7Days: 0,
    activeVendors: 0,
    activeGigWorkers: 0,
    activeClients: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoISO = sevenDaysAgo.toISOString();

        // Fetch all statistics in parallel
        const [
          // User counts by role
          superAdminsResult,
          opsTeamResult,
          qcTeamResult,
          vendorsResult,
          gigWorkersResult,
          clientsResult,
          // Case statistics
          totalCasesResult,
          casesByStatusResult,
          // Activity statistics
          submissionsResult,
          qcReviewsResult,
          allocationsResult,
          // Recent activity (last 7 days)
          casesCreated7DaysResult,
          casesCompleted7DaysResult,
          submissions7DaysResult,
          qcReviews7DaysResult,
          // Active entities
          activeVendorsResult,
          activeGigWorkersResult,
          activeClientsResult,
        ] = await Promise.all([
          // User counts
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'super_admin').eq('is_active', true),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'ops_team').eq('is_active', true),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'qc_team').eq('is_active', true),
          supabase.from('vendors').select('*', { count: 'exact', head: true }),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'gig_worker').eq('is_active', true),
          supabase.from('clients').select('*', { count: 'exact', head: true }),
          // Case statistics
          supabase.from('cases').select('*', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('cases').select('status').eq('is_active', true),
          // Activity statistics
          supabase.from('submissions').select('*', { count: 'exact', head: true }),
          supabase.from('qc_reviews').select('*', { count: 'exact', head: true }),
          supabase.from('allocation_logs').select('*', { count: 'exact', head: true }),
          // Recent activity
          supabase.from('cases').select('*', { count: 'exact', head: true }).eq('is_active', true).gte('created_at', sevenDaysAgoISO),
          supabase.from('cases').select('*', { count: 'exact', head: true }).eq('is_active', true).in('status', ['completed', 'qc_passed']).gte('updated_at', sevenDaysAgoISO),
          supabase.from('submissions').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgoISO),
          supabase.from('qc_reviews').select('*', { count: 'exact', head: true }).gte('reviewed_at', sevenDaysAgoISO),
          // Active entities
          supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('gig_partners').select('*', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('clients').select('*', { count: 'exact', head: true }).eq('is_active', true),
        ]);

        // Calculate cases by status
        const casesByStatus: PMDashboardStats['casesByStatus'] = {
          new: 0,
          created: 0,
          auto_allocated: 0,
          accepted: 0,
          in_progress: 0,
          submitted: 0,
          qc_pending: 0,
          qc_passed: 0,
          qc_failed: 0,
          completed: 0,
          cancelled: 0,
        };

        if (casesByStatusResult.data) {
          casesByStatusResult.data.forEach((caseItem: any) => {
            const status = caseItem.status as keyof typeof casesByStatus;
            if (status in casesByStatus) {
              casesByStatus[status]++;
            }
          });
        }

        // Calculate total users
        const totalUsers = 
          (superAdminsResult.count || 0) +
          (opsTeamResult.count || 0) +
          (qcTeamResult.count || 0) +
          (gigWorkersResult.count || 0);

        setStats({
          totalUsers,
          superAdmins: superAdminsResult.count || 0,
          opsTeam: opsTeamResult.count || 0,
          vendorTeam: 0,
          qcTeam: qcTeamResult.count || 0,
          vendors: vendorsResult.count || 0,
          gigWorkers: gigWorkersResult.count || 0,
          clients: clientsResult.count || 0,
          totalCases: totalCasesResult.count || 0,
          casesByStatus,
          totalSubmissions: submissionsResult.count || 0,
          totalQCReviews: qcReviewsResult.count || 0,
          totalAllocations: allocationsResult.count || 0,
          casesCreatedLast7Days: casesCreated7DaysResult.count || 0,
          casesCompletedLast7Days: casesCompleted7DaysResult.count || 0,
          submissionsLast7Days: submissions7DaysResult.count || 0,
          qcReviewsLast7Days: qcReviews7DaysResult.count || 0,
          activeVendors: activeVendorsResult.count || 0,
          activeGigWorkers: activeGigWorkersResult.count || 0,
          activeClients: activeClientsResult.count || 0,
        });
      } catch (error) {
        console.error('Error fetching PM dashboard stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const formatNumber = (num: number) => {
    if (isLoading) return '-';
    return num.toLocaleString();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Portal Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive overview of all portal activities and usage metrics
          </p>
        </div>
      </div>

      {/* User Statistics */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" />
          User Statistics
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.totalUsers)}</div>
              <p className="text-xs text-muted-foreground">All active users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Super Admins</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.superAdmins)}</div>
              <p className="text-xs text-muted-foreground">Administrators</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ops Team</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.opsTeam)}</div>
              <p className="text-xs text-muted-foreground">Operations team</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">QC Team</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.qcTeam)}</div>
              <p className="text-xs text-muted-foreground">Quality control</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vendors</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.vendors)}</div>
              <p className="text-xs text-muted-foreground">Vendor organizations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gig Workers</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.gigWorkers)}</div>
              <p className="text-xs text-muted-foreground">Active gig workers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.clients)}</div>
              <p className="text-xs text-muted-foreground">Client organizations</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Case Statistics */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Case Statistics
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.totalCases)}</div>
              <p className="text-xs text-muted-foreground">All active cases</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Created</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.casesByStatus.new)}</div>
              <p className="text-xs text-muted-foreground">New cases</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.casesByStatus.in_progress)}</div>
              <p className="text-xs text-muted-foreground">Active work</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Submitted</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.casesByStatus.submitted)}</div>
              <p className="text-xs text-muted-foreground">Awaiting QC</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">QC Passed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.casesByStatus.qc_passed)}</div>
              <p className="text-xs text-muted-foreground">Approved by QC</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">QC Failed</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.casesByStatus.qc_failed)}</div>
              <p className="text-xs text-muted-foreground">Rejected by QC</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Accepted</CardTitle>
              <CheckCircle className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.casesByStatus.accepted)}</div>
              <p className="text-xs text-muted-foreground">Accepted by workers</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Activity Statistics */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Activity Statistics
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.totalSubmissions)}</div>
              <p className="text-xs text-muted-foreground">All submissions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">QC Reviews</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.totalQCReviews)}</div>
              <p className="text-xs text-muted-foreground">Total reviews</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Allocations</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.totalAllocations)}</div>
              <p className="text-xs text-muted-foreground">Case allocations</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity (Last 7 Days) */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Recent Activity (Last 7 Days)
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cases Created</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.casesCreatedLast7Days)}</div>
              <p className="text-xs text-muted-foreground">New cases this week</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cases Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.casesCompletedLast7Days)}</div>
              <p className="text-xs text-muted-foreground">Completed this week</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Submissions</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.submissionsLast7Days)}</div>
              <p className="text-xs text-muted-foreground">This week</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">QC Reviews</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.qcReviewsLast7Days)}</div>
              <p className="text-xs text-muted-foreground">This week</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Active Entities */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Active Entities
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Vendors</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.activeVendors)}</div>
              <p className="text-xs text-muted-foreground">Currently active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Gig Workers</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.activeGigWorkers)}</div>
              <p className="text-xs text-muted-foreground">Currently active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.activeClients)}</div>
              <p className="text-xs text-muted-foreground">Currently active</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

