-- =====================================================
-- Update Vendor Assigned Cases Function for QC Rework
-- Background Verification Platform
-- =====================================================

-- Drop the existing function first
DROP FUNCTION IF EXISTS get_vendor_assigned_cases(UUID);

-- Create the updated function that includes qc_rework cases
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
    client_email TEXT
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
        c.priority::TEXT,
        c.source::TEXT,
        c.client_id,
        c.location_id,
        c.tat_hours,
        c.due_at,
        c.created_at,
        c.current_assignee_id,
        c.current_assignee_type::TEXT,
        c.current_vendor_id,
        c.status::TEXT,
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
        cl.email as client_email
    FROM cases c
    JOIN locations l ON c.location_id = l.id
    JOIN clients cl ON c.client_id = cl.id
    LEFT JOIN allocation_logs al ON c.id = al.case_id 
        AND al.candidate_type = 'vendor' 
        AND al.candidate_id = vendor_uuid
        AND al.decision = 'allocated'
    WHERE c.current_vendor_id = vendor_uuid
    AND c.status IN ('auto_allocated', 'accepted', 'in_progress', 'submitted', 'qc_rework')
    ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_vendor_assigned_cases(UUID) TO authenticated;
