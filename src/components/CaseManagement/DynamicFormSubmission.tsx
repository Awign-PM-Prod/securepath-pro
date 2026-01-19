import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Image, 
  Download, 
  Eye,
  Calendar,
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Edit,
  Save,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DynamicForm } from '@/components/DynamicForm';
import { formService } from '@/services/formService';
import { toast } from 'sonner';

interface FormSubmission {
  id: string;
  case_id: string;
  template_id: string;
  gig_partner_id: string;
  submission_data: Record<string, any>;
  status: 'draft' | 'final';
  created_at: string;
  updated_at: string;
  submitted_at?: string;
  form_template?: {
    template_name: string;
    template_version: number;
  };
  form_submission_files?: Array<{
    id: string;
    field_id: string;
    file_url: string;
    file_name: string;
    file_size: number;
    mime_type: string;
    uploaded_at: string;
    form_field?: {
      field_title: string;
      field_type: string;
      field_key: string;
    };
  }>;
  form_fields?: Array<{
    field_key: string;
    field_title: string;
    field_type: string;
    field_order?: number;
  }>;
}

interface DynamicFormSubmissionProps {
  caseId: string;
  caseStatus?: string; // Case status to check if editing is allowed
  onSubmissionsLoaded?: (submissions: FormSubmission[]) => void;
  qcReviewData?: any; // QC review data for rework cases
}

