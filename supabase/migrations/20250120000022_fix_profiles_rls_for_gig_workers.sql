-- =====================================================
-- Fix RLS Policies for Gig Worker Creation
-- Background Verification Platform - Migration 22
-- =====================================================

-- Drop existing INSERT policy for profiles
DROP POLICY IF EXISTS "Users can create profiles they are authorized to manage" ON public.profiles;

-- Create new INSERT policy that allows ops_team to create gig_worker profiles
CREATE POLICY "Users can create profiles they are authorized to manage" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  -- Allow service role (for edge functions)
  auth.jwt() ->> 'role' = 'service_role' OR
  -- Allow users who can manage the target role and are setting themselves as creator
  (can_manage_user(role) AND created_by = auth.uid()) OR
  -- Allow ops_team to create gig_worker profiles (for gig worker management)
  (has_role('ops_team') AND role = 'gig_worker' AND created_by = auth.uid())
);

-- Also ensure that ops_team can update gig_worker profiles
DROP POLICY IF EXISTS "Users can update profiles they are authorized to manage" ON public.profiles;

CREATE POLICY "Users can update profiles they are authorized to manage"
ON public.profiles 
FOR UPDATE
USING (
  (auth.uid() = user_id) OR 
  (has_role('super_admin') AND role != 'super_admin') OR
  (has_role('ops_team') AND role IN ('client', 'gig_worker')) OR
  (has_role('vendor_team') AND role IN ('vendor', 'gig_worker')) OR
  (has_role('vendor') AND role = 'gig_worker' AND created_by = auth.uid())
);

-- Ensure RLS is enabled on gig_partners table
ALTER TABLE public.gig_partners ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for gig_partners table
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
  -- Vendors can view their own gig workers
  (has_role('vendor') AND vendor_id = (
    SELECT id FROM public.vendors WHERE created_by = auth.uid() LIMIT 1
  ))
);

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
  -- Vendors can create gig workers under their vendor
  (has_role('vendor') AND vendor_id = (
    SELECT id FROM public.vendors WHERE created_by = auth.uid() LIMIT 1
  ))
);

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
  -- Vendors can update their own gig workers
  (has_role('vendor') AND vendor_id = (
    SELECT id FROM public.vendors WHERE created_by = auth.uid() LIMIT 1
  ))
);

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
  -- Vendors can delete their own gig workers
  (has_role('vendor') AND vendor_id = (
    SELECT id FROM public.vendors WHERE created_by = auth.uid() LIMIT 1
  ))
);

-- Ensure RLS is enabled on capacity_tracking table
ALTER TABLE public.capacity_tracking ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for capacity_tracking table
CREATE POLICY "Users can view capacity tracking they are authorized to see"
ON public.capacity_tracking 
FOR SELECT
USING (
  -- Super admins can view all
  has_role('super_admin') OR
  -- Ops team can view all capacity tracking
  has_role('ops_team') OR
  -- Vendor team can view all capacity tracking
  has_role('vendor_team') OR
  -- Gig workers can view their own capacity
  (has_role('gig_worker') AND gig_partner_id = (
    SELECT id FROM public.gig_partners WHERE user_id = auth.uid() LIMIT 1
  )) OR
  -- Vendors can view capacity for their gig workers
  (has_role('vendor') AND gig_partner_id IN (
    SELECT id FROM public.gig_partners WHERE vendor_id = (
      SELECT id FROM public.vendors WHERE created_by = auth.uid() LIMIT 1
    )
  ))
);

CREATE POLICY "Users can create capacity tracking they are authorized to manage"
ON public.capacity_tracking 
FOR INSERT
WITH CHECK (
  -- Allow service role (for edge functions)
  auth.jwt() ->> 'role' = 'service_role' OR
  -- Ops team can create capacity tracking
  has_role('ops_team') OR
  -- Vendor team can create capacity tracking
  has_role('vendor_team')
);

CREATE POLICY "Users can update capacity tracking they are authorized to manage"
ON public.capacity_tracking 
FOR UPDATE
USING (
  -- Super admins can update all
  has_role('super_admin') OR
  -- Ops team can update all capacity tracking
  has_role('ops_team') OR
  -- Vendor team can update all capacity tracking
  has_role('vendor_team')
);

-- Ensure RLS is enabled on allocation_logs table
ALTER TABLE public.allocation_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for allocation_logs table
CREATE POLICY "Users can view allocation logs they are authorized to see"
ON public.allocation_logs 
FOR SELECT
USING (
  -- Super admins can view all
  has_role('super_admin') OR
  -- Ops team can view all allocation logs
  has_role('ops_team') OR
  -- Vendor team can view all allocation logs
  has_role('vendor_team') OR
  -- Gig workers can view their own allocation logs
  (has_role('gig_worker') AND candidate_id = (
    SELECT id FROM public.gig_partners WHERE user_id = auth.uid() LIMIT 1
  )) OR
  -- Vendors can view allocation logs for their gig workers
  (has_role('vendor') AND candidate_id IN (
    SELECT id FROM public.gig_partners WHERE vendor_id = (
      SELECT id FROM public.vendors WHERE created_by = auth.uid() LIMIT 1
    )
  ))
);

CREATE POLICY "Users can create allocation logs they are authorized to manage"
ON public.allocation_logs 
FOR INSERT
WITH CHECK (
  -- Allow service role (for edge functions)
  auth.jwt() ->> 'role' = 'service_role' OR
  -- Ops team can create allocation logs
  has_role('ops_team') OR
  -- Vendor team can create allocation logs
  has_role('vendor_team')
);

CREATE POLICY "Users can update allocation logs they are authorized to manage"
ON public.allocation_logs 
FOR UPDATE
USING (
  -- Super admins can update all
  has_role('super_admin') OR
  -- Ops team can update all allocation logs
  has_role('ops_team') OR
  -- Vendor team can update all allocation logs
  has_role('vendor_team')
);

-- Create function to check if user can manage gig workers
CREATE OR REPLACE FUNCTION public.can_manage_gig_workers()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    has_role('super_admin') OR
    has_role('ops_team') OR
    has_role('vendor_team') OR
    has_role('vendor')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.gig_partners TO authenticated;
GRANT ALL ON public.capacity_tracking TO authenticated;
GRANT ALL ON public.allocation_logs TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_user(app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_gig_workers() TO authenticated;
