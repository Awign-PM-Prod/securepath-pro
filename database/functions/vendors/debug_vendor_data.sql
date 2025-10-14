-- =====================================================
-- Debug Vendor Data
-- Background Verification Platform
-- =====================================================

-- Check vendor record
SELECT 
    'Vendor Record' as section,
    v.id as vendor_id,
    v.name as vendor_name,
    v.email,
    v.is_active
FROM vendors v
WHERE v.email = 'vendor6@awign.com';

-- Check gig workers assigned to this vendor
SELECT 
    'Gig Workers for Vendor' as section,
    gp.id as gig_partner_id,
    gp.vendor_id,
    gp.is_direct_gig,
    gp.is_active,
    gp.is_available,
    p.first_name,
    p.last_name,
    p.email,
    p.role
FROM gig_partners gp
JOIN profiles p ON gp.profile_id = p.id
WHERE gp.vendor_id = (SELECT id FROM vendors WHERE email = 'vendor6@awign.com');

-- Check cases assigned to this vendor
SELECT 
    'Cases for Vendor' as section,
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
WHERE c.current_vendor_id = (SELECT id FROM vendors WHERE email = 'vendor6@awign.com');

-- Check available cases (status = 'created')
SELECT 
    'Available Cases' as section,
    c.id as case_id,
    c.case_number,
    c.title,
    c.status,
    cl.name as client_name
FROM cases c
JOIN clients cl ON c.client_id = cl.id
WHERE c.status = 'created'
LIMIT 5;
