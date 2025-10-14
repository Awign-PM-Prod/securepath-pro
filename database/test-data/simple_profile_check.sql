-- Simple check of profiles table only (no auth.users queries)
-- This will help us understand the data structure

-- Check the profile details for our test user
SELECT 
  'Profile Details' as check_type,
  id as profile_id,
  user_id as profile_user_id,
  email,
  first_name,
  last_name,
  role,
  is_active,
  created_at
FROM public.profiles 
WHERE email = 'deepanshu.shahara+03@awign.com';

-- Check all profiles with NULL user_id
SELECT 
  'Profiles with NULL user_id' as check_type,
  id as profile_id,
  user_id,
  email,
  first_name,
  last_name,
  role,
  is_active
FROM public.profiles 
WHERE user_id IS NULL
LIMIT 10;

-- Check all profiles with valid user_id
SELECT 
  'Profiles with Valid user_id' as check_type,
  id as profile_id,
  user_id,
  email,
  first_name,
  last_name,
  role,
  is_active
FROM public.profiles 
WHERE user_id IS NOT NULL
LIMIT 10;

-- Check gig_partners table status
SELECT 
  'Gig Partners Status' as check_type,
  COUNT(*) as total_gig_partners,
  COUNT(user_id) as gig_partners_with_user_id,
  COUNT(*) - COUNT(user_id) as gig_partners_without_user_id
FROM public.gig_partners;

-- Show some gig_partners records
SELECT 
  'Sample Gig Partners' as check_type,
  id as gig_partner_id,
  user_id,
  profile_id,
  phone,
  is_active
FROM public.gig_partners 
LIMIT 5;
