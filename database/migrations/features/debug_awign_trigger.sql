-- =====================================================
-- Debug AWIGN Trigger
-- Run this to check if everything is set up correctly
-- =====================================================

-- 1. Check if trigger exists
SELECT 
  tgname AS trigger_name,
  tgtype::text AS trigger_type,
  tgenabled AS is_enabled,
  tgrelid::regclass AS table_name
FROM pg_trigger 
WHERE tgname = 'cases_notify_awign_trigger';

-- 2. Check if trigger function exists
SELECT 
  proname AS function_name,
  prosrc AS function_source
FROM pg_proc 
WHERE proname = 'notify_awign_on_status_change';

-- 3. Check if pg_net extension is enabled
SELECT 
  extname AS extension_name,
  extversion AS version
FROM pg_extension 
WHERE extname = 'pg_net';

-- 4. Check configuration values
SELECT 
  config_key,
  CASE 
    WHEN config_key = 'supabase_anon_key' THEN '***HIDDEN***'
    ELSE config_value->>'value'
  END AS config_value,
  is_active,
  effective_until,
  CASE 
    WHEN is_active = false THEN 'INACTIVE'
    WHEN effective_until IS NOT NULL AND effective_until < now() THEN 'EXPIRED'
    ELSE 'OK'
  END AS status
FROM public.system_configs 
WHERE config_category = 'awign_integration'
ORDER BY config_key;

-- 5. Check if there are any API-sourced cases
SELECT 
  id,
  case_number,
  client_case_id,
  source,
  status,
  status_updated_at
FROM public.cases
WHERE source = 'api'
ORDER BY created_at DESC
LIMIT 5;

-- 6. Test the trigger function manually (replace with actual case ID)
-- Uncomment and replace CASE_ID with an actual case ID that has source='api'
/*
DO $$
DECLARE
  test_case_id UUID := 'CASE_ID_HERE';  -- Replace with actual case ID
  test_case RECORD;
BEGIN
  -- Get case details
  SELECT * INTO test_case
  FROM public.cases
  WHERE id = test_case_id;
  
  IF test_case.id IS NULL THEN
    RAISE NOTICE 'Case not found';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Testing trigger function for case: %', test_case.case_number;
  RAISE NOTICE 'Source: %, Status: %, Client Case ID: %', 
    test_case.source, test_case.status, test_case.client_case_id;
  
  -- Simulate trigger call
  IF test_case.source = 'api' 
     AND test_case.status = 'in_progress'
     AND test_case.client_case_id IS NOT NULL THEN
    RAISE NOTICE 'Conditions met - trigger should fire';
  ELSE
    RAISE NOTICE 'Conditions NOT met:';
    RAISE NOTICE '  source = api: %', (test_case.source = 'api');
    RAISE NOTICE '  status = in_progress: %', (test_case.status = 'in_progress');
    RAISE NOTICE '  client_case_id IS NOT NULL: %', (test_case.client_case_id IS NOT NULL);
  END IF;
END $$;
*/

