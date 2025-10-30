import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format, differenceInMinutes } from 'date-fns';
import { allocationService } from '@/services/allocationService';
import VendorAssociationBadge from '@/components/VendorAssociationBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { isRecreatedCase } from '@/utils/caseUtils';
import { 
  Users, 
  Briefcase, 
  TrendingUp, 
  Clock, 
  MapPin, 
  Phone, 
  Mail,
  CheckCircle,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Plus,
  Eye,
  UserCheck,
  ArrowRightLeft,
  Loader2,
  Building,
  Calendar,
  UserPlus,
  FileText,
  User
} from 'lucide-react';
import DynamicFormSubmission from '@/components/CaseManagement/DynamicFormSubmission';

interface GigWorker {
  id: string;
  profile_id: string;
  vendor_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  first_name: string;
  last_name: string;
  email: string;
  vendor_name?: string;
  // Additional properties with default values
  phone?: string;
  city?: string;
  state?: string;
  is_available?: boolean;
  capacity_available?: number;
  max_daily_capacity?: number;
  quality_score?: number;
  completion_rate?: number;
  is_direct_gig?: boolean;
}

interface Case {
  id: string;
  case_number: string;
  title: string;
  description: string;
  priority: string;
  client_id: string;
  location_id: string;
  tat_hours: number;
  due_at: string;
  created_at: string;
  current_assignee_id?: string;
  current_assignee_type?: string;
  current_vendor_id: string;
  status: string;
  status_updated_at: string;
  base_rate_inr: number;
  total_rate_inr: number;
  created_by: string;
  updated_at: string;
  acceptance_deadline?: string;
  metadata?: any;
  client_name: string;
  client_email: string;
  address_line: string;
  city: string;
  state: string;
  pincode: string;
  // New fields for QC dashboard
  assigned_at?: string;
  submitted_at?: string;
  QC_Response?: string;
}

