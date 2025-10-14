-- =====================================================
-- Comprehensive Fix for Over-Allocation and Capacity Issues
-- =====================================================

-- Step 1: Check current state of test5@worker.com
SELECT 
  'CURRENT STATE - test5@worker.com' as info,
  p.email,
  p.first_name,
  p.last_name,
  gp.id as gig_partner_id,
  gp.max_daily_capacity,
  gp.capacity_available,
  gp.active_cases_count,
  (SELECT COUNT(*) FROM public.cases c WHERE c.current_assignee_id = gp.id) as actual_assigned_cases,
  (SELECT STRING_AGG(c.case_number, ', ') FROM public.cases c WHERE c.current_assignee_id = gp.id) as case_numbers
FROM public.profiles p
JOIN public.gig_partners gp ON p.id = gp.profile_id
WHERE p.email = 'test5@worker.com';

-- Step 2: Check all cases assigned to test5@worker.com
SELECT 
  'CASES ASSIGNED TO test5@worker.com' as info,
  c.id,
  c.case_number,
  c.status,
  c.created_at,
  c.current_assignee_id
FROM public.profiles p
JOIN public.gig_partners gp ON p.id = gp.profile_id
JOIN public.cases c ON gp.id = c.current_assignee_id
WHERE p.email = 'test5@worker.com'
ORDER BY c.created_at ASC;

-- Step 3: IMMEDIATELY FIX - Unallocate excess cases (keep only first 3)
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

-- Step 4: Update capacity for test5@worker.com to reflect actual assignments
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

-- Step 6: Create missing capacity_tracking record if needed
INSERT INTO public.capacity_tracking (
  gig_partner_id,
  date,
  max_daily_capacity,
  initial_capacity_available,
  current_capacity_available,
  cases_allocated,
  cases_accepted,
  cases_in_progress,
  cases_submitted,
  cases_completed,
  last_reset_at,
  is_active,
  created_at,
  updated_at
)
SELECT 
  gp.id,
  CURRENT_DATE,
  gp.max_daily_capacity,
  gp.max_daily_capacity,
  gp.capacity_available,
  gp.active_cases_count,
  0,
  0,
  0,
  0,
  now(),
  true,
  now(),
  now()
FROM public.profiles p
JOIN public.gig_partners gp ON p.id = gp.profile_id
WHERE p.email = 'test5@worker.com'
AND NOT EXISTS (
  SELECT 1 FROM public.capacity_tracking ct 
  WHERE ct.gig_partner_id = gp.id 
  AND ct.date = CURRENT_DATE
);

-- Step 7: Verify the fix
SELECT 
  'AFTER FIX - test5@worker.com' as info,
  p.email,
  p.first_name,
  p.last_name,
  gp.max_daily_capacity,
  gp.capacity_available,
  gp.active_cases_count,
  (SELECT COUNT(*) FROM public.cases c WHERE c.current_assignee_id = gp.id) as actual_assigned_cases,
  (SELECT STRING_AGG(c.case_number, ', ') FROM public.cases c WHERE c.current_assignee_id = gp.id) as case_numbers
FROM public.profiles p
JOIN public.gig_partners gp ON p.id = gp.profile_id
WHERE p.email = 'test5@worker.com';

-- Step 8: Show unallocated cases
SELECT 
  'UNALLOCATED CASES' as info,
  c.id,
  c.case_number,
  c.status,
  c.created_at
FROM public.cases c
WHERE c.current_assignee_id IS NULL
  AND c.status = 'created'
ORDER BY c.created_at DESC
LIMIT 10;

-- Step 9: Fix ALL gig workers capacity to ensure consistency
UPDATE public.gig_partners 
SET 
  capacity_available = GREATEST(0, max_daily_capacity - (
    SELECT COUNT(*) 
    FROM public.cases c 
    WHERE c.current_assignee_id = gig_partners.id
    AND c.status IN ('auto_allocated', 'accepted', 'in_progress', 'submitted')
  )),
  active_cases_count = (
    SELECT COUNT(*) 
    FROM public.cases c 
    WHERE c.current_assignee_id = gig_partners.id
    AND c.status IN ('auto_allocated', 'accepted', 'in_progress', 'submitted')
  ),
  updated_at = now()
WHERE is_active = true;

-- Step 10: Update all capacity tracking for today
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
WHERE date = CURRENT_DATE
AND gig_partner_id IN (
  SELECT id FROM public.gig_partners WHERE is_active = true
);

-- Step 11: Final verification - show all workers with capacity issues
SELECT 
  'FINAL VERIFICATION - All Workers' as info,
  p.email,
  gp.max_daily_capacity,
  gp.capacity_available,
  gp.active_cases_count,
  (SELECT COUNT(*) FROM public.cases c WHERE c.current_assignee_id = gp.id) as actual_cases,
  CASE 
    WHEN gp.capacity_available != (gp.max_daily_capacity - (SELECT COUNT(*) FROM public.cases c WHERE c.current_assignee_id = gp.id))
    THEN 'MISMATCH'
    ELSE 'OK'
  END as status
FROM public.profiles p
JOIN public.gig_partners gp ON p.id = gp.profile_id
WHERE gp.is_active = true
ORDER BY status DESC, p.email;
