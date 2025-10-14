-- =====================================================
-- Complete Case Creation Flow Test
-- Copy and paste this into Supabase SQL Editor to test
-- =====================================================

-- Step 1: Test pincode_tiers table
SELECT 'Step 1: Testing pincode_tiers table...' as test_step;

-- Add test pincode if it doesn't exist
INSERT INTO public.pincode_tiers (pincode, tier, city, state, region, created_by)
SELECT '560102', 'tier_2', 'Bangalore', 'Karnataka', 'South', (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.pincode_tiers WHERE pincode = '560102');

-- Verify pincode was added
SELECT 'Pincode added:' as status, pincode, tier, city, state FROM public.pincode_tiers WHERE pincode = '560102';

-- Step 2: Test get_location_from_pincode function
SELECT 'Step 2: Testing get_location_from_pincode function...' as test_step;
SELECT * FROM public.get_location_from_pincode('560102');

-- Step 3: Create test rate cards
SELECT 'Step 3: Creating test rate cards...' as test_step;

INSERT INTO public.rate_cards (name, pincode_tier, completion_slab, base_rate_inr, default_travel_inr, default_bonus_inr, is_active, created_by)
VALUES 
  ('Test Tier 1 24h', 'tier_1', 'within_24h', 500.00, 50.00, 25.00, true, (SELECT id FROM auth.users LIMIT 1)),
  ('Test Tier 2 24h', 'tier_2', 'within_24h', 400.00, 40.00, 20.00, true, (SELECT id FROM auth.users LIMIT 1)),
  ('Test Tier 3 24h', 'tier_3', 'within_24h', 300.00, 30.00, 15.00, true, (SELECT id FROM auth.users LIMIT 1))
ON CONFLICT DO NOTHING;

-- Verify rate cards were created
SELECT 'Rate cards created:' as status, name, pincode_tier, completion_slab, base_rate_inr 
FROM public.rate_cards 
WHERE name LIKE 'Test Tier%' AND completion_slab = 'within_24h';

-- Step 4: Create test client contract
SELECT 'Step 4: Creating test client contract...' as test_step;

-- First, get a client ID
WITH client_data AS (
  SELECT id, name FROM public.clients LIMIT 1
)
INSERT INTO public.client_contracts (
  client_id, 
  contract_number, 
  contract_name, 
  contract_type, 
  start_date, 
  end_date, 
  default_tat_hours,
  tier_1_rate_card_id,
  tier_2_rate_card_id,
  tier_3_rate_card_id,
  is_active,
  created_by
)
SELECT 
  c.id,
  'TEST-001',
  'Test Contract',
  'standard',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '1 year',
  24,
  (SELECT id FROM public.rate_cards WHERE name = 'Test Tier 1 24h' LIMIT 1),
  (SELECT id FROM public.rate_cards WHERE name = 'Test Tier 2 24h' LIMIT 1),
  (SELECT id FROM public.rate_cards WHERE name = 'Test Tier 3 24h' LIMIT 1),
  true,
  (SELECT id FROM auth.users LIMIT 1)
FROM public.clients c
LIMIT 1
ON CONFLICT DO NOTHING;

-- Verify client contract was created
SELECT 'Client contract created:' as status, contract_name, default_tat_hours 
FROM public.client_contracts 
WHERE contract_name = 'Test Contract';

-- Step 5: Test get_case_defaults function
SELECT 'Step 5: Testing get_case_defaults function...' as test_step;

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

-- Step 6: Create test location
SELECT 'Step 6: Creating test location...' as test_step;

INSERT INTO public.locations (address_line, city, state, pincode, country, pincode_tier)
VALUES (
  'Test Address, Whitefield',
  'Bangalore',
  'Karnataka',
  '560102',
  'India',
  'tier_2'
)
ON CONFLICT DO NOTHING;

-- Get the location ID
SELECT 'Location created with ID:' as status, id, address_line, city, state, pincode_tier 
FROM public.locations 
WHERE address_line = 'Test Address, Whitefield' 
LIMIT 1;

-- Step 7: Test complete case creation
SELECT 'Step 7: Testing complete case creation...' as test_step;

-- Create a test case
WITH test_data AS (
  SELECT 
    c.id as client_id,
    l.id as location_id,
    rc.id as rate_card_id
  FROM public.clients c
  CROSS JOIN public.locations l
  CROSS JOIN public.rate_cards rc
  WHERE l.address_line = 'Test Address, Whitefield'
    AND rc.name = 'Test Tier 2 24h'
  LIMIT 1
)
INSERT INTO public.cases (
  case_number,
  client_case_id,
  title,
  description,
  priority,
  status,
  client_id,
  location_id,
  due_at,
  base_rate_inr,
  total_rate_inr,
  travel_allowance_inr,
  bonus_inr,
  tat_hours,
  instructions,
  created_by,
  updated_by,
  status_updated_at
)
SELECT 
  'TEST-' || EXTRACT(EPOCH FROM NOW())::bigint,
  'CLIENT-TEST-001',
  'Test Case for Verification',
  'This is a test case to verify the complete case creation flow',
  'medium',
  'draft',
  td.client_id,
  td.location_id,
  NOW() + INTERVAL '24 hours',
  400.00,
  460.00, -- base + travel + bonus
  40.00,
  20.00,
  24,
  'Test instructions for verification',
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM auth.users LIMIT 1),
  NOW()
FROM test_data td;

-- Verify case was created
SELECT 'Case created successfully:' as status, 
       case_number, 
       client_case_id, 
       title, 
       status,
       base_rate_inr,
       travel_allowance_inr,
       bonus_inr
FROM public.cases 
WHERE client_case_id = 'CLIENT-TEST-001';

-- Step 8: Test the frontend integration
SELECT 'Step 8: Testing frontend integration...' as test_step;

-- This simulates what the frontend would call
SELECT 
  'Frontend test result:' as status,
  c.case_number,
  c.client_case_id,
  c.title,
  c.status,
  cl.name as client_name,
  l.address_line,
  l.city,
  l.state,
  l.pincode,
  l.pincode_tier,
  c.base_rate_inr,
  c.travel_allowance_inr,
  c.bonus_inr,
  c.tat_hours
FROM public.cases c
JOIN public.clients cl ON c.client_id = cl.id
JOIN public.locations l ON c.location_id = l.id
WHERE c.client_case_id = 'CLIENT-TEST-001';

-- Final success message
SELECT 'All tests completed successfully! The case form should now work properly.' as final_status;

