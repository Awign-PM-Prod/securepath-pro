-- =====================================================
-- Fix All Capacity Inconsistencies
-- =====================================================

-- This script fixes capacity data inconsistencies across all gig workers
-- by ensuring capacity_available matches actual case assignments

-- Step 1: Show current inconsistencies
SELECT 
  'Current Inconsistencies' as info,
  p.email,
  gp.max_daily_capacity,
  gp.capacity_available as stored_available,
  (SELECT COUNT(*) FROM public.cases c WHERE c.current_assignee_id = gp.id) as actual_cases,
  (gp.max_daily_capacity - (SELECT COUNT(*) FROM public.cases c WHERE c.current_assignee_id = gp.id)) as calculated_available,
  CASE 
    WHEN gp.capacity_available != (gp.max_daily_capacity - (SELECT COUNT(*) FROM public.cases c WHERE c.current_assignee_id = gp.id))
    THEN 'NEEDS_FIX'
    ELSE 'OK'
  END as status
FROM public.profiles p
JOIN public.gig_partners gp ON p.id = gp.profile_id
WHERE gp.is_active = true
ORDER BY status DESC, p.email;

-- Step 2: Fix gig_partners table for all users
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

-- Step 3: Fix capacity_tracking table for today
UPDATE public.capacity_tracking 
SET 
  current_capacity_available = GREATEST(0, max_daily_capacity - (
    SELECT COUNT(*) 
    FROM public.cases c 
    WHERE c.current_assignee_id = capacity_tracking.gig_partner_id
    AND c.status IN ('auto_allocated', 'accepted', 'in_progress', 'submitted')
  )),
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

-- Step 4: Create missing capacity_tracking records for today
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
FROM public.gig_partners gp
WHERE gp.is_active = true
AND NOT EXISTS (
  SELECT 1 FROM public.capacity_tracking ct 
  WHERE ct.gig_partner_id = gp.id 
  AND ct.date = CURRENT_DATE
);

-- Step 5: Verify all fixes
SELECT 
  'After Fix - Verification' as info,
  p.email,
  gp.max_daily_capacity,
  gp.capacity_available as stored_available,
  (SELECT COUNT(*) FROM public.cases c WHERE c.current_assignee_id = gp.id) as actual_cases,
  (gp.max_daily_capacity - (SELECT COUNT(*) FROM public.cases c WHERE c.current_assignee_id = gp.id)) as calculated_available,
  CASE 
    WHEN gp.capacity_available != (gp.max_daily_capacity - (SELECT COUNT(*) FROM public.cases c WHERE c.current_assignee_id = gp.id))
    THEN 'STILL_MISMATCH'
    ELSE 'FIXED'
  END as status
FROM public.profiles p
JOIN public.gig_partners gp ON p.id = gp.profile_id
WHERE gp.is_active = true
ORDER BY status DESC, p.email;

-- Step 6: Show capacity tracking verification
SELECT 
  'Capacity Tracking Verification' as info,
  p.email,
  ct.date,
  ct.max_daily_capacity,
  ct.current_capacity_available,
  ct.cases_allocated,
  (SELECT COUNT(*) FROM public.cases c WHERE c.current_assignee_id = ct.gig_partner_id) as actual_cases
FROM public.profiles p
JOIN public.gig_partners gp ON p.id = gp.profile_id
LEFT JOIN public.capacity_tracking ct ON gp.id = ct.gig_partner_id
WHERE ct.date = CURRENT_DATE
ORDER BY p.email;
