-- =====================================================
-- Update Timeout Handler to Use 'pending_allocation' Status
-- Run this in Supabase SQL Editor
-- =====================================================

-- First, check if 'pending_allocation' exists in your case_status enum
-- If not, you'll need to add it first
SELECT unnest(enum_range(NULL::case_status)) as existing_statuses;

-- If 'pending_allocation' is NOT in the list above, run this first to add it:
-- (Uncomment if needed)
/*
ALTER TYPE case_status ADD VALUE IF NOT EXISTS 'pending_allocation';
*/

-- Then run this to update the timeout function:
CREATE OR REPLACE FUNCTION public.handle_case_timeouts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    timeout_case RECORD;
    timeout_count INTEGER := 0;
BEGIN
    -- Find cases that should have timed out (not accepted within 30 minutes)
    FOR timeout_case IN
        SELECT 
            al.case_id,
            al.candidate_id,
            al.acceptance_deadline,
            c.status,
            c.current_assignee_id
        FROM public.allocation_logs al
        INNER JOIN public.cases c ON al.case_id = c.id
        WHERE al.decision = 'allocated'
        AND al.acceptance_deadline < NOW()
        AND c.status = 'allocated'
        AND c.current_assignee_id = al.candidate_id
    LOOP
        -- Update case status to pending_allocation and remove assignee
        UPDATE public.cases
        SET 
            status = 'pending_allocation',
            current_assignee_id = NULL,
            current_assignee_type = NULL,
            status_updated_at = NOW()
        WHERE id = timeout_case.case_id;

        -- Update allocation log
        UPDATE public.allocation_logs
        SET 
            decision = 'timeout',
            decision_at = NOW(),
            reallocation_reason = 'Not accepted within 30 minutes'
        WHERE case_id = timeout_case.case_id
        AND candidate_id = timeout_case.candidate_id
        AND decision = 'allocated';

        -- Free up capacity
        PERFORM public.free_capacity(
            timeout_case.candidate_id,
            timeout_case.case_id,
            'Case timeout - not accepted'
        );

        timeout_count := timeout_count + 1;
    END LOOP;

    -- Log the timeout handling
    IF timeout_count > 0 THEN
        INSERT INTO public.audit_logs (
            entity_type,
            entity_id,
            action,
            metadata,
            created_at
        ) VALUES (
            'timeout_handler',
            gen_random_uuid(),
            'handle_timeouts',
            jsonb_build_object(
                'timeout_count', timeout_count,
                'handled_at', NOW()
            ),
            NOW()
        );
    END IF;
END;
$$;

-- Grant execute permission (if not already granted)
GRANT EXECUTE ON FUNCTION public.handle_case_timeouts() TO authenticated;

