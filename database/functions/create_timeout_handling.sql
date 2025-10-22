-- Create timeout handling for gig worker case acceptance
-- This script creates functions and triggers to automatically handle case timeouts

-- Function to handle case timeouts
CREATE OR REPLACE FUNCTION public.handle_case_timeouts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    timeout_case RECORD;
    timeout_count INTEGER := 0;
BEGIN
    -- Find cases that should have timed out (not accepted within 1 hour)
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
        -- Update case status to created and remove assignee
        UPDATE public.cases
        SET 
            status = 'created',
            current_assignee_id = NULL,
            current_assignee_type = NULL,
            status_updated_at = NOW()
        WHERE id = timeout_case.case_id;

        -- Update allocation log
        UPDATE public.allocation_logs
        SET 
            decision = 'timeout',
            decision_at = NOW(),
            reallocation_reason = 'Not accepted within 1 hour'
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

-- Create a function to check if a case has timed out
CREATE OR REPLACE FUNCTION public.is_case_timed_out(p_case_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deadline TIMESTAMP WITH TIME ZONE;
    case_status TEXT;
BEGIN
    -- Get the acceptance deadline and current status
    SELECT 
        al.acceptance_deadline,
        c.status
    INTO deadline, case_status
    FROM public.allocation_logs al
    INNER JOIN public.cases c ON al.case_id = c.id
    WHERE al.case_id = p_case_id
    AND al.decision = 'allocated'
    AND c.status = 'allocated';

    -- Return true if deadline has passed and case is still allocated
    RETURN deadline IS NOT NULL AND deadline < NOW() AND case_status = 'allocated';
END;
$$;

-- Create a function to get time remaining for case acceptance
CREATE OR REPLACE FUNCTION public.get_case_acceptance_time_remaining(p_case_id UUID)
RETURNS INTERVAL
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deadline TIMESTAMP WITH TIME ZONE;
    time_remaining INTERVAL;
BEGIN
    -- Get the acceptance deadline
    SELECT al.acceptance_deadline
    INTO deadline
    FROM public.allocation_logs al
    WHERE al.case_id = p_case_id
    AND al.decision = 'allocated';

    -- Calculate time remaining
    IF deadline IS NOT NULL THEN
        time_remaining := deadline - NOW();
        -- Return 0 if deadline has passed
        IF time_remaining < INTERVAL '0 seconds' THEN
            RETURN INTERVAL '0 seconds';
        END IF;
        RETURN time_remaining;
    END IF;

    RETURN NULL;
END;
$$;

-- Create an index to improve timeout query performance
CREATE INDEX IF NOT EXISTS idx_allocation_logs_timeout_check 
ON public.allocation_logs (decision, acceptance_deadline) 
WHERE decision = 'allocated';

-- Create an index on cases for timeout status check
CREATE INDEX IF NOT EXISTS idx_cases_timeout_status 
ON public.cases (status, current_assignee_id) 
WHERE status = 'allocated';

-- Create a view for gig workers to see their cases with timeout info
CREATE OR REPLACE VIEW public.gig_worker_cases AS
SELECT 
    c.id,
    c.case_number,
    c.client_case_id,
    c.contract_type,
    c.candidate_name,
    c.phone_primary,
    c.phone_secondary,
    c.status,
    c.priority,
    c.vendor_tat_start_date,
    c.due_at,
    c.base_rate_inr,
    c.total_payout_inr,
    c.created_at,
    c.status_updated_at,
    cl.name as client_name,
    l.address_line,
    l.city,
    l.state,
    l.pincode,
    al.acceptance_deadline,
    al.acceptance_window_minutes,
    public.get_case_acceptance_time_remaining(c.id) as time_remaining,
    public.is_case_timed_out(c.id) as is_timed_out,
    CASE 
        WHEN c.status = 'allocated' AND public.is_case_timed_out(c.id) THEN 'expired'
        WHEN c.status = 'allocated' THEN 'allocated'
        WHEN c.status = 'accepted' THEN 'accepted'
        WHEN c.status = 'in_progress' THEN 'in_progress'
        WHEN c.status = 'submitted' THEN 'submitted'
        ELSE c.status
    END as display_status
FROM public.cases c
INNER JOIN public.clients cl ON c.client_id = cl.id
INNER JOIN public.locations l ON c.location_id = l.id
LEFT JOIN public.allocation_logs al ON c.id = al.case_id 
    AND al.decision = 'allocated'
WHERE c.current_assignee_id IS NOT NULL;

-- Grant permissions
GRANT SELECT ON public.gig_worker_cases TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_case_timeouts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_case_timed_out(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_case_acceptance_time_remaining(UUID) TO authenticated;

-- Create a scheduled job to run timeout handling every minute
-- Note: This would typically be set up in your application's cron job or Supabase Edge Functions
-- For now, we'll create a function that can be called manually or by a scheduled job

-- Test the timeout handling function
DO $$
BEGIN
    -- Run the timeout handler once to clean up any existing timeouts
    PERFORM public.handle_case_timeouts();
    
    RAISE NOTICE 'Timeout handling functions created successfully';
    RAISE NOTICE 'You can call public.handle_case_timeouts() to process timeouts';
    RAISE NOTICE 'Use public.is_case_timed_out(case_id) to check if a specific case has timed out';
    RAISE NOTICE 'Use public.get_case_acceptance_time_remaining(case_id) to get remaining time';
END $$;
