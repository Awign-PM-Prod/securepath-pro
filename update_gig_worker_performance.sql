-- =====================================================
-- Update Gig Worker Performance Scores
-- =====================================================

-- This script updates performance metrics for all gig workers
-- to enable proper testing of the auto allocation system

-- Step 1: Check current performance data
SELECT 
  'Current Performance Data' as info,
  gp.id,
  p.first_name || ' ' || p.last_name as name,
  pm.quality_score,
  pm.completion_rate,
  pm.ontime_completion_rate,
  pm.acceptance_rate,
  pm.period_start,
  pm.period_end
FROM public.gig_partners gp
JOIN public.profiles p ON gp.profile_id = p.id
LEFT JOIN public.performance_metrics pm ON gp.id = pm.gig_partner_id 
  AND (pm.period_end >= CURRENT_DATE - INTERVAL '30 days' OR pm.period_end IS NULL)
WHERE gp.is_active = true
ORDER BY pm.quality_score DESC NULLS LAST;

-- Step 2: Delete existing performance metrics (if any)
DELETE FROM public.performance_metrics 
WHERE gig_partner_id IN (
  SELECT id FROM public.gig_partners WHERE is_active = true
);

-- Step 3: Insert realistic performance data for all active gig workers
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
  -- Generate realistic case counts based on worker experience
  CASE 
    WHEN gp.created_at < CURRENT_DATE - INTERVAL '30 days' THEN 
      FLOOR(RANDOM() * 20) + 10 -- 10-30 cases for experienced workers
    ELSE 
      FLOOR(RANDOM() * 10) + 5  -- 5-15 cases for newer workers
  END as total_cases_assigned,
  
  -- Generate realistic completion rates (70-95%)
  CASE 
    WHEN gp.created_at < CURRENT_DATE - INTERVAL '30 days' THEN 
      FLOOR(RANDOM() * 20) + 10 -- 10-30 cases
    ELSE 
      FLOOR(RANDOM() * 10) + 5  -- 5-15 cases
  END * (0.70 + RANDOM() * 0.25) as total_cases_completed,
  
  -- Generate realistic on-time completion rates (60-90%)
  CASE 
    WHEN gp.created_at < CURRENT_DATE - INTERVAL '30 days' THEN 
      FLOOR(RANDOM() * 20) + 10
    ELSE 
      FLOOR(RANDOM() * 10) + 5
  END * (0.60 + RANDOM() * 0.30) as total_cases_on_time,
  
  -- Generate realistic QC pass rates (65-95%)
  CASE 
    WHEN gp.created_at < CURRENT_DATE - INTERVAL '30 days' THEN 
      FLOOR(RANDOM() * 20) + 10
    ELSE 
      FLOOR(RANDOM() * 10) + 5
  END * (0.65 + RANDOM() * 0.30) as total_cases_qc_passed,
  
  -- Generate realistic acceptance rates (80-98%)
  CASE 
    WHEN gp.created_at < CURRENT_DATE - INTERVAL '30 days' THEN 
      FLOOR(RANDOM() * 20) + 10
    ELSE 
      FLOOR(RANDOM() * 10) + 5
  END * (0.80 + RANDOM() * 0.18) as total_cases_accepted,
  
  -- Calculate rates (completion rate: 70-95%)
  0.70 + RANDOM() * 0.25 as completion_rate,
  
  -- On-time completion rate: 60-90%
  0.60 + RANDOM() * 0.30 as ontime_completion_rate,
  
  -- Acceptance rate: 80-98%
  0.80 + RANDOM() * 0.18 as acceptance_rate,
  
  -- Quality score: 65-95%
  0.65 + RANDOM() * 0.30 as quality_score,
  
  now(),
  now()
FROM public.gig_partners gp
WHERE gp.is_active = true;

-- Step 4: Verify the updated performance data
SELECT 
  'Updated Performance Data' as info,
  gp.id,
  p.first_name || ' ' || p.last_name as name,
  ROUND(pm.quality_score * 100, 1) as quality_score_pct,
  ROUND(pm.completion_rate * 100, 1) as completion_rate_pct,
  ROUND(pm.ontime_completion_rate * 100, 1) as ontime_rate_pct,
  ROUND(pm.acceptance_rate * 100, 1) as acceptance_rate_pct,
  pm.total_cases_assigned,
  pm.total_cases_completed,
  pm.period_start,
  pm.period_end
FROM public.gig_partners gp
JOIN public.profiles p ON gp.profile_id = p.id
JOIN public.performance_metrics pm ON gp.id = pm.gig_partner_id 
  AND (pm.period_end >= CURRENT_DATE - INTERVAL '30 days' OR pm.period_end IS NULL)
WHERE gp.is_active = true
ORDER BY pm.quality_score DESC;

-- Step 5: Test allocation candidates function
SELECT 
  'Allocation Candidates Test' as info,
  gig_partner_id,
  assignment_type,
  ROUND(quality_score * 100, 1) as quality_score_pct,
  ROUND(completion_rate * 100, 1) as completion_rate_pct,
  ROUND(ontime_completion_rate * 100, 1) as ontime_rate_pct,
  ROUND(acceptance_rate * 100, 1) as acceptance_rate_pct,
  capacity_available
FROM public.get_allocation_candidates(
  gen_random_uuid(), -- dummy case_id
  '400058', -- test pincode
  'tier_1'::pincode_tier
)
ORDER BY quality_score DESC;

-- Step 6: Show summary statistics
SELECT 
  'Performance Summary' as info,
  COUNT(*) as total_workers,
  ROUND(AVG(pm.quality_score) * 100, 1) as avg_quality_score_pct,
  ROUND(AVG(pm.completion_rate) * 100, 1) as avg_completion_rate_pct,
  ROUND(AVG(pm.ontime_completion_rate) * 100, 1) as avg_ontime_rate_pct,
  ROUND(AVG(pm.acceptance_rate) * 100, 1) as avg_acceptance_rate_pct,
  ROUND(MIN(pm.quality_score) * 100, 1) as min_quality_score_pct,
  ROUND(MAX(pm.quality_score) * 100, 1) as max_quality_score_pct
FROM public.performance_metrics pm
JOIN public.gig_partners gp ON pm.gig_partner_id = gp.id
WHERE gp.is_active = true
  AND (pm.period_end >= CURRENT_DATE - INTERVAL '30 days' OR pm.period_end IS NULL);
