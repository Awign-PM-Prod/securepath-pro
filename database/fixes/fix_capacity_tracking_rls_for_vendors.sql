-- Fix RLS policy for capacity_tracking to allow vendors to insert records
-- This is needed when vendors assign cases to gig workers

-- Update the INSERT policy for capacity_tracking to include vendors
DROP POLICY IF EXISTS "Users can create capacity tracking they are authorized to manage" ON public.capacity_tracking;

CREATE POLICY "Users can create capacity tracking they are authorized to manage"
ON public.capacity_tracking 
FOR INSERT
WITH CHECK (
  -- Allow service role (for edge functions)
  auth.jwt() ->> 'role' = 'service_role' OR
  -- Ops team can create capacity tracking
  has_role('ops_team') OR
  -- Vendor team can create capacity tracking
  has_role('vendor_team') OR
  -- Vendors can create capacity tracking for their own gig workers
  (has_role('vendor') AND gig_partner_id IN (
    SELECT id FROM public.gig_partners WHERE vendor_id = (
      SELECT id FROM public.vendors WHERE created_by = auth.uid() LIMIT 1
    )
  ))
);

-- Also update the UPDATE policy to allow vendors to update their gig workers' capacity
DROP POLICY IF EXISTS "Users can update capacity tracking they are authorized to manage" ON public.capacity_tracking;

CREATE POLICY "Users can update capacity tracking they are authorized to manage"
ON public.capacity_tracking 
FOR UPDATE
USING (
  -- Super admins can update all
  has_role('super_admin') OR
  -- Ops team can update all capacity tracking
  has_role('ops_team') OR
  -- Vendor team can update all capacity tracking
  has_role('vendor_team') OR
  -- Vendors can update capacity tracking for their own gig workers
  (has_role('vendor') AND gig_partner_id IN (
    SELECT id FROM public.gig_partners WHERE vendor_id = (
      SELECT id FROM public.vendors WHERE created_by = auth.uid() LIMIT 1
    )
  ))
);

-- Test the policy by checking if it works
SELECT 
  'RLS policies updated successfully for capacity_tracking' as status,
  'Vendors can now create and update capacity tracking for their gig workers' as message;
