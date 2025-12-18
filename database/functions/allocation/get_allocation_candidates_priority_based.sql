-- =====================================================
-- Priority-Based Allocation Function
-- Implements 8-Step Allocation Priority Order
-- Background Verification Platform
-- =====================================================

-- Drop existing functions
DROP FUNCTION IF EXISTS get_allocation_candidates(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_allocation_candidates(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_allocation_candidates_safe(UUID, TEXT, TEXT, TEXT);

-- Create comprehensive allocation function with 8-step priority order
CREATE OR REPLACE FUNCTION get_allocation_candidates(
    p_case_id UUID,
    p_pincode TEXT,
    p_pincode_tier TEXT,
    p_case_priority TEXT DEFAULT 'medium'
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
    distance_km NUMERIC,
    vendor_name TEXT,
    vendor_performance_score NUMERIC,
    vendor_quality_score NUMERIC,
    -- New fields for priority-based allocation
    location_match_type TEXT, -- 'pincode', 'city', 'tier'
    experience_score NUMERIC,
    total_score NUMERIC, -- Overall performance score (calculated from 4 metrics using allocation_config weights)
    priority_boost NUMERIC
) 
SECURITY DEFINER
AS $func$
DECLARE
    case_location_id UUID;
    case_pincode TEXT;
    case_city TEXT;
    case_state TEXT;
    case_tier TEXT;
    case_priority_level TEXT;
    -- Escalation count (placeholder - would need escalation tracking table)
    escalation_penalty NUMERIC := 0;
    -- Quality thresholds from allocation_config
    min_quality_score_threshold NUMERIC;
    min_completion_rate_threshold NUMERIC;
    min_acceptance_rate_threshold NUMERIC;
BEGIN
    -- Get quality thresholds from allocation_config
    SELECT 
        (config_value->>'min_quality_score')::NUMERIC,
        (config_value->>'min_completion_rate')::NUMERIC,
        (config_value->>'min_acceptance_rate')::NUMERIC
    INTO 
        min_quality_score_threshold,
        min_completion_rate_threshold,
        min_acceptance_rate_threshold
    FROM public.allocation_config
    WHERE config_key = 'quality_thresholds'
      AND is_active = true
    LIMIT 1;
    
    -- Use default thresholds if not configured
    min_quality_score_threshold := COALESCE(min_quality_score_threshold, 0.30);
    min_completion_rate_threshold := COALESCE(min_completion_rate_threshold, 0.30);
    min_acceptance_rate_threshold := COALESCE(min_acceptance_rate_threshold, 0.30);
    
    -- Get case location details
    SELECT c.location_id, l.pincode, l.city, l.state, l.pincode_tier::TEXT, c.priority::TEXT
    INTO case_location_id, case_pincode, case_city, case_state, case_tier, case_priority_level
    FROM cases c
    JOIN locations l ON c.location_id = l.id
    WHERE c.id = p_case_id;
    
    -- Use provided parameters if case not found
    IF case_location_id IS NULL THEN
        case_pincode := p_pincode;
        case_tier := p_pincode_tier;
        case_priority_level := COALESCE(p_case_priority, 'medium');
    ELSE
        -- case_priority_level already set from SELECT above
        case_priority_level := COALESCE(case_priority_level, p_case_priority, 'medium');
    END IF;
    
    -- Return gig workers (direct assignment only) and vendors
    -- Implementing 8-step priority order
    RETURN QUERY
    WITH candidate_base AS (
        -- Direct gig workers
        SELECT 
            gp.id as candidate_id,
            'gig'::TEXT as candidate_type,
            gp.vendor_id,
            COALESCE(p.first_name || ' ' || p.last_name, 'Unknown') as candidate_name,
            p.phone,
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
            gp.city as worker_city,
            gp.state as worker_state,
            p.role as worker_role,
            -- Step 1 & 2: Location matching (pincode first, then city)
            CASE 
                WHEN case_pincode = ANY(gp.coverage_pincodes) OR gp.coverage_pincodes @> ARRAY[case_pincode] THEN 'pincode'
                WHEN case_city IS NOT NULL AND gp.city = case_city THEN 'city'
                WHEN gp.coverage_pincodes @> ARRAY[case_tier] THEN 'tier'
                ELSE NULL
            END as location_match_type,
            -- Step 6: Experience score (based on total cases completed)
            CASE 
                WHEN gp.total_cases_completed >= 100 THEN 1.0
                WHEN gp.total_cases_completed >= 50 THEN 0.8
                WHEN gp.total_cases_completed >= 20 THEN 0.6
                WHEN gp.total_cases_completed >= 10 THEN 0.4
                WHEN gp.total_cases_completed >= 5 THEN 0.2
                ELSE 0.1
            END as experience_score,
            -- Step 8: Use total_score instead of individual metrics
            -- total_score already includes all 4 metrics weighted according to allocation_config
            COALESCE(gp.total_score, 0.00) as total_score,
            -- Step 7: Priority boost for high-priority cases (prioritize best agents based on total_score)
            CASE 
                WHEN case_priority_level IN ('urgent', 'high') THEN 
                    COALESCE(gp.total_score, 0.00) * 2.0
                ELSE 0.0
            END as priority_boost
        FROM gig_partners gp
        JOIN profiles p ON gp.profile_id = p.id
        LEFT JOIN vendors v ON gp.vendor_id = v.id
        WHERE 
            -- Step 3: Agent Eligibility-Based Allocation
            -- Check role eligibility (gig_worker role required)
            p.role = 'gig_worker'
            -- Step 4: Agent Availability-Based Allocation
            AND gp.is_active = true 
            AND gp.is_available = true
            -- Only include gig workers who signed in today (last_seen_at >= today)
            AND gp.last_seen_at >= CURRENT_DATE
            -- Include both direct and vendor-based gig workers
            -- Step 5: Current Capacity-Based Allocation
            AND gp.capacity_available > 0
            AND gp.active_cases_count < gp.max_daily_capacity  -- Not fully engaged
            -- Step 1 & 2: Location matching (pincode or city or tier)
            AND (
                -- Pin-Code Wise Allocation (Step 1)
                case_pincode = ANY(gp.coverage_pincodes) 
                OR gp.coverage_pincodes @> ARRAY[case_pincode]
                -- City-Wise Allocation (Step 2) - fallback if no pincode match
                OR (case_city IS NOT NULL AND gp.city = case_city)
                -- Tier-based fallback
                OR gp.coverage_pincodes @> ARRAY[case_tier]
            )
            -- Quality Thresholds Filter: Exclude workers below minimum thresholds
            AND COALESCE(gp.quality_score, 0.00) >= min_quality_score_threshold
            AND COALESCE(gp.completion_rate, 0.00) >= min_completion_rate_threshold
            AND COALESCE(gp.acceptance_rate, 0.00) >= min_acceptance_rate_threshold
    ),
    candidate_scored AS (
        SELECT 
            cb.*,
            v.name as vendor_name,
            v.performance_score as vendor_performance_score,
            v.quality_score as vendor_quality_score,
            -- Calculate distance (placeholder - would need geocoding)
            0.0::NUMERIC as distance_km
        FROM candidate_base cb
        LEFT JOIN vendors v ON cb.vendor_id = v.id
        WHERE cb.location_match_type IS NOT NULL  -- Must have location match
    )
    SELECT 
        cs.candidate_id,
        cs.candidate_type,
        cs.vendor_id,
        cs.candidate_name,
        cs.phone,
        cs.email,
        cs.pincode,
        cs.coverage_pincodes,
        cs.max_daily_capacity,
        cs.capacity_available,
        cs.completion_rate,
        cs.ontime_completion_rate,
        cs.acceptance_rate,
        cs.quality_score,
        cs.qc_pass_count,
        cs.total_cases_completed,
        cs.active_cases_count,
        cs.last_assignment_at,
        cs.is_direct_gig,
        cs.is_active,
        cs.is_available,
        cs.distance_km,
        cs.vendor_name,
        cs.vendor_performance_score,
        cs.vendor_quality_score,
        cs.location_match_type,
        cs.experience_score,
        cs.total_score,
        cs.priority_boost
    FROM candidate_scored cs
    -- Order by priority-based scoring:
    -- 1. Location match type (pincode > city > tier)
    -- 2. Priority boost (for urgent/high priority cases)
    -- 3. Experience score (higher experience preferred)
    -- 4. Total score (overall performance - includes all 4 metrics weighted by allocation_config)
    -- 5. Capacity available (more capacity preferred for load balancing)
    ORDER BY 
        CASE cs.location_match_type 
            WHEN 'pincode' THEN 1 
            WHEN 'city' THEN 2 
            WHEN 'tier' THEN 3 
            ELSE 4 
        END,
        cs.priority_boost DESC,
        cs.experience_score DESC,
        cs.total_score DESC,
        cs.capacity_available DESC;
    
    -- Also return vendors (simplified for now)
    RETURN QUERY
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
        (COALESCE(v.quality_score, 0) * 0.6 + COALESCE(v.performance_score, 0) * 0.4) as performance_score,
        0.0::NUMERIC as distance_km,
        v.name as vendor_name,
        v.performance_score as vendor_performance_score,
        v.quality_score as vendor_quality_score,
        CASE 
            WHEN case_pincode = ANY(v.coverage_pincodes) OR v.coverage_pincodes @> ARRAY[case_pincode] THEN 'pincode'
            WHEN case_city IS NOT NULL AND v.city = case_city THEN 'city'
            WHEN v.coverage_pincodes @> ARRAY[case_tier] THEN 'tier'
            ELSE 'tier'
        END as location_match_type,
        0.5::NUMERIC as experience_score, -- Default for vendors
        (COALESCE(v.quality_score, 0) * 0.5 + COALESCE(v.performance_score, 0) * 0.5) as reliability_score,
        CASE 
            WHEN case_priority_level IN ('urgent', 'high') THEN COALESCE(v.quality_score, 0) * 2.0
            ELSE 0.0
        END as priority_boost
    FROM vendors v
    WHERE v.is_active = true
      AND v.capacity_available > 0
      AND (
          case_pincode = ANY(v.coverage_pincodes) 
          OR v.coverage_pincodes @> ARRAY[case_pincode]
          OR (case_city IS NOT NULL AND v.city = case_city)
          OR v.coverage_pincodes @> ARRAY[case_tier]
      )
      -- Note: Performance/quality thresholds removed for vendors as well
    ORDER BY 
        CASE 
            WHEN case_pincode = ANY(v.coverage_pincodes) OR v.coverage_pincodes @> ARRAY[case_pincode] THEN 1
            WHEN case_city IS NOT NULL AND v.city = case_city THEN 2
            ELSE 3
        END,
        v.quality_score DESC,
        v.performance_score DESC,
        v.capacity_available DESC;
    
END;
$func$ LANGUAGE plpgsql;

-- Create overloaded version without priority (for backward compatibility)
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
    vendor_quality_score NUMERIC,
    location_match_type TEXT,
    experience_score NUMERIC,
    reliability_score NUMERIC,
    priority_boost NUMERIC
) 
AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM get_allocation_candidates(p_case_id, p_pincode, p_pincode_tier, 'medium'::TEXT);
END;
$$ LANGUAGE plpgsql;

-- Create the safe version with error handling
CREATE OR REPLACE FUNCTION get_allocation_candidates_safe(
    p_case_id UUID,
    p_pincode TEXT,
    p_pincode_tier TEXT,
    p_case_priority TEXT DEFAULT 'medium'
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
    vendor_quality_score NUMERIC,
    location_match_type TEXT,
    experience_score NUMERIC,
    reliability_score NUMERIC,
    priority_boost NUMERIC
) 
SECURITY DEFINER
AS $func$
BEGIN
    -- Call the main function with error handling
    RETURN QUERY
    SELECT * FROM get_allocation_candidates(p_case_id, p_pincode, p_pincode_tier, p_case_priority);
    
EXCEPTION
    WHEN OTHERS THEN
        -- Return empty result on error
        RETURN;
END;
$func$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_allocation_candidates(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_allocation_candidates(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_allocation_candidates_safe(UUID, TEXT, TEXT, TEXT) TO authenticated;

