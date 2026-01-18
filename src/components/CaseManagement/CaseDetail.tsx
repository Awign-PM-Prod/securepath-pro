import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
import { PDFService, type CaseDataForPDF } from '@/services/pdfService';
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
  ExternalLink,
  FileDown
} from 'lucide-react';
import { format } from 'date-fns';

interface CaseDetailProps {
  caseData: {
    id: string;
    case_number: string;
    client_case_id: string;
    contract_type: string;
    candidate_name: string;
    company_name?: string;
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
      location_url?: string;
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
    allocated_at?: string;
    accepted_at?: string;
    submitted_at?: string;
    base_rate_inr?: number;
    bonus_inr?: number;
    penalty_inr?: number;
    total_payout_inr?: number;
    is_positive?: boolean;
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
  const [isGeneratingAPIPDF, setIsGeneratingAPIPDF] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadType, setDownloadType] = useState<'csv' | 'pdf' | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [formSubmissionImages, setFormSubmissionImages] = useState<Array<{
    id: string;
    file_url: string;
    file_name: string;
    mime_type: string;
    uploaded_at: string;
    field_title?: string;
    submission_id: string;
  }>>([]);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
  const [allocatedAt, setAllocatedAt] = useState<string | null>(null);
  const [gigWorkerWhoFilledForm, setGigWorkerWhoFilledForm] = useState<{
    id: string;
    name: string;
    phone: string;
  } | null>(null);

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

