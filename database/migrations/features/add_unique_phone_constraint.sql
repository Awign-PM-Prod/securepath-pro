-- =====================================================
-- Add Unique Constraint on Phone Number for Gig Workers
-- This prevents duplicate mobile numbers
-- =====================================================

-- 1. First, check if there are any duplicate phone numbers
SELECT 
  'Duplicate Phone Numbers Check' as check_type,
  phone,
  COUNT(*) as count
FROM public.gig_partners 
GROUP BY phone 
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- 2. If there are duplicates, we need to handle them first
-- Let's see what duplicates exist
SELECT 
  'Current Phone Numbers' as check_type,
  phone,
  id,
  profile_id,
  created_at
FROM public.gig_partners 
WHERE phone IN (
  SELECT phone 
  FROM public.gig_partners 
  GROUP BY phone 
  HAVING COUNT(*) > 1
)
ORDER BY phone, created_at;

-- 3. Add unique constraint on phone number
-- This will fail if there are duplicates, so we need to clean them first
ALTER TABLE public.gig_partners 
ADD CONSTRAINT unique_phone_number UNIQUE (phone);

-- 4. If the above fails due to duplicates, run this cleanup first:
-- (Uncomment and run this section if there are duplicates)

/*
-- Clean up duplicates by keeping the oldest record and updating others
WITH duplicates AS (
  SELECT 
    id,
    phone,
    ROW_NUMBER() OVER (PARTITION BY phone ORDER BY created_at ASC) as rn
  FROM public.gig_partners
  WHERE phone IN (
    SELECT phone 
    FROM public.gig_partners 
    GROUP BY phone 
    HAVING COUNT(*) > 1
  )
)
UPDATE public.gig_partners 
SET phone = phone || '_duplicate_' || id
WHERE id IN (
  SELECT id 
  FROM duplicates 
  WHERE rn > 1
);

-- Then add the constraint
ALTER TABLE public.gig_partners 
ADD CONSTRAINT unique_phone_number UNIQUE (phone);
*/

-- 5. Test the constraint by trying to insert a duplicate
-- This should fail with a unique constraint violation
INSERT INTO public.gig_partners (
  user_id,
  profile_id,
  phone,
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
  NULL,
  (SELECT id FROM public.profiles WHERE first_name = 'Test' AND last_name = 'Worker' LIMIT 1),
  '9876543210', -- This should fail if it already exists
  '123 Test Street',
  'Bangalore',
  'Karnataka',
  '560001',
  'India',
  ARRAY['560001'],
  3,
  3,
  NULL,
  true,
  true,
  true,
  (SELECT id FROM auth.users LIMIT 1)
) ON CONFLICT (phone) DO NOTHING;

-- 6. Verify the constraint was added
SELECT 
  'Unique Constraint Added' as status,
  constraint_name,
  constraint_type,
  column_name
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu 
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'gig_partners' 
  AND tc.constraint_type = 'UNIQUE'
  AND ccu.column_name = 'phone';

-- 7. Show current constraints on gig_partners table
SELECT 
  'All Constraints on gig_partners' as check_type,
  constraint_name,
  constraint_type,
  column_name
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu 
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'gig_partners'
ORDER BY constraint_name;
