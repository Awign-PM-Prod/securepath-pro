-- Check database status and required tables
-- Run this in your Supabase SQL Editor to diagnose the issue

-- Check if pincode_tiers table exists and has data
SELECT 
    'pincode_tiers' as table_name,
    COUNT(*) as row_count,
    CASE WHEN COUNT(*) > 0 THEN 'HAS_DATA' ELSE 'EMPTY' END as status
FROM information_schema.tables 
WHERE table_name = 'pincode_tiers' AND table_schema = 'public';

-- Check if cases table has the new columns
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'cases' 
AND table_schema = 'public'
AND column_name IN ('contract_type', 'candidate_name', 'phone_primary', 'vendor_tat_start_date', 'bonus_inr', 'penalty_inr', 'total_payout_inr')
ORDER BY column_name;

-- Check if client_contracts table has the new structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'client_contracts' 
AND table_schema = 'public'
AND column_name IN ('tier1_tat_days', 'tier1_base_payout_inr', 'working_hours_start', 'bonuses', 'penalties')
ORDER BY column_name;

-- Check if contract_type_config table exists
SELECT 
    'contract_type_config' as table_name,
    COUNT(*) as row_count,
    CASE WHEN COUNT(*) > 0 THEN 'HAS_DATA' ELSE 'EMPTY' END as status
FROM information_schema.tables 
WHERE table_name = 'contract_type_config' AND table_schema = 'public';

-- Check pincode_tier enum values
SELECT unnest(enum_range(NULL::pincode_tier)) as enum_values;

-- Check if there are any pincode_tiers records
SELECT COUNT(*) as pincode_tiers_count FROM public.pincode_tiers;

-- Check if there are any client_contracts records
SELECT COUNT(*) as client_contracts_count FROM public.client_contracts;
