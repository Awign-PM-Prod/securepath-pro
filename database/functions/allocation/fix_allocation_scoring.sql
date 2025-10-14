-- Fix Allocation Scoring to Prioritize Highest Performance
-- This script updates the scoring weights to prioritize quality score more heavily

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

-- Step 5: Show sample performance data to verify scoring
SELECT 
  'Sample Performance Data for Scoring' as info,
  pm.gig_partner_id,
  p.first_name,
  p.last_name,
  pm.quality_score,
  pm.completion_rate,
  pm.ontime_completion_rate,
  pm.acceptance_rate,
  -- Calculate expected score with new weights (quality as primary sort + weighted performance)
  ROUND(
    (pm.quality_score * 1000) + 
    (pm.completion_rate * 0.4) + 
    (pm.ontime_completion_rate * 0.4) + 
    (pm.acceptance_rate * 0.2), 
    4
  ) as expected_score
FROM public.performance_metrics pm
JOIN public.gig_partners gp ON pm.gig_partner_id = gp.id
JOIN public.profiles p ON gp.profile_id = p.id
WHERE gp.is_active = true
ORDER BY expected_score DESC
LIMIT 10;
