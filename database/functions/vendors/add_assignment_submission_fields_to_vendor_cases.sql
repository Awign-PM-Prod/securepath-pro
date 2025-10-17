-- Add Assignment and Submission Fields to Vendor Cases Function
-- Background Verification Platform
-- =====================================================

-- Drop the existing function first to avoid return type conflicts
DROP FUNCTION IF EXISTS get_vendor_assigned_cases(UUID);

-- Create the get_vendor_assigned_cases function with assignment and submission fields
CREATE OR REPLACE FUNCTION get_vendor_assigned_cases(vendor_uuid UUID)
RETURNS TABLE (
    id UUID,
    case_number TEXT,
    title TEXT,
    description TEXT,
    priority TEXT,
    source TEXT,
    client_id UUID,
    location_id UUID,
    tat_hours INTEGER,
    due_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    current_assignee_id UUID,
    current_assignee_type TEXT,
    current_vendor_id UUID,
    status TEXT,
    status_updated_at TIMESTAMPTZ,
    base_rate_inr NUMERIC,
    rate_adjustments JSONB,
    total_rate_inr NUMERIC,
    visible_to_gig BOOLEAN,
    created_by UUID,
    last_updated_by UUID,
    updated_at TIMESTAMPTZ,
    metadata JSONB,
    client_case_id TEXT,
    travel_allowance_inr NUMERIC,
    bonus_inr NUMERIC,
    instructions TEXT,
    contract_type TEXT,
    candidate_name TEXT,
    phone_primary TEXT,
    phone_secondary TEXT,
    vendor_tat_start_date TIMESTAMPTZ,
    penalty_inr NUMERIC,
    total_payout_inr NUMERIC,
    address_line TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    acceptance_deadline TIMESTAMPTZ,
    client_name TEXT,
    client_email TEXT,
    -- New fields for QC dashboard
    assigned_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ
) 
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.case_number,
        c.title,
        c.description,
        c.priority,
        c.source,
        c.client_id,
        c.location_id,
        c.tat_hours,
        c.due_at,
        c.created_at,
        c.current_assignee_id,
        c.current_assignee_type,
        c.current_vendor_id,
        c.status,
        c.status_updated_at,
        c.base_rate_inr,
        c.rate_adjustments,
        c.total_rate_inr,
        c.visible_to_gig,
        c.created_by,
        c.last_updated_by,
        c.updated_at,
        c.metadata,
        c.client_case_id,
        c.travel_allowance_inr,
        c.bonus_inr,
        c.instructions,
        c.contract_type,
        c.candidate_name,
        c.phone_primary,
        c.phone_secondary,
        c.vendor_tat_start_date,
        c.penalty_inr,
        c.total_payout_inr,
        l.address_line,
        l.city,
        l.state,
        l.pincode,
        al.acceptance_deadline,
        cl.name as client_name,
        cl.email as client_email,
        -- Get assignment date from allocation logs
        (SELECT al_inner.accepted_at 
         FROM allocation_logs al_inner 
         WHERE al_inner.case_id = c.id 
           AND al_inner.candidate_id = c.current_assignee_id 
           AND al_inner.decision = 'accepted'
         ORDER BY al_inner.accepted_at DESC 
         LIMIT 1) as assigned_at,
        -- Get submission date from submissions or form_submissions
        COALESCE(
            (SELECT s.submitted_at 
             FROM submissions s 
             WHERE s.case_id = c.id 
             ORDER BY s.submitted_at DESC 
             LIMIT 1),
            (SELECT fs.submitted_at 
             FROM form_submissions fs 
             WHERE fs.case_id = c.id 
             ORDER BY fs.submitted_at DESC 
             LIMIT 1)
        ) as submitted_at
    FROM cases c
    LEFT JOIN locations l ON c.location_id = l.id
    LEFT JOIN clients cl ON c.client_id = cl.id
    LEFT JOIN allocation_logs al ON c.id = al.case_id 
        AND al.candidate_id = c.current_assignee_id 
        AND al.decision = 'allocated'
    WHERE c.current_vendor_id = vendor_uuid
        AND c.status IN ('auto_allocated', 'accepted', 'in_progress', 'submitted', 'qc_rework')
    ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_vendor_assigned_cases(UUID) TO authenticated;
