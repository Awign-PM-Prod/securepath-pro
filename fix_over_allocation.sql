-- =====================================================
-- Fix Over-Allocation Issue
-- =====================================================

-- This script fixes the over-allocation issue where test5@worker.com
-- has 6 cases assigned but only has capacity for 3

-- Step 1: Check current state
SELECT 
  'BEFORE FIX - Current State' as info,
  p.email,
  p.first_name,
  p.last_name,
  gp.max_daily_capacity,
  gp.capacity_available,
  gp.active_cases_count,
  (SELECT COUNT(*) FROM public.cases c WHERE c.current_assignee_id = gp.id) as actual_cases,
  (SELECT STRING_AGG(c.case_number, ', ') FROM public.cases c WHERE c.current_assignee_id = gp.id) as case_numbers
FROM public.profiles p
JOIN public.gig_partners gp ON p.id = gp.profile_id
WHERE p.email = 'test5@worker.com';

-- Step 2: Get the cases assigned to test5@worker.com
SELECT 
  'Cases Assigned to test5@worker.com' as info,
  c.id,
  c.case_number,
  c.status,
  c.created_at,
  c.current_assignee_id
FROM public.profiles p
JOIN public.gig_partners gp ON p.id = gp.profile_id
JOIN public.cases c ON gp.id = c.current_assignee_id
WHERE p.email = 'test5@worker.com'
ORDER BY c.created_at DESC;

-- Step 3: Unallocate excess cases (keep only the first 3, unallocate the rest)
WITH excess_cases AS (
  SELECT 
    c.id,
    c.case_number,
    ROW_NUMBER() OVER (ORDER BY c.created_at ASC) as rn
  FROM public.profiles p
  JOIN public.gig_partners gp ON p.id = gp.profile_id
  JOIN public.cases c ON gp.id = c.current_assignee_id
  WHERE p.email = 'test5@worker.com'
    AND c.status IN ('auto_allocated', 'accepted', 'in_progress', 'submitted')
)
UPDATE public.cases 
SET 
  current_assignee_id = NULL,
  current_assignee_type = NULL,
  current_vendor_id = NULL,
  status = 'created',
  status_updated_at = now(),
  last_updated_by = (SELECT id FROM public.profiles WHERE email = 'ops_team@example.com' LIMIT 1),
  updated_at = now()
WHERE id IN (
  SELECT id FROM excess_cases WHERE rn > 3
);

-- Step 4: Update capacity for test5@worker.com
UPDATE public.gig_partners 
SET 
  capacity_available = max_daily_capacity - (
    SELECT COUNT(*) 
    FROM public.cases c 
    WHERE c.current_assignee_id = gig_partners.id
    AND c.status IN ('auto_allocated', 'accepted', 'in_progress', 'submitted')
  ),
  active_cases_count = (
    SELECT COUNT(*) 
    FROM public.cases c 
    WHERE c.current_assignee_id = gig_partners.id
    AND c.status IN ('auto_allocated', 'accepted', 'in_progress', 'submitted')
  ),
  updated_at = now()
WHERE id IN (
  SELECT gp.id 
  FROM public.profiles p
  JOIN public.gig_partners gp ON p.id = gp.profile_id
  WHERE p.email = 'test5@worker.com'
);

-- Step 5: Update capacity tracking for today
UPDATE public.capacity_tracking 
SET 
  current_capacity_available = (
    SELECT gp.capacity_available 
    FROM public.gig_partners gp 
    WHERE gp.id = capacity_tracking.gig_partner_id
  ),
  cases_allocated = (
    SELECT COUNT(*) 
    FROM public.cases c 
    WHERE c.current_assignee_id = capacity_tracking.gig_partner_id
    AND c.status IN ('auto_allocated', 'accepted', 'in_progress', 'submitted')
  ),
  updated_at = now()
WHERE gig_partner_id IN (
  SELECT gp.id 
  FROM public.profiles p
  JOIN public.gig_partners gp ON p.id = gp.profile_id
  WHERE p.email = 'test5@worker.com'
)
AND date = CURRENT_DATE;

-- Step 6: Verify the fix
SELECT 
  'AFTER FIX - Updated State' as info,
  p.email,
  p.first_name,
  p.last_name,
  gp.max_daily_capacity,
  gp.capacity_available,
  gp.active_cases_count,
  (SELECT COUNT(*) FROM public.cases c WHERE c.current_assignee_id = gp.id) as actual_cases,
  (SELECT STRING_AGG(c.case_number, ', ') FROM public.cases c WHERE c.current_assignee_id = gp.id) as case_numbers
FROM public.profiles p
JOIN public.gig_partners gp ON p.id = gp.profile_id
WHERE p.email = 'test5@worker.com';

-- Step 7: Show unallocated cases
SELECT 
  'Unallocated Cases' as info,
  c.id,
  c.case_number,
  c.status,
  c.created_at
FROM public.cases c
WHERE c.current_assignee_id IS NULL
  AND c.status = 'created'
ORDER BY c.created_at DESC
LIMIT 10;
