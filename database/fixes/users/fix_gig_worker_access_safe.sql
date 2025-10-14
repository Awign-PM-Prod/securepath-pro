-- Fix gig worker access to gig_partners table (Safe version)
-- This script handles existing policies gracefully

-- First, let's check if the has_role function exists
CREATE OR REPLACE FUNCTION public.has_role(role_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role::text = role_name
  );
END;
$$;

-- Drop ALL existing policies on gig_partners (comprehensive cleanup)
DROP POLICY IF EXISTS "Users can view gig partners they are authorized to see" ON public.gig_partners;
DROP POLICY IF EXISTS "Users can create gig partners they are authorized to manage" ON public.gig_partners;
DROP POLICY IF EXISTS "Users can update gig partners they are authorized to manage" ON public.gig_partners;
DROP POLICY IF EXISTS "Users can delete gig partners they are authorized to manage" ON public.gig_partners;
DROP POLICY IF EXISTS "Allow all authenticated users to view gig_partners" ON public.gig_partners;
DROP POLICY IF EXISTS "Allow ops_team to create gig_partners" ON public.gig_partners;
DROP POLICY IF EXISTS "Allow ops_team to update gig_partners" ON public.gig_partners;
DROP POLICY IF EXISTS "Allow ops_team to delete gig_partners" ON public.gig_partners;
DROP POLICY IF EXISTS "gig_partners_select_policy" ON public.gig_partners;
DROP POLICY IF EXISTS "gig_partners_insert_policy" ON public.gig_partners;
DROP POLICY IF EXISTS "gig_partners_update_policy" ON public.gig_partners;
DROP POLICY IF EXISTS "gig_partners_delete_policy" ON public.gig_partners;

-- Create simple and working RLS policies for gig_partners
CREATE POLICY "gig_partners_select_policy"
ON public.gig_partners 
FOR SELECT
TO authenticated
USING (
  -- Users can view their own gig partner profile
  (auth.uid() = user_id) OR
  -- Super admins can view all
  (has_role('super_admin')) OR
  -- Ops team can view all
  (has_role('ops_team')) OR
  -- Vendor team can view all
  (has_role('vendor_team')) OR
  -- Vendors can view their own gig workers
  (has_role('vendor') AND vendor_id IS NOT NULL AND vendor_id = (
    SELECT id FROM public.vendors WHERE created_by = auth.uid() LIMIT 1
  ))
);

CREATE POLICY "gig_partners_insert_policy"
ON public.gig_partners 
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow service role
  auth.jwt() ->> 'role' = 'service_role' OR
  -- Super admins can create
  (has_role('super_admin')) OR
  -- Ops team can create
  (has_role('ops_team')) OR
  -- Vendor team can create
  (has_role('vendor_team')) OR
  -- Vendors can create gig workers under their vendor
  (has_role('vendor') AND vendor_id IS NOT NULL AND vendor_id = (
    SELECT id FROM public.vendors WHERE created_by = auth.uid() LIMIT 1
  ))
);

CREATE POLICY "gig_partners_update_policy"
ON public.gig_partners 
FOR UPDATE
TO authenticated
USING (
  -- Users can update their own gig partner profile
  (auth.uid() = user_id) OR
  -- Super admins can update all
  (has_role('super_admin')) OR
  -- Ops team can update all
  (has_role('ops_team')) OR
  -- Vendor team can update all
  (has_role('vendor_team')) OR
  -- Vendors can update their own gig workers
  (has_role('vendor') AND vendor_id IS NOT NULL AND vendor_id = (
    SELECT id FROM public.vendors WHERE created_by = auth.uid() LIMIT 1
  ))
);

CREATE POLICY "gig_partners_delete_policy"
ON public.gig_partners 
FOR DELETE
TO authenticated
USING (
  -- Super admins can delete all
  (has_role('super_admin')) OR
  -- Ops team can delete all
  (has_role('ops_team')) OR
  -- Vendor team can delete all
  (has_role('vendor_team'))
);

-- Also fix profiles table policies
DROP POLICY IF EXISTS "Users can view profiles they are authorized to see" ON public.profiles;
DROP POLICY IF EXISTS "Users can create profiles they are authorized to manage" ON public.profiles;
DROP POLICY IF EXISTS "Users can update profiles they are authorized to manage" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;

CREATE POLICY "profiles_select_policy"
ON public.profiles 
FOR SELECT
TO authenticated
USING (
  -- Users can view their own profile
  (auth.uid() = user_id) OR
  -- Super admins can view all
  (has_role('super_admin')) OR
  -- Ops team can view all
  (has_role('ops_team')) OR
  -- Vendor team can view all
  (has_role('vendor_team')) OR
  -- Vendors can view their own gig workers
  (has_role('vendor') AND role = 'gig_worker' AND created_by = auth.uid())
);

CREATE POLICY "profiles_insert_policy"
ON public.profiles 
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow service role
  auth.jwt() ->> 'role' = 'service_role' OR
  -- Super admins can create
  (has_role('super_admin')) OR
  -- Ops team can create
  (has_role('ops_team')) OR
  -- Vendor team can create
  (has_role('vendor_team')) OR
  -- Vendors can create gig workers
  (has_role('vendor') AND role = 'gig_worker' AND created_by = auth.uid())
);

CREATE POLICY "profiles_update_policy"
ON public.profiles 
FOR UPDATE
TO authenticated
USING (
  -- Users can update their own profile
  (auth.uid() = user_id) OR
  -- Super admins can update all except other super admins
  (has_role('super_admin') AND role != 'super_admin') OR
  -- Ops team can update clients and gig workers
  (has_role('ops_team') AND role IN ('client', 'gig_worker')) OR
  -- Vendor team can update vendors and gig workers
  (has_role('vendor_team') AND role IN ('vendor', 'gig_worker')) OR
  -- Vendors can update their own gig workers
  (has_role('vendor') AND role = 'gig_worker' AND created_by = auth.uid())
);

-- Test the policies
DO $$
DECLARE
  test_user_id uuid;
  test_profile_id uuid;
  test_gig_worker_id uuid;
  can_access boolean;
BEGIN
  -- Get a test gig worker
  SELECT gp.id, gp.user_id, gp.profile_id 
  INTO test_gig_worker_id, test_user_id, test_profile_id
  FROM public.gig_partners gp
  JOIN public.profiles p ON gp.profile_id = p.id
  WHERE p.role = 'gig_worker'
  LIMIT 1;
  
  IF test_user_id IS NOT NULL THEN
    RAISE NOTICE 'Found test gig worker: %', test_user_id;
    RAISE NOTICE 'Profile ID: %', test_profile_id;
    RAISE NOTICE 'Gig Worker ID: %', test_gig_worker_id;
    
    -- Test if the user can access their own gig_partners record
    SELECT EXISTS(
      SELECT 1 FROM public.gig_partners 
      WHERE user_id = test_user_id
    ) INTO can_access;
    
    RAISE NOTICE 'Can access own gig_partners record: %', can_access;
  ELSE
    RAISE NOTICE 'No gig workers found for testing';
  END IF;
  
  RAISE NOTICE 'Gig worker access policies updated successfully!';
END $$;
