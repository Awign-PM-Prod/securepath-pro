-- Test script for the redesigned client contract system
-- This script tests the new tier-based pricing, working hours, bonuses, and penalties

-- 1. Test creating a client contract with new structure
INSERT INTO public.client_contracts (
    client_id,
    contract_number,
    contract_name,
    contract_type,
    start_date,
    end_date,
    -- Tier 1 pricing
    tier1_tat_days,
    tier1_revenue_inr,
    tier1_base_payout_inr,
    -- Tier 2 pricing
    tier2_tat_days,
    tier2_revenue_inr,
    tier2_base_payout_inr,
    -- Tier 3 pricing
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
    (SELECT id FROM public.clients LIMIT 1), -- Use first available client
    'CON-2024-001',
    'Test Contract - Tier Based Pricing',
    'standard',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '1 year',
    -- Tier 1 (Metro)
    1, -- 1 day TAT
    500.00, -- ₹500 revenue
    400.00, -- ₹400 base payout
    -- Tier 2 (City)
    2, -- 2 days TAT
    400.00, -- ₹400 revenue
    300.00, -- ₹300 base payout
    -- Tier 3 (Rural)
    3, -- 3 days TAT
    300.00, -- ₹300 revenue
    200.00, -- ₹200 base payout
    -- Working hours
    '09:00'::time,
    '19:00'::time,
    -- Bonuses
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
            "tiers": ["tier1"],
            "time_after_acceptance": 4,
            "amount": 100
        }
    ]'::jsonb,
    -- Penalties
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
    (SELECT id FROM auth.users LIMIT 1) -- Use first available user
);

-- 2. Test the get_client_contract_pricing function
SELECT 'Testing get_client_contract_pricing function:' as test_name;

SELECT * FROM get_client_contract_pricing(
    (SELECT id FROM public.clients LIMIT 1),
    'tier1'::pincode_tier
);

SELECT * FROM get_client_contract_pricing(
    (SELECT id FROM public.clients LIMIT 1),
    'tier2'::pincode_tier
);

SELECT * FROM get_client_contract_pricing(
    (SELECT id FROM public.clients LIMIT 1),
    'tier3'::pincode_tier
);

-- 3. Test the get_case_defaults function
SELECT 'Testing get_case_defaults function:' as test_name;

-- Test with a pincode that exists in pincode_tiers
SELECT * FROM get_case_defaults(
    (SELECT id FROM public.clients LIMIT 1),
    '560001', -- Bangalore pincode
    24 -- 24 hours TAT
);

-- Test with a pincode that doesn't exist (should default to tier3)
SELECT * FROM get_case_defaults(
    (SELECT id FROM public.clients LIMIT 1),
    '999999', -- Non-existent pincode
    NULL -- No TAT specified
);

-- 4. Test bonus calculation function
SELECT 'Testing calculate_bonus_amount function:' as test_name;

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
    'tier1'::pincode_tier,
    5.5, -- Completed in 5.5 hours
    '09:00'::time,
    '19:00'::time
) as bonus_amount;

-- Test penalty calculation function
SELECT 'Testing calculate_penalty_amount function:' as test_name;

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
    'tier1'::pincode_tier,
    25.0, -- Completed in 25 hours (exceeds 1 day TAT)
    1, -- 1 day TAT
    '09:00'::time,
    '19:00'::time
) as penalty_amount;

-- 5. Test the new client contract management UI data structure
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
WHERE cc.contract_number = 'CON-2024-001';

-- 6. Test case creation with new structure
SELECT 'Testing case creation with new structure:' as test_name;

-- First, create a test location
INSERT INTO public.locations (
    address_line,
    city,
    state,
    country,
    pincode,
    pincode_tier
) VALUES (
    'Test Address 123',
    'Test City',
    'Test State',
    'India',
    '560001',
    'tier1'
) ON CONFLICT (address_line, city, state, pincode) DO NOTHING;

-- Test case creation (this would be called from the application)
SELECT 
    'Case creation test - would create case with:' as test_name,
    defaults.city,
    defaults.state,
    defaults.tier,
    defaults.tat_hours,
    defaults.base_rate_inr,
    defaults.total_rate_inr,
    defaults.working_hours_start,
    defaults.working_hours_end,
    jsonb_array_length(defaults.bonuses) as bonus_count,
    jsonb_array_length(defaults.penalties) as penalty_count
FROM get_case_defaults(
    (SELECT id FROM public.clients LIMIT 1),
    '560001',
    24
) as defaults;

-- 7. Cleanup test data
SELECT 'Cleaning up test data...' as test_name;

DELETE FROM public.client_contracts WHERE contract_number = 'CON-2024-001';
DELETE FROM public.locations WHERE address_line = 'Test Address 123' AND city = 'Test City';

SELECT 'Test completed successfully!' as result;
