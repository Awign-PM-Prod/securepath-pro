-- =====================================================
-- Complete Fix for Vendor Constraint Issue
-- Background Verification Platform
-- =====================================================

-- Step 1: Drop the existing constraint
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_current_vendor_id_consistency_check;

-- Step 2: Fix existing data
-- Update cases where current_assignee_type = 'gig' but current_vendor_id doesn't match
-- the gig worker's vendor_id
UPDATE cases 
SET current_vendor_id = gp.vendor_id
FROM gig_partners gp
WHERE cases.current_assignee_id = gp.id
  AND cases.current_assignee_type = 'gig'
  AND cases.current_vendor_id IS NOT NULL
  AND cases.current_vendor_id != gp.vendor_id;

-- Update cases where current_assignee_type = 'gig' but current_vendor_id is NULL
-- and the gig worker has a vendor_id
UPDATE cases 
SET current_vendor_id = gp.vendor_id
FROM gig_partners gp
WHERE cases.current_assignee_id = gp.id
  AND cases.current_assignee_type = 'gig'
  AND cases.current_vendor_id IS NULL
  AND gp.vendor_id IS NOT NULL;

-- Step 3: Create the corrected constraint
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

-- Step 4: Create/Update the assignment function
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

-- Step 5: Verify the fix worked
SELECT 
    'Cases with gig assignees and matching vendor_id' as description,
    COUNT(*) as count
FROM cases c
JOIN gig_partners gp ON c.current_assignee_id = gp.id
WHERE c.current_assignee_type = 'gig' 
  AND c.current_vendor_id = gp.vendor_id

UNION ALL

SELECT 
    'Cases with gig assignees but NULL vendor_id' as description,
    COUNT(*) as count
FROM cases c
JOIN gig_partners gp ON c.current_assignee_id = gp.id
WHERE c.current_assignee_type = 'gig' 
  AND c.current_vendor_id IS NULL

UNION ALL

SELECT 
    'Cases with gig assignees and mismatched vendor_id' as description,
    COUNT(*) as count
FROM cases c
JOIN gig_partners gp ON c.current_assignee_id = gp.id
WHERE c.current_assignee_type = 'gig' 
  AND c.current_vendor_id IS NOT NULL
  AND c.current_vendor_id != gp.vendor_id;
