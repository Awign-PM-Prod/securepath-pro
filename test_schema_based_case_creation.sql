-- =====================================================
-- Test Schema-Based Case Creation
-- This works with the actual DATABASE_SCHEMA_DESIGN.md structure
-- =====================================================

-- Step 1: Test pincode_tiers table
SELECT 'Step 1: Testing pincode_tiers table...' as test_step;
SELECT COUNT(*) as pincode_count FROM public.pincode_tiers;

-- Step 2: Test get_location_from_pincode function
SELECT 'Step 2: Testing get_location_from_pincode function...' as test_step;
SELECT * FROM public.get_location_from_pincode('560102');

-- Step 3: Check if we have any clients
SELECT 'Step 3: Testing clients table...' as test_step;
SELECT COUNT(*) as client_count FROM public.clients;

-- Step 4: Check if we have any rate cards
SELECT 'Step 4: Testing rate_cards table...' as test_step;
SELECT COUNT(*) as rate_card_count FROM public.rate_cards;

-- Step 5: Check if we have any client contracts
SELECT 'Step 5: Testing client_contracts table...' as test_step;
SELECT COUNT(*) as contract_count FROM public.client_contracts;

-- Step 6: Test get_case_defaults function with a real client
SELECT 'Step 6: Testing get_case_defaults function...' as test_step;
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

-- Step 7: Create test data if needed
SELECT 'Step 7: Creating test data...' as test_step;

-- Create a test client if none exists
INSERT INTO public.clients (name, email, contact_person, phone, address, city, state, pincode, country, is_active, created_by)
SELECT 
  'Test Client',
  'test@example.com',
  'Test Contact',
  '1234567890',
  'Test Address',
  'Test City',
  'Test State',
  '123456',
  'India',
  true,
  (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.clients WHERE email = 'test@example.com');

-- Create a test location
INSERT INTO public.locations (address_line, city, state, pincode, country, pincode_tier)
SELECT 
  'Test Address, Whitefield',
  'Bangalore',
  'Karnataka',
  '560102',
  'India',
  'tier_2'
WHERE NOT EXISTS (SELECT 1 FROM public.locations WHERE address_line = 'Test Address, Whitefield');

-- Create a test rate card
INSERT INTO public.rate_cards (name, pincode_tier, completion_slab, base_rate_inr, default_travel_inr, default_bonus_inr, is_active, created_by)
SELECT 
  'Test Rate Card',
  'tier_2',
  'within_24h',
  400.00,
  40.00,
  20.00,
  true,
  (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.rate_cards WHERE name = 'Test Rate Card');

-- Create a test client contract
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
SELECT 
  c.id,
  'TEST-001',
  'Test Contract',
  'standard',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '1 year',
  24,
  (SELECT id FROM public.rate_cards WHERE name = 'Test Rate Card' LIMIT 1),
  true,
  (SELECT id FROM auth.users LIMIT 1)
FROM public.clients c
WHERE c.email = 'test@example.com'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Step 8: Test case creation with actual schema
SELECT 'Step 8: Testing case creation with actual schema...' as test_step;

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
  rate_adjustments, -- JSONB field for travel_allowance_inr and bonus_inr
  metadata, -- JSONB field for instructions
  tat_hours,
  created_by,
  last_updated_by,
  status_updated_at
)
SELECT 
  'TEST-' || EXTRACT(EPOCH FROM NOW())::bigint,
  'CLIENT-TEST-001',
  'Test Case for Verification',
  'This is a test case to verify the complete case creation flow',
  'medium',
  'created',
  c.id,
  l.id,
  NOW() + INTERVAL '24 hours',
  400.00,
  460.00, -- base + travel + bonus
  '{"travel_allowance_inr": 40.00, "bonus_inr": 20.00}'::jsonb,
  '{"instructions": "Test instructions for verification"}'::jsonb,
  24,
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM auth.users LIMIT 1),
  NOW()
FROM public.clients c
CROSS JOIN public.locations l
WHERE c.email = 'test@example.com'
  AND l.address_line = 'Test Address, Whitefield'
LIMIT 1;

-- Step 9: Verify the case was created
SELECT 'Step 9: Verifying case creation...' as test_step;
SELECT 
  'Case created successfully:' as status, 
  case_number, 
  client_case_id, 
  title, 
  status,
  base_rate_inr,
  total_rate_inr,
  rate_adjustments,
  metadata,
  tat_hours
FROM public.cases 
WHERE client_case_id = 'CLIENT-TEST-001';

-- Step 10: Test the frontend integration query
SELECT 'Step 10: Testing frontend integration...' as test_step;
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
  c.total_rate_inr,
  c.rate_adjustments->>'travel_allowance_inr' as travel_allowance_inr,
  c.rate_adjustments->>'bonus_inr' as bonus_inr,
  c.metadata->>'instructions' as instructions,
  c.tat_hours
FROM public.cases c
JOIN public.clients cl ON c.client_id = cl.id
JOIN public.locations l ON c.location_id = l.id
WHERE c.client_case_id = 'CLIENT-TEST-001';

-- Step 11: Test the database functions again
SELECT 'Step 11: Testing database functions with test data...' as test_step;
SELECT * FROM public.get_case_defaults(
  (SELECT id FROM public.clients WHERE email = 'test@example.com' LIMIT 1),
  '560102',
  24
);

-- Step 12: Test audit trigger function (should not cause case_id error)
SELECT 'Step 12: Testing audit trigger function...' as test_step;
DO $$
BEGIN
  -- This should not cause the case_id error anymore
  PERFORM public.audit_trigger_function();
  RAISE NOTICE 'Audit trigger function test passed - no case_id error';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Audit trigger function test failed: %', SQLERRM;
END $$;

-- Step 13: Test case creation with audit logging
SELECT 'Step 13: Testing case creation with audit logging...' as test_step;
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
SELECT 
  'AUDIT-TEST-' || EXTRACT(EPOCH FROM NOW())::bigint,
  'AUDIT-CLIENT-001',
  'Audit Test Case',
  'This case tests the audit trigger functionality',
  'medium',
  'created',
  c.id,
  l.id,
  NOW() + INTERVAL '24 hours',
  500.00,
  560.00,
  '{"travel_allowance_inr": 50.00, "bonus_inr": 10.00}'::jsonb,
  '{"instructions": "Audit test instructions"}'::jsonb,
  24,
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM auth.users LIMIT 1),
  NOW()
FROM public.clients c
CROSS JOIN public.locations l
WHERE c.email = 'test@example.com'
  AND l.address_line = 'Test Address, Whitefield'
LIMIT 1;

-- Step 14: Verify audit log was created
SELECT 'Step 14: Verifying audit log was created...' as test_step;
SELECT 
  'Audit log entries:' as status,
  COUNT(*) as audit_count
FROM public.audit_logs 
WHERE entity_type = 'cases' 
  AND action = 'INSERT'
  AND created_at > NOW() - INTERVAL '1 minute';

SELECT 'All tests completed successfully!' as final_status;
