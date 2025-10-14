-- =====================================================
-- Fix Capacity Tracking Data
-- =====================================================

-- This script fixes capacity tracking data to reflect actual case assignments

-- Step 1: Update capacity_available in gig_partners based on actual case assignments
UPDATE public.gig_partners gp
SET 
  capacity_available = gp.max_daily_capacity - COALESCE(assigned_cases.count, 0),
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
WHERE gp.id = assigned_cases.current_assignee_id;

-- Step 2: Update capacity_tracking table for today
UPDATE public.capacity_tracking 
SET 
  current_capacity_available = gp.capacity_available,
  cases_allocated = gp.active_cases_count,
  updated_at = now()
FROM public.gig_partners gp
WHERE capacity_tracking.gig_partner_id = gp.id
  AND capacity_tracking.date = CURRENT_DATE;

-- Step 3: Create missing capacity_tracking records for today
INSERT INTO public.capacity_tracking (
  id,
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
  gen_random_uuid(),
  gp.id,
  CURRENT_DATE,
  gp.max_daily_capacity,
  gp.max_daily_capacity,
  gp.capacity_available,
  gp.active_cases_count,
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

-- Step 4: Show current capacity status
SELECT 
  'Current Capacity Status' as info,
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

-- Step 5: Show cases by assignee
SELECT 
  'Cases by Assignee' as info,
  c.current_assignee_id,
  p.first_name || ' ' || p.last_name as assignee_name,
  COUNT(*) as case_count,
  STRING_AGG(c.case_number, ', ') as case_numbers
FROM public.cases c
LEFT JOIN public.gig_partners gp ON c.current_assignee_id = gp.id
LEFT JOIN public.profiles p ON gp.profile_id = p.id
WHERE c.current_assignee_id IS NOT NULL
  AND c.status IN ('auto_allocated', 'accepted', 'in_progress', 'submitted')
GROUP BY c.current_assignee_id, p.first_name, p.last_name
ORDER BY case_count DESC;
