-- =====================================================
-- Test Allocation Engine
-- Background Verification Platform - Test Script
-- =====================================================

-- This script tests the complete allocation engine functionality
-- Run this after setting up the database with all migrations

-- =====================================================
-- 1. SETUP TEST DATA
-- =====================================================

-- Create test gig workers with different performance profiles
INSERT INTO public.gig_partners (
  user_id,
  profile_id,
  phone,
  address,
  city,
  state,
  pincode,
  country,
  coverage_pincodes,
  max_daily_capacity,
  capacity_available,
  completion_rate,
  ontime_completion_rate,
  acceptance_rate,
  quality_score,
  is_active,
  is_available,
  created_by
) VALUES 
-- High performer
(
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM public.profiles LIMIT 1),
  '+91-9876543210',
  '123 High Street',
  'Mumbai',
  'Maharashtra',
  '400001',
  'India',
  ARRAY['400001', '400002', '400003'],
  5,
  5,
  0.95,
  0.90,
  0.85,
  0.92,
  true,
  true,
  (SELECT id FROM auth.users LIMIT 1)
),
-- Medium performer
(
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM public.profiles LIMIT 1),
  '+91-9876543211',
  '456 Medium Avenue',
  'Delhi',
  'Delhi',
  '110001',
  'India',
  ARRAY['110001', '110002', '110003'],
  3,
  3,
  0.80,
  0.75,
  0.70,
  0.85,
  true,
  true,
  (SELECT id FROM auth.users LIMIT 1)
),
-- Low performer
(
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM public.profiles LIMIT 1),
  '+91-9876543212',
  '789 Low Road',
  'Bangalore',
  'Karnataka',
  '560001',
  'India',
  ARRAY['560001', '560002'],
  2,
  2,
  0.60,
  0.55,
  0.50,
  0.70,
  true,
  true,
  (SELECT id FROM auth.users LIMIT 1)
);

-- Create test cases for allocation
INSERT INTO public.cases (
  case_number,
  title,
  description,
  priority,
  client_id,
  location_id,
  tat_hours,
  due_at,
  status,
  created_by
) VALUES 
(
  'CASE-001',
  'Test Case 1 - High Priority',
  'Test case for allocation engine',
  'high',
  (SELECT id FROM public.clients LIMIT 1),
  (SELECT id FROM public.locations LIMIT 1),
  24,
  NOW() + INTERVAL '24 hours',
  'created',
  (SELECT id FROM auth.users LIMIT 1)
),
(
  'CASE-002',
  'Test Case 2 - Medium Priority',
  'Test case for allocation engine',
  'medium',
  (SELECT id FROM public.clients LIMIT 1),
  (SELECT id FROM public.locations LIMIT 1),
  48,
  NOW() + INTERVAL '48 hours',
  'created',
  (SELECT id FROM auth.users LIMIT 1)
);

-- Initialize capacity tracking for today
INSERT INTO public.capacity_tracking (
  gig_partner_id,
  date,
  max_daily_capacity,
  initial_capacity_available,
  current_capacity_available,
  is_active,
  created_at
) 
SELECT 
  gp.id,
  CURRENT_DATE,
  gp.max_daily_capacity,
  gp.capacity_available,
  gp.capacity_available,
  true,
  NOW()
FROM public.gig_partners gp
WHERE gp.is_active = true
ON CONFLICT (gig_partner_id, date) DO NOTHING;

-- =====================================================
-- 2. TEST ALLOCATION CONFIGURATION
-- =====================================================

-- Set up allocation configuration
INSERT INTO public.allocation_config (
  config_key,
  config_value,
  description,
  is_active,
  updated_by
) VALUES 
(
  'scoring_weights',
  '{"quality_score": 0.35, "completion_rate": 0.25, "ontime_completion_rate": 0.25, "acceptance_rate": 0.15}',
  'Scoring weights for allocation engine',
  true,
  (SELECT id FROM auth.users LIMIT 1)
),
(
  'acceptance_window',
  '{"minutes": 30, "nudge_after_minutes": 15, "max_waves": 3}',
  'Acceptance window configuration',
  true,
  (SELECT id FROM auth.users LIMIT 1)
),
(
  'capacity_rules',
  '{"consume_on": "accepted", "free_on": "submitted", "reset_time": "06:00", "max_daily_capacity": 10}',
  'Capacity management rules',
  true,
  (SELECT id FROM auth.users LIMIT 1)
),
(
  'quality_thresholds',
  '{"min_quality_score": 0.6, "min_completion_rate": 0.5, "min_acceptance_rate": 0.4}',
  'Minimum quality thresholds for allocation',
  true,
  (SELECT id FROM auth.users LIMIT 1)
)
ON CONFLICT (config_key) DO UPDATE SET
  config_value = EXCLUDED.config_value,
  updated_at = NOW();

-- =====================================================
-- 3. TEST ALLOCATION ENGINE FUNCTIONS
-- =====================================================

-- Test case allocation function
SELECT 
  'Testing allocation engine functions...' as test_status;

-- Test get_case_defaults function
SELECT 
  'Testing get_case_defaults function...' as test_status,
  get_case_defaults(
    (SELECT id FROM public.clients LIMIT 1),
    'residential_address_check',
    (SELECT id FROM public.locations LIMIT 1)
  ) as case_defaults;

-- Test get_location_from_pincode function
SELECT 
  'Testing get_location_from_pincode function...' as test_status,
  get_location_from_pincode('400001') as location_data;

-- =====================================================
-- 4. TEST CAPACITY TRACKING
-- =====================================================

-- Test capacity overview
SELECT 
  'Testing capacity tracking...' as test_status,
  ct.gig_partner_id,
  ct.max_daily_capacity,
  ct.current_capacity_available,
  gp.profiles.first_name,
  gp.profiles.last_name,
  gp.quality_score,
  gp.completion_rate
FROM public.capacity_tracking ct
JOIN public.gig_partners gp ON ct.gig_partner_id = gp.id
JOIN public.profiles ON gp.profile_id = profiles.id
WHERE ct.date = CURRENT_DATE
ORDER BY ct.current_capacity_available DESC;

-- =====================================================
-- 5. TEST ALLOCATION SCORING
-- =====================================================

-- Test scoring calculation for each gig worker
SELECT 
  'Testing allocation scoring...' as test_status,
  gp.id as gig_partner_id,
  p.first_name,
  p.last_name,
  gp.quality_score,
  gp.completion_rate,
  gp.ontime_completion_rate,
  gp.acceptance_rate,
  -- Calculate weighted score
  (
    gp.quality_score * 0.35 +
    gp.completion_rate * 0.25 +
    gp.ontime_completion_rate * 0.25 +
    gp.acceptance_rate * 0.15
  ) as calculated_score,
  ct.current_capacity_available,
  array_length(gp.coverage_pincodes, 1) as coverage_count
FROM public.gig_partners gp
JOIN public.profiles p ON gp.profile_id = p.id
LEFT JOIN public.capacity_tracking ct ON gp.id = ct.gig_partner_id AND ct.date = CURRENT_DATE
WHERE gp.is_active = true
ORDER BY calculated_score DESC;

-- =====================================================
-- 6. TEST ALLOCATION LOGIC
-- =====================================================

-- Simulate allocation for a test case
WITH test_case AS (
  SELECT 
    c.id as case_id,
    c.case_number,
    l.pincode,
    pt.tier as pincode_tier
  FROM public.cases c
  JOIN public.locations l ON c.location_id = l.id
  LEFT JOIN public.pincode_tiers pt ON l.pincode = pt.pincode
  WHERE c.case_number = 'CASE-001'
),
eligible_workers AS (
  SELECT 
    gp.id as gig_partner_id,
    gp.quality_score,
    gp.completion_rate,
    gp.ontime_completion_rate,
    gp.acceptance_rate,
    ct.current_capacity_available,
    gp.coverage_pincodes,
    -- Check if worker covers the case pincode
    CASE 
      WHEN tc.pincode = ANY(gp.coverage_pincodes) THEN true 
      ELSE false 
    END as covers_pincode,
    -- Calculate weighted score
    (
      gp.quality_score * 0.35 +
      gp.completion_rate * 0.25 +
      gp.ontime_completion_rate * 0.25 +
      gp.acceptance_rate * 0.15
    ) as final_score
  FROM public.gig_partners gp
  JOIN public.capacity_tracking ct ON gp.id = ct.gig_partner_id
  CROSS JOIN test_case tc
  WHERE gp.is_active = true 
    AND gp.is_available = true
    AND ct.current_capacity_available > 0
    AND ct.date = CURRENT_DATE
    AND tc.pincode = ANY(gp.coverage_pincodes)
    AND gp.quality_score >= 0.6
    AND gp.completion_rate >= 0.5
    AND gp.acceptance_rate >= 0.4
)
SELECT 
  'Testing allocation logic...' as test_status,
  ew.gig_partner_id,
  ew.final_score,
  ew.current_capacity_available,
  ew.covers_pincode,
  ROW_NUMBER() OVER (ORDER BY ew.final_score DESC) as rank