  // Fetch allocation timestamps from allocation_logs if not in caseData
  useEffect(() => {
    const fetchAllocationTimestamps = async () => {
      // If caseData already has allocated_at, use it
      if (caseData.allocated_at) {
        setAllocatedAt(caseData.allocated_at);
      }

      // If caseData already has accepted_at, use it
      if (caseData.accepted_at) {
        setAcceptedAt(caseData.accepted_at);
      }

      // Fetch from allocation_logs if needed
      try {
        const { data: allocationLogs, error } = await supabase
          .from('allocation_logs')
          .select('accepted_at, allocated_at, decision')
          .eq('case_id', caseData.id)
          .order('allocated_at', { ascending: false });

        if (error) throw error;

        if (allocationLogs && allocationLogs.length > 0) {
          // Get allocated_at from the most recent allocation log
          if (!caseData.allocated_at && allocationLogs[0].allocated_at) {
            setAllocatedAt(allocationLogs[0].allocated_at);
          }

          // Get accepted_at from accepted logs
          if (!caseData.accepted_at) {
            const acceptedLog = allocationLogs.find(log => 
              log.decision === 'accepted' && log.accepted_at
            );
            if (acceptedLog && acceptedLog.accepted_at) {
              setAcceptedAt(acceptedLog.accepted_at);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching allocation timestamps:', error);
      }
    };

    fetchAllocationTimestamps();
  }, [caseData.id, caseData.allocated_at, caseData.accepted_at]);

  // Fetch gig worker who filled the form (if case was assigned to vendor)
  useEffect(() => {
    const fetchGigWorkerWhoFilledForm = async () => {
      // Only fetch if assignee is a vendor
      if (caseData.assignee?.type !== 'vendor') {
        setGigWorkerWhoFilledForm(null);
        return;
      }

      try {
        // Get the gig_partner_id from form_submissions
        const { data: formSubmission, error: formError } = await supabase
          .from('form_submissions')
          .select('gig_partner_id')
          .eq('case_id', caseData.id)
          .limit(1)
          .single();

        if (formError || !formSubmission?.gig_partner_id) {
          // No form submission found or no gig worker assigned
          setGigWorkerWhoFilledForm(null);
          return;
        }

        // Fetch gig worker details
        const { data: gigWorker, error: gigError } = await supabase
          .from('gig_partners')
          .select(`
            id,
            profiles!inner (
              first_name,
              last_name,
              phone
            )
          `)
          .eq('id', formSubmission.gig_partner_id)
          .single();

        if (gigError || !gigWorker) {
          console.error('Error fetching gig worker:', gigError);
          setGigWorkerWhoFilledForm(null);
          return;
        }

        setGigWorkerWhoFilledForm({
          id: gigWorker.id,
          name: `${gigWorker.profiles?.first_name || ''} ${gigWorker.profiles?.last_name || ''}`.trim() || 'Unknown',
          phone: gigWorker.profiles?.phone || 'N/A',
        });
      } catch (error) {
        console.error('Error fetching gig worker who filled form:', error);
        setGigWorkerWhoFilledForm(null);
      }
    };

    fetchGigWorkerWhoFilledForm();
  }, [caseData.id, caseData.assignee?.type]);

  // Fetch form submission images
  useEffect(() => {
    const fetchFormSubmissionImages = async () => {
      try {
        // Get all form submissions for this case
        const { data: submissions, error: submissionsError } = await supabase
          .from('form_submissions')
          .select('id')
          .eq('case_id', caseData.id);

        if (submissionsError) throw submissionsError;

        if (!submissions || submissions.length === 0) {
          setFormSubmissionImages([]);
          return;
        }

        const submissionIds = submissions.map(s => s.id);

        // Get all files for these submissions
        const { data: files, error: filesError } = await supabase
          .from('form_submission_files')
          .select(`
            id,
            file_url,
            file_name,
            mime_type,
            uploaded_at,
            submission_id,
            form_field:form_fields(
              field_title
            )
          `)
          .in('submission_id', submissionIds)
          .like('mime_type', 'image/%')
          .order('uploaded_at', { ascending: false });

        if (filesError) throw filesError;

        // Deduplicate images by file_url (primary) or id (fallback)
        const seen = new Set<string>();
        const uniqueImages = (files || []).filter(file => {
          const key = file.file_url || file.id;
          if (seen.has(key)) {
            console.log('Skipping duplicate image:', { file_url: file.file_url, id: file.id });
            return false;
          }
          seen.add(key);
          return true;
        });

        // Transform the data
        const images = uniqueImages.map(file => ({
          id: file.id,
          file_url: file.file_url,
          file_name: file.file_name,
          mime_type: file.mime_type,
          uploaded_at: file.uploaded_at,
          field_title: (file.form_field as any)?.field_title || 'Unknown Field',
          submission_id: file.submission_id
        }));

        setFormSubmissionImages(images);
      } catch (error) {
        console.error('Error fetching form submission images:', error);
        setFormSubmissionImages([]);
      }
    };

    fetchFormSubmissionImages();
  }, [caseData.id]);

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

  const handleCSVDownload = async () => {
    if (formSubmissions.length === 0) {
      toast.error('No form submissions available to download');
      return;
    }

    try {
      setIsDownloading(true);
      setDownloadType('csv');
      setDownloadProgress(30);

      const csvContent = await CSVService.convertFormSubmissionsToCSV(
        formSubmissions, 
        caseData.contract_type, 
        caseData.is_positive
      );
      setDownloadProgress(70);

      const filename = `case-${caseData.case_number}-responses-${new Date().toISOString().split('T')[0]}.csv`;
      CSVService.downloadCSV(csvContent, filename);
      
      setDownloadProgress(100);
      toast.success('CSV file downloaded successfully');

      setTimeout(() => {
        setIsDownloading(false);
        setDownloadType(null);
        setDownloadProgress(0);
      }, 500);
    } catch (error) {
      console.error('Error generating CSV:', error);
      setIsDownloading(false);
      setDownloadType(null);
      setDownloadProgress(0);
      toast.error('Failed to generate CSV file');
    }
  };

  const handlePDFDownload = async () => {
    // Show loading immediately when button is clicked
    setIsDownloading(true);
    setIsGeneratingSummary(true);
    setDownloadType('pdf');
    setDownloadProgress(0);

    if (formSubmissions.length === 0) {
      setIsDownloading(false);
      setIsGeneratingSummary(false);
      setDownloadType(null);
      setDownloadProgress(0);
      toast.error('No form submissions available to download');
      return;
    }

    // Debug: Log the submissions data structure
    console.log('CaseDetail: Submissions data structure:', {
      count: formSubmissions.length,
      firstSubmission: formSubmissions[0] ? {
        id: formSubmissions[0].id,
        hasFormFields: !!formSubmissions[0].form_fields,
        formFieldsCount: formSubmissions[0].form_fields?.length || 0,
        hasSubmissionData: !!formSubmissions[0].submission_data,
        submissionDataKeys: Object.keys(formSubmissions[0].submission_data || {}),
        hasFormSubmissionFiles: !!formSubmissions[0].form_submission_files,
        formSubmissionFilesCount: formSubmissions[0].form_submission_files?.length || 0,
        fullStructure: formSubmissions[0]
      } : null
    });

    try {

      // Extract form data for AI summary (excluding images and signatures)
      const formDataForSummary = PDFService.extractFormDataForSummary(formSubmissions);
      
      // Prepare case data in parallel (doesn't depend on summary)
      const caseDataForPDF: CaseDataForPDF = {
        case_number: caseData.case_number,
        client_case_id: caseData.client_case_id,
        candidate_name: caseData.candidate_name,
        phone_primary: caseData.phone_primary,
        location: {
          city: caseData.location?.city,
          address_line: caseData.location?.address_line,
          pincode: caseData.location?.pincode,
          lat: caseData.location?.lat,
          lng: caseData.location?.lng
        },
        contract_type: caseData.contract_type,
        company_name: caseData.company_name,
        client_name: caseData.client?.name
      };
      
      // Animate progress while waiting for OpenAI API (0% to 85%)
      let progressInterval: NodeJS.Timeout | null = null;
      let currentProgress = 0;
      const startProgressAnimation = () => {
        progressInterval = setInterval(() => {
          if (currentProgress < 85) {
            currentProgress += Math.random() * 3 + 1; // Increment by 1-4% randomly
            if (currentProgress > 85) currentProgress = 85;
            setDownloadProgress(Math.floor(currentProgress));
          }
        }, 200); // Update every 200ms
      };
      
      startProgressAnimation();
      
      // Generate AI summary using OpenAI
      const { openAIService } = await import('@/services/openAIService');
      const summaryResult = await openAIService.generateReportSummary(formDataForSummary);
      
      // Stop progress animation
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      
      if (!summaryResult.success || !summaryResult.response) {
        setIsDownloading(false);
        setIsGeneratingSummary(false);
        setDownloadType(null);
        setDownloadProgress(0);
        toast.error(`Failed to generate AI summary: ${summaryResult.error || 'Unknown error'}`);
        return;
      }

      const aiSummary = summaryResult.response;
      setIsGeneratingSummary(false);
      setDownloadProgress(90);
      
      // Generate PDF (this is the actual heavy operation)
      await PDFService.convertFormSubmissionsToPDF(
        formSubmissions, 
        caseData.case_number, 
        caseData.contract_type,
        caseData.is_positive,
        caseDataForPDF,
        aiSummary
      );
      
      setDownloadProgress(100);
      toast.success('PDF file downloaded successfully');

      setTimeout(() => {
        setIsDownloading(false);
        setIsGeneratingSummary(false);
        setDownloadType(null);
        setDownloadProgress(0);
      }, 500);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setIsDownloading(false);
      setIsGeneratingSummary(false);
      setDownloadType(null);
      setDownloadProgress(0);
      toast.error(`Failed to generate PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleAPIPDF = async () => {
    if (formSubmissions.length === 0) {
      toast.error('No form submissions available');
      return;
    }

    setIsGeneratingAPIPDF(true);
    try {
      // Generate CSV content
      const csvContent = CSVService.convertFormSubmissionsToCSV(formSubmissions);
      
      if (!csvContent) {
        toast.error('Failed to generate CSV content');
        return;
      }

      // Call the PDF API directly
      const API_URL = 'https://stipkqfnfogxuegxgdba.supabase.co/functions/v1/generate-pdf';
      const API_KEY = 'qcpk_a1dcaccc6ac0433bb353528b1f25f828';

      const csvBlob = await csvContent;
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv',
          'x-api-key': API_KEY
        },
        body: csvBlob
      });

      // Check if response is ok
      if (!response.ok) {
        const errorText = await response.text();
        const errorData = errorText.trim().startsWith('{') ? JSON.parse(errorText) : { error: errorText };
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Get response as JSON
      const contentType = response.headers.get('content-type') || '';
      const responseText = await response.text();
      
      // Parse the response
      if (contentType.includes('application/json') || responseText.trim().startsWith('{')) {
        const jsonData = JSON.parse(responseText);
        
        if (jsonData.pdf_url) {
          toast.success('Opening PDF...');
          // Open the PDF link in a new tab
          window.open(jsonData.pdf_url, '_blank');
        } else {
          toast.error('No PDF URL in API response');
        }
      } else {
        toast.error('Unexpected response format from API');
      }
    } catch (error) {
      console.error('Error calling PDF API:', error);
      
      // Provide specific error message for CORS issues
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        toast.error('CORS Error: PDF API server needs to allow "x-api-key" header. Please contact the API owner.', {
          duration: 8000,
        });
      } else if (error instanceof Error) {
        toast.error(`Error: ${error.message}`);
      } else {
        toast.error('Failed to generate PDF via API');
      }
    } finally {
      setIsGeneratingAPIPDF(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-6">
      {/* Progress Card */}
      {isDownloading && (
        <div className="fixed bottom-4 right-4 z-50 w-80">
          <Card className="shadow-lg border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <div className="flex-1">
                  <div className="text-sm font-medium mb-1">
                    {isGeneratingSummary 
                      ? 'Generating Report Summary...' 
                      : `Downloading ${downloadType?.toUpperCase()} for ${caseData.case_number}...`}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
                      Bonuses can be added for cases in created or allocated status
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
            <div className="space-y-4">
              {/* Vendor Assignment Card */}
              {caseData.assignee.type === 'vendor' ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Building className="h-5 w-5" />
                        Assigned Vendor
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="font-medium">{caseData.assignee.name}</p>
                        <p className="text-sm text-muted-foreground">Vendor</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{caseData.assignee.phone}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Gig Worker Who Filled Form Card */}
                  {gigWorkerWhoFilledForm ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <User className="h-5 w-5" />
                          Gig Worker Who Filled Form
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="font-medium">{gigWorkerWhoFilledForm.name}</p>
                          <p className="text-sm text-muted-foreground">Gig Worker</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{gigWorkerWhoFilledForm.phone}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="text-center py-6">
                        <User className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No form submission found yet</p>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                /* Direct Gig Worker Assignment Card */
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Assigned Gig Worker
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="font-medium">{caseData.assignee.name}</p>
                      <p className="text-sm text-muted-foreground">Gig Worker</p>
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
              )}
            </div>
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

        {/* Dynamic Forms Tab */}
        <TabsContent value="dynamic-forms" className="space-y-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Form Submissions</h3>
            <div className="flex gap-2">
              <Button 
                onClick={handleAPIPDF}
                disabled={formSubmissions.length === 0 || isGeneratingAPIPDF}
                variant="outline"
                className="flex items-center gap-2"
              >
                {isGeneratingAPIPDF ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <FileDown className="h-4 w-4" />
                    Use API PDF
                  </>
                )}
              </Button>
              <Button 
                onClick={handlePDFDownload}
                disabled={formSubmissions.length === 0}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
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
          </div>
          <DynamicFormSubmission 
            caseId={caseData.id}
            caseStatus={caseData.status}
            onSubmissionsLoaded={(submissions: any[]) => setFormSubmissions(submissions as FormSubmissionData[])}
          />
        </TabsContent>

        {/* Attachments Tab */}
        <TabsContent value="attachments" className="space-y-6">
          {formSubmissionImages.length > 0 ? (
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">Form Submission Images</h3>
                <p className="text-sm text-muted-foreground">
                  {formSubmissionImages.length} image{formSubmissionImages.length !== 1 ? 's' : ''} uploaded in form submissions
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {formSubmissionImages.map((image) => (
                  <Card key={image.id} className="overflow-hidden">
                    <div className="relative aspect-square bg-gray-100">
                      <img
                        src={image.file_url}
                        alt={image.file_name}
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(image.file_url, '_blank')}
                      />
                      <div className="absolute top-2 right-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8 w-8 p-0 bg-white/90 hover:bg-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            const link = document.createElement('a');
                            link.href = image.file_url;
                            link.download = image.file_name;
                            link.click();
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-3">
                      <p className="text-sm font-medium truncate" title={image.file_name}>
                        {image.file_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate" title={image.field_title}>
                        {image.field_title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(image.uploaded_at), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <Image className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Images</h3>
                <p className="text-muted-foreground">No images have been uploaded in form submissions for this case.</p>
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
                {/* Case Created */}
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <div>
                    <p className="font-medium">Case Created</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(caseData.created_at), 'PPP p')}
                    </p>
                  </div>
                </div>

                {/* Allocated At */}
                {(caseData.allocated_at || allocatedAt) && (
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                    <div>
                      <p className="font-medium">Case Allocated</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(caseData.allocated_at || allocatedAt!), 'PPP p')}
                      </p>
                      {caseData.assignee && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Assigned to {caseData.assignee.name}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Accepted At */}
                {(caseData.accepted_at || acceptedAt) && (
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                    <div>
                      <p className="font-medium">Case Accepted</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(caseData.accepted_at || acceptedAt!), 'PPP p')}
                      </p>
                      {caseData.assignee && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Accepted by {caseData.assignee.name}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Submitted At */}
                {caseData.submitted_at && (
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                    <div>
                      <p className="font-medium">Form Submitted</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(caseData.submitted_at), 'PPP p')}
                      </p>
                    </div>
                  </div>
                )}
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
  return ['created', 'allocated'].includes(status);
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

