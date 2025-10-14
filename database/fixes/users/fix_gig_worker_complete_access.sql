-- Complete fix for gig worker access to both gig_partners and cases tables
-- This script fixes all RLS policies comprehensively

-- First, let's ensure the has_role function exists and works
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

-- Test the has_role function
DO $$
DECLARE
  test_result boolean;
BEGIN
  -- Test with a role that should exist
  SELECT has_role('super_admin') INTO test_result;
  RAISE NOTICE 'has_role function test result: %', test_result;
END $$;

-- =====================================================
-- FIX GIG_PARTNERS TABLE RLS POLICIES
-- =====================================================

-- Drop ALL existing policies on gig_partners table
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
  -- QC team can view all
  (has_role('qc_team'))
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
  (has_role('vendor_team'))
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
  (has_role('vendor_team'))
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

-- =====================================================
-- FIX CASES TABLE RLS POLICIES
-- =====================================================

-- Drop ALL existing policies on cases table
DROP POLICY IF EXISTS "Users can view cases they are assigned to" ON public.cases;
DROP POLICY IF EXISTS "Gig workers can view their assigned cases" ON public.cases;
DROP POLICY IF EXISTS "Gig workers can update their assigned cases" ON public.cases;
DROP POLICY IF EXISTS "Allow all authenticated users to view cases" ON public.cases;
DROP POLICY IF EXISTS "Allow ops_team to view cases" ON public.cases;
DROP POLICY IF EXISTS "Allow ops_team to update cases" ON public.cases;
DROP POLICY IF EXISTS "case_select_policy" ON public.cases;
DROP POLICY IF EXISTS "case_update_policy" ON public.cases;
DROP POLICY IF EXISTS "case_insert_policy" ON public.cases;
DROP POLICY IF EXISTS "case_delete_policy" ON public.cases;

-- Create simple policies for cases
CREATE POLICY "case_select_policy"
ON public.cases 
FOR SELECT
TO authenticated
USING (
  -- Allow if user is a gig worker and case is assigned to them
  (current_assignee_type = 'gig' AND current_assignee_id IN (
    SELECT id FROM public.gig_partners WHERE user_id = auth.uid()
  )) OR
  -- Allow if user has admin roles
  (has_role('super_admin')) OR
  (has_role('ops_team')) OR
  (has_role('vendor_team')) OR
  (has_role('qc_team'))
);

CREATE POLICY "case_update_policy"
ON public.cases 
FOR UPDATE
TO authenticated
USING (
  -- Allow if user is a gig worker and case is assigned to them
  (current_assignee_type = 'gig' AND current_assignee_id IN (
    SELECT id FROM public.gig_partners WHERE user_id = auth.uid()
  )) OR
  -- Allow if user has admin roles
  (has_role('super_admin')) OR
  (has_role('ops_team')) OR
  (has_role('vendor_team'))
);

CREATE POLICY "case_insert_policy"
ON public.cases 
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow if user has admin roles
  (has_role('super_admin')) OR
  (has_role('ops_team')) OR
  (has_role('vendor_team'))
);

-- =====================================================
-- FIX PROFILES TABLE RLS POLICIES
-- =====================================================

-- Drop existing policies on profiles table
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
  -- QC team can view all
  (has_role('qc_team'))
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
  (has_role('vendor_team'))
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
  -- QC team can update gig workers
  (has_role('qc_team') AND role = 'gig_worker')
);

-- Test the complete setup
DO $$
DECLARE
  test_gig_worker_id uuid;
  test_user_id uuid;
  case_count integer;
  gig_partner_count integer;
BEGIN
  -- Get a test gig worker
  SELECT gp.id, gp.user_id 
  INTO test_gig_worker_id, test_user_id
  FROM public.gig_partners gp
  JOIN public.profiles p ON gp.profile_id = p.id
  WHERE p.role = 'gig_worker'
  LIMIT 1;
  
  IF test_gig_worker_id IS NOT NULL THEN
    RAISE NOTICE 'Found test gig worker:';
    RAISE NOTICE '  Gig Worker ID: %', test_gig_worker_id;
    RAISE NOTICE '  User ID: %', test_user_id;
    
    -- Count cases assigned to this gig worker
    SELECT COUNT(*) INTO case_count 
    FROM public.cases 
    WHERE current_assignee_id = test_gig_worker_id;
    
    -- Count gig partners accessible to this user
    SELECT COUNT(*) INTO gig_partner_count 
    FROM public.gig_partners 
    WHERE user_id = test_user_id;
    
    RAISE NOTICE 'Access test results:';
    RAISE NOTICE '  Cases assigned to this gig worker: %', case_count;
    RAISE NOTICE '  Gig partners accessible to this user: %', gig_partner_count;
    
  ELSE
    RAISE NOTICE 'No gig workers found for testing';
  END IF;
END $$;

RAISE NOTICE 'Complete gig worker access policies updated successfully!';
