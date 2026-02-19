-- =====================================================
-- Fix Allocation with Capacity Validation
-- Background Verification Platform
-- =====================================================

-- Drop and recreate the allocation function with proper capacity checking
DROP FUNCTION IF EXISTS allocate_case_to_candidate(UUID, UUID, TEXT, UUID);

CREATE OR REPLACE FUNCTION allocate_case_to_candidate(
    p_case_id UUID,
    p_candidate_id UUID,
    p_candidate_type TEXT,
    p_vendor_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    current_capacity INTEGER;
    max_capacity INTEGER;
BEGIN
    -- Check capacity before allocating
    IF p_candidate_type = 'gig' THEN
        SELECT capacity_available, max_daily_capacity 
        INTO current_capacity, max_capacity
        FROM gig_partners 
        WHERE id = p_candidate_id;
        
        -- If no capacity, return false (don't throw error)
        IF current_capacity IS NULL OR current_capacity <= 0 THEN
            RETURN FALSE;
        END IF;
    ELSIF p_candidate_type = 'vendor' THEN
        SELECT capacity_available, max_daily_capacity 
        INTO current_capacity, max_capacity
        FROM vendors 
        WHERE id = p_candidate_id;
        
        -- If no capacity, return false (don't throw error)
        IF current_capacity IS NULL OR current_capacity <= 0 THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Update case assignment
    UPDATE cases 
    SET 
        current_assignee_id = p_candidate_id,
        current_assignee_type = p_candidate_type::assignment_type,
        current_vendor_id = CASE 
            WHEN p_candidate_type = 'vendor' THEN p_candidate_id
            ELSE p_vendor_id
        END,
        status = 'allocated',
        allocation_method = 'auto',
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
        -- Log error but don't crash
        RAISE WARNING 'Allocation error: %', SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION allocate_case_to_candidate(UUID, UUID, TEXT, UUID) TO authenticated;

SELECT 'Allocation function updated with capacity validation' as status;
