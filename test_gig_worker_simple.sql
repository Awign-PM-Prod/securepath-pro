-- =====================================================
-- Simple Test for Gig Worker Data (No Auth Required)
-- =====================================================

-- 1. First, let's check if we have any gig workers at all
SELECT 
  'Gig Partners Count' as check_type,
  COUNT(*) as count
FROM public.gig_partners;

-- 2. Check if we have any profiles
SELECT 
  'Profiles Count' as check_type,
  COUNT(*) as count
FROM public.profiles
WHERE role = 'gig_worker';

-- 3. Check if we have any users to use as created_by
SELECT 
  'Users Count' as check_type,
  COUNT(*) as count
FROM auth.users;

-- 4. If we have users, get the first one
SELECT 
  'First User ID' as check_type,
  id as user_id
FROM auth.users 
LIMIT 1;

-- 5. Test the join query with existing data
SELECT 
  gp.id,
  gp.phone,
  gp.address,
  p.first_name,
  p.last_name,
  p.email,
  p.id as profile_id
FROM public.gig_partners gp
LEFT JOIN public.profiles p ON gp.profile_id = p.id
ORDER BY gp.created_at DESC
LIMIT 5;

-- 6. If no data exists, let's create some using the function
-- (This should work if the function exists and user is authenticated)
SELECT 'Testing function call...' as status;

-- Try to call the function (this might fail if not authenticated)
SELECT public.create_gig_worker_profile(
  'John',                    -- first_name
  'Doe',                     -- last_name  
  'john.doe@example.com',    -- email
  '9876543210',             -- phone
  '123 Test Street',        -- address
  'Bangalore',              -- city
  'Karnataka',              -- state
  '560001',                 -- pincode
  NULL,                     -- alternate_phone
  'India',                  -- country
  ARRAY['560001'],          -- coverage_pincodes
  3,                        -- max_daily_capacity
  NULL,                     -- vendor_id
  true,                     -- is_direct_gig
  true,                     -- is_active
  true,                     -- is_available
  (SELECT id FROM auth.users LIMIT 1)  -- created_by
) as new_gig_worker_id;
