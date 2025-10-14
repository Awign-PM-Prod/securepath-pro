-- Test case creation setup
-- Run this to verify everything is working

-- 1. Check if we have a test client
SELECT 
    id, 
    name, 
    email 
FROM public.clients 
WHERE email = 'test@client.com' 
LIMIT 1;

-- 2. Check if we have a test client contract
SELECT 
    cc.id,
    cc.contract_type,
    cc.tier1_tat_days,
    cc.tier1_revenue_inr,
    cc.tier1_base_payout_inr,
    c.name as client_name
FROM public.client_contracts cc
JOIN public.clients c ON cc.client_id = c.id
WHERE c.email = 'test@client.com'
LIMIT 1;

-- 3. Check if we have pincode tier data
SELECT 
    pincode,
    tier,
    city,
    state
FROM public.pincode_tiers 
WHERE is_active = true
LIMIT 5;

-- 4. Test the get_case_defaults function
SELECT * FROM public.get_case_defaults(
    (SELECT id FROM public.clients WHERE email = 'test@client.com' LIMIT 1),
    'residential_address_check',
    1
);

-- 5. Check if we can create a location
INSERT INTO public.locations (
    address_line,
    city,
    state,
    pincode,
    country,
    pincode_tier
) VALUES (
    'Test Address',
    'Test City',
    'Test State',
    '123456',
    'India',
    'tier3'
) ON CONFLICT DO NOTHING;

-- 6. Check the created location
SELECT * FROM public.locations WHERE pincode = '123456';

-- Clean up test data
DELETE FROM public.locations WHERE pincode = '123456';