-- Fix gig worker access to cases and create test data (Final corrected version)
-- This script uses the correct enum values for both case_status and assignment_type

-- First, let's check what case statuses and assignment types actually exist
DO $$
DECLARE
  case_count integer;
  status_counts record;
  assignment_counts record;
BEGIN
  SELECT COUNT(*) INTO case_count FROM public.cases;
  RAISE NOTICE 'Total cases: %', case_count;
  
  -- Show count for each status
  RAISE NOTICE 'Case statuses:';
  FOR status_counts IN 
    SELECT status, COUNT(*) as count 
    FROM public.cases 
    GROUP BY status 
    ORDER BY count DESC
  LOOP
    RAISE NOTICE '  Status "%": % cases', status_counts.status, status_counts.count;
  END LOOP;
  
  -- Show count for each assignment type
  RAISE NOTICE 'Assignment types:';
  FOR assignment_counts IN 
    SELECT current_assignee_type, COUNT(*) as count 
    FROM public.cases 
    WHERE current_assignee_type IS NOT NULL
    GROUP BY current_assignee_type 
    ORDER BY count DESC
  LOOP
    RAISE NOTICE '  Assignment type "%": % cases', assignment_counts.current_assignee_type, assignment_counts.count;
  END LOOP;
END $$;

-- Ensure RLS policies allow gig workers to view their assigned cases
DROP POLICY IF EXISTS "Users can view cases they are assigned to" ON public.cases;
DROP POLICY IF EXISTS "Gig workers can view their assigned cases" ON public.cases;

CREATE POLICY "Gig workers can view their assigned cases"
ON public.cases 
FOR SELECT
TO authenticated
USING (
  -- Gig workers can view cases assigned to them
  (current_assignee_type = 'gig' AND current_assignee_id IN (
    SELECT id FROM public.gig_partners WHERE user_id = auth.uid()
  )) OR
  -- Super admins can view all
  (has_role('super_admin')) OR
  -- Ops team can view all
  (has_role('ops_team')) OR
  -- Vendor team can view all
  (has_role('vendor_team')) OR
  -- Vendors can view cases assigned to their gig workers
  (has_role('vendor') AND current_assignee_type = 'gig' AND current_assignee_id IN (
    SELECT gp.id FROM public.gig_partners gp
    JOIN public.vendors v ON gp.vendor_id = v.id
    WHERE v.created_by = auth.uid()
  ))
);

-- Also allow gig workers to update their assigned cases
DROP POLICY IF EXISTS "Gig workers can update their assigned cases" ON public.cases;

CREATE POLICY "Gig workers can update their assigned cases"
ON public.cases 
FOR UPDATE
TO authenticated
USING (
  -- Gig workers can update cases assigned to them
  (current_assignee_type = 'gig' AND current_assignee_id IN (
    SELECT id FROM public.gig_partners WHERE user_id = auth.uid()
  )) OR
  -- Super admins can update all
  (has_role('super_admin')) OR
  -- Ops team can update all
  (has_role('ops_team')) OR
  -- Vendor team can update all
  (has_role('vendor_team'))
);

-- Create test cases for gig workers if they don't exist
DO $$
DECLARE
  test_gig_worker_id uuid;
  test_client_id uuid;
  test_location_id uuid;
  test_contract_id uuid;
  case_count integer;
BEGIN
  -- Get a test gig worker
  SELECT gp.id INTO test_gig_worker_id
  FROM public.gig_partners gp
  JOIN public.profiles p ON gp.profile_id = p.id
  WHERE p.role = 'gig_worker'
  LIMIT 1;
  
  IF test_gig_worker_id IS NOT NULL THEN
    -- Check if gig worker already has cases
    SELECT COUNT(*) INTO case_count 
    FROM public.cases 
    WHERE current_assignee_id = test_gig_worker_id;
    
    IF case_count = 0 THEN
      RAISE NOTICE 'Creating test cases for gig worker: %', test_gig_worker_id;
      
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
      
      -- Create test cases using valid enum values
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
        total_payout_inr,
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
        'auto_allocated',  -- Using valid case_status enum value
        500.00,
        500.00,
        test_gig_worker_id,
        'gig',  -- Using valid assignment_type enum value
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
        'auto_allocated',  -- Using valid case_status enum value
        750.00,
        750.00,
        test_gig_worker_id,
        'gig',  -- Using valid assignment_type enum value
        (SELECT id FROM auth.users LIMIT 1)
      );
      
      -- Create allocation logs
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
        'gig',  -- Using valid assignment_type enum value
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
      
      RAISE NOTICE 'Created test cases for gig worker';
    ELSE
      RAISE NOTICE 'Gig worker already has % cases assigned', case_count;
    END IF;
  ELSE
    RAISE NOTICE 'No gig workers found to create test cases for';
  END IF;
END $$;

-- Test the access
DO $$
DECLARE
  test_gig_worker_id uuid;
  test_user_id uuid;
  case_count integer;
BEGIN
  -- Get a test gig worker
  SELECT gp.id, gp.user_id 
  INTO test_gig_worker_id, test_user_id
  FROM public.gig_partners gp
  JOIN public.profiles p ON gp.profile_id = p.id
  WHERE p.role = 'gig_worker'
  LIMIT 1;
  
  IF test_gig_worker_id IS NOT NULL THEN
    -- Count cases assigned to this gig worker
    SELECT COUNT(*) INTO case_count 
    FROM public.cases 
    WHERE current_assignee_id = test_gig_worker_id;
    
    RAISE NOTICE 'Gig worker test results:';
    RAISE NOTICE '  Gig Worker ID: %', test_gig_worker_id;
    RAISE NOTICE '  User ID: %', test_user_id;
    RAISE NOTICE '  Assigned cases: %', case_count;
    
    -- Show case details
    IF case_count > 0 THEN
      RAISE NOTICE 'Case details:';
      FOR rec IN 
        SELECT case_number, title, status, priority, base_rate_inr, current_assignee_type
        FROM public.cases 
        WHERE current_assignee_id = test_gig_worker_id
        LIMIT 3
      LOOP
        RAISE NOTICE '  - %: % (%) - % - ₹% - %', 
          rec.case_number, rec.title, rec.status, rec.priority, rec.base_rate_inr, rec.current_assignee_type;
      END LOOP;
    END IF;
  END IF;
END $$;
