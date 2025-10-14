-- Fix missing auth.users record for the gig worker
-- The profile exists but there's no corresponding auth.users record

-- First, let's check if the user exists in auth.users
SELECT 
  'Auth Users Check' as check_type,
  id as user_id,
  email,
  created_at
FROM auth.users 
WHERE email = 'deepanshu.shahara+03@awign.com';

-- Check the profile details
SELECT 
  'Profile Details' as check_type,
  id as profile_id,
  user_id as profile_user_id,
  email,
  first_name,
  last_name,
  role,
  is_active
FROM public.profiles 
WHERE email = 'deepanshu.shahara+03@awign.com';

-- Check if there are any auth.users with similar emails
SELECT 
  'Similar Emails' as check_type,
  id as user_id,
  email,
  created_at
FROM auth.users 
WHERE email LIKE '%deepanshu.shahara%'
OR email LIKE '%@awign.com';

-- Let's see what profiles have NULL user_id
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

-- Check if there are any auth.users records at all
SELECT 
  'Total Auth Users' as check_type,
  COUNT(*) as total_users
FROM auth.users;

-- Check if there are any profiles with valid user_id
SELECT 
  'Profiles with Valid user_id' as check_type,
  COUNT(*) as total_profiles,
  COUNT(user_id) as profiles_with_user_id,
  COUNT(*) - COUNT(user_id) as profiles_without_user_id
FROM public.profiles;
