-- =====================================================
-- Test Allocation Fix
-- =====================================================

-- This script tests if the allocation fixes are working correctly

-- Step 1: Show current case status
SELECT 
  'Current Case Status' as info,
  status,
  COUNT(*) as count
FROM public.cases
GROUP BY status
ORDER BY status;

-- Step 2: Show capacity before allocation
SELECT 
  'Capacity Before Allocation' as info,
  gp.id,
  p.email as worker_email,
  gp.max_daily_capacity,
  gp.capacity_available,
  gp.active_cases_count,
  (SELECT COUNT(*) FROM public.cases c 
   WHERE c.current_assignee_id = gp.id 
   AND c.status IN ('auto_allocated', 'accepted', 'in_progress', 'submitted')
  ) as actual_assignments
FROM public.gig_partners gp
LEFT JOIN public.profiles p ON gp.profile_id = p.id
WHERE gp.is_active = true
  AND gp.capacity_available > 0
ORDER BY gp.capacity_available DESC
LIMIT 5;

-- Step 3: Show unallocated cases
SELECT 
  'Unallocated Cases' as info,
  c.id,
  c.case_number,
  l.pincode,
  l.pincode_tier,
  c.created_at
FROM public.cases c
JOIN public.locations l ON c.location_id = l.id
WHERE c.status = 'created'
  AND c.current_assignee_id IS NULL
ORDER BY c.created_at DESC
LIMIT 5;

-- Step 4: Test allocation function (if it exists)
-- This will test the sequential allocation function
SELECT 
  'Testing Sequential Allocation' as info,
  case_id,
  success,
  assignee_email,
  error_message
FROM public.allocate_cases_sequentially(
  (SELECT ARRAY_AGG(id) FROM public.cases WHERE status = 'created' AND current_assignee_id IS NULL LIMIT 3)
);

-- Step 5: Show capacity after allocation
SELECT 
  'Capacity After Allocation' as info,
  gp.id,
  p.email as worker_email,
  gp.max_daily_capacity,
  gp.capacity_available,
  gp.active_cases_count,
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
WHERE gp.is_active = true
  AND EXISTS (
    SELECT 1 FROM public.cases c 
    WHERE c.current_assignee_id = gp.id 
    AND c.status IN ('auto_allocated', 'accepted', 'in_progress', 'submitted')
  )
ORDER BY gp.capacity_available DESC;
