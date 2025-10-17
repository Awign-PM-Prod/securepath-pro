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
  UserPlus
} from 'lucide-react';

interface GigWorker {
  id: string;
  user_id: string;
  profile_id: string;
  phone: string;
  alternate_phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country: string;
  coverage_pincodes: string[];
  max_daily_capacity: number;
  capacity_available: number;
  last_capacity_reset: string;
  completion_rate: number;
  ontime_completion_rate: number;
  acceptance_rate: number;
  quality_score: number;
  qc_pass_count: number;
  total_cases_completed: number;
  active_cases_count: number;
  last_assignment_at?: string;
  vendor_id: string;
  is_direct_gig: boolean;
  device_info?: any;
  last_seen_at?: string;
  is_active: boolean;
  is_available: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface Case {
  id: string;
  case_number: string;
  title: string;
  description: string;
  priority: string;
  source: string;
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
  rate_adjustments: any;
  total_rate_inr: number;
  visible_to_gig: boolean;
  created_by: string;
  last_updated_by?: string;
  updated_at: string;
  metadata: any;
  client_case_id: string;
  travel_allowance_inr: number;
  bonus_inr: number;
  instructions?: string;
  contract_type: string;
  candidate_name: string;
  phone_primary: string;
  phone_secondary?: string;
  vendor_tat_start_date: string;
  penalty_inr: number;
  total_payout_inr: number;
  address_line: string;
  city: string;
  state: string;
  pincode: string;
  acceptance_deadline?: string;
  client_name: string;
  client_email: string;
  // New fields for QC dashboard
  assigned_at?: string;
  submitted_at?: string;
  QC_Response?: 'Rework' | 'Approved' | 'Rejected' | 'New';
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
  const [vendorAssignCaseId, setVendorAssignCaseId] = useState<string>('');
  const [vendorAssignmentDialogOpen, setVendorAssignmentDialogOpen] = useState(false);
  
  // View case dialog state
  const [viewCaseDialogOpen, setViewCaseDialogOpen] = useState(false);
  const [viewingCase, setViewingCase] = useState<Case | null>(null);
  const [qcReviewData, setQcReviewData] = useState<any>(null);

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
        .rpc('get_vendor_gig_workers', { vendor_uuid: vendorId });

      if (error) {
        console.error('Supabase query error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        throw error;
      }
      console.log('Gig workers fetched:', data);
      console.log('Number of gig workers:', data?.length || 0);
      setGigWorkers(data || []);
    } catch (error) {
      console.error('Error fetching gig workers:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch gig workers',
        variant: 'destructive',
      });
    }
  };

  // Fetch assigned cases
  const fetchAssignedCases = async () => {
    if (!vendorId) {
      setAssignedCases([]);
      setPendingCases([]);
      setInProgressCases([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .rpc('get_vendor_assigned_cases', { vendor_uuid: vendorId });

      if (error) throw error;
      
      const cases = data || [];
      setAssignedCases(cases);
      
      // Categorize cases by status
      setPendingCases(cases.filter(c => c.status === 'auto_allocated'));
      setInProgressCases(cases.filter(c => ['in_progress', 'submitted', 'qc_rework'].includes(c.status)));
      
    } catch (error) {
      console.error('Error fetching assigned cases:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch assigned cases',
        variant: 'destructive',
      });
    }
  };

  // Accept case
  const handleAcceptCase = async (caseId: string) => {
    try {
      const { error } = await supabase
        .from('cases')
        .update({ 
          status: 'accepted',
          current_assignee_id: null, // Clear assignee so it appears in unassigned cases
          status_updated_at: new Date().toISOString()
        })
        .eq('id', caseId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Case accepted successfully and moved to unassigned cases',
      });

      // Refresh both assigned cases and unassigned cases
      fetchAssignedCases();
      fetchUnassignedCases();
    } catch (error) {
      console.error('Error accepting case:', error);
      toast({
        title: 'Error',
        description: 'Failed to accept case',
        variant: 'destructive',
      });
    }
  };

  // Reject case
  const handleRejectCase = async (caseId: string) => {
    try {
      const { error } = await supabase
        .from('cases')
        .update({ 
          status: 'created',
          current_vendor_id: null,
          status_updated_at: new Date().toISOString()
        })
        .eq('id', caseId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Case rejected and returned to pool',
      });

      fetchAssignedCases();
    } catch (error) {
      console.error('Error rejecting case:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject case',
        variant: 'destructive',
      });
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
      const { error } = await supabase
        .rpc('assign_case_to_gig_worker', {
          p_case_id: selectedCase,
          p_gig_worker_id: selectedGigWorker,
          p_vendor_id: vendorId
        });

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
      toast({
        title: 'Error',
        description: 'Failed to assign case',
        variant: 'destructive',
      });
    }
  };

  // Fetch QC review data for a case
  const fetchQcReviewData = async (caseId: string) => {
    try {
      const { data, error } = await supabase
        .from('qc_reviews')
        .select('*')
        .eq('case_id', caseId)
        .order('reviewed_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching QC review data:', error);
        return null;
      }

      // If data is an array, take the first (most recent) item
      return data && data.length > 0 ? data[0] : null;
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

  // Assign case to vendor with 30-minute timer
  const handleAssignCaseToVendor = async (caseId: string) => {
    if (!vendorId) {
      toast({
        title: 'Error',
        description: 'Vendor ID not found',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Get case details for pincode and tier
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .select('id, pincode, pincode_tier')
        .eq('id', caseId)
        .single();

      if (caseError || !caseData) {
        toast({
          title: 'Error',
          description: 'Case not found',
          variant: 'destructive',
        });
        return;
      }

      const result = await allocationService.allocateCaseToVendor({
        caseId: caseId,
        vendorId: vendorId,
        pincode: caseData.pincode || '',
        pincodeTier: caseData.pincode_tier || 'tier_1'
      });

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Case assigned to vendor with 30-minute acceptance window',
        });
        fetchAssignedCases();
        fetchUnassignedCases(); // Refresh unassigned cases
        fetchReworkCases(); // Refresh rework cases
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to assign case to vendor',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error assigning case to vendor:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign case to vendor',
        variant: 'destructive',
      });
    }
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
        .rpc('assign_case_to_gig_worker', {
          p_case_id: reassignCaseId,
          p_gig_worker_id: selectedGigWorker,
          p_vendor_id: vendorId
        });

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
      toast({
        title: 'Error',
        description: 'Failed to reassign case',
        variant: 'destructive',
      });
    }
  };

  // Fetch unassigned cases
  const fetchUnassignedCases = async () => {
    if (!vendorId) {
      setUnassignedCases([]);
      return;
    }

    try {
      // Query 1: Global unassigned cases (status = 'created', no vendor, no assignee)
      const { data: globalCases, error: globalError } = await supabase
        .from('cases')
        .select(`
          id,
          case_number,
          title,
          description,
          priority,
          source,
          client_id,
          location_id,
          tat_hours,
          due_at,
          created_at,
          status,
          status_updated_at,
          base_rate_inr,
          rate_adjustments,
          total_rate_inr,
          visible_to_gig,
          created_by,
          last_updated_by,
          updated_at,
          metadata,
          client_case_id,
          travel_allowance_inr,
          bonus_inr,
          instructions,
          contract_type,
          candidate_name,
          phone_primary,
          phone_secondary,
          vendor_tat_start_date,
          penalty_inr,
          total_payout_inr,
          current_vendor_id,
          locations!inner(address_line, city, state, pincode),
          clients!inner(name, email)
        `)
        .eq('status', 'created')
        .is('current_assignee_id', null)
        .is('current_vendor_id', null)
        .order('created_at', { ascending: false });

      if (globalError) throw globalError;

      // Query 2: Vendor's accepted cases (status = 'accepted', vendor assigned, no gig worker)
      const { data: vendorCases, error: vendorError } = await supabase
        .from('cases')
        .select(`
          id,
          case_number,
          title,
          description,
          priority,
          source,
          client_id,
          location_id,
          tat_hours,
          due_at,
          created_at,
          status,
          status_updated_at,
          base_rate_inr,
          rate_adjustments,
          total_rate_inr,
          visible_to_gig,
          created_by,
          last_updated_by,
          updated_at,
          metadata,
          client_case_id,
          travel_allowance_inr,
          bonus_inr,
          instructions,
          contract_type,
          candidate_name,
          phone_primary,
          phone_secondary,
          vendor_tat_start_date,
          penalty_inr,
          total_payout_inr,
          current_vendor_id,
          locations!inner(address_line, city, state, pincode),
          clients!inner(name, email)
        `)
        .eq('status', 'accepted')
        .is('current_assignee_id', null)
        .eq('current_vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (vendorError) throw vendorError;

      // Query 3: Any other cases that might be available for assignment
      // This is a fallback to catch cases that might be in unexpected statuses
      const { data: otherCases, error: otherError } = await supabase
        .from('cases')
        .select(`
          id,
          case_number,
          title,
          description,
          priority,
          source,
          client_id,
          location_id,
          tat_hours,
          due_at,
          created_at,
          status,
          status_updated_at,
          base_rate_inr,
          rate_adjustments,
          total_rate_inr,
          visible_to_gig,
          created_by,
          last_updated_by,
          updated_at,
          metadata,
          client_case_id,
          travel_allowance_inr,
          bonus_inr,
          instructions,
          contract_type,
          candidate_name,
          phone_primary,
          phone_secondary,
          vendor_tat_start_date,
          penalty_inr,
          total_payout_inr,
          current_vendor_id,
          locations!inner(address_line, city, state, pincode),
          clients!inner(name, email)
        `)
        .is('current_assignee_id', null)
        .or(`current_vendor_id.is.null,current_vendor_id.eq.${vendorId}`)
        .not('status', 'in', '(auto_allocated,in_progress,submitted,qc_pending,qc_passed,qc_approved,qc_rejected,qc_rework,completed,reported,in_payment_cycle,cancelled)')
        .order('created_at', { ascending: false });

      if (otherError) {
        console.warn('Error fetching other cases:', otherError);
      }

      console.log('Global unassigned cases:', globalCases);
      console.log('Vendor accepted cases:', vendorCases);
      console.log('Other available cases:', otherCases);
      console.log('Vendor ID:', vendorId);
      
      // Combine all results and remove duplicates
      const allCases = [...(globalCases || []), ...(vendorCases || []), ...(otherCases || [])];
      const uniqueCases = allCases.filter((caseItem, index, self) => 
        index === self.findIndex(c => c.id === caseItem.id)
      );
      
      const cases = uniqueCases.map(c => ({
        ...c,
        address_line: c.locations.address_line,
        city: c.locations.city,
        state: c.locations.state,
        pincode: c.locations.pincode,
        client_name: c.clients.name,
        client_email: c.clients.email
      }));
      
      console.log('Combined unassigned cases:', cases);
      
      // Debug: Also log all cases for this vendor to understand what's available
      const { data: allVendorCases, error: debugError } = await supabase
        .from('cases')
        .select('id, case_number, status, current_vendor_id, current_assignee_id')
        .or(`current_vendor_id.eq.${vendorId},current_vendor_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (!debugError) {
        console.log('All vendor-related cases (debug):', allVendorCases);
      }
      
      setUnassignedCases(cases);
    } catch (error) {
      console.error('Error fetching unassigned cases:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch unassigned cases',
        variant: 'destructive',
      });
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
      // First, let's check all cases with QC_Response = 'Rework' regardless of vendor
      const { data: allReworkCases, error: allReworkError } = await supabase
        .from('cases')
        .select('id, case_number, "QC_Response", current_vendor_id, status')
        .eq('"QC_Response"', 'Rework');

      // Also try without quotes
      const { data: allReworkCases2, error: allReworkError2 } = await supabase
        .from('cases')
        .select('id, case_number, QC_Response, current_vendor_id, status')
        .eq('QC_Response', 'Rework');

      console.log('All rework cases in database (with quotes):', allReworkCases);
      console.log('All rework cases error (with quotes):', allReworkError);
      console.log('All rework cases in database (without quotes):', allReworkCases2);
      console.log('All rework cases error (without quotes):', allReworkError2);

      // Now check cases for this specific vendor
      const { data: vendorReworkCases, error: vendorReworkError } = await supabase
        .from('cases')
        .select('id, case_number, "QC_Response", current_vendor_id, status')
        .eq('current_vendor_id', vendorId)
        .eq('"QC_Response"', 'Rework');

      console.log('Vendor-specific rework cases:', vendorReworkCases);
      console.log('Vendor-specific rework cases error:', vendorReworkError);

      // Also try without quotes to see if that makes a difference
      const { data: vendorReworkCases2, error: vendorReworkError2 } = await supabase
        .from('cases')
        .select('id, case_number, QC_Response, current_vendor_id, status')
        .eq('current_vendor_id', vendorId)
        .eq('QC_Response', 'Rework');

      console.log('Vendor-specific rework cases (no quotes):', vendorReworkCases2);
      console.log('Vendor-specific rework cases error (no quotes):', vendorReworkError2);

      // Let's also check what QC_Response values actually exist for this vendor
      const { data: qcResponseValues, error: qcResponseError } = await supabase
        .from('cases')
        .select('"QC_Response"')
        .eq('current_vendor_id', vendorId)
        .not('"QC_Response"', 'is', null);

      console.log('QC_Response values for this vendor:', qcResponseValues);
      console.log('QC_Response values error:', qcResponseError);

      // Check all cases for this vendor to see what QC_Response values exist
      const { data: allVendorCases, error: allVendorError } = await supabase
        .from('cases')
        .select('id, case_number, "QC_Response", current_vendor_id, status')
        .eq('current_vendor_id', vendorId);

      console.log('All cases for this vendor:', allVendorCases);
      console.log('All cases for this vendor error:', allVendorError);

      // Use the vendor-specific rework cases we already found and get full details
      // Try both queries and use whichever one works
      const workingReworkCases = vendorReworkCases && vendorReworkCases.length > 0 ? vendorReworkCases : 
                                 vendorReworkCases2 && vendorReworkCases2.length > 0 ? vendorReworkCases2 : [];
      
      console.log('Working rework cases to process:', workingReworkCases);
      
      if (workingReworkCases.length > 0) {
        const reworkCaseIds = workingReworkCases.map(c => c.id);
        console.log('Rework case IDs to fetch:', reworkCaseIds);
        
        // Try a simpler query without the problematic joins first
        const { data: simpleData, error: simpleError } = await supabase
          .from('cases')
          .select(`
            id,
            case_number,
            title,
            description,
            priority,
            source,
            client_id,
            location_id,
            tat_hours,
            due_at,
            created_at,
            status,
            status_updated_at,
            base_rate_inr,
            rate_adjustments,
            total_rate_inr,
            visible_to_gig,
            created_by,
            last_updated_by,
            updated_at,
            metadata,
            client_case_id,
            travel_allowance_inr,
            bonus_inr,
            instructions,
            contract_type,
            candidate_name,
            phone_primary,
            phone_secondary,
            vendor_tat_start_date,
            penalty_inr,
            total_payout_inr,
            current_vendor_id,
            current_assignee_id,
            "QC_Response"
          `)
          .in('id', reworkCaseIds)
          .order('created_at', { ascending: false });

        console.log('Simple rework cases query result:', simpleData);
        console.log('Simple rework cases query error:', simpleError);

        if (simpleError) {
          console.error('Simple query failed:', simpleError);
          throw simpleError;
        }
        
        if (simpleData && simpleData.length > 0) {
          // Now fetch location and client data separately
          const locationIds = [...new Set(simpleData.map(c => c.location_id))];
          const clientIds = [...new Set(simpleData.map(c => c.client_id))];
          
          console.log('Location IDs:', locationIds);
          console.log('Client IDs:', clientIds);
          
          // Fetch locations
          const { data: locations, error: locationError } = await supabase
            .from('locations')
            .select('id, address_line, city, state, pincode')
            .in('id', locationIds);
          
          console.log('Locations data:', locations);
          console.log('Location error:', locationError);
          
          // Fetch clients
          const { data: clients, error: clientError } = await supabase
            .from('clients')
            .select('id, name, email')
            .in('id', clientIds);
          
          console.log('Clients data:', clients);
          console.log('Client error:', clientError);
          
          // Create lookup maps
          const locationMap = (locations || []).reduce((acc, loc) => {
            acc[loc.id] = loc;
            return acc;
          }, {});
          
          const clientMap = (clients || []).reduce((acc, client) => {
            acc[client.id] = client;
            return acc;
          }, {});
          
          // Combine the data
          const cases = simpleData.map(c => {
            const location = locationMap[c.location_id];
            const client = clientMap[c.client_id];
            
            return {
              ...c,
              address_line: location?.address_line || '',
              city: location?.city || '',
              state: location?.state || '',
              pincode: location?.pincode || '',
              client_name: client?.name || '',
              client_email: client?.email || ''
            };
          });
          
          console.log('Processed rework cases:', cases);
          setReworkCases(cases);
        } else {
          console.log('No data returned from simple query');
          setReworkCases([]);
        }
      } else {
        console.log('No vendor-specific rework cases found via direct query');
        
        // Fallback: manually filter from allVendorCases
        if (allVendorCases && allVendorCases.length > 0) {
          const manualReworkCases = allVendorCases.filter(c => c.QC_Response === 'Rework');
          console.log('Manual filter rework cases:', manualReworkCases);
          
          if (manualReworkCases.length > 0) {
            const manualReworkCaseIds = manualReworkCases.map(c => c.id);
            
            const { data, error } = await supabase
              .from('cases')
              .select(`
                id,
                case_number,
                title,
                description,
                priority,
                source,
                client_id,
                location_id,
                tat_hours,
                due_at,
                created_at,
                status,
                status_updated_at,
                base_rate_inr,
                rate_adjustments,
                total_rate_inr,
                visible_to_gig,
                created_by,
                last_updated_by,
                updated_at,
                metadata,
                client_case_id,
                travel_allowance_inr,
                bonus_inr,
                instructions,
                contract_type,
                candidate_name,
                phone_primary,
                phone_secondary,
                vendor_tat_start_date,
                penalty_inr,
                total_payout_inr,
                current_vendor_id,
                current_assignee_id,
                "QC_Response",
                locations!inner(address_line, city, state, pincode),
                clients!inner(name, email)
              `)
              .in('id', manualReworkCaseIds)
              .order('created_at', { ascending: false });

            console.log('Manual fallback query result:', data);
            console.log('Manual fallback query error:', error);

            if (!error && data) {
              const cases = data.map(c => ({
                ...c,
                address_line: c.locations.address_line,
                city: c.locations.city,
                state: c.locations.state,
                pincode: c.locations.pincode,
                client_name: c.clients.name,
                client_email: c.clients.email
              }));
              
              console.log('Manual fallback processed rework cases:', cases);
              setReworkCases(cases);
            } else {
              console.log('Manual fallback also failed, setting empty array');
              setReworkCases([]);
            }
          } else {
            console.log('No rework cases found in manual filter either');
            setReworkCases([]);
          }
        } else {
          console.log('No vendor cases found for manual filtering');
          setReworkCases([]);
        }
      }
    } catch (error) {
      console.error('Error fetching rework cases:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch rework cases',
        variant: 'destructive',
      });
    }
  };

  // Check for case timeouts
  const checkTimeouts = async () => {
    const now = new Date();
    const timeoutCases = pendingCases.filter(caseItem => {
      if (caseItem.status !== 'auto_allocated') return false;
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
  };

  // Handle case timeout
  const handleCaseTimeout = async (caseId: string) => {
    try {
      // Update case status to created and remove assignee
      const { error: caseError } = await supabase
        .from('cases')
        .update({
          status: 'created',
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
          decision: 'timeout',
          decision_at: new Date().toISOString(),
          reallocation_reason: 'Not accepted within 30 minutes'
        })
        .eq('case_id', caseId)
        .eq('decision', 'allocated');

      if (logError) throw logError;

      // Free up vendor capacity
      if (vendorId) {
        const { error: capacityError } = await supabase.rpc('free_vendor_capacity', {
          p_vendor_id: vendorId,
          p_case_id: caseId,
          p_reason: 'Case timeout - not accepted'
        });

        if (capacityError) {
          console.warn('Could not free vendor capacity:', capacityError);
        }
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
  const MobileCaseCard = ({ caseItem, onAccept, onReject, onAssign, onReassign, onView, showActions = true }: {
    caseItem: Case;
    onAccept?: () => void;
    onReject?: () => void;
    onAssign?: () => void;
    onReassign?: () => void;
    onView?: () => void;
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

    const isExpired = caseItem.acceptance_deadline && new Date(caseItem.acceptance_deadline) < new Date();
    const timeRemaining = getTimeRemaining(caseItem.acceptance_deadline);

    return (
      <Card className="mb-3 shadow-sm border-0 bg-white">
        <CardHeader className="pb-2 px-4 pt-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-2">
              <CardTitle className="text-base font-semibold text-gray-900 truncate leading-tight">
                {caseItem.case_number}
              </CardTitle>
              <CardDescription className="text-sm text-gray-600 mt-1">
                {caseItem.title}
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-1.5">
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
            {caseItem.acceptance_deadline && (
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
                <p className="font-medium">{caseItem.assigned_at ? formatDate(caseItem.assigned_at) : 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Briefcase className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-muted-foreground">Submitted</p>
                <p className="font-medium">{caseItem.submitted_at ? formatDate(caseItem.submitted_at) : 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-muted-foreground">Time Taken</p>
                <p className="font-medium">{getTimeTaken(caseItem.assigned_at, caseItem.submitted_at)}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          {showActions && (
            <div className="flex gap-2 pt-1">
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
              <CardTitle className={isMobile ? 'text-lg' : ''}>Pending Cases</CardTitle>
              <CardDescription className={isMobile ? 'text-sm' : ''}>
                Cases assigned to you that need acceptance or rejection
              </CardDescription>
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
                          onAccept={caseItem.status === 'auto_allocated' ? () => handleAcceptCase(caseItem.id) : undefined}
                          onReject={caseItem.status === 'auto_allocated' ? () => handleRejectCase(caseItem.id) : undefined}
                          onAssign={caseItem.status === 'qc_rework' ? () => {
                            setSelectedCase(caseItem.id);
                            setAssignmentDialogOpen(true);
                          } : undefined}
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
                      <TableHead>Client</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Time Remaining</TableHead>
                      <TableHead>TAT Hours</TableHead>
                      <TableHead>Assigned On</TableHead>
                      <TableHead>Submitted On</TableHead>
                      <TableHead>Time Taken</TableHead>
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

                      const isExpired = caseItem.acceptance_deadline && new Date(caseItem.acceptance_deadline) < new Date();
                      const timeRemaining = getTimeRemaining(caseItem.acceptance_deadline);

                      return (
                        <TableRow key={caseItem.id} className={isExpired ? 'bg-red-50' : ''}>
                          <TableCell className="font-mono">{caseItem.case_number}</TableCell>
                          <TableCell>{caseItem.title}</TableCell>
                          <TableCell>{caseItem.client_name}</TableCell>
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
                              {caseItem.assigned_at ? formatDate(caseItem.assigned_at) : 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {caseItem.submitted_at ? formatDate(caseItem.submitted_at) : 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {getTimeTaken(caseItem.assigned_at, caseItem.submitted_at)}
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
                Cases currently being worked on by your gig workers, including QC rework cases
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
                      <TableHead>Client</TableHead>
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
                          <TableCell>{caseItem.client_name}</TableCell>
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
                              {caseItem.status === 'qc_rework' && !assignedWorker ? (
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
              <CardTitle className={isMobile ? 'text-lg' : ''}>Unassigned Cases</CardTitle>
              <CardDescription className={isMobile ? 'text-sm' : ''}>
                Cases available for assignment to your vendor or gig workers
              </CardDescription>
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
                            setVendorAssignCaseId(caseItem.id);
                            setVendorAssignmentDialogOpen(true);
                          }}
                          onView={() => handleViewCase(caseItem)}
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
                      <TableHead>Client</TableHead>
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
                        <TableCell>{caseItem.client_name}</TableCell>
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
                                setVendorAssignCaseId(caseItem.id);
                                setVendorAssignmentDialogOpen(true);
                              }}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <Briefcase className="h-4 w-4 mr-1" />
                              Assign to Vendor
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
              <CardTitle className={isMobile ? 'text-lg' : ''}>Rework Cases</CardTitle>
              <CardDescription className={isMobile ? 'text-sm' : ''}>
                Cases that require rework based on QC feedback
              </CardDescription>
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
                          <TableHead>Client</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Assigned To</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reworkCases.map((caseItem) => {
                          const assignedWorker = gigWorkers.find(w => w.id === caseItem.current_assignee_id);
                          return (
                            <TableRow key={caseItem.id}>
                              <TableCell className="font-mono">{caseItem.case_number}</TableCell>
                              <TableCell>{caseItem.title}</TableCell>
                              <TableCell>{caseItem.client_name}</TableCell>
                              <TableCell>
                                {caseItem.city}, {caseItem.state}
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
                                <div className="flex space-x-2">
                                  {!assignedWorker ? (
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
                    .filter(worker => worker.is_available && worker.capacity_available > 0)
                    .map((worker) => (
                      <SelectItem key={worker.id} value={worker.id}>
                        {worker.first_name} {worker.last_name} 
                        {' '}({worker.capacity_available}/{worker.max_daily_capacity} available)
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
                    .filter(worker => worker.is_available && worker.capacity_available > 0)
                    .map((worker) => (
                      <SelectItem key={worker.id} value={worker.id}>
                        {worker.first_name} {worker.last_name} 
                        {' '}({worker.capacity_available}/{worker.max_daily_capacity} available)
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

      {/* Vendor Assignment Dialog */}
      <Dialog open={vendorAssignmentDialogOpen} onOpenChange={setVendorAssignmentDialogOpen}>
        <DialogContent className={isMobile ? 'max-w-[95vw] max-h-[90vh] mx-2 my-2' : ''}>
          <DialogHeader>
            <DialogTitle>Assign Case to Vendor</DialogTitle>
            <DialogDescription>
              This will assign the case to your vendor with a 30-minute acceptance window.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              The case will be assigned to your vendor and you'll have 30 minutes to accept or reject it.
            </p>
          </div>
          <DialogFooter className={isMobile ? 'flex-col gap-2' : ''}>
            <Button
              variant="outline"
              onClick={() => setVendorAssignmentDialogOpen(false)}
              className={isMobile ? 'w-full' : ''}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (vendorAssignCaseId) {
                  handleAssignCaseToVendor(vendorAssignCaseId);
                  setVendorAssignmentDialogOpen(false);
                  setVendorAssignCaseId('');
                }
              }}
              className={`bg-blue-600 hover:bg-blue-700 ${isMobile ? 'w-full' : ''}`}
            >
              Assign to Vendor
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
                    <div className={isMobile ? 'break-words' : ''}><span className="font-medium">Contract Type:</span> {viewingCase.contract_type}</div>
                    <div className={isMobile ? 'break-words' : ''}><span className="font-medium">Source:</span> {viewingCase.source}</div>
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

              {/* Instructions */}
              {viewingCase.instructions && (
                <div className={`space-y-2 ${isMobile ? 'bg-white rounded-lg p-3 border' : 'space-y-3'}`}>
                  <h4 className={`font-semibold text-gray-900 ${isMobile ? 'text-sm' : 'text-sm'}`}>Instructions</h4>
                  <div className={`text-gray-700 bg-blue-50 rounded-lg p-3 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                    {viewingCase.instructions}
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
                    <span className="font-medium">Total Payout:</span> ₹{viewingCase.total_payout_inr}
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className={`${isMobile ? 'flex-col gap-2 px-4 pb-4' : ''}`}>
            <Button variant="outline" onClick={() => {
              setViewCaseDialogOpen(false);
              setQcReviewData(null);
            }} className={isMobile ? 'w-full h-10' : ''}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorDashboard;