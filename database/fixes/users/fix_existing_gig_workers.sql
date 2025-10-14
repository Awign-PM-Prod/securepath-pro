-- Fix existing gig workers that were created without proper linking
-- This script fixes the data for existing gig workers

-- First, let's see the current state
SELECT 
  'Current State' as status,
  COUNT(*) as total_profiles,
  COUNT(user_id) as profiles_with_user_id,
  COUNT(*) - COUNT(user_id) as profiles_without_user_id
FROM public.profiles 
WHERE role = 'gig_worker';

-- Check gig_partners status
SELECT 
  'Gig Partners State' as status,
  COUNT(*) as total_gig_partners,
  COUNT(user_id) as gig_partners_with_user_id,
  COUNT(*) - COUNT(user_id) as gig_partners_without_user_id
FROM public.gig_partners;

-- Find profiles that have user_id but no corresponding gig_partners record
SELECT 
  'Missing Gig Partners' as status,
  p.id as profile_id,
  p.user_id,
  p.email,
  p.first_name,
  p.last_name
FROM public.profiles p
LEFT JOIN public.gig_partners gp ON p.user_id = gp.user_id
WHERE p.role = 'gig_worker' 
AND p.user_id IS NOT NULL 
AND gp.id IS NULL;

-- Find gig_partners that have user_id but no corresponding profile
SELECT 
  'Missing Profiles' as status,
  gp.id as gig_partner_id,
  gp.user_id,
  gp.profile_id,
  p.email as profile_email
FROM public.gig_partners gp
LEFT JOIN public.profiles p ON gp.user_id = p.user_id
WHERE gp.user_id IS NOT NULL 
AND p.id IS NULL;

-- Create missing gig_partners records for profiles that have user_id
INSERT INTO public.gig_partners (
  user_id,
  profile_id,
  phone,
  is_active,
  is_available,
  created_by
)
SELECT 
  p.user_id,
  p.id as profile_id,
  COALESCE(p.phone, '') as phone,
  p.is_active,
  true as is_available,
  p.created_by
FROM public.profiles p
LEFT JOIN public.gig_partners gp ON p.user_id = gp.user_id
WHERE p.role = 'gig_worker' 
AND p.user_id IS NOT NULL 
AND gp.id IS NULL;

-- Update gig_partners records that have NULL user_id
UPDATE public.gig_partners 
SET user_id = p.user_id
FROM public.profiles p
WHERE gig_partners.profile_id = p.id 
AND gig_partners.user_id IS NULL
AND p.user_id IS NOT NULL;

-- Final verification
SELECT 
  'Final State' as status,
  COUNT(*) as total_profiles,
  COUNT(user_id) as profiles_with_user_id,
  COUNT(*) - COUNT(user_id) as profiles_without_user_id
FROM public.profiles 
WHERE role = 'gig_worker';

SELECT 
  'Final Gig Partners State' as status,
  COUNT(*) as total_gig_partners,
  COUNT(user_id) as gig_partners_with_user_id,
  COUNT(*) - COUNT(user_id) as gig_partners_without_user_id
FROM public.gig_partners;

-- Show the specific user we're testing
SELECT 
  'Test User Verification' as status,
  p.id as profile_id,
  p.user_id,
  p.email,
  p.first_name,
  p.last_name,
  p.role,
  p.is_active,
  gp.id as gig_partner_id,
  gp.user_id as gp_user_id,
  gp.is_active as gp_is_active
FROM public.profiles p
LEFT JOIN public.gig_partners gp ON p.user_id = gp.user_id
WHERE p.email = 'deepanshu.shahara+03@awign.com';
