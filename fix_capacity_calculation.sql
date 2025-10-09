-- =====================================================
-- Fix Capacity Calculation
-- =====================================================

-- This script fixes capacity calculation by updating active_cases_count
-- to reflect the actual number of cases assigned to each gig worker

-- Step 1: Update active_cases_count in gig_partners based on actual case assignments
UPDATE public.gig_partners 
SET 
  active_cases_count = COALESCE(assigned_cases.count, 0),
  updated_at = now()
FROM (
  SELECT 
    c.current_assignee_id,
    COUNT(*) as count
  FROM public.cases c
  WHERE c.current_assignee_id IS NOT NULL
    AND c.status IN ('auto_allocated', 'accepted', 'in_progress', 'submitted')
  GROUP BY c.current_assignee_id
) assigned_cases
WHERE gig_partners.id = assigned_cases.current_assignee_id;

-- Step 2: Update capacity_available in gig_partners based on active_cases_count
UPDATE public.gig_partners 
SET 
  capacity_available = gp.max_daily_capacity - gp.active_cases_count,
  updated_at = now()
FROM public.gig_partners gp
WHERE gig_partners.id = gp.id;

-- Step 3: Update capacity_tracking table to match gig_partners data
UPDATE public.capacity_tracking 
SET 
  current_capacity_available = gp.capacity_available,
  cases_allocated = gp.active_cases_count,
  updated_at = now()
FROM public.gig_partners gp
WHERE capacity_tracking.gig_partner_id = gp.id
  AND capacity_tracking.date = CURRENT_DATE;

-- Step 4: Show current capacity status
SELECT 
  'Fixed Capacity Status' as info,
  gp.id,
  p.first_name || ' ' || p.last_name as name,
  gp.max_daily_capacity,
  gp.capacity_available,
  gp.active_cases_count,
  ROUND((gp.capacity_available::DECIMAL / gp.max_daily_capacity::DECIMAL) * 100, 2) as capacity_percentage
FROM public.gig_partners gp
JOIN public.profiles p ON gp.profile_id = p.id
WHERE gp.is_active = true
ORDER BY capacity_percentage ASC;

-- Step 5: Show cases by assignee to verify
SELECT 
  'Cases by Assignee (Verification)' as info,
  c.current_assignee_id,
  p.first_name || ' ' || p.last_name as assignee_name,
  COUNT(*) as actual_case_count,
  gp.active_cases_count as stored_case_count,
  CASE 
    WHEN COUNT(*) = gp.active_cases_count THEN '✅ MATCH'
    ELSE '❌ MISMATCH'
  END as status
FROM public.cases c
LEFT JOIN public.gig_partners gp ON c.current_assignee_id = gp.id
LEFT JOIN public.profiles p ON gp.profile_id = p.id
WHERE c.current_assignee_id IS NOT NULL
  AND c.status IN ('auto_allocated', 'accepted', 'in_progress', 'submitted')
GROUP BY c.current_assignee_id, p.first_name, p.last_name, gp.active_cases_count
ORDER BY actual_case_count DESC;
