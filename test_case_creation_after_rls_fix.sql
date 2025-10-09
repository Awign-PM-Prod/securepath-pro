-- Test case creation after RLS fix
-- This script tests if case creation works properly

-- First, let's check if we have the required data
SELECT 'Checking required data...' as status;

-- Check if we have clients
SELECT 
    'Clients available:' as info,
    COUNT(*) as client_count
FROM public.clients 
WHERE is_active = true;

-- Check if we have contract types
SELECT 
    'Contract types available:' as info,
    COUNT(*) as contract_type_count
FROM public.contract_type_config 
WHERE is_active = true;

-- Check if we have pincode tiers
SELECT 
    'Pincode tiers available:' as info,
    COUNT(*) as pincode_tier_count
FROM public.pincode_tiers 
WHERE is_active = true;

-- Check if we have client contracts
SELECT 
    'Client contracts available:' as info,
    COUNT(*) as client_contract_count
FROM public.client_contracts 
WHERE is_active = true;

-- Test the get_case_defaults function
SELECT 'Testing get_case_defaults function...' as status;

-- Get a sample client and test the function
DO $$
DECLARE
    test_client_id uuid;
    test_contract_type text := 'residential_address_check';
    test_tier integer := 1;
    result record;
BEGIN
    -- Get first available client
    SELECT id INTO test_client_id FROM public.clients WHERE is_active = true LIMIT 1;
    
    IF test_client_id IS NOT NULL THEN
        -- Test the function
        SELECT * INTO result FROM public.get_case_defaults(test_client_id, test_contract_type, test_tier);
        
        RAISE NOTICE 'get_case_defaults function test successful';
        RAISE NOTICE 'Client ID: %, Contract Type: %, Tier: %', test_client_id, test_contract_type, test_tier;
        RAISE NOTICE 'Result: %', result;
    ELSE
        RAISE NOTICE 'No active clients found for testing';
    END IF;
END $$;

-- Test case creation (this should work after RLS fix)
SELECT 'Testing case creation...' as status;

-- Create a test case
DO $$
DECLARE
    test_client_id uuid;
    test_location_id uuid;
    test_case_id uuid;
    case_number text;
BEGIN
    -- Get first available client
    SELECT id INTO test_client_id FROM public.clients WHERE is_active = true LIMIT 1;
    
    -- Create a test location
    INSERT INTO public.locations (
        address_line,
        city,
        state,
        pincode,
        country,
        pincode_tier
    ) VALUES (
        'Test Address for Case Creation',
        'Test City',
        'Test State',
        '123456',
        'India',
        'tier3'
    ) RETURNING id INTO test_location_id;
    
    -- Generate case number
    case_number := 'BG-' || to_char(now(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6);
    
    -- Create test case
    INSERT INTO public.cases (
        case_number,
        client_case_id,
        contract_type,
        candidate_name,
        phone_primary,
        phone_secondary,
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
        'TEST-CASE-001',
        'residential_address_check',
        'Test Candidate',
        '+91-9876543210',
        '+91-9876543211',
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
    
    RAISE NOTICE 'Test case created successfully with ID: %', test_case_id;
    
    -- Clean up test data
    DELETE FROM public.cases WHERE id = test_case_id;
    DELETE FROM public.locations WHERE id = test_location_id;
    
    RAISE NOTICE 'Test data cleaned up';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating test case: %', SQLERRM;
        
        -- Clean up any partial data
        DELETE FROM public.locations WHERE address_line = 'Test Address for Case Creation';
END $$;

SELECT 'Case creation test completed' as status;
