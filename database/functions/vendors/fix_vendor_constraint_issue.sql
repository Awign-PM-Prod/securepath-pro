-- =====================================================
-- Fix Vendor Constraint Issue
-- Background Verification Platform
-- =====================================================

-- First, let's check what the constraint actually does
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'cases'::regclass
  AND conname LIKE '%vendor%consistency%';

-- If the constraint requires that gig workers belong to the vendor,
-- we need to ensure the gig worker's vendor_id matches the case's current_vendor_id
-- Let's create a function to handle this properly

CREATE OR REPLACE FUNCTION assign_case_to_gig_worker(
    p_case_id UUID,
    p_gig_worker_id UUID,
    p_vendor_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    gig_worker_vendor_id UUID;
BEGIN
    -- Get the gig worker's vendor_id
    SELECT vendor_id INTO gig_worker_vendor_id
    FROM gig_partners 
    WHERE id = p_gig_worker_id;
    
    -- Check if the gig worker belongs to the vendor
    IF gig_worker_vendor_id IS NULL OR gig_worker_vendor_id != p_vendor_id THEN
        RAISE EXCEPTION 'Gig worker does not belong to the specified vendor';
    END IF;
    
    -- Update the case
    UPDATE cases 
    SET 
        current_assignee_id = p_gig_worker_id,
        current_assignee_type = 'gig',
        current_vendor_id = p_vendor_id,
        status = 'accepted',
        status_updated_at = now()
    WHERE id = p_case_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION assign_case_to_gig_worker(UUID, UUID, UUID) TO authenticated;
