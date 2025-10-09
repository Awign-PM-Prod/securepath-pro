-- Check for triggers and functions that might be setting current_assignee_type
-- This script helps identify what's causing the assignment_type enum error

-- Check all triggers on cases table
SELECT 
    'Triggers on cases table:' as info,
    trigger_name,
    event_manipulation,
    action_timing,
    action_orientation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'cases'
AND event_object_schema = 'public'
ORDER BY trigger_name;

-- Check for functions that might be called by triggers
SELECT 
    'Functions that might affect cases:' as info,
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public'
AND (
    routine_definition ILIKE '%current_assignee_type%' 
    OR routine_definition ILIKE '%assignee_type%'
    OR routine_definition ILIKE '%gig_worker%'
    OR routine_definition ILIKE '%cases%'
)
ORDER BY routine_name;

-- Check if there are any default values set on the current_assignee_type column
SELECT 
    'Column defaults for assignee columns:' as info,
    column_name,
    column_default,
    data_type,
    udt_name
FROM information_schema.columns 
WHERE table_name = 'cases' 
AND table_schema = 'public'
AND (
    column_name ILIKE '%assign%' 
    OR column_name ILIKE '%type%'
)
ORDER BY column_name;

-- Check if there are any constraints that might be causing issues
SELECT 
    'Constraints on cases table:' as info,
    constraint_name,
    constraint_type,
    check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'cases' 
AND tc.table_schema = 'public'
ORDER BY tc.constraint_name;

-- Check if there are any views that might be affecting case creation
SELECT 
    'Views that reference cases table:' as info,
    table_name,
    view_definition
FROM information_schema.views 
WHERE table_schema = 'public'
AND view_definition ILIKE '%cases%'
ORDER BY table_name;
