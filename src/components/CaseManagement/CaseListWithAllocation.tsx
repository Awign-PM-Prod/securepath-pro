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
import { MoreHorizontal, Search, Filter, Plus, Eye, Edit, Trash2, MapPin, Clock, User, Building, Zap, Users, CheckCircle, XCircle, AlertCircle, FileText, RotateCcw, Phone, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Upload, Download, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { format } from 'date-fns';
import { isRecreatedCase } from '@/utils/caseUtils';
import { useToast } from '@/hooks/use-toast';
import { allocationService } from '@/services/allocationService';
import { allocationSummaryService, AllocationSummaryData } from '@/services/allocationSummaryService';
import AllocationSummary from '@/components/Allocation/AllocationSummary';
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
  const [statusFilter, setStatusFilter] = useState<string[]>([]); // Multi-select: array of selected statuses
  const [dateFilter, setDateFilter] = useState<{ from: Date | undefined; to: Date | undefined } | undefined>(undefined);
  const [tatExpiryFilter, setTatExpiryFilter] = useState<{ from: Date | undefined; to: Date | undefined } | undefined>(undefined);
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
  const [qcResponseTab, setQcResponseTab] = useState('all');
  const [selectedCases, setSelectedCases] = useState<Set<string>>(new Set());
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [sortBy, setSortBy] = useState<'due_at_asc' | 'due_at_desc' | 'none'>('none');
  const { toast } = useToast();

  // Helper function to check if a case matches the search term across all metadata
  // Moved before filteredCasesForStats to avoid dependency issues
  const caseMatchesSearch = useCallback((caseItem: Case, term: string): boolean => {
    if (!term) return true;
    
    const lowerTerm = term.toLowerCase();
    
    // Helper to format time taken (inline version to avoid dependency issues)
    const getTimeTakenStr = (assignedAt?: string, submittedAt?: string): string => {
      if (!assignedAt || !submittedAt) return '';
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
    
    const searchableFields = [
      caseItem.case_number,
      caseItem.client_case_id,
      caseItem.candidate_name,
      caseItem.client.name,
      caseItem.client.email,
      caseItem.phone_primary,
      caseItem.phone_secondary || '',
      caseItem.location.city,
      caseItem.location.state,
      caseItem.location.pincode,
      caseItem.location.address_line || '',
      caseItem.tat_hours?.toString() || '',
      caseItem.contract_type,
      STATUS_LABELS[caseItem.status] || caseItem.status,
      caseItem.total_payout_inr?.toString() || '',
      format(new Date(caseItem.created_at), 'MMM dd, yyyy'),
      format(new Date(caseItem.created_at), 'HH:mm'),
      format(new Date(caseItem.created_at), 'yyyy-MM-dd'),
      format(new Date(caseItem.due_at), 'MMM dd, yyyy'),
      format(new Date(caseItem.due_at), 'yyyy-MM-dd'),
      caseItem.assigned_at ? format(new Date(caseItem.assigned_at), 'MMM dd, yyyy HH:mm') : '',
      caseItem.submitted_at ? format(new Date(caseItem.submitted_at), 'MMM dd, yyyy HH:mm') : '',
      caseItem.submitted_at && caseItem.assigned_at ? getTimeTakenStr(caseItem.assigned_at, caseItem.submitted_at) : '',
      `Tier ${getTierNumber(caseItem.location.pincode_tier)}`,
      caseItem.current_assignee?.name || '',
      caseItem.current_assignee?.type || '',
    ];
    
    return searchableFields.some(field => 
      field && field.toLowerCase().includes(lowerTerm)
    );
  }, []);

  // Calculate filtered cases without QC Response filter (for tab counts)
  const filteredCasesForStats = useMemo(() => {
    return cases.filter(caseItem => {
      const matchesSearch = caseMatchesSearch(caseItem, searchTerm);
      const matchesStatus = statusFilter.length === 0 || statusFilter.includes(caseItem.status);
      
      const matchesDate = (() => {
        if (!dateFilter || (!dateFilter.from && !dateFilter.to)) return true;
        const caseDate = new Date(caseItem.created_at);
        const caseDateOnly = new Date(caseDate.getFullYear(), caseDate.getMonth(), caseDate.getDate());
        
        if (dateFilter.from && dateFilter.to) {
          // Date range: both from and to are set
          const fromDateOnly = new Date(dateFilter.from.getFullYear(), dateFilter.from.getMonth(), dateFilter.from.getDate());
          const toDateOnly = new Date(dateFilter.to.getFullYear(), dateFilter.to.getMonth(), dateFilter.to.getDate());
          return caseDateOnly >= fromDateOnly && caseDateOnly <= toDateOnly;
        } else if (dateFilter.from) {
          // Only from date is set
          const fromDateOnly = new Date(dateFilter.from.getFullYear(), dateFilter.from.getMonth(), dateFilter.from.getDate());
          return caseDateOnly >= fromDateOnly;
        } else if (dateFilter.to) {
          // Only to date is set
          const toDateOnly = new Date(dateFilter.to.getFullYear(), dateFilter.to.getMonth(), dateFilter.to.getDate());
          return caseDateOnly <= toDateOnly;
        }
        return true;
      })();
      
      const matchesTatExpiry = (() => {
        if (!tatExpiryFilter || (!tatExpiryFilter.from && !tatExpiryFilter.to)) return true;
        const caseDueDate = new Date(caseItem.due_at);
        const caseDueDateOnly = new Date(caseDueDate.getFullYear(), caseDueDate.getMonth(), caseDueDate.getDate());
        
        if (tatExpiryFilter.from && tatExpiryFilter.to) {
          // Date range: both from and to are set
          const fromDateOnly = new Date(tatExpiryFilter.from.getFullYear(), tatExpiryFilter.from.getMonth(), tatExpiryFilter.from.getDate());
          const toDateOnly = new Date(tatExpiryFilter.to.getFullYear(), tatExpiryFilter.to.getMonth(), tatExpiryFilter.to.getDate());
          return caseDueDateOnly >= fromDateOnly && caseDueDateOnly <= toDateOnly;
        } else if (tatExpiryFilter.from) {
          // Only from date is set
          const fromDateOnly = new Date(tatExpiryFilter.from.getFullYear(), tatExpiryFilter.from.getMonth(), tatExpiryFilter.from.getDate());
          return caseDueDateOnly >= fromDateOnly;
        } else if (tatExpiryFilter.to) {
          // Only to date is set
          const toDateOnly = new Date(tatExpiryFilter.to.getFullYear(), tatExpiryFilter.to.getMonth(), tatExpiryFilter.to.getDate());
          return caseDueDateOnly <= toDateOnly;
        }
        return true;
      })();
      
      const matchesClient = clientFilter === 'all' || caseItem.client.id === clientFilter;
      const matchesTier = tierFilter === 'all' || caseItem.location.pincode_tier === tierFilter;
      
      return matchesSearch && matchesStatus && matchesDate && matchesTatExpiry && matchesClient && matchesTier;
    });
  }, [cases, searchTerm, statusFilter, dateFilter, tatExpiryFilter, clientFilter, tierFilter, caseMatchesSearch]);

  // Calculate QC stats based on filtered cases (excluding QC Response filter) - memoized for performance
  const qcStats = useMemo(() => {
    return {
      all: filteredCasesForStats.length,
      approved: filteredCasesForStats.filter(c => c.QC_Response === 'Approved').length,
      rejected: filteredCasesForStats.filter(c => c.QC_Response === 'Rejected').length,
      rework: filteredCasesForStats.filter(c => c.QC_Response === 'Rework').length
    };
  }, [filteredCasesForStats]);

  // Reset to page 1 when filters or sort change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, dateFilter, tatExpiryFilter, clientFilter, qcResponseTab, sortBy]);

  // Check if any filter is active
  const hasActiveFilters = useMemo(() => {
    return (
      searchTerm.trim() !== '' ||
      statusFilter.length > 0 ||
      (dateFilter && (dateFilter.from || dateFilter.to)) ||
      (tatExpiryFilter && (tatExpiryFilter.from || tatExpiryFilter.to)) ||
      clientFilter !== 'all' ||
      tierFilter !== 'all' ||
      qcResponseTab !== 'all' ||
      sortBy !== 'none'
    );
  }, [searchTerm, statusFilter, dateFilter, tatExpiryFilter, clientFilter, tierFilter, qcResponseTab, sortBy]);

  // Helper function to highlight matching text (handles multiple matches)
  const highlightText = (text: string, searchTerm: string): React.ReactNode => {
    if (!searchTerm || !text) return text;
    
    const textStr = text.toString();
    const lowerText = textStr.toLowerCase();
    const lowerSearch = searchTerm.toLowerCase();
    
    if (!lowerText.includes(lowerSearch)) return text;
    
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let index = lowerText.indexOf(lowerSearch, lastIndex);
    
    while (index !== -1) {
      // Add text before match
      if (index > lastIndex) {
        parts.push(textStr.substring(lastIndex, index));
      }
      
      // Add highlighted match
      parts.push(
        <mark key={index} className="bg-yellow-200 text-yellow-900 px-0.5 rounded">
          {textStr.substring(index, index + searchTerm.length)}
        </mark>
      );
      
      lastIndex = index + searchTerm.length;
      index = lowerText.indexOf(lowerSearch, lastIndex);
    }
    
    // Add remaining text after last match
    if (lastIndex < textStr.length) {
      parts.push(textStr.substring(lastIndex));
    }
    
    return <>{parts}</>;
  };


  // Memoized filtered cases for better performance
  const filteredCases = useMemo(() => {
    let filtered = cases.filter(caseItem => {
      // Search filter - now searches all metadata
      const matchesSearch = caseMatchesSearch(caseItem, searchTerm);
      
      // Multi-select status filter: if no statuses selected, show all; otherwise show only selected statuses
      const matchesStatus = statusFilter.length === 0 || statusFilter.includes(caseItem.status);
      
      // Filter by QC_Response tab
      const matchesQcResponse = qcResponseTab === 'all' || caseItem.QC_Response === qcResponseTab;
      
      // Filter by creation date range
      const matchesDate = (() => {
        if (!dateFilter || (!dateFilter.from && !dateFilter.to)) return true;
        
        const caseDate = new Date(caseItem.created_at);
        const caseDateOnly = new Date(caseDate.getFullYear(), caseDate.getMonth(), caseDate.getDate());
        
        if (dateFilter.from && dateFilter.to) {
          // Date range: both from and to are set
          const fromDateOnly = new Date(dateFilter.from.getFullYear(), dateFilter.from.getMonth(), dateFilter.from.getDate());
          const toDateOnly = new Date(dateFilter.to.getFullYear(), dateFilter.to.getMonth(), dateFilter.to.getDate());
          return caseDateOnly >= fromDateOnly && caseDateOnly <= toDateOnly;
        } else if (dateFilter.from) {
          // Only from date is set
          const fromDateOnly = new Date(dateFilter.from.getFullYear(), dateFilter.from.getMonth(), dateFilter.from.getDate());
          return caseDateOnly >= fromDateOnly;
        } else if (dateFilter.to) {
          // Only to date is set
          const toDateOnly = new Date(dateFilter.to.getFullYear(), dateFilter.to.getMonth(), dateFilter.to.getDate());
          return caseDateOnly <= toDateOnly;
        }
        return true;
      })();
      
      // Filter by TAT expiry date
      const matchesTatExpiry = (() => {
        if (!tatExpiryFilter || (!tatExpiryFilter.from && !tatExpiryFilter.to)) return true;
        
        const caseDueDate = new Date(caseItem.due_at);
        const caseDueDateOnly = new Date(caseDueDate.getFullYear(), caseDueDate.getMonth(), caseDueDate.getDate());
        
        if (tatExpiryFilter.from && tatExpiryFilter.to) {
          // Date range: both from and to are set
          const fromDateOnly = new Date(tatExpiryFilter.from.getFullYear(), tatExpiryFilter.from.getMonth(), tatExpiryFilter.from.getDate());
          const toDateOnly = new Date(tatExpiryFilter.to.getFullYear(), tatExpiryFilter.to.getMonth(), tatExpiryFilter.to.getDate());
          return caseDueDateOnly >= fromDateOnly && caseDueDateOnly <= toDateOnly;
        } else if (tatExpiryFilter.from) {
          // Only from date is set
          const fromDateOnly = new Date(tatExpiryFilter.from.getFullYear(), tatExpiryFilter.from.getMonth(), tatExpiryFilter.from.getDate());
          return caseDueDateOnly >= fromDateOnly;
        } else if (tatExpiryFilter.to) {
          // Only to date is set
          const toDateOnly = new Date(tatExpiryFilter.to.getFullYear(), tatExpiryFilter.to.getMonth(), tatExpiryFilter.to.getDate());
          return caseDueDateOnly <= toDateOnly;
        }
        return true;
      })();
      
      // Filter by client
      const matchesClient = clientFilter === 'all' || caseItem.client.id === clientFilter;
      
      // Filter by tier
      const matchesTier = tierFilter === 'all' || caseItem.location.pincode_tier === tierFilter;
      
      return matchesSearch && matchesStatus && matchesQcResponse && matchesDate && matchesTatExpiry && matchesClient && matchesTier;
    });

    // Apply sorting
    if (sortBy === 'due_at_asc') {
      filtered = [...filtered].sort((a, b) => {
        const dateA = new Date(a.due_at).getTime();
        const dateB = new Date(b.due_at).getTime();
        return dateA - dateB;
      });
    } else if (sortBy === 'due_at_desc') {
      filtered = [...filtered].sort((a, b) => {
        const dateA = new Date(a.due_at).getTime();
        const dateB = new Date(b.due_at).getTime();
        return dateB - dateA;
      });
    } else {
      // Default: sort by creation date (newest first)
      filtered = [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return filtered;
  }, [cases, searchTerm, statusFilter, dateFilter, tatExpiryFilter, clientFilter, tierFilter, qcResponseTab, sortBy]);

  // Memoized derived data for better performance
  const allocatableCases = useMemo(() => 
    filteredCases.filter(caseItem => 
      (caseItem.status === 'new' || caseItem.status === 'pending_allocation') && !caseItem.current_assignee
    ), [filteredCases]
  );

  const unallocatableSelectedCases = useMemo(() => 
    filteredCases.filter(caseItem => 
      (caseItem.status === 'allocated' || caseItem.status === 'accepted') && 
      caseItem.current_assignee
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
      const isUnallocatable = caseItem && 
        (caseItem.status === 'allocated' || caseItem.status === 'accepted') && 
        caseItem.current_assignee;
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

  // Clear all filters
  const clearAllFilters = () => {
    setStatusFilter([]);
    setClientFilter('all');
    setTierFilter('all');
    setDateFilter(undefined);
    setTatExpiryFilter(undefined);
    setSearchTerm('');
    setQcResponseTab('all');
    setSortBy('none');
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

  const getContractTypeBadge = (contractType: string, searchTerm: string = '') => {
    const typeLabels: Record<string, string> = {
      'residential_address_check': 'Residential',
      'business_address_check': 'Business',
    };
    
    const displayText = typeLabels[contractType] || contractType;
    
    return (
      <Badge variant="outline">
        {highlightText(displayText, searchTerm)}
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
      // Select all allocatable, allocated, and accepted cases on current page
      setSelectedCases(prev => {
        const newSelectedCases = new Set(prev);
        displayCases.forEach(caseItem => {
          if (((caseItem.status === 'new' || caseItem.status === 'pending_allocation') && !caseItem.current_assignee) ||
              ((caseItem.status === 'allocated' || caseItem.status === 'accepted') && caseItem.current_assignee)) {
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
      ((caseItem.status === 'allocated' || caseItem.status === 'accepted') && caseItem.current_assignee)
    );
    return selectableCasesOnPage.length > 0 && 
           selectableCasesOnPage.every(caseItem => selectedCases.has(caseItem.id));
  }, [displayCases, selectedCases]);

  const isSomeCasesSelected = useMemo(() => {
    const selectableCasesOnPage = displayCases.filter(caseItem => 
      ((caseItem.status === 'new' || caseItem.status === 'pending_allocation') && !caseItem.current_assignee) ||
      ((caseItem.status === 'allocated' || caseItem.status === 'accepted') && caseItem.current_assignee)
    );
    return selectableCasesOnPage.some(caseItem => selectedCases.has(caseItem.id));
  }, [displayCases, selectedCases]);

  // Download cases metadata (all cases or filtered cases)
  const handleDownloadFilteredCases = async () => {
    // Determine which cases to download: filtered if filters are active, otherwise all cases
    const casesToDownload = hasActiveFilters ? filteredCases : cases;
    
    if (casesToDownload.length === 0) {
      toast({
        title: 'No Cases to Download',
        description: hasActiveFilters 
          ? 'No cases match the applied filters'
          : 'There are no cases available to download',
        variant: 'destructive',
      });
      return;
    }

    setIsDownloading(true);
    try {
      // Convert cases to CSV
      const csvRows: string[] = [];
      
      // CSV Header
      const headers = [
        'Case Number',
        'Client Case ID',
        'Contract Type',
        'Candidate Name',
        'Phone Primary',
        'Phone Secondary',
        'Status',
        'Client Name',
        'Client Email',
        'Client Contact Person',
        'Client Phone',
        'Address Line',
        'City',
        'State',
        'Pincode',
        'Pincode Tier',
        'Latitude',
        'Longitude',
        'Location URL',
        'Vendor TAT Start Date',
        'Due Date',
        'TAT Hours',
        'Base Rate (INR)',
        'Bonus (INR)',
        'Penalty (INR)',
        'Total Payout (INR)',
        'Created At',
        'Updated At',
        'Created By',
        'Last Updated By',
        'Status Updated At',
        'QC Response',
        'Assigned At',
        'Submitted At',
        'Current Assignee',
        'Assignee Type'
      ];
      csvRows.push(headers.join(','));

      // CSV Rows - use casesToDownload
      casesToDownload.forEach((caseItem) => {
        const metadataStr = (caseItem as any).metadata ? JSON.stringify((caseItem as any).metadata).replace(/"/g, '""') : '';
        const row = [
          `"${caseItem.case_number || ''}"`,
          `"${caseItem.client_case_id || ''}"`,
          `"${caseItem.contract_type || ''}"`,
          `"${caseItem.candidate_name || ''}"`,
          `"${caseItem.phone_primary || ''}"`,
          `"${caseItem.phone_secondary || ''}"`,
          `"${caseItem.status || ''}"`,
          `"${caseItem.client?.name || ''}"`,
          `"${caseItem.client?.email || ''}"`,
          `"${caseItem.client?.contact_person || ''}"`,
          `"${caseItem.client?.phone || ''}"`,
          `"${caseItem.location?.address_line || ''}"`,
          `"${caseItem.location?.city || ''}"`,
          `"${caseItem.location?.state || ''}"`,
          `"${caseItem.location?.pincode || ''}"`,
          `"${caseItem.location?.pincode_tier || ''}"`,
          caseItem.location?.lat || '',
          caseItem.location?.lng || '',
          `"${caseItem.location?.location_url || ''}"`,
          `"${caseItem.vendor_tat_start_date || ''}"`,
          `"${caseItem.due_at || ''}"`,
          caseItem.tat_hours || '',
          caseItem.base_rate_inr || '',
          caseItem.bonus_inr || '',
          caseItem.penalty_inr || '',
          caseItem.total_payout_inr || '',
          `"${caseItem.created_at || ''}"`,
          `"${caseItem.updated_at || ''}"`,
          `"${caseItem.created_by || ''}"`,
          `"${caseItem.last_updated_by || ''}"`,
          `"${caseItem.status_updated_at || ''}"`,
          `"${caseItem.QC_Response || ''}"`,
          `"${caseItem.assigned_at || ''}"`,
          `"${caseItem.submitted_at || ''}"`,
          `"${caseItem.current_assignee?.name || ''}"`,
          `"${caseItem.current_assignee?.type || ''}"`
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const filename = hasActiveFilters 
        ? `filtered_cases_metadata_${timestamp}.csv`
        : `all_cases_metadata_${timestamp}.csv`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Download Complete',
        description: hasActiveFilters
          ? `Downloaded ${casesToDownload.length} filtered case(s) metadata`
          : `Downloaded ${casesToDownload.length} case(s) metadata`,
      });
    } catch (error) {
      console.error('Failed to download cases:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to download cases metadata',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  

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
            <Button 
              variant="outline" 
              onClick={handleDownloadFilteredCases}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {hasActiveFilters ? 'Download Filtered Cases' : 'Download Cases'}
            </Button>
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
        {/* QC Response Tabs */}
        <>
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
        <div className="space-y-4 mb-6">
          {/* Row 1: Search Bar, Status Filter, Both Date Range Filters */}
          <div className="flex gap-2 flex-wrap">
            {/* Search Bar */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search all case metadata..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`pl-10 w-full ${searchTerm ? 'bg-blue-50 border-blue-300 text-blue-700' : ''}`}
              />
            </div>

            {/* Multi-Select Status Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`w-48 justify-start text-left font-normal ${statusFilter.length > 0 ? 'bg-blue-50 border-blue-300 text-blue-700' : ''}`}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  {statusFilter.length === 0 
                    ? 'All Status' 
                    : statusFilter.length === 1
                    ? STATUS_LABELS[statusFilter[0] as keyof typeof STATUS_LABELS] || statusFilter[0]
                    : `${statusFilter.length} Statuses`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3" align="start">
                <div className="space-y-2">
                  <div className="font-medium text-sm mb-2">Filter by Status</div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {Object.entries(STATUS_LABELS).map(([value, label]) => {
                      const isSelected = statusFilter.includes(value);
                      return (
                        <div key={value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`status-${value}`}
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setStatusFilter([...statusFilter, value]);
                              } else {
                                setStatusFilter(statusFilter.filter(s => s !== value));
                              }
                            }}
                          />
                          <label
                            htmlFor={`status-${value}`}
                            className="text-sm font-normal cursor-pointer flex-1"
                          >
                            {label}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                  {statusFilter.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => setStatusFilter([])}
                    >
                      Clear All
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            
            {/* Case Creation Date Range */}
            <div className="flex gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-56 justify-start text-left font-normal ${dateFilter && (dateFilter.from || dateFilter.to) ? 'bg-blue-50 border-blue-300 text-blue-700' : ''}`}
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {dateFilter?.from && dateFilter?.to
                      ? `${format(dateFilter.from, "MMM dd, yyyy")} - ${format(dateFilter.to, "MMM dd, yyyy")}`
                      : dateFilter?.from
                      ? `From ${format(dateFilter.from, "MMM dd, yyyy")}`
                      : dateFilter?.to
                      ? `Until ${format(dateFilter.to, "MMM dd, yyyy")}`
                      : "Case Creation Date Range"}
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
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            {/* TAT Due Date Range */}
            <div className="flex gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-56 justify-start text-left font-normal ${tatExpiryFilter && (tatExpiryFilter.from || tatExpiryFilter.to) ? 'bg-blue-50 border-blue-300 text-blue-700' : ''}`}
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {tatExpiryFilter?.from && tatExpiryFilter?.to
                      ? `${format(tatExpiryFilter.from, "MMM dd, yyyy")} - ${format(tatExpiryFilter.to, "MMM dd, yyyy")}`
                      : tatExpiryFilter?.from
                      ? `From ${format(tatExpiryFilter.from, "MMM dd, yyyy")}`
                      : tatExpiryFilter?.to
                      ? `Until ${format(tatExpiryFilter.to, "MMM dd, yyyy")}`
                      : "TAT Due Date Range"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={tatExpiryFilter ? { from: tatExpiryFilter.from, to: tatExpiryFilter.to } : undefined}
                    onSelect={(range) => {
                      if (range) {
                        setTatExpiryFilter({ from: range.from, to: range.to });
                      } else {
                        setTatExpiryFilter(undefined);
                      }
                    }}
                    numberOfMonths={2}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {tatExpiryFilter && (tatExpiryFilter.from || tatExpiryFilter.to) && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setTatExpiryFilter(undefined)}
                  className="w-10 h-10"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Row 2: Client Filter, Tier Filter, Sorting Filter */}
          <div className="flex gap-2 flex-wrap">
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

            <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'due_at_asc' | 'due_at_desc' | 'none')}>
              <SelectTrigger className={`w-48 ${sortBy !== 'none' ? 'bg-blue-50 border-blue-300 text-blue-700' : ''}`}>
                {sortBy === 'none' && <ArrowUpDown className="h-4 w-4 mr-2" />}
                {sortBy === 'due_at_asc' && <ArrowUp className="h-4 w-4 mr-2" />}
                {sortBy === 'due_at_desc' && <ArrowDown className="h-4 w-4 mr-2" />}
                <SelectValue placeholder="Sort by TAT" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Default (Newest First)</SelectItem>
                <SelectItem value="due_at_asc">TAT Due Date (Ascending)</SelectItem>
                <SelectItem value="due_at_desc">TAT Due Date (Descending)</SelectItem>
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
                          {/* Checkbox for new, pending_allocation, allocated, and accepted status cases */}
                          {(((caseItem.status === 'new' || caseItem.status === 'pending_allocation') && !caseItem.current_assignee) || 
                           ((caseItem.status === 'allocated' || caseItem.status === 'accepted') && caseItem.current_assignee)) && (
                            <Checkbox
                              checked={isCaseSelected(caseItem.id)}
                              onCheckedChange={(checked) => handleSelectCase(caseItem.id, checked as boolean)}
                              className="mt-1"
                            />
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-lg flex items-center gap-2">
                                {highlightText(caseItem.case_number, searchTerm)}
                                {isRecreatedCase(caseItem.case_number) && (
                                  <Badge variant="outline" className="text-xs border-orange-300 text-orange-700 bg-orange-50">
                                    Recreated
                                  </Badge>
                                )}
                              </h3>
                              <Badge className={STATUS_COLORS[caseItem.status]}>
                                {highlightText(STATUS_LABELS[caseItem.status] || caseItem.status, searchTerm)}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {highlightText(caseItem.client_case_id, searchTerm)} • {getContractTypeBadge(caseItem.contract_type, searchTerm)}
                            </p>
                            <h4 className="font-medium text-base mb-1">{highlightText(caseItem.candidate_name, searchTerm)}</h4>
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
                            <p className="font-medium">{highlightText(caseItem.client.name, searchTerm)}</p>
                            <p className="text-xs text-muted-foreground">{highlightText(caseItem.client.email, searchTerm)}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-muted-foreground">Phone</p>
                            <p className="font-medium">{highlightText(caseItem.phone_primary, searchTerm)}</p>
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
                                {highlightText(`${caseItem.location.city}, ${caseItem.location.state}`, searchTerm)}
                              </a>
                            ) : (
                              <p className="font-medium">{highlightText(`${caseItem.location.city}, ${caseItem.location.state}`, searchTerm)}</p>
                            )}
                             <div className="flex items-center gap-2">
                               <span className="text-xs text-muted-foreground">{highlightText(caseItem.location.pincode, searchTerm)}</span>
                               <Badge variant="outline" className="text-xs">
                                 {highlightText(`Tier ${getTierNumber(caseItem.location.pincode_tier)}`, searchTerm)}
                               </Badge>
                             </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-muted-foreground">TAT Hours</p>
                            <p className="font-medium">{highlightText(`${caseItem.tat_hours}h`, searchTerm)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Additional Information */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 text-sm mt-4 pt-4 border-t">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-muted-foreground">Assigned On</p>
                            <p className="font-medium">{highlightText(formatTime(caseItem.assigned_at), searchTerm)}</p>
                            <p className="text-xs text-muted-foreground">
                              {caseItem.assigned_at ? 'Assignment time' : 'Not assigned'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-muted-foreground">Submitted On</p>
                            <p className="font-medium">{highlightText(formatTime(caseItem.submitted_at), searchTerm)}</p>
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
                                ? highlightText(getTimeTaken(caseItem.assigned_at, caseItem.submitted_at), searchTerm)
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
                              {highlightText(format(new Date(caseItem.due_at), 'MMM dd, yyyy'), searchTerm)}
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
                                <p className="font-medium">{highlightText(`₹${caseItem.total_payout_inr.toFixed(2)}`, searchTerm)}</p>
                                {caseItem.bonus_inr && caseItem.bonus_inr > 0 && (
                                  <p className="text-xs text-green-600">{highlightText(`+₹${caseItem.bonus_inr.toFixed(2)} bonus`, searchTerm)}</p>
                                )}
                                {caseItem.penalty_inr && caseItem.penalty_inr > 0 && (
                                  <p className="text-xs text-red-600">{highlightText(`-₹${caseItem.penalty_inr.toFixed(2)} penalty`, searchTerm)}</p>
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
                                {highlightText(caseItem.current_assignee.name, searchTerm)}
                                <span className="text-sm text-muted-foreground ml-2">
                                  ({highlightText(caseItem.current_assignee.type === 'gig' ? 'Gig Worker' : 'Vendor', searchTerm)})
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
