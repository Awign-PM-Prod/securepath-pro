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
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

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
  onSubmissionsLoaded?: (submissions: FormSubmission[]) => void;
}

export default function DynamicFormSubmission({ caseId, onSubmissionsLoaded }: DynamicFormSubmissionProps) {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      case 'file_upload':
        // Find files for this field and de-duplicate by file_url (or id fallback)
        const fieldFilesRaw = submission.form_submission_files?.filter(file => 
          file.form_field?.field_key === fieldKey
        ) || [];
        const seen = new Set<string>();
        const fieldFiles = fieldFilesRaw.filter(f => {
          const key = f.file_url || f.id;
          if (seen.has(key)) return false;
          seen.add(key);
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
          return <span>{format(new Date(value), 'PPP')}</span>;
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
      {submissions.map((submission) => (
        <Card key={submission.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {submission.form_template?.template_name || 'Form Submission'}
              {submission.status === 'draft' && (
                <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                  Draft
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
              <Badge variant="outline">
                Version {submission.form_template?.template_version || 1}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Render all form fields, including file upload fields */}
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
                      <Badge variant="outline" className="capitalize">
                        {fieldType.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <div className="text-sm">
                      {renderFieldValue(fieldKey, value, fieldType, fieldTitle, submission)}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
