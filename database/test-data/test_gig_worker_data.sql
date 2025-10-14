-- Test script to verify gig worker data is properly linked
-- This will help us confirm the fix worked

-- Check the specific user we're testing
SELECT 
  'User Data Check' as test_type,
  p.id as profile_id,
  p.user_id,
  p.email,
  p.first_name,
  p.last_name,
  p.role,
  p.is_active,
  gp.id as gig_partner_id,
  gp.user_id as gp_user_id,
  gp.is_active as gp_is_active,
  gp.is_available
FROM public.profiles p
LEFT JOIN public.gig_partners gp ON p.user_id = gp.user_id
WHERE p.email = 'deepanshu.shahara+03@awign.com';

-- Check if the user_id matches between tables
SELECT 
  'Data Consistency Check' as test_type,
  CASE 
    WHEN p.user_id = gp.user_id THEN 'MATCH'
    ELSE 'MISMATCH'
  END as user_id_match,
  p.user_id as profile_user_id,
  gp.user_id as gig_partner_user_id,
  p.email
FROM public.profiles p
LEFT JOIN public.gig_partners gp ON p.user_id = gp.user_id
WHERE p.email = 'deepanshu.shahara+03@awign.com';

-- Test the RLS policy by simulating what the app does
-- This simulates the query: SELECT id FROM gig_partners WHERE user_id = 'user_id'
SELECT 
  'RLS Test' as test_type,
  id as gig_partner_id,
  user_id,
  profile_id,
  is_active
FROM public.gig_partners 
WHERE user_id = (
  SELECT user_id 
  FROM public.profiles 
  WHERE email = 'deepanshu.shahara+03@awign.com'
);

-- Check all gig workers with proper linking
SELECT 
  'All Gig Workers Status' as test_type,
  COUNT(*) as total_gig_workers,
  COUNT(gp.id) as with_gig_partners,
  COUNT(*) - COUNT(gp.id) as missing_gig_partners
FROM public.profiles p
LEFT JOIN public.gig_partners gp ON p.user_id = gp.user_id
WHERE p.role = 'gig_worker';
