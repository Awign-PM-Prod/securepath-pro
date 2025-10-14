-- =====================================================
-- Fix Vendor Constraint - Simple Approach
-- Background Verification Platform
-- =====================================================

-- Drop the problematic constraint
ALTER TABLE cases DROP CONSTRAINT cases_current_vendor_id_consistency_check;

-- Create a simpler constraint that allows the current logic
ALTER TABLE cases ADD CONSTRAINT cases_current_vendor_id_consistency_check 
CHECK (
  -- When assignee type is 'vendor', vendor_id should equal assignee_id
  (
    (current_assignee_type = 'vendor'::assignment_type) AND 
    (current_vendor_id IS NOT NULL) AND 
    (current_vendor_id = current_assignee_id)
  ) OR 
  -- When assignee type is 'gig', vendor_id can be any valid vendor ID
  (
    (current_assignee_type = 'gig'::assignment_type) AND 
    (current_vendor_id IS NOT NULL)
  ) OR 
  -- When no assignee, vendor_id can be null
  (current_assignee_id IS NULL)
);

-- Update the assignment function
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
