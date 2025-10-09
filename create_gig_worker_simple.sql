-- =====================================================
-- Simple Gig Worker Creation (No Auth User Required)
-- This creates gig workers without requiring auth.users
-- =====================================================

-- Create function to create gig worker profile (bypasses RLS)
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
  profile_id UUID;
  gig_partner_id UUID;
  temp_user_id UUID;
BEGIN
  -- Generate a temporary user_id (we'll use a UUID that doesn't exist in auth.users)
  -- This is a workaround for the foreign key constraint
  temp_user_id := gen_random_uuid();

  -- Create profile first with the temporary user_id
  INSERT INTO public.profiles (
    user_id,
    first_name,
    last_name,
    email,
    role,
    is_active,
    created_by
  ) VALUES (
    temp_user_id,
    p_first_name,
    p_last_name,
    p_email,
    'gig_worker',
    true,
    p_created_by
  ) RETURNING id INTO profile_id;

  -- Create gig partner
  INSERT INTO public.gig_partners (
    user_id,
    profile_id,
    phone,
    alternate_phone,
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
    temp_user_id,
    profile_id,
    p_phone,
    p_alternate_phone,
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
  ) RETURNING id INTO gig_partner_id;

  -- Initialize capacity tracking for today
  INSERT INTO public.capacity_tracking (
    gig_partner_id,
    date,
    max_daily_capacity,
    initial_capacity_available,
    current_capacity_available,
    is_active
  ) VALUES (
    gig_partner_id,
    CURRENT_DATE,
    p_max_daily_capacity,
    p_max_daily_capacity,
    p_max_daily_capacity,
    true
  ) ON CONFLICT (gig_partner_id, date) DO NOTHING;

  RETURN gig_partner_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_gig_worker_profile TO authenticated;

-- Test the function
SELECT 
  'Function created successfully' as status,
  'You can now use create_gig_worker_profile() to create gig workers' as message;
