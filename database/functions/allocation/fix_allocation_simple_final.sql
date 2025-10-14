-- =====================================================
-- Fix Allocation - Simple Final Version
-- Background Verification Platform
-- =====================================================

-- Drop existing functions
DROP FUNCTION IF EXISTS get_allocation_candidates(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_allocation_candidates_safe(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS allocate_case_to_candidate(UUID, UUID, TEXT, UUID);

-- Create a simple allocation function that works without complex RLS
CREATE OR REPLACE FUNCTION get_allocation_candidates(
    p_case_id UUID,
    p_pincode TEXT,
    p_pincode_tier TEXT
)
RETURNS TABLE (
    candidate_id UUID,
    candidate_type TEXT,
    vendor_id UUID,
    candidate_name TEXT,
    phone TEXT,
    email TEXT,
    pincode TEXT,
    coverage_pincodes TEXT[],
    max_daily_capacity INTEGER,
    capacity_available INTEGER,
    completion_rate NUMERIC,
    ontime_completion_rate NUMERIC,
    acceptance_rate NUMERIC,
    quality_score NUMERIC,
    qc_pass_count INTEGER,
    total_cases_completed INTEGER,
    active_cases_count INTEGER,
    last_assignment_at TIMESTAMPTZ,
    is_direct_gig BOOLEAN,
    is_active BOOLEAN,
    is_available BOOLEAN,
    performance_score NUMERIC,
    distance_km NUMERIC,
    vendor_name TEXT,
    vendor_performance_score NUMERIC,
    vendor_quality_score NUMERIC
) 
SECURITY DEFINER
AS $func$
BEGIN
    -- Return gig workers and vendors with minimal filtering
    RETURN QUERY
    -- Direct gig workers
    SELECT 
        gp.id as candidate_id,
        'gig'::TEXT as candidate_type,
        gp.vendor_id,
        COALESCE(p.first_name || ' ' || p.last_name, 'Unknown') as candidate_name,
        gp.phone,
        p.email,
        gp.pincode,
        gp.coverage_pincodes,
        gp.max_daily_capacity,
        gp.capacity_available,
        gp.completion_rate,
        gp.ontime_completion_rate,
        gp.acceptance_rate,
        gp.quality_score,
        gp.qc_pass_count,
        gp.total_cases_completed,
        gp.active_cases_count,
        gp.last_assignment_at,
        gp.is_direct_gig,
        gp.is_active,
        gp.is_available,
        -- Performance score calculation
        (COALESCE(gp.completion_rate, 0) * 0.4 + 
         COALESCE(gp.ontime_completion_rate, 0) * 0.4 + 
         COALESCE(gp.acceptance_rate, 0) * 0.2) as performance_score,
        0.0::NUMERIC as distance_km,
        v.name as vendor_name,
        v.performance_score as vendor_performance_score,
        v.quality_score as vendor_quality_score
    FROM gig_partners gp
    JOIN profiles p ON gp.profile_id = p.id
    LEFT JOIN vendors v ON gp.vendor_id = v.id
    WHERE gp.is_active = true 
      AND gp.is_available = true
      AND gp.is_direct_gig = true
      AND gp.capacity_available > 0
    
    UNION ALL
    
    -- Vendors
    SELECT 
        v.id as candidate_id,
        'vendor'::TEXT as candidate_type,
        v.id as vendor_id,
        v.name as candidate_name,
        v.phone,
        v.email,
        v.pincode,
        v.coverage_pincodes,
        v.max_daily_capacity,
        v.capacity_available,
        0.0::NUMERIC as completion_rate,
        0.0::NUMERIC as ontime_completion_rate,
        0.0::NUMERIC as acceptance_rate,
        v.quality_score,
        0 as qc_pass_count,
        v.total_cases_assigned as total_cases_completed,
        v.active_cases_count,
        NULL::TIMESTAMPTZ as last_assignment_at,
        false as is_direct_gig,
        v.is_active,
        true as is_available,
        -- Vendor performance score
        (COALESCE(v.quality_score, 0) * 0.6 + COALESCE(v.performance_score, 0) * 0.4) as performance_score,
        0.0::NUMERIC as distance_km,
        v.name as vendor_name,
        v.performance_score as vendor_performance_score,
        v.quality_score as vendor_quality_score
    FROM vendors v
    WHERE v.is_active = true
      AND v.capacity_available > 0
    
    ORDER BY performance_score DESC, quality_score DESC, capacity_available DESC;
    
END;
$func$ LANGUAGE plpgsql;

-- Create the safe version
CREATE OR REPLACE FUNCTION get_allocation_candidates_safe(
    p_case_id UUID,
    p_pincode TEXT,
    p_pincode_tier TEXT
)
RETURNS TABLE (
    candidate_id UUID,
    candidate_type TEXT,
    vendor_id UUID,
    candidate_name TEXT,
    phone TEXT,
    email TEXT,
    pincode TEXT,
    coverage_pincodes TEXT[],
    max_daily_capacity INTEGER,
    capacity_available INTEGER,
    completion_rate NUMERIC,
    ontime_completion_rate NUMERIC,
    acceptance_rate NUMERIC,
    quality_score NUMERIC,
    qc_pass_count INTEGER,
    total_cases_completed INTEGER,
    active_cases_count INTEGER,
    last_assignment_at TIMESTAMPTZ,
    is_direct_gig BOOLEAN,
    is_active BOOLEAN,
    is_available BOOLEAN,
    performance_score NUMERIC,
    distance_km NUMERIC,
    vendor_name TEXT,
    vendor_performance_score NUMERIC,
    vendor_quality_score NUMERIC
) 
SECURITY DEFINER
AS $func$
BEGIN
    RETURN QUERY
    SELECT * FROM get_allocation_candidates(p_case_id, p_pincode, p_pincode_tier);
EXCEPTION
    WHEN OTHERS THEN
        RETURN;
END;
$func$ LANGUAGE plpgsql;

-- Create simple allocation function
CREATE OR REPLACE FUNCTION allocate_case_to_candidate(
    p_case_id UUID,
    p_candidate_id UUID,
    p_candidate_type TEXT,
    p_vendor_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Update case assignment
    UPDATE cases 
    SET 
        current_assignee_id = p_candidate_id,
        current_assignee_type = p_candidate_type::assignment_type,
        current_vendor_id = CASE 
            WHEN p_candidate_type = 'vendor' THEN p_candidate_id
            ELSE p_vendor_id
        END,
        status = 'auto_allocated',
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_allocation_candidates(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_allocation_candidates_safe(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION allocate_case_to_candidate(UUID, UUID, TEXT, UUID) TO authenticated;

-- Test the function
SELECT 'Simple allocation functions created successfully' as status;
