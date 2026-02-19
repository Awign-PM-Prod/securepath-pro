import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  Calendar as CalendarIcon,
  X
} from 'lucide-react';
import { format } from 'date-fns';
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
  totalQCReviews: number;
  totalAllocations: number;
  
  // Recent Activity (Last 7 days)
  casesCreatedLast7Days: number;
  casesCompletedLast7Days: number;
  submissionsLast7Days: number;
  qcReviewsLast7Days: number;
  // Previous week data for comparison
  casesCreatedPreviousWeek: number;
  casesCompletedPreviousWeek: number;
  qcReviewsPreviousWeek: number;
  
  // Active Entities
  activeVendors: number;
  activeGigWorkers: number;
  activeClients: number;
}

// Filter cases created after November 2nd, 2025 (same as ops/cases page)
const CUTOFF_DATE = new Date('2025-11-02T00:00:00.000Z');

export default function PMDashboard() {
  const [dateFilter, setDateFilter] = useState<{ from?: Date; to?: Date } | undefined>(undefined);
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
    totalQCReviews: 0,
    totalAllocations: 0,
    casesCreatedLast7Days: 0,
    casesCompletedLast7Days: 0,
    submissionsLast7Days: 0,
    qcReviewsLast7Days: 0,
    casesCreatedPreviousWeek: 0,
    casesCompletedPreviousWeek: 0,
    qcReviewsPreviousWeek: 0,
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

        // Calculate dates for previous week (14-7 days ago)
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
        const fourteenDaysAgoISO = fourteenDaysAgo.toISOString();

        // Build base query with cutoff date and date filter
        const buildCaseQuery = (baseQuery: any) => {
          let query = baseQuery
            .eq('is_active', true)
            .gte('created_at', CUTOFF_DATE.toISOString());
          
          // Apply date filter if set
          if (dateFilter) {
            if (dateFilter.from) {
              const startOfDay = new Date(dateFilter.from);
              startOfDay.setHours(0, 0, 0, 0);
              query = query.gte('created_at', startOfDay.toISOString());
            }
            if (dateFilter.to) {
              const endOfDay = new Date(dateFilter.to);
              endOfDay.setHours(23, 59, 59, 999);
              query = query.lte('created_at', endOfDay.toISOString());
            }
          }
          
          return query;
        };

        // Build query for "last 7 days" metrics (always uses last 7 days, regardless of date filter)
        const buildLast7DaysQuery = (baseQuery: any) => {
          return baseQuery
            .eq('is_active', true)
            .gte('created_at', CUTOFF_DATE.toISOString())
            .gte('created_at', sevenDaysAgoISO);
        };

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
          qcReviewsResult,
          allocationsResult,
          // Recent activity (last 7 days)
          casesCreated7DaysResult,
          casesCompleted7DaysResult,
          qcReviews7DaysResult,
          // Previous week data (14-7 days ago)
          casesCreatedPreviousWeekResult,
          casesCompletedPreviousWeekResult,
          qcReviewsPreviousWeekResult,
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
          // Case statistics (with cutoff date and date filter)
          buildCaseQuery(supabase.from('cases').select('*', { count: 'exact', head: true })),
          buildCaseQuery(supabase.from('cases').select('status')),
          // Activity statistics
          supabase.from('qc_reviews').select('*', { count: 'exact', head: true }),
          supabase.from('allocation_logs').select('*', { count: 'exact', head: true }),
          // Recent activity (last 7 days) - always uses last 7 days from today, regardless of date filter
          buildLast7DaysQuery(supabase.from('cases').select('*', { count: 'exact', head: true })),
          buildCaseQuery(supabase.from('cases').select('*', { count: 'exact', head: true })).in('status', ['submitted', 'qc_passed']).gte('status_updated_at', sevenDaysAgoISO),
          supabase.from('qc_reviews').select('*', { count: 'exact', head: true }).gte('reviewed_at', sevenDaysAgoISO),
          // Previous week data (14-7 days ago) - with cutoff date and date filter
          buildCaseQuery(supabase.from('cases').select('*', { count: 'exact', head: true })).gte('created_at', fourteenDaysAgoISO).lt('created_at', sevenDaysAgoISO),
          buildCaseQuery(supabase.from('cases').select('*', { count: 'exact', head: true })).in('status', ['submitted', 'qc_passed']).gte('status_updated_at', fourteenDaysAgoISO).lt('status_updated_at', sevenDaysAgoISO),
          supabase.from('qc_reviews').select('*', { count: 'exact', head: true }).gte('reviewed_at', fourteenDaysAgoISO).lt('reviewed_at', sevenDaysAgoISO),
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
          totalQCReviews: qcReviewsResult.count || 0,
          totalAllocations: allocationsResult.count || 0,
          casesCreatedLast7Days: casesCreated7DaysResult.count || 0,
          casesCompletedLast7Days: casesCompleted7DaysResult.count || 0,
          submissionsLast7Days: 0,
          qcReviewsLast7Days: qcReviews7DaysResult.count || 0,
          casesCreatedPreviousWeek: casesCreatedPreviousWeekResult.count || 0,
          casesCompletedPreviousWeek: casesCompletedPreviousWeekResult.count || 0,
          qcReviewsPreviousWeek: qcReviewsPreviousWeekResult.count || 0,
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
  }, [dateFilter]);

  const formatNumber = (num: number) => {
    if (isLoading) return '-';
    return num.toLocaleString();
  };

  const calculatePercentageChange = (current: number, previous: number): { value: number; isIncrease: boolean } => {
    if (previous === 0) {
      return current > 0 ? { value: 100, isIncrease: true } : { value: 0, isIncrease: false };
    }
    const change = ((current - previous) / previous) * 100;
    return { value: Math.abs(change), isIncrease: change >= 0 };
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

      {/* Date Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Date Range Filter</CardTitle>
          <CardDescription>
            Filter analytics data by case creation date range
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`w-64 justify-start text-left font-normal ${dateFilter && (dateFilter.from || dateFilter.to) ? 'bg-blue-50 border-blue-300 text-blue-700' : ''}`}
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {dateFilter?.from && dateFilter?.to
                    ? `${format(dateFilter.from, "MMM dd, yyyy")} - ${format(dateFilter.to, "MMM dd, yyyy")}`
                    : dateFilter?.from
                    ? `From ${format(dateFilter.from, "MMM dd, yyyy")}`
                    : dateFilter?.to
                    ? `Until ${format(dateFilter.to, "MMM dd, yyyy")}`
                    : "Select Date Range"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateFilter ? { from: dateFilter.from, to: dateFilter.to } : undefined}
                  onSelect={(range) => {
                    if (range) {
                      setDateFilter({ from: range.from, to: range.to });
                    } else {
                      setDateFilter(undefined);
                    }
                  }}
                  disabled={(date) => {
                    const today = new Date();
                    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                    return dateOnly > todayDateOnly;
                  }}
                  numberOfMonths={2}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {dateFilter && (dateFilter.from || dateFilter.to) && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setDateFilter(undefined)}
                className="w-10 h-10"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Note: Only cases created after {format(CUTOFF_DATE, "MMM dd, yyyy")} are included (same as ops/cases page)
          </p>
        </CardContent>
      </Card>

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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
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
        </div>
      </div>

      {/* Recent Activity (Last 7 Days) */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Recent Activity (Last 7 Days)
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cases Created</CardTitle>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.casesCreatedLast7Days)}</div>
              {(() => {
                const change = calculatePercentageChange(stats.casesCreatedLast7Days, stats.casesCreatedPreviousWeek);
                if (change.value === 0 && stats.casesCreatedLast7Days === 0) {
                  return <p className="text-xs text-muted-foreground">New cases this week</p>;
                }
                return (
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-muted-foreground">New cases this week</p>
                    <span className={`text-xs font-medium ${change.isIncrease ? 'text-green-600' : 'text-red-600'}`}>
                      {change.isIncrease ? '↑' : '↓'} {change.value.toFixed(1)}%
                    </span>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cases Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.casesCompletedLast7Days)}</div>
              {(() => {
                const change = calculatePercentageChange(stats.casesCompletedLast7Days, stats.casesCompletedPreviousWeek);
                if (change.value === 0 && stats.casesCompletedLast7Days === 0) {
                  return <p className="text-xs text-muted-foreground">Completed this week</p>;
                }
                return (
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-muted-foreground">Completed this week</p>
                    <span className={`text-xs font-medium ${change.isIncrease ? 'text-green-600' : 'text-red-600'}`}>
                      {change.isIncrease ? '↑' : '↓'} {change.value.toFixed(1)}%
                    </span>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">QC Reviews</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.qcReviewsLast7Days)}</div>
              {(() => {
                const change = calculatePercentageChange(stats.qcReviewsLast7Days, stats.qcReviewsPreviousWeek);
                if (change.value === 0 && stats.qcReviewsLast7Days === 0) {
                  return <p className="text-xs text-muted-foreground">This week</p>;
                }
                return (
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-muted-foreground">This week</p>
                    <span className={`text-xs font-medium ${change.isIncrease ? 'text-green-600' : 'text-red-600'}`}>
                      {change.isIncrease ? '↑' : '↓'} {change.value.toFixed(1)}%
                    </span>
                  </div>
                );
              })()}
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

