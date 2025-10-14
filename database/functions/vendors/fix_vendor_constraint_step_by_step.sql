-- =====================================================
-- Step-by-Step Fix for Vendor Constraint Issue
-- Background Verification Platform
-- =====================================================

-- Step 1: First, let's see what data we have that's causing issues
SELECT 
    'All cases with assignees' as description,
    COUNT(*) as count
FROM cases 
WHERE current_assignee_id IS NOT NULL;

-- Step 2: Check cases with gig assignees
SELECT 
    'Cases with gig assignees' as description,
    COUNT(*) as count
FROM cases 
WHERE current_assignee_type = 'gig';

-- Step 3: Check cases with vendor assignees
SELECT 
    'Cases with vendor assignees' as description,
    COUNT(*) as count
FROM cases 
WHERE current_assignee_type = 'vendor';

-- Step 4: Check for problematic cases - gig workers with wrong vendor_id
SELECT 
    c.id,
    c.case_number,
    c.current_assignee_id,
    c.current_assignee_type,
    c.current_vendor_id,
    gp.vendor_id as gig_worker_vendor_id,
    gp.first_name,
    gp.last_name
FROM cases c
LEFT JOIN gig_partners gp ON c.current_assignee_id = gp.id
WHERE c.current_assignee_type = 'gig' 
  AND c.current_vendor_id IS NOT NULL
  AND gp.vendor_id IS NOT NULL
  AND c.current_vendor_id != gp.vendor_id;

-- Step 5: Check for gig workers with NULL vendor_id in cases
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

-- Step 6: Check for cases with vendor assignees but wrong vendor_id
SELECT 
    c.id,
    c.case_number,
    c.current_assignee_id,
    c.current_assignee_type,
    c.current_vendor_id
FROM cases c
WHERE c.current_assignee_type = 'vendor' 
  AND c.current_vendor_id IS NOT NULL
  AND c.current_vendor_id != c.current_assignee_id;
