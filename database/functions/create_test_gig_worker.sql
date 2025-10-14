-- Create a test gig worker with login credentials
-- This script creates a complete test gig worker account

-- First, create the auth user
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  invited_at,
  confirmation_token,
  confirmation_sent_at,
  recovery_token,
  recovery_sent_at,
  email_change_token_new,
  email_change,
  email_change_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  phone,
  phone_confirmed_at,
  phone_change,
  phone_change_token,
  phone_change_sent_at,
  email_change_token_current,
  email_change_confirm_status,
  banned_until,
  reauthentication_token,
  reauthentication_sent_at,
  is_sso_user,
  deleted_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'gigworker.test@example.com',
  crypt('TestPassword123!', gen_salt('bf')),
  now(),
  now(),
  '',
  now(),
  '',
  null,
  '',
  '',
  null,
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"first_name": "Test", "last_name": "GigWorker"}',
  false,
  now(),
  now(),
  '+919876543210',
  now(),
  '',
  '',
  null,
  '',
  0,
  null,
  '',
  null,
  false,
  null
) RETURNING id as user_id;

-- Get the user ID we just created
DO $$
DECLARE
  test_user_id uuid;
  test_profile_id uuid;
  test_gig_worker_id uuid;
BEGIN
  -- Get the user ID
  SELECT id INTO test_user_id FROM auth.users WHERE email = 'gigworker.test@example.com' LIMIT 1;
  
  IF test_user_id IS NOT NULL THEN
    -- Create profile
    INSERT INTO public.profiles (
      user_id,
      email,
      first_name,
      last_name,
      phone,
      role,
      is_active,
      created_by,
      created_at,
      updated_at
    ) VALUES (
      test_user_id,
      'gigworker.test@example.com',
      'Test',
      'GigWorker',
      '+919876543210',
      'gig_worker',
      true,
      test_user_id,
      now(),
      now()
    ) RETURNING id INTO test_profile_id;
    
    -- Create gig worker profile
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
      completion_rate,
      ontime_completion_rate,
      acceptance_rate,
      quality_score,
      is_active,
      is_available,
      created_by,
      created_at,
      updated_at
    ) VALUES (
      test_user_id,
      test_profile_id,
      '+919876543210',
      '123 Test Street',
      'Bangalore',
      'Karnataka',
      '560001',
      'India',
      ARRAY['560001', '560002', '560003'],
      5,
      5,
      0.85,
      0.90,
      0.95,
      0.88,
      true,
      true,
      test_user_id,
      now(),
      now()
    ) RETURNING id INTO test_gig_worker_id;
    
    -- Create performance metrics
    INSERT INTO public.performance_metrics (
      gig_partner_id,
      period_start,
      period_end,
      total_cases_assigned,
      total_cases_accepted,
      total_cases_completed,
      total_cases_on_time,
      total_cases_qc_passed,
      completion_rate,
      ontime_completion_rate,
      acceptance_rate,
      quality_score,
      created_at
    ) VALUES (
      test_gig_worker_id,
      CURRENT_DATE - INTERVAL '30 days',
      CURRENT_DATE,
      20,
      18,
      16,
      14,
      15,
      0.85,
      0.90,
      0.95,
      0.88,
      now()
    );
    
    RAISE NOTICE 'Test gig worker created successfully!';
    RAISE NOTICE 'Email: gigworker.test@example.com';
    RAISE NOTICE 'Password: TestPassword123!';
    RAISE NOTICE 'User ID: %', test_user_id;
    RAISE NOTICE 'Profile ID: %', test_profile_id;
    RAISE NOTICE 'Gig Worker ID: %', test_gig_worker_id;
    
  ELSE
    RAISE NOTICE 'Failed to create test gig worker';
  END IF;
END $$;
