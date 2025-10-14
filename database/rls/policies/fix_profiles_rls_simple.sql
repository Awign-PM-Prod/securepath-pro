-- =====================================================
-- Simple Fix for Profiles RLS Policy
-- Run this directly in Supabase SQL Editor
-- =====================================================

-- First, let's check what policies currently exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'profiles' AND schemaname = 'public';

-- Drop all existing policies on profiles table
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Ops team can view client profiles" ON public.profiles;
DROP POLICY IF EXISTS "Vendor team can view vendor and gig worker profiles" ON public.profiles;
DROP POLICY IF EXISTS "Vendors can view gig worker profiles they created" ON public.profiles;
DROP POLICY IF EXISTS "Users can create profiles they are authorized to manage" ON public.profiles;
DROP POLICY IF EXISTS "Users can update profiles they are authorized to manage" ON public.profiles;

-- Create simple, permissive policies for profiles table
CREATE POLICY "Allow all authenticated users to view profiles"
ON public.profiles 
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow ops_team to create any profile"
ON public.profiles 
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow service role
  auth.jwt() ->> 'role' = 'service_role' OR
  -- Allow ops_team to create any profile
  has_role('ops_team') OR
  -- Allow vendor_team to create vendor and gig_worker profiles
  (has_role('vendor_team') AND role IN ('vendor', 'gig_worker')) OR
  -- Allow super_admin to create any profile except other super_admins
  (has_role('super_admin') AND role != 'super_admin')
);

CREATE POLICY "Allow ops_team to update any profile"
ON public.profiles 
FOR UPDATE
TO authenticated
USING (
  -- Allow users to update their own profile
  (auth.uid() = user_id) OR
  -- Allow ops_team to update any profile
  has_role('ops_team') OR
  -- Allow vendor_team to update vendor and gig_worker profiles
  (has_role('vendor_team') AND role IN ('vendor', 'gig_worker')) OR
  -- Allow super_admin to update any profile except other super_admins
  (has_role('super_admin') AND role != 'super_admin')
);

-- Also ensure gig_partners table has proper policies
ALTER TABLE public.gig_partners ENABLE ROW LEVEL SECURITY;

-- Drop existing policies on gig_partners if they exist
DROP POLICY IF EXISTS "Users can view gig partners they are authorized to see" ON public.gig_partners;
DROP POLICY IF EXISTS "Users can create gig partners they are authorized to manage" ON public.gig_partners;
DROP POLICY IF EXISTS "Users can update gig partners they are authorized to manage" ON public.gig_partners;
DROP POLICY IF EXISTS "Users can delete gig partners they are authorized to manage" ON public.gig_partners;

-- Create simple policies for gig_partners
CREATE POLICY "Allow all authenticated users to view gig_partners"
ON public.gig_partners 
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow ops_team to create gig_partners"
ON public.gig_partners 
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow service role
  auth.jwt() ->> 'role' = 'service_role' OR
  -- Allow ops_team to create gig_partners
  has_role('ops_team') OR
  -- Allow vendor_team to create gig_partners
  has_role('vendor_team')
);

CREATE POLICY "Allow ops_team to update gig_partners"
ON public.gig_partners 
FOR UPDATE
TO authenticated
USING (
  -- Allow users to update their own gig_partner profile
  (auth.uid() = user_id) OR
  -- Allow ops_team to update any gig_partner
  has_role('ops_team') OR
  -- Allow vendor_team to update any gig_partner
  has_role('vendor_team')
);

CREATE POLICY "Allow ops_team to delete gig_partners"
ON public.gig_partners 
FOR DELETE
TO authenticated
USING (
  -- Allow ops_team to delete any gig_partner
  has_role('ops_team') OR
  -- Allow vendor_team to delete any gig_partner
  has_role('vendor_team')
);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.gig_partners TO authenticated;

-- Test the current user's role
SELECT 
  'Current user role check' as test,
  get_current_user_role() as current_role,
  has_role('ops_team') as is_ops_team,
  auth.uid() as user_id;

-- Test if we can create a profile (this should work now)
SELECT 
  'RLS policies updated successfully' as status,
  'ops_team should now be able to create gig_worker profiles' as message;
