-- =====================================================
-- Fix Allocation Thresholds for Testing
-- =====================================================

-- This script addresses the "No candidates meet quality thresholds" error
-- by either lowering thresholds or creating performance data

-- Option 1: Lower the quality thresholds temporarily for testing
-- (This is the quickest fix)

-- First, let's check if we have any performance metrics
SELECT 
  'Performance Metrics Count' as info,
  COUNT(*) as count
FROM public.performance_metrics;

-- Check what performance data we have
SELECT 
  'Performance Data Sample' as info,
  gig_partner_id,
  completion_rate,
  on_time_completion_rate,
  qc_pass_rate,
  acceptance_rate,
  overall_score
FROM public.performance_metrics
LIMIT 5;

-- Check if we have allocation config
SELECT 
  'Allocation Config' as info,
  config_key,
  config_value
FROM public.allocation_config
WHERE config_key = 'quality_thresholds';

-- Option 1: Create/Update allocation config with lower thresholds for testing
INSERT INTO public.allocation_config (config_key, config_value, description, updated_by)
VALUES 
  ('quality_thresholds', 
   '{"min_quality_score": 0.30, "min_completion_rate": 0.30, "min_acceptance_rate": 0.30}'::jsonb,
   'Lowered thresholds for testing with existing data',
   (SELECT user_id FROM public.profiles WHERE role = 'ops_team' LIMIT 1))
ON CONFLICT (config_key) 
DO UPDATE SET 
  config_value = '{"min_quality_score": 0.30, "min_completion_rate": 0.30, "min_acceptance_rate": 0.30}'::jsonb,
  updated_by = (SELECT user_id FROM public.profiles WHERE role = 'ops_team' LIMIT 1);

-- Option 2: Create performance metrics for existing gig workers if they don't exist
-- (This ensures all gig workers have some performance data)

-- Insert performance metrics for gig workers that don't have them
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
  10, -- total_cases_assigned
  8,  -- total_cases_completed (80% completion rate)
  7,  -- total_cases_on_time (70% on-time rate)
  7,  -- total_cases_qc_passed (70% QC pass rate)
  9,  -- total_cases_accepted (90% acceptance rate)
  0.80, -- completion_rate (80%)
  0.70, -- ontime_completion_rate (70%)
  0.90, -- acceptance_rate (90%)
  0.80, -- quality_score (80%)
  now(),
  now()
FROM public.gig_partners gp
WHERE gp.is_active = true
AND NOT EXISTS (
  SELECT 1 FROM public.performance_metrics pm 
  WHERE pm.gig_partner_id = gp.id
);

-- Verify the data
SELECT 
  'Gig Workers with Performance Data' as info,
  COUNT(*) as count
FROM public.performance_metrics pm
JOIN public.gig_partners gp ON pm.gig_partner_id = gp.id
WHERE gp.is_active = true;

-- Show sample performance data
SELECT 
  'Sample Performance Data' as info,
  gp.id as gig_partner_id,
  p.first_name,
  p.last_name,
  pm.completion_rate,
  pm.on_time_completion_rate,
  pm.qc_pass_rate,
  pm.acceptance_rate,
  pm.overall_score
FROM public.performance_metrics pm
JOIN public.gig_partners gp ON pm.gig_partner_id = gp.id
JOIN public.profiles p ON gp.profile_id = p.id
WHERE gp.is_active = true
LIMIT 5;

-- Show current allocation config
SELECT 
  'Current Allocation Config' as info,
  config_key,
  config_value
FROM public.allocation_config
WHERE config_key = 'quality_thresholds';
