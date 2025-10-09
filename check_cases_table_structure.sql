-- Check cases table structure and identify the source of assignment_type error
-- This script helps diagnose the assignment_type enum error

-- Check all columns in cases table
SELECT 
    'Cases table structure:' as info,
    column_name,
    data_type,
    udt_name,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'cases' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if there are any triggers on cases table that might be setting assignment_type
SELECT 
    'Triggers on cases table:' as info,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'cases'
AND event_object_schema = 'public';

-- Check if there are any functions that might be called by triggers
SELECT 
    'Functions that might affect cases:' as info,
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public'
AND (
    routine_definition ILIKE '%assignment_type%' 
    OR routine_definition ILIKE '%cases%'
);

-- Check what enum types exist in the database
SELECT 
    'Existing enum types:' as info,
    t.typname as enum_name,
    e.enumlabel as enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid 
WHERE t.typtype = 'e'
ORDER BY t.typname, e.enumsortorder;

-- Check if there's a current_assignee_type column that might be using assignment_type enum
SELECT 
    'Columns that might use assignment_type:' as info,
    column_name,
    data_type,
    udt_name
FROM information_schema.columns 
WHERE table_name = 'cases' 
AND table_schema = 'public'
AND (
    column_name ILIKE '%assign%' 
    OR column_name ILIKE '%type%'
    OR udt_name ILIKE '%assign%'
);

-- Check the actual data in cases table to see what's causing the error
SELECT 
    'Sample cases data:' as info,
    id,
    case_number,
    status,
    current_assignee_type,
    current_assignee_id
FROM public.cases 
LIMIT 5;
