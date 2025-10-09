-- =====================================================
-- Debug Gig Worker Data Loading
-- This will help us understand what's happening with the data
-- =====================================================

-- 1. Check if the function exists
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines 
WHERE routine_name = 'create_gig_worker_profile' 
AND routine_schema = 'public';

-- 2. Check the current data in profiles table
SELECT 
  id,
  first_name,
  last_name,
  email,
  role,
  is_active,
  created_at
FROM public.profiles 
WHERE role = 'gig_worker'
ORDER BY created_at DESC
LIMIT 5;

-- 3. Check the current data in gig_partners table
SELECT 
  id,
  profile_id,
  phone,
  address,
  city,
  state,
  pincode,
  is_active,
  created_at
FROM public.gig_partners 
ORDER BY created_at DESC
LIMIT 5;

-- 4. Test the join query that the React app is using
SELECT 
  gp.*,
  p.first_name,
  p.last_name,
  p.email,
  v.name as vendor_name
FROM public.gig_partners gp
LEFT JOIN public.profiles p ON gp.profile_id = p.id
LEFT JOIN public.vendors v ON gp.vendor_id = v.id
ORDER BY gp.created_at DESC
LIMIT 5;

-- 5. Check if there are any RLS policies blocking the data
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('profiles', 'gig_partners')
ORDER BY tablename, policyname;

-- 6. Test creating a new gig worker to see if the function works
SELECT public.create_gig_worker_profile(
  'Test',                    -- first_name
  'User',                    -- last_name  
  'test.user@example.com',   -- email
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
  auth.uid()                -- created_by
) as new_gig_worker_id;
