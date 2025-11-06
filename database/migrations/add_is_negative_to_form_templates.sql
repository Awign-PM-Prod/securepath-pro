-- =====================================================
-- Add is_negative flag to form_templates table
-- =====================================================
-- This migration adds support for negative case forms
-- Run this in Supabase SQL Editor

-- Add is_negative column to form_templates table
ALTER TABLE public.form_templates 
ADD COLUMN IF NOT EXISTS is_negative BOOLEAN NOT NULL DEFAULT false;

-- Add comment to explain the column
COMMENT ON COLUMN public.form_templates.is_negative IS 'Indicates if this is a negative case form template (true) or positive case form template (false)';

-- Update the unique constraint to allow both positive and negative templates per contract type
-- First, drop the existing constraint if it exists
ALTER TABLE public.form_templates 
DROP CONSTRAINT IF EXISTS form_templates_contract_type_unique;

-- Add new constraint that allows one positive and one negative template per contract type and version
ALTER TABLE public.form_templates 
ADD CONSTRAINT form_templates_contract_type_unique 
UNIQUE (contract_type_id, template_version, is_negative);

-- Create index for better query performance when filtering by is_negative
CREATE INDEX IF NOT EXISTS idx_form_templates_is_negative 
ON public.form_templates(contract_type_id, is_negative, is_active) 
WHERE is_active = true;

-- Verify the changes
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'form_templates' 
  AND column_name = 'is_negative';

