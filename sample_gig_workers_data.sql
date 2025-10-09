-- =====================================================
-- Sample Gig Workers Data for Testing Auto Allocation
-- =====================================================

-- Insert sample gig workers with different pincode coverage and capacities
-- This script creates gig workers in different cities with various capacity levels

-- First, let's create some sample profiles and gig workers
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
  (gen_random_uuid(), NULL, 'Rajesh', 'Kumar', 'rajesh.kumar@example.com', '9876543210', 'gig_worker', true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1)),
  (gen_random_uuid(), NULL, 'Priya', 'Sharma', 'priya.sharma@example.com', '9876543211', 'gig_worker', true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1)),
  (gen_random_uuid(), NULL, 'Amit', 'Patel', 'amit.patel@example.com', '9876543212', 'gig_worker', true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1)),
  
  -- Delhi gig workers
  (gen_random_uuid(), NULL, 'Suresh', 'Singh', 'suresh.singh@example.com', '9876543213', 'gig_worker', true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1)),
  (gen_random_uuid(), NULL, 'Meera', 'Gupta', 'meera.gupta@example.com', '9876543214', 'gig_worker', true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1)),
  
  -- Bangalore gig workers
  (gen_random_uuid(), NULL, 'Kavita', 'Reddy', 'kavita.reddy@example.com', '9876543215', 'gig_worker', true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1)),
  (gen_random_uuid(), NULL, 'Arjun', 'Nair', 'arjun.nair@example.com', '9876543216', 'gig_worker', true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1)),
  
  -- Chennai gig workers
  (gen_random_uuid(), NULL, 'Deepak', 'Iyer', 'deepak.iyer@example.com', '9876543217', 'gig_worker', true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1)),
  (gen_random_uuid(), NULL, 'Anjali', 'Raman', 'anjali.raman@example.com', '9876543218', 'gig_worker', true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1)),
  
  -- Pune gig workers
  (gen_random_uuid(), NULL, 'Vikram', 'Joshi', 'vikram.joshi@example.com', '9876543219', 'gig_worker', true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1)),
  (gen_random_uuid(), NULL, 'Sunita', 'Desai', 'sunita.desai@example.com', '9876543220', 'gig_worker', true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1));

-- Now create gig_partners records for these profiles
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
  (gen_random_uuid(), NULL, (SELECT id FROM public.profiles WHERE email = 'rajesh.kumar@example.com'), '9876543210', '123 Andheri West', 'Mumbai', 'Maharashtra', '400058', 'India', ARRAY['400001', '400002', '400003', '400058', '400059'], 8, 8, NULL, true, true, true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1)),
  (gen_random_uuid(), NULL, (SELECT id FROM public.profiles WHERE email = 'priya.sharma@example.com'), '9876543211', '456 Bandra East', 'Mumbai', 'Maharashtra', '400051', 'India', ARRAY['400001', '400002', '400051', '400052'], 6, 6, NULL, true, true, true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1)),
  (gen_random_uuid(), NULL, (SELECT id FROM public.profiles WHERE email = 'amit.patel@example.com'), '9876543212', '789 Powai', 'Mumbai', 'Maharashtra', '400076', 'India', ARRAY['400076', '400077', '400078'], 5, 5, NULL, true, true, true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1)),
  
  -- Delhi gig workers (Tier 1 - High capacity)
  (gen_random_uuid(), NULL, (SELECT id FROM public.profiles WHERE email = 'suresh.singh@example.com'), '9876543213', '321 Connaught Place', 'New Delhi', 'Delhi', '110001', 'India', ARRAY['110001', '110002', '110003'], 7, 7, NULL, true, true, true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1)),
  (gen_random_uuid(), NULL, (SELECT id FROM public.profiles WHERE email = 'meera.gupta@example.com'), '9876543214', '654 Karol Bagh', 'New Delhi', 'Delhi', '110005', 'India', ARRAY['110005', '110006', '110007'], 6, 6, NULL, true, true, true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1)),
  
  -- Bangalore gig workers (Tier 1 - High capacity)
  (gen_random_uuid(), NULL, (SELECT id FROM public.profiles WHERE email = 'kavita.reddy@example.com'), '9876543215', '987 Koramangala', 'Bangalore', 'Karnataka', '560034', 'India', ARRAY['560001', '560002', '560034', '560035'], 8, 8, NULL, true, true, true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1)),
  (gen_random_uuid(), NULL, (SELECT id FROM public.profiles WHERE email = 'arjun.nair@example.com'), '9876543216', '147 Indiranagar', 'Bangalore', 'Karnataka', '560038', 'India', ARRAY['560038', '560039', '560040'], 5, 5, NULL, true, true, true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1)),
  
  -- Chennai gig workers (Tier 2 - Medium capacity)
  (gen_random_uuid(), NULL, (SELECT id FROM public.profiles WHERE email = 'deepak.iyer@example.com'), '9876543217', '258 T. Nagar', 'Chennai', 'Tamil Nadu', '600017', 'India', ARRAY['600001', '600002', '600017'], 4, 4, NULL, true, true, true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1)),
  (gen_random_uuid(), NULL, (SELECT id FROM public.profiles WHERE email = 'anjali.raman@example.com'), '9876543218', '369 Anna Nagar', 'Chennai', 'Tamil Nadu', '600040', 'India', ARRAY['600040', '600041', '600042'], 3, 3, NULL, true, true, true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1)),
  
  -- Pune gig workers (Tier 2 - Medium capacity)
  (gen_random_uuid(), NULL, (SELECT id FROM public.profiles WHERE email = 'vikram.joshi@example.com'), '9876543219', '741 Koregaon Park', 'Pune', 'Maharashtra', '411001', 'India', ARRAY['411001', '411002', '411003'], 4, 4, NULL, true, true, true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1)),
  (gen_random_uuid(), NULL, (SELECT id FROM public.profiles WHERE email = 'sunita.desai@example.com'), '9876543220', '852 Hinjewadi', 'Pune', 'Maharashtra', '411057', 'India', ARRAY['411057', '411058', '411059'], 3, 3, NULL, true, true, true, (SELECT id FROM public.profiles WHERE role = 'ops_team' LIMIT 1));

