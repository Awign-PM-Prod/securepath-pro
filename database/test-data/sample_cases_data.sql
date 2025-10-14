-- =====================================================
-- Sample Cases Data for Testing Auto Allocation
-- =====================================================

-- First, let's ensure we have some clients and client contracts
INSERT INTO public.clients (
  id,
  name,
  email,
  phone,
  address,
  city,
  state,
  pincode,
  country,
  is_active,
  created_by
) VALUES 
  (gen_random_uuid(), 'ABC Corporation', 'contact@abccorp.com', '9876543001', '123 Business Park', 'Mumbai', 'Maharashtra', '400001', 'India', true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1)),
  (gen_random_uuid(), 'XYZ Industries', 'hr@xyzind.com', '9876543002', '456 Industrial Area', 'Delhi', 'Delhi', '110001', 'India', true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1)),
  (gen_random_uuid(), 'Tech Solutions Ltd', 'admin@techsol.com', '9876543003', '789 Tech Hub', 'Bangalore', 'Karnataka', '560001', 'India', true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1)),
  (gen_random_uuid(), 'Global Services Inc', 'info@globalserv.com', '9876543004', '321 Corporate Plaza', 'Chennai', 'Tamil Nadu', '600001', 'India', true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1)),
  (gen_random_uuid(), 'Startup Ventures', 'hello@startupvent.com', '9876543005', '654 Innovation Center', 'Pune', 'Maharashtra', '411001', 'India', true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1))
ON CONFLICT (email) DO NOTHING;

-- Create client contracts
INSERT INTO public.client_contracts (
  id,
  client_id,
  contract_type,
  is_active,
  created_by
) VALUES 
  ((SELECT id FROM public.clients WHERE email = 'contact@abccorp.com'), 'residential_address_check', true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1)),
  ((SELECT id FROM public.clients WHERE email = 'hr@xyzind.com'), 'residential_address_check', true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1)),
  ((SELECT id FROM public.clients WHERE email = 'admin@techsol.com'), 'business_address_check', true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1)),
  ((SELECT id FROM public.clients WHERE email = 'info@globalserv.com'), 'residential_address_check', true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1)),
  ((SELECT id FROM public.clients WHERE email = 'hello@startupvent.com'), 'business_address_check', true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1))
ON CONFLICT (client_id, contract_type) DO NOTHING;

-- Create sample locations with different pincode tiers
INSERT INTO public.locations (
  id,
  address_line,
  city,
  state,
  country,
  pincode,
  pincode_tier,
  is_verified,
  created_at,
  updated_at
) VALUES 
  -- Mumbai locations (Tier 1)
  (gen_random_uuid(), '123 Andheri West, Near Station', 'Mumbai', 'Maharashtra', 'India', '400058', 'tier_1', true, now(), now()),
  (gen_random_uuid(), '456 Bandra East, Main Road', 'Mumbai', 'Maharashtra', 'India', '400051', 'tier_1', true, now(), now()),
  (gen_random_uuid(), '789 Powai, Hiranandani', 'Mumbai', 'Maharashtra', 'India', '400076', 'tier_1', true, now(), now()),
  
  -- Delhi locations (Tier 1)
  (gen_random_uuid(), '321 Connaught Place, Central Delhi', 'New Delhi', 'Delhi', 'India', '110001', 'tier_1', true, now(), now()),
  (gen_random_uuid(), '654 Karol Bagh, Main Market', 'New Delhi', 'Delhi', 'India', '110005', 'tier_1', true, now(), now()),
  
  -- Bangalore locations (Tier 1)
  (gen_random_uuid(), '987 Koramangala, 5th Block', 'Bangalore', 'Karnataka', 'India', '560034', 'tier_1', true, now(), now()),
  (gen_random_uuid(), '147 Indiranagar, 100 Feet Road', 'Bangalore', 'Karnataka', 'India', '560038', 'tier_1', true, now(), now()),
  
  -- Chennai locations (Tier 2)
  (gen_random_uuid(), '258 T. Nagar, Main Street', 'Chennai', 'Tamil Nadu', 'India', '600017', 'tier_2', true, now(), now()),
  (gen_random_uuid(), '369 Anna Nagar, 2nd Avenue', 'Chennai', 'Tamil Nadu', 'India', '600040', 'tier_2', true, now(), now()),
  
  -- Pune locations (Tier 2)
  (gen_random_uuid(), '741 Koregaon Park, Main Road', 'Pune', 'Maharashtra', 'India', '411001', 'tier_2', true, now(), now()),
  (gen_random_uuid(), '852 Hinjewadi, IT Park', 'Pune', 'Maharashtra', 'India', '411057', 'tier_2', true, now(), now())
ON CONFLICT (pincode) DO NOTHING;

