-- Fix Performance Data for Allocation Summary
-- This script ensures all gig workers have performance data

-- Step 1: Check current performance data
SELECT 
  'Current Performance Data Count' as info,
  COUNT(*) as total_records
FROM public.performance_metrics;

-- Step 2: Check gig workers without performance data
SELECT 
  'Gig Workers Without Performance Data' as info,
  COUNT(*) as workers_without_data
FROM public.gig_partners gp
WHERE gp.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.performance_metrics pm 
    WHERE pm.gig_partner_id = gp.id
  );

-- Step 3: Insert performance data for workers without any
INSERT INTO public.performance_metrics (
  gig_partner_id,
  period_start,
  period_end,
  quality_score,
  completion_rate,
  ontime_completion_rate,
  acceptance_rate,
  total_cases_assigned,
  total_cases_accepted,
  total_cases_completed,
  total_cases_on_time,
  total_cases_qc_passed
)
SELECT 
  gp.id,
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE,
  COALESCE(gp.quality_score, 0.6),
  COALESCE(gp.completion_rate, 0.7),
  COALESCE(gp.ontime_completion_rate, 0.8),
  COALESCE(gp.acceptance_rate, 0.9),
  COALESCE(gp.total_cases_completed, 0),
  COALESCE(gp.total_cases_completed, 0),
  COALESCE(gp.total_cases_completed, 0),
  COALESCE(gp.total_cases_completed, 0),
  COALESCE(gp.qc_pass_count, 0)
FROM public.gig_partners gp
WHERE gp.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.performance_metrics pm 
    WHERE pm.gig_partner_id = gp.id
  );

-- Step 4: Verify the fix
SELECT 
  'After Fix - Performance Data Count' as info,
  COUNT(*) as total_records
FROM public.performance_metrics;

-- Step 5: Show sample performance data
SELECT 
  'Sample Performance Data' as info,
  pm.gig_partner_id,
  p.first_name,
  p.last_name,
  pm.quality_score,
  pm.completion_rate,
  pm.ontime_completion_rate,
  pm.acceptance_rate
FROM public.performance_metrics pm
JOIN public.gig_partners gp ON pm.gig_partner_id = gp.id
JOIN public.profiles p ON gp.profile_id = p.id
ORDER BY pm.quality_score DESC
LIMIT 5;
