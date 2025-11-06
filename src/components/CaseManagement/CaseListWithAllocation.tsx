import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MoreHorizontal, Search, Filter, Plus, Eye, Edit, Trash2, MapPin, Clock, User, Building, Zap, Users, CheckCircle, XCircle, AlertCircle, FileText, RotateCcw, Phone, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { isRecreatedCase } from '@/utils/caseUtils';
import { useToast } from '@/hooks/use-toast';
import { allocationService } from '@/services/allocationService';
import { allocationSummaryService, AllocationSummaryData } from '@/services/allocationSummaryService';
import AllocationSummary from '@/components/Allocation/AllocationSummary';
import CSVManagement from './CSVManagement';
import BulkCaseUpload from '@/components/BulkCaseUpload';
import { supabase } from '@/integrations/supabase/client';

interface Case {
  id: string;
  case_number: string;
  client_case_id: string;
  contract_type: string;
  candidate_name: string;
  phone_primary: string;
  phone_secondary?: string;
  status: 'new' | 'allocated' | 'accepted' | 'pending_allocation' | 'in_progress' | 'submitted' | 'qc_passed' | 'qc_rejected' | 'qc_rework' | 'reported' | 'in_payment_cycle' | 'payment_complete' | 'cancelled';
  client: {
    id: string;
    name: string;
    contact_person: string;
    phone: string;
    email: string;
  };
  location: {
    id: string;
    address_line: string;
    city: string;
    state: string;
    pincode: string;
    pincode_tier?: string;
    lat?: number;
    lng?: number;
    location_url?: string;
  };
  current_assignee?: {
    id: string;
    name: string;
    type: 'gig' | 'vendor';
  };
  vendor_tat_start_date: string;
  tat_hours: number;
  due_at: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  last_updated_by: string;
  status_updated_at: string;
  base_rate_inr?: number;
  bonus_inr?: number;
  penalty_inr?: number;
  total_payout_inr?: number;
  // QC Response field
  QC_Response?: 'Rework' | 'Approved' | 'Rejected' | 'New';
  // New fields for QC dashboard
  assigned_at?: string;
  submitted_at?: string;
}