const VendorDashboard: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Helper functions for time calculations
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
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
  
  // State
  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [gigWorkers, setGigWorkers] = useState<GigWorker[]>([]);
  const [assignedCases, setAssignedCases] = useState<Case[]>([]);
  const [pendingCases, setPendingCases] = useState<Case[]>([]);
  const [inProgressCases, setInProgressCases] = useState<Case[]>([]);
  const [unassignedCases, setUnassignedCases] = useState<Case[]>([]);
  const [reworkCases, setReworkCases] = useState<Case[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  
  // Assignment dialog state
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<string>('');
  const [selectedGigWorker, setSelectedGigWorker] = useState<string>('');
  const [reassignmentDialogOpen, setReassignmentDialogOpen] = useState(false);
  const [reassignCaseId, setReassignCaseId] = useState<string>('');
  
  // Case selection state for allocation
  const [selectedCases, setSelectedCases] = useState<Set<string>>(new Set());
  const [bulkAssignmentDialogOpen, setBulkAssignmentDialogOpen] = useState(false);
  
  // View case dialog state
  const [viewCaseDialogOpen, setViewCaseDialogOpen] = useState(false);
  const [viewingCase, setViewingCase] = useState<Case | null>(null);
  const [qcReviewData, setQcReviewData] = useState<any>(null);
  const [viewSubmissionDialogOpen, setViewSubmissionDialogOpen] = useState(false);

  // Fetch vendor ID
  const fetchVendorId = async () => {
    try {
      console.log('Fetching vendor ID for user:', user?.id);
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, role')
        .eq('user_id', user?.id)
        .single();

      if (profileError) throw profileError;
      if (!profile) {
        console.error('No profile found for user');
        setVendorId(null);
        return;
      }
      console.log('Found profile:', profile);

      const { data, error } = await supabase
        .from('vendors')
        .select('id, name, email')
        .eq('profile_id', profile.id)
        .single();

      if (error) throw error;
      console.log('Found vendor:', data);
      setVendorId(data?.id || null);
    } catch (error) {
      console.error('Error fetching vendor ID:', error);
      setVendorId(null);
    }
  };

  // Fetch gig workers
  const fetchGigWorkers = async () => {
    console.log('fetchGigWorkers called with vendorId:', vendorId);
    if (!vendorId) {
      console.log('No vendorId, setting empty gig workers');
      setGigWorkers([]);
      return;
    }

    try {
      console.log('Fetching gig workers for vendor:', vendorId);
      const { data, error } = await supabase
        .from('gig_partners')
        .select(`
          id,
          profile_id,
          vendor_id,
          created_by,
          created_at,
          updated_at,
          profiles!inner(first_name, last_name, email)
        `)
        .eq('vendor_id', vendorId);

      if (error) {
        console.error('Supabase query error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        throw error;
      }
      
      const gigWorkers = (data || []).map(worker => ({
        ...worker,
        first_name: worker.profiles?.first_name || '',
        last_name: worker.profiles?.last_name || '',
        email: worker.profiles?.email || '',
        phone: '',
        city: '',
        state: '',
        is_available: true,
        capacity_available: 1,
        max_daily_capacity: 1,
        quality_score: 0,
        completion_rate: 0,
        is_direct_gig: false
      }));
      
      console.log('Gig workers fetched:', gigWorkers);
      console.log('Number of gig workers:', gigWorkers.length);
      setGigWorkers(gigWorkers);
    } catch (error) {
      console.error('Error fetching gig workers:', error);
      const { getErrorToast } = await import('@/utils/errorMessages');
      toast(getErrorToast(error));
    }
  };

  // Fetch assigned cases
  const fetchAssignedCases = async () => {
    if (!vendorId) {
      setAssignedCases([]);
      setPendingCases([]);
      setInProgressCases([]);
      setUnassignedCases([]);
      return;
    }

    try {
      // Fetch cases allocated to this vendor
      const { data: allocatedData, error: allocatedError } = await supabase
        .from('cases')
        .select(`
          id,
          case_number,
          title,
          description,
          priority,
          client_id,
          location_id,
          tat_hours,
          due_at,
          created_at,
          current_assignee_id,
          current_assignee_type,
          current_vendor_id,
          status,
          status_updated_at,
          base_rate_inr,
          total_rate_inr,
          created_by,
          updated_at,
          clients(id, name, contact_person, phone, email),
          locations(id, address_line, city, state, pincode)
        `)
        .eq('current_vendor_id', vendorId)
        .eq('status', 'allocated' as any);

      if (allocatedError) {
        console.error('Error fetching allocated cases:', allocatedError);
        throw allocatedError;
      }

      // Fetch accepted cases for unassigned section
      const { data: acceptedData, error: acceptedError } = await supabase
        .from('cases')
        .select(`
          id,
          case_number,
          title,
          description,
          priority,
          client_id,
          location_id,
          tat_hours,
          due_at,
          created_at,
          current_assignee_id,
          current_assignee_type,
          current_vendor_id,
          status,
          status_updated_at,
          base_rate_inr,
          total_rate_inr,
          created_by,
          updated_at,
          clients(id, name, contact_person, phone, email),
          locations(id, address_line, city, state, pincode)
        `)
        .eq('current_vendor_id', vendorId)
        .eq('status', 'accepted');

      if (acceptedError) {
        console.error('Error fetching accepted cases:', acceptedError);
        throw acceptedError;
      }
      
      // Combine both datasets
      const allCases = [...(allocatedData || []), ...(acceptedData || [])];

      // Filter: only show cases created today and after today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const filteredCases = allCases.filter(caseItem => {
        const caseCreatedDate = new Date(caseItem.created_at);
        return caseCreatedDate >= today;
      });

      // Resolve client names using client_id in case relational payload is missing
      const uniqueClientIds = Array.from(new Set(filteredCases.map((c: any) => c.client_id).filter(Boolean)));
      console.log('Unique client IDs to fetch:', uniqueClientIds);
      let clientIdToName: Record<string, string> = {};
      if (uniqueClientIds.length > 0) {
        const { data: clientRows, error: clientError } = await supabase
          .from('clients')
          .select('id, name')
          .in('id', uniqueClientIds);
        
        if (clientError) {
          console.error('Error fetching clients:', clientError);
        } else {
          console.log('Client rows fetched from database:', clientRows);
          (clientRows || []).forEach((row: any) => {
            clientIdToName[row.id] = row.name;
          });
          console.log('Mapped client IDs to names:', clientIdToName);
        }
      } else {
        console.warn('No unique client IDs found to fetch');
      }
      
      console.log('Raw allocated cases data:', allocatedData);
      console.log('Raw accepted cases data:', acceptedData);
      console.log('Total cases after filter:', filteredCases.length);
      
      const cases = filteredCases.map(c => {
        const clientName = c.clients?.name || clientIdToName[c.client_id] || '';
        if (!clientName && c.client_id) {
          console.warn(`Client name not found for client_id: ${c.client_id}, available clients:`, clientIdToName);
        }
        return {
          ...c,
          address_line: c.locations?.address_line || '',
          city: c.locations?.city || '',
          state: c.locations?.state || '',
          pincode: c.locations?.pincode || '',
          client_name: clientName,
          client_email: c.clients?.email || ''
        };
      });
      
      console.log('Processed all cases:', cases);
      setAssignedCases(cases);
      
      // Categorize cases by status
      // Pending shows only 'allocated' cases for this vendor (not yet accepted)
      const pending = cases.filter(c => c.status === 'allocated' && c.current_vendor_id === vendorId);
      // Unassigned shows 'accepted' cases with current_assignee_type as 'vendor'
      const unassigned = cases.filter(c => c.status === 'accepted' && c.current_assignee_type === 'vendor' && c.current_vendor_id === vendorId);
      // In progress shows 'accepted' cases with current_assignee_type as 'gig'
      const inProgress = cases.filter(c => c.status === 'accepted' && c.current_assignee_type === 'gig' && c.current_vendor_id === vendorId);
      
      // Debug logging
      console.log('All cases for vendor:', cases.map(c => ({
        id: c.id,
        case_number: c.case_number,
        status: c.status,
        current_vendor_id: c.current_vendor_id,
        current_assignee_id: c.current_assignee_id,
        current_assignee_type: c.current_assignee_type
      })));
      
      console.log('Pending cases (allocated to vendor):', pending);
      console.log('In progress cases (accepted with gig worker):', inProgress);
      console.log('Unassigned cases (accepted with vendor assignee):', unassigned);
      
      setPendingCases(pending);
      setInProgressCases(inProgress);
      setUnassignedCases(unassigned);
      
    } catch (error) {
      console.error('Error fetching cases:', error);
      const { getErrorToast } = await import('@/utils/errorMessages');
      toast(getErrorToast(error));
    }
  };

  // Accept case (for allocated cases)
  const handleAcceptCase = async (caseId: string) => {
    try {
      const { error } = await supabase
        .from('cases')
        .update({
          status: 'accepted',
          status_updated_at: new Date().toISOString(),
          last_updated_by: user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', caseId)
        .eq('current_vendor_id', vendorId)
        .eq('status', 'allocated');

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Case accepted successfully',
      });

      fetchAssignedCases();
    } catch (error) {
      console.error('Error accepting case:', error);
      const { getErrorToast } = await import('@/utils/errorMessages');
      toast(getErrorToast(error));
    }
  };

  // Reject case (for allocated cases)
  const handleRejectCase = async (caseId: string) => {
    try {
      const { error } = await supabase
        .from('cases')
        .update({
          status: 'new',
          current_vendor_id: null,
          current_assignee_id: null,
          current_assignee_type: null,
          status_updated_at: new Date().toISOString(),
          last_updated_by: user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', caseId)
        .eq('current_vendor_id', vendorId)
        .eq('status', 'allocated');

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Case rejected and returned to allocation pool',
      });

      fetchAssignedCases();
    } catch (error) {
      console.error('Error rejecting case:', error);
      const { getErrorToast } = await import('@/utils/errorMessages');
      toast(getErrorToast(error));
    }
  };

  // Pick up case (for new cases)
  const handlePickUpCase = async (caseId: string) => {
    try {
      const { error } = await supabase
        .from('cases')
        .update({
          current_vendor_id: vendorId,
          current_assignee_id: vendorId,
          current_assignee_type: 'vendor',
          status: 'accepted',
          status_updated_at: new Date().toISOString(),
          last_updated_by: user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', caseId);

      if (error) {
        console.error('Error picking up case:', error);
        throw error;
      }

      toast({
        title: 'Success',
        description: 'Case picked up successfully',
      });

      // Refresh the cases
      fetchAssignedCases();
    } catch (error) {
      console.error('Error picking up case:', error);
      const { getErrorToast } = await import('@/utils/errorMessages');
      toast(getErrorToast(error));
    }
  };


  // Handle case selection for allocation
  const handleCaseSelection = (caseId: string) => {
    setSelectedCases(prev => {
      const newSet = new Set(prev);
      if (newSet.has(caseId)) {
        newSet.delete(caseId);
      } else {
        newSet.add(caseId);
      }
      return newSet;
    });
  };

  // Handle bulk assignment
  const handleBulkAssign = () => {
    if (selectedCases.size === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one case',
        variant: 'destructive',
      });
      return;
    }
    setBulkAssignmentDialogOpen(true);
  };

  // Clear all selections
  const clearSelections = () => {
    setSelectedCases(new Set());
  };

  // Handle bulk assignment of selected cases
  const handleBulkAssignCases = async () => {
    if (!selectedGigWorker || !vendorId || selectedCases.size === 0) {
      toast({
        title: 'Error',
        description: 'Please select a gig worker and at least one case',
        variant: 'destructive',
      });
      return;
    }

    try {
      const caseIds = Array.from(selectedCases);
      const updateData = {
        current_assignee_id: selectedGigWorker,
        current_assignee_type: 'gig' as const,
        current_vendor_id: vendorId,
        status: 'accepted' as const,
        assignment_time: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('cases')
        .update(updateData)
        .in('id', caseIds);

      if (error) throw error;

      console.log('Assignment successful, updating data...');
      console.log('Updated cases:', caseIds);
      console.log('Update data:', updateData);

      toast({
        title: 'Success',
        description: `${caseIds.length} cases assigned to gig worker successfully`,
      });

      setBulkAssignmentDialogOpen(false);
      setSelectedGigWorker('');
      setSelectedCases(new Set());
      
      // Add a small delay to ensure database is updated
      setTimeout(() => {
        fetchAssignedCases();
        fetchUnassignedCases();
        fetchReworkCases();
        fetchGigWorkers();
      }, 500);
    } catch (error) {
      console.error('Error assigning cases:', error);
      const { getErrorToast } = await import('@/utils/errorMessages');
      toast(getErrorToast(error));
    }
  };

  // Assign case to gig worker
  const handleAssignCase = async () => {
    if (!selectedCase || !selectedGigWorker || !vendorId) {
      toast({
        title: 'Error',
        description: 'Please select both a case and a gig worker',
        variant: 'destructive',
      });
      return;
    }

    try {
      // First, get the case details to check if it's a rework case
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .select('QC_Response, status')
        .eq('id', selectedCase)
        .single();

      let isReworkCase = false;
      if (caseError) {
        console.warn('Could not fetch case details for rework detection:', caseError);
        // Default to not being a rework case if we can't determine
      } else if (caseData) {
        // Determine if this is a rework case
        isReworkCase = (caseData as any)?.QC_Response === 'Rework' || (caseData as any)?.status === 'qc_rework';
      }
      
      // Set the appropriate status and assignee
      const updateData: any = {
        current_assignee_id: selectedGigWorker,
        current_assignee_type: 'gig',
        status: 'accepted', // Always set to accepted when vendor assigns to gig worker
        status_updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('cases')
        .update(updateData)
        .eq('id', selectedCase);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Case assigned to gig worker successfully',
      });

      setAssignmentDialogOpen(false);
      setSelectedCase('');
      setSelectedGigWorker('');
      fetchAssignedCases();
      fetchUnassignedCases(); // Refresh unassigned cases
      fetchReworkCases(); // Refresh rework cases
      fetchGigWorkers(); // Refresh capacity
    } catch (error) {
      console.error('Error assigning case:', error);
      const { getErrorToast } = await import('@/utils/errorMessages');
      toast(getErrorToast(error));
    }
  };

  // Fetch QC review data for a case
  const fetchQcReviewData = async (caseId: string) => {
    try {
      // For now, return null since qc_reviews table might not exist
      // This can be implemented later when the table is available
      return null;
    } catch (error) {
      console.error('Error fetching QC review data:', error);
      return null;
    }
  };

  // View case details
  const handleViewCase = async (caseItem: Case) => {
    setViewingCase(caseItem);
    setViewCaseDialogOpen(true);
    
    // Fetch QC review data if it's a QC rework case
    if (caseItem.status === 'qc_rework') {
      const qcData = await fetchQcReviewData(caseItem.id);
      setQcReviewData(qcData);
    } else {
      setQcReviewData(null);
    }
  };

  // Handle view submission - simplified to use DynamicFormSubmission component
  const handleViewSubmission = async () => {
    if (!viewingCase) return;
    
              // Debug: Let's check what data is available for this case
              console.log('=== VENDOR DEBUG: Checking submission data for case ===');
              console.log('Case ID:', viewingCase.id);
              console.log('Case status:', viewingCase.status);
              
              // Test RLS policies by checking if vendor can see the case
              const { data: caseCheck, error: caseCheckError } = await supabase
                .from('cases')
                .select(`
                  id, case_number, current_vendor_id,
                  vendors!inner(id, name, profile_id),
                  profiles!inner(user_id, role)
                `)
                .eq('id', viewingCase.id);
              
              console.log('Case with vendor check (RLS test):', caseCheck);
              console.log('Case with vendor check error:', caseCheckError);
              
              // Check submissions table
              const { data: submissions, error: subError } = await supabase
                .from('submissions')
                .select('*')
                .eq('case_id', viewingCase.id);
              
              console.log('Legacy submissions (vendor query):', submissions);
              console.log('Legacy submissions error:', subError);
    
    // Check if case has current_assignee_id
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('id, case_number, status, current_assignee_id, current_assignee_type, current_vendor_id')
      .eq('id', viewingCase.id)
      .single();
    
    console.log('Case data (vendor query):', caseData);
    console.log('Case error:', caseError);
    
    // Check vendor's role and profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, user_id')
      .eq('user_id', user?.id)
      .single();
    
    console.log('Vendor profile data:', profileData);
    console.log('Vendor profile error:', profileError);
    
    // Check if vendor has access to this case
    const { data: vendorData, error: vendorError } = await supabase
      .from('vendors')
      .select('id, profile_id')
      .eq('profile_id', profileData?.id)
      .single();
    
    console.log('Vendor data:', vendorData);
    console.log('Vendor error:', vendorError);
    
    // Check if case is assigned to this vendor
    console.log('Vendor access check:', {
      case_vendor_id: caseData?.current_vendor_id,
      vendor_id: vendorData?.id,
      is_assigned_to_vendor: caseData?.current_vendor_id === vendorData?.id
    });
    
    // Check the gig worker who is assigned to this case
    let gigWorkerData = null;
    if (caseData?.current_assignee_id) {
      const { data: gigWorker, error: gigWorkerError } = await supabase
        .from('gig_partners')
        .select('id, vendor_id, profile_id')
        .eq('id', caseData.current_assignee_id)
        .single();
      
      console.log('Gig worker assigned to case:', gigWorker);
      console.log('Gig worker error:', gigWorkerError);
      
      gigWorkerData = gigWorker;
      if (gigWorkerData) {
        console.log('Gig worker vendor assignment:', {
          gig_worker_id: gigWorkerData.id,
          gig_worker_vendor_id: gigWorkerData.vendor_id,
          profile_id: gigWorkerData.profile_id,
          should_have_vendor_assigned: gigWorkerData.vendor_id
        });
      }
    }
    
    // TEMPORARY FIX: If case is not assigned to vendor but gig worker is from this vendor, fix it
    if (caseData?.current_assignee_id && !caseData?.current_vendor_id && gigWorkerData?.vendor_id === vendorData?.id) {
      console.log('Fixing case vendor assignment...');
      
      const { error: fixError } = await supabase
        .from('cases')
        .update({ current_vendor_id: vendorData.id })
        .eq('id', viewingCase.id);
      
      if (fixError) {
        console.error('Error fixing vendor assignment:', fixError);
      } else {
        console.log('Successfully fixed vendor assignment!');
        toast({
          title: 'Fixed',
          description: 'Case vendor assignment has been corrected',
        });
      }
    }
    
    setViewSubmissionDialogOpen(true);
  };


  // Reassign case
  const handleReassignCase = async () => {
    if (!reassignCaseId || !selectedGigWorker || !vendorId) {
      toast({
        title: 'Error',
        description: 'Please select a gig worker',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('cases')
        .update({
          current_assignee_id: selectedGigWorker,
          current_assignee_type: 'gig',
          status: 'in_progress',
          status_updated_at: new Date().toISOString()
        })
        .eq('id', reassignCaseId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Case reassigned successfully',
      });

      setReassignmentDialogOpen(false);
      setReassignCaseId('');
      setSelectedGigWorker('');
      fetchAssignedCases();
      fetchUnassignedCases(); // Refresh unassigned cases
      fetchReworkCases(); // Refresh rework cases
      fetchGigWorkers(); // Refresh capacity
    } catch (error) {
      console.error('Error reassigning case:', error);
      const { getErrorToast } = await import('@/utils/errorMessages');
      toast(getErrorToast(error));
    }
  };

  // Fetch unassigned cases
  const fetchUnassignedCases = async () => {
    if (!vendorId) {
      setUnassignedCases([]);
      return;
    }

    try {
      // Query: Cases with same vendor ID (no status filter)
      const { data, error } = await supabase
        .from('cases')
        .select(`
          id,
          case_number,
          title,
          description,
          priority,
          client_id,
          location_id,
          tat_hours,
          due_at,
          created_at,
          status,
          status_updated_at,
          base_rate_inr,
          total_rate_inr,
          created_by,
          updated_at,
          current_vendor_id
        `)
        .eq('current_vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching unassigned cases:', error);
        throw error;
      }

      console.log('All cases for vendor (vendorId=' + vendorId + '):', data);
      console.log('Number of all cases for vendor:', data?.length || 0);
      
      // Filter to show only cases with status = "new"
      const createdCases = (data || []).filter(c => (c.status as any) === 'new');
      console.log('Cases with status=created:', createdCases);
      console.log('Number of created cases:', createdCases.length);
      
      const cases = createdCases.map(c => ({
        ...c,
        address_line: '',
        city: '',
        state: '',
        pincode: '',
        client_name: '',
        client_email: ''
      }));
      
      console.log('Processed unassigned cases (created only):', cases);
      setUnassignedCases(cases);
    } catch (error) {
      console.error('Error fetching unassigned cases:', error);
      const { getErrorToast } = await import('@/utils/errorMessages');
      toast(getErrorToast(error));
    }
  };

  // Fetch rework cases
  const fetchReworkCases = async () => {
    if (!vendorId) {
      console.log('No vendorId, setting empty rework cases');
      setReworkCases([]);
      return;
    }

    console.log('Fetching rework cases for vendor:', vendorId);

    try {
      // Query for cases with QC_Response = 'Rework' for this vendor (rework cases)
      const { data, error } = await supabase
        .from('cases')
        .select(`
          *,
          clients(id, name, contact_person, phone, email),
          locations(id, address_line, city, state, pincode)
        `)
        .eq('current_vendor_id', vendorId)
        .eq('QC_Response', 'Rework')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching rework cases:', error);
        // If QC_Response column doesn't exist, try alternative approach
        if (error.message?.includes('QC_Response')) {
          console.log('QC_Response column not found, trying alternative query...');
          
          // Try to get cases that might be rework cases by status
          const { data: altData, error: altError } = await supabase
            .from('cases')
            .select(`
              *,
              clients(id, name, contact_person, phone, email),
              locations(id, address_line, city, state, pincode)
            `)
            .eq('current_vendor_id', vendorId)
            .in('status', ['qc_passed', 'qc_rejected', 'qc_rework'])
            .order('created_at', { ascending: false });

          if (altError) {
            console.error('Alternative query also failed:', altError);
            throw altError;
          }

          console.log('Alternative rework cases data:', altData);

          // Resolve client names for altData as well
          const altClientIds = Array.from(new Set((altData || []).map((c: any) => c.client_id).filter(Boolean)));
          let altClientIdToName: Record<string, string> = {};
          if (altClientIds.length > 0) {
            const { data: altClientRows, error: altClientError } = await supabase
              .from('clients')
              .select('id, name')
              .in('id', altClientIds);
            
            if (altClientError) {
              console.error('Error fetching clients for alternative rework cases:', altClientError);
            } else {
              (altClientRows || []).forEach((row: any) => {
                altClientIdToName[row.id] = row.name;
              });
              console.log('Fetched client names for alternative rework cases:', altClientIdToName);
            }
          }

          const cases = (altData || []).map((c: any) => {
            const clientName = c.clients?.name || altClientIdToName[c.client_id] || '';
            if (!clientName && c.client_id) {
              console.warn(`Alt rework case: Client name not found for client_id: ${c.client_id}, available clients:`, altClientIdToName);
            }
            return {
            id: c.id || '',
            case_number: c.case_number || '',
            title: c.title || '',
            description: c.description || '',
            priority: c.priority || 'medium',
            client_id: c.client_id || '',
            location_id: c.location_id || '',
            tat_hours: c.tat_hours || 0,
            due_at: c.due_at || '',
            created_at: c.created_at || '',
            status: c.status || 'draft',
            status_updated_at: c.status_updated_at || '',
            base_rate_inr: c.base_rate_inr || 0,
            total_rate_inr: c.total_rate_inr || 0,
            created_by: c.created_by || '',
            updated_at: c.updated_at || '',
            current_vendor_id: c.current_vendor_id || '',
            QC_Response: 'Rework', // Assume these are rework cases
            acceptance_deadline: c.metadata?.acceptance_deadline || '',
            metadata: c.metadata || {},
            address_line: c.locations?.address_line || '',
            city: c.locations?.city || '',
            state: c.locations?.state || '',
            pincode: c.locations?.pincode || '',
            client_name: clientName,
            client_email: c.clients?.email || ''
            };
          });

          console.log('Processed alternative rework cases:', cases);
          setReworkCases(cases);
          return;
        }
        throw error;
      }

      console.log('Raw rework cases data (QC_Response = Rework):', data);
      console.log('Number of rework cases (QC_Response = Rework):', data?.length || 0);

      // Resolve client names using client_id in case relational payload is missing
      const reworkClientIds = Array.from(new Set((data || []).map((c: any) => c.client_id).filter(Boolean)));
      let reworkClientIdToName: Record<string, string> = {};
      if (reworkClientIds.length > 0) {
        const { data: clientRows, error: reworkClientError } = await supabase
          .from('clients')
          .select('id, name')
          .in('id', reworkClientIds);
        
        if (reworkClientError) {
          console.error('Error fetching clients for rework cases:', reworkClientError);
        } else {
          (clientRows || []).forEach((row: any) => {
            reworkClientIdToName[row.id] = row.name;
          });
          console.log('Fetched client names for rework cases:', reworkClientIdToName);
        }
      }

      const cases = (data || []).map((c: any) => {
        const clientName = c.clients?.name || reworkClientIdToName[c.client_id] || '';
        if (!clientName && c.client_id) {
          console.warn(`Rework case: Client name not found for client_id: ${c.client_id}, available clients:`, reworkClientIdToName);
        }
        return {
          id: c.id || '',
          case_number: c.case_number || '',
          title: c.title || '',
          description: c.description || '',
          priority: c.priority || 'medium',
          client_id: c.client_id || '',
          location_id: c.location_id || '',
          tat_hours: c.tat_hours || 0,
          due_at: c.due_at || '',
          created_at: c.created_at || '',
          status: c.status || 'draft',
          status_updated_at: c.status_updated_at || '',
          base_rate_inr: c.base_rate_inr || 0,
          total_rate_inr: c.total_rate_inr || 0,
          created_by: c.created_by || '',
          updated_at: c.updated_at || '',
          current_vendor_id: c.current_vendor_id || '',
          QC_Response: c.QC_Response || 'New',
          acceptance_deadline: c.metadata?.acceptance_deadline || '',
          metadata: c.metadata || {},
          address_line: c.locations?.address_line || '',
          city: c.locations?.city || '',
          state: c.locations?.state || '',
          pincode: c.locations?.pincode || '',
          client_name: clientName,
          client_email: c.clients?.email || ''
        };
      });

      console.log('Processed rework cases:', cases);
      setReworkCases(cases);
      
    } catch (error) {
      console.error('Error fetching rework cases:', error);
      const { getErrorToast } = await import('@/utils/errorMessages');
      toast(getErrorToast(error));
      setReworkCases([]);
    }
  };

  // Check for case timeouts
  const checkTimeouts = async () => {
    const now = new Date();
    const timeoutCases = pendingCases.filter(caseItem => {
      if (caseItem.status !== 'allocated') return false;
      if (!caseItem.acceptance_deadline) return false;
      const deadline = new Date(caseItem.acceptance_deadline);
      return now > deadline;
    });

    if (timeoutCases.length > 0) {
      // Handle timeout cases
      for (const caseItem of timeoutCases) {
        await handleCaseTimeout(caseItem.id);
      }
      // Reload cases
      fetchAssignedCases();
    }

    // Also check for expired rework case assignments (only unassigned ones)
    const expiredReworkCases = reworkCases.filter(caseItem => {
      if (caseItem.status !== 'qc_rework') return false;
      
      // For qc_rework cases, check if 30 minutes have passed since QC marked it for rework
      const qcReworkTime = caseItem.metadata?.qc_rework_time || caseItem.metadata?.qc_rework_at;
      let reworkTime;
      
      if (qcReworkTime) {
        // Use the actual QC rework time
        reworkTime = new Date(qcReworkTime);
      } else {
        // Fallback: use status_updated_at (when case was marked for rework)
        reworkTime = new Date(caseItem.status_updated_at);
      }
      
      const deadline = new Date(reworkTime.getTime() + (30 * 60 * 1000)); // Add 30 minutes
      return now > deadline;
    });

    if (expiredReworkCases.length > 0) {
      // Handle expired rework case assignments
      for (const caseItem of expiredReworkCases) {
        await handleReworkCaseTimeout(caseItem.id);
      }
      // Reload cases
      fetchReworkCases();
    }
  };

  // Handle case timeout
  const handleCaseTimeout = async (caseId: string) => {
    try {
      // Update case status to draft and remove assignee
      const { error: caseError } = await supabase
        .from('cases')
        .update({
          status: 'new',
          current_assignee_id: null,
          current_assignee_type: null,
          current_vendor_id: null,
          status_updated_at: new Date().toISOString()
        })
        .eq('id', caseId);

      if (caseError) throw caseError;

      // Update allocation log
      const { error: logError } = await supabase
        .from('allocation_logs')
        .update({
          decision: 'rejected',
          decision_at: new Date().toISOString(),
          reallocation_reason: 'Not accepted within 30 minutes'
        })
        .eq('case_id', caseId)
        .eq('decision', 'allocated');

      if (logError) {
        console.warn('Could not update allocation log:', logError);
      }

      toast({
        title: 'Case Timeout',
        description: 'Case was not accepted within 30 minutes and has been unassigned',
        variant: 'destructive',
      });
    } catch (error) {
      console.error('Error handling case timeout:', error);
    }
  };

  // Handle rework case timeout
  const handleReworkCaseTimeout = async (caseId: string) => {
    try {
      // First check if the case is still unassigned
      const { data: caseData, error: fetchError } = await supabase
        .from('cases')
        .select('current_assignee_id, status')
        .eq('id', caseId)
        .single();

      if (fetchError) {
        console.error('Error fetching case for timeout check:', fetchError);
        return;
      }

      // Only proceed if case is still qc_rework status
      if (caseData.status !== 'qc_rework' as any) {
        console.log('Case status changed, skipping timeout handling');
        return;
      }

      // Update case status back to qc_review and remove assignee
      const { error: caseError } = await supabase
        .from('cases')
        .update({
          status: 'qc_passed',
          current_assignee_id: null,
          current_assignee_type: null,
          status_updated_at: new Date().toISOString()
        })
        .eq('id', caseId);

      if (caseError) throw caseError;

      toast({
        title: 'Rework Case Timeout',
        description: 'Rework case was not accepted within 30 minutes and is available for reassignment',
        variant: 'destructive',
      });
    } catch (error) {
      console.error('Error handling rework case timeout:', error);
    }
  };

  // Mobile detection and responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      // More comprehensive mobile detection
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isSmallScreen = width < 768;
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      // Consider it mobile if it's a small screen OR a mobile device OR touch device
      setIsMobile(isSmallScreen || (isMobileDevice && width < 1024) || (isTouchDevice && width < 900));
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, []);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchVendorId();
      setLoading(false);
    };
    loadData();
    
    // Set up interval to check for timeouts every minute
    const interval = setInterval(checkTimeouts, 60000);
    return () => clearInterval(interval);
  }, []);

  // Load gig workers and cases when vendorId is available
  useEffect(() => {
    console.log('useEffect triggered with vendorId:', vendorId);
    if (vendorId) {
      console.log('Loading gig workers and assigned cases...');
      fetchGigWorkers();
      fetchAssignedCases();
      fetchUnassignedCases();
      fetchReworkCases();
    }
  }, [vendorId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!vendorId) {
    return (
      <div className={`${isMobile ? 'p-4' : 'p-6'}`}>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Vendor information not found. Please contact support.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Mobile-friendly case card component
  const MobileCaseCard = ({ caseItem, onAccept, onReject, onAssign, onReassign, onView, onSelect, isSelected = false, showActions = true }: {
    caseItem: Case;
    onAccept?: () => void;
    onReject?: () => void;
    onAssign?: () => void;
    onReassign?: () => void;
    onView?: () => void;
    onSelect?: () => void;
    isSelected?: boolean;
    showActions?: boolean;
  }) => {
    const getTimeRemaining = (deadline?: string) => {
      if (!deadline) return 'No deadline';
      const now = new Date();
      const deadlineDate = new Date(deadline);
      const diffMs = deadlineDate.getTime() - now.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      
      if (diffMinutes <= 0) return 'Expired';
      if (diffMinutes < 60) return `${diffMinutes}m`;
      
      const diffHours = Math.floor(diffMinutes / 60);
      const remainingMinutes = diffMinutes % 60;
      return `${diffHours}h ${remainingMinutes}m`;
    };

    // For rework cases, calculate timer based on when QC marked it for rework + 30 minutes
    const getReworkTimer = (qcReworkTime: string) => {
      const now = new Date();
      const reworkTime = new Date(qcReworkTime);
      const deadline = new Date(reworkTime.getTime() + (30 * 60 * 1000)); // Add 30 minutes
      const diffMs = deadline.getTime() - now.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      
      if (diffMinutes <= 0) return 'Expired';
      if (diffMinutes < 60) return `${diffMinutes}m`;
      
      const diffHours = Math.floor(diffMinutes / 60);
      const remainingMinutes = diffMinutes % 60;
      return `${diffHours}h ${remainingMinutes}m`;
    };

    // For assigned cases, calculate timer based on TAT hours from assignment time
    const getTATTimer = (assignmentTime: string, tatHours: number) => {
      const now = new Date();
      const assignTime = new Date(assignmentTime);
      const deadline = new Date(assignTime.getTime() + (tatHours * 60 * 60 * 1000)); // Add TAT hours
      const diffMs = deadline.getTime() - now.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      if (diffMs <= 0) return 'Expired';
      if (diffHours < 24) return `${diffHours}h ${diffMinutes}m`;
      
      const diffDays = Math.floor(diffHours / 24);
      const remainingHours = diffHours % 24;
      return `${diffDays}d ${remainingHours}h`;
    };

    // Determine timer based on case type
    let acceptanceDeadline = '';
    let isExpired = false;
    let timeRemaining = 'No timer';

    if (caseItem.status === 'allocated') {
      // For allocated status, show 30-minute timer from status_updated_at
      const allocationTime = caseItem.status_updated_at;
      if (allocationTime) {
        acceptanceDeadline = new Date(new Date(allocationTime).getTime() + (30 * 60 * 1000)).toISOString();
        isExpired = new Date(acceptanceDeadline) < new Date();
        timeRemaining = getReworkTimer(allocationTime);
      }
    } else if (caseItem.status === 'qc_rework') {
      // For qc_rework status, show 30-minute timer from when QC set it for rework
      const qcReworkTime = caseItem.metadata?.qc_rework_time || caseItem.metadata?.qc_rework_at;
      
      if (qcReworkTime) {
        // Use the actual QC rework time
        acceptanceDeadline = new Date(new Date(qcReworkTime).getTime() + (30 * 60 * 1000)).toISOString();
        isExpired = new Date(acceptanceDeadline) < new Date();
        timeRemaining = getReworkTimer(qcReworkTime);
      } else {
        // Fallback: assume QC rework happened when status was last updated to qc_rework
        const fallbackTime = caseItem.status_updated_at;
        acceptanceDeadline = new Date(new Date(fallbackTime).getTime() + (30 * 60 * 1000)).toISOString();
        isExpired = new Date(acceptanceDeadline) < new Date();
        timeRemaining = getReworkTimer(fallbackTime);
      }
    } else if (caseItem.status === 'in_progress') {
      // For in_progress status, show TAT timer based on tat_hours
      const assignmentTime = caseItem.status_updated_at; // When it was assigned
      const tatHours = caseItem.tat_hours || 24; // Default to 24 hours if not set
      const tatDeadline = new Date(new Date(assignmentTime).getTime() + (tatHours * 60 * 60 * 1000));
      
      acceptanceDeadline = tatDeadline.toISOString();
      isExpired = new Date(acceptanceDeadline) < new Date();
      timeRemaining = getTATTimer(assignmentTime, tatHours);
    } else {
      // For other cases, show "Expired" badge
      acceptanceDeadline = '';
      isExpired = true;
      timeRemaining = 'Expired';
    }

    return (
      <Card 
        className={`mb-3 shadow-sm border-0 bg-white cursor-pointer transition-all duration-200 hover:shadow-md ${
          isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''
        }`}
        onClick={onSelect}
      >
        <CardHeader className="pb-2 px-4 pt-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-2">
              <CardTitle className="text-base font-semibold text-gray-900 truncate leading-tight">
                {caseItem.case_number}
                {isRecreatedCase(caseItem.case_number) && (
                  <Badge variant="outline" className="ml-2 text-xs border-orange-300 text-orange-700 bg-orange-50">
                    Recreated
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-sm text-gray-600 mt-1">
                {caseItem.title}
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              {isSelected && (
                <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-3 w-3 text-white" />
                </div>
              )}
              <Badge variant={
                caseItem.priority === 'high' ? 'destructive' :
                caseItem.priority === 'medium' ? 'default' : 'secondary'
              }>
                {caseItem.priority}
              </Badge>
              {caseItem.status && (
                <Badge variant={
                  caseItem.status === 'submitted' ? 'default' :
                  caseItem.status === 'in_progress' ? 'secondary' :
                  caseItem.status === 'qc_rework' ? 'destructive' : 'outline'
                }>
                  {caseItem.status === 'qc_rework' ? 'QC Rework' : caseItem.status.replace('_', ' ')}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {/* Client Info */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-blue-600 flex-shrink-0" />
              <span className="font-semibold text-sm text-gray-900">{caseItem.client_name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
              <span className="break-all">{caseItem.client_email}</span>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 leading-tight">
                  {caseItem.address_line}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {caseItem.city}, {caseItem.state} - {caseItem.pincode}
                </div>
              </div>
            </div>
          </div>

          {/* Time and Due Date */}
          <div className="flex items-center justify-between bg-blue-50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600 flex-shrink-0" />
              <span className="font-bold text-sm text-blue-900">
                Due: {new Date(caseItem.due_at).toLocaleDateString()}
              </span>
            </div>
            {acceptanceDeadline && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-600 flex-shrink-0" />
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  isExpired 
                    ? 'bg-red-100 text-red-700' 
                    : 'bg-orange-100 text-orange-700'
                }`}>
                  {timeRemaining}
                </span>
              </div>
            )}
          </div>

          {/* Rework Case Timer - Special display for rework cases */}
          {caseItem.QC_Response === 'Rework' && timeRemaining !== 'No timer' && (
            <div className="bg-red-50 rounded-lg p-3 border border-red-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                  <span className="font-bold text-sm text-red-900">
                    Rework Assignment Timer
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-red-600 flex-shrink-0" />
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    isExpired 
                      ? 'bg-red-100 text-red-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {timeRemaining}
                  </span>
                </div>
              </div>
              <div className="text-xs text-red-700 mt-1">
                Gig worker has 30 minutes to accept this rework case
              </div>
            </div>
          )}

          {/* Additional QC Information */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-muted-foreground">TAT</p>
                <p className="font-medium">{caseItem.tat_hours}h</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-muted-foreground">Assigned</p>
                <p className="font-medium">{caseItem.status_updated_at ? formatDate(caseItem.status_updated_at) : 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          {showActions && (
            <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
              {onAccept && (
                <Button
                  size="sm"
                  onClick={onAccept}
                  disabled={isExpired}
                  className="flex-1 h-10 text-sm font-medium bg-green-600 hover:bg-green-700 disabled:bg-gray-300"
                >
                  <CheckCircle className="h-4 w-4 mr-1.5" />
                  Accept
                </Button>
              )}
              {onReject && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onReject}
                  disabled={isExpired}
                  className="flex-1 h-10 text-sm font-medium border-red-300 text-red-700 hover:bg-red-50 disabled:bg-gray-100"
                >
                  <XCircle className="h-4 w-4 mr-1.5" />
                  Reject
                </Button>
              )}
              {onAssign && (
                <Button
                  size="sm"
                  onClick={onAssign}
                  className="flex-1 h-10 text-sm font-medium bg-blue-600 hover:bg-blue-700"
                >
                  <Users className="h-4 w-4 mr-1.5" />
                  Assign
                </Button>
              )}
              {onReassign && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onReassign}
                  className="flex-1 h-10 text-sm font-medium border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  <ArrowRightLeft className="h-4 w-4 mr-1.5" />
                  Reassign
                </Button>
              )}
              {onView && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onView}
                  className="flex-1 h-10 text-sm font-medium border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  <Eye className="h-4 w-4 mr-1.5" />
                  View
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={`space-y-4 ${isMobile ? 'min-h-screen bg-gray-50 pb-4' : 'p-6 space-y-6'}`}>
      {/* Mobile Header */}
      {isMobile && (
        <div className="bg-white shadow-sm border-b sticky top-0 z-10">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold text-gray-900">Vendor Dashboard</h1>
                <p className="text-sm text-gray-600">Manage gig workers & cases</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500">Total Cases</div>
                <div className="text-lg font-bold text-blue-600">{assignedCases.length}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Header */}
      {!isMobile && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Vendor Dashboard</h1>
            <p className="text-muted-foreground">Manage your gig workers and case assignments</p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className={`grid gap-4 ${isMobile ? 'grid-cols-2 mx-2' : 'grid-cols-1 md:grid-cols-4'}`}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gig Workers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{gigWorkers.length}</div>
            <p className="text-xs text-muted-foreground">
              {gigWorkers.filter(w => w.is_available).length} available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Cases</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCases.length}</div>
            <p className="text-xs text-muted-foreground">Awaiting acceptance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressCases.length}</div>
            <p className="text-xs text-muted-foreground">Active cases</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rework Cases</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reworkCases.length}</div>
            <p className="text-xs text-muted-foreground">Require rework</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className={`space-y-4 ${isMobile ? 'mx-2' : ''}`}>
        <TabsList className={`grid w-full ${isMobile ? 'grid-cols-5 gap-1 h-12' : 'grid-cols-5'} ${isMobile ? 'overflow-x-auto' : ''}`}>
          <TabsTrigger 
            value="pending" 
            className={isMobile ? 'text-xs px-1 min-w-0 h-10 text-center flex flex-col items-center justify-center py-1' : ''}
          >
            <span className={isMobile ? 'text-xs font-medium' : ''}>
              {isMobile ? 'Pending' : 'Pending Cases'}
            </span>
            <span className={isMobile ? 'text-xs font-bold text-blue-600' : ''}>
              ({pendingCases.length})
            </span>
          </TabsTrigger>
          <TabsTrigger 
            value="in-progress" 
            className={isMobile ? 'text-xs px-1 min-w-0 h-10 text-center flex flex-col items-center justify-center py-1' : ''}
          >
            <span className={isMobile ? 'text-xs font-medium' : ''}>
              {isMobile ? 'Progress' : 'In Progress'}
            </span>
            <span className={isMobile ? 'text-xs font-bold text-orange-600' : ''}>
              ({inProgressCases.length})
            </span>
          </TabsTrigger>
          <TabsTrigger 
            value="unassigned" 
            className={isMobile ? 'text-xs px-1 min-w-0 h-10 text-center flex flex-col items-center justify-center py-1' : ''}
          >
            <span className={isMobile ? 'text-xs font-medium' : ''}>
              {isMobile ? 'Available' : 'Unassigned Cases'}
            </span>
            <span className={isMobile ? 'text-xs font-bold text-green-600' : ''}>
              ({unassignedCases.length})
            </span>
          </TabsTrigger>
          <TabsTrigger 
            value="gig-workers" 
            className={isMobile ? 'text-xs px-1 min-w-0 h-10 text-center flex flex-col items-center justify-center py-1' : ''}
          >
            <span className={isMobile ? 'text-xs font-medium' : ''}>
              {isMobile ? 'Workers' : 'Gig Workers'}
            </span>
            <span className={isMobile ? 'text-xs font-bold text-purple-600' : ''}>
              ({gigWorkers.length})
            </span>
          </TabsTrigger>
          <TabsTrigger 
            value="rework" 
            className={isMobile ? 'text-xs px-1 min-w-0 h-10 text-center flex flex-col items-center justify-center py-1' : ''}
          >
            <span className={isMobile ? 'text-xs font-medium' : ''}>
              {isMobile ? 'Rework' : 'Rework Cases'}
            </span>
            <span className={isMobile ? 'text-xs font-bold text-red-600' : ''}>
              ({reworkCases.length})
            </span>
          </TabsTrigger>
        </TabsList>

        {/* Pending Cases Tab */}
        <TabsContent value="pending" className={`space-y-4 ${isMobile ? 'px-1' : ''}`}>
          <Card className={isMobile ? 'shadow-sm border-0' : ''}>
            <CardHeader className={isMobile ? 'px-4 py-4' : ''}>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className={isMobile ? 'text-lg' : ''}>Pending Cases</CardTitle>
                  <CardDescription className={isMobile ? 'text-sm' : ''}>
                    Cases auto-allocated to you that need acceptance or rejection
                  </CardDescription>
                </div>
                {selectedCases.size > 0 && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={clearSelections}
                    >
                      Clear ({selectedCases.size})
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleBulkAssign}
                    >
                      Assign Selected
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className={isMobile ? 'px-2' : ''}>
              {pendingCases.length === 0 ? (
                <div className={`text-center py-8 text-muted-foreground ${isMobile ? 'mx-2' : ''}`}>
                  No pending cases
                </div>
              ) : (
                <>
                  {isMobile ? (
                    // Mobile: Card layout
                    <div className="space-y-3 px-1">
                      {pendingCases.map((caseItem) => (
                        <MobileCaseCard
                          key={caseItem.id}
                          caseItem={caseItem}
                          onAccept={caseItem.status === 'allocated' ? () => handleAcceptCase(caseItem.id) : undefined}
                          onReject={caseItem.status === 'allocated' ? () => handleRejectCase(caseItem.id) : undefined}
                          onAssign={caseItem.status === 'qc_rework' ? () => {
                            setSelectedCase(caseItem.id);
                            setAssignmentDialogOpen(true);
                          } : undefined}
                          onSelect={() => handleCaseSelection(caseItem.id)}
                          isSelected={selectedCases.has(caseItem.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    // Desktop: Table layout
                    <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Case Number</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Time Remaining</TableHead>
                      <TableHead>TAT Hours</TableHead>
                      <TableHead>Assigned On</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingCases.map((caseItem) => {
                      const getTimeRemaining = (deadline?: string) => {
                        if (!deadline) return 'No deadline';
                        const now = new Date();
                        const deadlineDate = new Date(deadline);
                        const diffMs = deadlineDate.getTime() - now.getTime();
                        const diffMinutes = Math.floor(diffMs / (1000 * 60));
                        
                        if (diffMinutes <= 0) return 'Expired';
                        if (diffMinutes < 60) return `${diffMinutes}m`;
                        
                        const diffHours = Math.floor(diffMinutes / 60);
                        const remainingMinutes = diffMinutes % 60;
                        return `${diffHours}h ${remainingMinutes}m`;
                      };

                      // For allocated cases, show 30-minute timer from status_updated_at
                      let acceptanceDeadline = '';
                      if (caseItem.status === 'allocated' && caseItem.status_updated_at) {
                        acceptanceDeadline = new Date(new Date(caseItem.status_updated_at).getTime() + (30 * 60 * 1000)).toISOString();
                      } else {
                        acceptanceDeadline = caseItem.acceptance_deadline;
                      }

                      const isExpired = acceptanceDeadline && new Date(acceptanceDeadline) < new Date();
                      const timeRemaining = getTimeRemaining(acceptanceDeadline);

                      return (
                        <TableRow key={caseItem.id} className={isExpired ? 'bg-red-50' : ''}>
                          <TableCell className="font-mono">{caseItem.case_number}</TableCell>
                          <TableCell>{caseItem.title}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="text-sm font-medium text-gray-900">
                                {caseItem.address_line}
                              </div>
                              <div className="text-xs text-gray-600">
                                {caseItem.city}, {caseItem.state} - {caseItem.pincode}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              caseItem.priority === 'high' ? 'destructive' :
                              caseItem.priority === 'medium' ? 'default' : 'secondary'
                            }>
                              {caseItem.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(caseItem.due_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className={isExpired ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                                {timeRemaining}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span>{caseItem.tat_hours}h</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {caseItem.status_updated_at ? formatDate(caseItem.status_updated_at) : 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              {caseItem.status === 'qc_rework' ? (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedCase(caseItem.id);
                                    setAssignmentDialogOpen(true);
                                  }}
                                  className="bg-blue-600 hover:bg-blue-700"
                                >
                                  <UserPlus className="h-4 w-4 mr-1" />
                                  Assign to Gig Worker
                                </Button>
                              ) : caseItem.status === 'in_progress' ? (
                                <div className="text-sm text-gray-600">
                                  Assigned to Gig Worker
                                </div>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleAcceptCase(caseItem.id)}
                                    className="bg-green-600 hover:bg-green-700"
                                    disabled={isExpired}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Accept
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleRejectCase(caseItem.id)}
                                    disabled={isExpired}
                                  >
                                    <XCircle className="h-4 w-4 mr-1" />
                                    Reject
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* In Progress Cases Tab */}
        <TabsContent value="in-progress" className={`space-y-4 ${isMobile ? 'px-1' : ''}`}>
          <Card className={isMobile ? 'shadow-sm border-0' : ''}>
            <CardHeader className={isMobile ? 'px-4 py-4' : ''}>
              <CardTitle className={isMobile ? 'text-lg' : ''}>In Progress Cases</CardTitle>
              <CardDescription className={isMobile ? 'text-sm' : ''}>
                Accepted cases assigned to gig workers
              </CardDescription>
            </CardHeader>
            <CardContent className={isMobile ? 'px-2' : ''}>
              {inProgressCases.length === 0 ? (
                <div className={`text-center py-8 text-muted-foreground ${isMobile ? 'mx-2' : ''}`}>
                  No cases in progress
                </div>
              ) : (
                <>
                  {isMobile ? (
                    // Mobile: Card layout
                    <div className="space-y-3 px-1">
                      {Array.from(new Set(inProgressCases.map(c => c.id)))
                        .map(id => inProgressCases.find(c => c.id === id))
                        .filter(Boolean)
                        .map((caseItem) => {
                          const assignedWorker = gigWorkers.find(w => w.id === caseItem.current_assignee_id);
                          return (
                            <MobileCaseCard
                              key={caseItem.id}
                            caseItem={caseItem}
                            onReassign={assignedWorker ? () => {
                              setReassignCaseId(caseItem.id);
                              setReassignmentDialogOpen(true);
                            } : undefined}
                            onAssign={caseItem.status === 'qc_rework' && !assignedWorker ? () => {
                              setSelectedCase(caseItem.id);
                              setAssignmentDialogOpen(true);
                            } : undefined}
                            onView={() => handleViewCase(caseItem)}
                            onSelect={() => handleCaseSelection(caseItem.id)}
                            isSelected={selectedCases.has(caseItem.id)}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    // Desktop: Table layout
                    <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Case Number</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from(new Set(inProgressCases.map(c => c.id)))
                      .map(id => inProgressCases.find(c => c.id === id))
                      .filter(Boolean)
                      .map((caseItem) => {
                        const assignedWorker = gigWorkers.find(w => w.id === caseItem.current_assignee_id);
                        return (
                          <TableRow key={caseItem.id}>
                          <TableCell className="font-mono">{caseItem.case_number}</TableCell>
                          <TableCell>{caseItem.title}</TableCell>
                          <TableCell>
                            {caseItem.city}, {caseItem.state}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              caseItem.status === 'submitted' ? 'default' :
                              caseItem.status === 'in_progress' ? 'secondary' :
                              caseItem.status === 'qc_rework' ? 'destructive' : 'outline'
                            }>
                              {caseItem.status === 'qc_rework' ? 'QC Rework' : caseItem.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {assignedWorker ? (
                              <div className="flex items-center space-x-2">
                                <UserCheck className="h-4 w-4" />
                                <span>{assignedWorker.first_name} {assignedWorker.last_name}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(caseItem.due_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              {caseItem.status === 'qc_rework' ? (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedCase(caseItem.id);
                                    setAssignmentDialogOpen(true);
                                  }}
                                  className="bg-blue-600 hover:bg-blue-700"
                                >
                                  <UserPlus className="h-4 w-4 mr-1" />
                                  Assign to Gig Worker
                                </Button>
                              ) : caseItem.status === 'in_progress' ? (
                                <div className="text-sm text-gray-600">
                                  Assigned to Gig Worker
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setReassignCaseId(caseItem.id);
                                    setReassignmentDialogOpen(true);
                                  }}
                                >
                                  <ArrowRightLeft className="h-4 w-4 mr-1" />
                                  Reassign
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewCase(caseItem)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Unassigned Cases Tab */}
        <TabsContent value="unassigned" className={`space-y-4 ${isMobile ? 'px-1' : ''}`}>
          <Card className={isMobile ? 'shadow-sm border-0' : ''}>
            <CardHeader className={isMobile ? 'px-4 py-4' : ''}>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className={isMobile ? 'text-lg' : ''}>Unassigned Cases</CardTitle>
                  <CardDescription className={isMobile ? 'text-sm' : ''}>
                    Accepted cases with vendor assignee type
                  </CardDescription>
                </div>
                {selectedCases.size > 0 && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={clearSelections}
                    >
                      Clear ({selectedCases.size})
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleBulkAssign}
                    >
                      Assign Selected
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className={isMobile ? 'px-2' : ''}>
              {unassignedCases.length === 0 ? (
                <div className={`text-center py-8 text-muted-foreground ${isMobile ? 'mx-2' : ''}`}>
                  No unassigned cases available
                </div>
              ) : (
                <>
                  {isMobile ? (
                    // Mobile: Card layout
                    <div className="space-y-3 px-1">
                      {unassignedCases.map((caseItem) => (
                        <MobileCaseCard
                          key={caseItem.id}
                          caseItem={caseItem}
                          onAssign={() => {
                            setSelectedCase(caseItem.id);
                            setAssignmentDialogOpen(true);
                          }}
                          onView={() => handleViewCase(caseItem)}
                          onSelect={() => handleCaseSelection(caseItem.id)}
                          isSelected={selectedCases.has(caseItem.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    // Desktop: Table layout
                    <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Case Number</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unassignedCases.map((caseItem) => (
                      <TableRow key={caseItem.id}>
                        <TableCell className="font-mono">{caseItem.case_number}</TableCell>
                        <TableCell>{caseItem.title}</TableCell>
                        <TableCell>
                          {caseItem.city}, {caseItem.state}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            caseItem.priority === 'high' ? 'destructive' :
                            caseItem.priority === 'medium' ? 'default' : 'secondary'
                          }>
                            {caseItem.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(caseItem.due_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedCase(caseItem.id);
                                setAssignmentDialogOpen(true);
                              }}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <Briefcase className="h-4 w-4 mr-1" />
                              Assign Case
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewCase(caseItem)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gig Workers Tab */}
        <TabsContent value="gig-workers" className={`space-y-4 ${isMobile ? 'px-1' : ''}`}>
          <Card className={isMobile ? 'shadow-sm border-0' : ''}>
            <CardHeader className={isMobile ? 'px-4 py-4' : ''}>
              <CardTitle className={isMobile ? 'text-lg' : ''}>Gig Workers</CardTitle>
              <CardDescription className={isMobile ? 'text-sm' : ''}>
                Manage your gig workers and their capacity
              </CardDescription>
            </CardHeader>
            <CardContent className={isMobile ? 'px-2' : ''}>
              {gigWorkers.length === 0 ? (
                <div className={`text-center py-8 text-muted-foreground ${isMobile ? 'mx-2' : ''}`}>
                  No gig workers found
                </div>
              ) : (
                <>
                  {isMobile ? (
                    // Mobile: Card layout for gig workers
                    <div className="space-y-3 px-1">
                      {gigWorkers.map((worker) => (
                        <Card key={worker.id} className="mb-3 shadow-sm border-0 bg-white">
                          <CardHeader className="pb-2 px-4 pt-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0 pr-2">
                                <CardTitle className="text-base font-semibold text-gray-900 truncate leading-tight">
                                  {worker.first_name} {worker.last_name}
                                </CardTitle>
                                <CardDescription className="text-sm text-gray-600 mt-1">
                                  {worker.email}
                                </CardDescription>
                              </div>
                              <div className="flex flex-col items-end gap-1.5">
                                <Badge variant={worker.is_available ? 'default' : 'secondary'}>
                                  {worker.is_available ? 'Available' : 'Busy'}
                                </Badge>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="px-4 pb-4 space-y-3">
                            {/* Contact Info */}
                            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                <span className="font-semibold text-sm text-gray-900">{worker.phone}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <MapPin className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                                <span className="break-all">{worker.city}, {worker.state}</span>
                              </div>
                            </div>

                            {/* Capacity */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Capacity</span>
                                <span className="text-sm font-bold text-blue-600">
                                  {worker.capacity_available}/{worker.max_daily_capacity}
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full" 
                                  style={{ 
                                    width: `${(worker.capacity_available / worker.max_daily_capacity) * 100}%` 
                                  }}
                                />
                              </div>
                            </div>

                            {/* Performance */}
                            <div className="bg-blue-50 rounded-lg p-3">
                              <div className="text-xs font-medium text-blue-900 mb-2">Performance</div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>Quality: {(worker.quality_score * 100).toFixed(1)}%</div>
                                <div>Completion: {(worker.completion_rate * 100).toFixed(1)}%</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    // Desktop: Table layout
                    <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Vendor Association</TableHead>
                      <TableHead>Performance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gigWorkers.map((worker) => (
                      <TableRow key={worker.id}>
                        <TableCell>
                          {worker.first_name} {worker.last_name}
                        </TableCell>
                        <TableCell>{worker.email}</TableCell>
                        <TableCell>{worker.phone}</TableCell>
                        <TableCell>
                          {worker.city}, {worker.state}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span>{worker.capacity_available}/{worker.max_daily_capacity}</span>
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full" 
                                style={{ 
                                  width: `${(worker.capacity_available / worker.max_daily_capacity) * 100}%` 
                                }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <VendorAssociationBadge 
                            gigWorker={{
                              vendor_id: worker.vendor_id,
                              is_direct_gig: worker.is_direct_gig,
                              vendor_name: worker.vendor_name
                            }} 
                            size="sm"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>Quality: {(worker.quality_score * 100).toFixed(1)}%</div>
                            <div>Completion: {(worker.completion_rate * 100).toFixed(1)}%</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={worker.is_available ? 'default' : 'secondary'}>
                            {worker.is_available ? 'Available' : 'Busy'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rework Cases Tab */}
        <TabsContent value="rework" className={`space-y-4 ${isMobile ? 'px-1' : ''}`}>
          <Card className={isMobile ? 'shadow-sm border-0' : ''}>
            <CardHeader className={isMobile ? 'px-4 py-4' : ''}>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className={isMobile ? 'text-lg' : ''}>Rework Cases</CardTitle>
                  <CardDescription className={isMobile ? 'text-sm' : ''}>
                    Cases that require rework based on QC feedback
                  </CardDescription>
                </div>
                {selectedCases.size > 0 && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={clearSelections}
                    >
                      Clear ({selectedCases.size})
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleBulkAssign}
                    >
                      Assign Selected
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className={isMobile ? 'px-2' : ''}>
              {reworkCases.length === 0 ? (
                <div className={`text-center py-8 text-muted-foreground ${isMobile ? 'mx-2' : ''}`}>
                  No rework cases found
                </div>
              ) : (
                <>
                  {isMobile ? (
                    // Mobile: Card layout
                    <div className="space-y-3 px-1">
                      {reworkCases.map((caseItem) => {
                        const assignedWorker = gigWorkers.find(w => w.id === caseItem.current_assignee_id);
                        return (
                          <MobileCaseCard
                            key={caseItem.id}
                            caseItem={caseItem}
                            onReassign={assignedWorker ? () => {
                              setReassignCaseId(caseItem.id);
                              setReassignmentDialogOpen(true);
                            } : undefined}
                            onAssign={!assignedWorker ? () => {
                              setSelectedCase(caseItem.id);
                              setAssignmentDialogOpen(true);
                            } : undefined}
                            onView={() => handleViewCase(caseItem)}
                            onSelect={() => handleCaseSelection(caseItem.id)}
                            isSelected={selectedCases.has(caseItem.id)}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    // Desktop: Table layout
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Case Number</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Assigned To</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Timer</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reworkCases.map((caseItem) => {
                          const assignedWorker = gigWorkers.find(w => w.id === caseItem.current_assignee_id);
                          
                          // Calculate timer for rework cases
                          let acceptanceDeadline = '';
                          let timeRemaining = 'No timer';
                          let isExpired = false;
                          
                          if (caseItem.status === 'qc_rework') {
                            // For qc_rework status, show 30-minute timer from when QC set it for rework
                            const qcReworkTime = caseItem.metadata?.qc_rework_time || caseItem.metadata?.qc_rework_at;
                            
                            if (qcReworkTime) {
                              // Use the actual QC rework time
                              acceptanceDeadline = new Date(new Date(qcReworkTime).getTime() + (30 * 60 * 1000)).toISOString();
                              isExpired = new Date(acceptanceDeadline) < new Date();
                              
                              const now = new Date();
                              const reworkTime = new Date(qcReworkTime);
                              const deadline = new Date(reworkTime.getTime() + (30 * 60 * 1000));
                              const diffMs = deadline.getTime() - now.getTime();
                              const diffMinutes = Math.floor(diffMs / (1000 * 60));
                              
                              if (diffMinutes <= 0) {
                                timeRemaining = 'Expired';
                              } else if (diffMinutes < 60) {
                                timeRemaining = `${diffMinutes}m`;
                              } else {
                                const diffHours = Math.floor(diffMinutes / 60);
                                const remainingMinutes = diffMinutes % 60;
                                timeRemaining = `${diffHours}h ${remainingMinutes}m`;
                              }
                            } else {
                              // Fallback: use status_updated_at (when case was marked for rework)
                              acceptanceDeadline = new Date(new Date(caseItem.status_updated_at).getTime() + (30 * 60 * 1000)).toISOString();
                              isExpired = new Date(acceptanceDeadline) < new Date();
                              
                              const now = new Date();
                              const statusTime = new Date(caseItem.status_updated_at);
                              const deadline = new Date(statusTime.getTime() + (30 * 60 * 1000));
                              const diffMs = deadline.getTime() - now.getTime();
                              const diffMinutes = Math.floor(diffMs / (1000 * 60));
                              
                              if (diffMinutes <= 0) {
                                timeRemaining = 'Expired';
                              } else if (diffMinutes < 60) {
                                timeRemaining = `${diffMinutes}m`;
                              } else {
                                const diffHours = Math.floor(diffMinutes / 60);
                                const remainingMinutes = diffMinutes % 60;
                                timeRemaining = `${diffHours}h ${remainingMinutes}m`;
                              }
                            }
                          } else if (caseItem.status === 'accepted') {
                            // For accepted status, show TAT timer based on tat_hours
                            const assignmentTime = caseItem.status_updated_at; // When it was assigned
                            const tatHours = caseItem.tat_hours || 24; // Default to 24 hours if not set
                            const tatDeadline = new Date(new Date(assignmentTime).getTime() + (tatHours * 60 * 60 * 1000));
                            
                            acceptanceDeadline = tatDeadline.toISOString();
                            isExpired = new Date(acceptanceDeadline) < new Date();
                            
                            const now = new Date();
                            const assignTime = new Date(assignmentTime);
                            const deadline = new Date(assignTime.getTime() + (tatHours * 60 * 60 * 1000));
                            const diffMs = deadline.getTime() - now.getTime();
                            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                            const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                            
                            if (diffMs <= 0) {
                              timeRemaining = 'Expired';
                            } else if (diffHours < 24) {
                              timeRemaining = `${diffHours}h ${diffMinutes}m`;
                            } else {
                              const diffDays = Math.floor(diffHours / 24);
                              const remainingHours = diffHours % 24;
                              timeRemaining = `${diffDays}d ${remainingHours}h`;
                            }
                          } else {
                            // For other cases, show "Expired" badge
                            acceptanceDeadline = '';
                            isExpired = true;
                            timeRemaining = 'Expired';
                          }
                          
                          return (
                            <TableRow key={caseItem.id}>
                              <TableCell className="font-mono">{caseItem.case_number}</TableCell>
                              <TableCell>{caseItem.title}</TableCell>
                              <TableCell>{caseItem.client_name}</TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="text-sm font-medium text-gray-900">
                                    {caseItem.address_line}
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    {caseItem.city}, {caseItem.state} - {caseItem.pincode}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="destructive">
                                  QC Rework
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {assignedWorker ? (
                                  <div className="flex items-center space-x-2">
                                    <UserCheck className="h-4 w-4" />
                                    <span>{assignedWorker.first_name} {assignedWorker.last_name}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">Unassigned</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {new Date(caseItem.due_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                {timeRemaining !== 'No timer' ? (
                                  <div className="flex items-center space-x-2">
                                    <Clock className="h-4 w-4 text-orange-600" />
                                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                      isExpired 
                                        ? 'bg-red-100 text-red-700' 
                                        : 'bg-orange-100 text-orange-700'
                                    }`}>
                                      {timeRemaining}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-sm">No timer</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex space-x-2">
                                  {caseItem.status === 'qc_rework' ? (
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setSelectedCase(caseItem.id);
                                        setAssignmentDialogOpen(true);
                                      }}
                                      className="bg-blue-600 hover:bg-blue-700"
                                    >
                                      <UserPlus className="h-4 w-4 mr-1" />
                                      Assign to Gig Worker
                                    </Button>
                                  ) : caseItem.status === 'in_progress' ? (
                                    <div className="text-sm text-gray-600">
                                      Assigned to Gig Worker
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setReassignCaseId(caseItem.id);
                                        setReassignmentDialogOpen(true);
                                      }}
                                    >
                                      <ArrowRightLeft className="h-4 w-4 mr-1" />
                                      Reassign
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleViewCase(caseItem)}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    View
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assignment Dialog */}
      <Dialog open={assignmentDialogOpen} onOpenChange={setAssignmentDialogOpen}>
        <DialogContent className={isMobile ? 'max-w-[95vw] max-h-[90vh] mx-2 my-2' : ''}>
          <DialogHeader>
            <DialogTitle>Assign Case to Gig Worker</DialogTitle>
            <DialogDescription>
              Select a gig worker to assign this case to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gig-worker">Gig Worker</Label>
              <Select value={selectedGigWorker} onValueChange={setSelectedGigWorker}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a gig worker" />
                </SelectTrigger>
                <SelectContent>
                  {gigWorkers
                    .filter(worker => worker.is_available)
                    .map((worker) => (
                      <SelectItem key={worker.id} value={worker.id}>
                        {worker.first_name} {worker.last_name} 
                        {' '}({worker.email})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className={isMobile ? 'flex-col gap-2' : ''}>
            <Button variant="outline" onClick={() => setAssignmentDialogOpen(false)} className={isMobile ? 'w-full' : ''}>
              Cancel
            </Button>
            <Button onClick={handleAssignCase} className={isMobile ? 'w-full' : ''}>
              Assign Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassignment Dialog */}
      <Dialog open={reassignmentDialogOpen} onOpenChange={setReassignmentDialogOpen}>
        <DialogContent className={isMobile ? 'max-w-[95vw] max-h-[90vh] mx-2 my-2' : ''}>
          <DialogHeader>
            <DialogTitle>Reassign Case</DialogTitle>
            <DialogDescription>
              Select a different gig worker to reassign this case to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gig-worker">Gig Worker</Label>
              <Select value={selectedGigWorker} onValueChange={setSelectedGigWorker}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a gig worker" />
                </SelectTrigger>
                <SelectContent>
                  {gigWorkers
                    .filter(worker => worker.is_available)
                    .map((worker) => (
                      <SelectItem key={worker.id} value={worker.id}>
                        {worker.first_name} {worker.last_name} 
                        {' '}({worker.email})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className={isMobile ? 'flex-col gap-2' : ''}>
            <Button variant="outline" onClick={() => setReassignmentDialogOpen(false)} className={isMobile ? 'w-full' : ''}>
              Cancel
            </Button>
            <Button onClick={handleReassignCase} className={isMobile ? 'w-full' : ''}>
              Reassign Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Assignment Dialog */}
      <Dialog open={bulkAssignmentDialogOpen} onOpenChange={setBulkAssignmentDialogOpen}>
        <DialogContent className={isMobile ? 'max-w-[95vw] max-h-[90vh] mx-2 my-2' : ''}>
          <DialogHeader>
            <DialogTitle>Assign Selected Cases to Gig Worker</DialogTitle>
            <DialogDescription>
              Select a gig worker to assign {selectedCases.size} selected cases to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gig-worker">Gig Worker</Label>
              <Select value={selectedGigWorker} onValueChange={setSelectedGigWorker}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a gig worker" />
                </SelectTrigger>
                <SelectContent>
                  {gigWorkers.filter(worker => worker.is_available).map((worker) => (
                    <SelectItem key={worker.id} value={worker.id}>
                      {worker.first_name} {worker.last_name} 
                      {' '}({worker.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-muted-foreground">
              Selected cases: {selectedCases.size}
            </div>
          </div>
          <DialogFooter className={isMobile ? 'flex-col gap-2' : ''}>
            <Button variant="outline" onClick={() => setBulkAssignmentDialogOpen(false)} className={isMobile ? 'w-full' : ''}>
              Cancel
            </Button>
            <Button onClick={handleBulkAssignCases} className={isMobile ? 'w-full' : ''}>
              Assign {selectedCases.size} Cases
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Case Dialog */}
      <Dialog open={viewCaseDialogOpen} onOpenChange={setViewCaseDialogOpen}>
        <DialogContent className={`${isMobile ? 'max-w-[95vw] h-[90vh] mx-2 my-2 p-0' : 'max-w-4xl max-h-[90vh]'} flex flex-col`}>
          <DialogHeader className={`flex-shrink-0 ${isMobile ? 'px-4 pt-4 pb-2' : ''}`}>
            <DialogTitle className={isMobile ? 'text-base' : ''}>Case Details</DialogTitle>
            <DialogDescription className={isMobile ? 'text-sm' : ''}>
              View detailed information about this case
            </DialogDescription>
          </DialogHeader>
          {viewingCase && (
            <div className={`flex-1 overflow-y-auto space-y-4 ${isMobile ? 'px-4 pb-4' : 'space-y-6'}`}>
              {/* Case Header */}
              <div className={`bg-gray-50 rounded-lg ${isMobile ? 'p-3' : 'p-4'}`}>
                <div className={`flex items-start justify-between ${isMobile ? 'flex-col gap-2' : ''}`}>
                  <div className={isMobile ? 'flex-1 min-w-0' : ''}>
                    <h3 className={`font-semibold ${isMobile ? 'text-base' : 'text-lg'} ${isMobile ? 'truncate' : ''}`}>{viewingCase.case_number}</h3>
                    <p className={`text-gray-600 ${isMobile ? 'text-xs mt-1' : 'text-sm'}`}>{viewingCase.title}</p>
                  </div>
                  <div className={`flex gap-2 ${isMobile ? 'flex-wrap' : ''}`}>
                    <Badge variant={
                      viewingCase.priority === 'high' ? 'destructive' :
                      viewingCase.priority === 'medium' ? 'default' : 'secondary'
                    } className={isMobile ? 'text-xs' : ''}>
                      {viewingCase.priority}
                    </Badge>
                    {viewingCase.status && (
                      <Badge variant={
                        viewingCase.status === 'submitted' ? 'default' :
                        viewingCase.status === 'in_progress' ? 'secondary' : 'outline'
                      } className={isMobile ? 'text-xs' : ''}>
                        {viewingCase.status.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Case Information Grid */}
              <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {/* Client Information */}
                <div className={`space-y-2 ${isMobile ? 'bg-white rounded-lg p-3 border' : 'space-y-3'}`}>
                  <h4 className={`font-semibold text-gray-900 flex items-center gap-2 ${isMobile ? 'text-sm' : 'text-sm'}`}>
                    <Building className="h-4 w-4 flex-shrink-0" />
                    Client Information
                  </h4>
                  <div className={`space-y-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                    <div className={isMobile ? 'break-words' : ''}><span className="font-medium">Name:</span> {viewingCase.client_name}</div>
                    <div className={isMobile ? 'break-words' : ''}><span className="font-medium">Email:</span> {viewingCase.client_email}</div>
                  </div>
                </div>

                {/* Location Information */}
                <div className={`space-y-2 ${isMobile ? 'bg-white rounded-lg p-3 border' : 'space-y-3'}`}>
                  <h4 className={`font-semibold text-gray-900 flex items-center gap-2 ${isMobile ? 'text-sm' : 'text-sm'}`}>
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    Location
                  </h4>
                  <div className={`space-y-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                    <div className={isMobile ? 'break-words' : ''}><span className="font-medium">Address:</span> {viewingCase.address_line}</div>
                    <div className={isMobile ? 'break-words' : ''}><span className="font-medium">City:</span> {viewingCase.city}, {viewingCase.state}</div>
                    <div className={isMobile ? 'break-words' : ''}><span className="font-medium">Pincode:</span> {viewingCase.pincode}</div>
                  </div>
                </div>

                {/* Case Details */}
                <div className={`space-y-2 ${isMobile ? 'bg-white rounded-lg p-3 border' : 'space-y-3'}`}>
                  <h4 className={`font-semibold text-gray-900 flex items-center gap-2 ${isMobile ? 'text-sm' : 'text-sm'}`}>
                    <Briefcase className="h-4 w-4 flex-shrink-0" />
                    Case Details
                  </h4>
                  <div className={`space-y-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                    <div className={isMobile ? 'break-words' : ''}><span className="font-medium">Status:</span> {viewingCase.status}</div>
                    <div className={isMobile ? 'break-words' : ''}><span className="font-medium">TAT Hours:</span> {viewingCase.tat_hours}</div>
                  </div>
                </div>

                {/* Timeline */}
                <div className={`space-y-2 ${isMobile ? 'bg-white rounded-lg p-3 border' : 'space-y-3'}`}>
                  <h4 className={`font-semibold text-gray-900 flex items-center gap-2 ${isMobile ? 'text-sm' : 'text-sm'}`}>
                    <Clock className="h-4 w-4 flex-shrink-0" />
                    Timeline
                  </h4>
                  <div className={`space-y-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                    <div className={isMobile ? 'break-words' : ''}><span className="font-medium">Created:</span> {new Date(viewingCase.created_at).toLocaleString()}</div>
                    <div className={isMobile ? 'break-words' : ''}><span className="font-medium">Due Date:</span> {new Date(viewingCase.due_at).toLocaleString()}</div>
                    {viewingCase.acceptance_deadline && (
                      <div className={isMobile ? 'break-words' : ''}><span className="font-medium">Acceptance Deadline:</span> {new Date(viewingCase.acceptance_deadline).toLocaleString()}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              {viewingCase.description && (
                <div className={`space-y-2 ${isMobile ? 'bg-white rounded-lg p-3 border' : 'space-y-3'}`}>
                  <h4 className={`font-semibold text-gray-900 ${isMobile ? 'text-sm' : 'text-sm'}`}>Description</h4>
                  <div className={`text-gray-700 bg-gray-50 rounded-lg p-3 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                    {viewingCase.description}
                  </div>
                </div>
              )}


              {/* QC Review Information - Only for QC Rework cases */}
              {viewingCase.status === 'qc_rework' && qcReviewData && (
                <div className={`space-y-2 ${isMobile ? 'bg-white rounded-lg p-3 border' : 'space-y-3'}`}>
                  <h4 className={`font-semibold text-gray-900 flex items-center gap-2 ${isMobile ? 'text-sm' : 'text-sm'}`}>
                    <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600" />
                    QC Review Details
                  </h4>
                  <div className={`space-y-3 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                    {/* QC Decision */}
                    <div className={`bg-red-50 rounded-lg p-3 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                      <div className="font-medium text-red-800 mb-1">QC Decision: Rework Required</div>
                      <div className="text-red-700">
                        Reviewed by: QC Team (ID: {qcReviewData.reviewer_id})
                      </div>
                      <div className="text-red-700">
                        Reviewed on: {new Date(qcReviewData.reviewed_at).toLocaleString()}
                      </div>
                    </div>

                    {/* Issues Found */}
                    {qcReviewData.issues_found && qcReviewData.issues_found.length > 0 && (
                      <div>
                        <div className="font-medium text-gray-900 mb-2">Issues Found:</div>
                        <div className="space-y-1">
                          {qcReviewData.issues_found.map((issue: string, index: number) => (
                            <div key={index} className={`bg-yellow-50 rounded p-2 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                              • {issue.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* QC Comments */}
                    {qcReviewData.comments && (
                      <div>
                        <div className="font-medium text-gray-900 mb-2">QC Comments:</div>
                        <div className={`bg-gray-50 rounded-lg p-3 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                          {qcReviewData.comments}
                        </div>
                      </div>
                    )}

                    {/* Rework Instructions */}
                    {qcReviewData.rework_instructions && (
                      <div>
                        <div className="font-medium text-gray-900 mb-2">Rework Instructions:</div>
                        <div className={`bg-blue-50 rounded-lg p-3 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                          {qcReviewData.rework_instructions}
                        </div>
                      </div>
                    )}

                    {/* Rework Deadline */}
                    {qcReviewData.rework_deadline && (
                      <div>
                        <div className="font-medium text-gray-900 mb-2">Rework Deadline:</div>
                        <div className={`bg-orange-50 rounded-lg p-3 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-orange-600" />
                            <span className="text-orange-800">
                              {new Date(qcReviewData.rework_deadline).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Financial Information */}
              <div className={`bg-green-50 rounded-lg ${isMobile ? 'p-3' : 'p-4'}`}>
                <h4 className={`font-semibold text-gray-900 ${isMobile ? 'text-sm mb-2' : 'text-sm mb-3'}`}>Financial Information</h4>
                <div className={`grid gap-2 ${isMobile ? 'grid-cols-1' : 'grid-cols-3'}`}>
                  <div className={isMobile ? 'text-xs' : 'text-sm'}>
                    <span className="font-medium">Base Rate:</span> ₹{viewingCase.base_rate_inr}
                  </div>
                  <div className={isMobile ? 'text-xs' : 'text-sm'}>
                    <span className="font-medium">Total Rate:</span> ₹{viewingCase.total_rate_inr}
                  </div>
                  <div className={isMobile ? 'text-xs' : 'text-sm'}>
                    <span className="font-medium">Total Rate:</span> ₹{viewingCase.total_rate_inr}
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className={`${isMobile ? 'flex-col gap-2 px-4 pb-4' : 'flex-row justify-between'}`}>
            <div className={`flex gap-2 ${isMobile ? 'w-full' : ''}`}>
              {viewingCase?.status === 'submitted' && (
                <Button 
                  onClick={handleViewSubmission}
                  className={`${isMobile ? 'w-full h-10' : ''} bg-blue-600 hover:bg-blue-700`}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Response
                </Button>
              )}
              
              {/* Debug info for submitted cases */}
              {viewingCase?.status === 'submitted' && (
                <div className={`text-xs text-gray-500 ${isMobile ? 'mt-1' : 'ml-2'}`}>
                  Debug: Case ID: {viewingCase.id}
                </div>
              )}
            </div>
            <Button variant="outline" onClick={() => {
              setViewCaseDialogOpen(false);
              setQcReviewData(null);
            }} className={isMobile ? 'w-full h-10' : ''}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Form Submission Dialog */}
      <Dialog open={viewSubmissionDialogOpen} onOpenChange={setViewSubmissionDialogOpen}>
        <DialogContent className={`${isMobile ? 'max-w-[95vw] max-h-[95vh] mx-2' : 'max-w-6xl max-h-[90vh]'} flex flex-col`}>
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className={isMobile ? 'text-base' : ''}>
              Form Submission Details
            </DialogTitle>
            <DialogDescription className={isMobile ? 'text-sm' : ''}>
              View the submitted form data and files for case {viewingCase?.case_number}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {viewingCase && (
              <DynamicFormSubmission 
                caseId={viewingCase.id} 
                onSubmissionsLoaded={() => {}} 
              />
            )}
          </div>
          <DialogFooter className={`${isMobile ? 'flex-col gap-2 px-4 pb-4' : ''}`}>
            <Button variant="outline" onClick={() => setViewSubmissionDialogOpen(false)} className={isMobile ? 'w-full h-10' : ''}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorDashboard;