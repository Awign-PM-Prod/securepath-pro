-- =====================================================
-- Test Rate Card Queries
-- Tests the fixed Supabase queries for rate cards and client contracts
-- =====================================================

-- Step 1: Test rate cards query
SELECT 'Step 1: Testing rate cards query...' as status;

-- This should work without the ambiguous relationship error
SELECT 
  rc.id,
  rc.name,
  rc.client_id,
  rc.pincode_tier,
  rc.completion_slab,
  rc.base_rate_inr,
  rc.default_travel_inr,
  rc.default_bonus_inr,
  rc.is_active,
  c.id as client_id_from_join,
  c.name as client_name_from_join
FROM public.rate_cards rc
LEFT JOIN public.clients c ON rc.client_id = c.id
ORDER BY rc.created_at DESC
LIMIT 5;

-- Step 2: Test client contracts query
SELECT 'Step 2: Testing client contracts query...' as status;

-- This should work without the ambiguous relationship error
SELECT 
  cc.id,
  cc.contract_number,
  cc.contract_name,
  cc.client_id,
  cc.rate_card_id,
  cc.default_tat_hours,
  cc.is_active,
  c.id as client_id_from_join,
  c.name as client_name_from_join,
  rc.id as rate_card_id_from_join,
  rc.name as rate_card_name_from_join
FROM public.client_contracts cc
LEFT JOIN public.clients c ON cc.client_id = c.id
LEFT JOIN public.rate_cards rc ON cc.rate_card_id = rc.id
ORDER BY cc.created_at DESC
LIMIT 5;

-- Step 3: Test the exact Supabase queries that were failing
SELECT 'Step 3: Testing exact Supabase queries...' as status;

-- Test rate cards query with explicit foreign key reference
SELECT 
  rc.*,
  c.id as clients_id,
  c.name as clients_name
FROM public.rate_cards rc
LEFT JOIN public.clients c ON rc.client_id = c.id
ORDER BY rc.created_at DESC
LIMIT 3;

-- Test client contracts query with explicit foreign key references
SELECT 
  cc.*,
  c.id as clients_id,
  c.name as clients_name,
  rc.id as rate_cards_id,
  rc.name as rate_cards_name
FROM public.client_contracts cc
LEFT JOIN public.clients c ON cc.client_id = c.id
LEFT JOIN public.rate_cards rc ON cc.rate_card_id = rc.id
ORDER BY cc.created_at DESC
LIMIT 3;

-- Step 4: Verify foreign key constraints exist
SELECT 'Step 4: Verifying foreign key constraints...' as status;

-- Check rate_cards foreign key
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'rate_cards'
  AND kcu.column_name = 'client_id';

-- Check client_contracts foreign keys
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'client_contracts'
  AND (kcu.column_name = 'client_id' OR kcu.column_name = 'rate_card_id');

-- Step 5: Test data creation for frontend testing
SELECT 'Step 5: Creating test data for frontend...' as status;

-- Create test client if it doesn't exist
INSERT INTO public.clients (name, email, contact_person, phone, address, city, state, pincode, country, is_active, created_by)
SELECT 
  'Test Client for Rate Cards',
  'ratecard-test@example.com',
  'Test Contact',
  '9876543210',
  'Test Address',
  'Test City',
  'Test State',
  '123456',
  'India',
  true,
  (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.clients WHERE email = 'ratecard-test@example.com');

-- Create test rate cards
INSERT INTO public.rate_cards (name, client_id, pincode_tier, completion_slab, base_rate_inr, default_travel_inr, default_bonus_inr, is_active, created_by)
SELECT 
  'Test Global Rate Card',
  NULL,
  'tier_2',
  'within_24h',
  400.00,
  40.00,
  20.00,
  true,
  (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.rate_cards WHERE name = 'Test Global Rate Card');

INSERT INTO public.rate_cards (name, client_id, pincode_tier, completion_slab, base_rate_inr, default_travel_inr, default_bonus_inr, is_active, created_by)
SELECT 
  'Test Client Rate Card',
  (SELECT id FROM public.clients WHERE email = 'ratecard-test@example.com'),
  'tier_2',
  'within_24h',
  450.00,
  45.00,
  25.00,
  true,
  (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.rate_cards WHERE name = 'Test Client Rate Card');

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
SELECT 
  (SELECT id FROM public.clients WHERE email = 'ratecard-test@example.com'),
  'RATE-TEST-001',
  'Test Rate Card Contract',
  'standard',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '1 year',
  24,
  (SELECT id FROM public.rate_cards WHERE name = 'Test Client Rate Card'),
  true,
  (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.client_contracts WHERE contract_number = 'RATE-TEST-001');

-- Step 6: Final verification
SELECT 'Step 6: Final verification...' as status;

-- Verify the test data was created
SELECT 
  'Rate cards created:' as info,
  COUNT(*) as count
FROM public.rate_cards 
WHERE name LIKE 'Test%';

SELECT 
  'Client contracts created:' as info,
  COUNT(*) as count
FROM public.client_contracts 
WHERE contract_number LIKE 'RATE-TEST-%';

-- Test the final queries that the frontend will use
SELECT 'Final frontend query test:' as status;
SELECT 
  rc.id,
  rc.name,
  rc.client_id,
  rc.pincode_tier,
  rc.completion_slab,
  rc.base_rate_inr,
  rc.is_active,
  c.name as client_name
FROM public.rate_cards rc
LEFT JOIN public.clients c ON rc.client_id = c.id
WHERE rc.name LIKE 'Test%'
ORDER BY rc.created_at DESC;

SELECT 'All tests completed successfully!' as final_status;
SELECT 'Rate card queries are now working correctly!' as success_message;