interface CaseListWithAllocationProps {
  cases: Case[];
  onViewCase: (caseId: string) => void;
  onEditCase: (caseId: string) => void;
  onDeleteCase: (caseId: string) => void;
  onCreateCase: () => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

const STATUS_COLORS = {
  new: 'bg-gray-100 text-gray-800',
  allocated: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  pending_allocation: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  submitted: 'bg-purple-100 text-purple-800',
  qc_passed: 'bg-green-100 text-green-800',
  qc_rejected: 'bg-red-100 text-red-800',
  qc_rework: 'bg-yellow-100 text-yellow-800',
  reported: 'bg-green-100 text-green-800',
  in_payment_cycle: 'bg-blue-100 text-blue-800',
  payment_complete: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const STATUS_LABELS = {
  new: 'New',
  allocated: 'Allocated',
  accepted: 'Accepted',
  pending_allocation: 'Pending Allocation',
  in_progress: 'In Progress',
  submitted: 'Submitted',
  qc_passed: 'QC Passed',
  qc_rejected: 'QC Rejected',
  qc_rework: 'QC Rework',
  reported: 'Reported',
  in_payment_cycle: 'In Payment Cycle',
  payment_complete: 'Payment Complete',
  cancelled: 'Cancelled',
};

const getTierNumber = (tierString: string | undefined | null) => {
  // Handle null/undefined cases
  if (!tierString) return '?';
  
  // Handle the specific enum values: tier_1, tier_2, tier_3, tier1, tier2, tier3
  const tierMap: Record<string, string> = {
    'tier_1': '1',
    'tier_2': '2', 
    'tier_3': '3',
    'tier1': '1',
    'tier2': '2',
    'tier3': '3'
  };
  
  return tierMap[tierString] || '?';
};

export default function CaseListWithAllocation({ 
  cases, 
  onViewCase, 
  onEditCase, 
  onDeleteCase, 
  onCreateCase, 
  onRefresh,
  isLoading = false 
}: CaseListWithAllocationProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const [tatExpiryFilter, setTatExpiryFilter] = useState<Date | null>(null);
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [isAllocationDialogOpen, setIsAllocationDialogOpen] = useState(false);
  const [allocationMode, setAllocationMode] = useState<'auto' | 'manual' | null>(null);
  const [isAllocating, setIsAllocating] = useState(false);
  const [allocationResults, setAllocationResults] = useState<{
    successful: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const [allocationSummary, setAllocationSummary] = useState<AllocationSummaryData[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [isUnallocationDialogOpen, setIsUnallocationDialogOpen] = useState(false);
  const [isUnallocating, setIsUnallocating] = useState(false);
  const [unallocationReason, setUnallocationReason] = useState('');
  const [isManualAllocationDialogOpen, setIsManualAllocationDialogOpen] = useState(false);
  const [availableGigWorkers, setAvailableGigWorkers] = useState<any[]>([]);
  const [availableVendors, setAvailableVendors] = useState<any[]>([]);
  const [selectedGigWorker, setSelectedGigWorker] = useState<string>('');
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [allocationType, setAllocationType] = useState<'gig' | 'vendor'>('gig');
  const [isLoadingGigWorkers, setIsLoadingGigWorkers] = useState(false);
  const [isLoadingVendors, setIsLoadingVendors] = useState(false);
  const [activeTab, setActiveTab] = useState<'cases' | 'csv'>('cases');
  const [qcResponseTab, setQcResponseTab] = useState('all');
  const [selectedCases, setSelectedCases] = useState<Set<string>>(new Set());
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const { toast } = useToast();

  // Calculate QC stats when cases change - memoized for performance
  const qcStats = useMemo(() => {
    return {
      all: cases.length,
      approved: cases.filter(c => c.QC_Response === 'Approved').length,
      rejected: cases.filter(c => c.QC_Response === 'Rejected').length,
      rework: cases.filter(c => c.QC_Response === 'Rework').length
    };
  }, [cases]);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, dateFilter, tatExpiryFilter, clientFilter, qcResponseTab]);

  // Memoized filtered cases for better performance
  const filteredCases = useMemo(() => {
    return cases.filter(caseItem => {
      const matchesSearch = 
        caseItem.case_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        caseItem.client_case_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        caseItem.candidate_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        caseItem.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        caseItem.location.city.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || caseItem.status === statusFilter;
      
      // Filter by QC_Response tab
      const matchesQcResponse = qcResponseTab === 'all' || caseItem.QC_Response === qcResponseTab;
      
      // Filter by creation date
      const matchesDate = (() => {
        if (!dateFilter) return true;
        
        const caseDate = new Date(caseItem.created_at);
        const selectedDate = new Date(dateFilter);
        
        // Compare only the date part (year, month, day) ignoring time
        const caseDateOnly = new Date(caseDate.getFullYear(), caseDate.getMonth(), caseDate.getDate());
        const selectedDateOnly = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
        
        return caseDateOnly.getTime() === selectedDateOnly.getTime();
      })();
      
      // Filter by TAT expiry date
      const matchesTatExpiry = (() => {
        if (!tatExpiryFilter) return true;
        
        const caseDueDate = new Date(caseItem.due_at);
        const selectedDate = new Date(tatExpiryFilter);
        
        // Compare only the date part (year, month, day) ignoring time
        const caseDueDateOnly = new Date(caseDueDate.getFullYear(), caseDueDate.getMonth(), caseDueDate.getDate());
        const selectedDateOnly = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
        
        return caseDueDateOnly.getTime() === selectedDateOnly.getTime();
      })();
      
      // Filter by client
      const matchesClient = clientFilter === 'all' || caseItem.client.id === clientFilter;
      
      // Filter by tier
      const matchesTier = tierFilter === 'all' || caseItem.location.pincode_tier === tierFilter;
      
      return matchesSearch && matchesStatus && matchesQcResponse && matchesDate && matchesTatExpiry && matchesClient && matchesTier;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [cases, searchTerm, statusFilter, dateFilter, tatExpiryFilter, clientFilter, tierFilter, qcResponseTab]);

  // Memoized derived data for better performance
  const allocatableCases = useMemo(() => 
    filteredCases.filter(caseItem => 
      (caseItem.status === 'new' || caseItem.status === 'pending_allocation') && !caseItem.current_assignee
    ), [filteredCases]
  );

  const unallocatableSelectedCases = useMemo(() => 
    filteredCases.filter(caseItem => 
      caseItem.status === 'allocated' && caseItem.current_assignee
    ), [filteredCases]
  );

  const unallocatableCases = useMemo(() => 
    filteredCases.filter(caseItem => 
      (caseItem.status === 'allocated' || caseItem.status === 'in_progress') && 
      caseItem.current_assignee
    ), [filteredCases]
  );

  const selectedAllocatableCases = useMemo(() => 
    Array.from(selectedCases).filter(caseId => {
      const caseItem = cases.find(c => c.id === caseId);
      const isAllocatable = caseItem && (caseItem.status === 'new' || caseItem.status === 'pending_allocation') && !caseItem.current_assignee;
      return isAllocatable;
    }), [selectedCases, cases]
  );

  const selectedUnallocatableCases = useMemo(() => 
    Array.from(selectedCases).filter(caseId => {
      const caseItem = cases.find(c => c.id === caseId);
      const isUnallocatable = caseItem && caseItem.status === 'allocated' && caseItem.current_assignee;
      return isUnallocatable;
    }), [selectedCases, cases]
  );

  // Pagination logic - memoized
  const paginationData = useMemo(() => {
    const totalPages = Math.ceil(filteredCases.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedCases = filteredCases.slice(startIndex, endIndex);
    
    return { totalPages, startIndex, endIndex, paginatedCases };
  }, [filteredCases, currentPage, itemsPerPage]);

  const { totalPages, startIndex, endIndex, paginatedCases: displayCases } = paginationData;

  // Check if any filter is active (not default)
  const hasActiveFilters = useMemo(() => {
    return (
      statusFilter !== 'all' ||
      clientFilter !== 'all' ||
      tierFilter !== 'all' ||
      dateFilter !== null ||
      tatExpiryFilter !== null ||
      searchTerm !== ''
    );
  }, [statusFilter, clientFilter, tierFilter, dateFilter, tatExpiryFilter, searchTerm]);

  // Clear all filters
  const clearAllFilters = () => {
    setStatusFilter('all');
    setClientFilter('all');
    setTierFilter('all');
    setDateFilter(null);
    setTatExpiryFilter(null);
    setSearchTerm('');
    setQcResponseTab('all');
    setCurrentPage(1);
  };

  const handleAutoAllocate = async () => {

    setIsAllocating(true);
    setAllocationResults(null);

    try {
      const results = await allocationService.allocateCases(selectedAllocatableCases);
      
      setAllocationResults({
        successful: results.successful,
        failed: results.failed,
        errors: results.errors
      });

      if (results.successful > 0) {
        toast({
          title: 'Allocation Complete',
          description: `Successfully allocated ${results.successful} cases`,
        });
        
        // Fetch allocation summary
        const summary = await allocationSummaryService.getAllocationSummary(selectedAllocatableCases);
        setAllocationSummary(summary);
        setShowSummary(true);
        
        onRefresh(); // Refresh the case list
      }

      if (results.failed > 0) {
        toast({
          title: 'Some Allocations Failed',
          description: `${results.failed} cases could not be allocated`,
          variant: 'destructive',
        });
      }

    } catch (error) {
      console.error('Allocation failed:', error);
      const { getErrorToast } = await import('@/utils/errorMessages');
      toast(getErrorToast(error));
    } finally {
      setIsAllocating(false);
    }
  };

  const handleManualAllocate = async () => {
    if (selectedAllocatableCases.length === 0) {
      toast({
        title: 'No Cases Selected',
        description: 'Please select cases to manually allocate',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoadingGigWorkers(true);
    setIsLoadingVendors(true);
    try {
      // Load available gig workers
      const { data: gigWorkers, error: gigError } = await supabase
        .from('gig_partners')
        .select(`
          id,
          capacity_available,
          max_daily_capacity,
          quality_score,
          completion_rate,
          ontime_completion_rate,
          acceptance_rate,
          profiles (
            first_name,
            last_name
          ),
          performance_metrics (
            quality_score,
            completion_rate,
            ontime_completion_rate,
            acceptance_rate,
            period_end
          )
        `)
        .eq('is_active', true)
        .eq('is_available', true)
        .eq('is_direct_gig', true)
        .gt('capacity_available', 0)
        .order('capacity_available', { ascending: false });

      if (gigError) throw gigError;

      // Fetch performance_metrics separately for all gig workers (most recent period)
      const gigWorkerIds = (gigWorkers || []).map(w => w.id);
      let performanceMetricsMap = new Map();
      
      console.log('Fetching performance_metrics for gig worker IDs:', gigWorkerIds);
      
      if (gigWorkerIds.length > 0) {
        // First, let's check if there are ANY performance_metrics records for these workers
        const { data: allMetricsCheck, error: checkError } = await supabase
          .from('performance_metrics')
          .select('gig_partner_id, quality_score')
          .in('gig_partner_id', gigWorkerIds)
          .limit(5);
        
        console.log('Quick check - Any performance_metrics found?', allMetricsCheck?.length || 0, 'records');
        if (allMetricsCheck && allMetricsCheck.length > 0) {
          console.log('Sample records from check:', JSON.stringify(allMetricsCheck, null, 2));
        }
        
        // Now fetch all performance_metrics with full details
        const { data: performanceMetricsData, error: perfError } = await supabase
          .from('performance_metrics')
          .select('gig_partner_id, quality_score, completion_rate, ontime_completion_rate, acceptance_rate, period_end, period_start')
          .in('gig_partner_id', gigWorkerIds);

        if (perfError) {
          console.error('Error fetching performance metrics:', perfError);
        } else {
          console.log('Fetched performance_metrics count:', performanceMetricsData?.length || 0);
          if (performanceMetricsData && performanceMetricsData.length > 0) {
            console.log('All performance_metrics records:', JSON.stringify(performanceMetricsData, null, 2));
            console.log('Sample performance_metrics record:', JSON.stringify(performanceMetricsData[0], null, 2));
          } else {
            console.warn('No performance_metrics records found for any of the gig workers!');
            console.log('Gig worker IDs queried:', gigWorkerIds);
          }
          
          // Group by gig_partner_id and get the most recent one for each
          const groupedByGigPartner = new Map();
          (performanceMetricsData || []).forEach(metric => {
            const existing = groupedByGigPartner.get(metric.gig_partner_id);
            if (!existing) {
              groupedByGigPartner.set(metric.gig_partner_id, metric);
            } else {
              // Compare period_end dates to get the most recent
              const existingDate = existing.period_end ? new Date(existing.period_end).getTime() : 0;
              const currentDate = metric.period_end ? new Date(metric.period_end).getTime() : 0;
              if (currentDate > existingDate) {
                groupedByGigPartner.set(metric.gig_partner_id, metric);
              }
            }
          });
          
          performanceMetricsMap = groupedByGigPartner;
          console.log('Performance metrics map size:', performanceMetricsMap.size);
          console.log('Performance metrics map keys (gig_partner_ids):', Array.from(performanceMetricsMap.keys()));
        }
      }

      // Merge performance_metrics into gig workers
      const enrichedGigWorkers = (gigWorkers || []).map(worker => {
        const metrics = performanceMetricsMap.get(worker.id);
        if (metrics) {
          console.log(`Worker ${worker.id} (${worker.profiles?.first_name}): quality_score = ${metrics.quality_score} (type: ${typeof metrics.quality_score})`);
          console.log(`  Raw value: ${JSON.stringify(metrics.quality_score)}, After Number(): ${Number(metrics.quality_score)}, After * 100: ${Number(metrics.quality_score) * 100}`);
        } else {
          console.log(`Worker ${worker.id} (${worker.profiles?.first_name}): No performance_metrics found, using gig_partners.quality_score = ${worker.quality_score} (type: ${typeof worker.quality_score})`);
        }
        return {
          ...worker,
          performance_metrics: metrics ? [metrics] : [] // Convert to array format for consistency
        };
      });

      // Load available vendors
      const { data: vendors, error: vendorError } = await supabase
        .from('vendors')
        .select(`
          id,
          name,
          capacity_available,
          max_daily_capacity,
          quality_score,
          performance_score
        `)
        .eq('is_active', true)
        .gt('capacity_available', 0)
        .order('capacity_available', { ascending: false });

      if (vendorError) throw vendorError;

      setAvailableGigWorkers(enrichedGigWorkers);
      setAvailableVendors(vendors || []);
      setIsManualAllocationDialogOpen(true);
      setIsAllocationDialogOpen(false);
    } catch (error) {
      console.error('Failed to load allocation options:', error);
      const { getErrorToast } = await import('@/utils/errorMessages');
      toast(getErrorToast(error));
    } finally {
      setIsLoadingGigWorkers(false);
      setIsLoadingVendors(false);
    }
  };

  const handleManualAllocationConfirm = async () => {
    if (allocationType === 'gig' && !selectedGigWorker) {
      toast({
        title: 'No Gig Worker Selected',
        description: 'Please select a gig worker for manual allocation',
        variant: 'destructive',
      });
      return;
    }

    if (allocationType === 'vendor' && !selectedVendor) {
      toast({
        title: 'No Vendor Selected',
        description: 'Please select a vendor for manual allocation',
        variant: 'destructive',
      });
      return;
    }


    setIsAllocating(true);
    try {
      const results = {
        successful: 0,
        failed: 0,
        errors: [] as string[]
      };

      // Allocate each case to the chosen gig worker or vendor
      for (const caseId of selectedAllocatableCases) {
        try {
          const caseItem = cases.find(c => c.id === caseId);
          if (!caseItem) continue;

          let result;
          if (allocationType === 'gig') {
            result = await allocationService.allocateCaseManually({
              caseId,
              gigWorkerId: selectedGigWorker,
              pincode: caseItem.location.pincode,
              pincodeTier: caseItem.location.pincode_tier || 'tier_1'
            });
          } else {
            // For vendor allocation, we'll need to update the allocationService
            result = await allocationService.allocateCaseToVendor({
              caseId,
              vendorId: selectedVendor,
              pincode: caseItem.location.pincode,
              pincodeTier: caseItem.location.pincode_tier || 'tier_1'
            });
          }

          if (result.success) {
            results.successful++;
          } else {
            results.failed++;
            results.errors.push(`Case ${caseItem.case_number}: ${result.error}`);
          }
        } catch (error) {
          results.failed++;
          results.errors.push(`Case ${caseId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      setAllocationResults(results);
      setSelectedCases(new Set());
      setSelectedGigWorker('');
      setSelectedVendor('');
      setAllocationType('gig');
      setIsManualAllocationDialogOpen(false);

      toast({
        title: 'Manual Allocation Complete',
        description: `Successfully allocated ${results.successful} cases. ${results.failed} failed.`,
        variant: results.failed > 0 ? 'destructive' : 'default',
      });

      // Refresh the cases list
      onRefresh?.();
    } catch (error) {
      console.error('Manual allocation failed:', error);
      const { getErrorToast } = await import('@/utils/errorMessages');
      toast(getErrorToast(error));
    } finally {
      setIsAllocating(false);
    }
  };


  const handleUnallocate = () => {
    if (selectedUnallocatableCases.length === 0) {
      toast({
        title: 'No Cases Selected',
        description: 'Please select allocated cases to unallocate',
        variant: 'destructive',
      });
      return;
    }
    setIsUnallocationDialogOpen(true);
  };

  const handleConfirmUnallocate = async () => {
    if (selectedUnallocatableCases.length === 0) {
      toast({
        title: 'No Cases Selected',
        description: 'Please select allocated cases to unallocate',
        variant: 'destructive',
      });
      return;
    }

    setIsUnallocating(true);
    try {
      const results = await allocationService.unallocateCases(selectedUnallocatableCases, unallocationReason);

      toast({
        title: 'Unallocation Complete',
        description: `Successfully unallocated ${results.successful} case${results.successful !== 1 ? 's' : ''}. ${results.failed > 0 ? `${results.failed} failed.` : ''}`,
        variant: results.failed > 0 ? 'destructive' : 'default',
      });

      if (results.successful > 0) {
        setSelectedCases(new Set());
        setUnallocationReason('');
        setIsUnallocationDialogOpen(false);
        onRefresh(); // Refresh the case list
      }

      if (results.failed > 0) {
        console.error('Unallocation errors:', results.errors);
      }

    } catch (error) {
      console.error('Unallocation failed:', error);
      const { getErrorToast } = await import('@/utils/errorMessages');
      toast(getErrorToast(error));
    } finally {
      setIsUnallocating(false);
    }
  };

  const getStatusBadge = (status: Case['status']) => (
    <Badge className={STATUS_COLORS[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  );

  const getContractTypeBadge = (contractType: string) => {
    const typeLabels: Record<string, string> = {
      'residential_address_check': 'Residential',
      'business_address_check': 'Business',
    };
    
    return (
      <Badge variant="outline">
        {typeLabels[contractType] || contractType}
      </Badge>
    );
  };

  const isOverdue = (dueAt: string) => {
    return new Date(dueAt) < new Date();
  };

  const getDaysUntilDue = (dueAt: string) => {
    const now = new Date();
    const due = new Date(dueAt);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Helper functions for QC dashboard-style display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
  };

  const getTimeTaken = (assignedAt?: string, submittedAt?: string) => {
    if (!assignedAt || !submittedAt) return 'N/A';
    
    const assigned = new Date(assignedAt);
    const submitted = new Date(submittedAt);
    const diffMs = submitted.getTime() - assigned.getTime();
    
    if (diffMs < 0) return 'Invalid';
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    } else {
      return `${diffMinutes}m`;
    }
  };

  const getQCResponseBadge = (qcResponse?: string) => {
    if (!qcResponse) return null;

    const responseConfig = {
      'Approved': { label: 'Approved', className: 'bg-green-100 text-green-800' },
      'Rejected': { label: 'Rejected', className: 'bg-red-100 text-red-800' },
      'Rework': { label: 'Rework', className: 'bg-orange-100 text-orange-800' },
      'New': { label: 'New', className: 'bg-gray-100 text-gray-800' }
    };

    const config = responseConfig[qcResponse as keyof typeof responseConfig] || { label: qcResponse, className: 'bg-gray-100 text-gray-800' };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.className}`}>
        {config.label}
      </span>
    );
  };

  // Case selection handlers - memoized with useCallback
  const handleSelectCase = useCallback((caseId: string, checked: boolean) => {
    setSelectedCases(prev => {
      const newSelectedCases = new Set(prev);
      if (checked) {
        newSelectedCases.add(caseId);
      } else {
        newSelectedCases.delete(caseId);
      }
      return newSelectedCases;
    });
  }, []);

  const handleSelectAllCases = useCallback((checked: boolean) => {
    if (checked) {
      // Select all allocatable and allocated cases on current page
      setSelectedCases(prev => {
        const newSelectedCases = new Set(prev);
        displayCases.forEach(caseItem => {
          if (((caseItem.status === 'new' || caseItem.status === 'pending_allocation') && !caseItem.current_assignee) ||
              (caseItem.status === 'allocated' && caseItem.current_assignee)) {
            newSelectedCases.add(caseItem.id);
          }
        });
        return newSelectedCases;
      });
    } else {
      // Deselect all cases
      setSelectedCases(new Set());
    }
  }, [displayCases]);

  const isCaseSelected = useCallback((caseId: string) => selectedCases.has(caseId), [selectedCases]);

  const isAllCasesSelected = useMemo(() => {
    const selectableCasesOnPage = displayCases.filter(caseItem => 
      ((caseItem.status === 'new' || caseItem.status === 'pending_allocation') && !caseItem.current_assignee) ||
      (caseItem.status === 'allocated' && caseItem.current_assignee)
    );
    return selectableCasesOnPage.length > 0 && 
           selectableCasesOnPage.every(caseItem => selectedCases.has(caseItem.id));
  }, [displayCases, selectedCases]);

  const isSomeCasesSelected = useMemo(() => {
    const selectableCasesOnPage = displayCases.filter(caseItem => 
      ((caseItem.status === 'new' || caseItem.status === 'pending_allocation') && !caseItem.current_assignee) ||
      (caseItem.status === 'allocated' && caseItem.current_assignee)
    );
    return selectableCasesOnPage.some(caseItem => selectedCases.has(caseItem.id));
  }, [displayCases, selectedCases]);

  

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cases</CardTitle>
          <CardDescription>Loading cases...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Cases</CardTitle>
            <CardDescription>
              Manage and allocate cases to gig workers
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsBulkUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Bulk Upload
            </Button>
            <Button onClick={onCreateCase}>
              <Plus className="h-4 w-4 mr-2" />
              Create Case
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6">
          <Button
            variant={activeTab === 'cases' ? 'default' : 'outline'}
            onClick={() => setActiveTab('cases')}
            className="flex items-center gap-2"
          >
            <Building className="h-4 w-4" />
            Cases
          </Button>
          <Button
            variant={activeTab === 'csv' ? 'default' : 'outline'}
            onClick={() => setActiveTab('csv')}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            CSV Management
          </Button>
        </div>

        {/* Tab Content */}
        {activeTab === 'cases' && (
          <>
            {/* QC Response Tabs */}
            <Tabs value={qcResponseTab} onValueChange={setQcResponseTab} className="w-full mb-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  All ({qcStats.all})
                </TabsTrigger>
                <TabsTrigger value="Approved" className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Approved ({qcStats.approved})
                </TabsTrigger>
                <TabsTrigger value="Rejected" className="flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Rejected ({qcStats.rejected})
                </TabsTrigger>
                <TabsTrigger value="Rework" className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Rework ({qcStats.rework})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Case ID/Case Number"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`pl-10 ${searchTerm ? 'bg-blue-50 border-blue-300 text-blue-700' : ''}`}
              />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className={`w-40 ${statusFilter !== 'all' ? 'bg-blue-50 border-blue-300 text-blue-700' : ''}`}>
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="flex gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-48 justify-start text-left font-normal ${dateFilter ? 'bg-blue-50 border-blue-300 text-blue-700' : ''}`}
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {dateFilter ? format(dateFilter, "PPP") : "Case Creation Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFilter || undefined}
                    onSelect={(date) => setDateFilter(date || null)}
                    disabled={(date) => {
                      const today = new Date();
                      const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                      return dateOnly > todayDateOnly;
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {dateFilter && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setDateFilter(null)}
                  className="w-10 h-10"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            <div className="flex gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-48 justify-start text-left font-normal ${tatExpiryFilter ? 'bg-blue-50 border-blue-300 text-blue-700' : ''}`}
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {tatExpiryFilter ? format(tatExpiryFilter, "PPP") : "TAT Expiry Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={tatExpiryFilter || undefined}
                    onSelect={(date) => setTatExpiryFilter(date || null)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {tatExpiryFilter && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setTatExpiryFilter(null)}
                  className="w-10 h-10"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className={`w-48 ${clientFilter !== 'all' ? 'bg-blue-50 border-blue-300 text-blue-700' : ''}`}>
                <Building className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {Array.from(new Set(cases.map(c => c.client.id))).map(clientId => {
                  const client = cases.find(c => c.client.id === clientId)?.client;
                  return (
                    <SelectItem key={clientId} value={clientId}>
                      {client?.name || 'Unknown Client'}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className={`w-32 ${tierFilter !== 'all' ? 'bg-blue-50 border-blue-300 text-blue-700' : ''}`}>
                <MapPin className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="tier_1">Tier 1</SelectItem>
                <SelectItem value="tier_2">Tier 2</SelectItem>
                <SelectItem value="tier_3">Tier 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Clear Filters Button - Below search bar */}
        {hasActiveFilters && (
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={clearAllFilters}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Clear Filters
            </Button>
          </div>
        )}

        {/* Allocation Actions - Show when allocatable cases are selected */}
        {selectedAllocatableCases.length > 0 && (
          <div className="mb-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>
                    {selectedAllocatableCases.length} case{selectedAllocatableCases.length > 1 ? 's' : ''} selected for allocation
                  </span>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setAllocationMode('auto');
                        setIsAllocationDialogOpen(true);
                      }}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Auto Allocate
                    </Button>
                    <Button
                      onClick={handleManualAllocate}
                      size="sm"
                      variant="outline"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Manual Allocate
                    </Button>
                    <Button
                      onClick={() => setSelectedCases(new Set())}
                      size="sm"
                      variant="outline"
                    >
                      Clear Selection
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Unallocation Actions - Show when allocated cases are selected */}
        {selectedUnallocatableCases.length > 0 && (
          <div className="mb-6">
            <Alert>
              <RotateCcw className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>
                    {selectedUnallocatableCases.length} allocated case{selectedUnallocatableCases.length > 1 ? 's' : ''} selected
                  </span>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleUnallocate}
                      size="sm"
                      variant="destructive"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Unallocate
                    </Button>
                    <Button
                      onClick={() => setSelectedCases(new Set())}
                      size="sm"
                      variant="outline"
                    >
                      Clear Selection
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Allocation Summary */}
        {showSummary && allocationSummary.length > 0 && (
          <div className="mb-6">
            <AllocationSummary 
              data={allocationSummary}
              totalAllocated={allocationResults?.successful || 0}
              totalFailed={allocationResults?.failed || 0}
            />
            <div className="flex justify-end mt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowSummary(false)}
                size="sm"
              >
                Hide Summary
              </Button>
            </div>
          </div>
        )}


        {/* Cases Table */}
        {displayCases.length === 0 ? (
          <div className="text-center py-8">
            <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No cases found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Get started by creating your first case'
              }
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Button onClick={onCreateCase}>
                <Plus className="h-4 w-4 mr-2" />
                Create Case
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">

            {/* Case Cards */}
            {displayCases.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Cases Found</h3>
                <p className="text-muted-foreground">
                  {searchTerm || statusFilter !== 'all' || qcResponseTab !== 'all'
                    ? 'No cases match your current filters.'
                    : 'There are currently no cases in this category.'
                  }
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                 {displayCases.map((caseItem) => {
                  return (
                    <div
                      key={caseItem.id}
                      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3">
                          {/* Checkbox for new, pending_allocation, and allocated status cases */}
                          {(((caseItem.status === 'new' || caseItem.status === 'pending_allocation') && !caseItem.current_assignee) || 
                           (caseItem.status === 'allocated' && caseItem.current_assignee)) && (
                            <Checkbox
                              checked={isCaseSelected(caseItem.id)}
                              onCheckedChange={(checked) => handleSelectCase(caseItem.id, checked as boolean)}
                              className="mt-1"
                            />
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-lg flex items-center gap-2">
                                {caseItem.case_number}
                                {isRecreatedCase(caseItem.case_number) && (
                                  <Badge variant="outline" className="text-xs border-orange-300 text-orange-700 bg-orange-50">
                                    Recreated
                                  </Badge>
                                )}
                              </h3>
                              {getStatusBadge(caseItem.status)}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {caseItem.client_case_id} • {getContractTypeBadge(caseItem.contract_type)}
                            </p>
                            <h4 className="font-medium text-base mb-1">{caseItem.candidate_name}</h4>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onViewCase(caseItem.id)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEditCase(caseItem.id)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => onDeleteCase(caseItem.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-muted-foreground">Client</p>
                            <p className="font-medium">{caseItem.client.name}</p>
                            <p className="text-xs text-muted-foreground">{caseItem.client.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-muted-foreground">Phone</p>
                            <p className="font-medium">{caseItem.phone_primary}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-muted-foreground">Location</p>
                            {caseItem.location.location_url ? (
                              <a
                                href={caseItem.location.location_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                              >
                                {caseItem.location.city}, {caseItem.location.state}
                              </a>
                            ) : (
                              <p className="font-medium">{caseItem.location.city}, {caseItem.location.state}</p>
                            )}
                             <div className="flex items-center gap-2">
                               <span className="text-xs text-muted-foreground">{caseItem.location.pincode}</span>
                               <Badge variant="outline" className="text-xs">
                                 Tier {getTierNumber(caseItem.location.pincode_tier)}
                               </Badge>
                             </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-muted-foreground">TAT Hours</p>
                            <p className="font-medium">{caseItem.tat_hours}h</p>
                          </div>
                        </div>
                      </div>

                      {/* Additional Information */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 text-sm mt-4 pt-4 border-t">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-muted-foreground">Assigned On</p>
                            <p className="font-medium">{formatTime(caseItem.assigned_at)}</p>
                            <p className="text-xs text-muted-foreground">
                              {caseItem.assigned_at ? 'Assignment time' : 'Not assigned'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-muted-foreground">Submitted On</p>
                            <p className="font-medium">{formatTime(caseItem.submitted_at)}</p>
                            <p className="text-xs text-muted-foreground">
                              {caseItem.submitted_at ? 'Submission time' : 'Not submitted'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-muted-foreground">Time Taken</p>
                            <p className="font-medium">
                              {caseItem.assigned_at && caseItem.submitted_at 
                                ? getTimeTaken(caseItem.assigned_at, caseItem.submitted_at)
                                : 'N/A'
                              }
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {caseItem.assigned_at && caseItem.submitted_at 
                                ? 'From assignment to submission'
                                : 'Not submitted yet'
                              }
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-muted-foreground">Due Date</p>
                            <p className={`font-medium ${isOverdue(caseItem.due_at) ? 'text-red-600' : ''}`}>
                              {format(new Date(caseItem.due_at), 'MMM dd, yyyy')}
                            </p>
                            <p className={`text-xs ${isOverdue(caseItem.due_at) ? 'text-red-500' : 'text-muted-foreground'}`}>
                              {isOverdue(caseItem.due_at) 
                                ? 'Overdue' 
                                : `${getDaysUntilDue(caseItem.due_at)} days left`
                              }
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-muted-foreground">Payout</p>
                            {caseItem.total_payout_inr ? (
                              <div>
                                <p className="font-medium">₹{caseItem.total_payout_inr.toFixed(2)}</p>
                                {caseItem.bonus_inr && caseItem.bonus_inr > 0 && (
                                  <p className="text-xs text-green-600">+₹{caseItem.bonus_inr.toFixed(2)} bonus</p>
                                )}
                                {caseItem.penalty_inr && caseItem.penalty_inr > 0 && (
                                  <p className="text-xs text-red-600">-₹{caseItem.penalty_inr.toFixed(2)} penalty</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-muted-foreground text-xs">Not calculated</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {caseItem.current_assignee && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm text-muted-foreground">Assigned to</p>
                              <p className="font-medium">
                                {caseItem.current_assignee.name}
                                <span className="text-sm text-muted-foreground ml-2">
                                  ({caseItem.current_assignee.type === 'gig' ? 'Gig Worker' : 'Vendor'})
                                </span>
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {filteredCases.length > itemsPerPage && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredCases.length)} of {filteredCases.length} cases
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
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
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
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Allocation Dialog */}
        <Dialog open={isAllocationDialogOpen} onOpenChange={setIsAllocationDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {allocationMode === 'auto' ? 'Auto Allocate Cases' : 'Manual Allocate Cases'}
              </DialogTitle>
              <DialogDescription>
                {allocationMode === 'auto' 
                  ? `Allocate cases automatically using the allocation engine.`
                  : `Manually assign cases to specific gig workers.`
                }
              </DialogDescription>
            </DialogHeader>
            
            {allocationResults && (
              <Alert className="mb-4">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p>Allocation completed!</p>
                    <p>✅ Successful: {allocationResults.successful}</p>
                    <p>❌ Failed: {allocationResults.failed}</p>
                    {allocationResults.errors.length > 0 && (
                      <div>
                        <p className="font-medium">Errors:</p>
                        <ul className="list-disc list-inside text-sm">
                          {allocationResults.errors.slice(0, 3).map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                          {allocationResults.errors.length > 3 && (
                            <li>... and {allocationResults.errors.length - 3} more</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsAllocationDialogOpen(false)}
                disabled={isAllocating}
              >
                Cancel
              </Button>
              <Button 
                onClick={allocationMode === 'auto' ? handleAutoAllocate : handleManualAllocate}
                disabled={isAllocating}
                className="flex items-center gap-2"
              >
                {isAllocating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Allocating...
                  </>
                ) : (
                  <>
                    {allocationMode === 'auto' ? (
                      <>
                        <Zap className="h-4 w-4" />
                        Auto Allocate
                      </>
                    ) : (
                      <>
                        <Users className="h-4 w-4" />
                        Manual Allocate
                      </>
                    )}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Unallocation Dialog */}
        <Dialog open={isUnallocationDialogOpen} onOpenChange={setIsUnallocationDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Unallocate Cases</DialogTitle>
              <DialogDescription>
                This will unallocate {selectedUnallocatableCases.length} case{selectedUnallocatableCases.length !== 1 ? 's' : ''} and change their status to 'new'.
                The assigned workers will have their capacity freed up.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="unallocation-reason" className="text-sm font-medium">
                  Reason for unallocation (optional)
                </label>
                <Input
                  id="unallocation-reason"
                  value={unallocationReason}
                  onChange={(e) => setUnallocationReason(e.target.value)}
                  placeholder="e.g., Wrong assignment, Worker unavailable, etc."
                  className="mt-1"
                />
              </div>
              
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This action cannot be undone. Cases will need to be reallocated manually or through auto-allocation.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsUnallocationDialogOpen(false)}
                disabled={isUnallocating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmUnallocate}
                disabled={isUnallocating}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {isUnallocating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Unallocating...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Unallocate Cases
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manual Allocation Dialog */}
        <Dialog open={isManualAllocationDialogOpen} onOpenChange={setIsManualAllocationDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Manual Allocation</DialogTitle>
              <DialogDescription>
                Select allocation type and assignee to manually assign {selectedAllocatableCases.length} selected case{selectedAllocatableCases.length !== 1 ? 's' : ''}.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Allocation Type Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Allocation Type</label>
                <div className="flex space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      value="gig"
                      checked={allocationType === 'gig'}
                      onChange={(e) => {
                        setAllocationType(e.target.value as 'gig' | 'vendor');
                        setSelectedGigWorker('');
                        setSelectedVendor('');
                      }}
                      className="text-blue-600"
                    />
                    <span className="text-sm">Direct Gig Worker</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      value="vendor"
                      checked={allocationType === 'vendor'}
                      onChange={(e) => {
                        setAllocationType(e.target.value as 'gig' | 'vendor');
                        setSelectedGigWorker('');
                        setSelectedVendor('');
                      }}
                      className="text-blue-600"
                    />
                    <span className="text-sm">Vendor</span>
                  </label>
                </div>
              </div>

              {isLoadingGigWorkers || isLoadingVendors ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-sm text-muted-foreground">Loading available options...</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Gig Worker Selection */}
                  {allocationType === 'gig' && (
                    <div>
                      <label htmlFor="gig-worker-select" className="text-sm font-medium">
                        Select Gig Worker
                      </label>
                      <Select value={selectedGigWorker} onValueChange={setSelectedGigWorker}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Choose a gig worker..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableGigWorkers.map((worker) => (
                            <SelectItem key={worker.id} value={worker.id}>
                              <div className="flex items-center justify-between w-full">
                                <span>
                                  {worker.profiles?.first_name} {worker.profiles?.last_name}
                                </span>
                                <div className="flex items-center space-x-2 text-xs text-muted-foreground ml-4">
                                  <span>Capacity: {worker.capacity_available}/{worker.max_daily_capacity}</span>
                                  {(() => {
                                    // Start with gig_partners quality_score, convert to number
                                    let qualityScore = Number(worker.quality_score) || 0;
                                    
                                    // Try to get quality_score from performance_metrics (most recent if array)
                                    if (worker.performance_metrics) {
                                      if (Array.isArray(worker.performance_metrics) && worker.performance_metrics.length > 0) {
                                        // Get the most recent one (sorted by period_end if available, otherwise first)
                                        const sorted = [...worker.performance_metrics].sort((a, b) => {
                                          if (a.period_end && b.period_end) {
                                            return new Date(b.period_end).getTime() - new Date(a.period_end).getTime();
                                          }
                                          return 0;
                                        });
                                        const metricsScore = sorted[0]?.quality_score;
                                        if (metricsScore != null && metricsScore !== undefined) {
                                          qualityScore = Number(metricsScore) || 0;
                                        }
                                      } else if (!Array.isArray(worker.performance_metrics) && worker.performance_metrics.quality_score != null) {
                                        qualityScore = Number(worker.performance_metrics.quality_score) || 0;
                                      }
                                    }
                                    
                                    // Always display quality score (multiply by 100 since DB stores decimals < 1)
                                    // qualityScore should be like 0.8840, so 0.8840 * 100 = 88.4, rounded = 88
                                    return <span>Quality: {Math.round(qualityScore * 100)}%</span>;
                                  })()}
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Vendor Selection */}
                  {allocationType === 'vendor' && (
                    <div>
                      <label htmlFor="vendor-select" className="text-sm font-medium">
                        Select Vendor
                      </label>
                      <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Choose a vendor..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableVendors.map((vendor) => (
                            <SelectItem key={vendor.id} value={vendor.id}>
                              <div className="flex items-center justify-between w-full">
                                <span>{vendor.name}</span>
                                <div className="flex items-center space-x-2 text-xs text-muted-foreground ml-4">
                                  <span>Capacity: {vendor.capacity_available}/{vendor.max_daily_capacity}</span>
                                  <span>Quality: {Math.round((vendor.quality_score || 0) * 100)}%</span>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* No options available alerts */}
                  {allocationType === 'gig' && availableGigWorkers.length === 0 && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        No available gig workers found. All workers may be at capacity or unavailable.
                      </AlertDescription>
                    </Alert>
                  )}

                  {allocationType === 'vendor' && availableVendors.length === 0 && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        No available vendors found. All vendors may be at capacity or unavailable.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Selected Gig Worker Details */}
                  {allocationType === 'gig' && selectedGigWorker && (
                    <div className="bg-muted p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Selected Gig Worker Details</h4>
                      {(() => {
                        const worker = availableGigWorkers.find(w => w.id === selectedGigWorker);
                        if (!worker) return null;
                        return (
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Name:</span> {worker.profiles?.first_name} {worker.profiles?.last_name}
                            </div>
                            <div>
                              <span className="font-medium">Capacity:</span> {worker.capacity_available}/{worker.max_daily_capacity}
                            </div>
                            {(() => {
                              // Start with gig_partners values as fallback, convert to numbers
                              let qualityScore = Number(worker.quality_score) || 0;
                              let completionRate = Number(worker.completion_rate) || 0;
                              let ontimeRate = Number(worker.ontime_completion_rate) || 0;
                              let acceptanceRate = Number(worker.acceptance_rate) || 0;
                              
                              // Try to get values from performance_metrics (most recent if array)
                              if (worker.performance_metrics) {
                                if (Array.isArray(worker.performance_metrics) && worker.performance_metrics.length > 0) {
                                  // Get the most recent one (sorted by period_end if available, otherwise first)
                                  const sorted = [...worker.performance_metrics].sort((a, b) => {
                                    if (a.period_end && b.period_end) {
                                      return new Date(b.period_end).getTime() - new Date(a.period_end).getTime();
                                    }
                                    return 0;
                                  });
                                  const metrics = sorted[0];
                                  if (metrics) {
                                    qualityScore = Number(metrics.quality_score) || qualityScore;
                                    completionRate = Number(metrics.completion_rate) || completionRate;
                                    ontimeRate = Number(metrics.ontime_completion_rate) || ontimeRate;
                                    acceptanceRate = Number(metrics.acceptance_rate) || acceptanceRate;
                                  }
                                } else if (!Array.isArray(worker.performance_metrics)) {
                                  const metrics = worker.performance_metrics;
                                  if (metrics.quality_score != null) qualityScore = Number(metrics.quality_score) || 0;
                                  if (metrics.completion_rate != null) completionRate = Number(metrics.completion_rate) || 0;
                                  if (metrics.ontime_completion_rate != null) ontimeRate = Number(metrics.ontime_completion_rate) || 0;
                                  if (metrics.acceptance_rate != null) acceptanceRate = Number(metrics.acceptance_rate) || 0;
                                }
                              }
                              
                              return (
                                <>
                                  <div>
                                    <span className="font-medium">Quality Score:</span> {Math.round(qualityScore * 100)}%
                                  </div>
                                  <div>
                                    <span className="font-medium">Completion Rate:</span> {Math.round(completionRate * 100)}%
                                  </div>
                                  <div>
                                    <span className="font-medium">On-time Rate:</span> {Math.round(ontimeRate * 100)}%
                                  </div>
                                  <div>
                                    <span className="font-medium">Acceptance Rate:</span> {Math.round(acceptanceRate * 100)}%
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Selected Vendor Details */}
                  {allocationType === 'vendor' && selectedVendor && (
                    <div className="bg-muted p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Selected Vendor Details</h4>
                      {(() => {
                        const vendor = availableVendors.find(v => v.id === selectedVendor);
                        if (!vendor) return null;
                        return (
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Name:</span> {vendor.name}
                            </div>
                            <div>
                              <span className="font-medium">Capacity:</span> {vendor.capacity_available}/{vendor.max_daily_capacity}
                            </div>
                            <div>
                              <span className="font-medium">Quality Score:</span> {Math.round((vendor.quality_score || 0) * 100)}%
                            </div>
                            <div>
                              <span className="font-medium">Performance Score:</span> {Math.round((vendor.performance_score || 0) * 100)}%
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsManualAllocationDialogOpen(false);
                  setSelectedGigWorker('');
                  setSelectedVendor('');
                  setAllocationType('gig');
                }}
                disabled={isAllocating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleManualAllocationConfirm}
                disabled={isAllocating || (allocationType === 'gig' && !selectedGigWorker) || (allocationType === 'vendor' && !selectedVendor)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isAllocating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Allocating...
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4 mr-2" />
                    Allocate Cases
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
          </>
        )}

        {/* CSV Management Tab */}
        {activeTab === 'csv' && (
          <CSVManagement onRefresh={onRefresh} />
        )}

        {/* Bulk Upload Dialog */}
        <Dialog open={isBulkUploadOpen} onOpenChange={setIsBulkUploadOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Bulk Case Creation</DialogTitle>
              <DialogDescription>
                Upload a CSV file to create multiple cases at once. Download the template first to see the required format.
              </DialogDescription>
            </DialogHeader>
            <BulkCaseUpload
              onSuccess={(result) => {
                toast({
                  title: 'Bulk Creation Complete',
                  description: `Successfully created ${result.created} cases.`,
                });
                onRefresh();
                setIsBulkUploadOpen(false);
              }}
              onClose={() => setIsBulkUploadOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
