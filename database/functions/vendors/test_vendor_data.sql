-- =====================================================
-- Test Vendor Data - Simple Queries
-- Background Verification Platform
-- =====================================================

-- 1. Check all vendors
SELECT 
    'All Vendors' as section,
    id,
    name,
    email,
    is_active
FROM vendors
ORDER BY created_at DESC;

-- 2. Check all gig workers and their vendor assignments
SELECT 
    'All Gig Workers' as section,
    gp.id as gig_partner_id,
    gp.vendor_id,
    gp.is_direct_gig,
    gp.is_active,
    p.first_name,
    p.last_name,
    p.email
FROM gig_partners gp
JOIN profiles p ON gp.profile_id = p.id
ORDER BY gp.created_at DESC;

-- 3. Check all cases and their vendor assignments
SELECT 
    'All Cases' as section,
    c.id as case_id,
    c.case_number,
    c.title,
    c.status,
    c.current_vendor_id,
    c.current_assignee_id,
    c.current_assignee_type,
    cl.name as client_name
FROM cases c
JOIN clients cl ON c.client_id = cl.id
ORDER BY c.created_at DESC
LIMIT 10;
