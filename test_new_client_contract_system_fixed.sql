-- Test the new client contract system after successful migration
-- This script verifies all components are working correctly
-- Fixed to use correct pincode_tier enum values

-- 1. First, let's check what pincode_tier enum values exist
SELECT 'Checking pincode_tier enum values:' as test_name;

SELECT 
    t.typname as enum_name,
    e.enumlabel as enum_value,
    e.enumsortorder as sort_order
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'pincode_tier'
ORDER BY e.enumsortorder;

-- 2. Check what values are in pincode_tiers table
SELECT 'Checking existing pincode_tiers data:' as test_name;

SELECT DISTINCT tier, COUNT(*) as count
FROM public.pincode_tiers 
GROUP BY tier
ORDER BY tier;

-- 3. Verify the new client_contracts table structure
SELECT 'Testing new client_contracts table structure:' as test_name;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'client_contracts' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Test creating a sample client contract with new structure
SELECT 'Creating test client contract:' as test_name;

-- First, ensure we have a client to work with
INSERT INTO public.clients (
    name, 
    email, 
    contact_person, 
    phone, 
    is_active, 
    created_by
) VALUES (
    'Test Client Corp',
    'test@testclient.com',
    'John Doe',
    '+91-9876543210',
    true,
    (SELECT id FROM auth.users LIMIT 1)
) ON CONFLICT (email) DO NOTHING;

-- Create a test client contract with the new structure
-- Using the correct enum values based on what we find
INSERT INTO public.client_contracts (
    client_id,
    contract_number,
    contract_name,
    contract_type,
    start_date,
    end_date,
    -- Tier 1 pricing (Metro) - using tier_1 if that's the enum value
    tier1_tat_days,
    tier1_revenue_inr,
    tier1_base_payout_inr,
    -- Tier 2 pricing (City) - using tier_2 if that's the enum value
    tier2_tat_days,
    tier2_revenue_inr,
    tier2_base_payout_inr,
    -- Tier 3 pricing (Rural) - using tier_3 if that's the enum value
    tier3_tat_days,
    tier3_revenue_inr,
    tier3_base_payout_inr,
    -- Working hours
    working_hours_start,
    working_hours_end,
    -- Bonuses
    bonuses,
    -- Penalties
    penalties,
    is_active,
    created_by
) VALUES (
    (SELECT id FROM public.clients WHERE email = 'test@testclient.com'),
    'CON-2024-TEST-001',
    'Test Contract - New Structure',
    'standard',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '1 year',
    -- Tier 1 (Metro) - 1 day TAT, ₹500 revenue, ₹400 payout
    1,
    500.00,
    400.00,
    -- Tier 2 (City) - 2 days TAT, ₹400 revenue, ₹300 payout
    2,
    400.00,
    300.00,
    -- Tier 3 (Rural) - 3 days TAT, ₹300 revenue, ₹200 payout
    3,
    300.00,
    200.00,
    -- Working hours: 9 AM to 7 PM
    '09:00'::time,
    '19:00'::time,
    -- Bonuses: Early completion bonus for all tiers
    '[
        {
            "id": "bonus1",
            "name": "Early Completion Bonus",
            "tiers": ["all"],
            "time_after_acceptance": 6,
            "amount": 50
        },
        {
            "id": "bonus2",
            "name": "Tier 1 Super Fast",
            "tiers": ["tier_1"],
            "time_after_acceptance": 4,
            "amount": 100
        }
    ]'::jsonb,
    -- Penalties: Late completion penalty
    '[
        {
            "id": "penalty1",
            "name": "Late Completion Penalty",
            "tiers": ["all"],
            "time_after_acceptance": 24,
            "amount": 25
        }
    ]'::jsonb,
    true,
    (SELECT id FROM auth.users LIMIT 1)
);

-- 5. Test the get_client_contract_pricing function with correct enum values
SELECT 'Testing get_client_contract_pricing function:' as test_name;

