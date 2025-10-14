-- Fix gig_partners table - populate missing user_id values
-- This script fixes the data issue causing the 406 error

-- First, let's see the current state
SELECT 
  'Before Fix' as status,
  COUNT(*) as total_gig_partners,
  COUNT(user_id) as gig_partners_with_user_id,
  COUNT(*) - COUNT(user_id) as gig_partners_without_user_id
FROM public.gig_partners;

-- Update gig_partners to set user_id based on profile relationship
UPDATE public.gig_partners 
SET user_id = p.user_id
FROM public.profiles p
WHERE gig_partners.profile_id = p.id 
AND gig_partners.user_id IS NULL;

-- Check the results
SELECT 
  'After Fix' as status,
  COUNT(*) as total_gig_partners,
  COUNT(user_id) as gig_partners_with_user_id,
  COUNT(*) - COUNT(user_id) as gig_partners_without_user_id
FROM public.gig_partners;

-- Verify the specific user we're testing
SELECT 
  'User Verification' as check_type,
  gp.id as gig_partner_id,
  gp.user_id,
  gp.profile_id,
  p.email as profile_email,
  p.role,
  p.is_active
FROM public.gig_partners gp
JOIN public.profiles p ON gp.profile_id = p.id
WHERE p.email = 'deepanshu.shahara+03@awign.com';

-- Test the RLS policy should work now
DO $$
DECLARE
  test_user_id uuid;
  gig_partner_count integer;
BEGIN
  -- Get the user ID
  SELECT id INTO test_user_id 
  FROM auth.users 
  WHERE email = 'deepanshu.shahara+03@awign.com';
  
  IF test_user_id IS NOT NULL THEN
    -- Count gig_partners records for this user
    SELECT COUNT(*) INTO gig_partner_count 
    FROM public.gig_partners 
    WHERE user_id = test_user_id;
    
    RAISE NOTICE 'User % can now access % gig_partners records', test_user_id, gig_partner_count;
  ELSE
    RAISE NOTICE 'User not found';
  END IF;
END $$;