-- Initialize capacity tracking for all gig workers
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
WHERE gp.is_active = true
ON CONFLICT (gig_partner_id, date) DO NOTHING;

-- Create some performance metrics for the gig workers
INSERT INTO public.performance_metrics (
  id,
  gig_partner_id,
  total_cases_assigned,
  total_cases_completed,
  total_cases_on_time,
  total_cases_qc_passed,
  total_cases_accepted,
  completion_rate,
  on_time_completion_rate,
  qc_pass_rate,
  acceptance_rate,
  overall_score,
  last_updated,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  gp.id,
  CASE 
    WHEN gp.city = 'Mumbai' THEN 25 + (random() * 15)::int
    WHEN gp.city = 'New Delhi' THEN 20 + (random() * 10)::int
    WHEN gp.city = 'Bangalore' THEN 22 + (random() * 12)::int
    WHEN gp.city = 'Chennai' THEN 15 + (random() * 8)::int
    WHEN gp.city = 'Pune' THEN 12 + (random() * 6)::int
    ELSE 10 + (random() * 5)::int
  END,
  CASE 
    WHEN gp.city = 'Mumbai' THEN 20 + (random() * 12)::int
    WHEN gp.city = 'New Delhi' THEN 18 + (random() * 8)::int
    WHEN gp.city = 'Bangalore' THEN 19 + (random() * 10)::int
    WHEN gp.city = 'Chennai' THEN 12 + (random() * 6)::int
    WHEN gp.city = 'Pune' THEN 10 + (random() * 4)::int
    ELSE 8 + (random() * 3)::int
  END,
  CASE 
    WHEN gp.city = 'Mumbai' THEN 18 + (random() * 10)::int
    WHEN gp.city = 'New Delhi' THEN 16 + (random() * 8)::int
    WHEN gp.city = 'Bangalore' THEN 17 + (random() * 9)::int
    WHEN gp.city = 'Chennai' THEN 11 + (random() * 5)::int
    WHEN gp.city = 'Pune' THEN 9 + (random() * 3)::int
    ELSE 7 + (random() * 2)::int
  END,
  CASE 
    WHEN gp.city = 'Mumbai' THEN 17 + (random() * 8)::int
    WHEN gp.city = 'New Delhi' THEN 15 + (random() * 6)::int
    WHEN gp.city = 'Bangalore' THEN 16 + (random() * 7)::int
    WHEN gp.city = 'Chennai' THEN 10 + (random() * 4)::int
    WHEN gp.city = 'Pune' THEN 8 + (random() * 2)::int
    ELSE 6 + (random() * 1)::int
  END,
  CASE 
    WHEN gp.city = 'Mumbai' THEN 22 + (random() * 6)::int
    WHEN gp.city = 'New Delhi' THEN 20 + (random() * 5)::int
    WHEN gp.city = 'Bangalore' THEN 21 + (random() * 6)::int
    WHEN gp.city = 'Chennai' THEN 13 + (random() * 4)::int
    WHEN gp.city = 'Pune' THEN 11 + (random() * 3)::int
    ELSE 9 + (random() * 2)::int
  END,
  -- Calculate rates (completion_rate = completed / assigned)
  CASE 
    WHEN gp.city = 'Mumbai' THEN 0.85 + (random() * 0.1)::numeric(3,2)
    WHEN gp.city = 'New Delhi' THEN 0.80 + (random() * 0.1)::numeric(3,2)
    WHEN gp.city = 'Bangalore' THEN 0.82 + (random() * 0.1)::numeric(3,2)
    WHEN gp.city = 'Chennai' THEN 0.75 + (random() * 0.1)::numeric(3,2)
    WHEN gp.city = 'Pune' THEN 0.70 + (random() * 0.1)::numeric(3,2)
    ELSE 0.65 + (random() * 0.1)::numeric(3,2)
  END,
  -- on_time_completion_rate
  CASE 
    WHEN gp.city = 'Mumbai' THEN 0.80 + (random() * 0.1)::numeric(3,2)
    WHEN gp.city = 'New Delhi' THEN 0.75 + (random() * 0.1)::numeric(3,2)
    WHEN gp.city = 'Bangalore' THEN 0.78 + (random() * 0.1)::numeric(3,2)
    WHEN gp.city = 'Chennai' THEN 0.70 + (random() * 0.1)::numeric(3,2)
    WHEN gp.city = 'Pune' THEN 0.65 + (random() * 0.1)::numeric(3,2)
    ELSE 0.60 + (random() * 0.1)::numeric(3,2)
  END,
  -- qc_pass_rate
  CASE 
    WHEN gp.city = 'Mumbai' THEN 0.90 + (random() * 0.05)::numeric(3,2)
    WHEN gp.city = 'New Delhi' THEN 0.88 + (random() * 0.05)::numeric(3,2)
    WHEN gp.city = 'Bangalore' THEN 0.89 + (random() * 0.05)::numeric(3,2)
    WHEN gp.city = 'Chennai' THEN 0.85 + (random() * 0.05)::numeric(3,2)
    WHEN gp.city = 'Pune' THEN 0.82 + (random() * 0.05)::numeric(3,2)
    ELSE 0.80 + (random() * 0.05)::numeric(3,2)
  END,
  -- acceptance_rate
  CASE 
    WHEN gp.city = 'Mumbai' THEN 0.85 + (random() * 0.1)::numeric(3,2)
    WHEN gp.city = 'New Delhi' THEN 0.80 + (random() * 0.1)::numeric(3,2)
    WHEN gp.city = 'Bangalore' THEN 0.82 + (random() * 0.1)::numeric(3,2)
    WHEN gp.city = 'Chennai' THEN 0.75 + (random() * 0.1)::numeric(3,2)
    WHEN gp.city = 'Pune' THEN 0.70 + (random() * 0.1)::numeric(3,2)
    ELSE 0.65 + (random() * 0.1)::numeric(3,2)
  END,
  -- overall_score (weighted average)
  CASE 
    WHEN gp.city = 'Mumbai' THEN 0.85 + (random() * 0.1)::numeric(3,2)
    WHEN gp.city = 'New Delhi' THEN 0.80 + (random() * 0.1)::numeric(3,2)
    WHEN gp.city = 'Bangalore' THEN 0.82 + (random() * 0.1)::numeric(3,2)
    WHEN gp.city = 'Chennai' THEN 0.75 + (random() * 0.1)::numeric(3,2)
    WHEN gp.city = 'Pune' THEN 0.70 + (random() * 0.1)::numeric(3,2)
    ELSE 0.65 + (random() * 0.1)::numeric(3,2)
  END,
  now(),
  now(),
  now()
FROM public.gig_partners gp
WHERE gp.is_active = true
ON CONFLICT (gig_partner_id) DO NOTHING;

-- Verify the data was inserted
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
