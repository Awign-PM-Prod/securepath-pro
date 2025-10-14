-- =====================================================
-- Fix Vendors RLS Policies and Ops Team Permissions
-- Background Verification Platform
-- =====================================================

-- First, update the can_manage_user function to allow ops_team to manage vendors
CREATE OR REPLACE FUNCTION public.can_manage_user(_target_role app_role)
RETURNS BOOLEAN AS $$
DECLARE
  current_role app_role;
BEGIN
  SELECT get_current_user_role() INTO current_role;
  
  -- Super admin can manage all roles except other super admins
  IF current_role = 'super_admin' AND _target_role != 'super_admin' THEN
    RETURN true;
  END IF;
  
  -- Ops team can manage clients and vendors
  IF current_role = 'ops_team' AND _target_role IN ('client', 'vendor') THEN
    RETURN true;
  END IF;
  
  -- Vendor team can manage vendors and gig workers
  IF current_role = 'vendor_team' AND _target_role IN ('vendor', 'gig_worker') THEN
    RETURN true;
  END IF;
  
  -- Vendors can manage their own gig workers (additional check needed in application)
  IF current_role = 'vendor' AND _target_role = 'gig_worker' THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update the profiles INSERT policy to allow ops_team to create vendor profiles
DROP POLICY IF EXISTS "Users can create profiles they are authorized to manage" ON public.profiles;

CREATE POLICY "Users can create profiles they are authorized to manage" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  -- Allow service role (for edge functions)
  auth.jwt() ->> 'role' = 'service_role' OR
  -- Allow users who can manage the target role and are setting themselves as creator
  (can_manage_user(role) AND created_by = auth.uid()) OR
  -- Allow ops_team to create gig_worker profiles (for gig worker management)
  (has_role('ops_team') AND role = 'gig_worker' AND created_by = auth.uid()) OR
  -- Allow ops_team to create vendor profiles (for vendor management)
  (has_role('ops_team') AND role = 'vendor' AND created_by = auth.uid())
);

-- Update the profiles UPDATE policy to allow ops_team to update vendor profiles
DROP POLICY IF EXISTS "Users can update profiles they are authorized to manage" ON public.profiles;

CREATE POLICY "Users can update profiles they are authorized to manage"
ON public.profiles 
FOR UPDATE
USING (
  (auth.uid() = user_id) OR 
  (has_role('super_admin') AND role != 'super_admin') OR
  (has_role('ops_team') AND role IN ('client', 'gig_worker', 'vendor')) OR
  (has_role('vendor_team') AND role IN ('vendor', 'gig_worker')) OR
  (has_role('vendor') AND role = 'gig_worker' AND created_by = auth.uid())
);

-- Now create RLS policies for the vendors table
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated read access to vendors" ON public.vendors;
DROP POLICY IF EXISTS "Allow ops_team to manage vendors" ON public.vendors;
DROP POLICY IF EXISTS "Allow super_admin to manage vendors" ON public.vendors;
DROP POLICY IF EXISTS "Allow vendor_team to manage vendors" ON public.vendors;

-- Policy for SELECT: Allow all authenticated users to read vendors
CREATE POLICY "Allow authenticated read access to vendors"
ON public.vendors FOR SELECT
USING (true);

-- Policy for INSERT: Allow ops_team, super_admin, and vendor_team to create vendors
CREATE POLICY "Allow authorized users to create vendors"
ON public.vendors FOR INSERT
WITH CHECK (
  -- Allow service role (for edge functions)
  auth.jwt() ->> 'role' = 'service_role' OR
  -- Allow super_admin to create vendors
  has_role('super_admin') OR
  -- Allow ops_team to create vendors
  has_role('ops_team') OR
  -- Allow vendor_team to create vendors
  has_role('vendor_team')
);

-- Policy for UPDATE: Allow ops_team, super_admin, and vendor_team to update vendors
CREATE POLICY "Allow authorized users to update vendors"
ON public.vendors FOR UPDATE
USING (
  -- Allow service role (for edge functions)
  auth.jwt() ->> 'role' = 'service_role' OR
  -- Allow super_admin to update vendors
  has_role('super_admin') OR
  -- Allow ops_team to update vendors
  has_role('ops_team') OR
  -- Allow vendor_team to update vendors
  has_role('vendor_team')
);

-- Policy for DELETE: Allow super_admin and ops_team to delete vendors
CREATE POLICY "Allow authorized users to delete vendors"
ON public.vendors FOR DELETE
USING (
  -- Allow service role (for edge functions)
  auth.jwt() ->> 'role' = 'service_role' OR
  -- Allow super_admin to delete vendors
  has_role('super_admin') OR
  -- Allow ops_team to delete vendors
  has_role('ops_team')
);

-- Verify the policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'vendors' 
ORDER BY policyname;
