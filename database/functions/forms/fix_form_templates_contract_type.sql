-- =====================================================
-- Fix Form Templates Contract Type Reference
-- =====================================================

-- First, let's check if contract_type_config table exists
-- If not, we'll modify the form_templates table to use text instead of UUID

-- Drop the existing foreign key constraint if it exists
ALTER TABLE public.form_templates DROP CONSTRAINT IF EXISTS form_templates_contract_type_id_fkey;

-- Change contract_type_id from UUID to TEXT
ALTER TABLE public.form_templates ALTER COLUMN contract_type_id TYPE TEXT;

-- Update the existing form template to use the text value
UPDATE public.form_templates 
SET contract_type_id = 'business_address_check' 
WHERE template_name = 'Business Address Verification Form';

-- Drop the unique constraint that includes contract_type_id
ALTER TABLE public.form_templates DROP CONSTRAINT IF EXISTS form_templates_contract_type_unique;

-- Create a new unique constraint with the text field
ALTER TABLE public.form_templates 
ADD CONSTRAINT form_templates_contract_type_unique 
UNIQUE (contract_type_id, template_version);
