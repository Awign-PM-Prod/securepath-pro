-- Debug gig worker access step by step
-- This script helps identify the exact issue

-- First, let's check if the user exists and has the right role
DO $$
DECLARE
  test_user_id uuid;
  user_profile record;
  gig_partner_record record;
BEGIN
  -- Get the user ID from the email
  SELECT id INTO test_user_id 
  FROM auth.users 
  WHERE email = 'deepanshu.shahara+03@awign.com';
  
  IF test_user_id IS NOT NULL THEN
    RAISE NOTICE 'Found user: %', test_user_id;
    
    -- Check the profile
    SELECT * INTO user_profile 
    FROM public.profiles 
    WHERE user_id = test_user_id;
    
    IF user_profile IS NOT NULL THEN
      RAISE NOTICE 'Profile found: role=%, active=%', user_profile.role, user_profile.is_active;
    ELSE
      RAISE NOTICE 'No profile found for this user';
    END IF;
    
    -- Check gig_partners
    SELECT * INTO gig_partner_record 
    FROM public.gig_partners 
    WHERE user_id = test_user_id;
    
    IF gig_partner_record IS NOT NULL THEN
      RAISE NOTICE 'Gig partner found: id=%, active=%', gig_partner_record.id, gig_partner_record.is_active;
    ELSE
      RAISE NOTICE 'No gig partner record found for this user';
    END IF;
    
  ELSE
    RAISE NOTICE 'User not found with email: deepanshu.shahara+03@awign.com';
  END IF;
END $$;

-- Let's temporarily disable RLS on gig_partners to test
ALTER TABLE public.gig_partners DISABLE ROW LEVEL SECURITY;

-- Test if the user can now access their gig_partners record
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
    
    RAISE NOTICE 'With RLS disabled, user can access % gig_partners records', gig_partner_count;
  END IF;
END $$;

-- Re-enable RLS
ALTER TABLE public.gig_partners ENABLE ROW LEVEL SECURITY;

-- Now let's create a very simple RLS policy
DROP POLICY IF EXISTS "gig_partners_select_policy" ON public.gig_partners;
DROP POLICY IF EXISTS "gig_partners_insert_policy" ON public.gig_partners;
DROP POLICY IF EXISTS "gig_partners_update_policy" ON public.gig_partners;
DROP POLICY IF EXISTS "gig_partners_delete_policy" ON public.gig_partners;

-- Create the simplest possible policy
CREATE POLICY "gig_partners_select_policy"
ON public.gig_partners 
FOR SELECT
TO authenticated
USING (true);  -- Allow all authenticated users to read

CREATE POLICY "gig_partners_insert_policy"
ON public.gig_partners 
FOR INSERT
TO authenticated
WITH CHECK (true);  -- Allow all authenticated users to insert

CREATE POLICY "gig_partners_update_policy"
ON public.gig_partners 
FOR UPDATE
TO authenticated
USING (true);  -- Allow all authenticated users to update

CREATE POLICY "gig_partners_delete_policy"
ON public.gig_partners 
FOR DELETE
TO authenticated
USING (true);  -- Allow all authenticated users to delete

-- Test again with the simple policy
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
    
    RAISE NOTICE 'With simple RLS policy, user can access % gig_partners records', gig_partner_count;
  END IF;
END $$;

RAISE NOTICE 'Debug complete - check the results above';
