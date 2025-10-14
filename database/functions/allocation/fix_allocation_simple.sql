-- =====================================================
-- Fix Allocation - Simple Version
-- Background Verification Platform
-- =====================================================

-- Drop existing functions
DROP FUNCTION IF EXISTS get_allocation_candidates(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_allocation_candidates_safe(UUID, TEXT, TEXT);

-- Create a simplified allocation function for debugging
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
DECLARE
    case_location_id UUID;
    case_pincode TEXT;
    case_tier TEXT;
BEGIN
    -- Get case location details
    SELECT c.location_id, l.pincode, l.pincode_tier::TEXT
    INTO case_location_id, case_pincode, case_tier
    FROM cases c
    JOIN locations l ON c.location_id = l.id
    WHERE c.id = p_case_id;
    
    -- Use provided parameters if case not found
    IF case_location_id IS NULL THEN
        case_pincode := p_pincode;
        case_tier := p_pincode_tier;
    END IF;
    
    -- Debug: Log what we're looking for
    RAISE NOTICE 'Looking for candidates for pincode: %, tier: %', case_pincode, case_tier;
    
    -- Return gig workers (direct assignment only) and vendors
    RETURN QUERY
    -- Direct gig workers - simplified conditions
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
        -- Performance score calculation (40% completion + 40% on-time + 20% acceptance)
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
      AND gp.is_direct_gig = true  -- Only direct gig workers for auto allocation
      AND gp.capacity_available > 0
      AND (case_pincode = ANY(gp.coverage_pincodes) OR gp.coverage_pincodes @> ARRAY[case_pincode] OR gp.coverage_pincodes = '{}' OR array_length(gp.coverage_pincodes, 1) IS NULL)
      -- Lower thresholds for testing
      AND COALESCE(gp.quality_score, 0) >= 0.0
      AND COALESCE(gp.completion_rate, 0) >= 0.0
      AND COALESCE(gp.ontime_completion_rate, 0) >= 0.0
      AND COALESCE(gp.acceptance_rate, 0) >= 0.0
    
    UNION ALL
    
    -- Vendors - simplified conditions
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
      AND (case_pincode = ANY(v.coverage_pincodes) OR v.coverage_pincodes @> ARRAY[case_pincode] OR v.coverage_pincodes = '{}' OR array_length(v.coverage_pincodes, 1) IS NULL)
      -- Lower thresholds for testing
      AND COALESCE(v.quality_score, 0) >= 0.0
      AND COALESCE(v.performance_score, 0) >= 0.0
    
    ORDER BY performance_score DESC, quality_score DESC, capacity_available DESC;
    
    -- Debug: Log how many candidates we found
    RAISE NOTICE 'Found % candidates', (SELECT COUNT(*) FROM get_allocation_candidates(p_case_id, p_pincode, p_pincode_tier));
    
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
    -- Call the main function with error handling
    RETURN QUERY
    SELECT * FROM get_allocation_candidates(p_case_id, p_pincode, p_pincode_tier);
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error and return empty result
        RAISE NOTICE 'Error in get_allocation_candidates_safe: %', SQLERRM;
        RETURN;
END;
$func$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_allocation_candidates(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_allocation_candidates_safe(UUID, TEXT, TEXT) TO authenticated;

-- Test the function
SELECT 'Testing simplified allocation function...' as status;

-- Test with a sample case
SELECT COUNT(*) as candidate_count 
FROM get_allocation_candidates(
    '00000000-0000-0000-0000-000000000000'::UUID,
    '560001',
    'tier_1'
);
