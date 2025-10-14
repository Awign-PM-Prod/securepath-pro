-- =====================================================
-- Fix Contract Type Config to Use UUID
-- =====================================================

-- First, let's check if contract_type_config table exists and create it if it doesn't
CREATE TABLE IF NOT EXISTS public.contract_type_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type_key TEXT NOT NULL UNIQUE,
  type_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert the business address check contract type
INSERT INTO public.contract_type_config (type_key, type_name, description)
VALUES (
  'business_address_check',
  'Business Address Check',
  'Verification of business addresses and premises'
) ON CONFLICT (type_key) DO NOTHING;

-- Insert the residential address check contract type
INSERT INTO public.contract_type_config (type_key, type_name, description)
VALUES (
  'residential_address_check',
  'Residential Address Check',
  'Verification of residential addresses and premises'
) ON CONFLICT (type_key) DO NOTHING;

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
