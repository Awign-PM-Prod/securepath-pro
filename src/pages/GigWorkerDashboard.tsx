import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, CheckCircle, XCircle, MapPin, User, Building, Phone, Calendar, FileText, AlertCircle } from 'lucide-react';
import { format, differenceInMinutes, addHours } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { gigWorkerService } from '@/services/gigWorkerService';
import NotificationCenter from '@/components/NotificationCenter';
import { DynamicForm } from '@/components/DynamicForm';
import { FormData } from '@/types/form';
import DynamicFormSubmission from '@/components/CaseManagement/DynamicFormSubmission';

interface AllocatedCase {
  id: string;
  case_number: string;
  client_case_id: string;
  contract_type: string;
  candidate_name: string;
  phone_primary: string;
  phone_secondary?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  status: string;
  priority: string;
  vendor_tat_start_date: string;
  due_at: string;
  base_rate_inr: number;
  total_payout_inr: number;
  acceptance_deadline: string;
  is_direct_gig: boolean;
  vendor_id?: string;
  clients: {
    name: string;
  };
  locations: {
    address_line: string;
    city: string;
    state: string;
    pincode: string;
  };
}

interface CaseSubmission {
  caseId: string;
  answers: Record<string, any>;
  notes: string;
  photos: string[];
  submission_lat?: number;
  submission_lng?: number;
  submission_address?: string;
}

