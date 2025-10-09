-- =====================================================
-- Add Missing Performance Data
-- =====================================================

-- This script adds performance metrics for gig workers who don't have any data
-- so they can participate in the allocation system

-- Step 1: Find workers without performance data
SELECT 
  'Workers without performance data' as info,
  gp.id,
  p.first_name || ' ' || p.last_name as name,
  gp.capacity_available
FROM public.gig_partners gp
JOIN public.profiles p ON gp.profile_id = p.id
LEFT JOIN public.performance_metrics pm ON gp.id = pm.gig_partner_id 
  AND (pm.period_end >= CURRENT_DATE - INTERVAL '30 days' OR pm.period_end IS NULL)
WHERE gp.is_active = true
  AND pm.id IS NULL;

-- Step 2: Add performance metrics for workers without data
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
  5, -- total_cases_assigned (low number for new workers)
  4, -- total_cases_completed (80% completion rate)
  3, -- total_cases_on_time (60% on-time rate)
  3, -- total_cases_qc_passed (60% QC pass rate)
  4, -- total_cases_accepted (80% acceptance rate)
  0.80, -- completion_rate (80%)
  0.60, -- ontime_completion_rate (60%)
  0.80, -- acceptance_rate (80%)
  0.60, -- quality_score (60% - lower for new workers)
  now(),
  now()
FROM public.gig_partners gp
JOIN public.profiles p ON gp.profile_id = p.id
LEFT JOIN public.performance_metrics pm ON gp.id = pm.gig_partner_id 
  AND (pm.period_end >= CURRENT_DATE - INTERVAL '30 days' OR pm.period_end IS NULL)
WHERE gp.is_active = true
  AND pm.id IS NULL;

-- Step 3: Verify all workers now have performance data
SELECT 
  'All workers with performance data' as info,
  gp.id,
  p.first_name || ' ' || p.last_name as name,
  pm.quality_score,
  pm.completion_rate,
  pm.ontime_completion_rate,
  pm.acceptance_rate,
  gp.capacity_available
FROM public.gig_partners gp
JOIN public.profiles p ON gp.profile_id = p.id
JOIN public.performance_metrics pm ON gp.id = pm.gig_partner_id 
  AND (pm.period_end >= CURRENT_DATE - INTERVAL '30 days' OR pm.period_end IS NULL)
WHERE gp.is_active = true
ORDER BY pm.quality_score DESC;

-- Step 4: Test allocation candidates function
SELECT 
  'Allocation candidates for pincode 400058' as info,
  gig_partner_id,
  assignment_type,
  quality_score,
  completion_rate,
  ontime_completion_rate,
  acceptance_rate,
  capacity_available
FROM public.get_allocation_candidates(
  gen_random_uuid(), -- dummy case_id
  '400058', -- test pincode
  'tier_1'::pincode_tier
)
ORDER BY quality_score DESC;
