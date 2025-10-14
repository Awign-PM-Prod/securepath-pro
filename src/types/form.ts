// Dynamic Form System Types

export type FormFieldType = 
  | 'short_answer'
  | 'paragraph'
  | 'multiple_choice'
  | 'file_upload'
  | 'number'
  | 'date'
  | 'boolean';

export type FormFieldValidation = 
  | 'mandatory'
  | 'optional'
  | 'conditional';

export interface FormFieldConfig {
  // For multiple choice fields
  options?: string[];
  
  // For text fields
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  
  // For file upload fields
  maxFiles?: number;
  allowedTypes?: string[];
  maxSizeMB?: number;
  
  // For number fields
  min?: number;
  max?: number;
  step?: number;
  
  // For date fields
  minDate?: string;
  maxDate?: string;
  
  // General
  description?: string;
  placeholder?: string;
  helpText?: string;
}

export interface FormField {
  id: string;
  template_id: string;
  field_key: string;
  field_title: string;
  field_type: FormFieldType;
  validation_type: FormFieldValidation;
  field_order: number;
  field_config: FormFieldConfig;
  depends_on_field_id?: string;
  depends_on_value?: string;
  max_files?: number;
  allowed_file_types?: string[];
  max_file_size_mb?: number;
  created_at: string;
  updated_at: string;
}

export interface FormTemplate {
  id: string;
  contract_type_id: string;
  template_name: string;
  template_version: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  form_fields?: FormField[];
  contract_type_config?: {
    type_key: string;
    display_name: string;
  };
}

export interface FormSubmission {
  id: string;
  case_id: string;
  template_id: string;
  gig_partner_id: string;
  submission_data: Record<string, any>;
  submitted_at: string;
  created_at: string;
  updated_at: string;
  files?: FormSubmissionFile[];
}

export interface FormSubmissionFile {
  id: string;
  submission_id: string;
  field_id: string;
  file_url: string;
  file_name: string;
  file_size?: number;
  mime_type: string;
  uploaded_at: string;
}

export interface FormFieldValue {
  value: string | string[] | number | boolean;
  files?: File[];
}

export interface FormData {
  [fieldKey: string]: FormFieldValue;
}

// Form Builder Types
export interface FormBuilderField {
  field_key: string;
  field_title: string;
  field_type: FormFieldType;
  validation_type: FormFieldValidation;
  field_config: FormFieldConfig;
  field_order: number;
  depends_on_field_id?: string;
  depends_on_value?: string;
}

export interface FormBuilderTemplate {
  template_name: string;
  contract_type_id: string;
  fields: FormBuilderField[];
}
