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
import { PDFService } from '@/services/pdfService';
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
  const [downloadingCase, setDownloadingCase] = useState<string | null>(null);
  const { toast } = useToast();

  // Filter states
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
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
      
      // Get today's date at 00:00:00
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISOString = today.toISOString();
      
      const { data, error } = await supabase
        .from('cases')
        .select(`
          *,
          clients(id, name, contact_person, phone, email),
          locations(id, address_line, city, state, pincode, pincode_tier, lat, lng, location_url)
        `)
        .in('status', ['submitted', 'qc_passed'])
        .gte('created_at', todayISOString)
        .order('created_at', { ascending: false });

      if (error) throw error;

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
        assigned_at: caseItem.assigned_at,
        submitted_at: caseItem.submitted_at
      })) || [];

      // Show only cases created today and onwards
      console.log(`Reports loaded ${formattedCases.length} cases with status 'submitted' or 'qc_passed' (created from today onwards)`);

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

  const filteredCases = cases.filter(caseItem => {
    // Search filter
    const matchesSearch = 
      caseItem.case_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      caseItem.client_case_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      caseItem.candidate_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      caseItem.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      caseItem.location.city.toLowerCase().includes(searchTerm.toLowerCase());

    // Date range filter
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

    // Client filter
    const matchesClient = selectedClient === 'all' || caseItem.client.id === selectedClient;

    return matchesSearch && matchesDateRange && matchesClient;
  });

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedClient('all');
  };

  const hasActiveFilters = startDate || endDate || selectedClient !== 'all';

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
          
          // Add case number to each submission for identification
          submissions.forEach(sub => {
            allSubmissions.push({
              ...sub,
              case_number: caseItem.case_number,
            } as FormSubmissionData & { case_number?: string });
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
        const csvContent = generateBulkCSV(allSubmissions);
        
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
          
          const submissions = await fetchFormSubmissions(caseItem.id);
          
          if (submissions.length > 0) {
            try {
              // Generate PDF as blob
              const pdfBlob = await PDFService.convertFormSubmissionsToPDFBlob(submissions, caseItem.case_number);
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
      // Search filter
      const matchesSearch = 
        caseItem.case_number.toLowerCase().includes(selectionSearchTerm.toLowerCase()) ||
        caseItem.client_case_id.toLowerCase().includes(selectionSearchTerm.toLowerCase()) ||
        caseItem.candidate_name.toLowerCase().includes(selectionSearchTerm.toLowerCase()) ||
        caseItem.client.name.toLowerCase().includes(selectionSearchTerm.toLowerCase()) ||
        caseItem.location.city.toLowerCase().includes(selectionSearchTerm.toLowerCase());

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
  const generateBulkCSV = (submissions: Array<FormSubmissionData & { case_number?: string }>): string => {
    if (submissions.length === 0) {
      return '';
    }

    // Use the existing CSVService to generate base CSV
    const baseCSV = CSVService.convertFormSubmissionsToCSV(submissions);
    
    // Check if we have multiple cases
    const uniqueCases = new Set(submissions.map(s => s.case_number).filter(Boolean));
    const hasMultipleCases = uniqueCases.size > 1;

    if (!hasMultipleCases) {
      return baseCSV;
    }

    // Parse the CSV and add case number column
    const lines = baseCSV.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      return baseCSV;
    }

    // Add "Case Number" as first column in header
    const headerLine = 'Case Number,' + lines[0];
    
    // Add case number to each data row (one row per submission)
    const dataLines = lines.slice(1).map((line, index) => {
      if (index >= submissions.length) return line; // Safety check
      const submission = submissions[index];
      const caseNumber = submission?.case_number || '';
      // Escape case number if it contains commas/quotes
      const escapedCaseNumber = (caseNumber.includes(',') || caseNumber.includes('"') || caseNumber.includes('\n')) 
        ? `"${caseNumber.replace(/"/g, '""')}"` 
        : caseNumber;
      return escapedCaseNumber + ',' + line;
    });

    return [headerLine, ...dataLines].join('\n');
  };

  const fetchFormSubmissions = async (caseId: string): Promise<FormSubmissionData[]> => {
    try {
      console.log('Fetching form submissions for case:', caseId);
      
      // Fetch form submissions for the case
      const { data, error } = await supabase
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
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log('Form submissions query result:', {
        data,
        error,
        count: data?.length || 0
      });
      
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

      // Transform to FormSubmissionData format
      return transformedData.map((submission: any) => ({
        id: submission.id,
        template_name: submission.form_template?.template_name || 'Unknown',
        template_version: submission.form_template?.template_version || 1,
        status: 'final', // All submissions are considered final
        submitted_at: submission.submitted_at || submission.created_at || undefined,
        form_fields: submission.form_fields || [],
        submission_data: submission.submission_data || {},
        form_submission_files: submission.form_submission_files?.map((file: any) => ({
          id: file.id,
          field_id: file.field_id,
          file_url: file.file_url,
          file_name: file.file_name,
          file_size: file.file_size,
          mime_type: file.mime_type,
          uploaded_at: file.uploaded_at,
          form_field: file.form_field
        })) || []
      }));
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
    try {
      setIsDownloading(true);
      setDownloadingCase(caseItem.id);
      setDownloadProgress(20);
      
      const submissions = await fetchFormSubmissions(caseItem.id);
      setDownloadProgress(40);
      
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

      setDownloadProgress(60);
      await PDFService.convertFormSubmissionsToPDF(submissions, caseItem.case_number);
      setDownloadProgress(100);
      
      toast({
        title: 'Success',
        description: 'PDF file downloaded successfully',
      });
      
      setTimeout(() => {
        setIsDownloading(false);
        setDownloadingCase(null);
        setDownloadProgress(0);
      }, 500);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      setIsDownloading(false);
      setDownloadingCase(null);
      setDownloadProgress(0);
      toast({
        title: 'Error',
        description: 'Failed to generate PDF',
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
                placeholder="Search cases..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Date Range - Start Date */}
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  max={getTodayString()}
                />
              </div>

              {/* Date Range - End Date */}
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
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
                          {caseItem.case_number}
                          {isRecreatedCase(caseItem.case_number) && (
                            <Badge variant="outline" className="text-xs border-orange-300 text-orange-700 bg-orange-50">
                              Recreated
                            </Badge>
                          )}
                        </h3>
                        <Badge className={STATUS_COLORS[caseItem.status] || 'bg-gray-100 text-gray-800'}>
                          {STATUS_LABELS[caseItem.status] || caseItem.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {caseItem.client_case_id}
                      </p>
                      <h4 className="font-medium text-base mb-1">{caseItem.candidate_name}</h4>
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
                        <p className="font-medium">{caseItem.client.name}</p>
                        <p className="text-xs text-muted-foreground">{caseItem.client.email}</p>
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
                        {caseItem.location.location_url ? (
                          <a
                            href={caseItem.location.location_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          >
                            {caseItem.location.city}, {caseItem.location.state}
                          </a>
                        ) : (
                          <p className="font-medium">{caseItem.location.city}, {caseItem.location.state}</p>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{caseItem.location.pincode}</span>
                          <Badge variant="outline" className="text-xs">
                            Tier {getTierNumber(caseItem.location.pincode_tier)}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">TAT Hours</p>
                        <p className="font-medium">{caseItem.tat_hours}h</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Created At</p>
                        <p className="font-medium">{format(new Date(caseItem.created_at), 'MMM dd, yyyy')}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(caseItem.created_at), 'HH:mm')}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Submitted At</p>
                        <p className="font-medium">
                          {caseItem.submitted_at ? format(new Date(caseItem.submitted_at), 'MMM dd, yyyy') : 'N/A'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {caseItem.submitted_at ? format(new Date(caseItem.submitted_at), 'HH:mm') : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Total Payout (INR)</p>
                        <p className="font-medium">₹{caseItem.total_payout_inr || 0}</p>
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
                  placeholder="Search cases..."
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
