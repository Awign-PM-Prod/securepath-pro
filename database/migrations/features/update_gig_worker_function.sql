-- =====================================================
-- Update Gig Worker Creation Function
-- Fix phone number storage to be in profiles table
-- =====================================================

-- Drop and recreate the function with correct phone storage
DROP FUNCTION IF EXISTS public.create_gig_worker_profile;

CREATE OR REPLACE FUNCTION public.create_gig_worker_profile(
  p_first_name TEXT,
  p_last_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_address TEXT,
  p_city TEXT,
  p_state TEXT,
  p_pincode TEXT,
  p_alternate_phone TEXT DEFAULT NULL,
  p_country TEXT DEFAULT 'India',
  p_coverage_pincodes TEXT[] DEFAULT '{}',
  p_max_daily_capacity INTEGER DEFAULT 1,
  p_vendor_id UUID DEFAULT NULL,
  p_is_direct_gig BOOLEAN DEFAULT true,
  p_is_active BOOLEAN DEFAULT true,
  p_is_available BOOLEAN DEFAULT true,
  p_created_by UUID DEFAULT auth.uid()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_profile_id UUID;
  new_gig_partner_id UUID;
BEGIN
  -- Create profile first with phone number (user_id can be NULL for gig workers)
  INSERT INTO public.profiles (
    user_id,
    first_name,
    last_name,
    email,
    phone,  -- Store phone in profiles table
    role,
    is_active,
    created_by
  ) VALUES (
    NULL, -- No auth user required for gig workers
    p_first_name,
    p_last_name,
    p_email,
    p_phone,  -- Store phone here
    'gig_worker',
    true,
    p_created_by
  ) RETURNING id INTO new_profile_id;

  -- Create gig partner WITHOUT phone (phone is in profiles)
  INSERT INTO public.gig_partners (
    user_id,
    profile_id,
    alternate_phone,  -- Only alternate phone in gig_partners
    address,
    city,
    state,
    pincode,
    country,
    coverage_pincodes,
    max_daily_capacity,
    capacity_available,
    vendor_id,
    is_direct_gig,
    is_active,
    is_available,
    created_by
  ) VALUES (
    NULL, -- No auth user required for gig workers
    new_profile_id,
    p_alternate_phone,  -- Only alternate phone here
    p_address,
    p_city,
    p_state,
    p_pincode,
    p_country,
    p_coverage_pincodes,
    p_max_daily_capacity,
    p_max_daily_capacity,
    p_vendor_id,
    p_is_direct_gig,
    p_is_active,
    p_is_available,
    p_created_by
  ) RETURNING id INTO new_gig_partner_id;

  -- Initialize capacity tracking for today
  INSERT INTO public.capacity_tracking (
    gig_partner_id,
    date,
    max_daily_capacity,
    initial_capacity_available,
    current_capacity_available,
    is_active
  ) VALUES (
    new_gig_partner_id,
    CURRENT_DATE,
    p_max_daily_capacity,
    p_max_daily_capacity,
    p_max_daily_capacity,
    true
  ) ON CONFLICT (gig_partner_id, date) DO NOTHING;

  RETURN new_gig_partner_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_gig_worker_profile TO authenticated;

-- Test the function
SELECT 
  'Function updated successfully' as status,
  'Phone numbers will now be stored in profiles table' as message;
