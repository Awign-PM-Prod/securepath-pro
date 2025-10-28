import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Search, Download, FileSpreadsheet, FileText, User, Phone, MapPin, Clock, Building, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { isRecreatedCase } from '@/utils/caseUtils';
import { CSVService, FormSubmissionData } from '@/services/csvService';
import { PDFService } from '@/services/pdfService';

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

export default function Reports() {
  const [cases, setCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadingCase, setDownloadingCase] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadSubmittedCases();
  }, []);

  const loadSubmittedCases = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('cases')
        .select(`
          *,
          clients(id, name, contact_person, phone, email),
          locations(id, address_line, city, state, pincode, pincode_tier, lat, lng, location_url)
        `)
        .eq('status', 'submitted')
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

      setCases(formattedCases);
    } catch (error) {
      console.error('Error loading submitted cases:', error);
      toast({
        title: 'Error',
        description: 'Failed to load submitted cases',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCases = cases.filter(caseItem => 
    caseItem.case_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    caseItem.client_case_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    caseItem.candidate_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    caseItem.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    caseItem.location.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <CardDescription>Loading submitted cases...</CardDescription>
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
          <p className="text-muted-foreground">View all submitted cases and download reports</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submitted Cases ({filteredCases.length})</CardTitle>
          <CardDescription>
            All cases with status "submitted"
          </CardDescription>
          <div className="mt-4">
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
        </CardHeader>
        <CardContent>
          {filteredCases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No submitted cases found.
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
                        <Badge className="bg-purple-100 text-purple-800">Submitted</Badge>
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
    </div>
  );
}
