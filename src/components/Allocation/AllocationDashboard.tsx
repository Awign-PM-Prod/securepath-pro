import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { 
  Target, 
  Users, 
  Clock, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  MapPin,
  BarChart3,
  Settings,
  RefreshCw,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { allocationEngine } from '@/services/allocationEngine';
import { useToast } from '@/hooks/use-toast';

interface CapacityData {
  gig_partner_id: string;
  max_daily_capacity: number;
  current_capacity_available: number;
  cases_allocated: number;
  cases_accepted: number;
  cases_in_progress: number;
  cases_submitted: number;
  cases_completed: number;
  gig_partners: {
    profiles: {
      first_name: string;
      last_name: string;
      email: string;
    };
    quality_score: number;
    completion_rate: number;
    ontime_completion_rate: number;
    acceptance_rate: number;
    coverage_pincodes: string[];
    is_active: boolean;
    is_available: boolean;
  };
}

interface AllocationStats {
  total_allocations: number;
  successful_allocations: number;
  pending_allocations: number;
  failed_allocations: number;
  average_acceptance_time: number;
  capacity_utilization: number;
}

interface AllocationLog {
  id: string;
  case_id: string;
  candidate_id: string;
  allocated_at: string;
  accepted_at: string | null;
  decision: string;
  wave_number: number;
  case_number: string;
  candidate_name: string;
  worker_name: string;
  worker_email: string;
}

export default function AllocationDashboard() {
  const [capacityData, setCapacityData] = useState<CapacityData[]>([]);
  const [allocationStats, setAllocationStats] = useState<AllocationStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoAllocationEnabled, setIsAutoAllocationEnabled] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCapacity, setTotalCapacity] = useState(0);
  const [activeTab, setActiveTab] = useState<string>('capacity');
  const [allocationLogs, setAllocationLogs] = useState<AllocationLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [currentPageLogs, setCurrentPageLogs] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [pageSizeLogs] = useState(10);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [currentPage]);

  useEffect(() => {
    if (activeTab === 'allocation') {
      // Reset to page 1 when switching to allocation tab
      setCurrentPageLogs(1);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'allocation') {
      loadAllocationLogs();
    }
  }, [activeTab, currentPageLogs]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load stats first (doesn't depend on capacity data)
      await loadAllocationStats();
      // Then load capacity data (paginated)
      await loadCapacityData();
    } catch (error) {
      console.error('Failed to load allocation data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load allocation data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadCapacityData = async () => {
    try {
      // Get all active gig workers directly from gig_partners
      const { data: allGigWorkers, error: workersError } = await supabase
        .from('gig_partners')
        .select(`
          id,
          max_daily_capacity,
          capacity_available,
          active_cases_count,
          profiles!inner(
            first_name,
            last_name,
            email
          ),
          quality_score,
          completion_rate,
          ontime_completion_rate,
          acceptance_rate,
          coverage_pincodes,
          is_active,
          is_available
        `)
        .eq('is_active', true)
        .order('capacity_available', { ascending: false });

      if (workersError) {
        console.error('Error loading gig workers:', workersError);
        throw new Error('Failed to load gig workers');
      }

      if (!allGigWorkers || allGigWorkers.length === 0) {
        setCapacityData([]);
        setTotalCapacity(0);
        return;
      }

      // Get case counts for each gig worker from cases table
      const workerIds = allGigWorkers.map(w => w.id);
      const { data: casesData, error: casesError } = await supabase
        .from('cases')
        .select('current_assignee_id, status')
        .in('current_assignee_id', workerIds)
        .eq('current_assignee_type', 'gig')
        .in('status', ['allocated', 'auto_allocated', 'accepted', 'in_progress', 'submitted', 'qc_passed', 'completed']);

      if (casesError) {
        console.error('Error loading cases:', casesError);
        // Continue without case counts if this fails
      }

      // Group cases by assignee and status
      const casesByWorker = new Map<string, {
        allocated: number;
        accepted: number;
        in_progress: number;
        submitted: number;
        completed: number;
      }>();

      (casesData || []).forEach((caseItem: any) => {
        const workerId = caseItem.current_assignee_id;
        if (!casesByWorker.has(workerId)) {
          casesByWorker.set(workerId, {
            allocated: 0,
            accepted: 0,
            in_progress: 0,
            submitted: 0,
            completed: 0
          });
        }
        const counts = casesByWorker.get(workerId)!;
        const status = caseItem.status;
        if (status === 'allocated' || status === 'auto_allocated') counts.allocated++;
        else if (status === 'accepted') counts.accepted++;
        else if (status === 'in_progress') counts.in_progress++;
        else if (status === 'submitted') counts.submitted++;
        else if (status === 'qc_passed' || status === 'completed') counts.completed++;
      });

      // Map gig workers to CapacityData format
      const capacityData: CapacityData[] = allGigWorkers.map((worker: any) => {
        const caseCounts = casesByWorker.get(worker.id) || {
          allocated: 0,
          accepted: 0,
          in_progress: 0,
          submitted: 0,
          completed: 0
        };

        return {
          gig_partner_id: worker.id,
          max_daily_capacity: worker.max_daily_capacity || 0,
          current_capacity_available: worker.capacity_available || 0,
          cases_allocated: caseCounts.allocated,
          cases_accepted: caseCounts.accepted,
          cases_in_progress: caseCounts.in_progress,
          cases_submitted: caseCounts.submitted,
          cases_completed: caseCounts.completed,
          gig_partners: {
            profiles: {
              first_name: worker.profiles?.first_name || '',
              last_name: worker.profiles?.last_name || '',
              email: worker.profiles?.email || ''
            },
            quality_score: worker.quality_score || 0,
            completion_rate: worker.completion_rate || 0,
            ontime_completion_rate: worker.ontime_completion_rate || 0,
            acceptance_rate: worker.acceptance_rate || 0,
            coverage_pincodes: worker.coverage_pincodes || [],
            is_active: worker.is_active || false,
            is_available: worker.is_available || false
          }
        };
      });

      // Sort by capacity available (descending)
      capacityData.sort((a, b) => (b.current_capacity_available || 0) - (a.current_capacity_available || 0));

      // Calculate pagination
      const totalCount = capacityData.length;
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize;
      const paginatedData = capacityData.slice(from, to);

      setCapacityData(paginatedData);
      setTotalCapacity(totalCount);
    } catch (error) {
      console.error('Error loading capacity data:', error);
      setCapacityData([]);
      setTotalCapacity(0);
    }
  };

  const loadAllocationStats = async () => {
    try {
      // Query all cases to calculate stats
      const { data: allCases, error: casesError } = await supabase
        .from('cases')
        .select('id, status')
        .eq('is_active', true);

      if (casesError) {
        console.error('Error loading cases:', casesError);
        throw casesError;
      }

      // Total Allocations: All cases except status "new"
      const total_allocations = allCases?.filter(c => c.status !== 'new').length || 0;

      // Successful: All cases except "new" and "allocated" (cases that have been accepted and are in progress, submitted, etc.)
      const successful_allocations = allCases?.filter(c => 
        c.status !== 'new' && c.status !== 'allocated'
      ).length || 0;

      // Pending: Cases with status "allocated"
      const pending_allocations = allCases?.filter(c => c.status === 'allocated').length || 0;

      // Failed allocations (rejected or cancelled cases)
      const failed_allocations = allCases?.filter(c => 
        c.status === 'rejected' || c.status === 'cancelled'
      ).length || 0;

      // Calculate average acceptance time (placeholder - would need allocation_logs for this)
      const average_acceptance_time = 0;

      // Calculate capacity utilization from capacity_tracking
      // This shows percentage of gig worker capacities currently in use
      const { data: allCapacityData, error: capacityError } = await supabase
        .from('capacity_tracking')
        .select('max_daily_capacity, current_capacity_available')
        .eq('is_active', true);

      let capacity_utilization = 0;
      if (!capacityError && allCapacityData && allCapacityData.length > 0) {
        const totalMax = allCapacityData.reduce((sum, w) => sum + (w.max_daily_capacity || 0), 0);
        const totalAvailable = allCapacityData.reduce((sum, w) => sum + (w.current_capacity_available || 0), 0);
        const totalUsed = totalMax - totalAvailable;
        capacity_utilization = totalMax > 0 ? Math.round((totalUsed / totalMax) * 100) : 0;
      }

      const stats: AllocationStats = {
        total_allocations,
        successful_allocations,
        pending_allocations,
        failed_allocations,
        average_acceptance_time,
        capacity_utilization
      };

      setAllocationStats(stats);
    } catch (error) {
      console.error('Error loading allocation stats:', error);
      // Set default stats on error
      setAllocationStats({
        total_allocations: 0,
        successful_allocations: 0,
        pending_allocations: 0,
        failed_allocations: 0,
        average_acceptance_time: 0,
        capacity_utilization: 0
      });
    }
  };

  const handleManualAllocation = async () => {
    try {
      // This would trigger manual allocation for pending cases
      toast({
        title: 'Manual Allocation',
        description: 'Manual allocation process started',
      });
    } catch (error) {
      console.error('Manual allocation failed:', error);
      toast({
        title: 'Error',
        description: 'Manual allocation failed',
        variant: 'destructive',
      });
    }
  };

  const loadAllocationLogs = async () => {
    setIsLoadingLogs(true);
    try {
      // Calculate pagination range
      const from = (currentPageLogs - 1) * pageSizeLogs;
      const to = from + pageSizeLogs - 1;

      // Use the same cutoff date as cases (November 2nd, 2025)
      const cutoffDate = new Date('2025-11-02T00:00:00.000Z');

      // Get allocation logs with case info
      // Note: We fetch and filter client-side because Supabase doesn't support filtering on nested relationship fields
      // Limit to 1000 most recent logs to avoid performance issues
      const { data: allLogsData, error: logsError } = await supabase
        .from('allocation_logs')
        .select(`
          id,
          case_id,
          candidate_id,
          allocated_at,
          accepted_at,
          decision,
          wave_number,
          cases!inner(
            case_number,
            candidate_name,
            created_at,
            is_active
          )
        `)
        .eq('candidate_type', 'gig')
        .order('allocated_at', { ascending: false })
        .limit(1000);

      if (logsError) {
        console.error('Error loading allocation logs:', logsError);
        throw logsError;
      }

      if (!allLogsData || allLogsData.length === 0) {
        setAllocationLogs([]);
        setTotalLogs(0);
        return;
      }

      // Filter logs by case created_at (same cutoff date as cases) and is_active
      const filteredLogs = allLogsData.filter((log: any) => {
        const caseData = log.cases;
        if (!caseData || !caseData.is_active) return false;
        const caseCreatedAt = caseData.created_at;
        if (!caseCreatedAt) return false;
        const caseDate = new Date(caseCreatedAt);
        return caseDate >= cutoffDate;
      });

      // Set total count
      setTotalLogs(filteredLogs.length);

      // Apply pagination to filtered results
      const paginatedLogs = filteredLogs.slice(from, to + 1);

      if (logsError) {
        console.error('Error loading allocation logs:', logsError);
        throw logsError;
      }

      if (paginatedLogs.length === 0) {
        setAllocationLogs([]);
        return;
      }

      // Get unique candidate IDs
      const candidateIds = [...new Set(paginatedLogs.map((log: any) => log.candidate_id))];

      // Fetch gig worker info separately
      const { data: workersData, error: workersError } = await supabase
        .from('gig_partners')
        .select(`
          id,
          profiles!inner(
            first_name,
            last_name,
            email
          )
        `)
        .in('id', candidateIds);

      if (workersError) {
        console.error('Error loading gig workers:', workersError);
        // Continue without worker info if this fails
      }

      // Create a map of worker data
      const workersMap = new Map();
      (workersData || []).forEach((worker: any) => {
        workersMap.set(worker.id, worker);
      });

      // Combine the data
      const logs: AllocationLog[] = paginatedLogs.map((log: any) => {
        const worker = workersMap.get(log.candidate_id);
        return {
          id: log.id,
          case_id: log.case_id,
          candidate_id: log.candidate_id,
          allocated_at: log.allocated_at,
          accepted_at: log.accepted_at,
          decision: log.decision,
          wave_number: log.wave_number,
          case_number: log.cases?.case_number || 'N/A',
          candidate_name: log.cases?.candidate_name || 'N/A',
          worker_name: worker?.profiles 
            ? `${worker.profiles.first_name || ''} ${worker.profiles.last_name || ''}`.trim() || 'N/A'
            : 'N/A',
          worker_email: worker?.profiles?.email || 'N/A'
        };
      });

      setAllocationLogs(logs);
    } catch (error) {
      console.error('Failed to load allocation logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load allocation logs',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleRefreshCapacity = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadCapacityData(),
        loadAllocationStats()
      ]);
      if (activeTab === 'allocation') {
        await loadAllocationLogs();
      }
      toast({
        title: 'Success',
        description: 'Data refreshed',
      });
    } catch (error) {
      console.error('Failed to refresh data:', error);
      toast({
        title: 'Error',
        description: 'Failed to refresh data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getCapacityPercentage = (available: number, max: number): number => {
    return Math.round((available / max) * 100);
  };

  const getCapacityColor = (percentage: number): string => {
    if (percentage >= 50) return 'text-green-600';
    if (percentage >= 25) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getCapacityBgColor = (percentage: number): string => {
    if (percentage >= 50) return 'bg-green-500';
    if (percentage >= 25) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getPerformanceColor = (score: number): string => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading allocation data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Allocation Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and manage case allocation across gig workers
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={handleRefreshCapacity}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          {/* Allocation Mode Toggle */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-muted-foreground">Allocation Mode:</span>
            <div className="relative inline-flex items-center bg-muted rounded-lg p-1">
              <button
                type="button"
                onClick={() => setIsAutoAllocationEnabled(false)}
                className={`relative px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  !isAutoAllocationEnabled
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Manual Allocation
              </button>
              <button
                type="button"
                onClick={() => setIsAutoAllocationEnabled(true)}
                className={`relative px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  isAutoAllocationEnabled
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Auto Allocation
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      {allocationStats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Allocations</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{allocationStats.total_allocations}</div>
              <p className="text-xs text-muted-foreground">
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Successful</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {allocationStats.successful_allocations}
              </div>
              <p className="text-xs text-muted-foreground">
                Cases in progress or beyond
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {allocationStats.pending_allocations}
              </div>
              <p className="text-xs text-muted-foreground">
                Cases awaiting acceptance
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Capacity Utilization</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{allocationStats.capacity_utilization}%</div>
              <p className="text-xs text-muted-foreground">
                Overall capacity usage
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="capacity">Capacity Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="allocation">Allocation Logs</TabsTrigger>
        </TabsList>

        {/* Capacity Overview Tab */}
        <TabsContent value="capacity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Gig Worker Capacity</CardTitle>
              <CardDescription>
                Current capacity and workload distribution across gig workers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {capacityData.map((worker) => {
                  const capacityPercentage = getCapacityPercentage(
                    worker.current_capacity_available,
                    worker.max_daily_capacity
                  );
                  const utilizationPercentage = 100 - capacityPercentage;

                  return (
                    <div key={worker.gig_partner_id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="font-medium">
                            {worker.gig_partners.profiles.first_name} {worker.gig_partners.profiles.last_name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {worker.current_capacity_available} / {worker.max_daily_capacity} slots available
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-medium ${getCapacityColor(capacityPercentage)}`}>
                            {capacityPercentage}% available
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {utilizationPercentage}% utilized
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Capacity Utilization</span>
                          <span>{utilizationPercentage.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${getCapacityBgColor(capacityPercentage)}`}
                            style={{ width: `${utilizationPercentage}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 text-sm">
                        <div className="text-center">
                          <div className="font-medium text-blue-600">{worker.cases_allocated}</div>
                          <div className="text-muted-foreground">Allocated</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-green-600">{worker.cases_accepted}</div>
                          <div className="text-muted-foreground">Accepted</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-yellow-600">{worker.cases_in_progress}</div>
                          <div className="text-muted-foreground">In Progress</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-purple-600">{worker.cases_submitted}</div>
                          <div className="text-muted-foreground">Submitted</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-green-600">{worker.cases_completed}</div>
                          <div className="text-muted-foreground">Completed</div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge variant={worker.gig_partners.is_active ? "default" : "secondary"}>
                          {worker.gig_partners.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant={worker.gig_partners.is_available ? "outline" : "destructive"}>
                          {worker.gig_partners.is_available ? "Available" : "Busy"}
                        </Badge>
                        <Badge variant="outline">
                          {worker.gig_partners.coverage_pincodes.length} areas
                        </Badge>
                      </div>
                    </div>
                  );
                })}

                {/* Pagination */}
                {totalCapacity > pageSize && (
                  <div className="flex items-center justify-between mt-6 pt-6 border-t">
                    <div className="text-sm text-muted-foreground">
                      Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCapacity)} of {totalCapacity} workers
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: Math.min(5, Math.ceil(totalCapacity / pageSize)) }, (_, i) => {
                          const totalPages = Math.ceil(totalCapacity / pageSize);
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          
                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                              className="w-8 h-8 p-0"
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(totalCapacity / pageSize)))}
                        disabled={currentPage >= Math.ceil(totalCapacity / pageSize)}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>
                Track gig worker performance and quality metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Worker</TableHead>
                    <TableHead>Quality Score</TableHead>
                    <TableHead>Completion Rate</TableHead>
                    <TableHead>On-Time Rate</TableHead>
                    <TableHead>Acceptance Rate</TableHead>
                    <TableHead>Coverage Areas</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {capacityData.map((worker) => (
                    <TableRow key={worker.gig_partner_id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {worker.gig_partners.profiles.first_name} {worker.gig_partners.profiles.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {worker.gig_partners.profiles.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={getPerformanceColor(worker.gig_partners.quality_score)}>
                          {(worker.gig_partners.quality_score * 100).toFixed(1)}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={getPerformanceColor(worker.gig_partners.completion_rate)}>
                          {(worker.gig_partners.completion_rate * 100).toFixed(1)}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={getPerformanceColor(worker.gig_partners.ontime_completion_rate)}>
                          {(worker.gig_partners.ontime_completion_rate * 100).toFixed(1)}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={getPerformanceColor(worker.gig_partners.acceptance_rate)}>
                          {(worker.gig_partners.acceptance_rate * 100).toFixed(1)}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {worker.gig_partners.coverage_pincodes.length} areas
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={worker.gig_partners.is_active ? "default" : "secondary"}>
                            {worker.gig_partners.is_active ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant={worker.gig_partners.is_available ? "outline" : "destructive"}>
                            {worker.gig_partners.is_available ? "Available" : "Busy"}
                          </Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalCapacity > pageSize && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCapacity)} of {totalCapacity} workers
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, Math.ceil(totalCapacity / pageSize)) }, (_, i) => {
                        const totalPages = Math.ceil(totalCapacity / pageSize);
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="w-8 h-8 p-0"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(totalCapacity / pageSize)))}
                      disabled={currentPage >= Math.ceil(totalCapacity / pageSize)}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Allocation Logs Tab */}
        <TabsContent value="allocation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Allocation Logs</CardTitle>
              <CardDescription>
                Recent allocation activities and decisions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingLogs ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p>Loading allocation logs...</p>
                </div>
              ) : allocationLogs.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Allocation Logs</h3>
                  <p className="text-muted-foreground">
                    No allocation logs found. Logs will appear here when cases are allocated to gig workers.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Case Number</TableHead>
                        <TableHead>Candidate Name</TableHead>
                        <TableHead>Gig Worker</TableHead>
                        <TableHead>Allocated At</TableHead>
                        <TableHead>Accepted At</TableHead>
                        <TableHead>Decision</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allocationLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium">{log.case_number}</TableCell>
                          <TableCell>{log.candidate_name}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{log.worker_name}</div>
                              <div className="text-sm text-muted-foreground">{log.worker_email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {new Date(log.allocated_at).toLocaleString('en-IN', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                              hour12: true
                            }).replace(/\s(am|pm)/gi, (match) => match.toUpperCase())}
                          </TableCell>
                          <TableCell>
                            {log.accepted_at ? (
                              new Date(log.accepted_at).toLocaleString('en-IN', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                                hour12: true
                              }).replace(/\s(am|pm)/gi, (match) => match.toUpperCase())
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                log.decision === 'accepted' ? 'default' :
                                log.decision === 'rejected' ? 'destructive' :
                                log.decision === 'timeout' ? 'secondary' :
                                'outline'
                              }
                            >
                              {log.decision}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {/* Pagination */}
                  {totalLogs > pageSizeLogs && (
                    <div className="flex items-center justify-between mt-6 pt-6 border-t">
                      <div className="text-sm text-muted-foreground">
                        Showing {((currentPageLogs - 1) * pageSizeLogs) + 1} to {Math.min(currentPageLogs * pageSizeLogs, totalLogs)} of {totalLogs} logs
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPageLogs(prev => Math.max(prev - 1, 1))}
                          disabled={currentPageLogs === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        
                        <div className="flex items-center space-x-1">
                          {Array.from({ length: Math.min(5, Math.ceil(totalLogs / pageSizeLogs)) }, (_, i) => {
                            const totalPages = Math.ceil(totalLogs / pageSizeLogs);
                            let pageNum;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPageLogs <= 3) {
                              pageNum = i + 1;
                            } else if (currentPageLogs >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPageLogs - 2 + i;
                            }
                            
                            return (
                              <Button
                                key={pageNum}
                                variant={currentPageLogs === pageNum ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCurrentPageLogs(pageNum)}
                                className="w-8 h-8 p-0"
                              >
                                {pageNum}
                              </Button>
                            );
                          })}
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPageLogs(prev => Math.min(prev + 1, Math.ceil(totalLogs / pageSizeLogs)))}
                          disabled={currentPageLogs >= Math.ceil(totalLogs / pageSizeLogs)}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}