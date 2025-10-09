-- Setup basic data for the system to work
-- Run this AFTER running the migrations

-- Insert basic pincode tier data if table exists but is empty
INSERT INTO public.pincode_tiers (pincode, tier, city, state, region, is_active, created_by)
SELECT 
    '302018' as pincode,
    'tier1'::pincode_tier as tier,
    'Jaipur' as city,
    'Rajasthan' as state,
    'North' as region,
    true as is_active,
    (SELECT id FROM auth.users LIMIT 1) as created_by
WHERE NOT EXISTS (SELECT 1 FROM public.pincode_tiers WHERE pincode = '302018');

-- Insert more sample pincode data
INSERT INTO public.pincode_tiers (pincode, tier, city, state, region, is_active, created_by)
SELECT 
    '110001' as pincode,
    'tier1'::pincode_tier as tier,
    'New Delhi' as city,
    'Delhi' as state,
    'North' as region,
    true as is_active,
    (SELECT id FROM auth.users LIMIT 1) as created_by
WHERE NOT EXISTS (SELECT 1 FROM public.pincode_tiers WHERE pincode = '110001');

INSERT INTO public.pincode_tiers (pincode, tier, city, state, region, is_active, created_by)
SELECT 
    '400001' as pincode,
    'tier1'::pincode_tier as tier,
    'Mumbai' as city,
    'Maharashtra' as state,
    'West' as region,
    true as is_active,
    (SELECT id FROM auth.users LIMIT 1) as created_by
WHERE NOT EXISTS (SELECT 1 FROM public.pincode_tiers WHERE pincode = '400001');

INSERT INTO public.pincode_tiers (pincode, tier, city, state, region, is_active, created_by)
SELECT 
    '560001' as pincode,
    'tier1'::pincode_tier as tier,
    'Bangalore' as city,
    'Karnataka' as state,
    'South' as region,
    true as is_active,
    (SELECT id FROM auth.users LIMIT 1) as created_by
WHERE NOT EXISTS (SELECT 1 FROM public.pincode_tiers WHERE pincode = '560001');

-- Insert sample client data if needed
INSERT INTO public.clients (name, email, phone, contact_person, address, city, state, pincode, country, is_active, created_by)
SELECT 
    'Test Client' as name,
    'test@client.com' as email,
    '+91-9876543210' as phone,
    'John Doe' as contact_person,
    '123 Test Street' as address,
    'Mumbai' as city,
    'Maharashtra' as state,
    '400001' as pincode,
    'India' as country,
    true as is_active,
    (SELECT id FROM auth.users LIMIT 1) as created_by
WHERE NOT EXISTS (SELECT 1 FROM public.clients WHERE email = 'test@client.com');

-- Insert sample client contract if needed
INSERT INTO public.client_contracts (
    client_id, 
    contract_type, 
    tier1_tat_days, 
    tier1_revenue_inr, 
    tier1_base_payout_inr,
    tier2_tat_days, 
    tier2_revenue_inr, 
    tier2_base_payout_inr,
    tier3_tat_days, 
    tier3_revenue_inr, 
    tier3_base_payout_inr,
    working_hours_start,
    working_hours_end,
    bonuses,
    penalties,
    is_active, 
    created_by
)
SELECT 
    (SELECT id FROM public.clients WHERE email = 'test@client.com' LIMIT 1) as client_id,
    'residential_address_check' as contract_type,
    1 as tier1_tat_days,
    1000.00 as tier1_revenue_inr,
    500.00 as tier1_base_payout_inr,
    2 as tier2_tat_days,
    800.00 as tier2_revenue_inr,
    400.00 as tier2_base_payout_inr,
    3 as tier3_tat_days,
    600.00 as tier3_revenue_inr,
    300.00 as tier3_base_payout_inr,
    '09:00'::time as working_hours_start,
    '19:00'::time as working_hours_end,
    '[]'::jsonb as bonuses,
    '[]'::jsonb as penalties,
    true as is_active,
    (SELECT id FROM auth.users LIMIT 1) as created_by
WHERE NOT EXISTS (
    SELECT 1 FROM public.client_contracts 
    WHERE client_id = (SELECT id FROM public.clients WHERE email = 'test@client.com' LIMIT 1)
    AND contract_type = 'residential_address_check'
);

-- Check the results
SELECT 'Setup completed' as status;
SELECT COUNT(*) as pincode_tiers_count FROM public.pincode_tiers;
SELECT COUNT(*) as clients_count FROM public.clients;
SELECT COUNT(*) as client_contracts_count FROM public.client_contracts;
