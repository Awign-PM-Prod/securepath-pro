-- =====================================================
-- Simple Test for Gig Worker Data
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

-- 3. If no data exists, create a simple test record manually
-- First, let's get a valid user ID for created_by
SELECT id as current_user_id FROM auth.users LIMIT 1;

-- First create a profile
INSERT INTO public.profiles (
  user_id,
  first_name,
  last_name,
  email,
  role,
  is_active,
  created_by
) VALUES (
  NULL,
  'Test',
  'Worker',
  'test.worker@example.com',
  'gig_worker',
  true,
  (SELECT id FROM auth.users LIMIT 1)
) ON CONFLICT DO NOTHING
RETURNING id as profile_id;

-- 4. Get the profile ID we just created
SELECT id as profile_id FROM public.profiles 
WHERE first_name = 'Test' AND last_name = 'Worker' 
LIMIT 1;

-- 5. Create a gig partner record
INSERT INTO public.gig_partners (
  user_id,
  profile_id,
  phone,
  address,
  city,
  state,
  pincode,
  country,
  coverage_pincodes,
  max_daily_capacity,
  capacity_available,
  vendor_id,
  is_direct_gig,
  is_active,
  is_available,
  created_by
) VALUES (
  NULL,
  (SELECT id FROM public.profiles WHERE first_name = 'Test' AND last_name = 'Worker' LIMIT 1),
  '9876543210',
  '123 Test Street',
  'Bangalore',
  'Karnataka',
  '560001',
  'India',
  ARRAY['560001'],
  3,
  3,
  NULL,
  true,
  true,
  true,
  (SELECT id FROM auth.users LIMIT 1)
) ON CONFLICT DO NOTHING;

-- 6. Test the join query
SELECT 
  gp.id,
  gp.phone,
  gp.address,
  p.first_name,
  p.last_name,
  p.email
FROM public.gig_partners gp
LEFT JOIN public.profiles p ON gp.profile_id = p.id
ORDER BY gp.created_at DESC
LIMIT 5;
