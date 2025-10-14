-- Verify RLS policies are working correctly
-- This script checks if the RLS policies allow case creation

-- Check current user and role
SELECT 
    'Current user info:' as info,
    auth.uid() as user_id,
    auth.role() as auth_role;

-- Check user profile
SELECT 
    'User profile:' as info,
    p.id,
    p.user_id,
    p.first_name,
    p.last_name,
    p.role,
    p.is_active
FROM public.profiles p
WHERE p.user_id = auth.uid();

-- Check if user has ops_team role
SELECT 
    'Has ops_team role:' as info,
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND role = 'ops_team'
    ) as has_ops_team_role;

-- Check RLS policies on cases table
SELECT 
    'RLS policies on cases:' as info,
    policyname,
    cmd,
    roles,
    permissive
FROM pg_policies 
WHERE tablename = 'cases' 
AND schemaname = 'public'
ORDER BY policyname;

-- Test if we can select from cases table
SELECT 
    'Can select from cases:' as info,
    COUNT(*) as case_count
FROM public.cases;

-- Test if we can insert into cases table (this will show if RLS is working)
DO $$
DECLARE
    test_client_id uuid;
    test_location_id uuid;
    test_case_id uuid;
    case_number text;
    insert_result text;
BEGIN
    -- Get first available client
    SELECT id INTO test_client_id FROM public.clients WHERE is_active = true LIMIT 1;
    
    IF test_client_id IS NULL THEN
        RAISE NOTICE 'No active clients found for testing';
        RETURN;
    END IF;
    
    -- Create a test location
    INSERT INTO public.locations (
        address_line,
        city,
        state,
        pincode,
        country,
        pincode_tier
    ) VALUES (
        'Test Address for RLS Test',
        'Test City',
        'Test State',
        '123456',
        'India',
        'tier3'
    ) RETURNING id INTO test_location_id;
    
    -- Generate case number
    case_number := 'BG-' || to_char(now(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6);
    
    -- Try to create test case
    BEGIN
        INSERT INTO public.cases (
            case_number,
            title,
            description,
            priority,
            client_case_id,
            contract_type,
            candidate_name,
            phone_primary,
            status,
            client_id,
            location_id,
            vendor_tat_start_date,
            due_at,
            base_rate_inr,
            bonus_inr,
            penalty_inr,
            total_payout_inr,
            tat_hours,
            created_by,
            last_updated_by,
            status_updated_at,
            metadata
        ) VALUES (
            case_number,
            'Test Case - RLS Test',
            'Test case for RLS verification',
            'medium',
            'TEST-RLS-001',
            'residential_address_check',
            'Test Candidate',
            '+91-9876543210',
            'created',
            test_client_id,
            test_location_id,
            now(),
            now() + interval '24 hours',
            500.00,
            50.00,
            0.00,
            550.00,
            24,
            auth.uid(),
            auth.uid(),
            now(),
            '{"instructions": "Test case", "candidate_name": "Test Candidate", "phone_primary": "+91-9876543210", "contract_type": "residential_address_check"}'::jsonb
        ) RETURNING id INTO test_case_id;
        
        RAISE NOTICE 'SUCCESS: Test case created with ID: %', test_case_id;
        insert_result := 'SUCCESS';
        
        -- Clean up test data
        DELETE FROM public.cases WHERE id = test_case_id;
        DELETE FROM public.locations WHERE id = test_location_id;
        
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'ERROR: Failed to create test case: %', SQLERRM;
            insert_result := 'ERROR: ' || SQLERRM;
            
            -- Clean up any partial data
            DELETE FROM public.locations WHERE address_line = 'Test Address for RLS Test';
    END;
    
    -- Show result
    RAISE NOTICE 'RLS Test Result: %', insert_result;
END $$;
