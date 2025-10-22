import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { BonusService } from '@/services/bonusService';
import { toast } from 'sonner';
import DynamicFormSubmission from './DynamicFormSubmission';
import { CSVService, FormSubmissionData } from '@/services/csvService';
import { 
  MapPin, 
  Clock, 
  User, 
  Building, 
  Calendar, 
  DollarSign, 
  FileText, 
  Image, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Phone,
  Mail,
  Navigation,
  Download,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';

interface CaseDetailProps {
  caseData: {
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
      email: string;
      phone?: string;
      contact_person?: string;
    };
    location: {
      address_line: string;
      city: string;
      state: string;
      pincode: string;
      country: string;
      lat?: number;
      lng?: number;
    };
    assignee?: {
      id: string;
      name: string;
      phone: string;
      type: 'gig' | 'vendor';
      vendor?: {
        id: string;
        name: string;
      };
    };
    vendor_tat_start_date: string;
    tat_hours: number;
    due_at: string;
    created_at: string;
    updated_at: string;
    base_rate_inr?: number;
    bonus_inr?: number;
    penalty_inr?: number;
    total_payout_inr?: number;
    notes?: string;
    attachments?: Array<{
      id: string;
      file_name: string;
      file_url: string;
      file_type: string;
      uploaded_at: string;
    }>;
    submissions?: Array<{
      id: string;
      submitted_at: string;
      status: string;
      photos: Array<{
        id: string;
        photo_url: string;
        taken_at: string;
        location: {
          lat: number;
          lng: number;
        };
      }>;
      answers: Record<string, any>;
      notes: string;
    }>;
    qc_reviews?: Array<{
      id: string;
      reviewed_at: string;
      result: 'pass' | 'reject' | 'rework';
      comments: string;
      reviewer: {
        name: string;
        role: string;
      };
    }>;
  };
  onEdit: () => void;
  onClose: () => void;
}

const CONTRACT_TYPE_COLORS = {
  residential_address_check: 'bg-blue-100 text-blue-800',
  business_address_check: 'bg-green-100 text-green-800',
};

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

