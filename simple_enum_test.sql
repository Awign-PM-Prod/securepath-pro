-- Simple test to check enum values and table structure
-- Run this first to understand the current state

-- 1. Check pincode_tier enum values
SELECT 'Current pincode_tier enum values:' as test_name;

SELECT 
    t.typname as enum_name,
    e.enumlabel as enum_value,
    e.enumsortorder as sort_order
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'pincode_tier'
ORDER BY e.enumsortorder;

-- 2. Check pincode_tiers table structure
SELECT 'pincode_tiers table structure:' as test_name;

SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'pincode_tiers' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check existing pincode_tiers data
SELECT 'Existing pincode_tiers data:' as test_name;

SELECT DISTINCT tier, COUNT(*) as count
FROM public.pincode_tiers 
GROUP BY tier
ORDER BY tier;

-- 4. Check if we have any users to use as created_by
SELECT 'Available users for created_by:' as test_name;

SELECT id, email, created_at
FROM auth.users 
LIMIT 5;
