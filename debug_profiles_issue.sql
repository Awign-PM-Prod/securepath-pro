-- =====================================================
-- Debug Profiles Issue
-- =====================================================

-- 1. Check what profile IDs we have in gig_partners
SELECT 
  'Gig Partners Profile IDs' as check_type,
  profile_id,
  phone,
  created_at
FROM public.gig_partners 
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check what profiles exist with those IDs
SELECT 
  'Profiles with matching IDs' as check_type,
  p.id,
  p.first_name,
  p.last_name,
  p.email,
  p.role,
  p.is_active
FROM public.profiles p
WHERE p.id IN (
  SELECT profile_id FROM public.gig_partners
)
ORDER BY p.created_at DESC;

-- 3. Check if there are any profiles at all
SELECT 
  'All Profiles Count' as check_type,
  COUNT(*) as count
FROM public.profiles;

-- 4. Check profiles by role
SELECT 
  'Profiles by Role' as check_type,
  role,
  COUNT(*) as count
FROM public.profiles 
GROUP BY role;

-- 5. Check if there are RLS policies on profiles
SELECT 
  'RLS Policies on Profiles' as check_type,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'profiles';

-- 6. Try to manually query profiles with a specific ID
SELECT 
  'Manual Profile Query' as check_type,
  id,
  first_name,
  last_name,
  email,
  role
FROM public.profiles 
WHERE id = (SELECT profile_id FROM public.gig_partners LIMIT 1);

-- 7. Check if the issue is with the IN clause
SELECT 
  'Profile IDs from Gig Partners' as check_type,
  array_agg(DISTINCT profile_id) as profile_ids
FROM public.gig_partners;
