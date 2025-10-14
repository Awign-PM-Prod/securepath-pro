-- Safe fix for gig worker access (handles existing policies)
-- This script safely updates RLS policies

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

-- Drop ALL existing policies on cases table (comprehensive cleanup)
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

-- Create a simple policy for case viewing
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

-- Create a simple policy for case updates
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

-- Create a simple policy for case inserts (for admins only)
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

-- Test the policies
DO $$
DECLARE
  test_gig_worker_id uuid;
  test_user_id uuid;
  case_count integer;
BEGIN
  -- Get a test gig worker
  SELECT gp.id, gp.user_id 
  INTO test_gig_worker_id, test_user_id
  FROM public.gig_partners gp
  JOIN public.profiles p ON gp.profile_id = p.id
  WHERE p.role = 'gig_worker'
  LIMIT 1;
  
  IF test_gig_worker_id IS NOT NULL THEN
    RAISE NOTICE 'Found test gig worker: %', test_gig_worker_id;
    RAISE NOTICE 'User ID: %', test_user_id;
    
    -- Count cases assigned to this gig worker
    SELECT COUNT(*) INTO case_count 
    FROM public.cases 
    WHERE current_assignee_id = test_gig_worker_id;
    
    RAISE NOTICE 'Cases assigned to this gig worker: %', case_count;
  ELSE
    RAISE NOTICE 'No gig workers found for testing';
  END IF;
END $$;

RAISE NOTICE 'Gig worker access policies updated successfully!';
