import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Search, Download, FileSpreadsheet, FileText, User, Phone, MapPin, Clock, Building, Calendar as CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { isRecreatedCase } from '@/utils/caseUtils';
import { CSVService, FormSubmissionData } from '@/services/csvService';
import { PDFService, type CaseDataForPDF } from '@/services/pdfService';
import JSZip from 'jszip';

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
  QC_Response?: 'Rework' | 'Approved' | 'Rejected' | 'New';
  assigned_at?: string;
  submitted_at?: string;
  is_positive?: boolean;
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
  qc_rework: 'bg-orange-100 text-orange-800',
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
  if (!tierString) return '?';
  
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

interface Client {
  id: string;
  name: string;
}

export default function Reports() {
  const [cases, setCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadType, setDownloadType] = useState<'csv' | 'pdf' | null>(null);
  const [downloadingCase, setDownloadingCase] = useState<string | null>(null);
  const { toast } = useToast();

  // Filter states
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [submissionStartDate, setSubmissionStartDate] = useState<string>('');
  const [submissionEndDate, setSubmissionEndDate] = useState<string>('');
  const [approvalStartDate, setApprovalStartDate] = useState<string>('');
  const [approvalEndDate, setApprovalEndDate] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  
  // Options for filters
  const [clients, setClients] = useState<Client[]>([]);

  // Bulk download states
  const [bulkReportsDialogOpen, setBulkReportsDialogOpen] = useState(false);
  const [caseSelectionDialogOpen, setCaseSelectionDialogOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'pdf' | null>(null);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  
  // Filters for case selection dialog
  const [selectionStartDate, setSelectionStartDate] = useState<string>('');
  const [selectionEndDate, setSelectionEndDate] = useState<string>('');
  const [selectionClient, setSelectionClient] = useState<string>('all');
  const [selectionSearchTerm, setSelectionSearchTerm] = useState<string>('');

  useEffect(() => {
    loadSubmittedCases();
    loadFilterOptions();
  }, []);

  const loadFilterOptions = async () => {
    try {
      // Load clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (clientsError) {
        console.error('Error loading clients:', clientsError);
      } else {
        setClients(clientsData || []);
      }
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  };

  const loadSubmittedCases = async () => {
    try {
      setIsLoading(true);
      
      // Filter cases created after November 2nd, 2025
      const cutoffDate = new Date('2025-11-02T00:00:00.000Z');
      const cutoffDateISOString = cutoffDate.toISOString();
      
      const { data, error } = await supabase
        .from('cases')
        .select(`
          *,
          is_positive,
          clients(id, name, contact_person, phone, email),
          locations(id, address_line, city, state, pincode, pincode_tier, lat, lng, location_url)
        `)
        .in('status', ['submitted', 'qc_passed'])
        .gte('created_at', cutoffDateISOString)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get case IDs to fetch form_submissions
      const caseIds = data?.map(c => c.id) || [];
      
      // Fetch form_submissions to get updated_at (submission time)
      const { data: formSubmissionsData } = await supabase
        .from('form_submissions')
        .select('case_id, updated_at')
        .in('case_id', caseIds.length > 0 ? caseIds : [])
        .order('updated_at', { ascending: false });

      // Create a map of case_id to updated_at
      const formSubmissionsMap = new Map();
      (formSubmissionsData || []).forEach(submission => {
        // Store the most recent updated_at for each case
        if (!formSubmissionsMap.has(submission.case_id)) {
          formSubmissionsMap.set(submission.case_id, submission.updated_at);
        } else {
          const current = formSubmissionsMap.get(submission.case_id);
          if (new Date(submission.updated_at) > new Date(current)) {
            formSubmissionsMap.set(submission.case_id, submission.updated_at);
          }
        }
      });

      const formattedCases = data?.map(caseItem => ({
        id: caseItem.id,
        case_number: caseItem.case_number,
        client_case_id: caseItem.client_case_id,
        contract_type: caseItem.contract_type,
        candidate_name: caseItem.candidate_name,
        phone_primary: caseItem.phone_primary,
        phone_secondary: caseItem.phone_secondary,
        status: caseItem.status as any,
        client: caseItem.clients as any,
        location: caseItem.locations as any,
        current_assignee: caseItem.current_assignee_id ? {
          id: caseItem.current_assignee_id,
          name: 'Unknown',
          type: caseItem.current_assignee_type as 'gig' | 'vendor'
        } : undefined,
        vendor_tat_start_date: caseItem.vendor_tat_start_date,
        tat_hours: caseItem.tat_hours,
        due_at: caseItem.due_at,
        created_at: caseItem.created_at,
        updated_at: caseItem.updated_at,
        created_by: caseItem.created_by,
        last_updated_by: caseItem.last_updated_by,
        status_updated_at: caseItem.status_updated_at,
        base_rate_inr: caseItem.base_rate_inr,
        bonus_inr: caseItem.bonus_inr,
        penalty_inr: caseItem.penalty_inr,
        total_payout_inr: caseItem.total_payout_inr,
        QC_Response: caseItem.QC_Response as any,
        assigned_at: null, // This will be populated from allocation logs in production
        is_positive: caseItem.is_positive,
        // Use updated_at from form_submissions instead of submitted_at
        submitted_at: formSubmissionsMap.get(caseItem.id) || null
      })) || [];

      // Show only cases created after November 2nd, 2025
      console.log(`Reports loaded ${formattedCases.length} cases with status 'submitted' or 'qc_passed' (created after November 2nd, 2025)`);

      setCases(formattedCases);
    } catch (error) {
      console.error('Error loading cases:', error);
      toast({
        title: 'Error',
        description: 'Failed to load cases',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

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

  // Helper function to get contract type badge with highlighting
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

  // Helper function to check if a case matches the search term across all metadata
  const caseMatchesSearch = (caseItem: Case, term: string): boolean => {
    if (!term) return true;
    
    const lowerTerm = term.toLowerCase();
    
    // Contract type labels for search
    const contractTypeLabels: Record<string, string> = {
      'residential_address_check': 'Residential',
      'business_address_check': 'Business',
    };
    const contractTypeLabel = contractTypeLabels[caseItem.contract_type] || caseItem.contract_type;
    
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
      contractTypeLabel, // Also search by display label
      STATUS_LABELS[caseItem.status] || caseItem.status,
      caseItem.total_payout_inr?.toString() || '',
      format(new Date(caseItem.created_at), 'MMM dd, yyyy'),
      format(new Date(caseItem.created_at), 'HH:mm'),
      format(new Date(caseItem.created_at), 'yyyy-MM-dd'),
      caseItem.submitted_at ? format(new Date(caseItem.submitted_at), 'MMM dd, yyyy HH:mm') : '',
      caseItem.submitted_at ? format(new Date(caseItem.submitted_at), 'yyyy-MM-dd') : '',
      `Tier ${getTierNumber(caseItem.location.pincode_tier)}`,
    ];
    
    return searchableFields.some(field => 
      field && field.toLowerCase().includes(lowerTerm)
    );
  };

  const filteredCases = cases.filter(caseItem => {
    // Search filter - now searches all metadata
    const matchesSearch = caseMatchesSearch(caseItem, searchTerm);

    // Creation date range filter
    let matchesDateRange = true;
    if (startDate || endDate) {
      const caseDate = new Date(caseItem.created_at);
      caseDate.setHours(0, 0, 0, 0);
      
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (caseDate < start) matchesDateRange = false;
      }
      
      if (endDate && matchesDateRange) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (caseDate > end) matchesDateRange = false;
      }
    }

    // Submission date range filter
    let matchesSubmissionDateRange = true;
    if (submissionStartDate || submissionEndDate) {
      if (!caseItem.submitted_at) {
        matchesSubmissionDateRange = false;
      } else {
        const submissionDate = new Date(caseItem.submitted_at);
        submissionDate.setHours(0, 0, 0, 0);
        
        if (submissionStartDate) {
          const start = new Date(submissionStartDate);
          start.setHours(0, 0, 0, 0);
          if (submissionDate < start) matchesSubmissionDateRange = false;
        }
        
        if (submissionEndDate && matchesSubmissionDateRange) {
          const end = new Date(submissionEndDate);
          end.setHours(23, 59, 59, 999);
          if (submissionDate > end) matchesSubmissionDateRange = false;
        }
      }
    }

    // Approval date range filter (for QC Approved cases)
    let matchesApprovalDateRange = true;
    if (approvalStartDate || approvalEndDate) {
      // Only filter by approval date if case is approved (QC_Response === 'Approved' or status === 'qc_passed')
      const isApproved = caseItem.QC_Response === 'Approved' || caseItem.status === 'qc_passed';
      if (!isApproved || !caseItem.status_updated_at) {
        matchesApprovalDateRange = false;
      } else {
        const approvalDate = new Date(caseItem.status_updated_at);
        approvalDate.setHours(0, 0, 0, 0);
        
        if (approvalStartDate) {
          const start = new Date(approvalStartDate);
          start.setHours(0, 0, 0, 0);
          if (approvalDate < start) matchesApprovalDateRange = false;
        }
        
        if (approvalEndDate && matchesApprovalDateRange) {
          const end = new Date(approvalEndDate);
          end.setHours(23, 59, 59, 999);
          if (approvalDate > end) matchesApprovalDateRange = false;
        }
      }
    }

    // Client filter
    const matchesClient = selectedClient === 'all' || caseItem.client.id === selectedClient;

    return matchesSearch && matchesDateRange && matchesSubmissionDateRange && matchesApprovalDateRange && matchesClient;
  });

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSubmissionStartDate('');
    setSubmissionEndDate('');
    setApprovalStartDate('');
    setApprovalEndDate('');
    setSelectedClient('all');
  };

  const hasActiveFilters = startDate || endDate || submissionStartDate || submissionEndDate || approvalStartDate || approvalEndDate || selectedClient !== 'all';

  // Get today's date in YYYY-MM-DD format for max date validation
  const getTodayString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    // If end date is before new start date, clear it
    if (endDate && value && endDate < value) {
      setEndDate('');
      toast({
        title: 'Date Range Updated',
        description: 'End date has been cleared because it was before the start date',
        variant: 'default',
      });
    }
  };

  const handleEndDateChange = (value: string) => {
    // Validate that end date is not before start date
    if (startDate && value && value < startDate) {
      toast({
        title: 'Invalid Date',
        description: 'End date cannot be before start date',
        variant: 'destructive',
      });
      return;
    }
    setEndDate(value);
  };

  const handleSubmissionStartDateChange = (value: string) => {
    setSubmissionStartDate(value);
    // If end date is before new start date, clear it
    if (submissionEndDate && value && submissionEndDate < value) {
      setSubmissionEndDate('');
      toast({
        title: 'Date Range Updated',
        description: 'Submission end date has been cleared because it was before the start date',
        variant: 'default',
      });
    }
  };

  const handleSubmissionEndDateChange = (value: string) => {
    // Validate that end date is not before start date
    if (submissionStartDate && value && value < submissionStartDate) {
      toast({
        title: 'Invalid Date',
        description: 'Submission end date cannot be before start date',
        variant: 'destructive',
      });
      return;
    }
    setSubmissionEndDate(value);
  };

  const handleApprovalStartDateChange = (value: string) => {
    setApprovalStartDate(value);
    // If end date is before new start date, clear it
    if (approvalEndDate && value && approvalEndDate < value) {
      setApprovalEndDate('');
      toast({
        title: 'Date Range Updated',
        description: 'Approval end date has been cleared because it was before the start date',
        variant: 'default',
      });
    }
  };

  const handleApprovalEndDateChange = (value: string) => {
    // Validate that end date is not before start date
    if (approvalStartDate && value && value < approvalStartDate) {
      toast({
        title: 'Invalid Date',
        description: 'Approval end date cannot be before start date',
        variant: 'destructive',
      });
      return;
    }
    setApprovalEndDate(value);
  };

  // Bulk download handlers
  const handleOpenBulkReportsDialog = () => {
    setBulkReportsDialogOpen(true);
  };

  const handleSelectFormat = (format: 'csv' | 'pdf') => {
    setSelectedFormat(format);
    setBulkReportsDialogOpen(false);
    setCaseSelectionDialogOpen(true);
    setSelectedCaseIds(new Set());
  };

  const handleBulkDownload = async () => {
    if (selectedCaseIds.size === 0) {
      toast({
        title: 'No Cases Selected',
        description: 'Please select at least one case to download',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedFormat) return;

    try {
      setIsDownloading(true);
      setDownloadProgress(0);
      const selectedCases = cases.filter(c => selectedCaseIds.has(c.id));
      const totalCases = selectedCases.length;

      if (selectedFormat === 'csv') {
        // Bulk CSV download - combine all submissions into one CSV
        let allSubmissions: Array<FormSubmissionData & { case_number?: string }> = [];
        
        for (let i = 0; i < selectedCases.length; i++) {
          const caseItem = selectedCases[i];
          setDownloadProgress(Math.round(((i + 1) / totalCases) * 50));
          setDownloadingCase(caseItem.id);
          
          const submissions = await fetchFormSubmissions(caseItem.id);
          
          // Add case number and case info to each submission for identification
          submissions.forEach(sub => {
            allSubmissions.push({
              ...sub,
              case_number: caseItem.case_number,
              _contract_type: caseItem.contract_type,
              _is_positive: caseItem.is_positive,
            } as FormSubmissionData & { case_number?: string; _contract_type?: string; _is_positive?: boolean });
          });
        }

        setDownloadProgress(75);
        
        if (allSubmissions.length === 0) {
          toast({
            title: 'No Data',
            description: 'No form submissions found for selected cases',
            variant: 'destructive',
          });
          return;
        }

        // Generate CSV with case number column
        const csvContent = await generateBulkCSV(allSubmissions);
        
        if (!csvContent) {
          toast({
            title: 'Error',
            description: 'Failed to generate CSV content',
            variant: 'destructive',
          });
          return;
        }

        CSVService.downloadCSV(csvContent, `bulk_reports_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        setDownloadProgress(100);

        toast({
          title: 'Success',
          description: `Downloaded ${selectedCases.length} cases as CSV`,
        });
      } else if (selectedFormat === 'pdf') {
        // Bulk PDF download - create zip file with all PDFs (or download directly if single)
        const pdfBlobs: Array<{ blob: Blob; caseNumber: string }> = [];

        for (let i = 0; i < selectedCases.length; i++) {
          const caseItem = selectedCases[i];
          setDownloadProgress(Math.round(((i + 1) / totalCases) * 80));
          setDownloadingCase(caseItem.id);
          
          // Use exact same process as CaseDetail page
          const submissions = await fetchFormSubmissions(caseItem.id);
          
          if (submissions.length > 0) {
            try {
              // Prepare case data for auto-fill in negative case PDFs
              const caseDataForPDF: CaseDataForPDF = {
                case_number: caseItem.case_number,
                client_case_id: caseItem.client_case_id,
                candidate_name: caseItem.candidate_name,
                phone_primary: caseItem.phone_primary,
                location: {
                  city: caseItem.location?.city,
                  address_line: caseItem.location?.address_line,
                  pincode: caseItem.location?.pincode,
                  lat: caseItem.location?.lat,
                  lng: caseItem.location?.lng
                },
                contract_type: caseItem.contract_type,
                company_name: (caseItem as any).company_name
              };
              
              // Generate PDF as blob (same as single PDF, but returns blob instead of downloading)
              const pdfBlob = await PDFService.convertFormSubmissionsToPDFBlob(
                submissions, 
                caseItem.case_number, 
                caseItem.contract_type,
                caseItem.is_positive,
                caseDataForPDF
              );
              pdfBlobs.push({ blob: pdfBlob, caseNumber: caseItem.case_number });
            } catch (error) {
              console.error(`Error generating PDF for case ${caseItem.case_number}:`, error);
              // Continue with other cases even if one fails
            }
          }
        }

        setDownloadProgress(90);

        if (pdfBlobs.length === 0) {
          toast({
            title: 'No Data',
            description: 'No form submissions found for selected cases',
            variant: 'destructive',
          });
          return;
        }

        if (pdfBlobs.length === 1) {
          // Single PDF - download directly
          const { blob, caseNumber } = pdfBlobs[0];
          const sanitizedCaseNumber = caseNumber.replace(/[^a-zA-Z0-9-_]/g, '_');
          const filename = `case-${sanitizedCaseNumber}-responses-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } else {
          // Multiple PDFs - create zip file
          const zip = new JSZip();
          
          pdfBlobs.forEach(({ blob, caseNumber }) => {
            const sanitizedCaseNumber = caseNumber.replace(/[^a-zA-Z0-9-_]/g, '_');
            const filename = `case-${sanitizedCaseNumber}-responses-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
            zip.file(filename, blob);
          });

          // Generate and download zip file
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          const zipFilename = `bulk_pdf_reports_${format(new Date(), 'yyyy-MM-dd')}.zip`;
          const url = URL.createObjectURL(zipBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = zipFilename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }

        setDownloadProgress(100);

        toast({
          title: 'Success',
          description: `Downloaded ${pdfBlobs.length} case${pdfBlobs.length !== 1 ? 's' : ''} as PDF${pdfBlobs.length > 1 ? ' (ZIP file)' : ''}`,
        });
      }

      setTimeout(() => {
        setIsDownloading(false);
        setDownloadingCase(null);
        setDownloadProgress(0);
        handleCloseCaseSelection();
      }, 500);
    } catch (error) {
      console.error('Error in bulk download:', error);
      setIsDownloading(false);
      setDownloadingCase(null);
      setDownloadProgress(0);
      toast({
        title: 'Error',
        description: 'Failed to download reports',
        variant: 'destructive',
      });
    }
  };

  const handleCloseCaseSelection = () => {
    setCaseSelectionDialogOpen(false);
    setSelectedFormat(null);
    setSelectedCaseIds(new Set());
    setSelectionStartDate('');
    setSelectionEndDate('');
    setSelectionClient('all');
    setSelectionSearchTerm('');
  };

  // Filter cases for selection dialog
  const selectionFilteredCases = useMemo(() => {
    return cases.filter(caseItem => {
      // Search filter - uses same expanded search as main filter
      const matchesSearch = caseMatchesSearch(caseItem, selectionSearchTerm);

      // Date range filter
      let matchesDateRange = true;
      if (selectionStartDate || selectionEndDate) {
        const caseDate = new Date(caseItem.created_at);
        caseDate.setHours(0, 0, 0, 0);
        
        if (selectionStartDate) {
          const start = new Date(selectionStartDate);
          start.setHours(0, 0, 0, 0);
          if (caseDate < start) matchesDateRange = false;
        }
        
        if (selectionEndDate && matchesDateRange) {
          const end = new Date(selectionEndDate);
          end.setHours(23, 59, 59, 999);
          if (caseDate > end) matchesDateRange = false;
        }
      }

      // Client filter
      const matchesClient = selectionClient === 'all' || caseItem.client.id === selectionClient;

      return matchesSearch && matchesDateRange && matchesClient;
    });
  }, [cases, selectionSearchTerm, selectionStartDate, selectionEndDate, selectionClient]);

  const handleToggleCaseSelection = (caseId: string) => {
    const newSelected = new Set(selectedCaseIds);
    if (newSelected.has(caseId)) {
      newSelected.delete(caseId);
    } else {
      newSelected.add(caseId);
    }
    setSelectedCaseIds(newSelected);
  };

  const handleSelectAllCases = () => {
    if (selectedCaseIds.size === selectionFilteredCases.length) {
      setSelectedCaseIds(new Set());
    } else {
      setSelectedCaseIds(new Set(selectionFilteredCases.map(c => c.id)));
    }
  };


  const handleSelectionStartDateChange = (value: string) => {
    setSelectionStartDate(value);
    if (selectionEndDate && value && selectionEndDate < value) {
      setSelectionEndDate('');
    }
  };

  const handleSelectionEndDateChange = (value: string) => {
    if (selectionStartDate && value && value < selectionStartDate) {
      toast({
        title: 'Invalid Date',
        description: 'End date cannot be before start date',
        variant: 'destructive',
      });
      return;
    }
    setSelectionEndDate(value);
  };

  // Generate CSV with case number for bulk download
  const generateBulkCSV = async (submissions: Array<FormSubmissionData & { case_number?: string; _contract_type?: string; _is_positive?: boolean }>): Promise<string> => {
    if (submissions.length === 0) {
      return '';
    }

    // Group submissions by case
    const submissionsByCase = new Map<string, Array<FormSubmissionData & { case_number?: string; _contract_type?: string; _is_positive?: boolean }>>();
    submissions.forEach(sub => {
      const caseNum = sub.case_number || 'unknown';
      if (!submissionsByCase.has(caseNum)) {
        submissionsByCase.set(caseNum, []);
      }
      submissionsByCase.get(caseNum)!.push(sub);
    });

    // Process each case separately to handle negative cases correctly
    const csvRows: string[] = [];
    let headers: string[] = [];
    const allHeaders = new Set<string>();

    for (const [caseNumber, caseSubmissions] of submissionsByCase.entries()) {
      const firstSubmission = caseSubmissions[0];
      const contractType = firstSubmission._contract_type;
      const isPositive = firstSubmission._is_positive;

      // Clean submissions (remove metadata)
      const cleanSubmissions = caseSubmissions.map(sub => {
        const { case_number, _contract_type, _is_positive, ...clean } = sub;
        return clean as FormSubmissionData;
      });

      // Generate CSV for this case
      const caseCSV = await CSVService.convertFormSubmissionsToCSV(cleanSubmissions, contractType, isPositive);
      const lines = caseCSV.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) continue;

      // First line is headers
      if (headers.length === 0) {
        headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, ''));
        headers.forEach(h => allHeaders.add(h));
        // Add "Case Number" as first column
        csvRows.push('Case Number,' + lines[0]);
      } else {
        // Collect all headers from this case
        const caseHeaders = lines[0].split(',').map(h => h.replace(/^"|"$/g, ''));
        caseHeaders.forEach(h => allHeaders.add(h));
      }

      // Add data rows with case number
      const dataLines = lines.slice(1);
      dataLines.forEach(line => {
        const escapedCaseNumber = (caseNumber.includes(',') || caseNumber.includes('"') || caseNumber.includes('\n')) 
          ? `"${caseNumber.replace(/"/g, '""')}"` 
          : caseNumber;
        csvRows.push(escapedCaseNumber + ',' + line);
      });
    }

    // If we have multiple cases with different headers, we need to normalize
    // For now, return the combined CSV
    return csvRows.join('\n');
  };

  const fetchFormSubmissions = async (caseId: string): Promise<any[]> => {
    // Use EXACT same logic as DynamicFormSubmission component
    // This ensures we get the exact same data structure that CaseDetail uses
    try {
      console.log('DynamicFormSubmission: Fetching submissions for case:', caseId);
      
      // First try to get final submissions
      let { data, error } = await supabase
        .from('form_submissions' as any)
        .select(`
          *,
          form_template:form_templates(
            template_name, 
            template_version,
            form_fields(field_key, field_title, field_type, field_order)
          ),
          form_submission_files(
            id,
            field_id,
            file_url,
            file_name,
            file_size,
            mime_type,
            uploaded_at,
            form_field:form_fields(field_title, field_type, field_key)
          )
        `)
        .eq('case_id', caseId)
        .eq('status', 'final')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log('DynamicFormSubmission: Form submissions query result:', {
        data,
        error,
        count: data?.length || 0
      });
      
      // If no final submissions found, try to get draft submissions
      if (!data || data.length === 0) {
        const { data: draftData, error: draftError } = await supabase
          .from('form_submissions' as any)
          .select(`
            *,
            form_template:form_templates(
              template_name, 
              template_version,
              form_fields(field_key, field_title, field_type, field_order)
            ),
            form_submission_files(
              id,
              field_id,
              file_url,
              file_name,
              file_size,
              mime_type,
              uploaded_at,
              form_field:form_fields(field_title, field_type, field_key)
            )
          `)
          .eq('case_id', caseId)
          .eq('status', 'draft')
          .order('created_at', { ascending: false });

        if (draftError) throw draftError;
        
        console.log('DynamicFormSubmission: Draft submissions query result:', {
          data: draftData,
          error: draftError,
          count: draftData?.length || 0
        });
        
        data = draftData;
      }
      
      // Transform the data to include form_fields at the submission level
      let transformedData = data?.map((submission: any) => ({
        ...submission,
        form_fields: submission.form_template?.form_fields || []
      })) || [];
      
      // If no form submissions found, try legacy submissions table
      if (transformedData.length === 0) {
        console.log('No form submissions found, checking legacy submissions table...');
        
        const { data: legacyData, error: legacyError } = await supabase
          .from('submissions' as any)
          .select('*')
          .eq('case_id', caseId)
          .order('submitted_at', { ascending: false });

        if (legacyError) {
          console.error('Error fetching legacy submissions:', legacyError);
        } else if (legacyData && legacyData.length > 0) {
          console.log('Found legacy submissions:', legacyData);
          
          // Transform legacy submissions to match the expected format
          transformedData = legacyData.map((submission: any) => ({
            id: submission.id,
            case_id: submission.case_id,
            template_id: null,
            gig_partner_id: submission.gig_partner_id,
            submission_data: submission.answers || {},
            status: 'final',
            created_at: submission.created_at,
            updated_at: submission.updated_at,
            submitted_at: submission.submitted_at,
            form_template: {
              template_name: 'Legacy Submission',
              template_version: 1
            },
            form_submission_files: [],
            form_fields: Object.keys(submission.answers || {}).map((key, index) => ({
              field_key: key,
              field_title: key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
              field_type: 'text',
              field_order: index
            }))
          }));
        }
      }
      
      // Debug logging for file uploads (EXACT same as DynamicFormSubmission)
      if (transformedData.length > 0) {
        console.log('Form submission data:', {
          submissionId: transformedData[0].id,
          status: transformedData[0].status,
          files: transformedData[0].form_submission_files,
          fileCount: transformedData[0].form_submission_files?.length || 0,
          rawData: transformedData[0]
        });
        
        // Check if there are any file upload fields
        const fileUploadFields = transformedData[0].form_fields?.filter(f => f.field_type === 'file_upload') || [];
        console.log('File upload fields:', fileUploadFields);
        
        // Direct database query to check for files
        const { data: directFiles, error: directFilesError } = await supabase
          .from('form_submission_files' as any)
          .select('*')
          .eq('submission_id', transformedData[0].id);
        
        console.log('Direct database query for files:', {
          directFiles,
          directFilesError,
          directFileCount: directFiles?.length || 0
        });
      } else {
        console.log('No submissions found in either form_submissions or submissions table for case:', caseId);
      }
      
      // Return EXACT same format as DynamicFormSubmission returns to CaseDetail
      // This is what CaseDetail receives via onSubmissionsLoaded callback
      return transformedData;
    } catch (error) {
      console.error('Error fetching form submissions:', error);
      return [];
    }
  };

  const handleDownloadCSV = async (caseItem: Case) => {
    try {
      setIsDownloading(true);
      setDownloadingCase(caseItem.id);
      setDownloadProgress(20);
      
      const submissions = await fetchFormSubmissions(caseItem.id);
      setDownloadProgress(60);
      
      if (submissions.length === 0) {
        setIsDownloading(false);
        setDownloadingCase(null);
        setDownloadProgress(0);
        toast({
          title: 'No Data',
          description: 'No form submissions found for this case',
          variant: 'destructive',
        });
        return;
      }

      const csvContent = CSVService.convertFormSubmissionsToCSV(submissions);
      setDownloadProgress(80);
      
      if (!csvContent) {
        setIsDownloading(false);
        setDownloadingCase(null);
        setDownloadProgress(0);
        toast({
          title: 'Error',
          description: 'Failed to generate CSV content',
          variant: 'destructive',
        });
        return;
      }

      CSVService.downloadCSV(csvContent, `${caseItem.case_number}_submissions.csv`);
      setDownloadProgress(100);
      
      toast({
        title: 'Success',
        description: 'CSV file downloaded successfully',
      });
      
      setTimeout(() => {
        setIsDownloading(false);
        setDownloadingCase(null);
        setDownloadProgress(0);
      }, 500);
    } catch (error) {
      console.error('Error downloading CSV:', error);
      setIsDownloading(false);
      setDownloadingCase(null);
      setDownloadProgress(0);
      toast({
        title: 'Error',
        description: 'Failed to download CSV',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadPDF = async (caseItem: Case) => {
    // Use exact same process as CaseDetail's handlePDFDownload
    // First fetch submissions (same as DynamicFormSubmission does)
    const submissions = await fetchFormSubmissions(caseItem.id);
    
    // Debug: Log the submissions data structure
    console.log('Reports: Submissions data structure:', {
      count: submissions.length,
      firstSubmission: submissions[0] ? {
        id: submissions[0].id,
        hasFormFields: !!submissions[0].form_fields,
        formFieldsCount: submissions[0].form_fields?.length || 0,
        hasSubmissionData: !!submissions[0].submission_data,
        submissionDataKeys: Object.keys(submissions[0].submission_data || {}),
        hasFormTemplate: !!submissions[0].form_template,
        formTemplate: submissions[0].form_template,
        hasFormSubmissionFiles: !!submissions[0].form_submission_files,
        formSubmissionFilesCount: submissions[0].form_submission_files?.length || 0,
        fullStructure: submissions[0]
      } : null
    });
    
    if (submissions.length === 0) {
      toast({
        title: 'No Data',
        description: 'No form submissions available to download',
        variant: 'destructive',
      });
      return;
    }

    // Exact same logic as CaseDetail's handlePDFDownload
    try {
      setIsDownloading(true);
      setDownloadType('pdf');
      setDownloadProgress(10);

      setDownloadProgress(40);
      
      // Prepare case data for auto-fill in negative case PDFs
      const caseDataForPDF: CaseDataForPDF = {
        case_number: caseItem.case_number,
        client_case_id: caseItem.client_case_id,
        candidate_name: caseItem.candidate_name,
        phone_primary: caseItem.phone_primary,
        location: {
          city: caseItem.location?.city,
          address_line: caseItem.location?.address_line,
          pincode: caseItem.location?.pincode,
          lat: caseItem.location?.lat,
          lng: caseItem.location?.lng
        },
        contract_type: caseItem.contract_type,
        company_name: (caseItem as any).company_name
      };
      
      await PDFService.convertFormSubmissionsToPDF(
        submissions, 
        caseItem.case_number, 
        caseItem.contract_type,
        caseItem.is_positive,
        caseDataForPDF
      );
      
      setDownloadProgress(100);
      toast({
        title: 'Success',
        description: 'PDF file downloaded successfully',
      });

      setTimeout(() => {
        setIsDownloading(false);
        setDownloadType(null);
        setDownloadProgress(0);
      }, 500);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setIsDownloading(false);
      setDownloadType(null);
      setDownloadProgress(0);
      toast({
        title: 'Error',
        description: 'Failed to generate PDF file',
        variant: 'destructive',
      });
    }
  };


  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reports</CardTitle>
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
    <div className="space-y-6 pb-6">
      {/* Progress Card */}
      {isDownloading && (
        <div className="fixed bottom-4 right-4 z-50 w-80">
          <Card className="shadow-lg border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <div className="flex-1">
                  <div className="text-sm font-medium mb-1">
                    Downloading {downloadingCase ? cases.find(c => c.id === downloadingCase)?.case_number : 'file'}...
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

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground">View all submitted and QC passed cases and download reports</p>
        </div>
        <Button onClick={handleOpenBulkReportsDialog} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Bulk Reports
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reports Cases ({filteredCases.length})</CardTitle>
          <CardDescription>
            All cases with status "submitted" or "qc_passed"
          </CardDescription>
          
          {/* Filters Section */}
          <div className="mt-4 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search all case metadata..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Creation Date Range - Start Date */}
              <div className="space-y-2">
                <Label htmlFor="start-date">Creation Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  max={getTodayString()}
                />
              </div>

              {/* Creation Date Range - End Date */}
              <div className="space-y-2">
                <Label htmlFor="end-date">Creation End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  min={startDate || undefined}
                  max={getTodayString()}
                />
              </div>

              {/* Client Filter */}
              <div className="space-y-2">
                <Label htmlFor="client-filter">Client</Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger id="client-filter">
                    <SelectValue placeholder="All Clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Clear Filters Button */}
              <div className="space-y-2">
                <Label>&nbsp;</Label>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    className="w-full"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>

            {/* Second Filter Row - Submission and Approval Date Ranges */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Submission Date Range - Start Date */}
              <div className="space-y-2">
                <Label htmlFor="submission-start-date">Submission Start Date</Label>
                <Input
                  id="submission-start-date"
                  type="date"
                  value={submissionStartDate}
                  onChange={(e) => handleSubmissionStartDateChange(e.target.value)}
                  max={getTodayString()}
                />
              </div>

              {/* Submission Date Range - End Date */}
              <div className="space-y-2">
                <Label htmlFor="submission-end-date">Submission End Date</Label>
                <Input
                  id="submission-end-date"
                  type="date"
                  value={submissionEndDate}
                  onChange={(e) => handleSubmissionEndDateChange(e.target.value)}
                  min={submissionStartDate || undefined}
                  max={getTodayString()}
                />
              </div>

              {/* Approval Date Range - Start Date */}
              <div className="space-y-2">
                <Label htmlFor="approval-start-date">Approval Start Date</Label>
                <Input
                  id="approval-start-date"
                  type="date"
                  value={approvalStartDate}
                  onChange={(e) => handleApprovalStartDateChange(e.target.value)}
                  max={getTodayString()}
                />
              </div>

              {/* Approval Date Range - End Date */}
              <div className="space-y-2">
                <Label htmlFor="approval-end-date">Approval End Date</Label>
                <Input
                  id="approval-end-date"
                  type="date"
                  value={approvalEndDate}
                  onChange={(e) => handleApprovalEndDateChange(e.target.value)}
                  min={approvalStartDate || undefined}
                  max={getTodayString()}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No cases found.
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredCases.map((caseItem) => (
                <div
                  key={caseItem.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
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
                        <Badge className={STATUS_COLORS[caseItem.status] || 'bg-gray-100 text-gray-800'}>
                          {highlightText(STATUS_LABELS[caseItem.status] || caseItem.status, searchTerm)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {highlightText(caseItem.client_case_id, searchTerm)} • {getContractTypeBadge(caseItem.contract_type, searchTerm)}
                      </p>
                      <h4 className="font-medium text-base mb-1">{highlightText(caseItem.candidate_name, searchTerm)}</h4>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadCSV(caseItem)}
                      >
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        CSV
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadPDF(caseItem)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
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

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Created At</p>
                        <p className="font-medium">{highlightText(format(new Date(caseItem.created_at), 'MMM dd, yyyy'), searchTerm)}</p>
                        <p className="text-xs text-muted-foreground">{highlightText(format(new Date(caseItem.created_at), 'HH:mm'), searchTerm)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Submitted At</p>
                        <p className="font-medium">
                          {caseItem.submitted_at ? highlightText(format(new Date(caseItem.submitted_at), 'MMM dd, yyyy HH:mm'), searchTerm) : 'N/A'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {caseItem.submitted_at ? 'Submission time' : 'Not submitted'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Total Payout (INR)</p>
                        <p className="font-medium">{highlightText(`₹${caseItem.total_payout_inr || 0}`, searchTerm)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Reports Format Selection Dialog */}
      <Dialog open={bulkReportsDialogOpen} onOpenChange={setBulkReportsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Reports</DialogTitle>
            <DialogDescription>
              Select the format for bulk download
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2"
              onClick={() => handleSelectFormat('csv')}
            >
              <FileSpreadsheet className="h-8 w-8" />
              <span>CSV</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2"
              onClick={() => handleSelectFormat('pdf')}
            >
              <FileText className="h-8 w-8" />
              <span>PDF</span>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkReportsDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Case Selection Dialog */}
      <Dialog open={caseSelectionDialogOpen} onOpenChange={handleCloseCaseSelection}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              Select Cases for Bulk {selectedFormat?.toUpperCase()} Download
            </DialogTitle>
            <DialogDescription>
              Select the cases you want to download. {selectedCaseIds.size > 0 && `${selectedCaseIds.size} case(s) selected`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Filters */}
            <div className="space-y-3 border-b pb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search all case metadata..."
                  value={selectionSearchTerm}
                  onChange={(e) => setSelectionSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="selection-start-date">Start Date</Label>
                  <Input
                    id="selection-start-date"
                    type="date"
                    value={selectionStartDate}
                    onChange={(e) => handleSelectionStartDateChange(e.target.value)}
                    max={getTodayString()}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="selection-end-date">End Date</Label>
                  <Input
                    id="selection-end-date"
                    type="date"
                    value={selectionEndDate}
                    onChange={(e) => handleSelectionEndDateChange(e.target.value)}
                    min={selectionStartDate || undefined}
                    max={getTodayString()}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="selection-client-filter">Client</Label>
                  <Select value={selectionClient} onValueChange={setSelectionClient}>
                    <SelectTrigger id="selection-client-filter">
                      <SelectValue placeholder="All Clients" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clients</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Case List */}
            <ScrollArea className="h-[400px] border rounded-md p-4">
              {selectionFilteredCases.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No cases found.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 pb-2 border-b">
                    <Checkbox
                      checked={selectedCaseIds.size === selectionFilteredCases.length && selectionFilteredCases.length > 0}
                      onCheckedChange={handleSelectAllCases}
                    />
                    <Label className="font-semibold">
                      Select All ({selectionFilteredCases.length} cases)
                    </Label>
                  </div>
                  {selectionFilteredCases.map((caseItem) => (
                    <div
                      key={caseItem.id}
                      className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedCaseIds.has(caseItem.id)}
                        onCheckedChange={() => handleToggleCaseSelection(caseItem.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{caseItem.case_number}</h4>
                          {isRecreatedCase(caseItem.case_number) && (
                            <Badge variant="outline" className="text-xs">
                              Recreated
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{caseItem.client_case_id}</p>
                        <p className="text-sm font-medium">{caseItem.candidate_name}</p>
                        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                          <span>{caseItem.client.name}</span>
                          <span>{caseItem.location.city}, {caseItem.location.state}</span>
                          <span>{format(new Date(caseItem.created_at), 'MMM dd, yyyy')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseCaseSelection}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkDownload}
              disabled={selectedCaseIds.size === 0 || isDownloading}
            >
              {isDownloading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download {selectedCaseIds.size} {selectedFormat?.toUpperCase()} {selectedCaseIds.size === 1 ? 'Report' : 'Reports'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
