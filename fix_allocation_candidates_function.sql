-- Fix get_allocation_candidates function to properly prioritize performance
-- This script updates the database function to ensure highest performers are prioritized

-- Step 1: Check current function definition
SELECT 
  'Current Function Definition' as info,
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'get_allocation_candidates' 
  AND routine_schema = 'public';

-- Step 2: Drop and recreate the function with proper performance prioritization
DROP FUNCTION IF EXISTS public.get_allocation_candidates(uuid, text, pincode_tier);

CREATE OR REPLACE FUNCTION public.get_allocation_candidates(
  p_case_id uuid,
  p_pincode text,
  p_pincode_tier pincode_tier
)
RETURNS TABLE (
  gig_partner_id uuid,
  vendor_id uuid,
  assignment_type text,
  quality_score numeric,
  completion_rate numeric,
  ontime_completion_rate numeric,
  acceptance_rate numeric,
  capacity_available integer,
  max_daily_capacity integer,
  last_assignment_at timestamp with time zone,
  coverage_pincodes text[]
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gp.id as gig_partner_id,
    gp.vendor_id,
    'gig'::text as assignment_type,
    COALESCE(pm.quality_score, 0.0) as quality_score,
    COALESCE(pm.completion_rate, 0.0) as completion_rate,
    COALESCE(pm.ontime_completion_rate, 0.0) as ontime_completion_rate,
    COALESCE(pm.acceptance_rate, 0.0) as acceptance_rate,
    gp.capacity_available,
    gp.max_daily_capacity,
    gp.last_assignment_at,
    gp.coverage_pincodes
  FROM public.gig_partners gp
  LEFT JOIN public.performance_metrics pm ON gp.id = pm.gig_partner_id
  WHERE gp.is_active = true
    AND gp.is_available = true
    AND gp.capacity_available > 0
    AND p_pincode = ANY(gp.coverage_pincodes)
  ORDER BY 
    -- Primary sort: Quality score (highest first)
    COALESCE(pm.quality_score, 0.0) DESC,
    -- Secondary sort: Weighted performance metrics (40% completion, 40% on-time, 20% acceptance)
    (COALESCE(pm.completion_rate, 0.0) * 0.4 + 
     COALESCE(pm.ontime_completion_rate, 0.0) * 0.4 + 
     COALESCE(pm.acceptance_rate, 0.0) * 0.2) DESC,
    -- Tertiary sort: Individual metrics for tie-breaking
    COALESCE(pm.completion_rate, 0.0) DESC,
    COALESCE(pm.ontime_completion_rate, 0.0) DESC,
    COALESCE(pm.acceptance_rate, 0.0) DESC,
    gp.last_assignment_at ASC NULLS FIRST; -- Final tie-breaker: least recently assigned
END;
$$;

-- Step 3: Test the function
SELECT 
  'Testing Function' as info,
  gig_partner_id,
  quality_score,
  completion_rate,
  ontime_completion_rate,
  acceptance_rate,
  capacity_available
FROM public.get_allocation_candidates(
  (SELECT id FROM public.cases LIMIT 1),
  '560102',
  'tier_1'::pincode_tier
)
LIMIT 5;

-- Step 4: Show performance data for verification
SELECT 
  'Performance Data Verification' as info,
  pm.gig_partner_id,
  p.first_name,
  p.last_name,
  pm.quality_score,
  pm.completion_rate,
  pm.ontime_completion_rate,
  pm.acceptance_rate,
  gp.capacity_available,
  gp.max_daily_capacity
FROM public.performance_metrics pm
JOIN public.gig_partners gp ON pm.gig_partner_id = gp.id
JOIN public.profiles p ON gp.profile_id = p.id
WHERE gp.is_active = true
ORDER BY pm.quality_score DESC
LIMIT 10;
