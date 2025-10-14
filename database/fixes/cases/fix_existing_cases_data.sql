-- =====================================================
-- Fix Existing Cases Data Before Applying New Constraint
-- Background Verification Platform
-- =====================================================

-- First, let's see what data we have that might violate the constraint
SELECT 
    id,
    case_number,
    current_assignee_id,
    current_assignee_type,
    current_vendor_id,
    status
FROM cases 
WHERE current_assignee_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- Check for cases where current_assignee_type = 'gig' but current_vendor_id doesn't match
-- the gig worker's vendor_id
SELECT 
    c.id,
    c.case_number,
    c.current_assignee_id,
    c.current_assignee_type,
    c.current_vendor_id,
    gp.vendor_id as gig_worker_vendor_id
FROM cases c
LEFT JOIN gig_partners gp ON c.current_assignee_id = gp.id
WHERE c.current_assignee_type = 'gig' 
  AND c.current_vendor_id IS NOT NULL
  AND gp.vendor_id IS NOT NULL
  AND c.current_vendor_id != gp.vendor_id;

-- Fix the data by updating current_vendor_id to match the gig worker's vendor
UPDATE cases 
SET current_vendor_id = gp.vendor_id
FROM gig_partners gp
WHERE cases.current_assignee_id = gp.id
  AND cases.current_assignee_type = 'gig'
  AND cases.current_vendor_id IS NOT NULL
  AND cases.current_vendor_id != gp.vendor_id;

-- Check for cases where current_assignee_type = 'gig' but current_vendor_id is NULL
-- and the gig worker has a vendor_id
SELECT 
    c.id,
    c.case_number,
    c.current_assignee_id,
    c.current_assignee_type,
    c.current_vendor_id,
    gp.vendor_id as gig_worker_vendor_id
FROM cases c
LEFT JOIN gig_partners gp ON c.current_assignee_id = gp.id
WHERE c.current_assignee_type = 'gig' 
  AND c.current_vendor_id IS NULL
  AND gp.vendor_id IS NOT NULL;

-- Fix these cases by setting current_vendor_id to the gig worker's vendor
UPDATE cases 
SET current_vendor_id = gp.vendor_id
FROM gig_partners gp
WHERE cases.current_assignee_id = gp.id
  AND cases.current_assignee_type = 'gig'
  AND cases.current_vendor_id IS NULL
  AND gp.vendor_id IS NOT NULL;

-- Now let's verify the data is consistent
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
