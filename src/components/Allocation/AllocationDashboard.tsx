import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Grid3x3,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, startOfWeek, startOfMonth, startOfQuarter, DateRange } from 'date-fns';

type DateFilterType = 'all' | 'this_week' | 'this_month' | 'this_quarter' | 'custom';

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
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  const { toast } = useToast();

  // Get date range based on filter
  const getDateRange = (): { from: string; to: string } | null => {
    const now = new Date();
    switch (dateFilter) {
      case 'this_week': {
        const start = startOfWeek(now, { weekStartsOn: 1 });
        return { from: start.toISOString(), to: now.toISOString() };
      }
      case 'this_month': {
        const start = startOfMonth(now);
        return { from: start.toISOString(), to: now.toISOString() };
      }
      case 'this_quarter': {
        const start = startOfQuarter(now);
        return { from: start.toISOString(), to: now.toISOString() };
      }
      case 'custom': {
        if (customDateRange?.from) {
          const from = customDateRange.from;
          const to = customDateRange.to || now;
          return { from: from.toISOString(), to: to.toISOString() };
        }
        return null;
      }
      default:
        return null;
    }
  };

  const customDateLabel = useMemo(() => {
    if (dateFilter !== 'custom' || !customDateRange?.from) return 'Custom Date';
    const from = format(customDateRange.from, 'dd MMM');
    const to = customDateRange.to ? format(customDateRange.to, 'dd MMM') : 'now';
    return `Custom Date (${from} - ${to})`;
  }, [dateFilter, customDateRange]);

  useEffect(() => {
    loadData();
  }, [currentPage, dateFilter, customDateRange]);

  useEffect(() => {
    if (activeTab === 'allocation') {
      setCurrentPageLogs(1);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'allocation') {
      loadAllocationLogs();
    }
  }, [activeTab, currentPageLogs, dateFilter, customDateRange]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load stats and capacity data in parallel
      await Promise.all([
        loadAllocationStats(),
        loadCapacityData()
      ]);
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
      const dateRange = getDateRange();
      const cutoffDate = new Date('2025-11-02T00:00:00.000Z');

      // Calculate pagination first to limit the query
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      // First, get total count for pagination
      let countQuery = supabase
        .from('gig_partners')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      const { count: totalCount, error: countError } = await countQuery;

      if (countError) {
        console.error('Error counting gig workers:', countError);
        throw new Error('Failed to count gig workers');
      }

      if (!totalCount || totalCount === 0) {
        setCapacityData([]);
        setTotalCapacity(0);
        return;
      }

      setTotalCapacity(totalCount);

      // Get paginated active gig workers
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
        .order('capacity_available', { ascending: false })
        .range(from, to);

      if (workersError) {
        console.error('Error loading gig workers:', workersError);
        throw new Error('Failed to load gig workers');
      }

      if (!allGigWorkers || allGigWorkers.length === 0) {
        setCapacityData([]);
        return;
      }

      // Get case counts for each gig worker - optimized with date filter
      const workerIds = allGigWorkers.map(w => w.id);
      
      // Build case query with date filter
      // Filter by created_at for simplicity and performance
      let casesQuery = supabase
        .from('cases')
        .select('current_assignee_id, status')
        .in('current_assignee_id', workerIds)
        .eq('current_assignee_type', 'gig')
        .in('status', ['allocated', 'auto_allocated', 'accepted', 'in_progress', 'submitted', 'qc_passed', 'completed'])
        .gte('created_at', cutoffDate.toISOString());

      // Apply date filter if set
      if (dateRange) {
        casesQuery = casesQuery.gte('created_at', dateRange.from).lte('created_at', dateRange.to);
      }

      const { data: casesData, error: casesError } = await casesQuery.limit(10000);


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

      setCapacityData(capacityData);
    } catch (error) {
      console.error('Error loading capacity data:', error);
      setCapacityData([]);
      setTotalCapacity(0);
    }
  };

  const loadAllocationStats = async () => {
    try {
      const dateRange = getDateRange();
      const cutoffDate = new Date('2025-11-02T00:00:00.000Z');

      // Build base query with date filter
      // For stats, filter by created_at (when cases were created) for simplicity and performance
      const buildQuery = (baseQuery: any) => {
        let query = baseQuery.eq('is_active', true).gte('created_at', cutoffDate.toISOString());
        if (dateRange) {
          query = query.gte('created_at', dateRange.from).lte('created_at', dateRange.to);
        }
        return query;
      };

      // Use count queries instead of fetching all records for better performance
      const [
        { count: totalAllocationsCount },
        { count: pendingAllocationsCount },
        { count: successfulAllocationsCount },
        { count: failedAllocationsCount },
        capacityDataResult
      ] = await Promise.all([
        // Total Allocations: All cases except status "new"
        buildQuery(supabase.from('cases').select('*', { count: 'exact', head: true })).neq('status', 'new'),
        
        // Pending: Cases with status "allocated"
        buildQuery(supabase.from('cases').select('*', { count: 'exact', head: true })).eq('status', 'allocated'),
        
        // Successful: All cases except "new" and "allocated"
        buildQuery(supabase.from('cases').select('*', { count: 'exact', head: true })).neq('status', 'new').neq('status', 'allocated'),
        
        // Failed allocations (rejected or cancelled cases)
        buildQuery(supabase.from('cases').select('*', { count: 'exact', head: true })).in('status', ['rejected', 'cancelled']),
        
        // Calculate capacity utilization from gig_partners
        supabase
          .from('gig_partners')
          .select('max_daily_capacity, capacity_available')
          .eq('is_active', true)
          .limit(1000)
      ]);

      // Calculate capacity utilization
      let capacity_utilization = 0;
      if (capacityDataResult.data && capacityDataResult.data.length > 0) {
        const totalMax = capacityDataResult.data.reduce((sum, w) => sum + (w.max_daily_capacity || 0), 0);
        const totalAvailable = capacityDataResult.data.reduce((sum, w) => sum + (w.capacity_available || 0), 0);
        const totalUsed = totalMax - totalAvailable;
        capacity_utilization = totalMax > 0 ? Math.round((totalUsed / totalMax) * 100) : 0;
      }

      const stats: AllocationStats = {
        total_allocations: totalAllocationsCount || 0,
        successful_allocations: successfulAllocationsCount || 0,
        pending_allocations: pendingAllocationsCount || 0,
        failed_allocations: failedAllocationsCount || 0,
        average_acceptance_time: 0,
        capacity_utilization
      };

      setAllocationStats(stats);
    } catch (error) {
      console.error('Error loading allocation stats:', error);
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

  const loadAllocationLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const cutoffDate = new Date('2025-11-02T00:00:00.000Z');
      const dateRange = getDateRange();

      const from = (currentPageLogs - 1) * pageSizeLogs;
      const to = from + pageSizeLogs - 1;

      // Build query with date filter
      let logsQuery = supabase
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
        .gte('allocated_at', cutoffDate.toISOString());

      if (dateRange) {
        logsQuery = logsQuery.gte('allocated_at', dateRange.from).lte('allocated_at', dateRange.to);
      }

      const { count: totalCount } = await logsQuery.select('*', { count: 'exact', head: true });

      const { data: logsData, error: logsError } = await logsQuery
        .order('allocated_at', { ascending: false })
        .range(from, to);

      if (logsError) {
        console.error('Error loading allocation logs:', logsError);
        throw logsError;
      }

      if (!logsData || logsData.length === 0) {
        setAllocationLogs([]);
        setTotalLogs(0);
        return;
      }

      // Filter logs by case created_at and is_active
      const filteredLogs = logsData.filter((log: any) => {
        const caseData = log.cases;
        if (!caseData || !caseData.is_active) return false;
        const caseCreatedAt = caseData.created_at;
        if (!caseCreatedAt) return false;
        const caseDate = new Date(caseCreatedAt);
        return caseDate >= cutoffDate;
      });

      setTotalLogs(totalCount || filteredLogs.length);

      if (filteredLogs.length === 0) {
        setAllocationLogs([]);
        return;
      }

      // Get unique candidate IDs
      const candidateIds = [...new Set(filteredLogs.map((log: any) => log.candidate_id))];

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
      }

      // Create a map of worker data
      const workersMap = new Map();
      (workersData || []).forEach((worker: any) => {
        workersMap.set(worker.id, worker);
      });

      // Combine the data
      const logs: AllocationLog[] = filteredLogs.map((log: any) => {
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
    if (max === 0) return 0;
    return Math.round((available / max) * 100);
  };

  const getStatusBadge = (isActive: boolean, isAvailable: boolean) => {
    if (!isActive) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    if (isAvailable) {
      return <Badge variant="default">Active Available</Badge>;
    }
    return <Badge variant="outline">Active Unavailable</Badge>;
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
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Allocations</h1>
      </div>

      {/* Date Filter Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button
            variant={dateFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateFilter('all')}
            className={dateFilter === 'all' ? 'bg-black text-white hover:bg-black' : ''}
          >
            All
          </Button>
          <Button
            variant={dateFilter === 'this_week' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateFilter('this_week')}
            className={dateFilter === 'this_week' ? 'bg-black text-white hover:bg-black' : ''}
          >
            This Week
          </Button>
          <Button
            variant={dateFilter === 'this_month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateFilter('this_month')}
            className={dateFilter === 'this_month' ? 'bg-black text-white hover:bg-black' : ''}
          >
            This Month
          </Button>
          <Button
            variant={dateFilter === 'this_quarter' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateFilter('this_quarter')}
            className={dateFilter === 'this_quarter' ? 'bg-black text-white hover:bg-black' : ''}
          >
            This Quarter
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={dateFilter === 'custom' ? 'default' : 'outline'}
                size="sm"
                className={dateFilter === 'custom' ? 'bg-black text-white hover:bg-black' : ''}
              >
                {customDateLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={customDateRange}
                onSelect={(range) => {
                  setCustomDateRange(range);
                  if (range?.from) {
                    setDateFilter('custom');
                  }
                }}
                numberOfMonths={2}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefreshCapacity}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh data
        </Button>
      </div>

      {/* Stats Overview */}
      {allocationStats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Allocations</CardTitle>
              <Grid3x3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{allocationStats.total_allocations.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Successful</CardTitle>
              <Grid3x3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{allocationStats.successful_allocations.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Grid3x3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{allocationStats.pending_allocations.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Capacity Utilization</CardTitle>
              <Grid3x3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{allocationStats.capacity_utilization}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="capacity">Capacity Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="allocation">Allocation Logs</TabsTrigger>
          </TabsList>
          
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
                Manual
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
                Auto
              </button>
            </div>
          </div>
        </div>

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
              {/* Pagination at top */}
              {totalCapacity > pageSize && (
                <div className="flex items-center justify-end mb-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalCapacity)} of {totalCapacity}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(totalCapacity / pageSize)))}
                      disabled={currentPage >= Math.ceil(totalCapacity / pageSize)}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Table Format */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Worker</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Areas</TableHead>
                      <TableHead>Allocated</TableHead>
                      <TableHead>Accepted</TableHead>
                      <TableHead>In Progress</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Completed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {capacityData.map((worker) => {
                      const capacityPercentage = getCapacityPercentage(
                        worker.current_capacity_available,
                        worker.max_daily_capacity
                      );
                      const utilizationPercentage = 100 - capacityPercentage;

                      return (
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
                            <div>
                              <div className="text-sm">
                                {worker.current_capacity_available} / {worker.max_daily_capacity} slots available
                              </div>
                              <div className={`text-sm font-medium ${capacityPercentage >= 50 ? 'text-green-600' : capacityPercentage >= 25 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {capacityPercentage}% available
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {utilizationPercentage}% Utilization
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(worker.gig_partners.is_active, worker.gig_partners.is_available)}
                          </TableCell>
                          <TableCell>
                            {worker.gig_partners.coverage_pincodes.length}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-blue-600">{worker.cases_allocated}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-green-600">{worker.cases_accepted}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-yellow-600">{worker.cases_in_progress}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-purple-600">{worker.cases_submitted}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-green-600">{worker.cases_completed}</div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
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
                        <div className={worker.gig_partners.quality_score >= 0.8 ? 'text-green-600' : worker.gig_partners.quality_score >= 0.6 ? 'text-yellow-600' : 'text-red-600'}>
                          {(worker.gig_partners.quality_score * 100).toFixed(1)}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={worker.gig_partners.completion_rate >= 0.8 ? 'text-green-600' : worker.gig_partners.completion_rate >= 0.6 ? 'text-yellow-600' : 'text-red-600'}>
                          {(worker.gig_partners.completion_rate * 100).toFixed(1)}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={worker.gig_partners.ontime_completion_rate >= 0.8 ? 'text-green-600' : worker.gig_partners.ontime_completion_rate >= 0.6 ? 'text-yellow-600' : 'text-red-600'}>
                          {(worker.gig_partners.ontime_completion_rate * 100).toFixed(1)}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={worker.gig_partners.acceptance_rate >= 0.8 ? 'text-green-600' : worker.gig_partners.acceptance_rate >= 0.6 ? 'text-yellow-600' : 'text-red-600'}>
                          {(worker.gig_partners.acceptance_rate * 100).toFixed(1)}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {worker.gig_partners.coverage_pincodes.length} areas
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(worker.gig_partners.is_active, worker.gig_partners.is_available)}
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
