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
  created_at: string;
  updated_at: string;
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
  }>;
}

interface DynamicFormSubmissionProps {
  caseId: string;
}

export default function DynamicFormSubmission({ caseId }: DynamicFormSubmissionProps) {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFormSubmissions();
  }, [caseId]);

  const fetchFormSubmissions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('form_submissions')
        .select(`
          *,
          form_template:form_templates(
            template_name, 
            template_version,
            form_fields(field_key, field_title, field_type)
          ),
          form_submission_files(
            id,
            field_id,
            file_url,
            file_name,
            file_size,
            mime_type,
            form_field:form_fields(field_title, field_type, field_key)
          )
        `)
        .eq('case_id', caseId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform the data to include form_fields at the submission level
      const transformedData = data?.map(submission => ({
        ...submission,
        form_fields: submission.form_template?.form_fields || []
      })) || [];
      
      setSubmissions(transformedData);
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
        // Find files for this field
        const fieldFiles = submission.form_submission_files?.filter(file => 
          file.form_field?.field_key === fieldKey
        ) || [];
        
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
                  </div>
                  <div className="mt-1 text-xs text-center text-gray-600 truncate">
                    {file.file_name}
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
        return (
          <div className="flex flex-wrap gap-1">
            {Array.isArray(value) ? value.map((item, index) => (
              <Badge key={index} variant="secondary">{item}</Badge>
            )) : <Badge variant="secondary">{value}</Badge>}
          </div>
        );
      case 'date':
        if (value === null || value === undefined) return <span className="text-muted-foreground">Not provided</span>;
        return <span>{format(new Date(value), 'PPP')}</span>;
      default:
        if (value === null || value === undefined) return <span className="text-muted-foreground">Not provided</span>;
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
    <div className="space-y-6">
      {submissions.map((submission) => (
        <Card key={submission.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {submission.form_template?.template_name || 'Form Submission'}
            </CardTitle>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Submitted on {format(new Date(submission.created_at), 'PPP p')}
              </span>
              <Badge variant="outline">
                Version {submission.form_template?.template_version || 1}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Render all form fields, including file upload fields */}
              {submission.form_fields?.map((fieldInfo) => {
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
                
                // Skip fields that have no value and no files
                if (!value && !hasFiles) {
                  return null;
                }
                
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
