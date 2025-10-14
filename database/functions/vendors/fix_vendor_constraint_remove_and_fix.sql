-- =====================================================
-- Remove Constraint and Fix All Data
-- Background Verification Platform
-- =====================================================

-- Step 1: Drop the constraint completely
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_current_vendor_id_consistency_check;

-- Step 2: Fix all gig worker assignments
-- Set current_vendor_id to match the gig worker's vendor_id
UPDATE cases 
SET current_vendor_id = gp.vendor_id
FROM gig_partners gp
WHERE cases.current_assignee_id = gp.id
  AND cases.current_assignee_type = 'gig'
  AND gp.vendor_id IS NOT NULL;

-- Step 3: Fix all vendor assignments
-- Set current_vendor_id to equal current_assignee_id for vendor assignments
UPDATE cases 
SET current_vendor_id = current_assignee_id
WHERE current_assignee_type = 'vendor'
  AND current_assignee_id IS NOT NULL;

-- Step 4: For cases with gig workers that have no vendor, set current_vendor_id to NULL
UPDATE cases 
SET current_vendor_id = NULL
FROM gig_partners gp
WHERE cases.current_assignee_id = gp.id
  AND cases.current_assignee_type = 'gig'
  AND gp.vendor_id IS NULL;

-- Step 5: Verify the data is now consistent
SELECT 
    'Cases with gig assignees and matching vendor_id' as description,
    COUNT(*) as count
FROM cases c
JOIN gig_partners gp ON c.current_assignee_id = gp.id
WHERE c.current_assignee_type = 'gig' 
  AND c.current_vendor_id = gp.vendor_id

UNION ALL

SELECT 
    'Cases with gig assignees but NULL vendor_id (gig worker has no vendor)' as description,
    COUNT(*) as count
FROM cases c
JOIN gig_partners gp ON c.current_assignee_id = gp.id
WHERE c.current_assignee_type = 'gig' 
  AND c.current_vendor_id IS NULL
  AND gp.vendor_id IS NULL

UNION ALL

SELECT 
    'Cases with vendor assignees and matching vendor_id' as description,
    COUNT(*) as count
FROM cases c
WHERE c.current_assignee_type = 'vendor' 
  AND c.current_vendor_id = c.current_assignee_id

UNION ALL

SELECT 
    'Cases with no assignee' as description,
    COUNT(*) as count
FROM cases c
WHERE c.current_assignee_id IS NULL;
