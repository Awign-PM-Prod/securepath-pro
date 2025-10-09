-- =====================================================
-- Final Test Data Setup for Auto Allocation Testing
-- =====================================================

-- This script sets up all the necessary test data for testing the auto allocation system
-- Run this script in your Supabase SQL editor

-- Step 0: Create a test admin user for created_by references
-- Creating test admin user...

-- First, check if test admin already exists, if not create it
DO $$
DECLARE
    test_admin_id UUID;
BEGIN
    -- Check if test admin already exists
    SELECT id INTO test_admin_id 
    FROM public.profiles 
    WHERE email = 'test.admin@example.com' 
    LIMIT 1;
    
    -- If not exists, create it
    IF test_admin_id IS NULL THEN
        INSERT INTO public.profiles (
            id,
            user_id,
            first_name,
            last_name,
            email,
            phone,
            role,
            is_active,
            created_by
        ) VALUES (
            gen_random_uuid(),
            NULL,
            'Test',
            'Admin',
            'test.admin@example.com',
            '9999999999',
            'ops_team',
            true,
            NULL
        );
    END IF;
END $$;

-- Step 1: Create sample gig workers with different capacities and performance metrics
-- Creating sample gig workers...

-- Insert sample profiles and gig workers
INSERT INTO public.profiles (
  id,
  user_id,
  first_name,
  last_name,
  email,
  phone,
  role,
  is_active,
  created_by
) VALUES 
  -- Mumbai gig workers
  (gen_random_uuid(), NULL, 'Rajesh', 'Kumar', 'rajesh.kumar@example.com', '9876543210', 'gig_worker', true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com')),
  (gen_random_uuid(), NULL, 'Priya', 'Sharma', 'priya.sharma@example.com', '9876543211', 'gig_worker', true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com')),
  (gen_random_uuid(), NULL, 'Amit', 'Patel', 'amit.patel@example.com', '9876543212', 'gig_worker', true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com')),
  
  -- Delhi gig workers
  (gen_random_uuid(), NULL, 'Suresh', 'Singh', 'suresh.singh@example.com', '9876543213', 'gig_worker', true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com')),
  (gen_random_uuid(), NULL, 'Meera', 'Gupta', 'meera.gupta@example.com', '9876543214', 'gig_worker', true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com')),
  
  -- Bangalore gig workers
  (gen_random_uuid(), NULL, 'Kavita', 'Reddy', 'kavita.reddy@example.com', '9876543215', 'gig_worker', true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com')),
  (gen_random_uuid(), NULL, 'Arjun', 'Nair', 'arjun.nair@example.com', '9876543216', 'gig_worker', true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com')),
  
  -- Chennai gig workers
  (gen_random_uuid(), NULL, 'Deepak', 'Iyer', 'deepak.iyer@example.com', '9876543217', 'gig_worker', true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com')),
  (gen_random_uuid(), NULL, 'Anjali', 'Raman', 'anjali.raman@example.com', '9876543218', 'gig_worker', true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com')),
  
  -- Pune gig workers
  (gen_random_uuid(), NULL, 'Vikram', 'Joshi', 'vikram.joshi@example.com', '9876543219', 'gig_worker', true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com')),
  (gen_random_uuid(), NULL, 'Sunita', 'Desai', 'sunita.desai@example.com', '9876543220', 'gig_worker', true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com'));

-- Create gig_partners records
INSERT INTO public.gig_partners (
  id,
  user_id,
  profile_id,
  alternate_phone,
  address,
  city,
  state,
  pincode,
  country,
  coverage_pincodes,
  max_daily_capacity,
  capacity_available,
  vendor_id,
  is_direct_gig,
  is_active,
  is_available,
  created_by
) VALUES 
  -- Mumbai gig workers (Tier 1 - High capacity)
  (gen_random_uuid(), NULL, (SELECT id FROM public.profiles WHERE email = 'rajesh.kumar@example.com'), '9876543210', '123 Andheri West', 'Mumbai', 'Maharashtra', '400058', 'India', ARRAY['400001', '400002', '400003', '400058', '400059'], 8, 8, NULL, true, true, true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com')),
  (gen_random_uuid(), NULL, (SELECT id FROM public.profiles WHERE email = 'priya.sharma@example.com'), '9876543211', '456 Bandra East', 'Mumbai', 'Maharashtra', '400051', 'India', ARRAY['400001', '400002', '400051', '400052'], 6, 6, NULL, true, true, true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com')),
  (gen_random_uuid(), NULL, (SELECT id FROM public.profiles WHERE email = 'amit.patel@example.com'), '9876543212', '789 Powai', 'Mumbai', 'Maharashtra', '400076', 'India', ARRAY['400076', '400077', '400078'], 5, 5, NULL, true, true, true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com')),
  
  -- Delhi gig workers (Tier 1 - High capacity)
  (gen_random_uuid(), NULL, (SELECT id FROM public.profiles WHERE email = 'suresh.singh@example.com'), '9876543213', '321 Connaught Place', 'New Delhi', 'Delhi', '110001', 'India', ARRAY['110001', '110002', '110003'], 7, 7, NULL, true, true, true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com')),
  (gen_random_uuid(), NULL, (SELECT id FROM public.profiles WHERE email = 'meera.gupta@example.com'), '9876543214', '654 Karol Bagh', 'New Delhi', 'Delhi', '110005', 'India', ARRAY['110005', '110006', '110007'], 6, 6, NULL, true, true, true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com')),
  
  -- Bangalore gig workers (Tier 1 - High capacity)
  (gen_random_uuid(), NULL, (SELECT id FROM public.profiles WHERE email = 'kavita.reddy@example.com'), '9876543215', '987 Koramangala', 'Bangalore', 'Karnataka', '560034', 'India', ARRAY['560001', '560002', '560034', '560035'], 8, 8, NULL, true, true, true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com')),
  (gen_random_uuid(), NULL, (SELECT id FROM public.profiles WHERE email = 'arjun.nair@example.com'), '9876543216', '147 Indiranagar', 'Bangalore', 'Karnataka', '560038', 'India', ARRAY['560038', '560039', '560040'], 5, 5, NULL, true, true, true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com')),
  
  -- Chennai gig workers (Tier 2 - Medium capacity)
  (gen_random_uuid(), NULL, (SELECT id FROM public.profiles WHERE email = 'deepak.iyer@example.com'), '9876543217', '258 T. Nagar', 'Chennai', 'Tamil Nadu', '600017', 'India', ARRAY['600001', '600002', '600017'], 4, 4, NULL, true, true, true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com')),
  (gen_random_uuid(), NULL, (SELECT id FROM public.profiles WHERE email = 'anjali.raman@example.com'), '9876543218', '369 Anna Nagar', 'Chennai', 'Tamil Nadu', '600040', 'India', ARRAY['600040', '600041', '600042'], 3, 3, NULL, true, true, true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com')),
  
  -- Pune gig workers (Tier 2 - Medium capacity)
  (gen_random_uuid(), NULL, (SELECT id FROM public.profiles WHERE email = 'vikram.joshi@example.com'), '9876543219', '741 Koregaon Park', 'Pune', 'Maharashtra', '411001', 'India', ARRAY['411001', '411002', '411003'], 4, 4, NULL, true, true, true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com')),
  (gen_random_uuid(), NULL, (SELECT id FROM public.profiles WHERE email = 'sunita.desai@example.com'), '9876543220', '852 Hinjewadi', 'Pune', 'Maharashtra', '411057', 'India', ARRAY['411057', '411058', '411059'], 3, 3, NULL, true, true, true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com'));

-- Step 2: Create sample clients and contracts
-- Creating sample clients and contracts...

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
  (gen_random_uuid(), 'ABC Corporation', 'contact@abccorp.com', '9876543001', '123 Business Park', 'Mumbai', 'Maharashtra', '400001', 'India', true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com')),
  (gen_random_uuid(), 'XYZ Industries', 'hr@xyzind.com', '9876543002', '456 Industrial Area', 'Delhi', 'Delhi', '110001', 'India', true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com')),
  (gen_random_uuid(), 'Tech Solutions Ltd', 'admin@techsol.com', '9876543003', '789 Tech Hub', 'Bangalore', 'Karnataka', '560001', 'India', true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com')),
  (gen_random_uuid(), 'Global Services Inc', 'info@globalserv.com', '9876543004', '321 Corporate Plaza', 'Chennai', 'Tamil Nadu', '600001', 'India', true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com')),
  (gen_random_uuid(), 'Startup Ventures', 'hello@startupvent.com', '9876543005', '654 Innovation Center', 'Pune', 'Maharashtra', '411001', 'India', true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com'));

-- Create client contracts
INSERT INTO public.client_contracts (
  id,
  client_id,
  contract_type,
  is_active,
  created_by
) VALUES 
  ((SELECT id FROM public.clients WHERE email = 'contact@abccorp.com'), 'residential_address_check', true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com')),
  ((SELECT id FROM public.clients WHERE email = 'hr@xyzind.com'), 'residential_address_check', true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com')),
  ((SELECT id FROM public.clients WHERE email = 'admin@techsol.com'), 'business_address_check', true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com')),
  ((SELECT id FROM public.clients WHERE email = 'info@globalserv.com'), 'residential_address_check', true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com')),
  ((SELECT id FROM public.clients WHERE email = 'hello@startupvent.com'), 'business_address_check', true, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com'));

-- Step 3: Create sample locations
-- Creating sample locations...

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
  (gen_random_uuid(), '852 Hinjewadi, IT Park', 'Pune', 'Maharashtra', 'India', '411057', 'tier_2', true, now(), now());

-- Step 4: Create sample cases
-- Creating sample cases...

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
  (gen_random_uuid(), 'BG-20250120-000001', 'ABC-001', 'residential_address_check', 'John Doe', '9876544001', '9876544002', (SELECT id FROM public.locations WHERE pincode = '400058'), (SELECT id FROM public.clients WHERE email = 'contact@abccorp.com'), (SELECT id FROM public.client_contracts WHERE client_id = (SELECT id FROM public.clients WHERE email = 'contact@abccorp.com')), 'created', CURRENT_DATE, 24, (CURRENT_DATE + INTERVAL '1 day')::timestamp, 500.00, 0.00, 0.00, 500.00, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com'), now(), now()),
  (gen_random_uuid(), 'BG-20250120-000002', 'ABC-002', 'residential_address_check', 'Jane Smith', '9876544003', NULL, (SELECT id FROM public.locations WHERE pincode = '400051'), (SELECT id FROM public.clients WHERE email = 'contact@abccorp.com'), (SELECT id FROM public.client_contracts WHERE client_id = (SELECT id FROM public.clients WHERE email = 'contact@abccorp.com')), 'created', CURRENT_DATE, 24, (CURRENT_DATE + INTERVAL '1 day')::timestamp, 500.00, 0.00, 0.00, 500.00, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com'), now(), now()),
  (gen_random_uuid(), 'BG-20250120-000003', 'ABC-003', 'residential_address_check', 'Mike Johnson', '9876544004', '9876544005', (SELECT id FROM public.locations WHERE pincode = '400076'), (SELECT id FROM public.clients WHERE email = 'contact@abccorp.com'), (SELECT id FROM public.client_contracts WHERE client_id = (SELECT id FROM public.clients WHERE email = 'contact@abccorp.com')), 'created', CURRENT_DATE, 24, (CURRENT_DATE + INTERVAL '1 day')::timestamp, 500.00, 0.00, 0.00, 500.00, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com'), now(), now()),
  
  -- Delhi cases (Tier 1 - High priority)
  (gen_random_uuid(), 'BG-20250120-000004', 'XYZ-001', 'residential_address_check', 'Sarah Wilson', '9876544006', NULL, (SELECT id FROM public.locations WHERE pincode = '110001'), (SELECT id FROM public.clients WHERE email = 'hr@xyzind.com'), (SELECT id FROM public.client_contracts WHERE client_id = (SELECT id FROM public.clients WHERE email = 'hr@xyzind.com')), 'created', CURRENT_DATE, 24, (CURRENT_DATE + INTERVAL '1 day')::timestamp, 500.00, 0.00, 0.00, 500.00, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com'), now(), now()),
  (gen_random_uuid(), 'BG-20250120-000005', 'XYZ-002', 'residential_address_check', 'David Brown', '9876544007', '9876544008', (SELECT id FROM public.locations WHERE pincode = '110005'), (SELECT id FROM public.clients WHERE email = 'hr@xyzind.com'), (SELECT id FROM public.client_contracts WHERE client_id = (SELECT id FROM public.clients WHERE email = 'hr@xyzind.com')), 'created', CURRENT_DATE, 24, (CURRENT_DATE + INTERVAL '1 day')::timestamp, 500.00, 0.00, 0.00, 500.00, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com'), now(), now()),
  
  -- Bangalore cases (Tier 1 - High priority)
  (gen_random_uuid(), 'BG-20250120-000006', 'TECH-001', 'business_address_check', 'Lisa Davis', '9876544009', NULL, (SELECT id FROM public.locations WHERE pincode = '560034'), (SELECT id FROM public.clients WHERE email = 'admin@techsol.com'), (SELECT id FROM public.client_contracts WHERE client_id = (SELECT id FROM public.clients WHERE email = 'admin@techsol.com')), 'created', CURRENT_DATE, 24, (CURRENT_DATE + INTERVAL '1 day')::timestamp, 500.00, 0.00, 0.00, 500.00, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com'), now(), now()),
  (gen_random_uuid(), 'BG-20250120-000007', 'TECH-002', 'business_address_check', 'Robert Miller', '9876544010', '9876544011', (SELECT id FROM public.locations WHERE pincode = '560038'), (SELECT id FROM public.clients WHERE email = 'admin@techsol.com'), (SELECT id FROM public.client_contracts WHERE client_id = (SELECT id FROM public.clients WHERE email = 'admin@techsol.com')), 'created', CURRENT_DATE, 24, (CURRENT_DATE + INTERVAL '1 day')::timestamp, 500.00, 0.00, 0.00, 500.00, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com'), now(), now()),
  
  -- Chennai cases (Tier 2 - Medium priority)
  (gen_random_uuid(), 'BG-20250120-000008', 'GLOBAL-001', 'residential_address_check', 'Maria Garcia', '9876544012', NULL, (SELECT id FROM public.locations WHERE pincode = '600017'), (SELECT id FROM public.clients WHERE email = 'info@globalserv.com'), (SELECT id FROM public.client_contracts WHERE client_id = (SELECT id FROM public.clients WHERE email = 'info@globalserv.com')), 'created', CURRENT_DATE, 48, (CURRENT_DATE + INTERVAL '2 days')::timestamp, 400.00, 0.00, 0.00, 400.00, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com'), now(), now()),
  (gen_random_uuid(), 'BG-20250120-000009', 'GLOBAL-002', 'residential_address_check', 'Ahmed Hassan', '9876544013', '9876544014', (SELECT id FROM public.locations WHERE pincode = '600040'), (SELECT id FROM public.clients WHERE email = 'info@globalserv.com'), (SELECT id FROM public.client_contracts WHERE client_id = (SELECT id FROM public.clients WHERE email = 'info@globalserv.com')), 'created', CURRENT_DATE, 48, (CURRENT_DATE + INTERVAL '2 days')::timestamp, 400.00, 0.00, 0.00, 400.00, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com'), now(), now()),
  
  -- Pune cases (Tier 2 - Medium priority)
  (gen_random_uuid(), 'BG-20250120-000010', 'STARTUP-001', 'business_address_check', 'Priya Sharma', '9876544015', NULL, (SELECT id FROM public.locations WHERE pincode = '411001'), (SELECT id FROM public.clients WHERE email = 'hello@startupvent.com'), (SELECT id FROM public.client_contracts WHERE client_id = (SELECT id FROM public.clients WHERE email = 'hello@startupvent.com')), 'created', CURRENT_DATE, 48, (CURRENT_DATE + INTERVAL '2 days')::timestamp, 400.00, 0.00, 0.00, 400.00, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com'), now(), now()),
  (gen_random_uuid(), 'BG-20250120-000011', 'STARTUP-002', 'business_address_check', 'Rajesh Kumar', '9876544016', '9876544017', (SELECT id FROM public.locations WHERE pincode = '411057'), (SELECT id FROM public.clients WHERE email = 'hello@startupvent.com'), (SELECT id FROM public.client_contracts WHERE client_id = (SELECT id FROM public.clients WHERE email = 'hello@startupvent.com')), 'created', CURRENT_DATE, 48, (CURRENT_DATE + INTERVAL '2 days')::timestamp, 400.00, 0.00, 0.00, 400.00, (SELECT id FROM public.profiles WHERE email = 'test.admin@example.com'), now(), now());

-- Step 5: Initialize capacity tracking
-- Initializing capacity tracking...

INSERT INTO public.capacity_tracking (
  id,
  gig_partner_id,
  date,
  max_daily_capacity,
  initial_capacity_available,
  current_capacity_available,
  is_active,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  gp.id,
  CURRENT_DATE,
  gp.max_daily_capacity,
  gp.capacity_available,
  gp.capacity_available,
  true,
  now(),
  now()
FROM public.gig_partners gp
WHERE gp.is_active = true;

-- Step 6: Create basic performance metrics
-- Creating performance metrics...

INSERT INTO public.performance_metrics (
  id,
  gig_partner_id,
  period_start,
  period_end,
  total_cases_assigned,
  total_cases_completed,
  total_cases_on_time,
  total_cases_qc_passed,
  total_cases_accepted,
  completion_rate,
  ontime_completion_rate,
  acceptance_rate,
  quality_score,
  last_updated_at,
  created_at
)
SELECT 
  gen_random_uuid(),
  gp.id,
  CURRENT_DATE - INTERVAL '30 days', -- period_start
  CURRENT_DATE, -- period_end
  10, -- total_cases_assigned
  8,  -- total_cases_completed
  7,  -- total_cases_on_time
  7,  -- total_cases_qc_passed
  9,  -- total_cases_accepted
  0.80, -- completion_rate
  0.70, -- ontime_completion_rate
  0.90, -- acceptance_rate
  0.80, -- quality_score
  now(),
  now()
FROM public.gig_partners gp
WHERE gp.is_active = true;

-- Step 7: Verification and Summary
-- Test data setup completed! Here is the summary:

SELECT 
  'Gig Workers Created' as status,
  COUNT(*) as count
FROM public.gig_partners 
WHERE is_active = true;

SELECT 
  'Capacity Tracking Initialized' as status,
  COUNT(*) as count
FROM public.capacity_tracking 
WHERE date = CURRENT_DATE;

SELECT 
  'Performance Metrics Created' as status,
  COUNT(*) as count
FROM public.performance_metrics;

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

-- Show gig workers by city and capacity
SELECT 
  'Gig Workers by City' as info,
  gp.city,
  COUNT(*) as count,
  SUM(gp.max_daily_capacity) as total_capacity,
  SUM(gp.capacity_available) as available_capacity
FROM public.gig_partners gp
WHERE gp.is_active = true
GROUP BY gp.city
ORDER BY total_capacity DESC;

-- Setup complete! You can now test the auto allocation system.
