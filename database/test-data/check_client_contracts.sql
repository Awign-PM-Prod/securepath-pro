-- Check if client contracts exist for payout calculation
-- This script helps verify that the necessary data exists for CSV import payout calculation

-- Check clients
SELECT 'Clients' as table_name, COUNT(*) as count FROM public.clients WHERE is_active = true;

-- Check client contracts
SELECT 'Client Contracts' as table_name, COUNT(*) as count FROM public.client_contracts WHERE is_active = true;

-- Check contract type config
SELECT 'Contract Type Config' as table_name, COUNT(*) as count FROM public.contract_type_config WHERE is_active = true;

-- Check pincode tiers
SELECT 'Pincode Tiers' as table_name, COUNT(*) as count FROM public.pincode_tiers;

-- Show sample client contracts with payout information
SELECT 
    cc.id,
    c.name as client_name,
    cc.contract_type,
    cc.tier1_base_payout_inr,
    cc.tier2_base_payout_inr,
    cc.tier3_base_payout_inr,
    cc.working_hours_start,
    cc.working_hours_end
FROM public.client_contracts cc
JOIN public.clients c ON cc.client_id = c.id
WHERE cc.is_active = true
LIMIT 5;

-- Show sample pincode tiers
SELECT 
    pincode,
    tier,
    city,
    state
FROM public.pincode_tiers
LIMIT 5;

-- Test the get_case_defaults function with sample data
SELECT 
    'Testing get_case_defaults function' as test_name,
    *
FROM public.get_case_defaults(
    (SELECT id FROM public.clients WHERE is_active = true LIMIT 1),
    'residential_address_check',
    '560001'
);
