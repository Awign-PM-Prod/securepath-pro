-- =====================================================
-- Fix Bulk Allocation Sequential Processing
-- =====================================================

-- This script creates a sequential allocation function to prevent capacity conflicts
-- during bulk allocation

-- Step 1: Create a sequential allocation function
CREATE OR REPLACE FUNCTION public.allocate_cases_sequentially(
  p_case_ids uuid[]
)
RETURNS TABLE (
  case_id uuid,
  success boolean,
  assignee_id uuid,
  assignee_email text,
  error_message text
)
LANGUAGE plpgsql
AS $$
DECLARE
  case_record RECORD;
  candidate_record RECORD;
  allocation_result RECORD;
  v_pincode text;
  v_pincode_tier pincode_tier;
  v_client_contract_id uuid;
  v_assignee_id uuid;
  v_success boolean;
  v_error_message text;
BEGIN
  -- Process each case sequentially
  FOR case_record IN 
    SELECT 
      c.id,
      c.case_number,
      l.pincode,
      l.pincode_tier,
      cc.id as client_contract_id
    FROM public.cases c
    JOIN public.locations l ON c.location_id = l.id
    JOIN public.clients cl ON c.client_id = cl.id
    JOIN public.client_contracts cc ON cl.id = cc.client_id
    WHERE c.id = ANY(p_case_ids)
      AND c.status = 'created'
      AND c.current_assignee_id IS NULL
    ORDER BY c.created_at ASC
  LOOP
    v_success := false;
    v_error_message := '';
    v_assignee_id := NULL;
    
    -- Get case details
    v_pincode := case_record.pincode;
    v_pincode_tier := case_record.pincode_tier;
    v_client_contract_id := case_record.client_contract_id;
    
    -- Try to find an available candidate
    FOR candidate_record IN
      SELECT 
        gp.id as gig_partner_id,
        p.email,
        gp.capacity_available,
        gp.max_daily_capacity,
        (SELECT COUNT(*)::integer 
         FROM public.cases c2 
         WHERE c2.current_assignee_id = gp.id
         AND c2.status IN ('auto_allocated', 'accepted', 'in_progress', 'submitted')
        ) as actual_assignments,
        COALESCE(pm.quality_score, 0.0000) as quality_score,
        COALESCE(pm.completion_rate, 0.0000) as completion_rate,
        COALESCE(pm.ontime_completion_rate, 0.0000) as ontime_completion_rate,
        COALESCE(pm.acceptance_rate, 0.0000) as acceptance_rate
      FROM public.gig_partners gp
      INNER JOIN public.profiles p ON gp.profile_id = p.id
      INNER JOIN public.performance_metrics pm ON gp.id = pm.gig_partner_id
      WHERE gp.is_active = true
        AND gp.is_available = true
        AND v_pincode = ANY(gp.coverage_pincodes)
        AND (pm.period_end >= CURRENT_DATE - INTERVAL '30 days' OR pm.period_end IS NULL)
        -- CRITICAL: Check actual capacity in real-time
        AND (SELECT COUNT(*)::integer 
             FROM public.cases c2 
             WHERE c2.current_assignee_id = gp.id
             AND c2.status IN ('auto_allocated', 'accepted', 'in_progress', 'submitted')
            ) < gp.max_daily_capacity
      ORDER BY 
        (COALESCE(pm.quality_score, 0.0000) * 0.35 + 
         COALESCE(pm.completion_rate, 0.0000) * 0.25 + 
         COALESCE(pm.ontime_completion_rate, 0.0000) * 0.25 + 
         COALESCE(pm.acceptance_rate, 0.0000) * 0.15) DESC,
        gp.capacity_available DESC,
        gp.last_assignment_at ASC NULLS FIRST
      LIMIT 1
    LOOP
      -- Double-check capacity before assignment
      IF candidate_record.actual_assignments < candidate_record.max_daily_capacity THEN
        -- Assign the case
        UPDATE public.cases 
        SET 
          current_assignee_id = candidate_record.gig_partner_id,
          current_assignee_type = 'gig',
          status = 'allocated',
          allocation_method = 'auto',
          status_updated_at = now(),
          updated_at = now()
        WHERE id = case_record.id;
        
        -- Update capacity tracking
        UPDATE public.capacity_tracking 
        SET 
          current_capacity_available = GREATEST(0, current_capacity_available - 1),
          cases_allocated = cases_allocated + 1,
          last_capacity_consumed_at = now(),
          updated_at = now()
        WHERE gig_partner_id = candidate_record.gig_partner_id
          AND date = CURRENT_DATE;
        
        -- Update gig_partners table
        UPDATE public.gig_partners 
        SET 
          capacity_available = GREATEST(0, capacity_available - 1),
          active_cases_count = active_cases_count + 1,
          last_assignment_at = now(),
          updated_at = now()
        WHERE id = candidate_record.gig_partner_id;
        
        v_success := true;
        v_assignee_id := candidate_record.gig_partner_id;
        EXIT; -- Exit the candidate loop
      END IF;
    END LOOP;
    
    -- If no candidate found, set error message
    IF NOT v_success THEN
      v_error_message := 'No available workers with capacity for pincode ' || v_pincode;
    END IF;
    
    -- Return the result
    RETURN QUERY SELECT 
      case_record.id,
      v_success,
      v_assignee_id,
      COALESCE(candidate_record.email, ''),
      v_error_message;
  END LOOP;
END;
$$;

-- Step 2: Test the sequential allocation function
SELECT 
  'Sequential Allocation Test' as info,
  case_id,
  success,
  assignee_email,
  error_message
FROM public.allocate_cases_sequentially(
  (SELECT ARRAY_AGG(id) FROM public.cases WHERE status = 'created' AND current_assignee_id IS NULL LIMIT 5)
);

-- Step 3: Show current unassigned cases
SELECT 
  'Current Unassigned Cases' as info,
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
LIMIT 10;
