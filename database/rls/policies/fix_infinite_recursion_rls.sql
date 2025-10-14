-- =====================================================
-- Fix Infinite Recursion in RLS Policies
-- =====================================================

-- 1. Drop all existing policies on profiles table
DROP POLICY IF EXISTS "ops_team_can_read_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "ops_team_can_update_profiles" ON public.profiles;
DROP POLICY IF EXISTS "ops_team_can_insert_profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- 2. Create simple, non-recursive policies
CREATE POLICY "allow_ops_team_read_profiles" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Allow ops_team to read all profiles
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' = 'ops_team'
    )
    OR
    -- Allow users to read their own profile
    profiles.user_id = auth.uid()
    OR
    -- Allow reading profiles where user_id is NULL (gig workers)
    profiles.user_id IS NULL
  );

CREATE POLICY "allow_ops_team_update_profiles" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    -- Allow ops_team to update all profiles
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' = 'ops_team'
    )
    OR
    -- Allow users to update their own profile
    profiles.user_id = auth.uid()
  );

CREATE POLICY "allow_ops_team_insert_profiles" ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow ops_team to insert profiles
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' = 'ops_team'
    )
    OR
    -- Allow users to insert their own profile
    profiles.user_id = auth.uid()
  );

-- 3. Test the policies work
SELECT 
  'RLS Policies Fixed' as status,
  'Testing profiles query...' as message;

-- 4. Test the query that was failing
SELECT 
  'Test Profiles Query' as check_type,
  id,
  first_name,
  last_name,
  email,
  role
FROM public.profiles 
WHERE id IN (
  'f63d7b41-03ff-41b2-ba9d-14e0722315c5',
  '1256a4b4-49d6-46f9-b133-26c4c411e165'
)
LIMIT 2;

-- 5. Check current policies
SELECT 
  'Current RLS Policies' as check_type,
  policyname,
  cmd,
  roles
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;
