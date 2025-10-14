-- Check the current state of form templates and contract types
SELECT 
  'contract_type_config' as table_name,
  COUNT(*) as count
FROM public.contract_type_config
UNION ALL
SELECT 
  'form_templates' as table_name,
  COUNT(*) as count
FROM public.form_templates
UNION ALL
SELECT 
  'form_fields' as table_name,
  COUNT(*) as count
FROM public.form_fields;

-- Check if business_address_check contract type exists
SELECT 
  id,
  type_key,
  display_name,
  is_active
FROM public.contract_type_config
WHERE type_key = 'business_address_check';

-- Check if form template exists for business_address_check
SELECT 
  ft.id,
  ft.template_name,
  ft.contract_type_id,
  ctc.type_key,
  ctc.display_name
FROM public.form_templates ft
LEFT JOIN public.contract_type_config ctc ON ft.contract_type_id = ctc.id
WHERE ctc.type_key = 'business_address_check' OR ft.contract_type_id::text = 'business_address_check';

-- Check form fields for business address template
SELECT 
  ff.id,
  ff.field_key,
  ff.field_title,
  ff.field_type,
  ff.validation_type
FROM public.form_fields ff
JOIN public.form_templates ft ON ff.template_id = ft.id
LEFT JOIN public.contract_type_config ctc ON ft.contract_type_id = ctc.id
WHERE ctc.type_key = 'business_address_check' OR ft.contract_type_id::text = 'business_address_check'
ORDER BY ff.field_order;
