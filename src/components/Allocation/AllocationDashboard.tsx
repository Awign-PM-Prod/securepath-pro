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

export default function AllocationDashboard() {
  const [capacityData, setCapacityData] = useState<CapacityData[]>([]);
  const [allocationStats, setAllocationStats] = useState<AllocationStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoAllocationEnabled, setIsAutoAllocationEnabled] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCapacity, setTotalCapacity] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [currentPage]);

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
    // Calculate pagination range
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from('capacity_tracking')
      .select(`
        *,
        gig_partners!inner(
          profiles(first_name, last_name, email),
          quality_score,
          completion_rate,
          ontime_completion_rate,
          acceptance_rate,
          coverage_pincodes,
          is_active,
          is_available
        )
      `, { count: 'exact' })
      .eq('is_active', true)
      .order('current_capacity_available', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error loading capacity data:', error);
      throw new Error('Failed to load capacity data');
    }

    setCapacityData(data || []);
    setTotalCapacity(count || 0);
  };

  const loadAllocationStats = async () => {
    try {
      // Get today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Query allocation_logs for today's allocations
      const { data: allocationLogs, error: logsError } = await supabase
        .from('allocation_logs')
        .select('decision, allocated_at, accepted_at')
        .gte('allocated_at', today.toISOString())
        .lt('allocated_at', tomorrow.toISOString());

      if (logsError) {
        console.error('Error loading allocation logs:', logsError);
        throw logsError;
      }

      // Calculate stats from allocation_logs
      const total_allocations = allocationLogs?.length || 0;
      const successful_allocations = allocationLogs?.filter(log => log.decision === 'accepted').length || 0;
      const pending_allocations = allocationLogs?.filter(log => log.decision === 'allocated').length || 0;
      const failed_allocations = allocationLogs?.filter(log => 
        log.decision === 'rejected' || log.decision === 'timeout'
      ).length || 0;

      // Calculate average acceptance time (in minutes)
      const acceptedLogs = allocationLogs?.filter(log => 
        log.decision === 'accepted' && log.allocated_at && log.accepted_at
      ) || [];
      
      let average_acceptance_time = 0;
      if (acceptedLogs.length > 0) {
        const totalTime = acceptedLogs.reduce((sum, log) => {
          const allocated = new Date(log.allocated_at).getTime();
          const accepted = new Date(log.accepted_at!).getTime();
          return sum + (accepted - allocated);
        }, 0);
        average_acceptance_time = Math.round(totalTime / acceptedLogs.length / (1000 * 60)); // Convert to minutes
      }

      // Calculate capacity utilization from capacity_tracking
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

  const handleRefreshCapacity = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadCapacityData(),
        loadAllocationStats()
      ]);
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
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleRefreshCapacity}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleManualAllocation}>
            <Play className="h-4 w-4 mr-2" />
            Manual Allocate
          </Button>
          <Button 
            variant={isAutoAllocationEnabled ? "default" : "outline"}
            onClick={() => setIsAutoAllocationEnabled(!isAutoAllocationEnabled)}
          >
            {isAutoAllocationEnabled ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Auto Allocation ON
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Auto Allocation OFF
              </>
            )}
          </Button>
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
                Cases allocated today
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
                Accepted by workers
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
                Awaiting response
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

      <Tabs defaultValue="capacity" className="space-y-6">
        <TabsList>
          <TabsTrigger value="capacity">Capacity Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="allocation">Allocation Logs</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
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
              <div className="text-center py-8">
                <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Allocation Logs</h3>
                <p className="text-muted-foreground mb-4">
                  Allocation logs and history will be displayed here
                </p>
                <Button variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Configure Logging
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Allocation Settings</CardTitle>
              <CardDescription>
                Configure allocation engine parameters and rules
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Allocation Configuration</h3>
                <p className="text-muted-foreground mb-4">
                  Configure scoring weights, acceptance windows, and capacity rules
                </p>
                <Button variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Open Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}