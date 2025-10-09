-- =====================================================
-- Test Database Functions
-- Run this to verify the functions work correctly
-- =====================================================

-- Test 1: Check if pincode_tiers table has data
SELECT 'Testing pincode_tiers table...' as test_step;
SELECT COUNT(*) as pincode_count FROM public.pincode_tiers;

-- Test 2: Test get_location_from_pincode function
SELECT 'Testing get_location_from_pincode function...' as test_step;
SELECT * FROM public.get_location_from_pincode('560102');

-- Test 3: Check if we have any clients
SELECT 'Testing clients table...' as test_step;
SELECT COUNT(*) as client_count FROM public.clients;

-- Test 4: Check if we have any rate cards
SELECT 'Testing rate_cards table...' as test_step;
SELECT COUNT(*) as rate_card_count FROM public.rate_cards;

-- Test 5: Check if we have any client contracts
SELECT 'Testing client_contracts table...' as test_step;
SELECT COUNT(*) as contract_count FROM public.client_contracts;

-- Test 6: Test get_case_defaults function with a real client
SELECT 'Testing get_case_defaults function...' as test_step;
WITH test_client AS (
  SELECT id FROM public.clients LIMIT 1
)
SELECT 
  'Case defaults result:' as status,
  city,
  state,
  tier,
  default_tat_hours,
  rate_card_id,
  base_rate_inr,
  travel_allowance_inr,
  bonus_inr
FROM public.get_case_defaults(
  (SELECT id FROM test_client),
  '560102',
  24
);

-- Test 7: Check if the functions exist
SELECT 'Checking function existence...' as test_step;
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('get_location_from_pincode', 'get_rate_card_for_client_tier', 'get_case_defaults');

-- Test 8: Check case_status enum values
SELECT 'Checking case_status enum values...' as test_step;
SELECT unnest(enum_range(NULL::case_status)) as case_status_values;