-- Create sample cases with different statuses and locations
INSERT INTO public.cases (
  id,
  case_number,
  client_case_id,
  contract_type,
  candidate_name,
  phone_primary,
  phone_secondary,
  location_id,
  client_id,
  client_contract_id,
  status,
  vendor_tat_start_date,
  tat_hours,
  due_at,
  base_rate_inr,
  bonus_inr,
  penalty_inr,
  total_payout_inr,
  created_by,
  created_at,
  updated_at
) VALUES 
  -- Mumbai cases (Tier 1 - High priority)
  (gen_random_uuid(), 'BG-20250120-000001', 'ABC-001', 'residential_address_check', 'John Doe', '9876544001', '9876544002', (SELECT id FROM public.locations WHERE pincode = '400058'), (SELECT id FROM public.clients WHERE email = 'contact@abccorp.com'), (SELECT id FROM public.client_contracts WHERE client_id = (SELECT id FROM public.clients WHERE email = 'contact@abccorp.com')), 'created', CURRENT_DATE, 24, (CURRENT_DATE + INTERVAL '1 day')::timestamp, 500.00, 0.00, 0.00, 500.00, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1), now(), now()),
  (gen_random_uuid(), 'BG-20250120-000002', 'ABC-002', 'residential_address_check', 'Jane Smith', '9876544003', NULL, (SELECT id FROM public.locations WHERE pincode = '400051'), (SELECT id FROM public.clients WHERE email = 'contact@abccorp.com'), (SELECT id FROM public.client_contracts WHERE client_id = (SELECT id FROM public.clients WHERE email = 'contact@abccorp.com')), 'created', CURRENT_DATE, 24, (CURRENT_DATE + INTERVAL '1 day')::timestamp, 500.00, 0.00, 0.00, 500.00, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1), now(), now()),
  (gen_random_uuid(), 'BG-20250120-000003', 'ABC-003', 'residential_address_check', 'Mike Johnson', '9876544004', '9876544005', (SELECT id FROM public.locations WHERE pincode = '400076'), (SELECT id FROM public.clients WHERE email = 'contact@abccorp.com'), (SELECT id FROM public.client_contracts WHERE client_id = (SELECT id FROM public.clients WHERE email = 'contact@abccorp.com')), 'created', CURRENT_DATE, 24, (CURRENT_DATE + INTERVAL '1 day')::timestamp, 500.00, 0.00, 0.00, 500.00, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1), now(), now()),
  
  -- Delhi cases (Tier 1 - High priority)
  (gen_random_uuid(), 'BG-20250120-000004', 'XYZ-001', 'residential_address_check', 'Sarah Wilson', '9876544006', NULL, (SELECT id FROM public.locations WHERE pincode = '110001'), (SELECT id FROM public.clients WHERE email = 'hr@xyzind.com'), (SELECT id FROM public.client_contracts WHERE client_id = (SELECT id FROM public.clients WHERE email = 'hr@xyzind.com')), 'created', CURRENT_DATE, 24, (CURRENT_DATE + INTERVAL '1 day')::timestamp, 500.00, 0.00, 0.00, 500.00, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1), now(), now()),
  (gen_random_uuid(), 'BG-20250120-000005', 'XYZ-002', 'residential_address_check', 'David Brown', '9876544007', '9876544008', (SELECT id FROM public.locations WHERE pincode = '110005'), (SELECT id FROM public.clients WHERE email = 'hr@xyzind.com'), (SELECT id FROM public.client_contracts WHERE client_id = (SELECT id FROM public.clients WHERE email = 'hr@xyzind.com')), 'created', CURRENT_DATE, 24, (CURRENT_DATE + INTERVAL '1 day')::timestamp, 500.00, 0.00, 0.00, 500.00, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1), now(), now()),
  
  -- Bangalore cases (Tier 1 - High priority)
  (gen_random_uuid(), 'BG-20250120-000006', 'TECH-001', 'business_address_check', 'Lisa Davis', '9876544009', NULL, (SELECT id FROM public.locations WHERE pincode = '560034'), (SELECT id FROM public.clients WHERE email = 'admin@techsol.com'), (SELECT id FROM public.client_contracts WHERE client_id = (SELECT id FROM public.clients WHERE email = 'admin@techsol.com')), 'created', CURRENT_DATE, 24, (CURRENT_DATE + INTERVAL '1 day')::timestamp, 500.00, 0.00, 0.00, 500.00, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1), now(), now()),
  (gen_random_uuid(), 'BG-20250120-000007', 'TECH-002', 'business_address_check', 'Robert Miller', '9876544010', '9876544011', (SELECT id FROM public.locations WHERE pincode = '560038'), (SELECT id FROM public.clients WHERE email = 'admin@techsol.com'), (SELECT id FROM public.client_contracts WHERE client_id = (SELECT id FROM public.clients WHERE email = 'admin@techsol.com')), 'created', CURRENT_DATE, 24, (CURRENT_DATE + INTERVAL '1 day')::timestamp, 500.00, 0.00, 0.00, 500.00, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1), now(), now()),
  
  -- Chennai cases (Tier 2 - Medium priority)
  (gen_random_uuid(), 'BG-20250120-000008', 'GLOBAL-001', 'residential_address_check', 'Maria Garcia', '9876544012', NULL, (SELECT id FROM public.locations WHERE pincode = '600017'), (SELECT id FROM public.clients WHERE email = 'info@globalserv.com'), (SELECT id FROM public.client_contracts WHERE client_id = (SELECT id FROM public.clients WHERE email = 'info@globalserv.com')), 'created', CURRENT_DATE, 48, (CURRENT_DATE + INTERVAL '2 days')::timestamp, 400.00, 0.00, 0.00, 400.00, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1), now(), now()),
  (gen_random_uuid(), 'BG-20250120-000009', 'GLOBAL-002', 'residential_address_check', 'Ahmed Hassan', '9876544013', '9876544014', (SELECT id FROM public.locations WHERE pincode = '600040'), (SELECT id FROM public.clients WHERE email = 'info@globalserv.com'), (SELECT id FROM public.client_contracts WHERE client_id = (SELECT id FROM public.clients WHERE email = 'info@globalserv.com')), 'created', CURRENT_DATE, 48, (CURRENT_DATE + INTERVAL '2 days')::timestamp, 400.00, 0.00, 0.00, 400.00, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1), now(), now()),
  
  -- Pune cases (Tier 2 - Medium priority)
  (gen_random_uuid(), 'BG-20250120-000010', 'STARTUP-001', 'business_address_check', 'Priya Sharma', '9876544015', NULL, (SELECT id FROM public.locations WHERE pincode = '411001'), (SELECT id FROM public.clients WHERE email = 'hello@startupvent.com'), (SELECT id FROM public.client_contracts WHERE client_id = (SELECT id FROM public.clients WHERE email = 'hello@startupvent.com')), 'created', CURRENT_DATE, 48, (CURRENT_DATE + INTERVAL '2 days')::timestamp, 400.00, 0.00, 0.00, 400.00, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1), now(), now()),
  (gen_random_uuid(), 'BG-20250120-000011', 'STARTUP-002', 'business_address_check', 'Rajesh Kumar', '9876544016', '9876544017', (SELECT id FROM public.locations WHERE pincode = '411057'), (SELECT id FROM public.clients WHERE email = 'hello@startupvent.com'), (SELECT id FROM public.client_contracts WHERE client_id = (SELECT id FROM public.clients WHERE email = 'hello@startupvent.com')), 'created', CURRENT_DATE, 48, (CURRENT_DATE + INTERVAL '2 days')::timestamp, 400.00, 0.00, 0.00, 400.00, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1), now(), now()),
  
  -- Some cases with different statuses for testing
  (gen_random_uuid(), 'BG-20250120-000012', 'ABC-004', 'residential_address_check', 'Test User 1', '9876544018', NULL, (SELECT id FROM public.locations WHERE pincode = '400058'), (SELECT id FROM public.clients WHERE email = 'contact@abccorp.com'), (SELECT id FROM public.client_contracts WHERE client_id = (SELECT id FROM public.clients WHERE email = 'contact@abccorp.com')), 'auto_allocated', CURRENT_DATE, 24, (CURRENT_DATE + INTERVAL '1 day')::timestamp, 500.00, 0.00, 0.00, 500.00, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1), now(), now()),
  (gen_random_uuid(), 'BG-20250120-000013', 'XYZ-003', 'residential_address_check', 'Test User 2', '9876544019', NULL, (SELECT id FROM public.locations WHERE pincode = '110001'), (SELECT id FROM public.clients WHERE email = 'hr@xyzind.com'), (SELECT id FROM public.client_contracts WHERE client_id = (SELECT id FROM public.clients WHERE email = 'hr@xyzind.com')), 'pending_acceptance', CURRENT_DATE, 24, (CURRENT_DATE + INTERVAL '1 day')::timestamp, 500.00, 0.00, 0.00, 500.00, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1), now(), now());

-- Verify the data was inserted
SELECT 
  'Cases Created' as status,
  COUNT(*) as count
FROM public.cases;

SELECT 
  'Locations Created' as status,
  COUNT(*) as count
FROM public.locations;

SELECT 
  'Clients Created' as status,
  COUNT(*) as count
FROM public.clients;

SELECT 
  'Client Contracts Created' as status,
  COUNT(*) as count
FROM public.client_contracts;

-- Show cases by status
SELECT 
  'Cases by Status' as info,
  status,
  COUNT(*) as count
FROM public.cases
GROUP BY status
ORDER BY count DESC;

-- Show cases by pincode tier
SELECT 
  'Cases by Pincode Tier' as info,
  l.pincode_tier,
  COUNT(*) as count
FROM public.cases c
JOIN public.locations l ON c.location_id = l.id
GROUP BY l.pincode_tier
ORDER BY count DESC;
