-- =====================================================
-- Fix Bulk Allocation Capacity Issues
-- =====================================================

-- This script fixes issues where bulk allocation doesn't properly handle capacity updates
-- and transitions between workers when capacity is filled

-- Step 1: Check current allocation state
SELECT 
  'Current Allocation State' as info,
  p.email,
  gp.max_daily_capacity,
  gp.capacity_available,
  gp.active_cases_count,
  (SELECT COUNT(*) FROM public.cases c WHERE c.current_assignee_id = gp.id) as actual_assignments,
  CASE 
    WHEN gp.capacity_available != (gp.max_daily_capacity - (SELECT COUNT(*) FROM public.cases c WHERE c.current_assignee_id = gp.id))
    THEN 'CAPACITY_MISMATCH'
    ELSE 'OK'
  END as status
FROM public.profiles p
JOIN public.gig_partners gp ON p.id = gp.profile_id
WHERE gp.is_active = true
ORDER BY status DESC, p.email;

-- Step 2: Check unassigned cases
SELECT 
  'Unassigned Cases' as info,
  c.id,
  c.case_number,
  c.status,
  l.pincode,
  l.pincode_tier,
  c.created_at
FROM public.cases c
JOIN public.locations l ON c.location_id = l.id
WHERE c.current_assignee_id IS NULL
  AND c.status = 'created'
ORDER BY c.created_at DESC;

-- Step 3: Fix capacity tracking for all workers
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

-- Step 4: Update capacity tracking table for today
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

-- Step 5: Create missing capacity_tracking records for today
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

-- Step 6: Verify the fix
SELECT 
  'After Fix - Capacity State' as info,
  p.email,
  gp.max_daily_capacity,
  gp.capacity_available,
  gp.active_cases_count,
  (SELECT COUNT(*) FROM public.cases c WHERE c.current_assignee_id = gp.id) as actual_assignments,
  CASE 
    WHEN gp.capacity_available != (gp.max_daily_capacity - (SELECT COUNT(*) FROM public.cases c WHERE c.current_assignee_id = gp.id))
    THEN 'STILL_MISMATCH'
    ELSE 'FIXED'
  END as status
FROM public.profiles p
JOIN public.gig_partners gp ON p.id = gp.profile_id
WHERE gp.is_active = true
ORDER BY status DESC, p.email;