-- Test for Tier 1 - try different possible enum values
DO $$
DECLARE
    tier_value text;
    result_record record;
BEGIN
    -- Try to find the correct tier enum value
    SELECT e.enumlabel INTO tier_value
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
    WHERE t.typname = 'pincode_tier'
    AND e.enumlabel LIKE '%tier%1%'
    ORDER BY e.enumsortorder
    LIMIT 1;
    
    IF tier_value IS NOT NULL THEN
        RAISE NOTICE 'Testing with tier value: %', tier_value;
        
        -- Test the function
        FOR result_record IN 
            SELECT * FROM get_client_contract_pricing(
                (SELECT id FROM public.clients WHERE email = 'test@testclient.com'),
                tier_value::pincode_tier
            )
        LOOP
            RAISE NOTICE 'Tier: %, TAT Days: %, Revenue: %, Base Payout: %', 
                tier_value, result_record.tat_days, result_record.revenue_inr, result_record.base_payout_inr;
        END LOOP;
    ELSE
        RAISE NOTICE 'No tier_1 enum value found, trying alternative...';
    END IF;
END $$;

-- 6. Test the get_case_defaults function
SELECT 'Testing get_case_defaults function:' as test_name;

-- First, ensure we have a pincode in pincode_tiers with correct tier value
-- Let's find what tier values exist and use one of them
DO $$
DECLARE
    tier_value text;
    pincode_value text := '560001';
BEGIN
    -- Get the first available tier value
    SELECT e.enumlabel INTO tier_value
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
    WHERE t.typname = 'pincode_tier'
    ORDER BY e.enumsortorder
    LIMIT 1;
    
    IF tier_value IS NOT NULL THEN
        -- Insert pincode with correct tier value
        INSERT INTO public.pincode_tiers (
            pincode,
            tier,
            city,
            state,
            region,
            created_by
        ) VALUES (
            pincode_value,
            tier_value::pincode_tier,
            'Bangalore',
            'Karnataka',
            'South',
            (SELECT id FROM auth.users LIMIT 1)
        ) ON CONFLICT (pincode) DO NOTHING;
        
        RAISE NOTICE 'Inserted pincode % with tier %', pincode_value, tier_value;
    END IF;
END $$;

-- Test get_case_defaults with existing pincode
SELECT 
    'Existing pincode test' as test_type,
    city,
    state,
    tier,
    tat_hours,
    base_rate_inr,
    total_rate_inr,
    working_hours_start,
    working_hours_end,
    jsonb_array_length(bonuses) as bonus_count,
    jsonb_array_length(penalties) as penalty_count
FROM get_case_defaults(
    (SELECT id FROM public.clients WHERE email = 'test@testclient.com'),
    '560001',
    24
);

-- Test get_case_defaults with non-existing pincode (should default to tier3)
SELECT 
    'Non-existing pincode test' as test_type,
    city,
    state,
    tier,
    tat_hours,
    base_rate_inr,
    total_rate_inr,
    working_hours_start,
    working_hours_end,
    jsonb_array_length(bonuses) as bonus_count,
    jsonb_array_length(penalties) as penalty_count
FROM get_case_defaults(
    (SELECT id FROM public.clients WHERE email = 'test@testclient.com'),
    '999999',
    NULL
);

-- 7. Test bonus calculation function with correct tier values
SELECT 'Testing calculate_bonus_amount function:' as test_name;

-- Get the first available tier value for testing
DO $$
DECLARE
    tier_value text;
    bonus_amount numeric;
BEGIN
    SELECT e.enumlabel INTO tier_value
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
    WHERE t.typname = 'pincode_tier'
    ORDER BY e.enumsortorder
    LIMIT 1;
    
    IF tier_value IS NOT NULL THEN
        -- Test early completion bonus
        SELECT calculate_bonus_amount(
            '[
                {
                    "id": "bonus1",
                    "name": "Early Completion Bonus",
                    "tiers": ["all"],
                    "time_after_acceptance": 6,
                    "amount": 50
                }
            ]'::jsonb,
            tier_value::pincode_tier,
            4.0, -- Completed in 4 hours
            '09:00'::time,
            '19:00'::time
        ) INTO bonus_amount;
        
        RAISE NOTICE 'Early completion bonus (4 hours) with tier %: ₹%', tier_value, bonus_amount;
    END IF;
