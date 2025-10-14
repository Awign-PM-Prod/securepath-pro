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
  
  // Assignment dialog state
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<string>('');
  const [selectedGigWorker, setSelectedGigWorker] = useState<string>('');
  const [reassignmentDialogOpen, setReassignmentDialogOpen] = useState(false);
  const [reassignCaseId, setReassignCaseId] = useState<string>('');

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

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchVendorId();
      setLoading(false);
    };
    loadData();
  }, []);

  // Load gig workers and cases when vendorId is available
  useEffect(() => {
    console.log('useEffect triggered with vendorId:', vendorId);
    if (vendorId) {
      console.log('Loading gig workers and assigned cases...');
      fetchGigWorkers();
      fetchAssignedCases();
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
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingCases.map((caseItem) => (
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
                              onClick={() => handleAcceptCase(caseItem.id)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRejectCase(caseItem.id)}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
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
    </div>
  );
};

export default VendorDashboard;