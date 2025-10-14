import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MoreHorizontal, Search, Filter, Plus, Eye, Edit, Trash2, MapPin, Clock, User, Building, Zap, Users, CheckCircle, XCircle, AlertCircle, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { allocationService } from '@/services/allocationService';
import { allocationSummaryService, AllocationSummaryData } from '@/services/allocationSummaryService';
import AllocationSummary from '@/components/Allocation/AllocationSummary';
import CSVManagement from './CSVManagement';
import { supabase } from '@/integrations/supabase/client';

interface Case {
  id: string;
  case_number: string;
  client_case_id: string;
  contract_type: string;
  candidate_name: string;
  phone_primary: string;
  phone_secondary?: string;
  status: 'created' | 'auto_allocated' | 'pending_acceptance' | 'accepted' | 'in_progress' | 'submitted' | 'qc_pending' | 'qc_passed' | 'qc_rejected' | 'qc_rework' | 'completed' | 'reported' | 'in_payment_cycle' | 'cancelled';
  client: {
    id: string;
    name: string;
    email: string;
  };
  location: {
    address_line: string;
    city: string;
    state: string;
    pincode: string;
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
  base_rate_inr?: number;
  bonus_inr?: number;
  penalty_inr?: number;
  total_payout_inr?: number;
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
  created: 'bg-gray-100 text-gray-800',
  auto_allocated: 'bg-blue-100 text-blue-800',
  pending_acceptance: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-green-100 text-green-800',
  in_progress: 'bg-blue-100 text-blue-800',
  submitted: 'bg-purple-100 text-purple-800',
  qc_pending: 'bg-orange-100 text-orange-800',
  qc_passed: 'bg-green-100 text-green-800',
  qc_rejected: 'bg-red-100 text-red-800',
  qc_rework: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  reported: 'bg-green-100 text-green-800',
  in_payment_cycle: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const STATUS_LABELS = {
  created: 'Created',
  auto_allocated: 'Auto Allocated',
  pending_acceptance: 'Pending Acceptance',
  accepted: 'Accepted',
  in_progress: 'In Progress',
  submitted: 'Submitted',
  qc_pending: 'QC Pending',
  qc_passed: 'QC Passed',
  qc_rejected: 'QC Rejected',
  qc_rework: 'QC Rework',
  completed: 'Completed',
  reported: 'Reported',
  in_payment_cycle: 'In Payment Cycle',
  cancelled: 'Cancelled',
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
  const [selectedCases, setSelectedCases] = useState<Set<string>>(new Set());
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
  const { toast } = useToast();

  const filteredCases = cases.filter(caseItem => {
    const matchesSearch = 
      caseItem.case_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      caseItem.client_case_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      caseItem.candidate_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      caseItem.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      caseItem.location.city.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || caseItem.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Filter cases that can be allocated (created status, no assignee)
  const allocatableCases = filteredCases.filter(caseItem => 
    caseItem.status === 'created' && !caseItem.current_assignee
  );

  // Filter cases that can be unallocated (allocated status, has assignee)
  const unallocatableCases = filteredCases.filter(caseItem => 
    (caseItem.status === 'auto_allocated' || caseItem.status === 'accepted' || caseItem.status === 'in_progress') && 
    caseItem.current_assignee
  );

  // Show all cases for selection, but highlight different types
  const displayCases = filteredCases;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Select all cases that can be either allocated or unallocated
      const selectableCases = [...allocatableCases, ...unallocatableCases];
      setSelectedCases(new Set(selectableCases.map(c => c.id)));
    } else {
      setSelectedCases(new Set());
    }
  };

  const handleSelectCase = (caseId: string, checked: boolean) => {
    const newSelected = new Set(selectedCases);
    if (checked) {
      newSelected.add(caseId);
    } else {
      newSelected.delete(caseId);
    }
    setSelectedCases(newSelected);
  };

  const handleAllocationModeSelect = (mode: 'auto' | 'manual') => {
    setAllocationMode(mode);
    setIsAllocationDialogOpen(true);
  };

  const handleAutoAllocate = async () => {
    if (selectedAllocatableCases.length === 0) {
      toast({
        title: 'No Allocatable Cases Selected',
        description: 'Please select unallocated cases to allocate',
        variant: 'destructive',
      });
      return;
    }

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
      toast({
        title: 'Allocation Failed',
        description: 'An error occurred during allocation',
        variant: 'destructive',
      });
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
          profiles (
            first_name,
            last_name
          ),
          performance_metrics (
            quality_score,
            completion_rate,
            ontime_completion_rate,
            acceptance_rate
          )
        `)
        .eq('is_active', true)
        .eq('is_available', true)
        .gt('capacity_available', 0)
        .order('capacity_available', { ascending: false });

      if (gigError) throw gigError;

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

      setAvailableGigWorkers(gigWorkers || []);
      setAvailableVendors(vendors || []);
      setIsManualAllocationDialogOpen(true);
      setIsAllocationDialogOpen(false);
    } catch (error) {
      console.error('Failed to load allocation options:', error);
      toast({
        title: 'Error',
        description: 'Failed to load available allocation options',
        variant: 'destructive',
      });
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

      // Allocate each selected case to the chosen gig worker or vendor
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
      toast({
        title: 'Allocation Failed',
        description: 'Failed to complete manual allocation',
        variant: 'destructive',
      });
    } finally {
      setIsAllocating(false);
    }
  };

  const handleUnallocate = () => {
    if (selectedUnallocatableCases.length === 0) {
      toast({
        title: 'No Unallocatable Cases Selected',
        description: 'Please select allocated cases to unallocate',
        variant: 'destructive',
      });
      return;
    }
    setIsUnallocationDialogOpen(true);
  };

  const handleConfirmUnallocate = async () => {
    if (selectedUnallocatableCases.length === 0) return;

    setIsUnallocating(true);
    try {
      const results = await allocationService.unallocateCases(selectedUnallocatableCases, unallocationReason);

      toast({
        title: 'Unallocation Complete',
        description: `Successfully unallocated ${results.successful} cases. ${results.failed > 0 ? `${results.failed} failed.` : ''}`,
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
      toast({
        title: 'Unallocation Failed',
        description: 'An error occurred during unallocation',
        variant: 'destructive',
      });
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

  const selectableCases = [...allocatableCases, ...unallocatableCases];
  const isAllSelected = selectableCases.length > 0 && selectedCases.size === selectableCases.length;
  const isPartiallySelected = selectedCases.size > 0 && selectedCases.size < selectableCases.length;

  // Determine what actions are available based on selected cases
  const selectedCasesList = Array.from(selectedCases);
  const selectedAllocatableCases = selectedCasesList.filter(id => 
    allocatableCases.some(c => c.id === id)
  );
  const selectedUnallocatableCases = selectedCasesList.filter(id => 
    unallocatableCases.some(c => c.id === id)
  );
  
  const canAllocate = selectedAllocatableCases.length > 0;
  const canUnallocate = selectedUnallocatableCases.length > 0;

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
          <Button onClick={onCreateCase}>
            <Plus className="h-4 w-4 mr-2" />
            Create Case
          </Button>
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
            {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search cases..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex gap-2">
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
          </div>
        </div>

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

        {/* Allocation Controls */}
        {selectableCases.length > 0 && (
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg mb-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="select-all"
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isPartiallySelected;
                  }}
                  onCheckedChange={handleSelectAll}
                />
                <label htmlFor="select-all" className="text-sm font-medium">
                  Select All ({selectableCases.length} available)
                </label>
              </div>
              <span className="text-sm text-muted-foreground">
                {selectedCases.size} selected
              </span>
            </div>
            <div className="flex gap-2">
              {canAllocate && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handleAllocationModeSelect('auto')}
                    className="flex items-center gap-2"
                  >
                    <Zap className="h-4 w-4" />
                    Auto Allocate ({selectedAllocatableCases.length})
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleAllocationModeSelect('manual')}
                    className="flex items-center gap-2"
                  >
                    <Users className="h-4 w-4" />
                    Manual Allocate ({selectedAllocatableCases.length})
                  </Button>
                </>
              )}
              {canUnallocate && (
                <Button
                  variant="outline"
                  onClick={handleUnallocate}
                  className="flex items-center gap-2 text-orange-600 hover:text-orange-700"
                >
                  <XCircle className="h-4 w-4" />
                  Unallocate ({selectedUnallocatableCases.length})
                </Button>
              )}
              {!canAllocate && !canUnallocate && selectedCases.size > 0 && (
                <span className="text-sm text-muted-foreground flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Selected cases cannot be allocated or unallocated
                </span>
              )}
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isPartiallySelected;
                      }}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Case #</TableHead>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Contract Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Payout</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayCases.map((caseItem) => {
                  const isAllocatable = caseItem.status === 'created' && !caseItem.current_assignee;
                  const isUnallocatable = (caseItem.status === 'auto_allocated' || caseItem.status === 'accepted' || caseItem.status === 'in_progress') && caseItem.current_assignee;
                  const isSelectable = isAllocatable || isUnallocatable;
                  const isSelected = selectedCases.has(caseItem.id);
                  
                  return (
                    <TableRow 
                      key={caseItem.id} 
                      className={`hover:bg-muted/50 ${isSelected ? 'bg-blue-50' : ''} ${!isSelectable ? 'opacity-60' : ''}`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleSelectCase(caseItem.id, checked as boolean)}
                          disabled={!isSelectable}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>
                          <div className="font-semibold">{caseItem.case_number}</div>
                          <div className="text-sm text-muted-foreground">Client ID: {caseItem.client_case_id}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          <p className="font-medium truncate">{caseItem.candidate_name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {caseItem.phone_primary}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{caseItem.client.name}</p>
                            <p className="text-sm text-muted-foreground">{caseItem.client.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getContractTypeBadge(caseItem.contract_type)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{caseItem.location.city}, {caseItem.location.state}</p>
                            <p className="text-sm text-muted-foreground">{caseItem.location.pincode}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(caseItem.status)}
                      </TableCell>
                      <TableCell>
                        {caseItem.current_assignee ? (
                          <div>
                            <p className="font-medium">{caseItem.current_assignee.name}</p>
                            <p className="text-sm text-muted-foreground capitalize">
                              {caseItem.current_assignee.type}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className={`font-medium ${isOverdue(caseItem.due_at) ? 'text-red-600' : ''}`}>
                              {format(new Date(caseItem.due_at), 'MMM dd, yyyy')}
                            </p>
                            <p className={`text-sm ${isOverdue(caseItem.due_at) ? 'text-red-500' : 'text-muted-foreground'}`}>
                              {isOverdue(caseItem.due_at) 
                                ? 'Overdue' 
                                : `${getDaysUntilDue(caseItem.due_at)} days left`
                              }
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {caseItem.total_payout_inr ? (
                          <div>
                            <p className="font-medium">₹{caseItem.total_payout_inr.toFixed(2)}</p>
                            {caseItem.bonus_inr && caseItem.bonus_inr > 0 && (
                              <p className="text-sm text-green-600">+₹{caseItem.bonus_inr.toFixed(2)} bonus</p>
                            )}
                            {caseItem.penalty_inr && caseItem.penalty_inr > 0 && (
                              <p className="text-sm text-red-600">-₹{caseItem.penalty_inr.toFixed(2)} penalty</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not calculated</span>
                        )}
                      </TableCell>
                      <TableCell>
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
                            {caseItem.current_assignee && (
                              <DropdownMenuItem 
                                onClick={() => {
                                  setSelectedCases(new Set([caseItem.id]));
                                  handleUnallocate();
                                }}
                                className="text-orange-600"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Unallocate
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              onClick={() => onDeleteCase(caseItem.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
                  ? `Allocate ${selectedCases.size} selected cases automatically using the allocation engine.`
                  : `Manually assign ${selectedCases.size} selected cases to specific gig workers.`
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
                This will remove assignments from {selectedUnallocatableCases.length} case{selectedUnallocatableCases.length !== 1 ? 's' : ''} and change their status to 'Created'.
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
                    Unallocate {selectedUnallocatableCases.length} Case{selectedUnallocatableCases.length !== 1 ? 's' : ''}
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
                Select allocation type and assignee to manually assign {selectedAllocatableCases.length} case{selectedAllocatableCases.length !== 1 ? 's' : ''}.
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
                                  {worker.performance_metrics && (
                                    <span>Quality: {Math.round(worker.performance_metrics.quality_score * 100)}%</span>
                                  )}
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
                            {worker.performance_metrics && (
                              <>
                                <div>
                                  <span className="font-medium">Quality Score:</span> {Math.round(worker.performance_metrics.quality_score * 100)}%
                                </div>
                                <div>
                                  <span className="font-medium">Completion Rate:</span> {Math.round(worker.performance_metrics.completion_rate * 100)}%
                                </div>
                                <div>
                                  <span className="font-medium">On-time Rate:</span> {Math.round(worker.performance_metrics.ontime_completion_rate * 100)}%
                                </div>
                                <div>
                                  <span className="font-medium">Acceptance Rate:</span> {Math.round(worker.performance_metrics.acceptance_rate * 100)}%
                                </div>
                              </>
                            )}
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
      </CardContent>
    </Card>
  );
}