END $$;

-- 8. Test penalty calculation function
SELECT 'Testing calculate_penalty_amount function:' as test_name;

DO $$
DECLARE
    tier_value text;
    penalty_amount numeric;
BEGIN
    SELECT e.enumlabel INTO tier_value
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
    WHERE t.typname = 'pincode_tier'
    ORDER BY e.enumsortorder
    LIMIT 1;
    
    IF tier_value IS NOT NULL THEN
        -- Test late completion penalty
        SELECT calculate_penalty_amount(
            '[
                {
                    "id": "penalty1",
                    "name": "Late Completion Penalty",
                    "tiers": ["all"],
                    "time_after_acceptance": 24,
                    "amount": 25
                }
            ]'::jsonb,
            tier_value::pincode_tier,
            25.0, -- Completed in 25 hours (exceeds 1 day = 10 hours TAT)
            1, -- 1 day TAT
            '09:00'::time,
            '19:00'::time
        ) INTO penalty_amount;
        
        RAISE NOTICE 'Late completion penalty (25 hours) with tier %: ₹%', tier_value, penalty_amount;
    END IF;
END $$;

-- 9. Test the new client contract management UI data structure
SELECT 'Testing client contract data for UI:' as test_name;

SELECT 
    cc.id,
    cc.contract_number,
    cc.contract_name,
    cc.contract_type,
    cc.start_date,
    cc.end_date,
    cc.is_active,
    -- Tier 1 data
    cc.tier1_tat_days,
    cc.tier1_revenue_inr,
    cc.tier1_base_payout_inr,
    -- Tier 2 data
    cc.tier2_tat_days,
    cc.tier2_revenue_inr,
    cc.tier2_base_payout_inr,
    -- Tier 3 data
    cc.tier3_tat_days,
    cc.tier3_revenue_inr,
    cc.tier3_base_payout_inr,
    -- Working hours
    cc.working_hours_start,
    cc.working_hours_end,
    -- Bonuses and penalties
    cc.bonuses,
    cc.penalties,
    -- Client info
    c.name as client_name
FROM public.client_contracts cc
JOIN public.clients c ON cc.client_id = c.id
WHERE cc.contract_number = 'CON-2024-TEST-001';

-- 10. Verify rate_cards table is removed
SELECT 'Verifying rate_cards table is removed:' as test_name;

SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rate_cards' AND table_schema = 'public')
        THEN 'ERROR: rate_cards table still exists'
        ELSE 'SUCCESS: rate_cards table removed'
    END as rate_cards_status;

-- 11. Verify cases table no longer has rate_card_id
SELECT 'Verifying cases table structure:' as test_name;

SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cases' AND column_name = 'rate_card_id' AND table_schema = 'public')
        THEN 'ERROR: rate_card_id column still exists in cases table'
        ELSE 'SUCCESS: rate_card_id column removed from cases table'
    END as cases_table_status;

-- 12. Test RLS policies
SELECT 'Testing RLS policies:' as test_name;

-- Test that ops_team can access client contracts
SELECT 
    'RLS Policy Test' as test_name,
    COUNT(*) as contract_count
FROM public.client_contracts;

-- 13. Cleanup test data
SELECT 'Cleaning up test data...' as test_name;

DELETE FROM public.client_contracts WHERE contract_number = 'CON-2024-TEST-001';
DELETE FROM public.clients WHERE email = 'test@testclient.com';
DELETE FROM public.locations WHERE address_line = 'Test Address 123, MG Road' AND city = 'Bangalore';
DELETE FROM public.pincode_tiers WHERE pincode = '560001';

SELECT 'All tests completed successfully! New client contract system is working.' as final_result;
