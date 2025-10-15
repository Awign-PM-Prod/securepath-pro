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
  Plus,
  Eye,
  UserCheck,
  ArrowRightLeft,
  Loader2
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
}

const VendorDashboard: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // State
  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [gigWorkers, setGigWorkers] = useState<GigWorker[]>([]);
  const [assignedCases, setAssignedCases] = useState<Case[]>([]);
  const [pendingCases, setPendingCases] = useState<Case[]>([]);
  const [inProgressCases, setInProgressCases] = useState<Case[]>([]);
  const [unassignedCases, setUnassignedCases] = useState<Case[]>([]);
  
  // Assignment dialog state
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<string>('');
  const [selectedGigWorker, setSelectedGigWorker] = useState<string>('');
  const [reassignmentDialogOpen, setReassignmentDialogOpen] = useState(false);
  const [reassignCaseId, setReassignCaseId] = useState<string>('');
  const [vendorAssignCaseId, setVendorAssignCaseId] = useState<string>('');
  const [vendorAssignmentDialogOpen, setVendorAssignmentDialogOpen] = useState(false);

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
      setInProgressCases(cases.filter(c => ['accepted', 'in_progress', 'submitted'].includes(c.status)));
      
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
          status: 'in_progress',
          status_updated_at: new Date().toISOString()
        })
        .eq('id', caseId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Case accepted successfully',
      });

      fetchAssignedCases();
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
    try {
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
          locations!inner(address_line, city, state, pincode),
          clients!inner(name, email)
        `)
        .eq('status', 'created')
        .is('current_assignee_id', null)
        .is('current_vendor_id', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const cases = data?.map(c => ({
        ...c,
        address_line: c.locations.address_line,
        city: c.locations.city,
        state: c.locations.state,
        pincode: c.locations.pincode,
        client_name: c.clients.name,
        client_email: c.clients.email
      })) || [];
      
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
      <div className="p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Vendor information not found. Please contact support.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vendor Dashboard</h1>
          <p className="text-muted-foreground">Manage your gig workers and case assignments</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assignedCases.length}</div>
            <p className="text-xs text-muted-foreground">All assigned cases</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">Pending Cases ({pendingCases.length})</TabsTrigger>
          <TabsTrigger value="in-progress">In Progress ({inProgressCases.length})</TabsTrigger>
          <TabsTrigger value="unassigned">Unassigned Cases</TabsTrigger>
          <TabsTrigger value="gig-workers">Gig Workers ({gigWorkers.length})</TabsTrigger>
        </TabsList>

        {/* Pending Cases Tab */}
        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Cases</CardTitle>
              <CardDescription>
                Cases assigned to you that need acceptance or rejection
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingCases.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pending cases
                </div>
              ) : (
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
                            <div className="flex space-x-2">
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
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* In Progress Cases Tab */}
        <TabsContent value="in-progress" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>In Progress Cases</CardTitle>
              <CardDescription>
                Cases currently being worked on by your gig workers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inProgressCases.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No cases in progress
                </div>
              ) : (
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
                    {inProgressCases.map((caseItem) => {
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
                              caseItem.status === 'in_progress' ? 'secondary' : 'outline'
                            }>
                              {caseItem.status.replace('_', ' ')}
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
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedCase(caseItem.id);
                                  setAssignmentDialogOpen(true);
                                }}
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Unassigned Cases Tab */}
        <TabsContent value="unassigned" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Unassigned Cases</CardTitle>
              <CardDescription>
                Cases available for assignment to your vendor or gig workers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {unassignedCases.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No unassigned cases available
                </div>
              ) : (
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
                              onClick={() => {
                                setSelectedCase(caseItem.id);
                                setAssignmentDialogOpen(true);
                              }}
                            >
                              <Users className="h-4 w-4 mr-1" />
                              Assign to Gig Worker
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gig Workers Tab */}
        <TabsContent value="gig-workers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gig Workers</CardTitle>
              <CardDescription>
                Manage your gig workers and their capacity
              </CardDescription>
            </CardHeader>
            <CardContent>
              {gigWorkers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No gig workers found
                </div>
              ) : (
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assignment Dialog */}
      <Dialog open={assignmentDialogOpen} onOpenChange={setAssignmentDialogOpen}>
        <DialogContent>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignmentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignCase}>
              Assign Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassignment Dialog */}
      <Dialog open={reassignmentDialogOpen} onOpenChange={setReassignmentDialogOpen}>
        <DialogContent>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignmentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReassignCase}>
              Reassign Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vendor Assignment Dialog */}
      <Dialog open={vendorAssignmentDialogOpen} onOpenChange={setVendorAssignmentDialogOpen}>
        <DialogContent>
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
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setVendorAssignmentDialogOpen(false)}
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
              className="bg-blue-600 hover:bg-blue-700"
            >
              Assign to Vendor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorDashboard;