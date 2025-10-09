-- =====================================================
-- Test Allocation System
-- =====================================================

-- This script tests the allocation system after running setup_test_data_clean.sql

-- Step 1: Verify test data was created
SELECT '=== VERIFICATION ===' as status;

-- Check gig workers
SELECT 
  'Gig Workers' as entity,
  COUNT(*) as count,
  SUM(max_daily_capacity) as total_capacity,
  SUM(capacity_available) as available_capacity
FROM public.gig_partners 
WHERE is_active = true;

-- Check cases
SELECT 
  'Cases' as entity,
  COUNT(*) as count,
  COUNT(CASE WHEN status = 'created' THEN 1 END) as unallocated_cases
FROM public.cases;

-- Check performance metrics
SELECT 
  'Performance Metrics' as entity,
  COUNT(*) as count,
  AVG(quality_score) as avg_quality_score,
  AVG(completion_rate) as avg_completion_rate
FROM public.performance_metrics;

-- Check capacity tracking
SELECT 
  'Capacity Tracking' as entity,
  COUNT(*) as count,
  SUM(current_capacity_available) as total_available_capacity
FROM public.capacity_tracking 
WHERE date = CURRENT_DATE;

-- Step 2: Test allocation configuration
SELECT '=== ALLOCATION CONFIG ===' as status;

-- Check allocation config
SELECT 
  config_key,
  config_value,
  description
FROM public.allocation_config
ORDER BY config_key;

-- Step 3: Test allocation candidates query
SELECT '=== ALLOCATION CANDIDATES ===' as status;

-- Test the get_allocation_candidates function
SELECT 
  gp.id as gig_partner_id,
  p.first_name || ' ' || p.last_name as name,
  gp.city,
  gp.max_daily_capacity,
  gp.capacity_available,
  pm.quality_score,
  pm.completion_rate,
  pm.ontime_completion_rate,
  pm.acceptance_rate
FROM public.gig_partners gp
JOIN public.profiles p ON gp.profile_id = p.id
LEFT JOIN public.performance_metrics pm ON gp.id = pm.gig_partner_id 
  AND (pm.period_end >= CURRENT_DATE - INTERVAL '30 days' OR pm.period_end IS NULL)
WHERE gp.is_active = true 
  AND gp.is_available = true
  AND gp.capacity_available > 0
ORDER BY pm.quality_score DESC NULLS LAST, gp.capacity_available DESC;

-- Step 4: Test case allocation readiness
SELECT '=== CASE ALLOCATION READINESS ===' as status;

-- Check cases ready for allocation
SELECT 
  c.id,
  c.case_number,
  c.client_case_id,
  l.pincode,
  l.pincode_tier,
  cl.name as client_name,
  cc.contract_type
FROM public.cases c
JOIN public.locations l ON c.location_id = l.id
JOIN public.clients cl ON c.client_id = cl.id
JOIN public.client_contracts cc ON c.client_contract_id = cc.id
WHERE c.status = 'created'
  AND c.current_assignee_id IS NULL
ORDER BY l.pincode_tier, c.created_at;

-- Step 5: Test allocation engine with sample case
SELECT '=== SAMPLE ALLOCATION TEST ===' as status;

-- Get a sample case for testing
WITH sample_case AS (
  SELECT 
    c.id as case_id,
    l.pincode,
    l.pincode_tier,
    cc.contract_type
  FROM public.cases c
  JOIN public.locations l ON c.location_id = l.id
  JOIN public.client_contracts cc ON c.client_contract_id = cc.id
  WHERE c.status = 'created'
    AND c.current_assignee_id IS NULL
  LIMIT 1
)
SELECT 
  sc.case_id,
  sc.pincode,
  sc.pincode_tier,
  sc.contract_type,
  gp.id as potential_assignee,
  p.first_name || ' ' || p.last_name as assignee_name,
  gp.capacity_available,
  pm.quality_score,
  pm.completion_rate
FROM sample_case sc
CROSS JOIN public.gig_partners gp
JOIN public.profiles p ON gp.profile_id = p.id
LEFT JOIN public.performance_metrics pm ON gp.id = pm.gig_partner_id
WHERE gp.is_active = true 
  AND gp.is_available = true
  AND gp.capacity_available > 0
  AND (sc.pincode = ANY(gp.coverage_pincodes) OR sc.pincode = gp.pincode)
ORDER BY pm.quality_score DESC NULLS LAST, gp.capacity_available DESC
LIMIT 5;

-- Step 6: Summary
SELECT '=== SUMMARY ===' as status;

SELECT 
  'Ready for Testing' as status,
  CASE 
    WHEN (SELECT COUNT(*) FROM public.gig_partners WHERE is_active = true) > 0 
    AND (SELECT COUNT(*) FROM public.cases WHERE status = 'created') > 0
    AND (SELECT COUNT(*) FROM public.performance_metrics) > 0
    THEN 'YES - All systems ready'
    ELSE 'NO - Missing data'
  END as allocation_ready;
