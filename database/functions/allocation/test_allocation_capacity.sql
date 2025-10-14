-- =====================================================
-- Test Allocation Capacity Updates
-- =====================================================

-- This script tests if capacity tracking is working correctly

-- Step 1: Check current capacity status
SELECT 
  'Before Allocation Test' as status,
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

-- Step 2: Check current case assignments
SELECT 
  'Current Case Assignments' as status,
  c.id as case_id,
  c.case_number,
  c.status,
  c.current_assignee_id,
  p.first_name || ' ' || p.last_name as assignee_name
FROM public.cases c
LEFT JOIN public.gig_partners gp ON c.current_assignee_id = gp.id
LEFT JOIN public.profiles p ON gp.profile_id = p.id
WHERE c.current_assignee_id IS NOT NULL
ORDER BY c.created_at DESC;

-- Step 3: Check capacity tracking records
SELECT 
  'Capacity Tracking Records' as status,
  ct.gig_partner_id,
  p.first_name || ' ' || p.last_name as name,
  ct.date,
  ct.max_daily_capacity,
  ct.current_capacity_available,
  ct.cases_allocated,
  ct.is_active
FROM public.capacity_tracking ct
JOIN public.gig_partners gp ON ct.gig_partner_id = gp.id
JOIN public.profiles p ON gp.profile_id = p.id
WHERE ct.date = CURRENT_DATE
ORDER BY ct.current_capacity_available ASC;

-- Step 4: Simulate capacity consumption for testing
-- (This would normally be done by the allocation engine)
DO $$
DECLARE
    test_gig_partner_id UUID;
    current_capacity INTEGER;
    max_capacity INTEGER;
BEGIN
    -- Get a gig partner with available capacity
    SELECT gp.id, gp.capacity_available, gp.max_daily_capacity
    INTO test_gig_partner_id, current_capacity, max_capacity
    FROM public.gig_partners gp
    WHERE gp.is_active = true 
      AND gp.capacity_available > 0
    LIMIT 1;
    
    IF test_gig_partner_id IS NOT NULL THEN
        -- Simulate capacity consumption
        UPDATE public.gig_partners 
        SET 
          capacity_available = capacity_available - 1,
          active_cases_count = active_cases_count + 1,
          updated_at = now()
        WHERE id = test_gig_partner_id;
        
        -- Update capacity tracking
        UPDATE public.capacity_tracking 
        SET 
          current_capacity_available = current_capacity_available - 1,
          cases_allocated = cases_allocated + 1,
          updated_at = now()
        WHERE gig_partner_id = test_gig_partner_id
          AND date = CURRENT_DATE;
        
        RAISE NOTICE 'Simulated capacity consumption for gig partner %: %/% available', 
          test_gig_partner_id, current_capacity - 1, max_capacity;
    ELSE
        RAISE NOTICE 'No gig partners with available capacity found';
    END IF;
END $$;

-- Step 5: Check capacity status after test
SELECT 
  'After Capacity Test' as status,
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
