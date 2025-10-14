-- Simple debug script to check gig worker data
-- This will show us exactly what exists in the database

-- Check if the user exists
SELECT 
  'User Check' as check_type,
  id as user_id,
  email,
  created_at
FROM auth.users 
WHERE email = 'deepanshu.shahara+03@awign.com';

-- Check if the user has a profile
SELECT 
  'Profile Check' as check_type,
  p.id as profile_id,
  p.user_id,
  p.email,
  p.first_name,
  p.last_name,
  p.role,
  p.is_active
FROM public.profiles p
JOIN auth.users u ON p.user_id = u.id
WHERE u.email = 'deepanshu.shahara+03@awign.com';

-- Check if the user has a gig_partners record
SELECT 
  'Gig Partner Check' as check_type,
  gp.id as gig_partner_id,
  gp.user_id,
  gp.profile_id,
  gp.phone,
  gp.is_active,
  gp.is_available
FROM public.gig_partners gp
JOIN auth.users u ON gp.user_id = u.id
WHERE u.email = 'deepanshu.shahara+03@awign.com';

-- Check all gig_worker profiles
SELECT 
  'All Gig Workers' as check_type,
  p.id as profile_id,
  p.user_id,
  p.email,
  p.first_name,
  p.last_name,
  p.role,
  p.is_active,
  u.email as auth_email
FROM public.profiles p
JOIN auth.users u ON p.user_id = u.id
WHERE p.role = 'gig_worker'
LIMIT 5;

-- Check all gig_partners records
SELECT 
  'All Gig Partners' as check_type,
  gp.id as gig_partner_id,
  gp.user_id,
  gp.profile_id,
  gp.phone,
  gp.is_active,
  p.email as profile_email
FROM public.gig_partners gp
JOIN public.profiles p ON gp.profile_id = p.id
LIMIT 5;
