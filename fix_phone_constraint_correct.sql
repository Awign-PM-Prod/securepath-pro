-- =====================================================
-- Fix Phone Number Constraint - Correct Implementation
-- Phone number should be unique in profiles table, not gig_partners
-- =====================================================

-- 1. First, check current phone number storage
SELECT 
  'Current Phone Storage' as check_type,
  'profiles table' as table_name,
  COUNT(*) as total_records,
  COUNT(DISTINCT phone) as unique_phones
FROM public.profiles 
WHERE phone IS NOT NULL;

SELECT 
  'Current Phone Storage' as check_type,
  'gig_partners table' as table_name,
  COUNT(*) as total_records,
  COUNT(DISTINCT phone) as unique_phones
FROM public.gig_partners 
WHERE phone IS NOT NULL;

-- 2. Check if there are duplicate phone numbers in profiles
SELECT 
  'Duplicate Phone Numbers in Profiles' as check_type,
  phone,
  COUNT(*) as count
FROM public.profiles 
WHERE phone IS NOT NULL
GROUP BY phone 
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- 3. Check if there are duplicate phone numbers in gig_partners
SELECT 
  'Duplicate Phone Numbers in Gig Partners' as check_type,
  phone,
  COUNT(*) as count
FROM public.gig_partners 
GROUP BY phone 
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- 4. Remove phone column from gig_partners table (if it exists)
-- First check if the column exists
SELECT 
  'Phone Column Check' as check_type,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'gig_partners' 
  AND column_name = 'phone';

-- 5. Drop the wrong constraint from gig_partners (if it exists)
ALTER TABLE public.gig_partners DROP CONSTRAINT IF EXISTS unique_phone_number;

-- 6. Add unique constraint on phone in profiles table
ALTER TABLE public.profiles 
ADD CONSTRAINT unique_phone_number UNIQUE (phone);

-- 7. Update the create_gig_worker_profile function to store phone in profiles
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
  -- Create profile first with phone number
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

-- 8. Test the constraint by trying to create a duplicate phone
-- This should fail with a unique constraint violation
SELECT public.create_gig_worker_profile(
  'Test',                    -- first_name
  'User',                    -- last_name  
  'test.user2@example.com',  -- email
  '9876543210',             -- phone (should fail if it already exists)
  '123 Test Street',        -- address
  'Bangalore',              -- city
  'Karnataka',              -- state
  '560001',                 -- pincode
  NULL,                     -- alternate_phone
  'India',                  -- country
  ARRAY['560001'],          -- coverage_pincodes
  3,                        -- max_daily_capacity
  NULL,                     -- vendor_id
  true,                     -- is_direct_gig
  true,                     -- is_active
  true,                     -- is_available
  (SELECT id FROM auth.users LIMIT 1)  -- created_by
) as new_gig_worker_id;

-- 9. Verify the constraint was added to profiles table
SELECT 
  'Unique Constraint on Profiles' as status,
  constraint_name,
  constraint_type,
  column_name
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu 
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'profiles' 
  AND tc.constraint_type = 'UNIQUE'
  AND ccu.column_name = 'phone';

-- 10. Show current phone data structure
SELECT 
  'Phone Data Structure' as check_type,
  'profiles' as table_name,
  COUNT(*) as total_records,
  COUNT(phone) as records_with_phone
FROM public.profiles 
WHERE role = 'gig_worker';

SELECT 
  'Phone Data Structure' as check_type,
  'gig_partners' as table_name,
  COUNT(*) as total_records,
  COUNT(phone) as records_with_phone
FROM public.gig_partners;