export default function GigWorkerDashboard() {
  const [allocatedCases, setAllocatedCases] = useState<AllocatedCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<AllocatedCase | null>(null);
  const [isAcceptDialogOpen, setIsAcceptDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isSubmissionDialogOpen, setIsSubmissionDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionData, setSubmissionData] = useState<CaseSubmission>({
    caseId: '',
    answers: {},
    notes: '',
    photos: []
  });
  const [rejectReason, setRejectReason] = useState('');
  const [gigWorkerId, setGigWorkerId] = useState<string>('');
  const [selectedSubmissionCase, setSelectedSubmissionCase] = useState<AllocatedCase | null>(null);
  const [isViewSubmissionDialogOpen, setIsViewSubmissionDialogOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      initializeGigWorker();
      // Set up interval to check for timeouts every minute
      const interval = setInterval(checkTimeouts, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const initializeGigWorker = async () => {
    try {
      const result = await gigWorkerService.getGigWorkerId(user?.id || '');
      if (result.success && result.gigWorkerId) {
        setGigWorkerId(result.gigWorkerId);
        loadAllocatedCases();
      } else {
        toast({
          title: 'Error',
          description: 'Gig worker profile not found',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error initializing gig worker:', error);
      toast({
        title: 'Error',
        description: 'Failed to initialize gig worker profile',
        variant: 'destructive',
      });
    }
  };

  const loadAllocatedCases = async () => {
    if (!gigWorkerId) return;
    
    try {
      setIsLoading(true);
      const result = await gigWorkerService.getAllocatedCases(gigWorkerId);
      
      if (result.success && result.cases) {
        setAllocatedCases(result.cases);
      } else {
        throw new Error(result.error || 'Failed to load cases');
      }
    } catch (error) {
      console.error('Error loading allocated cases:', error);
      toast({
        title: 'Error',
        description: 'Failed to load allocated cases',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const checkTimeouts = async () => {
    const now = new Date();
    const timeoutCases = allocatedCases.filter(caseItem => {
      if (caseItem.status !== 'auto_allocated') return false;
      const deadline = new Date(caseItem.acceptance_deadline);
      return now > deadline;
    });

    if (timeoutCases.length > 0) {
      // Handle timeout cases
      for (const caseItem of timeoutCases) {
        await handleCaseTimeout(caseItem.id);
      }
      // Reload cases
      loadAllocatedCases();
    }
  };

  const handleCaseTimeout = async (caseId: string) => {
    try {
      // Update case status to created and remove assignee
      const { error: caseError } = await supabase
        .from('cases')
        .update({
          status: 'created',
          current_assignee_id: null,
          current_assignee_type: null,
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
          reallocation_reason: 'Not accepted within 1 hour'
        })
        .eq('case_id', caseId)
        .eq('decision', 'allocated');

      if (logError) throw logError;

      // Free up capacity
      const { error: capacityError } = await supabase
        .rpc('free_capacity', {
          p_gig_partner_id: (await getGigWorkerId()),
          p_case_id: caseId,
          p_reason: 'Case timeout - not accepted'
        });

      if (capacityError) {
        console.warn('Could not free capacity:', capacityError);
      }

      toast({
        title: 'Case Timeout',
        description: 'Case was not accepted within 1 hour and has been unassigned',
        variant: 'destructive',
      });
    } catch (error) {
      console.error('Error handling case timeout:', error);
    }
  };


  const handleAcceptCase = async () => {
    if (!selectedCase || !gigWorkerId) return;

    try {
      const result = await gigWorkerService.acceptCase({
        caseId: selectedCase.id,
        gigWorkerId: gigWorkerId
      });

      if (result.success) {
        toast({
          title: 'Case Accepted',
          description: 'You have successfully accepted the case',
        });
        setIsAcceptDialogOpen(false);
        setSelectedCase(null);
        loadAllocatedCases();
      } else {
        throw new Error(result.error || 'Failed to accept case');
      }
    } catch (error) {
      console.error('Error accepting case:', error);
      toast({
        title: 'Error',
        description: 'Failed to accept case',
        variant: 'destructive',
      });
    }
  };

  const handleRejectCase = async () => {
    if (!selectedCase || !gigWorkerId) return;

    try {
      const result = await gigWorkerService.rejectCase({
        caseId: selectedCase.id,
        gigWorkerId: gigWorkerId,
        reason: rejectReason || 'Rejected by gig worker'
      });

      if (result.success) {
        toast({
          title: 'Case Rejected',
          description: 'You have rejected the case',
        });
        setIsRejectDialogOpen(false);
        setSelectedCase(null);
        setRejectReason('');
        loadAllocatedCases();
      } else {
        throw new Error(result.error || 'Failed to reject case');
      }
    } catch (error) {
      console.error('Error rejecting case:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject case',
        variant: 'destructive',
      });
    }
  };

  const handleSubmitCase = async () => {
    if (!selectedCase || !gigWorkerId) return;

    try {
      setIsSubmitting(true);
      const result = await gigWorkerService.submitCase({
        caseId: selectedCase.id,
        gigWorkerId: gigWorkerId,
        answers: submissionData.answers,
        notes: submissionData.notes,
        photos: submissionData.photos,
        submissionLat: submissionData.submission_lat,
        submissionLng: submissionData.submission_lng,
        submissionAddress: submissionData.submission_address
      });

      if (result.success) {
        toast({
          title: 'Case Submitted',
          description: 'Your case submission has been received',
        });
        setIsSubmissionDialogOpen(false);
        setSelectedCase(null);
        setSubmissionData({
          caseId: '',
          answers: {},
          notes: '',
          photos: []
        });
        loadAllocatedCases();
      } else {
        throw new Error(result.error || 'Failed to submit case');
      }
    } catch (error) {
      console.error('Error submitting case:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit case',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDynamicFormSubmit = async (formData: FormData) => {
    if (!selectedCase || !gigWorkerId) return;

    setIsSubmitting(true);
    try {
      const result = await gigWorkerService.submitCase({
        caseId: selectedCase.id,
        gigWorkerId,
        formData: formData,
        notes: '', // Will be handled by the form
        submissionLat: 0, // Will be handled by the form
        submissionLng: 0, // Will be handled by the form
        submissionAddress: '', // Will be handled by the form
      });

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Case submitted successfully!',
        });
        setIsSubmissionDialogOpen(false);
        loadAllocatedCases();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to submit case',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error submitting case:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'auto_allocated':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Pending Acceptance</Badge>;
      case 'accepted':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Accepted</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="bg-green-100 text-green-800">In Progress</Badge>;
      case 'submitted':
        return <Badge variant="outline" className="bg-purple-100 text-purple-800">Submitted</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="destructive">Urgent</Badge>;
      case 'high':
        return <Badge variant="destructive" className="bg-orange-500">High</Badge>;
      case 'medium':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Medium</Badge>;
      case 'low':
        return <Badge variant="outline" className="bg-green-100 text-green-800">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getTimeRemaining = (deadline: string) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffMinutes = differenceInMinutes(deadlineDate, now);
    
    if (diffMinutes <= 0) return 'Expired';
    if (diffMinutes < 60) return `${diffMinutes}m remaining`;
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return `${hours}h ${minutes}m remaining`;
  };

  const isExpired = (deadline: string) => {
    return new Date() > new Date(deadline);
  };

  const pendingCases = allocatedCases.filter(c => c.status === 'auto_allocated');
  const acceptedCases = allocatedCases.filter(c => c.status === 'accepted');
  const inProgressCases = allocatedCases.filter(c => c.status === 'in_progress');
  const submittedCases = allocatedCases.filter(c => c.status === 'submitted');

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gig Worker Dashboard</CardTitle>
          <CardDescription>Loading your allocated cases...</CardDescription>
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
    <div className="space-y-6">
      {/* Notification Center */}
      {gigWorkerId && (
        <NotificationCenter gigWorkerId={gigWorkerId} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>My Allocated Cases</CardTitle>
          <CardDescription>
            Manage your assigned background verification cases
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="pending">
                Pending ({pendingCases.length})
              </TabsTrigger>
              <TabsTrigger value="accepted">
                Accepted ({acceptedCases.length})
              </TabsTrigger>
              <TabsTrigger value="in_progress">
                In Progress ({inProgressCases.length})
              </TabsTrigger>
              <TabsTrigger value="submitted">
                Submitted ({submittedCases.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-4">
              {pendingCases.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No pending cases to accept or reject.
                  </AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Case Number</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Payout</TableHead>
                      <TableHead>Time Remaining</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingCases.map((caseItem) => (
                      <TableRow key={caseItem.id}>
                        <TableCell className="font-medium">
                          {caseItem.case_number}
                        </TableCell>
                        <TableCell>{caseItem.clients?.name}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{caseItem.candidate_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {caseItem.phone_primary}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{caseItem.locations?.city}</div>
                            <div className="text-muted-foreground">
                              {caseItem.locations?.pincode}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
{caseItem.is_direct_gig ? `₹${caseItem.total_payout_inr}` : 'Contact Vendor'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className={`text-sm ${isExpired(caseItem.acceptance_deadline) ? 'text-red-600' : 'text-orange-600'}`}>
                            {getTimeRemaining(caseItem.acceptance_deadline)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedCase(caseItem);
                                setIsAcceptDialogOpen(true);
                              }}
                              disabled={isExpired(caseItem.acceptance_deadline)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedCase(caseItem);
                                setIsRejectDialogOpen(true);
                              }}
                              disabled={isExpired(caseItem.acceptance_deadline)}
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
            </TabsContent>

            <TabsContent value="accepted" className="space-y-4">
              {acceptedCases.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No accepted cases. Accept cases from the Pending tab to start working on them.
                  </AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Case Number</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Payout</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {acceptedCases.map((caseItem) => (
                      <TableRow key={caseItem.id}>
                        <TableCell className="font-medium">
                          {caseItem.case_number}
                        </TableCell>
                        <TableCell>{caseItem.clients?.name}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{caseItem.candidate_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {caseItem.phone_primary}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{caseItem.locations?.city}</div>
                            <div className="text-muted-foreground">
                              {caseItem.locations?.pincode}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
{caseItem.is_direct_gig ? `₹${caseItem.total_payout_inr}` : 'Contact Vendor'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {format(new Date(caseItem.due_at), 'MMM dd, yyyy HH:mm')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedCase(caseItem);
                              setIsSubmissionDialogOpen(true);
                            }}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Submit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="in_progress" className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  In Progress cases will be shown here once you start working on them.
                </AlertDescription>
              </Alert>
            </TabsContent>

            <TabsContent value="submitted" className="space-y-4">
              {submittedCases.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No submitted cases yet. Submit cases from the Accepted tab.
                  </AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Case Number</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Payout</TableHead>
                      <TableHead>Submitted At</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submittedCases.map((caseItem) => (
                      <TableRow key={caseItem.id}>
                        <TableCell className="font-medium">
                          {caseItem.case_number}
                        </TableCell>
                        <TableCell>{caseItem.clients?.name}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{caseItem.candidate_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {caseItem.phone_primary}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{caseItem.locations?.city}</div>
                            <div className="text-muted-foreground">
                              {caseItem.locations?.pincode}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
{caseItem.is_direct_gig ? `₹${caseItem.total_payout_inr}` : 'Contact Vendor'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {format(new Date(caseItem.vendor_tat_start_date), 'MMM dd, yyyy HH:mm')}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(caseItem.status)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedSubmissionCase(caseItem);
                              setIsViewSubmissionDialogOpen(true);
                            }}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            View Submission
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Accept Case Dialog */}
      <Dialog open={isAcceptDialogOpen} onOpenChange={setIsAcceptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept Case</DialogTitle>
            <DialogDescription>
              Are you sure you want to accept this case? You will be responsible for completing it within the specified timeframe.
            </DialogDescription>
          </DialogHeader>
          {selectedCase && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Case Number:</span> {selectedCase.case_number}
                </div>
                <div>
                  <span className="font-medium">Client:</span> {selectedCase.clients?.name}
                </div>
                <div>
                  <span className="font-medium">Candidate:</span> {selectedCase.candidate_name}
                </div>
                <div>
                  <span className="font-medium">Location:</span> {selectedCase.locations?.city}
                </div>
                <div>
                  <span className="font-medium">Payout:</span> {selectedCase.is_direct_gig ? `₹${selectedCase.total_payout_inr}` : 'Contact Vendor'}
                </div>
                <div>
                  <span className="font-medium">Due Date:</span> {format(new Date(selectedCase.due_at), 'MMM dd, yyyy HH:mm')}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAcceptDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAcceptCase}>
              Accept Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Case Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Case</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this case. The case will be reassigned to another gig worker.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Reason for rejection:</label>
              <textarea
                className="w-full mt-1 p-2 border rounded-md"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Please provide a reason for rejecting this case..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRejectCase}>
              Reject Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit Case Dialog */}
      <Dialog open={isSubmissionDialogOpen} onOpenChange={setIsSubmissionDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submit Case</DialogTitle>
            <DialogDescription>
              Fill in the verification details and submit your findings.
            </DialogDescription>
          </DialogHeader>
          {selectedCase && (
            <DynamicForm
              contractTypeId={selectedCase.contract_type}
              caseId={selectedCase.id}
              gigWorkerId={gigWorkerId}
              onSubmit={handleDynamicFormSubmit}
              onCancel={() => setIsSubmissionDialogOpen(false)}
              loading={isSubmitting}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* View Form Submission Dialog */}
      <Dialog open={isViewSubmissionDialogOpen} onOpenChange={setIsViewSubmissionDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Form Submission Details</DialogTitle>
            <DialogDescription>
              View the submitted form data and files for this case.
            </DialogDescription>
          </DialogHeader>
          {selectedSubmissionCase && (
            <DynamicFormSubmission caseId={selectedSubmissionCase.id} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewSubmissionDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