// Status badge styling and labels
const STATUS_COLORS: Record<string, string> = {
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

const STATUS_LABELS: Record<string, string> = {
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

const getStatusBadgeClass = (status: string | undefined): string => {
  if (!status) return 'bg-gray-100 text-gray-800';
  return STATUS_COLORS[status] || 'bg-gray-100 text-gray-800';
};

const getStatusLabel = (status: string | undefined): string => {
  if (!status) return 'Unknown';
  return STATUS_LABELS[status] || status;
};

export default function DynamicFormSubmission({ caseId, caseStatus, onSubmissionsLoaded, qcReviewData }: DynamicFormSubmissionProps) {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingSubmission, setEditingSubmission] = useState<FormSubmission | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { user, hasRole } = useAuth();

  // Check if user can edit (ops_team, qc_team, or super_admin)
  const canEdit = hasRole('ops_team') || hasRole('qc_team') || hasRole('super_admin');
  
  // Check if editing is allowed for this case status
  const canEditThisCase = canEdit && (caseStatus === 'submitted' || caseStatus === 'qc_passed');

  // Helper function to parse timestamp from filename
  const parseTimestampFromFilename = (filename: string) => {
    // Look for timestamp pattern: YYYY-MM-DDTHH-MM-SS-sssZ
    const timestampMatch = filename.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/);
    if (timestampMatch) {
      try {
        // Convert back to ISO format
        const isoString = timestampMatch[1].replace(/-/g, ':').replace(/(\d{2}):(\d{2}):(\d{2})-(\d{3})/, '$1:$2:$3.$4');
        const date = new Date(isoString);
        
        // Check if the date is valid
        if (isNaN(date.getTime())) {
          return null;
        }
        return date;
      } catch (e) {
        return null;
      }
    }
    return null;
  };

  // Helper function to parse location from filename
  const parseLocationFromFilename = (filename: string) => {
    // Look for location pattern: -lat-lng at the end of filename
    const locationMatch = filename.match(/-(\d+\.\d+)-(\d+\.\d+)\./);
    if (locationMatch) {
      try {
        const lat = parseFloat(locationMatch[1]);
        const lng = parseFloat(locationMatch[2]);
        return { lat, lng };
      } catch (e) {
        return null;
      }
    }
    return null;
  };

  // Helper function to get display name for file (without timestamps and location)
  const getDisplayFileName = (filename: string) => {
    // Remove timestamp and location patterns from filename for display
    return filename
      .replace(/-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z/g, '') // Remove timestamp patterns
      .replace(/-\d+\.\d+-\d+\.\d+\./, '.') // Remove location patterns
      .replace(/camera-capture-/, 'camera-capture'); // Keep camera-capture prefix
  };

  // Helper function to determine if file is camera capture
  const isCameraCapture = (filename: string) => {
    return filename.includes('camera-capture');
  };

  useEffect(() => {
    fetchFormSubmissions();
  }, [caseId]);

  const fetchFormSubmissions = async () => {
    try {
      setLoading(true);
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
      
      // Debug logging for file uploads
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
      
      setSubmissions(transformedData);
      onSubmissionsLoaded?.(transformedData);
    } catch (err) {
      console.error('Error fetching form submissions:', err);
      setError('Failed to load form submissions');
    } finally {
      setLoading(false);
    }
  };

  const renderFieldValue = (fieldKey: string, value: any, fieldType: string, fieldTitle: string, submission: FormSubmission) => {
    switch (fieldType) {
      case 'signature':
        // Handle signature fields - display as image
        const signatureFieldFiles = submission.form_submission_files?.filter(file => 
          file.form_field?.field_key === fieldKey
        ) || [];
        const signatureUrl = value || (signatureFieldFiles.length > 0 ? signatureFieldFiles[0].file_url : null);
        
        if (!signatureUrl) {
          return <span className="text-muted-foreground">No signature provided</span>;
        }
        
        return (
          <div className="space-y-2">
            <div className="border-2 border-gray-300 rounded-lg bg-white p-6 flex items-center justify-center min-h-[200px]">
              <img
                src={signatureUrl}
                alt={fieldTitle}
                className="max-w-full max-h-[300px] object-contain"
                style={{ 
                  imageRendering: 'auto',
                  mixBlendMode: 'normal'
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const errorDiv = target.nextElementSibling as HTMLElement;
                  if (errorDiv) {
                    errorDiv.classList.remove('hidden');
                  }
                }}
              />
              <div className="hidden text-muted-foreground text-sm">
                Failed to load signature image
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                asChild
              >
                <a href={signatureUrl} target="_blank" rel="noopener noreferrer">
                  <Eye className="h-4 w-4 mr-2" />
                  View Full Size
                </a>
              </Button>
              <Button
                size="sm"
                variant="outline"
                asChild
              >
                <a href={signatureUrl} download={`${fieldKey}.png`}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </a>
              </Button>
            </div>
          </div>
        );
      case 'file_upload':
        // Find files for this field and de-duplicate by file_name
        const fieldFilesRaw = submission.form_submission_files?.filter(file => 
          file.form_field?.field_key === fieldKey
        ) || [];
        const seen = new Set<string>();
        const fieldFiles = fieldFilesRaw.filter(f => {
          const fileName = f.file_name || '';
          if (!fileName) return true; // Keep files without names
          
          if (seen.has(fileName)) {
            console.log('Skipping duplicate file by name:', fileName);
            return false;
          }
          seen.add(fileName);
          return true;
        });
        
        // Debug logging for file upload fields
        console.log(`File upload field ${fieldKey}:`, {
          allFiles: submission.form_submission_files,
          fieldFiles,
          fieldFilesCount: fieldFiles.length,
          fieldKey
        });
        
        if (fieldFiles.length === 0) {
          return <span className="text-muted-foreground">No files uploaded</span>;
        }
        
        return (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground mb-2">
              {fieldFiles.length} file(s) uploaded
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {fieldFiles.map((file) => (
                <div key={file.id} className="relative group">
                  <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border">
                    {file.mime_type.startsWith('image/') ? (
                      <img
                        src={file.file_url}
                        alt={file.file_name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`w-full h-full flex items-center justify-center ${file.mime_type.startsWith('image/') ? 'hidden' : ''}`}>
                      <FileText className="h-8 w-8 text-gray-400" />
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 w-8 p-0"
                      asChild
                    >
                      <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                        <Eye className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 w-8 p-0"
                      asChild
                    >
                      <a href={file.file_url} download={file.file_name}>
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                    {(() => {
                      // Check if this file has location data
                      let location = parseLocationFromFilename(file.file_name);
                      
                      // If not found in filename, try to get from metadata
                      if (!location && submission.submission_data._metadata?.individual_file_locations) {
                        const individualLocations = submission.submission_data._metadata.individual_file_locations[fieldKey];
                        if (individualLocations) {
                          const fileIndex = fieldFiles.findIndex(f => f.file_name === file.file_name);
                          if (fileIndex >= 0 && individualLocations[fileIndex]) {
                            location = individualLocations[fileIndex];
                          }
                        }
                      }
                      
                      if (location) {
                        const googleMapsUrl = `https://www.google.com/maps?q=${location.lat},${location.lng}`;
                        return (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 w-8 p-0"
                            asChild
                            title="Go to Location"
                          >
                            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                              📍
                            </a>
                          </Button>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <div className="mt-1 text-xs text-center text-gray-600 truncate">
                    <div className="flex items-center justify-center space-x-1">
                      <span className="truncate">{getDisplayFileName(file.file_name)}</span>
                      {isCameraCapture(file.file_name) && (
                        <span className="text-blue-500">📸</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      <div>Uploaded: {(() => {
                        try {
                          // Try to get timestamp from filename first (for individual file timestamps)
                          const filenameTimestamp = parseTimestampFromFilename(file.file_name);
                          if (filenameTimestamp) {
                            return format(filenameTimestamp, 'MMM dd, HH:mm');
                          }
                          
                          // Fallback to database uploaded_at
                          let date;
                          if (file.uploaded_at && typeof file.uploaded_at === 'object' && file.uploaded_at !== null && 'getTime' in (file.uploaded_at as any)) {
                            date = file.uploaded_at as Date;
                          } else if (typeof file.uploaded_at === 'string') {
                            date = new Date(file.uploaded_at);
                          } else if (typeof file.uploaded_at === 'number') {
                            date = new Date(file.uploaded_at);
                          } else {
                            return 'Invalid date format';
                          }
                          
                          if (isNaN(date.getTime())) {
                            return 'Invalid date';
                          }
                          
                          return format(date, 'MMM dd, HH:mm');
                        } catch (e) {
                          return 'Invalid date';
                        }
                      })()}</div>
                      {(() => {
                        // First try to get location from filename (for camera captures)
                        let location = parseLocationFromFilename(file.file_name);
                        
                        // If not found in filename, try to get from metadata
                        if (!location && submission.submission_data._metadata?.individual_file_locations) {
                          const individualLocations = submission.submission_data._metadata.individual_file_locations[fieldKey];
                          if (individualLocations) {
                            // Find the location for this specific file by matching filename
                            const fileIndex = fieldFiles.findIndex(f => f.file_name === file.file_name);
                            if (fileIndex >= 0 && individualLocations[fileIndex]) {
                              location = individualLocations[fileIndex];
                            }
                          }
                        }
                        
                        if (location) {
                          return (
                            <div className="text-blue-600 mt-1 text-xs">
                              📍 {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'boolean':
        if (value === null || value === undefined) return <span className="text-muted-foreground">Not provided</span>;
        return (
          <div className="flex items-center gap-2">
            {value ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
            <span>{value ? 'Yes' : 'No'}</span>
          </div>
        );
      case 'multiple_choice':
        if (value === null || value === undefined) return <span className="text-muted-foreground">Not provided</span>;
        if (Array.isArray(value) && value.length === 0) return <span className="text-muted-foreground">Not provided</span>;
        if (value === '') return <span className="text-muted-foreground">Not provided</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {Array.isArray(value) ? value.map((item, index) => {
              // Handle both string values and objects with label/value structure
              const displayValue = typeof item === 'object' && item !== null && 'label' in item ? item.label : item;
              return <Badge key={index} variant="secondary">{String(displayValue)}</Badge>;
            }) : (
              // Handle single value that might be an object with label/value structure
              typeof value === 'object' && value !== null && 'label' in value ? 
                <Badge variant="secondary">{String(value.label)}</Badge> :
                <Badge variant="secondary">{String(value)}</Badge>
            )}
          </div>
        );
      case 'date':
        if (value === null || value === undefined) return <span className="text-muted-foreground">Not provided</span>;
        try {
          // Check if this is a datetime field based on field title or key
          const fieldKeyLower = fieldKey.toLowerCase();
          const fieldTitleLower = (fieldTitle || '').toLowerCase();
          
          const hasDate = fieldKeyLower.includes('date') || fieldTitleLower.includes('date');
          const hasTime = fieldKeyLower.includes('time') || fieldTitleLower.includes('time');
          const hasVisit = fieldKeyLower.includes('visit') || fieldTitleLower.includes('visit');
          
          const isDateTimeField = fieldKeyLower.includes('datetime') || 
                                 fieldKeyLower.includes('date_time') || 
                                 fieldKeyLower.includes('dateandtime') ||
                                 fieldKeyLower.includes('date_and_time') ||
                                 fieldTitleLower.includes('date and time') ||
                                 fieldTitleLower.includes('date & time') ||
                                 (hasDate && hasTime) ||
                                 (hasVisit && hasDate && hasTime);
          
          // Format based on whether it's a datetime field
          if (isDateTimeField) {
            // Check if value contains time (has 'T' or space with time pattern)
            const dateValue = typeof value === 'string' ? value : String(value);
            const hasTimeInValue = dateValue.includes('T') || /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(dateValue);
            
            if (hasTimeInValue) {
              // Parse the date value - handle both datetime-local format (YYYY-MM-DDTHH:MM) and space-separated format
              let date: Date;
              if (dateValue.includes('T')) {
                // datetime-local format: YYYY-MM-DDTHH:MM
                date = new Date(dateValue);
              } else if (/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(dateValue)) {
                // Space-separated format: YYYY-MM-DD HH:MM
                date = new Date(dateValue.replace(' ', 'T'));
              } else {
                date = new Date(dateValue);
              }
              
              // Format with date and time
              return <span>{format(date, 'PPP p')}</span>; // e.g., "January 1, 2024 2:30 PM"
            } else {
              // Just date, but field is datetime - show date only
              return <span>{format(new Date(value), 'PPP')}</span>;
            }
          } else {
            // Regular date field - show date only
            return <span>{format(new Date(value), 'PPP')}</span>;
          }
        } catch (e) {
          console.warn('Invalid date value:', value);
          return <span className="text-muted-foreground">Invalid date</span>;
        }
      default:
        if (value === null || value === undefined) return <span className="text-muted-foreground">Not provided</span>;
        // Handle objects that might have label/value structure
        if (typeof value === 'object' && value !== null) {
          if ('label' in value) {
            return <span>{String(value.label)}</span>;
          }
          if ('value' in value) {
            return <span>{String(value.value)}</span>;
          }
          // For other objects, try to stringify safely
          try {
            return <span>{JSON.stringify(value)}</span>;
          } catch (e) {
            return <span className="text-muted-foreground">[Object]</span>;
          }
        }
        return <span>{String(value)}</span>;
    }
  };


  if (loading) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading form submissions...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Error Loading Submissions</h3>
          <p className="text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (submissions.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No Form Submissions</h3>
          <p className="text-muted-foreground">No dynamic form submissions have been made for this case yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-h-[70vh] overflow-y-auto space-y-6 p-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
      {/* QC Review Details for Rework Cases */}
      {qcReviewData && (
        <Card className="bg-red-50 border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900">
              <AlertCircle className="h-5 w-5" />
              QC Review - Rework Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="bg-red-100 rounded-lg p-3">
                <div className="font-medium text-red-800 mb-1">QC Decision: Rework Required</div>
                <div className="text-red-700">
                  Reviewed by: QC Team (ID: {qcReviewData.reviewer_id})
                </div>
                <div className="text-red-700">
                  Reviewed on: {new Date(qcReviewData.reviewed_at).toLocaleString()}
                </div>
              </div>
              
              {/* QC Remarks/Comments */}
              {qcReviewData.comments && (
                <div>
                  <div className="font-medium text-gray-900 mb-2">QC Remarks:</div>
                  <div className="bg-purple-50 rounded-lg p-3 text-sm whitespace-pre-wrap">
                    {qcReviewData.comments}
                  </div>
                </div>
              )}
              
              {/* Reason Code */}
              {qcReviewData.reason_code && (
                <div>
                  <div className="font-medium text-gray-900 mb-2">Reason Code:</div>
                  <div className="bg-indigo-50 rounded-lg p-3 text-sm">
                    {qcReviewData.reason_code.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </div>
                </div>
              )}
              
              {/* Issues Found */}
              {qcReviewData.issues_found && qcReviewData.issues_found.length > 0 && (
                <div>
                  <div className="font-medium text-gray-900 mb-2">Issues Found:</div>
                  <div className="space-y-1">
                    {qcReviewData.issues_found.map((issue: string, index: number) => (
                      <div key={index} className="bg-yellow-50 rounded p-2 text-sm">
                        • {issue.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Rework Instructions */}
              {qcReviewData.rework_instructions && (
                <div>
                  <div className="font-medium text-gray-900 mb-2">Rework Instructions:</div>
                  <div className="bg-blue-50 rounded-lg p-3 text-sm whitespace-pre-wrap">
                    {qcReviewData.rework_instructions}
                  </div>
                </div>
              )}
              
              {qcReviewData.rework_deadline && (
                <div>
                  <div className="font-medium text-gray-900 mb-2">Original Rework Deadline:</div>
                  <div className="bg-orange-50 rounded-lg p-3 text-sm">
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
          </CardContent>
        </Card>
      )}
      
      {submissions.map((submission) => (
        <Card key={submission.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {submission.form_template?.template_name || 'Form Submission'}
                {caseStatus && (
                  <Badge className={getStatusBadgeClass(caseStatus)}>
                    {getStatusLabel(caseStatus)}
                  </Badge>
                )}
              </CardTitle>
              {canEditThisCase && !isEditMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingSubmission(submission);
                    setIsEditMode(true);
                  }}
                  className="flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Edit Response
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {submission.status === 'draft' ? 'Last saved on ' : 'Submitted on '}
                {(() => {
                  try {
                    const dateField = submission.status === 'draft' ? submission.updated_at : submission.submitted_at;
                    return format(new Date(dateField), 'PPP p');
                  } catch (e) {
                    console.warn('Invalid date:', submission.status === 'draft' ? submission.updated_at : submission.submitted_at);
                    return 'Invalid date';
                  }
                })()}
              </span>
              {(() => {
                // Check if form submission has location data
                const submissionLocation = submission.submission_data._metadata?.submission_location;
                if (submissionLocation && submissionLocation.lat && submissionLocation.lng) {
                  const googleMapsUrl = `https://www.google.com/maps?q=${submissionLocation.lat},${submissionLocation.lng}`;
                  return (
                    <span className="flex items-center gap-1">
                      <a 
                        href={googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer inline-flex items-center gap-1"
                        title="View submission location on Google Maps"
                      >
                        📍 {submissionLocation.address || `${submissionLocation.lat.toFixed(4)}, ${submissionLocation.lng.toFixed(4)}`}
                      </a>
                    </span>
                  );
                }
                return null;
              })()}
            </div>
          </CardHeader>
          <CardContent>
            {isEditMode && editingSubmission?.id === submission.id ? (
              <EditFormView
                submission={submission}
                caseId={caseId}
                onCancel={() => {
                  setIsEditMode(false);
                  setEditingSubmission(null);
                }}
                onSave={async () => {
                  setIsEditMode(false);
                  setEditingSubmission(null);
                  // Refresh submissions after save
                  await fetchFormSubmissions();
                }}
              />
            ) : (
              <div className="space-y-6">
                {/* Render all form fields, including file upload fields and signature fields */}
                {submission.form_fields
                ?.sort((a, b) => (a.field_order || 0) - (b.field_order || 0))
                ?.map((fieldInfo) => {
                const fieldKey = fieldInfo.field_key;
                const fieldTitle = fieldInfo.field_title;
                const fieldType = fieldInfo.field_type;
                
                // Get the value from submission_data (for text fields)
                const value = submission.submission_data[fieldKey];
                
                // For file upload fields, check if there are files even if no text value
                const hasFiles = fieldType === 'file_upload' && 
                  submission.form_submission_files?.some(file => 
                    file.form_field?.field_key === fieldKey
                  );
                
                // Show all fields - let the renderFieldValue function handle empty states
                
                return (
                  <div key={fieldKey} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-lg">{fieldTitle}</h4>
                    </div>
                    <div className="text-sm">
                      {renderFieldValue(fieldKey, value, fieldType, fieldTitle, submission)}
                    </div>
                  </div>
                );
              })}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Edit Form View Component
interface EditFormViewProps {
  submission: FormSubmission;
  caseId: string;
  onCancel: () => void;
  onSave: () => void;
}

function EditFormView({ submission, caseId, onCancel, onSave }: EditFormViewProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<any>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [contractTypeKey, setContractTypeKey] = useState<string | null>(null);
  const [isNegative, setIsNegative] = useState(false);

  useEffect(() => {
    // Load submission data for editing
    const loadSubmissionData = async () => {
      try {
        // Get case data to find contract type
        const { data: caseData, error: caseError } = await supabase
          .from('cases')
          .select('contract_type, is_positive')
          .eq('id', caseId)
          .single();

        if (caseError) throw caseError;

        // Use contract type key directly (DynamicForm expects the key, not ID)
        setContractTypeKey(caseData.contract_type);
        setIsNegative(caseData.is_positive === false);

        // Transform submission data to form data format
        // DynamicForm expects submission_data to have values directly or in {value: ...} format
        let submissionData = submission.submission_data;
        if (typeof submissionData === 'string') {
          try {
            submissionData = JSON.parse(submissionData);
          } catch (e) {
            console.error('Error parsing submission data:', e);
            submissionData = {};
          }
        }

        // Transform to form data format that DynamicForm expects
        // DynamicForm can handle both direct values and {value: ...} format
        // We'll use direct values for simplicity, and files will be loaded separately
        const transformedFormData: Record<string, any> = {};
        
        // Process each field - use direct values (DynamicForm will handle the conversion)
        Object.entries(submissionData).forEach(([key, value]) => {
          if (key === '_metadata') {
            // Preserve metadata
            transformedFormData[key] = value;
          } else {
            // For most fields, use direct value (DynamicForm handles conversion)
            transformedFormData[key] = value;
          }
        });

        setFormData(transformedFormData);
        setTemplateId(submission.template_id);
      } catch (error) {
        console.error('Error loading submission data:', error);
        toast.error('Failed to load form data for editing');
      }
    };

    loadSubmissionData();
  }, [submission, caseId]);

  const handleSubmit = async (formDataToSubmit: any) => {
    if (!templateId || !contractTypeKey) {
      toast.error('Missing template or contract type information');
      return;
    }

    setIsSaving(true);
    try {
      // Get current user ID (for ops editing, we'll use the original gig_partner_id)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Use the original gig_partner_id from submission
      const gigWorkerId = submission.gig_partner_id;

      // Submit the form (this will update the existing submission)
      const result = await formService.submitForm(
        caseId,
        templateId,
        gigWorkerId,
        formDataToSubmit,
        false // Not a draft
      );

      if (result.success) {
        toast.success('Form response updated successfully');
        onSave();
      } else {
        throw new Error(result.error || 'Failed to update form');
      }
    } catch (error) {
      console.error('Error saving form:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save form');
    } finally {
      setIsSaving(false);
    }
  };

  if (!formData || !contractTypeKey) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading form for editing...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4 pb-4 border-b">
        <h3 className="text-lg font-semibold">Edit Form Response</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isSaving}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </div>
      </div>
      <DynamicForm
        contractTypeId={contractTypeKey}
        caseId={caseId}
        gigWorkerId={submission.gig_partner_id}
        onSubmit={handleSubmit}
        onCancel={onCancel}
        loading={isSaving}
        draftData={{
          submission_data: formData,
          form_submission_files: submission.form_submission_files || [],
          files: submission.form_submission_files || []
        }}
        isNegative={isNegative}
        hideFooterButtons={false}
      />
    </div>
  );
}