export default function CaseDetail({ caseData, onEdit, onClose }: CaseDetailProps) {
  const [formSubmissions, setFormSubmissions] = useState<FormSubmissionData[]>([]);

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'qc_passed':
      case 'reported':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'qc_rejected':
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending_allocation':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-blue-600" />;
    }
  };

  const handleCSVDownload = () => {
    if (formSubmissions.length === 0) {
      toast.error('No form submissions available to download');
      return;
    }

    try {
      const csvContent = CSVService.convertFormSubmissionsToCSV(formSubmissions);
      const filename = `case-${caseData.case_number}-responses-${new Date().toISOString().split('T')[0]}.csv`;
      CSVService.downloadCSV(csvContent, filename);
      toast.success('CSV file downloaded successfully');
    } catch (error) {
      console.error('Error generating CSV:', error);
      toast.error('Failed to generate CSV file');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <CardTitle className="text-2xl">{caseData.case_number}</CardTitle>
                <Badge className={CONTRACT_TYPE_COLORS[caseData.contract_type] || 'bg-gray-100 text-gray-800'}>
                  {caseData.contract_type.replace('_', ' ').toUpperCase()}
                </Badge>
                <Badge className={STATUS_COLORS[caseData.status]}>
                  {STATUS_LABELS[caseData.status]}
                </Badge>
              </div>
              <CardDescription className="text-lg">{caseData.candidate_name}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onEdit}>
                Edit Case
              </Button>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Background verification for {caseData.candidate_name}</p>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="location">Location</TabsTrigger>
          <TabsTrigger value="assignee">Assignee</TabsTrigger>
          <TabsTrigger value="submissions">Legacy Submissions</TabsTrigger>
          <TabsTrigger value="dynamic-forms">Dynamic Forms</TabsTrigger>
          <TabsTrigger value="attachments">Attachments</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Client Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Client Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-medium">{caseData.client.name}</p>
                  <p className="text-sm text-muted-foreground">{caseData.client.email}</p>
                </div>
                {caseData.client.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{caseData.client.phone}</span>
                  </div>
                )}
                {caseData.client.contact_person && (
                  <div>
                    <p className="text-sm font-medium">Contact Person</p>
                    <p className="text-sm text-muted-foreground">{caseData.client.contact_person}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Candidate Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Candidate Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-medium">{caseData.candidate_name}</p>
                  <p className="text-sm text-muted-foreground">Client Case ID: {caseData.client_case_id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{caseData.phone_primary}</span>
                </div>
                {caseData.phone_secondary && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{caseData.phone_secondary}</span>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">Contract Type</p>
                  <p className="text-sm text-muted-foreground">{caseData.contract_type.replace('_', ' ').toUpperCase()}</p>
                </div>
              </CardContent>
            </Card>

            {/* SLA & Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  SLA & Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  {getStatusIcon(caseData.status)}
                  <div>
                    <p className="font-medium">{STATUS_LABELS[caseData.status]}</p>
                    <p className="text-sm text-muted-foreground">
                      TAT: {caseData.tat_hours} hours
                    </p>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm font-medium">Vendor TAT Start Date</p>
                  <p className="text-sm">
                    {format(new Date(caseData.vendor_tat_start_date), 'PPP p')}
                  </p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm font-medium">Due Date</p>
                  <p className={`text-sm ${isOverdue(caseData.due_at) ? 'text-red-600' : ''}`}>
                    {format(new Date(caseData.due_at), 'PPP p')}
                  </p>
                  <p className={`text-xs ${isOverdue(caseData.due_at) ? 'text-red-500' : 'text-muted-foreground'}`}>
                    {isOverdue(caseData.due_at) 
                      ? 'Overdue' 
                      : `${getDaysUntilDue(caseData.due_at)} days remaining`
                    }
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Created</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(caseData.created_at), 'PPP p')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Payout & Payment */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Payout & Payment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-2xl font-bold">₹{(caseData.total_payout_inr || 0).toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">Total Payout</p>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Base Payout:</span>
                    <span className="text-sm">₹{(caseData.base_rate_inr || 0).toFixed(2)}</span>
                  </div>
                  {(caseData.bonus_inr || 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-green-600">Bonus:</span>
                      <span className="text-sm text-green-600">+₹{(caseData.bonus_inr || 0).toFixed(2)}</span>
                    </div>
                  )}
                  {(caseData.penalty_inr || 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-red-600">Penalty:</span>
                      <span className="text-sm text-red-600">-₹{(caseData.penalty_inr || 0).toFixed(2)}</span>
                    </div>
                  )}
                </div>
                
                {/* Show calculation breakdown */}
                <div className="mt-3 p-3 bg-gray-50 rounded-md">
                  <p className="text-xs text-muted-foreground mb-2">Calculation:</p>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Base Payout:</span>
                      <span>₹{(caseData.base_rate_inr || 0).toFixed(2)}</span>
                    </div>
                    {(caseData.bonus_inr || 0) > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>+ Bonus:</span>
                        <span>+₹{(caseData.bonus_inr || 0).toFixed(2)}</span>
                      </div>
                    )}
                    {(caseData.penalty_inr || 0) > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>- Penalty:</span>
                        <span>-₹{(caseData.penalty_inr || 0).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-medium border-t pt-1">
                      <span>Total:</span>
                      <span>₹{(caseData.total_payout_inr || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
                {/* Bonus Management */}
                {canAddBonus(caseData.status) && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium">Add Bonus</h4>
                      <AddBonusDialog 
                        caseId={caseData.id}
                        currentBonus={caseData.bonus_inr || 0}
                        onBonusAdded={() => {
                          // This would trigger a refresh of the case data
                          window.location.reload();
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Bonuses can be added for cases in created, auto_allocated, or pending_acceptance status
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            {caseData.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{caseData.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Location Tab */}
        <TabsContent value="location" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-medium">Address</p>
                <p className="text-muted-foreground">{caseData.location.address_line}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="font-medium">City</p>
                  <p className="text-muted-foreground">{caseData.location.city}</p>
                </div>
                <div>
                  <p className="font-medium">State</p>
                  <p className="text-muted-foreground">{caseData.location.state}</p>
                </div>
                <div>
                  <p className="font-medium">Pincode</p>
                  <p className="text-muted-foreground">{caseData.location.pincode}</p>
                </div>
              </div>
              {caseData.location.lat && caseData.location.lng && (
                <div className="flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Coordinates: {caseData.location.lat.toFixed(6)}, {caseData.location.lng.toFixed(6)}
                  </span>
                </div>
              )}
              {caseData.location.location_url && (
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  <a 
                    href={caseData.location.location_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    View Location
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assignee Tab */}
        <TabsContent value="assignee" className="space-y-6">
          {caseData.assignee ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Assigned To
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-medium">{caseData.assignee.name}</p>
                  <p className="text-sm text-muted-foreground capitalize">{caseData.assignee.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{caseData.assignee.phone}</span>
                </div>
                {caseData.assignee.vendor && (
                  <div>
                    <p className="text-sm font-medium">Vendor</p>
                    <p className="text-sm text-muted-foreground">{caseData.assignee.vendor.name}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Assignee</h3>
                <p className="text-muted-foreground">This case has not been assigned yet.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Submissions Tab */}
        <TabsContent value="submissions" className="space-y-6">
          {caseData.submissions && caseData.submissions.length > 0 ? (
            <div className="space-y-4">
              {caseData.submissions.map((submission) => (
                <Card key={submission.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Submission #{submission.id.slice(-8)}
                    </CardTitle>
                    <CardDescription>
                      Submitted on {format(new Date(submission.submitted_at), 'PPP p')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="font-medium">Status</p>
                        <Badge className={STATUS_COLORS[submission.status as keyof typeof STATUS_COLORS]}>
                          {submission.status}
                        </Badge>
                      </div>
                      <div>
                        <p className="font-medium">Photos</p>
                        <p className="text-sm text-muted-foreground">{submission.photos.length} photos</p>
                      </div>
                    </div>
                    {submission.notes && (
                      <div>
                        <p className="font-medium">Notes</p>
                        <p className="text-sm text-muted-foreground">{submission.notes}</p>
                      </div>
                    )}
                    {submission.photos.length > 0 && (
                      <div>
                        <p className="font-medium mb-2">Photos</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {submission.photos.map((photo) => (
                            <div key={photo.id} className="relative">
                              <img
                                src={photo.photo_url}
                                alt="Submission photo"
                                className="w-full h-24 object-cover rounded border"
                              />
                              <div className="absolute bottom-1 left-1 right-1 bg-black/50 text-white text-xs p-1 rounded">
                                {format(new Date(photo.taken_at), 'MMM dd, HH:mm')}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Submissions</h3>
                <p className="text-muted-foreground">No submissions have been made for this case yet.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Dynamic Forms Tab */}
        <TabsContent value="dynamic-forms" className="space-y-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Form Submissions</h3>
            <Button 
              onClick={handleCSVDownload}
              disabled={formSubmissions.length === 0}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
          </div>
          <DynamicFormSubmission 
            caseId={caseData.id} 
            onSubmissionsLoaded={setFormSubmissions}
          />
        </TabsContent>

        {/* Attachments Tab */}
        <TabsContent value="attachments" className="space-y-6">
          {caseData.attachments && caseData.attachments.length > 0 ? (
            <div className="space-y-4">
              {caseData.attachments.map((attachment) => (
                <Card key={attachment.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{attachment.file_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {attachment.file_type} • {format(new Date(attachment.uploaded_at), 'PPP')}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Attachments</h3>
                <p className="text-muted-foreground">No files have been attached to this case.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Case Timeline</CardTitle>
              <CardDescription>Track the progress of this case</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* This would be populated with actual timeline data */}
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <div>
                    <p className="font-medium">Case Created</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(caseData.created_at), 'PPP p')}
                    </p>
                  </div>
                </div>
                {caseData.assignee && (
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                    <div>
                      <p className="font-medium">Assigned to {caseData.assignee.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(caseData.updated_at), 'PPP p')}
                      </p>
                    </div>
                  </div>
                )}
                {/* Add more timeline events as needed */}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper function to check if bonus can be added
function canAddBonus(status: string): boolean {
  return ['created', 'auto_allocated', 'pending_acceptance'].includes(status);
}

// AddBonusDialog component
interface AddBonusDialogProps {
  caseId: string;
  currentBonus: number;
  onBonusAdded: () => void;
}

function AddBonusDialog({ caseId, currentBonus, onBonusAdded }: AddBonusDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [bonusAmount, setBonusAmount] = useState('');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bonusAmount || parseFloat(bonusAmount) <= 0) return;

    setIsLoading(true);
    try {
      await BonusService.addBonus({
        caseId,
        amount: parseFloat(bonusAmount),
        reason: reason || undefined
      });

      toast.success(`Bonus of ₹${parseFloat(bonusAmount).toFixed(2)} added successfully`);
      setIsOpen(false);
      setBonusAmount('');
      setReason('');
      onBonusAdded();
    } catch (error) {
      console.error('Failed to add bonus:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add bonus');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Add Bonus
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Bonus</DialogTitle>
          <DialogDescription>
            Add a bonus amount to this case. Current bonus: ₹{currentBonus.toFixed(2)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bonus-amount">Bonus Amount (₹)</Label>
            <Input
              id="bonus-amount"
              type="number"
              step="0.01"
              min="0"
              value={bonusAmount}
              onChange={(e) => setBonusAmount(e.target.value)}
              placeholder="Enter bonus amount"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bonus-reason">Reason (Optional)</Label>
            <Input
              id="bonus-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for bonus"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !bonusAmount || parseFloat(bonusAmount) <= 0}>
              {isLoading ? 'Adding...' : 'Add Bonus'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

