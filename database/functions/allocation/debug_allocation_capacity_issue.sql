-- =====================================================
-- Debug Allocation Capacity Issue
-- =====================================================

-- Check the specific worker mentioned
SELECT 
  'Worker Profile Data' as info,
  p.email,
  p.first_name,
  p.last_name,
  gp.id as gig_partner_id,
  gp.max_daily_capacity,
  gp.capacity_available,
  gp.active_cases_count,
  gp.is_active,
  gp.is_available
FROM public.profiles p
JOIN public.gig_partners gp ON p.id = gp.profile_id
WHERE p.email = 'test5@worker.com';

-- Check actual case assignments for this worker
SELECT 
  'Actual Case Assignments' as info,
  p.email,
  p.first_name,
  p.last_name,
  COUNT(c.id) as total_assigned_cases,
  STRING_AGG(c.case_number, ', ') as case_numbers,
  STRING_AGG(c.status, ', ') as case_statuses
FROM public.profiles p
JOIN public.gig_partners gp ON p.id = gp.profile_id
LEFT JOIN public.cases c ON gp.id = c.current_assignee_id
WHERE p.email = 'test5@worker.com'
GROUP BY p.email, p.first_name, p.last_name;

-- Check capacity tracking for this worker
SELECT 
  'Capacity Tracking Data' as info,
  p.email,
  ct.date,
  ct.max_daily_capacity,
  ct.current_capacity_available,
  ct.cases_allocated,
  ct.cases_accepted,
  ct.cases_in_progress,
  ct.cases_submitted,
  ct.cases_completed
FROM public.profiles p
JOIN public.gig_partners gp ON p.id = gp.profile_id
LEFT JOIN public.capacity_tracking ct ON gp.id = ct.gig_partner_id
WHERE p.email = 'test5@worker.com'
ORDER BY ct.date DESC;

-- Check allocation logs for this worker
SELECT 
  'Allocation Logs' as info,
  p.email,
  al.case_id,
  al.allocated_at,
  al.decision,
  al.final_score,
  c.case_number,
  c.status
FROM public.profiles p
JOIN public.gig_partners gp ON p.id = gp.profile_id
LEFT JOIN public.allocation_logs al ON gp.id = al.candidate_id
LEFT JOIN public.cases c ON al.case_id = c.id
WHERE p.email = 'test5@worker.com'
ORDER BY al.allocated_at DESC;

-- Check if there are any cases in different statuses
SELECT 
  'Cases by Status for test5@worker.com' as info,
  c.status,
  COUNT(*) as case_count,
  STRING_AGG(c.case_number, ', ') as case_numbers
FROM public.profiles p
JOIN public.gig_partners gp ON p.id = gp.profile_id
LEFT JOIN public.cases c ON gp.id = c.current_assignee_id
WHERE p.email = 'test5@worker.com'
GROUP BY c.status
ORDER BY c.status;

-- Check the get_allocation_candidates function result for this worker's pincode
SELECT 
  'Allocation Candidates Test' as info,
  gig_partner_id,
  assignment_type,
  ROUND(quality_score * 100, 1) as quality_score_pct,
  ROUND(completion_rate * 100, 1) as completion_rate_pct,
  capacity_available,
  max_daily_capacity
FROM public.get_allocation_candidates(
  gen_random_uuid(), -- dummy case_id
  '400058', -- test pincode - adjust if needed
  'tier_1'::pincode_tier
)
WHERE gig_partner_id IN (
  SELECT gp.id 
  FROM public.profiles p
  JOIN public.gig_partners gp ON p.id = gp.profile_id
  WHERE p.email = 'test5@worker.com'
);
