-- =====================================================
-- Fix gig_partners table to remove phone column constraint
-- Phone is now stored in profiles table
-- =====================================================

-- 1. First, check the current structure of gig_partners table
SELECT 
  'Current gig_partners columns' as check_type,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'gig_partners' 
  AND column_name = 'phone'
ORDER BY ordinal_position;

-- 2. Check if there are any existing phone values in gig_partners
SELECT 
  'Existing phone values in gig_partners' as check_type,
  COUNT(*) as total_records,
  COUNT(phone) as records_with_phone,
  COUNT(*) - COUNT(phone) as records_without_phone
FROM public.gig_partners;

-- 3. Make phone column nullable in gig_partners (if it exists)
ALTER TABLE public.gig_partners ALTER COLUMN phone DROP NOT NULL;

-- 4. Update existing records to set phone to NULL (since it's now in profiles)
UPDATE public.gig_partners 
SET phone = NULL 
WHERE phone IS NOT NULL;

-- 5. Verify the change
SELECT 
  'Updated gig_partners phone column' as check_type,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'gig_partners' 
  AND column_name = 'phone';

-- 6. Check if there are any remaining phone values
SELECT 
  'Phone values after update' as check_type,
  COUNT(*) as total_records,
  COUNT(phone) as records_with_phone
FROM public.gig_partners;

-- 7. Now test the function again
SELECT public.create_gig_worker_profile(
  'Test',                    -- first_name
  'User',                    -- last_name  
  'test.user3@example.com',  -- email
  '9876543211',             -- phone (should be stored in profiles)
  '123 Test Street',        -- address
  'Bangalore',              -- city
  'Karnataka',              -- state
  '560001',                 -- pincode
  '9876543212',             -- alternate_phone (stored in gig_partners)
  'India',                  -- country
  ARRAY['560001'],          -- coverage_pincodes
  3,                        -- max_daily_capacity
  NULL,                     -- vendor_id
  true,                     -- is_direct_gig
  true,                     -- is_active
  true,                     -- is_available
  (SELECT id FROM auth.users LIMIT 1)  -- created_by
) as new_gig_worker_id;

-- 8. Verify the data was stored correctly
SELECT 
  'Data Storage Verification' as check_type,
  p.first_name,
  p.last_name,
  p.email,
  p.phone as profile_phone,
  gp.alternate_phone as gig_partner_alternate_phone,
  gp.phone as gig_partner_phone
FROM public.profiles p
JOIN public.gig_partners gp ON p.id = gp.profile_id
WHERE p.first_name = 'Test' AND p.last_name = 'User'
ORDER BY p.created_at DESC
LIMIT 1;
