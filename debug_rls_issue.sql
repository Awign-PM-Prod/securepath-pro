-- =====================================================
-- Debug RLS Issue
-- Run this to check what's happening with RLS policies
-- =====================================================

-- Check current user and their role
SELECT 
  'Current User Info' as section,
  auth.uid() as user_id,
  auth.jwt() ->> 'role' as jwt_role,
  get_current_user_role() as profile_role;

-- Check if the user has a profile
SELECT 
  'User Profile Check' as section,
  id,
  user_id,
  email,
  first_name,
  last_name,
  role,
  is_active,
  created_by
FROM public.profiles 
WHERE user_id = auth.uid();

-- Check if has_role function works
SELECT 
  'Role Check Functions' as section,
  has_role('ops_team') as is_ops_team,
  has_role('super_admin') as is_super_admin,
  has_role('vendor_team') as is_vendor_team;

-- Check current RLS policies on profiles table
SELECT 
  'Current RLS Policies' as section,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'profiles' AND schemaname = 'public';

-- Test if we can select from profiles (this should work)
SELECT 
  'Profile Access Test' as section,
  COUNT(*) as profile_count
FROM public.profiles;

-- Check if the can_manage_user function works for gig_worker role
SELECT 
  'Can Manage User Test' as section,
  can_manage_user('gig_worker') as can_manage_gig_worker,
  can_manage_user('client') as can_manage_client,
  can_manage_user('vendor') as can_manage_vendor;

-- Check if there are any existing gig_partners
SELECT 
  'Existing Gig Partners' as section,
  COUNT(*) as gig_partner_count
FROM public.gig_partners;
