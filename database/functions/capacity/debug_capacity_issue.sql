-- =====================================================
-- Debug Capacity Issue for Specific Users
-- =====================================================

-- Check the specific users mentioned
SELECT 
  'User Profile Data' as info,
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
WHERE p.email IN ('rajesh.sharma@example.com', 'test.user3@example.com');

-- Check actual case assignments for these users
SELECT 
  'Actual Case Assignments' as info,
  p.email,
  p.first_name,
  p.last_name,
  COUNT(c.id) as actual_assigned_cases,
  STRING_AGG(c.status, ', ') as case_statuses
FROM public.profiles p
JOIN public.gig_partners gp ON p.id = gp.profile_id
LEFT JOIN public.cases c ON gp.id = c.current_assignee_id
WHERE p.email IN ('rajesh.sharma@example.com', 'test.user3@example.com')
GROUP BY p.email, p.first_name, p.last_name;

-- Check capacity tracking for these users
SELECT 
  'Capacity Tracking Data' as info,
  p.email,
  p.first_name,
  p.last_name,
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
WHERE p.email IN ('rajesh.sharma@example.com', 'test.user3@example.com')
ORDER BY p.email, ct.date DESC;

-- Check all cases assigned to these gig workers
SELECT 
  'All Cases for These Workers' as info,
  p.email,
  c.case_number,
  c.status,
  c.created_at,
  c.current_assignee_id,
  gp.id as gig_partner_id
FROM public.profiles p
JOIN public.gig_partners gp ON p.id = gp.profile_id
LEFT JOIN public.cases c ON gp.id = c.current_assignee_id
WHERE p.email IN ('rajesh.sharma@example.com', 'test.user3@example.com')
ORDER BY p.email, c.created_at DESC;

-- Check if there are any cases in different statuses that might be counted
SELECT 
  'Cases by Status for These Workers' as info,
  p.email,
  c.status,
  COUNT(*) as case_count
FROM public.profiles p
JOIN public.gig_partners gp ON p.id = gp.profile_id
LEFT JOIN public.cases c ON gp.id = c.current_assignee_id
WHERE p.email IN ('rajesh.sharma@example.com', 'test.user3@example.com')
GROUP BY p.email, c.status
ORDER BY p.email, c.status;
