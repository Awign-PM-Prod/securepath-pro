-- =====================================================
-- Debug User Role and Permissions
-- Background Verification Platform
-- =====================================================

-- Check current user's role
SELECT 
  'Current User Info' as section,
  auth.uid() as current_user_id,
  p.role as current_user_role,
  p.email as current_user_email,
  p.first_name,
  p.last_name
FROM public.profiles p
WHERE p.user_id = auth.uid();

-- Check if the current user exists in profiles
SELECT 
  'User Exists Check' as section,
  CASE 
    WHEN auth.uid() IS NULL THEN 'No authenticated user'
    WHEN COUNT(*) > 0 THEN 'User found in profiles'
    ELSE 'User not found in profiles'
  END as status,
  COUNT(*) as count
FROM public.profiles 
WHERE user_id = auth.uid();

-- Check all profiles to see what roles exist
SELECT 
  'All Roles' as section,
  role,
  COUNT(*) as count
FROM public.profiles 
GROUP BY role
ORDER BY role;

-- Test the permission check logic with SELECT statements for output
SELECT 
  'Permission Test' as section,
  CASE 
    WHEN auth.uid() IS NULL THEN 'No authenticated user'
    WHEN p.role IS NULL THEN 'User not found in profiles'
    WHEN p.role = 'super_admin' THEN 'User has super_admin permissions'
    WHEN p.role = 'ops_team' THEN 'User has ops_team permissions - can create clients, vendors, gig_workers'
    WHEN p.role = 'vendor_team' THEN 'User has vendor_team permissions - can create vendors, gig_workers'
    WHEN p.role = 'vendor' THEN 'User has vendor permissions - can create gig_workers'
    ELSE 'User has no special permissions - role: ' || p.role
  END as permission_status,
  p.role as actual_role
FROM public.profiles p
WHERE p.user_id = auth.uid();
