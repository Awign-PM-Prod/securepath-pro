-- =====================================================
-- Update Allocation Functions to Set allocated_at Timestamp
-- =====================================================
-- This migration updates all database functions that allocate cases
-- to set the allocated_at timestamp in the cases table

-- Update allocate_case_to_candidate function
CREATE OR REPLACE FUNCTION allocate_case_to_candidate(
    p_case_id UUID,
    p_candidate_id UUID,
    p_candidate_type TEXT,
    p_vendor_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Update case assignment with allocated_at timestamp
    UPDATE cases 
    SET 
        current_assignee_id = p_candidate_id,
        current_assignee_type = p_candidate_type::assignment_type,
        current_vendor_id = CASE 
            WHEN p_candidate_type = 'vendor' THEN p_candidate_id
            ELSE p_vendor_id
        END,
        status = 'allocated',
        allocated_at = now(),
        status_updated_at = now()
    WHERE id = p_case_id;
    
    -- Update capacity for gig workers
    IF p_candidate_type = 'gig' THEN
        UPDATE gig_partners 
        SET 
            capacity_available = GREATEST(0, capacity_available - 1),
            active_cases_count = active_cases_count + 1,
            last_assignment_at = now()
        WHERE id = p_candidate_id;
        
        -- Update vendor capacity if gig worker belongs to a vendor
        IF p_vendor_id IS NOT NULL THEN
            UPDATE vendors 
            SET 
                capacity_available = GREATEST(0, capacity_available - 1),
                active_cases_count = active_cases_count + 1
            WHERE id = p_vendor_id;
        END IF;
    END IF;
    
    -- Update capacity for vendors
    IF p_candidate_type = 'vendor' THEN
        UPDATE vendors 
        SET 
            capacity_available = GREATEST(0, capacity_available - 1),
            active_cases_count = active_cases_count + 1,
            total_cases_assigned = total_cases_assigned + 1
        WHERE id = p_candidate_id;
    END IF;
    
    RETURN TRUE;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Allocation failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update auto_allocation_with_vendors function
CREATE OR REPLACE FUNCTION auto_allocation_with_vendors(
  p_pincode TEXT,
  p_case_ids UUID[]
)
RETURNS JSONB AS $$
DECLARE
  candidate RECORD;
  case_id UUID;
  allocation_count INTEGER := 0;
  result JSONB;
  case_count INTEGER;
BEGIN
  case_count := array_length(p_case_ids, 1);
  
  -- Get the best candidate for this pincode
  SELECT * INTO candidate
  FROM public.get_allocation_candidates_with_vendors(p_pincode, case_count)
  LIMIT 1;
  
  IF candidate IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No suitable candidates found for allocation',
      'allocated_count', 0,
      'failed_count', case_count
    );
  END IF;
  
  -- Allocate each case
  FOREACH case_id IN ARRAY p_case_ids
  LOOP
    BEGIN
      IF candidate.candidate_type = 'gig_worker' THEN
        -- Allocate to gig worker
        UPDATE public.cases
        SET 
          current_assignee_id = candidate.candidate_id,
          current_assignee_type = 'gig',
          current_vendor_id = candidate.vendor_id,
          status = 'allocated',
          allocated_at = now(),
          status_updated_at = now()
        WHERE id = case_id;
        
        -- Update gig worker capacity
        UPDATE public.gig_partners
        SET 
          capacity_available = capacity_available - 1,
          active_cases_count = active_cases_count + 1
        WHERE id = candidate.candidate_id;
        
        allocation_count := allocation_count + 1;
        
      ELSIF candidate.candidate_type = 'vendor' THEN
        -- Allocate to vendor
        UPDATE public.cases
        SET 
          current_vendor_id = candidate.candidate_id,
          current_assignee_type = 'vendor',
          status = 'allocated',
          allocated_at = now(),
          status_updated_at = now()
        WHERE id = case_id;
        
        -- Update vendor capacity
        UPDATE public.vendors
        SET 
          capacity_available = capacity_available - 1,
          active_cases_count = active_cases_count + 1
        WHERE id = candidate.candidate_id;
        
        allocation_count := allocation_count + 1;
      END IF;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- Log error but continue with next case
        RAISE WARNING 'Failed to allocate case %: %', case_id, SQLERRM;
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'allocated_count', allocation_count,
    'failed_count', case_count - allocation_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update trigger function to set submitted_at when case status becomes 'submitted'
CREATE OR REPLACE FUNCTION public.sync_form_submission_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Update form_submissions status based on case status
    IF NEW.status = 'in_progress' THEN
      -- Set to draft when case goes to in_progress (only if not already final)
      UPDATE public.form_submissions
      SET status = 'draft',
          updated_at = now()
      WHERE case_id = NEW.id
        AND status != 'final';
        
    ELSIF NEW.status = 'submitted' THEN
      -- Set to final when case goes to submitted (only if not already final)
      UPDATE public.form_submissions
      SET status = 'final',
          updated_at = now(),
          submitted_at = COALESCE(submitted_at, now())
      WHERE case_id = NEW.id
        AND status != 'final';
      
      -- Also set submitted_at in cases table if not already set
      IF NEW.submitted_at IS NULL THEN
        UPDATE public.cases
        SET submitted_at = now()
        WHERE id = NEW.id;
      END IF;
        
    ELSIF NEW.status NOT IN ('in_progress', 'submitted') THEN
      -- Set to NULL for all other statuses (but don't change if already final)
      UPDATE public.form_submissions
      SET status = NULL,
          updated_at = now()
      WHERE case_id = NEW.id
        AND status != 'final';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION allocate_case_to_candidate(UUID, UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auto_allocation_with_vendors(TEXT, UUID[]) TO authenticated;

