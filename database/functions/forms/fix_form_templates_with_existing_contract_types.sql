-- =====================================================
-- Fix Form Templates with Existing Contract Types
-- =====================================================

-- Update the form_templates table to use the correct contract_type_id
-- The contract types already exist, so we just need to link them properly

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
  ctc.display_name
FROM public.form_templates ft
LEFT JOIN public.contract_type_config ctc ON ft.contract_type_id = ctc.id;

-- Check if there are any form templates that still have invalid contract_type_id
SELECT 
  ft.template_name,
  ft.contract_type_id,
  CASE 
    WHEN ctc.id IS NULL THEN 'INVALID - No matching contract type'
    ELSE 'VALID - ' || ctc.display_name
  END as status
FROM public.form_templates ft
LEFT JOIN public.contract_type_config ctc ON ft.contract_type_id = ctc.id;
