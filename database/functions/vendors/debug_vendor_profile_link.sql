-- =====================================================
-- Debug Vendor Profile Link Issue
-- Background Verification Platform
-- =====================================================

-- Check if the profile exists
SELECT 
    'Profile Check' as section,
    id,
    user_id,
    first_name,
    last_name,
    email,
    role
FROM profiles 
WHERE id = '3f9f50e2-eb8a-4451-996e-ddecadd0c253';

-- Check if there's a vendor record for this profile
SELECT 
    'Vendor Check' as section,
    id,
    name,
    email,
    profile_id,
    created_at
FROM vendors 
WHERE profile_id = '3f9f50e2-eb8a-4451-996e-ddecadd0c253';

-- Check all vendors and their profile links
SELECT 
    'All Vendors' as section,
    v.id as vendor_id,
    v.name as vendor_name,
    v.email as vendor_email,
    v.profile_id,
    p.first_name,
    p.last_name,
    p.email as profile_email,
    p.role
FROM vendors v
LEFT JOIN profiles p ON v.profile_id = p.id
ORDER BY v.created_at DESC;

-- Check if there are any profiles with role 'vendor' that don't have vendor records
SELECT 
    'Orphaned Vendor Profiles' as section,
    p.id as profile_id,
    p.first_name,
    p.last_name,
    p.email,
    p.role,
    p.created_at
FROM profiles p
WHERE p.role = 'vendor'
AND NOT EXISTS (
    SELECT 1 FROM vendors v WHERE v.profile_id = p.id
);
