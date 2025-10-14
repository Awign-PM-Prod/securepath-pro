-- =====================================================
-- Update Allocation Scoring System
-- Quality Score as Primary Sort + Weighted Performance Metrics
-- =====================================================

-- Step 1: Check current scoring weights
SELECT 
  'Current Scoring Weights' as info,
  config_key,
  config_value
FROM public.allocation_config
WHERE config_key = 'scoring_weights';

-- Step 2: Update scoring weights to new performance-based system
UPDATE public.allocation_config 
SET 
  config_value = '{"quality_score": 0.0, "completion_rate": 0.4, "ontime_completion_rate": 0.4, "acceptance_rate": 0.2}',
  updated_at = now()
WHERE config_key = 'scoring_weights';

-- Step 3: If no config exists, create one
INSERT INTO public.allocation_config (config_key, config_value, description, updated_by)
SELECT 
  'scoring_weights', 
  '{"quality_score": 0.0, "completion_rate": 0.4, "ontime_completion_rate": 0.4, "acceptance_rate": 0.2}', 
  'New performance-based weights: Quality as primary sort, Completion 40%, On-time 40%, Acceptance 20%', 
  (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.allocation_config WHERE config_key = 'scoring_weights');

-- Step 4: Verify the update
SELECT 
  'Updated Scoring Weights' as info,
  config_key,
  config_value
FROM public.allocation_config
WHERE config_key = 'scoring_weights';

-- Step 5: Update get_allocation_candidates function with new sorting logic
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

-- Step 6: Test the function
SELECT 
  'Testing Updated Function' as info,
  gig_partner_id,
  quality_score,
  completion_rate,
  ontime_completion_rate,
  acceptance_rate,
  capacity_available,
  -- Show calculated weighted performance score
  ROUND(
    (completion_rate * 0.4) + 
    (ontime_completion_rate * 0.4) + 
    (acceptance_rate * 0.2), 
    4
  ) as weighted_performance_score
FROM public.get_allocation_candidates(
  (SELECT id FROM public.cases LIMIT 1),
  '560102',
  'tier_1'::pincode_tier
)
LIMIT 5;

-- Step 7: Show sample performance data with new scoring
SELECT 
  'Sample Performance Data with New Scoring' as info,
  pm.gig_partner_id,
  p.first_name,
  p.last_name,
  pm.quality_score,
  pm.completion_rate,
  pm.ontime_completion_rate,
  pm.acceptance_rate,
  -- Calculate expected score with new system (quality * 10 + weighted performance / 10)
  ROUND(
    (pm.quality_score * 10) + 
    ((pm.completion_rate * 0.4 + pm.ontime_completion_rate * 0.4 + pm.acceptance_rate * 0.2) / 10), 
    4
  ) as expected_score,
  -- Show just the weighted performance component
  ROUND(
    (pm.completion_rate * 0.4) + 
    (pm.ontime_completion_rate * 0.4) + 
    (pm.acceptance_rate * 0.2), 
    4
  ) as weighted_performance
FROM public.performance_metrics pm
JOIN public.gig_partners gp ON pm.gig_partner_id = gp.id
JOIN public.profiles p ON gp.profile_id = p.id
WHERE gp.is_active = true
ORDER BY 
  pm.quality_score DESC,
  (pm.completion_rate * 0.4 + pm.ontime_completion_rate * 0.4 + pm.acceptance_rate * 0.2) DESC
LIMIT 10;
