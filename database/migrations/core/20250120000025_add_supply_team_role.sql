-- =====================================================
-- Add Supply Team Role
-- Background Verification Platform
-- =====================================================

-- Add 'supply_team' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supply_team';

-- Update the can_manage_user function to allow supply_team to manage vendors and gig workers
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
  
  -- Ops team can manage clients, vendors, and gig workers
  IF current_role = 'ops_team' AND _target_role IN ('client', 'vendor', 'gig_worker') THEN
    RETURN true;
  END IF;
  
  -- Vendor team can manage vendors and gig workers
  IF current_role = 'vendor_team' AND _target_role IN ('vendor', 'gig_worker') THEN
    RETURN true;
  END IF;
  
  -- Supply team can manage vendors and gig workers
  IF current_role = 'supply_team' AND _target_role IN ('vendor', 'gig_worker') THEN
    RETURN true;
  END IF;
  
  -- Vendors can manage their own gig workers (additional check needed in application)
  IF current_role = 'vendor' AND _target_role = 'gig_worker' THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update profiles SELECT policy to allow supply_team to view vendor and gig worker profiles
DROP POLICY IF EXISTS "Supply team can view vendor and gig worker profiles" ON public.profiles;
CREATE POLICY "Supply team can view vendor and gig worker profiles"
  ON public.profiles FOR SELECT
  USING (has_role('supply_team') AND role IN ('vendor', 'gig_worker'));

-- Update profiles INSERT policy to allow supply_team to create vendor and gig worker profiles
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
  (has_role('ops_team') AND role = 'vendor' AND created_by = auth.uid()) OR
  -- Allow supply_team to create gig_worker profiles
  (has_role('supply_team') AND role = 'gig_worker' AND created_by = auth.uid()) OR
  -- Allow supply_team to create vendor profiles
  (has_role('supply_team') AND role = 'vendor' AND created_by = auth.uid())
);

-- Update profiles UPDATE policy to allow supply_team to update vendor and gig worker profiles
DROP POLICY IF EXISTS "Users can update profiles they are authorized to manage" ON public.profiles;
CREATE POLICY "Users can update profiles they are authorized to manage"
ON public.profiles 
FOR UPDATE
USING (
  (auth.uid() = user_id) OR 
  (has_role('super_admin') AND role != 'super_admin') OR
  (has_role('ops_team') AND role IN ('client', 'gig_worker', 'vendor')) OR
  (has_role('vendor_team') AND role IN ('vendor', 'gig_worker')) OR
  (has_role('supply_team') AND role IN ('vendor', 'gig_worker')) OR
  (has_role('vendor') AND role = 'gig_worker' AND created_by = auth.uid())
);

-- Update vendors table RLS policies to allow supply_team to manage vendors
DROP POLICY IF EXISTS "Allow authorized users to create vendors" ON public.vendors;
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
  has_role('vendor_team') OR
  -- Allow supply_team to create vendors
  has_role('supply_team')
);

DROP POLICY IF EXISTS "Allow authorized users to update vendors" ON public.vendors;
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
  has_role('vendor_team') OR
  -- Allow supply_team to update vendors
  has_role('supply_team')
);

-- Update gig_partners table RLS policies to allow supply_team to manage gig workers
DROP POLICY IF EXISTS "Users can view gig partners they are authorized to see" ON public.gig_partners;
CREATE POLICY "Users can view gig partners they are authorized to see"
ON public.gig_partners 
FOR SELECT
USING (
  -- Users can view their own gig partner profile
  (auth.uid() = user_id) OR
  -- Super admins can view all
  has_role('super_admin') OR
  -- Ops team can view all gig partners
  has_role('ops_team') OR
  -- Vendor team can view all gig partners
  has_role('vendor_team') OR
  -- Supply team can view all gig partners
  has_role('supply_team') OR
  -- Vendors can view their own gig workers
  (has_role('vendor') AND vendor_id = (
    SELECT id FROM public.vendors WHERE created_by = auth.uid() LIMIT 1
  ))
);

DROP POLICY IF EXISTS "Users can create gig partners they are authorized to manage" ON public.gig_partners;
CREATE POLICY "Users can create gig partners they are authorized to manage"
ON public.gig_partners 
FOR INSERT
WITH CHECK (
  -- Allow service role (for edge functions)
  auth.jwt() ->> 'role' = 'service_role' OR
  -- Ops team can create gig partners
  has_role('ops_team') OR
  -- Vendor team can create gig partners
  has_role('vendor_team') OR
  -- Supply team can create gig partners
  has_role('supply_team') OR
  -- Vendors can create gig workers under their vendor
  (has_role('vendor') AND vendor_id = (
    SELECT id FROM public.vendors WHERE created_by = auth.uid() LIMIT 1
  ))
);

DROP POLICY IF EXISTS "Users can update gig partners they are authorized to manage" ON public.gig_partners;
CREATE POLICY "Users can update gig partners they are authorized to manage"
ON public.gig_partners 
FOR UPDATE
USING (
  -- Users can update their own gig partner profile
  (auth.uid() = user_id) OR
  -- Super admins can update all
  has_role('super_admin') OR
  -- Ops team can update all gig partners
  has_role('ops_team') OR
  -- Vendor team can update all gig partners
  has_role('vendor_team') OR
  -- Supply team can update all gig partners
  has_role('supply_team') OR
  -- Vendors can update their own gig workers
  (has_role('vendor') AND vendor_id = (
    SELECT id FROM public.vendors WHERE created_by = auth.uid() LIMIT 1
  ))
);

DROP POLICY IF EXISTS "Users can delete gig partners they are authorized to manage" ON public.gig_partners;
CREATE POLICY "Users can delete gig partners they are authorized to manage"
ON public.gig_partners 
FOR DELETE
USING (
  -- Super admins can delete all
  has_role('super_admin') OR
  -- Ops team can delete all gig partners
  has_role('ops_team') OR
  -- Vendor team can delete all gig partners
  has_role('vendor_team') OR
  -- Supply team can delete all gig partners
  has_role('supply_team')
);

-- Grant execute permission on updated function
GRANT EXECUTE ON FUNCTION public.can_manage_user(app_role) TO authenticated;


