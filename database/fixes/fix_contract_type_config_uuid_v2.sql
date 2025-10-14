-- =====================================================
-- Fix Contract Type Config to Use UUID (Version 2)
-- =====================================================

-- First, let's check what columns exist in contract_type_config
-- and add the missing ones if needed

-- Add type_name column if it doesn't exist
ALTER TABLE public.contract_type_config 
ADD COLUMN IF NOT EXISTS type_name TEXT;

-- Add description column if it doesn't exist
ALTER TABLE public.contract_type_config 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add is_active column if it doesn't exist
ALTER TABLE public.contract_type_config 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Add updated_at column if it doesn't exist
ALTER TABLE public.contract_type_config 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Insert the business address check contract type
INSERT INTO public.contract_type_config (type_key, type_name, description)
VALUES (
  'business_address_check',
  'Business Address Check',
  'Verification of business addresses and premises'
) ON CONFLICT (type_key) DO UPDATE SET
  type_name = EXCLUDED.type_name,
  description = EXCLUDED.description,
  updated_at = now();

-- Insert the residential address check contract type
INSERT INTO public.contract_type_config (type_key, type_name, description)
VALUES (
  'residential_address_check',
  'Residential Address Check',
  'Verification of residential addresses and premises'
) ON CONFLICT (type_key) DO UPDATE SET
  type_name = EXCLUDED.type_name,
  description = EXCLUDED.description,
  updated_at = now();

-- Now update the form_templates table to use the correct contract_type_id
UPDATE public.form_templates 
SET contract_type_id = (
  SELECT id FROM public.contract_type_config 
  WHERE type_key = 'business_address_check'
)
WHERE template_name = 'Business Address Verification Form';

-- Verify the update
SELECT 
  ft.template_name,
  ft.contract_type_id,
  ctc.type_key,
  ctc.type_name
FROM public.form_templates ft
LEFT JOIN public.contract_type_config ctc ON ft.contract_type_id = ctc.id;
