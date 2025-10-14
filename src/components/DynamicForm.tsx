import React, { useState, useEffect } from 'react';
import { FormTemplate, FormField, FormData, FormFieldValue } from '@/types/form';
import { formService } from '@/services/formService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, X, FileText } from 'lucide-react';

interface DynamicFormProps {
  contractTypeId: string;
  caseId: string;
  gigWorkerId: string;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const DynamicForm: React.FC<DynamicFormProps> = ({
  contractTypeId,
  caseId,
  gigWorkerId,
  onSubmit,
  onCancel,
  loading = false
}) => {
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [formData, setFormData] = useState<FormData>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadFormTemplate();
  }, [contractTypeId]);

  const loadFormTemplate = async () => {
    setLoadingTemplate(true);
    console.log('Loading form template for contract type:', contractTypeId);
    const result = await formService.getFormTemplate(contractTypeId);
    console.log('Form template result:', result);
    
    if (result.success && result.template) {
      console.log('Form template loaded successfully:', result.template);
      setTemplate(result.template);
      // Initialize form data
      const initialData: FormData = {};
      result.template.form_fields?.forEach(field => {
        initialData[field.field_key] = {
          value: field.field_type === 'boolean' ? false : 
                 field.field_type === 'multiple_choice' ? [] : '',
          files: []
        };
      });
      setFormData(initialData);
    } else {
      console.error('Error loading form template:', result.error);
      // Show a user-friendly message
      setTemplate(null);
    }
    setLoadingTemplate(false);
  };

  const handleFieldChange = (fieldKey: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldKey]: {
        ...prev[fieldKey],
        value
      }
    }));
    
    // Clear error when user starts typing
    if (errors[fieldKey]) {
      setErrors(prev => ({
        ...prev,
        [fieldKey]: ''
      }));
    }
  };

  const handleFileUpload = (fieldKey: string, files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files);
    setFormData(prev => ({
      ...prev,
      [fieldKey]: {
        ...prev[fieldKey],
        files: fileArray
      }
    }));

    // Clear error when files are uploaded
    if (errors[fieldKey]) {
      setErrors(prev => ({
        ...prev,
        [fieldKey]: ''
      }));
    }
  };

  const removeFile = (fieldKey: string, fileIndex: number) => {
    setFormData(prev => ({
      ...prev,
      [fieldKey]: {
        ...prev[fieldKey],
        files: prev[fieldKey].files?.filter((_, index) => index !== fileIndex) || []
      }
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    template?.form_fields?.forEach(field => {
      const fieldData = formData[field.field_key];
      
      if (field.validation_type === 'mandatory') {
        // For file upload fields, check if files exist
        if (field.field_type === 'file_upload') {
          console.log(`Validating file field ${field.field_key}:`, {
            fieldData,
            hasFiles: fieldData?.files,
            filesLength: fieldData?.files?.length
          });
          
          if (!fieldData?.files || fieldData.files.length === 0) {
            newErrors[field.field_key] = `${field.field_title} is required`;
          }
        } else {
          // For other field types, check the value
          if (!fieldData?.value || 
              (Array.isArray(fieldData.value) && fieldData.value.length === 0)) {
            newErrors[field.field_key] = `${field.field_title} is required`;
          }
        }
      }

      // Validate file uploads
      if (field.field_type === 'file_upload' && fieldData?.files && fieldData.files.length > 0) {
        const maxFiles = field.max_files || 1;
        if (fieldData.files.length > maxFiles) {
          newErrors[field.field_key] = `Maximum ${maxFiles} file(s) allowed`;
        }

        fieldData.files.forEach(file => {
          if (field.allowed_file_types && !field.allowed_file_types.includes(file.type)) {
            newErrors[field.field_key] = `Invalid file type. Allowed: ${field.allowed_file_types.join(', ')}`;
          }
          
          if (field.max_file_size_mb && file.size > field.max_file_size_mb * 1024 * 1024) {
            newErrors[field.field_key] = `File size must be less than ${field.max_file_size_mb}MB`;
          }
        });
      }
    });

    console.log('Validation errors:', newErrors);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const renderField = (field: FormField) => {
    try {
      const fieldData = formData[field.field_key] || { value: '', files: [] };
      const fieldError = errors[field.field_key];

      switch (field.field_type) {
        case 'short_answer':
          return (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={field.field_key}>
                {field.field_title}
                {field.validation_type === 'mandatory' && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Input
                id={field.field_key}
                value={fieldData.value as string}
                onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
                placeholder={field.field_config.placeholder}
                maxLength={field.field_config.maxLength}
              />
              {field.field_config.description && (
                <p className="text-sm text-gray-600">{field.field_config.description}</p>
              )}
              {fieldError && <p className="text-sm text-red-500">{fieldError}</p>}
            </div>
          );

        case 'paragraph':
          return (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={field.field_key}>
                {field.field_title}
                {field.validation_type === 'mandatory' && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Textarea
                id={field.field_key}
                value={fieldData.value as string}
                onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
                placeholder={field.field_config.placeholder}
                maxLength={field.field_config.maxLength}
                rows={4}
              />
              {field.field_config.description && (
                <p className="text-sm text-gray-600">{field.field_config.description}</p>
              )}
              {fieldError && <p className="text-sm text-red-500">{fieldError}</p>}
            </div>
          );

        case 'multiple_choice':
          return (
            <div key={field.id} className="space-y-2">
              <Label>
                {field.field_title}
                {field.validation_type === 'mandatory' && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <div className="space-y-2">
                {field.field_config.options?.map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${field.field_key}-${option}`}
                      checked={(fieldData.value as string[])?.includes(option) || false}
                      onCheckedChange={(checked) => {
                        const currentValues = (fieldData.value as string[]) || [];
                        if (checked) {
                          handleFieldChange(field.field_key, [...currentValues, option]);
                        } else {
                          handleFieldChange(field.field_key, currentValues.filter(v => v !== option));
                        }
                      }}
                    />
                    <Label htmlFor={`${field.field_key}-${option}`} className="text-sm">
                      {option}
                    </Label>
                  </div>
                ))}
              </div>
              {field.field_config.description && (
                <p className="text-sm text-gray-600">{field.field_config.description}</p>
              )}
              {fieldError && <p className="text-sm text-red-500">{fieldError}</p>}
            </div>
          );

        case 'file_upload':
          return (
            <div key={field.id} className="space-y-2">
              <Label>
                {field.field_title}
                {field.validation_type === 'mandatory' && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                <input
                  type="file"
                  id={field.field_key}
                  multiple={field.max_files ? field.max_files > 1 : false}
                  accept={field.allowed_file_types?.join(',')}
                  onChange={(e) => handleFileUpload(field.field_key, e.target.files)}
                  className="hidden"
                />
                <label
                  htmlFor={field.field_key}
                  className="cursor-pointer flex flex-col items-center space-y-2"
                >
                  <Upload className="h-8 w-8 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    Click to upload files
                    {field.max_files && ` (max ${field.max_files})`}
                  </span>
                </label>
              </div>
              
              {/* Display uploaded files */}
              {fieldData.files && fieldData.files.length > 0 && (
                <div className="space-y-2">
                  {fieldData.files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm">{file.name}</span>
                        <span className="text-xs text-gray-500">
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(field.field_key, index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {field.field_config.description && (
                <p className="text-sm text-gray-600">{field.field_config.description}</p>
              )}
              {fieldError && <p className="text-sm text-red-500">{fieldError}</p>}
            </div>
          );

        case 'number':
          return (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={field.field_key}>
                {field.field_title}
                {field.validation_type === 'mandatory' && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Input
                id={field.field_key}
                type="number"
                value={fieldData.value as number}
                onChange={(e) => handleFieldChange(field.field_key, parseFloat(e.target.value) || 0)}
                min={field.field_config.min}
                max={field.field_config.max}
                step={field.field_config.step}
              />
              {field.field_config.description && (
                <p className="text-sm text-gray-600">{field.field_config.description}</p>
              )}
              {fieldError && <p className="text-sm text-red-500">{fieldError}</p>}
            </div>
          );

        case 'date':
          return (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={field.field_key}>
                {field.field_title}
                {field.validation_type === 'mandatory' && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Input
                id={field.field_key}
                type="date"
                value={fieldData.value as string}
                onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
                min={field.field_config.minDate}
                max={field.field_config.maxDate}
              />
              {field.field_config.description && (
                <p className="text-sm text-gray-600">{field.field_config.description}</p>
              )}
              {fieldError && <p className="text-sm text-red-500">{fieldError}</p>}
            </div>
          );

        case 'boolean':
          return (
            <div key={field.id} className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={field.field_key}
                  checked={fieldData.value as boolean}
                  onCheckedChange={(checked) => handleFieldChange(field.field_key, checked)}
                />
                <Label htmlFor={field.field_key}>
                  {field.field_title}
                  {field.validation_type === 'mandatory' && <span className="text-red-500 ml-1">*</span>}
                </Label>
              </div>
              {field.field_config.description && (
                <p className="text-sm text-gray-600">{field.field_config.description}</p>
              )}
              {fieldError && <p className="text-sm text-red-500">{fieldError}</p>}
            </div>
          );

        default:
          console.warn('Unknown field type:', field.field_type, 'for field:', field.field_key);
          return null;
      }
    } catch (error) {
      console.error('Error rendering field:', field.field_key, error);
      return (
        <div key={field.id} className="p-4 border border-red-200 bg-red-50 rounded">
          <p className="text-red-600">Error rendering field: {field.field_title}</p>
        </div>
      );
    }
  };

  if (loadingTemplate) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading form...</p>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <Alert>
        <AlertDescription>
          No form template found for this contract type. Please contact support.
        </AlertDescription>
      </Alert>
    );
  }

  // Debug logs removed to prevent excessive re-rendering

  return (
    <Card>
      <CardHeader>
        <CardTitle>{template.template_name}</CardTitle>
        <p className="text-sm text-gray-500">Fields: {template.form_fields?.length || 0}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {template.form_fields?.sort((a, b) => a.field_order - b.field_order).map(renderField)}
        
        <div className="flex justify-end space-x-4 pt-6">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Form'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
