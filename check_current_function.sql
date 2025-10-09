-- =====================================================
-- Check Current Function Definition
-- =====================================================

-- Check the current get_allocation_candidates function definition
SELECT 
  'Current Function Definition' as info,
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'get_allocation_candidates' 
AND routine_schema = 'public';

-- Check what columns the current function actually returns
SELECT 
  'Current Function Columns' as info,
  parameter_name,
  data_type,
  parameter_mode
FROM information_schema.parameters 
WHERE specific_name IN (
  SELECT specific_name 
  FROM information_schema.routines 
  WHERE routine_name = 'get_allocation_candidates' 
  AND routine_schema = 'public'
)
ORDER BY ordinal_position;

-- Test the current function to see what it returns
SELECT 
  'Current Function Test' as info,
  *
FROM public.get_allocation_candidates(
  gen_random_uuid(), -- dummy case_id
  '400058', -- test pincode
  'tier_1'::pincode_tier
)
LIMIT 1;
