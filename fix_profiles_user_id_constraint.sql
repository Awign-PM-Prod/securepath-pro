-- =====================================================
-- Fix Profiles Table to Allow Gig Workers Without Auth Users
-- This makes user_id nullable for gig workers
-- =====================================================

-- First, let's check the current constraint
SELECT 
  'Current constraint check' as status,
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'user_id';

-- Make user_id nullable for gig workers
ALTER TABLE public.profiles ALTER COLUMN user_id DROP NOT NULL;

-- Update the foreign key constraint to allow NULL values
-- First drop the existing constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

-- Create a new constraint that allows NULL values
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Also make user_id nullable in gig_partners table
ALTER TABLE public.gig_partners ALTER COLUMN user_id DROP NOT NULL;

-- Update the foreign key constraint for gig_partners
ALTER TABLE public.gig_partners DROP CONSTRAINT IF EXISTS gig_partners_user_id_fkey;

-- Create a new constraint that allows NULL values
ALTER TABLE public.gig_partners 
ADD CONSTRAINT gig_partners_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Now create the simplified function
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
BEGIN
  -- Create profile first (user_id can be NULL for gig workers)
  INSERT INTO public.profiles (
    user_id,
    first_name,
    last_name,
    email,
    role,
    is_active,
    created_by
  ) VALUES (
    NULL, -- No auth user required for gig workers
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
    NULL, -- No auth user required for gig workers
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
    gig_partner_id,  -- This refers to the variable, not the column
    CURRENT_DATE,
    p_max_daily_capacity,
    p_max_daily_capacity,
    p_max_daily_capacity,
    true
  ) ON CONFLICT (public.capacity_tracking.gig_partner_id, public.capacity_tracking.date) DO NOTHING;

  RETURN gig_partner_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_gig_worker_profile TO authenticated;

-- Test the function
SELECT 
  'Schema updated successfully' as status,
  'user_id is now nullable for gig workers' as message;
