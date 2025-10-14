-- =====================================================
-- Test Allocation Summary
-- =====================================================

-- This script tests the allocation summary functionality

-- Step 1: Check recent allocations
SELECT 
  'Recent Allocations' as info,
  al.case_id,
  al.candidate_id,
  al.candidate_type,
  al.decision,
  al.created_at,
  c.case_number,
  c.status,
  p.first_name || ' ' || p.last_name as assignee_name
FROM public.allocation_logs al
JOIN public.cases c ON al.case_id = c.id
LEFT JOIN public.gig_partners gp ON al.candidate_id = gp.id
LEFT JOIN public.profiles p ON gp.profile_id = p.id
WHERE al.created_at >= CURRENT_DATE - INTERVAL '1 hour'
ORDER BY al.created_at DESC;

-- Step 2: Check cases with current assignees
SELECT 
  'Cases with Assignees' as info,
  c.id,
  c.case_number,
  c.status,
  c.current_assignee_id,
  c.current_assignee_type,
  p.first_name || ' ' || p.last_name as assignee_name,
  l.pincode,
  l.pincode_tier
FROM public.cases c
LEFT JOIN public.gig_partners gp ON c.current_assignee_id = gp.id
LEFT JOIN public.profiles p ON gp.profile_id = p.id
LEFT JOIN public.locations l ON c.location_id = l.id
WHERE c.current_assignee_id IS NOT NULL
  AND c.status IN ('auto_allocated', 'accepted', 'in_progress')
ORDER BY c.updated_at DESC;

-- Step 3: Check performance metrics for assigned workers
SELECT 
  'Performance Metrics for Assigned Workers' as info,
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
WHERE gp.id IN (
  SELECT DISTINCT current_assignee_id 
  FROM public.cases 
  WHERE current_assignee_id IS NOT NULL
)
ORDER BY pm.quality_score DESC NULLS LAST;
