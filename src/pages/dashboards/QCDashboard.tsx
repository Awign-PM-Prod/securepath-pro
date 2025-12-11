import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { UserCheck, FileText, Clock, XCircle, Eye, MapPin, User, Phone, Calendar as CalendarIcon, CheckCircle, XCircle as XCircleIcon, RotateCcw, Search, Filter, Building, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { caseService, Case } from '@/services/caseService';
import { useToast } from '@/hooks/use-toast';
import QCSubmissionReview from '@/components/QC/QCSubmissionReview';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

// CasesList component to render the list of cases
const CasesList = ({ cases, onReviewCase }: { cases: Case[], onReviewCase: (caseItem: Case) => void }) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      submitted: { label: 'Submitted', className: 'bg-yellow-100 text-yellow-800' },
      qc_passed: { label: 'QC Passed', className: 'bg-green-100 text-green-800' },
      qc_rejected: { label: 'QC Rejected', className: 'bg-red-100 text-red-800' },
      qc_rework: { label: 'QC Rework', className: 'bg-orange-100 text-orange-800' },
      reported: { label: 'Reported', className: 'bg-green-100 text-green-800' },
      in_payment_cycle: { label: 'In Payment Cycle', className: 'bg-blue-100 text-blue-800' },
      payment_complete: { label: 'Payment Complete', className: 'bg-green-100 text-green-800' },
      cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-800' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, className: 'bg-gray-100 text-gray-800' };
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.className}`}>
        {config.label}
      </span>
    );
  };


  if (cases.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">No Cases Found</h3>
        <p className="text-muted-foreground">
          There are currently no cases in this category.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {cases.map((caseItem) => (
        <div
          key={caseItem.id}
          className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-semibold text-lg">{caseItem.case_number}</h3>
                {getStatusBadge(caseItem.status)}
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {caseItem.client_case_id} • {caseItem.contract_type}
              </p>
              <h4 className="font-medium text-base mb-1">{caseItem.candidate_name}</h4>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onReviewCase(caseItem)}
            >
              <Eye className="h-4 w-4 mr-2" />
              Review
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Client</p>
                <p className="font-medium">
                  {Array.isArray(caseItem.clients) 
                    ? caseItem.clients[0]?.name 
                    : (caseItem.clients?.name || caseItem.client?.name || 'N/A')}
                </p>
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
                <p className="font-medium">
                  {Array.isArray(caseItem.locations)
                    ? `${caseItem.locations[0]?.city || 'N/A'}, ${caseItem.locations[0]?.state || 'N/A'}`
                    : `${caseItem.locations?.city || caseItem.location?.city || 'N/A'}, ${caseItem.locations?.state || caseItem.location?.state || 'N/A'}`}
                </p>
              </div>
            </div>
          </div>

          {/* Additional QC Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mt-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">TAT Hours</p>
                <p className="font-medium">{caseItem.tat_hours}h</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Assigned On</p>
                <p className="font-medium">{caseItem.assigned_at ? formatDate(caseItem.assigned_at) : 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Submitted</p>
                <p className="font-medium">{formatDate(caseItem.submitted_at)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Time Taken</p>
                <p className="font-medium">{getTimeTaken(caseItem.assigned_at, caseItem.submitted_at)}</p>
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
      ))}
    </div>
  );
};

const STATUS_COLORS = {
  submitted: 'bg-yellow-100 text-yellow-800',
  qc_passed: 'bg-green-100 text-green-800',
  qc_rejected: 'bg-red-100 text-red-800',
  qc_rework: 'bg-orange-100 text-orange-800',
  reported: 'bg-green-100 text-green-800',
  in_payment_cycle: 'bg-blue-100 text-blue-800',
  payment_complete: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const STATUS_LABELS = {
  submitted: 'Submitted',
  qc_passed: 'QC Passed',
  qc_rejected: 'QC Rejected',
  qc_rework: 'QC Rework',
  reported: 'Reported',
  in_payment_cycle: 'In Payment Cycle',
  payment_complete: 'Payment Complete',
  cancelled: 'Cancelled',
};

export default function QCDashboard() {
  const [allCases, setAllCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [contractTypeFilter, setContractTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const [stats, setStats] = useState({
    all: 0,
    approved: 0,
    rejected: 0,
    rework: 0
  });
  const [selectedCaseForReview, setSelectedCaseForReview] = useState<Case | null>(null);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCases, setTotalCases] = useState(0);
  const [isFilterLoading, setIsFilterLoading] = useState(false);
  const { toast } = useToast();

  // Separate state for search input and actual search query
  const [searchQuery, setSearchQuery] = useState('');

  // Load cases when pagination or filters change (including search query)
  useEffect(() => {
    loadAllCases();
    loadStats();
  }, [currentPage, activeTab, statusFilter, clientFilter, contractTypeFilter, dateFilter, searchQuery]);

  // Reset to page 1 when filters or search change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [activeTab, statusFilter, clientFilter, contractTypeFilter, dateFilter, searchQuery]);

  // Handle search button click
  const handleSearch = () => {
    setSearchQuery(searchTerm);
    setCurrentPage(1); // Reset to page 1 when searching
  };

  // Handle Enter key in search input
  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Handle clear search
  const handleClearSearch = () => {
    setSearchTerm('');
    setSearchQuery('');
    setCurrentPage(1);
  };

  // Clear search query when search term becomes empty
  useEffect(() => {
    if (!searchTerm && searchQuery) {
      setSearchQuery('');
      setCurrentPage(1);
    }
  }, [searchTerm, searchQuery]);

  const loadStats = async () => {
    try {
      // Fetch stats separately - count cases by QC_Response
      const cutoffDate = new Date('2025-11-02T00:00:00.000Z');
      
      // Get counts by QC_Response - cases that are submitted or have been QC'd
      const [allResult, approvedResult, rejectedResult, reworkResult] = await Promise.all([
        // All cases that are submitted or have been QC'd
        supabase
          .from('cases')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
          .in('status', ['submitted', 'qc_passed', 'qc_rejected', 'qc_rework'])
          .gte('created_at', cutoffDate.toISOString()),
        // Approved cases
        supabase
          .from('cases')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
          .eq('QC_Response', 'Approved')
          .gte('created_at', cutoffDate.toISOString()),
        // Rejected cases
        supabase
          .from('cases')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
          .eq('QC_Response', 'Rejected')
          .gte('created_at', cutoffDate.toISOString()),
        // Rework cases
        supabase
          .from('cases')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
          .eq('QC_Response', 'Rework')
          .gte('created_at', cutoffDate.toISOString())
      ]);

      const allCount = allResult.count || 0;
      setTotalCases(allCount);
      
      setStats({
        all: allCount,
        approved: approvedResult.count || 0,
        rejected: rejectedResult.count || 0,
        rework: reworkResult.count || 0
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
      // Don't show error toast for stats - it's not critical
    }
  };

  const loadAllCases = async () => {
    try {
      // Only show loading spinner if we don't have any cases yet (initial load)
      // For filter changes, we'll show a subtle loading state
      if (allCases.length === 0) {
        setIsLoading(true);
      }
      const cutoffDate = new Date('2025-11-02T00:00:00.000Z');
      
      // Build query with filters
      let query = supabase
        .from('cases')
        .select(`
          id,
          case_number,
          client_case_id,
          contract_type,
          candidate_name,
          phone_primary,
          phone_secondary,
          status,
          priority,
          vendor_tat_start_date,
          due_at,
          created_at,
          status_updated_at,
          base_rate_inr,
          total_payout_inr,
          "QC_Response",
          submitted_at,
          clients!inner (
            id,
            name,
            contact_person,
            phone,
            email
          ),
          locations!inner (
            id,
            address_line,
            city,
            state,
            pincode,
            location_url
          ),
          form_submissions (
            id,
            updated_at,
            created_at
          ),
          submissions (
            id,
            submitted_at,
            created_at
          )
        `, { count: 'exact' })
        .eq('is_active', true)
        .in('status', ['submitted', 'qc_passed', 'qc_rejected', 'qc_rework'])
        .gte('created_at', cutoffDate.toISOString());

      // Apply QC_Response filter (tab filter)
      if (activeTab === 'approved') {
        query = query.eq('QC_Response', 'Approved');
      } else if (activeTab === 'rejected') {
        query = query.eq('QC_Response', 'Rejected');
      } else if (activeTab === 'rework') {
        query = query.eq('QC_Response', 'Rework');
      }

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      // Apply client filter
      if (clientFilter !== 'all') {
        query = query.eq('client_id', clientFilter);
      }

      // Apply contract type filter
      if (contractTypeFilter !== 'all') {
        query = query.eq('contract_type', contractTypeFilter);
      }

      // Apply date filter
      if (dateFilter) {
        const startOfDay = new Date(dateFilter);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(dateFilter);
        endOfDay.setHours(23, 59, 59, 999);
        query = query
          .gte('submitted_at', startOfDay.toISOString())
          .lte('submitted_at', endOfDay.toISOString());
      }

      // Apply search filter server-side (searches across all cases, not just current page)
      // This searches in case_number, client_case_id, candidate_name, phone_primary, phone_secondary
      // Note: Client name and city will be filtered client-side since they're in related tables
      if (searchQuery) {
        const searchPattern = `%${searchQuery.toLowerCase()}%`;
        // Use Supabase's or() method to search across multiple fields
        // Format: field1.ilike.pattern,field2.ilike.pattern,field3.ilike.pattern
        // Note: Supabase automatically wraps this in parentheses
        query = query.or(`case_number.ilike.${searchPattern},client_case_id.ilike.${searchPattern},candidate_name.ilike.${searchPattern},phone_primary.ilike.${searchPattern},phone_secondary.ilike.${searchPattern}`);
      }

      // Order by submitted_at (most recent first), fallback to created_at
      query = query
        .order('submitted_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      // First, get the total count to ensure we don't request an invalid range
      // We need to clone the query for count since we'll use the original for data
      const countQuery = supabase
        .from('cases')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .in('status', ['submitted', 'qc_passed', 'qc_rejected', 'qc_rework'])
        .gte('created_at', cutoffDate.toISOString());

      // Apply all the same filters to count query
      if (activeTab === 'approved') {
        countQuery.eq('QC_Response', 'Approved');
      } else if (activeTab === 'rejected') {
        countQuery.eq('QC_Response', 'Rejected');
      } else if (activeTab === 'rework') {
        countQuery.eq('QC_Response', 'Rework');
      }
      if (statusFilter !== 'all') {
        countQuery.eq('status', statusFilter);
      }
      if (clientFilter !== 'all') {
        countQuery.eq('client_id', clientFilter);
      }
      if (contractTypeFilter !== 'all') {
        countQuery.eq('contract_type', contractTypeFilter);
      }
      if (dateFilter) {
        const startOfDay = new Date(dateFilter);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(dateFilter);
        endOfDay.setHours(23, 59, 59, 999);
        countQuery
          .gte('submitted_at', startOfDay.toISOString())
          .lte('submitted_at', endOfDay.toISOString());
      }
      if (searchQuery) {
        const searchPattern = `%${searchQuery.toLowerCase()}%`;
        countQuery.or(`case_number.ilike.${searchPattern},client_case_id.ilike.${searchPattern},candidate_name.ilike.${searchPattern},phone_primary.ilike.${searchPattern},phone_secondary.ilike.${searchPattern}`);
      }

      const { count: totalCount } = await countQuery;
      
      // Calculate pagination with bounds checking
      const maxPage = totalCount ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1;
      const safePage = Math.min(currentPage, maxPage);
      const from = (safePage - 1) * pageSize;
      const to = Math.min(from + pageSize - 1, Math.max(0, (totalCount || 1) - 1));

      // If current page is beyond available pages, reset to page 1
      if (currentPage > maxPage && maxPage > 0) {
        setCurrentPage(1);
        // Use page 1 range
        query = query.range(0, pageSize - 1);
      } else {
        query = query.range(from, to);
      }

      const { data: cases, error, count } = await query;

      if (error) {
        throw error;
      }

      // Transform data structure to match expected format
      // Supabase returns relationships as objects/arrays, we need to normalize them
      const transformedCases = (cases || []).map(c => {
        // Normalize clients - handle both array and object formats
        const client = Array.isArray(c.clients) ? c.clients[0] : c.clients;
        
        // Normalize locations - handle both array and object formats
        const location = Array.isArray(c.locations) ? c.locations[0] : c.locations;
        
        return {
          ...c,
          client: client || c.client, // Fallback to c.client if exists
          location: location || c.location, // Fallback to c.location if exists
          clients: client, // Keep for backward compatibility
          locations: location // Keep for backward compatibility
        };
      });

      // Don't apply search filter here - it will be applied in getFilteredCases()
      // This allows search to work on the current page without server reload
      setAllCases(transformedCases);
      setTotalCases(count || 0);
    } catch (error) {
      console.error('Failed to load cases:', error);
      toast({
        title: 'Error',
        description: 'Failed to load cases. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsFilterLoading(false);
    }
  };

  // Filter cases based on active tab and filters
  const getFilteredCases = () => {
    let filtered = [...allCases];

    // Apply search filter client-side for related fields and other metadata
    // Direct fields (case_number, client_case_id, candidate_name, phone) are already filtered server-side
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter(c => {
        const clientName = c.client?.name || c.clients?.name || (Array.isArray(c.clients) ? c.clients[0]?.name : '');
        const city = c.location?.city || c.locations?.city || (Array.isArray(c.locations) ? c.locations[0]?.city : '');
        const state = c.location?.state || c.locations?.state || (Array.isArray(c.locations) ? c.locations[0]?.state : '');
        const pincode = c.location?.pincode || c.locations?.pincode || (Array.isArray(c.locations) ? c.locations[0]?.pincode : '');
        const address = c.location?.address_line || c.locations?.address_line || (Array.isArray(c.locations) ? c.locations[0]?.address_line : '');
        const contractType = c.contract_type || '';
        const status = c.status || '';
        const qcResponse = c.QC_Response || '';
        
        // Check if it matches related fields and other metadata shown on the card
        return (
          clientName?.toLowerCase().includes(searchLower) ||
          city?.toLowerCase().includes(searchLower) ||
          state?.toLowerCase().includes(searchLower) ||
          pincode?.toLowerCase().includes(searchLower) ||
          address?.toLowerCase().includes(searchLower) ||
          contractType?.toLowerCase().includes(searchLower) ||
          status?.toLowerCase().includes(searchLower) ||
          qcResponse?.toLowerCase().includes(searchLower) ||
          c.base_rate_inr?.toString().includes(searchLower) ||
          c.total_payout_inr?.toString().includes(searchLower) ||
          c.priority?.toLowerCase().includes(searchLower)
        );
      });
    }

    return filtered;
  };


  const handleReviewCase = (caseItem: Case) => {
    setSelectedCaseForReview(caseItem);
    setIsReviewDialogOpen(true);
  };

  const handleReviewComplete = () => {
    // Refresh the cases list and stats after QC action
    loadAllCases();
    loadStats();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">All Cases</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.all}</div>
            <p className="text-xs text-muted-foreground">Total cases</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            <p className="text-xs text-muted-foreground">QC approved cases</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircleIcon className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            <p className="text-xs text-muted-foreground">QC rejected cases</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rework</CardTitle>
            <RotateCcw className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.rework}</div>
            <p className="text-xs text-muted-foreground">Cases for rework</p>
          </CardContent>
        </Card>
      </div>

      {/* Cases List with Tabs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Quality Control Cases</CardTitle>
              <CardDescription>
                Review and manage cases based on their QC response status
              </CardDescription>
            </div>
            <Button onClick={() => { loadAllCases(); loadStats(); }} variant="outline" size="sm">
              <Clock className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                All ({stats.all})
              </TabsTrigger>
              <TabsTrigger value="approved" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Approved ({stats.approved})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="flex items-center gap-2">
                <XCircleIcon className="h-4 w-4" />
                Rejected ({stats.rejected})
              </TabsTrigger>
              <TabsTrigger value="rework" className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4" />
                Rework ({stats.rework})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-6">
              {/* Search and Filter Controls */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1 max-w-md">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search cases..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyPress={handleSearchKeyPress}
                      className={`pl-10 ${searchTerm ? 'pr-20' : 'pr-10'}`}
                    />
                    {searchTerm && (
                      <>
                        <button
                          onClick={handleSearch}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-primary hover:text-primary/80 p-1 rounded hover:bg-primary/10 transition-colors"
                          type="button"
                          title="Search"
                        >
                          <Search className="h-4 w-4" />
                        </button>
                        <button
                          onClick={handleClearSearch}
                          className="absolute right-10 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors"
                          type="button"
                          title="Clear"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
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

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-48 justify-start text-left font-normal"
                      >
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        {dateFilter ? format(dateFilter, "PPP") : "Submission Date"}
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

                  <Select value={clientFilter} onValueChange={setClientFilter}>
                    <SelectTrigger className="w-48">
                      <Building className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clients</SelectItem>
                      {Array.from(new Set(allCases
                        .map(c => c.client?.id || c.clients?.id)
                        .filter(id => id !== undefined && id !== null)
                      )).map(clientId => {
                        const client = allCases.find(c => 
                          (c.client?.id || c.clients?.id) === clientId
                        );
                        const clientData = client?.client || client?.clients;
                        return (
                          <SelectItem key={clientId} value={clientId}>
                            {clientData?.name || 'Unknown Client'}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>

                  <Select value={contractTypeFilter} onValueChange={setContractTypeFilter}>
                    <SelectTrigger className="w-48">
                      <FileText className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="residential_address_check">Residential</SelectItem>
                      <SelectItem value="business_address_check">Business</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isFilterLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <span className="ml-2 text-sm text-muted-foreground">Loading cases...</span>
                </div>
              ) : (
                <CasesList cases={getFilteredCases()} onReviewCase={handleReviewCase} />
              )}
            </TabsContent>

            <TabsContent value="approved" className="mt-6">
              {isFilterLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <span className="ml-2 text-sm text-muted-foreground">Loading cases...</span>
                </div>
              ) : (
                <CasesList cases={getFilteredCases()} onReviewCase={handleReviewCase} />
              )}
            </TabsContent>

            <TabsContent value="rejected" className="mt-6">
              {isFilterLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <span className="ml-2 text-sm text-muted-foreground">Loading cases...</span>
                </div>
              ) : (
                <CasesList cases={getFilteredCases()} onReviewCase={handleReviewCase} />
              )}
            </TabsContent>

            <TabsContent value="rework" className="mt-6">
              {isFilterLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <span className="ml-2 text-sm text-muted-foreground">Loading cases...</span>
                </div>
              ) : (
                <CasesList cases={getFilteredCases()} onReviewCase={handleReviewCase} />
              )}
            </TabsContent>
          </Tabs>

          {/* Pagination */}
          {totalCases > pageSize && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCases)} of {totalCases} cases
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
                  {Array.from({ length: Math.min(5, Math.ceil(totalCases / pageSize)) }, (_, i) => {
                    const totalPages = Math.ceil(totalCases / pageSize);
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
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(totalCases / pageSize)))}
                  disabled={currentPage >= Math.ceil(totalCases / pageSize)}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* QC Submission Review Dialog */}
      {selectedCaseForReview && (
        <QCSubmissionReview
          caseId={selectedCaseForReview.id}
          caseNumber={selectedCaseForReview.case_number}
          candidateName={selectedCaseForReview.candidate_name}
          isOpen={isReviewDialogOpen}
          onClose={() => {
            setIsReviewDialogOpen(false);
            setSelectedCaseForReview(null);
          }}
          onActionComplete={handleReviewComplete}
        />
      )}
    </div>
  );
}