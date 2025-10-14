-- =====================================================
-- Fix Allocation Capacity Validation
-- =====================================================

-- First, let's check the current get_allocation_candidates function
SELECT 
  'Current Function Definition' as info,
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'get_allocation_candidates' 
AND routine_schema = 'public';

-- Check what the function currently returns for test5@worker.com
SELECT 
  'Current Function Result' as info,
  gig_partner_id,
  assignment_type,
  ROUND(quality_score * 100, 1) as quality_score_pct,
  ROUND(completion_rate * 100, 1) as completion_rate_pct,
  capacity_available,
  max_daily_capacity,
  CASE 
    WHEN capacity_available > 0 THEN 'SHOULD_BE_ELIGIBLE'
    ELSE 'SHOULD_BE_EXCLUDED'
  END as eligibility_status
FROM public.get_allocation_candidates(
  gen_random_uuid(), -- dummy case_id
  '400058', -- test pincode
  'tier_1'::pincode_tier
)
WHERE gig_partner_id IN (
  SELECT gp.id 
  FROM public.profiles p
  JOIN public.gig_partners gp ON p.id = gp.profile_id
  WHERE p.email = 'test5@worker.com'
);

-- Now let's fix the get_allocation_candidates function to properly validate capacity
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
    AND gp.capacity_available > 0  -- CRITICAL: Only include workers with available capacity
    AND p_pincode = ANY(gp.coverage_pincodes)  -- Pincode must be in coverage area
    AND (pm.period_end >= CURRENT_DATE - INTERVAL '30 days' OR pm.period_end IS NULL)  -- Recent performance data
  ORDER BY 
    (COALESCE(pm.quality_score, 0.0000) * 0.35 + 
     COALESCE(pm.completion_rate, 0.0000) * 0.25 + 
     COALESCE(pm.ontime_completion_rate, 0.0000) * 0.25 + 
     COALESCE(pm.acceptance_rate, 0.0000) * 0.15) DESC,
    gp.capacity_available DESC,  -- Prefer workers with more available capacity
    gp.last_assignment_at ASC NULLS FIRST;  -- Prefer workers who haven't been assigned recently
END;
$$;

-- Test the fixed function
SELECT 
  'Fixed Function Result' as info,
  gig_partner_id,
  assignment_type,
  ROUND(quality_score * 100, 1) as quality_score_pct,
  ROUND(completion_rate * 100, 1) as completion_rate_pct,
  capacity_available,
  max_daily_capacity,
  CASE 
    WHEN capacity_available > 0 THEN 'ELIGIBLE'
    ELSE 'EXCLUDED'
  END as eligibility_status
FROM public.get_allocation_candidates(
  gen_random_uuid(), -- dummy case_id
  '400058', -- test pincode
  'tier_1'::pincode_tier
)
WHERE gig_partner_id IN (
  SELECT gp.id 
  FROM public.profiles p
  JOIN public.gig_partners gp ON p.id = gp.profile_id
  WHERE p.email = 'test5@worker.com'
);

-- Show all candidates for the test pincode
SELECT 
  'All Candidates for Test Pincode' as info,
  p.email,
  gig_partner_id,
  capacity_available,
  max_daily_capacity,
  ROUND(quality_score * 100, 1) as quality_score_pct,
  CASE 
    WHEN capacity_available > 0 THEN 'ELIGIBLE'
    ELSE 'EXCLUDED'
  END as eligibility_status
FROM public.get_allocation_candidates(
  gen_random_uuid(), -- dummy case_id
  '400058', -- test pincode
  'tier_1'::pincode_tier
) ac
JOIN public.gig_partners gp ON ac.gig_partner_id = gp.id
JOIN public.profiles p ON gp.profile_id = p.id
ORDER BY ac.capacity_available DESC, ac.quality_score DESC;