FROM eligible_workers ew
ORDER BY ew.final_score DESC;

-- =====================================================
-- 7. TEST ALLOCATION SCENARIOS
-- =====================================================

-- Scenario 1: High capacity, high performance worker
SELECT 
  'Scenario 1: High performance allocation' as scenario,
  gp.id as worker_id,
  p.first_name,
  p.last_name,
  gp.quality_score,
  gp.completion_rate,
  ct.current_capacity_available,
  CASE 
    WHEN gp.quality_score >= 0.9 AND gp.completion_rate >= 0.9 AND ct.current_capacity_available >= 3 
    THEN 'ELIGIBLE - HIGH PRIORITY'
    ELSE 'NOT ELIGIBLE'
  END as allocation_status
FROM public.gig_partners gp
JOIN public.profiles p ON gp.profile_id = p.id
JOIN public.capacity_tracking ct ON gp.id = ct.gig_partner_id
WHERE ct.date = CURRENT_DATE
ORDER BY gp.quality_score DESC, gp.completion_rate DESC;

-- Scenario 2: Capacity constraints
SELECT 
  'Scenario 2: Capacity constraints' as scenario,
  gp.id as worker_id,
  p.first_name,
  p.last_name,
  ct.current_capacity_available,
  ct.max_daily_capacity,
  ROUND((ct.current_capacity_available::float / ct.max_daily_capacity::float) * 100, 2) as capacity_percentage,
  CASE 
    WHEN ct.current_capacity_available = 0 THEN 'FULLY UTILIZED'
    WHEN ct.current_capacity_available <= 1 THEN 'NEARLY FULL'
    WHEN ct.current_capacity_available >= 3 THEN 'AVAILABLE'
    ELSE 'MODERATE'
  END as capacity_status
FROM public.gig_partners gp
JOIN public.profiles p ON gp.profile_id = p.id
JOIN public.capacity_tracking ct ON gp.id = ct.gig_partner_id
WHERE ct.date = CURRENT_DATE
ORDER BY ct.current_capacity_available ASC;

-- Scenario 3: Coverage area matching
SELECT 
  'Scenario 3: Coverage area matching' as scenario,
  gp.id as worker_id,
  p.first_name,
  p.last_name,
  gp.coverage_pincodes,
  array_length(gp.coverage_pincodes, 1) as coverage_count,
  CASE 
    WHEN array_length(gp.coverage_pincodes, 1) >= 5 THEN 'WIDE COVERAGE'
    WHEN array_length(gp.coverage_pincodes, 1) >= 3 THEN 'MODERATE COVERAGE'
    ELSE 'LIMITED COVERAGE'
  END as coverage_status
FROM public.gig_partners gp
JOIN public.profiles p ON gp.profile_id = p.id
WHERE gp.is_active = true
ORDER BY array_length(gp.coverage_pincodes, 1) DESC;

-- =====================================================
-- 8. TEST ALLOCATION ENGINE INTEGRATION
-- =====================================================

-- Test the complete allocation flow
SELECT 
  'Testing complete allocation flow...' as test_status,
  'Allocation engine is ready for testing' as result;

-- =====================================================
-- 9. CLEANUP (Optional - uncomment to clean up test data)
-- =====================================================

-- Uncomment the following lines to clean up test data
-- DELETE FROM public.capacity_tracking WHERE date = CURRENT_DATE;
-- DELETE FROM public.cases WHERE case_number LIKE 'CASE-%';
-- DELETE FROM public.gig_partners WHERE phone LIKE '+91-987654321%';

-- =====================================================
-- SUMMARY
-- =====================================================

SELECT 
  'Allocation Engine Test Complete' as status,
  'Check the results above to verify allocation engine functionality' as message;
