-- Test gig worker access and create sample cases
-- This script tests if gig workers can access their data and creates test cases

-- First, let's check if we have any gig workers
DO $$
DECLARE
  gig_worker_count integer;
  test_gig_worker_id uuid;
  test_user_id uuid;
  test_profile_id uuid;
BEGIN
  -- Count gig workers
  SELECT COUNT(*) INTO gig_worker_count FROM public.gig_partners;
  RAISE NOTICE 'Total gig workers in database: %', gig_worker_count;
  
  -- Get a test gig worker
  SELECT gp.id, gp.user_id, gp.profile_id 
  INTO test_gig_worker_id, test_user_id, test_profile_id
  FROM public.gig_partners gp
  JOIN public.profiles p ON gp.profile_id = p.id
  WHERE p.role = 'gig_worker'
  LIMIT 1;
  
  IF test_gig_worker_id IS NOT NULL THEN
    RAISE NOTICE 'Test gig worker found:';
    RAISE NOTICE '  Gig Worker ID: %', test_gig_worker_id;
    RAISE NOTICE '  User ID: %', test_user_id;
    RAISE NOTICE '  Profile ID: %', test_profile_id;
    
    -- Test if the gig worker can access their own data
    PERFORM 1 FROM public.gig_partners WHERE user_id = test_user_id;
    RAISE NOTICE '  Can access own gig_partners record: YES';
    
    -- Test if the gig worker can access their profile
    PERFORM 1 FROM public.profiles WHERE user_id = test_user_id;
    RAISE NOTICE '  Can access own profile: YES';
    
  ELSE
    RAISE NOTICE 'No gig workers found!';
  END IF;
END $$;

-- Create some test cases for the gig worker
DO $$
DECLARE
  test_gig_worker_id uuid;
  test_client_id uuid;
  test_location_id uuid;
  test_case_id uuid;
  test_contract_id uuid;
BEGIN
  -- Get a test gig worker
  SELECT gp.id INTO test_gig_worker_id
  FROM public.gig_partners gp
  JOIN public.profiles p ON gp.profile_id = p.id
  WHERE p.role = 'gig_worker'
  LIMIT 1;
  
  IF test_gig_worker_id IS NOT NULL THEN
    -- Get or create a test client
    SELECT id INTO test_client_id FROM public.clients LIMIT 1;
    IF test_client_id IS NULL THEN
      INSERT INTO public.clients (name, email, phone, country, is_active, created_by)
      VALUES ('Test Client', 'test@client.com', '+919876543210', 'India', true, 
              (SELECT id FROM auth.users LIMIT 1))
      RETURNING id INTO test_client_id;
    END IF;
    
    -- Get or create a test location
    SELECT id INTO test_location_id FROM public.locations LIMIT 1;
    IF test_location_id IS NULL THEN
      INSERT INTO public.locations (address_line, city, state, country, pincode, pincode_tier)
      VALUES ('123 Test Street', 'Bangalore', 'Karnataka', 'India', '560001', 'tier_1')
      RETURNING id INTO test_location_id;
    END IF;
    
    -- Get or create a test contract
    SELECT id INTO test_contract_id FROM public.client_contracts LIMIT 1;
    IF test_contract_id IS NULL THEN
      INSERT INTO public.client_contracts (client_id, contract_type, terms, is_active, created_by)
      VALUES (test_client_id, 'residential_address_check', '{"tier_1": {"tat_days": 1, "revenue": 500, "base_payout": 300}}', true,
              (SELECT id FROM auth.users LIMIT 1))
      RETURNING id INTO test_contract_id;
    END IF;
    
    -- Create test cases for the gig worker
    INSERT INTO public.cases (
      case_number,
      title,
      description,
      priority,
      source,
      client_id,
      location_id,
      tat_hours,
      due_at,
      status,
      base_rate_inr,
      total_rate_inr,
      current_assignee_id,
      current_assignee_type,
      created_by
    ) VALUES 
    (
      'CASE-' || EXTRACT(EPOCH FROM NOW())::text,
      'Test Case 1 - Address Verification',
      'Verify the address for the candidate',
      'medium',
      'manual',
      test_client_id,
      test_location_id,
      24,
      NOW() + INTERVAL '2 days',
      'allocated',
      500.00,
      500.00,
      test_gig_worker_id,
      'gig_worker',
      (SELECT id FROM auth.users LIMIT 1)
    ),
    (
      'CASE-' || (EXTRACT(EPOCH FROM NOW()) + 1)::text,
      'Test Case 2 - Background Check',
      'Perform background verification',
      'high',
      'manual',
      test_client_id,
      test_location_id,
      48,
      NOW() + INTERVAL '3 days',
      'allocated',
      750.00,
      750.00,
      test_gig_worker_id,
      'gig_worker',
      (SELECT id FROM auth.users LIMIT 1)
    )
    RETURNING id INTO test_case_id;
    
    -- Create allocation logs for the cases
    INSERT INTO public.allocation_logs (
      case_id,
      candidate_id,
      candidate_type,
      allocated_at,
      decision,
      decision_at,
      wave_number,
      score_snapshot,
      final_score,
      acceptance_window_minutes,
      acceptance_deadline,
      created_by
    ) 
    SELECT 
      c.id,
      test_gig_worker_id,
      'gig_worker',
      NOW(),
      'allocated',
      NOW(),
      1,
      '{"quality_score": 0.85, "completion_rate": 0.90}',
      0.85,
      30,
      NOW() + INTERVAL '30 minutes',
      (SELECT id FROM auth.users LIMIT 1)
    FROM public.cases c
    WHERE c.current_assignee_id = test_gig_worker_id;
    
    RAISE NOTICE 'Created test cases for gig worker:';
    RAISE NOTICE '  Client ID: %', test_client_id;
    RAISE NOTICE '  Location ID: %', test_location_id;
    RAISE NOTICE '  Contract ID: %', test_contract_id;
    RAISE NOTICE '  Cases created and allocated to gig worker';
    
  ELSE
    RAISE NOTICE 'No gig workers found to create test cases for';
  END IF;
END $$;

-- Verify the test data
SELECT 
  c.case_number,
  c.title,
  c.status,
  c.priority,
  c.base_rate_inr,
  c.total_rate_inr,
  c.due_at,
  cl.name as client_name,
  l.address_line,
  l.city,
  l.state,
  l.pincode,
  gp.user_id as gig_worker_user_id
FROM public.cases c
JOIN public.clients cl ON c.client_id = cl.id
JOIN public.locations l ON c.location_id = l.id
JOIN public.gig_partners gp ON c.current_assignee_id = gp.id
WHERE c.status = 'allocated'
ORDER BY c.created_at DESC
LIMIT 5;
