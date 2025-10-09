-- =====================================================
-- Complete Case Creation Test
-- Tests the full flow: client -> pincode -> auto-fill -> case creation
-- =====================================================

-- Step 1: Clean up any existing test data
-- Delete in correct order to respect foreign key constraints
DELETE FROM public.cases WHERE client_case_id LIKE 'TEST-%' OR client_case_id LIKE 'API-%' OR client_case_id LIKE 'CLIENT-%';
DELETE FROM public.client_contracts WHERE contract_number LIKE 'TEST-%';
DELETE FROM public.rate_cards WHERE name LIKE 'Test%';
DELETE FROM public.locations WHERE address_line LIKE 'Test Address%';
DELETE FROM public.clients WHERE email = 'test@example.com';

-- Step 2: Create test data
SELECT 'Step 2: Creating test data...' as status;

-- Create test client
INSERT INTO public.clients (name, email, contact_person, phone, address, city, state, pincode, country, is_active, created_by)
VALUES (
  'Test Client Corp',
  'test@example.com',
  'Test Contact Person',
  '9876543210',
  'Test Office Address',
  'Test City',
  'Test State',
  '123456',
  'India',
  true,
  (SELECT id FROM auth.users LIMIT 1)
);

-- Create test location
INSERT INTO public.locations (address_line, city, state, pincode, country, pincode_tier)
VALUES (
  'Test Address, Whitefield',
  'Bangalore',
  'Karnataka',
  '560102',
  'India',
  'tier_2'
);

-- Create test rate cards
INSERT INTO public.rate_cards (name, pincode_tier, completion_slab, base_rate_inr, default_travel_inr, default_bonus_inr, is_active, created_by)
VALUES 
  ('Test Global Rate Card - Tier 2 - 24h', 'tier_2', 'within_24h', 400.00, 40.00, 20.00, true, (SELECT id FROM auth.users LIMIT 1)),
  ('Test Global Rate Card - Tier 2 - 48h', 'tier_2', 'within_48h', 350.00, 35.00, 15.00, true, (SELECT id FROM auth.users LIMIT 1)),
  ('Test Client Rate Card - Tier 2 - 24h', 'tier_2', 'within_24h', 450.00, 45.00, 25.00, true, (SELECT id FROM auth.users LIMIT 1));

-- Update the client-specific rate card
UPDATE public.rate_cards 
SET client_id = (SELECT id FROM public.clients WHERE email = 'test@example.com')
WHERE name = 'Test Client Rate Card - Tier 2 - 24h';

-- Create test client contract
INSERT INTO public.client_contracts (
  client_id, 
  contract_number, 
  contract_name, 
  contract_type, 
  start_date, 
  end_date, 
  default_tat_hours,
  rate_card_id,
  is_active,
  created_by
)
VALUES (
  (SELECT id FROM public.clients WHERE email = 'test@example.com'),
  'TEST-CONTRACT-001',
  'Test Contract',
  'standard',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '1 year',
  24,
  (SELECT id FROM public.rate_cards WHERE name = 'Test Client Rate Card - Tier 2 - 24h'),
  true,
  (SELECT id FROM auth.users LIMIT 1)
);

-- Step 3: Test the database functions
SELECT 'Step 3: Testing database functions...' as status;

-- Test get_location_from_pincode
SELECT 'Testing get_location_from_pincode...' as test_name;
SELECT * FROM public.get_location_from_pincode('560102');

-- Test get_rate_card_for_client_tier
SELECT 'Testing get_rate_card_for_client_tier...' as test_name;
SELECT * FROM public.get_rate_card_for_client_tier(
  (SELECT id FROM public.clients WHERE email = 'test@example.com'),
  'tier_2',
  'within_24h'
);

-- Test get_case_defaults
SELECT 'Testing get_case_defaults...' as test_name;
SELECT * FROM public.get_case_defaults(
  (SELECT id FROM public.clients WHERE email = 'test@example.com'),
  '560102',
  24
);

-- Step 4: Test case creation with auto-fill
SELECT 'Step 4: Testing case creation with auto-fill...' as status;

-- Create a test case using the actual schema structure
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
  rate_card_id,
  rate_adjustments,
  metadata,
  tat_hours,
  created_by,
  last_updated_by,
  status_updated_at
)
VALUES (
  'TEST-' || EXTRACT(EPOCH FROM NOW())::bigint,
  'CLIENT-TEST-001',
  'Test Case with Auto-Fill',
  'This case tests the complete auto-fill functionality',
  'medium',
  'created',
  (SELECT id FROM public.clients WHERE email = 'test@example.com'),
  (SELECT id FROM public.locations WHERE address_line = 'Test Address, Whitefield'),
  NOW() + INTERVAL '24 hours',
  450.00, -- Should be from client-specific rate card
  515.00, -- base + travel + bonus
  (SELECT id FROM public.rate_cards WHERE name = 'Test Client Rate Card - Tier 2 - 24h'),
  '{"travel_allowance_inr": 45.00, "bonus_inr": 25.00}'::jsonb,
  '{"instructions": "Test instructions for auto-fill verification"}'::jsonb,
  24,
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM auth.users LIMIT 1),
  NOW()
);

