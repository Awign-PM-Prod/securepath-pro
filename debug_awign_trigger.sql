-- =====================================================
-- Debug AWIGN Trigger - Check why it's not firing
-- =====================================================

-- 1. Check if trigger exists and is enabled
SELECT 
  'Trigger Status:' as check_type,
  tgname AS trigger_name,
  CASE tgenabled 
    WHEN 'O' THEN 'ENABLED'
    WHEN 'D' THEN 'DISABLED'
    ELSE 'UNKNOWN'
  END AS trigger_status,
  tgrelid::regclass AS table_name
FROM pg_trigger 
WHERE tgname = 'cases_notify_awign_trigger';

-- 2. Check if trigger function exists
SELECT 
  'Function Status:' as check_type,
  proname AS function_name,
  CASE 
    WHEN proname IS NOT NULL THEN 'EXISTS'
    ELSE 'NOT FOUND'
  END AS function_status
FROM pg_proc 
WHERE proname = 'notify_awign_on_status_change';

-- 3. Check if pg_net extension is enabled
SELECT 
  'pg_net Extension:' as check_type,
  extname AS extension_name,
  extversion AS version,
  CASE 
    WHEN extname IS NOT NULL THEN 'ENABLED'
    ELSE 'NOT ENABLED'
  END AS extension_status
FROM pg_extension 
WHERE extname = 'pg_net';

-- 4. Check configuration values (Supabase URL and anon key)
SELECT 
  'Configuration:' as check_type,
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
    WHEN config_value IS NULL THEN 'NULL'
    ELSE 'OK'
  END AS status
FROM public.system_configs 
WHERE config_category = 'awign_integration'
ORDER BY config_key;

-- 5. Check the specific case that was updated
-- Replace 'YOUR_CASE_ID' with the actual case ID you tested
SELECT 
  'Case Details:' as check_type,
  id,
  case_number,
  client_case_id,
  source,
  status,
  status_updated_at,
  CASE 
    WHEN source != 'api' THEN '❌ Source is not "api"'
    WHEN client_case_id IS NULL THEN '❌ client_case_id is NULL'
    WHEN status != 'in_progress' THEN '❌ Status is not "in_progress"'
    ELSE '✅ Case meets all conditions'
  END AS trigger_conditions_met
FROM public.cases
WHERE id = 'YOUR_CASE_ID_HERE'  -- Replace with your actual case ID
   OR case_number = 'YOUR_CASE_NUMBER_HERE';  -- Or use case number

-- 6. Check recent cases with source='api' to see their status
SELECT 
  'Recent API Cases:' as check_type,
  id,
  case_number,
  client_case_id,
  source,
  status,
  status_updated_at
FROM public.cases
WHERE source = 'api'
ORDER BY status_updated_at DESC
LIMIT 10;

-- 7. Check PostgreSQL logs for warnings (if accessible)
-- Note: This might not work in Supabase, but worth trying
SELECT 
  'Recent Warnings:' as check_type,
  message,
  detail,
  hint,
  created_at
FROM pg_stat_statements  -- This might not exist
WHERE query ILIKE '%awign%' OR query ILIKE '%AWIGN%'
LIMIT 10;



