-- =====================================================
-- Fix Vendor Functions - RLS Issues
-- Background Verification Platform
-- =====================================================

-- Drop and recreate the functions with SECURITY DEFINER to bypass RLS
DROP FUNCTION IF EXISTS get_vendor_gig_workers(UUID);
DROP FUNCTION IF EXISTS get_vendor_assigned_cases(UUID);

-- Function to get gig workers for a vendor (with SECURITY DEFINER)
CREATE OR REPLACE FUNCTION get_vendor_gig_workers(vendor_uuid UUID)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    profile_id UUID,
    phone TEXT,
    alternate_phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    country TEXT,
    coverage_pincodes TEXT[],
    max_daily_capacity INTEGER,
    capacity_available INTEGER,
    last_capacity_reset TIMESTAMPTZ,
    completion_rate NUMERIC,
    ontime_completion_rate NUMERIC,
    acceptance_rate NUMERIC,
    quality_score NUMERIC,
    qc_pass_count INTEGER,
    total_cases_completed INTEGER,
    active_cases_count INTEGER,
    last_assignment_at TIMESTAMPTZ,
    vendor_id UUID,
    is_direct_gig BOOLEAN,
    device_info JSONB,
    last_seen_at TIMESTAMPTZ,
    is_active BOOLEAN,
    is_available BOOLEAN,
    created_by UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    first_name TEXT,
    last_name TEXT,
    email TEXT
) 
SECURITY DEFINER  -- This bypasses RLS
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gp.*,
        p.first_name,
        p.last_name,
        p.email
    FROM gig_partners gp
    JOIN profiles p ON gp.profile_id = p.id
    WHERE gp.vendor_id = vendor_uuid
    AND gp.is_active = true
    ORDER BY gp.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get assigned cases for a vendor (with SECURITY DEFINER)
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
    client_name TEXT,
    client_email TEXT
) 
SECURITY DEFINER  -- This bypasses RLS
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.case_number,
        c.title,
        c.description,
        c.priority::TEXT,  -- Cast enum to text
        c.source::TEXT,    -- Cast enum to text
        c.client_id,
        c.location_id,
        c.tat_hours,
        c.due_at,
        c.created_at,
        c.current_assignee_id,
        c.current_assignee_type::TEXT,  -- Cast enum to text
        c.current_vendor_id,
        c.status::TEXT,    -- Cast enum to text
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
        cl.name as client_name,
        cl.email as client_email
    FROM cases c
    JOIN locations l ON c.location_id = l.id
    JOIN clients cl ON c.client_id = cl.id
    WHERE c.current_vendor_id = vendor_uuid
    AND c.status IN ('auto_allocated', 'in_progress', 'submitted')
    ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql;