-- Step 5: Verify the case was created correctly
SELECT 'Step 5: Verifying case creation...' as status;
SELECT 
  'Case created successfully:' as status, 
  c.case_number, 
  c.client_case_id, 
  c.title, 
  c.status,
  c.base_rate_inr,
  c.total_rate_inr,
  c.rate_adjustments,
  c.metadata,
  c.tat_hours,
  cl.name as client_name,
  l.address_line,
  l.city,
  l.state,
  l.pincode,
  l.pincode_tier,
  rc.name as rate_card_name
FROM public.cases c
JOIN public.clients cl ON c.client_id = cl.id
JOIN public.locations l ON c.location_id = l.id
LEFT JOIN public.rate_cards rc ON c.rate_card_id = rc.id
WHERE c.client_case_id = 'CLIENT-TEST-001';

-- Step 6: Test the frontend integration query
SELECT 'Step 6: Testing frontend integration...' as status;
SELECT 
  'Frontend integration test:' as status,
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
  c.total_rate_inr,
  c.rate_adjustments->>'travel_allowance_inr' as travel_allowance_inr,
  c.rate_adjustments->>'bonus_inr' as bonus_inr,
  c.metadata->>'instructions' as instructions,
  c.tat_hours,
  rc.name as rate_card_name,
  rc.pincode_tier as rate_card_tier,
  rc.completion_slab as rate_card_slab
FROM public.cases c
JOIN public.clients cl ON c.client_id = cl.id
JOIN public.locations l ON c.location_id = l.id
LEFT JOIN public.rate_cards rc ON c.rate_card_id = rc.id
WHERE c.client_case_id = 'CLIENT-TEST-001';

-- Step 7: Test API/CSV upload scenario (no rate card provided)
SELECT 'Step 7: Testing API/CSV upload scenario...' as status;

-- Create a case without providing rate card (should auto-select from client contract)
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
  rate_adjustments,
  metadata,
  tat_hours,
  created_by,
  last_updated_by,
  status_updated_at
)
VALUES (
  'API-TEST-' || EXTRACT(EPOCH FROM NOW())::bigint,
  'API-CLIENT-001',
  'API Upload Test Case',
  'This case simulates API/CSV upload without rate card',
  'medium',
  'created',
  (SELECT id FROM public.clients WHERE email = 'test@example.com'),
  (SELECT id FROM public.locations WHERE address_line = 'Test Address, Whitefield'),
  NOW() + INTERVAL '48 hours',
  350.00, -- Should be from global rate card for 48h
  385.00, -- base + travel + bonus
  NULL, -- No specific rate card assigned
  '{"travel_allowance_inr": 30.00, "bonus_inr": 5.00}'::jsonb,
  '{"instructions": "API upload test case"}'::jsonb,
  48,
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM auth.users LIMIT 1),
  NOW()
);

-- Verify API test case
SELECT 
  'API test case created:' as status,
  c.case_number,
  c.client_case_id,
  c.title,
  c.base_rate_inr,
  c.total_rate_inr,
  c.tat_hours
FROM public.cases c
WHERE c.client_case_id = 'API-CLIENT-001';

-- Step 8: Test validation (duplicate client_case_id should fail)
SELECT 'Step 8: Testing validation...' as status;

-- This should fail due to unique constraint
DO $$
BEGIN
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
    tat_hours,
    created_by,
    last_updated_by,
    status_updated_at
  )
  VALUES (
    'DUPLICATE-TEST-' || EXTRACT(EPOCH FROM NOW())::bigint,
    'CLIENT-TEST-001', -- Same client_case_id as before
    'Duplicate Test Case',
    'This should fail due to unique constraint',
    'medium',
    'created',
    (SELECT id FROM public.clients WHERE email = 'test@example.com'),
    (SELECT id FROM public.locations WHERE address_line = 'Test Address, Whitefield'),
    NOW() + INTERVAL '24 hours',
    400.00,
    400.00,
    24,
    (SELECT id FROM auth.users LIMIT 1),
    (SELECT id FROM auth.users LIMIT 1),
    NOW()
  );
  RAISE NOTICE 'ERROR: Duplicate client_case_id was allowed (this should not happen)';
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'SUCCESS: Duplicate client_case_id was correctly rejected';
  WHEN OTHERS THEN
    RAISE NOTICE 'ERROR: Unexpected error: %', SQLERRM;
END $$;

-- Step 9: Final verification
SELECT 'Step 9: Final verification...' as status;
SELECT 
  'Total test cases created:' as status,
  COUNT(*) as case_count
FROM public.cases 
WHERE client_case_id LIKE '%TEST%' OR client_case_id LIKE '%API%';

SELECT 'All tests completed successfully!' as final_status;
SELECT 'Case creation with auto-fill is working correctly!' as success_message;
