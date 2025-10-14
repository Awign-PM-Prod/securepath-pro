-- =====================================================
-- Dynamic Form System for Contract Types
-- =====================================================

-- Create form field types enum
CREATE TYPE public.form_field_type AS ENUM (
  'short_answer',
  'paragraph',
  'multiple_choice',
  'file_upload',
  'number',
  'date',
  'boolean'
);

-- Create form field validation types
CREATE TYPE public.form_field_validation AS ENUM (
  'mandatory',
  'optional',
  'conditional'
);

-- Create form templates table
CREATE TABLE public.form_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_type_id UUID NOT NULL REFERENCES public.contract_type_config(id),
  template_name TEXT NOT NULL,
  template_version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT form_templates_contract_type_unique UNIQUE (contract_type_id, template_version)
);

-- Create form fields table
CREATE TABLE public.form_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.form_templates(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL, -- e.g., 'was_entry_allowed', 'premises_type'
  field_title TEXT NOT NULL, -- e.g., 'Was entry allowed into the premises?'
  field_type form_field_type NOT NULL,
  validation_type form_field_validation NOT NULL DEFAULT 'mandatory',
  field_order INTEGER NOT NULL DEFAULT 0,
  
  -- Field configuration (JSONB for flexibility)
  field_config JSONB NOT NULL DEFAULT '{}', -- Options for multiple choice, validation rules, etc.
  
  -- Conditional logic
  depends_on_field_id UUID REFERENCES public.form_fields(id),
  depends_on_value TEXT, -- Value that triggers this field
  
  -- File upload specific
  max_files INTEGER DEFAULT 1,
  allowed_file_types TEXT[] DEFAULT ARRAY['image/jpeg', 'image/png'],
  max_file_size_mb INTEGER DEFAULT 10,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT form_fields_template_key_unique UNIQUE (template_id, field_key)
);

-- Create form submissions table
CREATE TABLE public.form_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases(id),
  template_id UUID NOT NULL REFERENCES public.form_templates(id),
  gig_partner_id UUID NOT NULL REFERENCES public.gig_partners(id),
  submission_data JSONB NOT NULL DEFAULT '{}', -- All form responses
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT form_submissions_case_unique UNIQUE (case_id)
);

-- Create form submission files table
CREATE TABLE public.form_submission_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.form_submissions(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES public.form_fields(id),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submission_files ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for form_templates
CREATE POLICY "form_templates_select" ON public.form_templates
    FOR SELECT USING (
        has_role('super_admin') OR
        has_role('ops_team') OR
        has_role('vendor_team') OR
        has_role('qc_team') OR
        has_role('gig_worker')
    );

CREATE POLICY "form_templates_insert" ON public.form_templates
    FOR INSERT WITH CHECK (
        has_role('super_admin') OR
        has_role('ops_team')
    );

CREATE POLICY "form_templates_update" ON public.form_templates
    FOR UPDATE USING (
        has_role('super_admin') OR
        has_role('ops_team')
    );

-- Create RLS policies for form_fields
CREATE POLICY "form_fields_select" ON public.form_fields
    FOR SELECT USING (
        has_role('super_admin') OR
        has_role('ops_team') OR
        has_role('vendor_team') OR
        has_role('qc_team') OR
        has_role('gig_worker')
    );

CREATE POLICY "form_fields_insert" ON public.form_fields
    FOR INSERT WITH CHECK (
        has_role('super_admin') OR
        has_role('ops_team')
    );

CREATE POLICY "form_fields_update" ON public.form_fields
    FOR UPDATE USING (
        has_role('super_admin') OR
        has_role('ops_team')
    );

-- Create RLS policies for form_submissions
CREATE POLICY "form_submissions_select" ON public.form_submissions
    FOR SELECT USING (
        -- Gig workers can view their own submissions
        (gig_partner_id IN (
            SELECT id FROM public.gig_partners WHERE user_id = auth.uid()
        ))
        OR
        -- Admin roles can view all submissions
        has_role('super_admin') OR
        has_role('ops_team') OR
        has_role('vendor_team') OR
        has_role('qc_team')
    );

CREATE POLICY "form_submissions_insert" ON public.form_submissions
    FOR INSERT WITH CHECK (
        -- Gig workers can create their own submissions
        (gig_partner_id IN (
            SELECT id FROM public.gig_partners WHERE user_id = auth.uid()
        ))
        OR
        -- Admin roles can create submissions
        has_role('super_admin') OR
        has_role('ops_team') OR
        has_role('vendor_team') OR
        has_role('qc_team')
    );

CREATE POLICY "form_submissions_update" ON public.form_submissions
    FOR UPDATE USING (
        -- Gig workers can update their own submissions
        (gig_partner_id IN (
            SELECT id FROM public.gig_partners WHERE user_id = auth.uid()
        ))
        OR
        -- Admin roles can update all submissions
        has_role('super_admin') OR
        has_role('ops_team') OR
        has_role('vendor_team') OR
        has_role('qc_team')
    );

-- Create RLS policies for form_submission_files
CREATE POLICY "form_submission_files_select" ON public.form_submission_files
    FOR SELECT USING (
        -- Gig workers can view files for their submissions
        (submission_id IN (
            SELECT id FROM public.form_submissions WHERE gig_partner_id IN (
                SELECT id FROM public.gig_partners WHERE user_id = auth.uid()
            )
        ))
        OR
        -- Admin roles can view all files
        has_role('super_admin') OR
        has_role('ops_team') OR
        has_role('vendor_team') OR
        has_role('qc_team')
    );

CREATE POLICY "form_submission_files_insert" ON public.form_submission_files
    FOR INSERT WITH CHECK (
        -- Gig workers can upload files for their submissions
        (submission_id IN (
            SELECT id FROM public.form_submissions WHERE gig_partner_id IN (
                SELECT id FROM public.gig_partners WHERE user_id = auth.uid()
            )
        ))
        OR
        -- Admin roles can upload files
        has_role('super_admin') OR
        has_role('ops_team') OR
        has_role('vendor_team') OR
        has_role('qc_team')
    );

-- Grant permissions
GRANT SELECT, UPDATE, INSERT ON public.form_templates TO authenticated;
GRANT SELECT, UPDATE, INSERT ON public.form_fields TO authenticated;
GRANT SELECT, UPDATE, INSERT ON public.form_submissions TO authenticated;
GRANT SELECT, UPDATE, INSERT ON public.form_submission_files TO authenticated;

-- Create indexes for performance
CREATE INDEX idx_form_templates_contract_type ON public.form_templates(contract_type_id);
CREATE INDEX idx_form_fields_template ON public.form_fields(template_id);
CREATE INDEX idx_form_submissions_case ON public.form_submissions(case_id);
CREATE INDEX idx_form_submission_files_submission ON public.form_submission_files(submission_id);
