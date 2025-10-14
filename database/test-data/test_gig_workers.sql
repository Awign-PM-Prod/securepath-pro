-- =====================================================
-- Test Gig Workers Query
-- Background Verification Platform
-- =====================================================

-- Test the exact query that the function uses
SELECT 
    gp.*,
    p.first_name,
    p.last_name,
    p.email
FROM gig_partners gp
JOIN profiles p ON gp.profile_id = p.id
WHERE gp.vendor_id = '14b53a3d-87fb-414c-af37-fd4aae0c9764'
AND gp.is_active = true
ORDER BY gp.created_at DESC;

-- Test the function directly
SELECT * FROM get_vendor_gig_workers('14b53a3d-87fb-414c-af37-fd4aae0c9764');

-- Check if there are any gig workers with this vendor_id at all
SELECT 
    'All gig workers with this vendor_id' as section,
    gp.id,
    gp.vendor_id,
    gp.is_active,
    p.first_name,
    p.last_name,
    p.email
FROM gig_partners gp
LEFT JOIN profiles p ON gp.profile_id = p.id
WHERE gp.vendor_id = '14b53a3d-87fb-414c-af37-fd4aae0c9764';
