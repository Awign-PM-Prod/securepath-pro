-- Setup test data for payout calculation
-- This script creates the necessary data for CSV import payout calculation

-- First, ensure we have a client
INSERT INTO public.clients (
    name, 
    email, 
    is_active, 
    created_by
) VALUES (
    'Test Client', 
    'test@client.com', 
    true, 
    (SELECT id FROM auth.users LIMIT 1)
) ON CONFLICT (email) DO NOTHING;

-- Get the client ID
DO $$
DECLARE
    client_id_var uuid;
BEGIN
    SELECT id INTO client_id_var FROM public.clients WHERE email = 'test@client.com' LIMIT 1;
    
    -- Insert pincode tiers if they don't exist
    INSERT INTO public.pincode_tiers (pincode, tier, city, state, region, is_active, created_by) VALUES
    ('560001', 'tier1', 'Bangalore', 'Karnataka', 'South', true, (SELECT id FROM auth.users LIMIT 1)),
    ('400001', 'tier1', 'Mumbai', 'Maharashtra', 'West', true, (SELECT id FROM auth.users LIMIT 1)),
    ('110001', 'tier1', 'Delhi', 'Delhi', 'North', true, (SELECT id FROM auth.users LIMIT 1)),
    ('560100', 'tier2', 'Bangalore', 'Karnataka', 'South', true, (SELECT id FROM auth.users LIMIT 1)),
    ('400100', 'tier2', 'Mumbai', 'Maharashtra', 'West', true, (SELECT id FROM auth.users LIMIT 1)),
    ('110100', 'tier2', 'Delhi', 'Delhi', 'North', true, (SELECT id FROM auth.users LIMIT 1)),
    ('560200', 'tier3', 'Bangalore', 'Karnataka', 'South', true, (SELECT id FROM auth.users LIMIT 1)),
    ('400200', 'tier3', 'Mumbai', 'Maharashtra', 'West', true, (SELECT id FROM auth.users LIMIT 1)),
    ('110200', 'tier3', 'Delhi', 'Delhi', 'North', true, (SELECT id FROM auth.users LIMIT 1))
    ON CONFLICT (pincode) DO NOTHING;

    -- Insert contract type config if it doesn't exist
    INSERT INTO public.contract_type_config (type_key, display_name, description, is_active, sort_order) VALUES
    ('residential_address_check', 'Residential Address Check', 'Verification of residential addresses for individuals', true, 1),
    ('business_address_check', 'Business Address Check', 'Verification of business addresses for companies', true, 2)
    ON CONFLICT (type_key) DO NOTHING;

    -- Insert client contracts if they don't exist
    INSERT INTO public.client_contracts (
        client_id,
        contract_type,
        tier1_base_payout_inr,
        tier2_base_payout_inr,
        tier3_base_payout_inr,
        tier1_tat_days,
        tier2_tat_days,
        tier3_tat_days,
        working_hours_start,
        working_hours_end,
        is_active,
        created_by
    ) VALUES
    (
        client_id_var,
        'residential_address_check',
        500.00,
        400.00,
        300.00,
        1,
        2,
        3,
        '09:00',
        '19:00',
        true,
        (SELECT id FROM auth.users LIMIT 1)
    ),
    (
        client_id_var,
        'business_address_check',
        600.00,
        500.00,
        400.00,
        1,
        2,
        3,
        '09:00',
        '19:00',
        true,
        (SELECT id FROM auth.users LIMIT 1)
    )
    ON CONFLICT (client_id, contract_type) DO NOTHING;

    RAISE NOTICE 'Test data setup completed for client: %', client_id_var;
END $$;

-- Verify the setup
SELECT 'Setup Complete' as status;
SELECT 'Clients' as table_name, COUNT(*) as count FROM public.clients WHERE is_active = true;
SELECT 'Pincode Tiers' as table_name, COUNT(*) as count FROM public.pincode_tiers;
SELECT 'Client Contracts' as table_name, COUNT(*) as count FROM public.client_contracts WHERE is_active = true;
SELECT 'Contract Type Config' as table_name, COUNT(*) as count FROM public.contract_type_config WHERE is_active = true;
