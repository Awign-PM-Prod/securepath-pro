-- =====================================================
-- Fix created_by NOT NULL constraint for test data
-- =====================================================

-- Option 1: Make created_by nullable in gig_partners table
ALTER TABLE public.gig_partners ALTER COLUMN created_by DROP NOT NULL;

-- Option 2: If that doesn't work, we'll need to provide a valid user_id
-- First, let's check if there are any ops_team users
SELECT 
  'Available ops_team users' as info,
  user_id,
  first_name,
  last_name,
  email
FROM public.profiles 
WHERE role = 'ops_team' 
  AND user_id IS NOT NULL
LIMIT 5;

-- If no ops_team users exist, we'll create one for testing
INSERT INTO public.profiles (
  id,
  user_id,
  first_name,
  last_name,
  email,
  phone,
  role,
  is_active,
  created_by
) VALUES (
  gen_random_uuid(),
  gen_random_uuid(), -- This will be a fake user_id for testing
  'Test',
  'Admin',
  'test.admin@example.com',
  '9999999999',
  'ops_team',
  true,
  NULL
) ON CONFLICT (email) DO NOTHING;

-- Get the test admin user_id for use in other tables
SELECT 
  'Test admin user created' as info,
  user_id as test_admin_user_id
FROM public.profiles 
WHERE email = 'test.admin@example.com'
LIMIT 1;
