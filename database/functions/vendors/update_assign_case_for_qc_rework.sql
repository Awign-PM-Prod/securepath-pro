-- =====================================================
-- Update assign_case_to_gig_worker for QC Rework Cases
-- Background Verification Platform
-- =====================================================

-- Update the assignment function to handle QC rework cases
CREATE OR REPLACE FUNCTION assign_case_to_gig_worker(
    p_case_id UUID,
    p_gig_worker_id UUID,
    p_vendor_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    gig_worker_vendor_id UUID;
    case_status TEXT;
    rework_deadline TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get the gig worker's vendor_id
    SELECT vendor_id INTO gig_worker_vendor_id
    FROM gig_partners 
    WHERE id = p_gig_worker_id;
    
    -- Check if the gig worker belongs to the vendor
    IF gig_worker_vendor_id IS NULL OR gig_worker_vendor_id != p_vendor_id THEN
        RAISE EXCEPTION 'Gig worker does not belong to the specified vendor';
    END IF;
    
    -- Get current case status
    SELECT status INTO case_status
    FROM cases 
    WHERE id = p_case_id;
    
    -- For QC rework cases, set status to 'auto_allocated' and add 30-minute timer
    IF case_status = 'qc_rework' THEN
        rework_deadline := NOW() + INTERVAL '30 minutes';
        
        UPDATE cases 
        SET 
            current_assignee_id = p_gig_worker_id,
            current_assignee_type = 'gig',
            current_vendor_id = p_vendor_id,
            status = 'auto_allocated',
            status_updated_at = NOW(),
            due_at = rework_deadline
        WHERE id = p_case_id;
    ELSE
        -- For other cases, use the existing logic
        UPDATE cases 
        SET 
            current_assignee_id = p_gig_worker_id,
            current_assignee_type = 'gig',
            current_vendor_id = p_vendor_id,
            status = 'accepted',
            status_updated_at = NOW()
        WHERE id = p_case_id;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION assign_case_to_gig_worker(UUID, UUID, UUID) TO authenticated;



