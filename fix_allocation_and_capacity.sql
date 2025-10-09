-- =====================================================
-- Fix Allocation and Capacity Issues
-- =====================================================

-- This script fixes both allocation reporting and capacity tracking issues

-- Step 1: Fix capacity for all gig workers based on actual case assignments
UPDATE public.gig_partners 
SET 
  capacity_available = GREATEST(0, max_daily_capacity - COALESCE(actual_assignments.count, 0)),
  active_cases_count = COALESCE(actual_assignments.count, 0),
  updated_at = now()
FROM (
  SELECT 
    current_assignee_id,
    COUNT(*) as count
  FROM public.cases 
  WHERE current_assignee_id IS NOT NULL
    AND status IN ('auto_allocated', 'accepted', 'in_progress', 'submitted')
  GROUP BY current_assignee_id
) actual_assignments
WHERE gig_partners.id = actual_assignments.current_assignee_id;

-- Step 2: Update capacity tracking for today
UPDATE public.capacity_tracking 
SET 
  current_capacity_available = GREATEST(0, max_daily_capacity - COALESCE(actual_assignments.count, 0)),
  cases_allocated = COALESCE(actual_assignments.count, 0),
  updated_at = now()
FROM (
  SELECT 
    current_assignee_id,
    COUNT(*) as count
  FROM public.cases 
  WHERE current_assignee_id IS NOT NULL
    AND status IN ('auto_allocated', 'accepted', 'in_progress', 'submitted')
  GROUP BY current_assignee_id
) actual_assignments
WHERE capacity_tracking.gig_partner_id = actual_assignments.current_assignee_id
  AND capacity_tracking.date = CURRENT_DATE;

-- Step 3: Create missing capacity tracking records for today
INSERT INTO public.capacity_tracking (
  gig_partner_id,
  date,
  max_daily_capacity,
  initial_capacity_available,
  current_capacity_available,
  cases_allocated,
  is_active,
  created_at,
  updated_at
)
SELECT 
  gp.id,
  CURRENT_DATE,
  gp.max_daily_capacity,
  gp.max_daily_capacity,
  GREATEST(0, gp.max_daily_capacity - COALESCE(actual_assignments.count, 0)),
  COALESCE(actual_assignments.count, 0),
  true,
  now(),
  now()
FROM public.gig_partners gp
LEFT JOIN (
  SELECT 
    current_assignee_id,
    COUNT(*) as count
  FROM public.cases 
  WHERE current_assignee_id IS NOT NULL
    AND status IN ('auto_allocated', 'accepted', 'in_progress', 'submitted')
  GROUP BY current_assignee_id
) actual_assignments ON gp.id = actual_assignments.current_assignee_id
WHERE gp.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.capacity_tracking ct 
    WHERE ct.gig_partner_id = gp.id 
    AND ct.date = CURRENT_DATE
  );

-- Step 4: Show current allocation status
SELECT 
  'Current Allocation Status' as info,
  COUNT(*) as total_cases,
  COUNT(CASE WHEN status = 'created' AND current_assignee_id IS NULL THEN 1 END) as unallocated,
  COUNT(CASE WHEN status = 'auto_allocated' THEN 1 END) as auto_allocated,
  COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
  COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
  COUNT(CASE WHEN status = 'submitted' THEN 1 END) as submitted
FROM public.cases;

-- Step 5: Show capacity status for workers with assignments
SELECT 
  'Workers with Assignments' as info,
  gp.id,
  p.email as worker_email,
  gp.max_daily_capacity,
  gp.capacity_available,
  gp.active_cases_count,
  ct.current_capacity_available as tracking_capacity,
  ct.cases_allocated as tracking_allocated,
  (SELECT COUNT(*) FROM public.cases c 
   WHERE c.current_assignee_id = gp.id 
   AND c.status IN ('auto_allocated', 'accepted', 'in_progress', 'submitted')
  ) as actual_assignments,
  CASE 
    WHEN gp.capacity_available = (SELECT COUNT(*) FROM public.cases c 
                                 WHERE c.current_assignee_id = gp.id 
                                 AND c.status IN ('auto_allocated', 'accepted', 'in_progress', 'submitted'))
    THEN 'CORRECT'
    ELSE 'MISMATCH'
  END as capacity_status
FROM public.gig_partners gp
LEFT JOIN public.profiles p ON gp.profile_id = p.id
LEFT JOIN public.capacity_tracking ct ON gp.id = ct.gig_partner_id AND ct.date = CURRENT_DATE
WHERE gp.is_active = true
  AND EXISTS (
    SELECT 1 FROM public.cases c 
    WHERE c.current_assignee_id = gp.id 
    AND c.status IN ('auto_allocated', 'accepted', 'in_progress', 'submitted')
  )
ORDER BY gp.capacity_available DESC;

-- Step 6: Show unallocated cases
SELECT 
  'Unallocated Cases' as info,
  c.id,
  c.case_number,
  l.pincode,
  l.pincode_tier,
  c.status,
  c.created_at
FROM public.cases c
JOIN public.locations l ON c.location_id = l.id
WHERE c.status = 'created'
  AND c.current_assignee_id IS NULL
ORDER BY c.created_at DESC
LIMIT 10;
