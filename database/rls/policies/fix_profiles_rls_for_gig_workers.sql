-- =====================================================
-- Fix RLS Policies for Profiles Table
-- This allows ops_team to read gig_worker profiles
-- =====================================================

-- 1. First, let's check current RLS policies on profiles
SELECT 
  'Current RLS Policies on Profiles' as check_type,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- 2. Check if RLS is enabled on profiles table
SELECT 
  'RLS Status on Profiles' as check_type,
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'profiles';

-- 3. Drop existing restrictive policies (if any)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- 4. Create new policies that allow ops_team to read all profiles
CREATE POLICY "ops_team_can_read_all_profiles" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = profiles.id
      AND (
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
      )
    )
  );

-- 5. Create policy for updating profiles
CREATE POLICY "ops_team_can_update_profiles" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' = 'ops_team'
    )
    OR profiles.user_id = auth.uid()
  );

-- 6. Create policy for inserting profiles
CREATE POLICY "ops_team_can_insert_profiles" ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' = 'ops_team'
    )
    OR profiles.user_id = auth.uid()
  );

-- 7. Test the query that was failing
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
  '1256a4b4-49d6-46f9-b133-26c4c411e165',
  'a7a40fb1-5cd0-4ba7-89f2-58cd037e4dbc'
)
LIMIT 3;

-- 8. Check if the policies were created successfully
SELECT 
  'Updated RLS Policies on Profiles' as check_type,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;
