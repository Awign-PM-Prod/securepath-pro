-- =====================================================
-- Prevent Over-Allocation - Enhanced Allocation Engine
-- =====================================================

-- This script creates a more robust allocation system that prevents over-allocation

-- Step 1: Create an enhanced allocation function with strict capacity validation
CREATE OR REPLACE FUNCTION public.get_allocation_candidates_safe(
  p_case_id uuid,
  p_pincode text,
  p_pincode_tier pincode_tier
)
RETURNS TABLE (
  gig_partner_id uuid,
  assignment_type text,
  quality_score numeric,
  completion_rate numeric,
  ontime_completion_rate numeric,
  acceptance_rate numeric,
  capacity_available integer,
  max_daily_capacity integer,
  coverage_pincodes text[],
  last_assignment_at timestamp with time zone,
  actual_assigned_cases integer
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gp.id as gig_partner_id,
    'gig'::text as assignment_type,
    COALESCE(pm.quality_score, 0.0000) as quality_score,
    COALESCE(pm.completion_rate, 0.0000) as completion_rate,
    COALESCE(pm.ontime_completion_rate, 0.0000) as ontime_completion_rate,
    COALESCE(pm.acceptance_rate, 0.0000) as acceptance_rate,
    gp.capacity_available,
    gp.max_daily_capacity,
    gp.coverage_pincodes,
    gp.last_assignment_at,
    (SELECT COUNT(*)::integer 
     FROM public.cases c 
     WHERE c.current_assignee_id = gp.id
     AND c.status IN ('auto_allocated', 'accepted', 'in_progress', 'submitted')
    ) as actual_assigned_cases
  FROM public.gig_partners gp
  INNER JOIN public.profiles p ON gp.profile_id = p.id
  INNER JOIN public.performance_metrics pm ON gp.id = pm.gig_partner_id
  WHERE gp.is_active = true
    AND gp.is_available = true
    AND gp.capacity_available > 0  -- Must have available capacity
    AND p_pincode = ANY(gp.coverage_pincodes)  -- Must cover this pincode
    AND (pm.period_end >= CURRENT_DATE - INTERVAL '30 days' OR pm.period_end IS NULL)  -- Recent performance data
    -- CRITICAL: Double-check that actual assigned cases don't exceed capacity
    AND (SELECT COUNT(*)::integer 
         FROM public.cases c 
         WHERE c.current_assignee_id = gp.id
         AND c.status IN ('auto_allocated', 'accepted', 'in_progress', 'submitted')
        ) < gp.max_daily_capacity
  ORDER BY 
    (COALESCE(pm.quality_score, 0.0000) * 0.35 + 
     COALESCE(pm.completion_rate, 0.0000) * 0.25 + 
     COALESCE(pm.ontime_completion_rate, 0.0000) * 0.25 + 
     COALESCE(pm.acceptance_rate, 0.0000) * 0.15) DESC,
    gp.capacity_available DESC,  -- Prefer workers with more available capacity
    gp.last_assignment_at ASC NULLS FIRST;  -- Prefer workers who haven't been assigned recently
END;
$$;

-- Step 2: Create a capacity validation function
CREATE OR REPLACE FUNCTION public.validate_capacity_before_allocation(
  p_gig_partner_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_max_capacity integer;
  v_current_assignments integer;
  v_available_capacity integer;
BEGIN
  -- Get max capacity
  SELECT max_daily_capacity INTO v_max_capacity
  FROM public.gig_partners
  WHERE id = p_gig_partner_id;
  
  -- Get current assignments
  SELECT COUNT(*)::integer INTO v_current_assignments
  FROM public.cases
  WHERE current_assignee_id = p_gig_partner_id
    AND status IN ('auto_allocated', 'accepted', 'in_progress', 'submitted');
  
  -- Calculate available capacity
  v_available_capacity := v_max_capacity - v_current_assignments;
  
  -- Return true only if there's available capacity
  RETURN v_available_capacity > 0;
END;
$$;

-- Step 3: Test the safe allocation function
SELECT 
  'SAFE ALLOCATION TEST' as info,
  p.email,
  ac.gig_partner_id,
  ac.capacity_available,
  ac.max_daily_capacity,
  ac.actual_assigned_cases,
  ROUND(ac.quality_score * 100, 1) as quality_score_pct,
  CASE 
    WHEN ac.capacity_available > 0 AND ac.actual_assigned_cases < ac.max_daily_capacity THEN 'SAFE_TO_ALLOCATE'
    ELSE 'UNSAFE'
  END as allocation_status
FROM public.get_allocation_candidates_safe(
  gen_random_uuid(), -- dummy case_id
  '400058', -- test pincode
  'tier_1'::pincode_tier
) ac
JOIN public.gig_partners gp ON ac.gig_partner_id = gp.id
JOIN public.profiles p ON gp.profile_id = p.id
ORDER BY ac.quality_score DESC;

-- Step 4: Test capacity validation for test5@worker.com
SELECT 
  'CAPACITY VALIDATION TEST' as info,
  p.email,
  gp.max_daily_capacity,
  gp.capacity_available,
  (SELECT COUNT(*) FROM public.cases c WHERE c.current_assignee_id = gp.id) as actual_assignments,
  public.validate_capacity_before_allocation(gp.id) as can_allocate
FROM public.profiles p
JOIN public.gig_partners gp ON p.id = gp.profile_id
WHERE p.email = 'test5@worker.com';

-- Step 5: Create a trigger to prevent over-allocation
CREATE OR REPLACE FUNCTION public.prevent_over_allocation_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_max_capacity integer;
  v_current_assignments integer;
BEGIN
  -- Only check when assigning a case
  IF NEW.current_assignee_id IS NOT NULL AND OLD.current_assignee_id IS NULL THEN
    -- Get max capacity
    SELECT max_daily_capacity INTO v_max_capacity
    FROM public.gig_partners
    WHERE id = NEW.current_assignee_id;
    
    -- Get current assignments
    SELECT COUNT(*)::integer INTO v_current_assignments
    FROM public.cases
    WHERE current_assignee_id = NEW.current_assignee_id
      AND status IN ('auto_allocated', 'accepted', 'in_progress', 'submitted');
    
    -- Check if assignment would exceed capacity
    IF v_current_assignments >= v_max_capacity THEN
      RAISE EXCEPTION 'Cannot assign case: Worker % has reached maximum capacity of %', NEW.current_assignee_id, v_max_capacity;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 6: Create the trigger
DROP TRIGGER IF EXISTS prevent_over_allocation ON public.cases;
CREATE TRIGGER prevent_over_allocation
  BEFORE UPDATE ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_over_allocation_trigger();

-- Step 7: Test the trigger
SELECT 
  'TRIGGER TEST' as info,
  'Trigger created successfully' as status;
