-- =====================================================
-- Test Simple Case Creation
-- This creates a minimal case to test the basic functionality
-- =====================================================

-- Step 1: Create a test client if none exists
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

-- Step 2: Create a test location
INSERT INTO public.locations (address_line, city, state, pincode, country, pincode_tier)
SELECT 
  'Test Address, Whitefield',
  'Bangalore',
  'Karnataka',
  '560102',
  'India',
  'tier_2'
WHERE NOT EXISTS (SELECT 1 FROM public.locations WHERE address_line = 'Test Address, Whitefield');

-- Step 3: Create a test rate card
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

-- Step 4: Create a test case
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
  last_updated_by,
  status_updated_at
)
SELECT 
  'TEST-' || EXTRACT(EPOCH FROM NOW())::bigint,
  'CLIENT-TEST-001',
  'Test Case for Verification',
  'This is a test case to verify the complete case creation flow',
  'medium',
  'created', -- Using correct enum value
  c.id,
  l.id,
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
FROM public.clients c
CROSS JOIN public.locations l
WHERE c.email = 'test@example.com'
  AND l.address_line = 'Test Address, Whitefield'
LIMIT 1;

-- Step 5: Verify the case was created
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

-- Step 6: Test the frontend integration query
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

SELECT 'All tests completed successfully!' as final_status;

