-- =====================================================
-- Fix Pincode Matching Logic in Allocation
-- =====================================================

-- This script fixes the allocation logic to properly match case pincodes with worker coverage

-- Step 1: Check current allocation function
SELECT 
  'Current Function Definition' as info,
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'get_allocation_candidates' 
AND routine_schema = 'public';

-- Step 2: Check what pincodes workers actually cover
SELECT 
  'Worker Coverage Pincodes' as info,
  p.email,
  gp.coverage_pincodes,
  array_length(gp.coverage_pincodes, 1) as coverage_count
FROM public.profiles p
JOIN public.gig_partners gp ON p.id = gp.profile_id
WHERE gp.is_active = true
ORDER BY p.email;

-- Step 3: Check what pincodes cases are in
SELECT 
  'Case Pincodes' as info,
  c.case_number,
  l.pincode,
  l.pincode_tier,
  c.status,
  c.current_assignee_id
FROM public.cases c
JOIN public.locations l ON c.location_id = l.id
WHERE c.status IN ('created', 'auto_allocated', 'accepted', 'in_progress', 'submitted')
ORDER BY l.pincode;

-- Step 4: Fix the get_allocation_candidates function with proper pincode matching
DROP FUNCTION IF EXISTS public.get_allocation_candidates(uuid, text, pincode_tier);

CREATE OR REPLACE FUNCTION public.get_allocation_candidates(
  p_case_id uuid,
  p_pincode text,
  p_pincode_tier pincode_tier
)
RETURNS TABLE (
  gig_partner_id uuid,
  assignment_type text,
  quality_score numeric,
  completion_rate numeric,
  ontime_completion_rate numeric,
  acceptance_rate numeric,
  capacity_available integer,
  max_daily_capacity integer,
  coverage_pincodes text[],
  last_assignment_at timestamp with time zone
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gp.id as gig_partner_id,
    'gig'::text as assignment_type,
    COALESCE(pm.quality_score, 0.0000) as quality_score,
    COALESCE(pm.completion_rate, 0.0000) as completion_rate,
    COALESCE(pm.ontime_completion_rate, 0.0000) as ontime_completion_rate,
    COALESCE(pm.acceptance_rate, 0.0000) as acceptance_rate,
    gp.capacity_available,
    gp.max_daily_capacity,
    gp.coverage_pincodes,
    gp.last_assignment_at
  FROM public.gig_partners gp
  INNER JOIN public.profiles p ON gp.profile_id = p.id
  INNER JOIN public.performance_metrics pm ON gp.id = pm.gig_partner_id
  WHERE gp.is_active = true
    AND gp.is_available = true
    AND gp.capacity_available > 0  -- Must have available capacity
    AND p_pincode = ANY(gp.coverage_pincodes)  -- CRITICAL: Case pincode must be in worker's coverage
    AND (pm.period_end >= CURRENT_DATE - INTERVAL '30 days' OR pm.period_end IS NULL)  -- Recent performance data
    -- Double-check that actual assigned cases don't exceed capacity
    AND (SELECT COUNT(*)::integer 
         FROM public.cases c 
         WHERE c.current_assignee_id = gp.id
         AND c.status IN ('auto_allocated', 'accepted', 'in_progress', 'submitted')
        ) < gp.max_daily_capacity
  ORDER BY 
    (COALESCE(pm.quality_score, 0.0000) * 0.35 + 
     COALESCE(pm.completion_rate, 0.0000) * 0.25 + 
     COALESCE(pm.ontime_completion_rate, 0.0000) * 0.25 + 
     COALESCE(pm.acceptance_rate, 0.0000) * 0.15) DESC,
    gp.capacity_available DESC,  -- Prefer workers with more available capacity
    gp.last_assignment_at ASC NULLS FIRST;  -- Prefer workers who haven't been assigned recently
END;
$$;

-- Step 5: Test the fixed function with a specific pincode
SELECT 
  'Fixed Function Test' as info,
  p.email,
  ac.gig_partner_id,
  ac.capacity_available,
  ac.max_daily_capacity,
  ac.coverage_pincodes,
  ROUND(ac.quality_score * 100, 1) as quality_score_pct,
  CASE 
    WHEN '400058' = ANY(ac.coverage_pincodes) THEN 'COVERS_PINCODE'
    ELSE 'DOES_NOT_COVER'
  END as pincode_coverage
FROM public.get_allocation_candidates(
  gen_random_uuid(), -- dummy case_id
  '400058', -- test pincode
  'tier_1'::pincode_tier
) ac
JOIN public.gig_partners gp ON ac.gig_partner_id = gp.id
JOIN public.profiles p ON gp.profile_id = p.id
ORDER BY ac.quality_score DESC;

-- Step 6: Test with different pincodes to verify coverage
SELECT 
  'Pincode Coverage Test' as info,
  test_pincode,
  COUNT(*) as eligible_workers,
  STRING_AGG(worker_email, ', ') as worker_emails
FROM (
  SELECT '400058' as test_pincode
  UNION ALL SELECT '560001'
  UNION ALL SELECT '110001'
  UNION ALL SELECT '700001'
) test_pincodes
CROSS JOIN LATERAL (
  SELECT p.email as worker_email
  FROM public.get_allocation_candidates(
    gen_random_uuid(),
    test_pincodes.test_pincode,
    'tier_1'::pincode_tier
  ) ac
  JOIN public.gig_partners gp ON ac.gig_partner_id = gp.id
  JOIN public.profiles p ON gp.profile_id = p.id
) workers
GROUP BY test_pincode
ORDER BY test_pincode;

-- Step 7: Show detailed coverage analysis
SELECT 
  'Detailed Coverage Analysis' as info,
  p.email,
  gp.coverage_pincodes,
  CASE 
    WHEN '400058' = ANY(gp.coverage_pincodes) THEN 'COVERS_400058'
    ELSE 'DOES_NOT_COVER_400058'
  END as covers_test_pincode,
  gp.capacity_available,
  gp.max_daily_capacity
FROM public.profiles p
JOIN public.gig_partners gp ON p.id = gp.profile_id
WHERE gp.is_active = true
ORDER BY covers_test_pincode DESC, p.email;
