-- Check required fields in cases table
-- This script identifies what fields are required for case creation

-- Check all columns in cases table and their constraints
SELECT 
    'Cases table structure:' as info,
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'cases' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check NOT NULL constraints specifically
SELECT 
    'Required fields (NOT NULL):' as info,
    column_name,
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_name = 'cases' 
AND table_schema = 'public'
AND is_nullable = 'NO'
ORDER BY column_name;

-- Check if title column exists and is required
SELECT 
    'Title column info:' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'cases' 
AND table_schema = 'public'
AND column_name = 'title';

-- Check if description column exists and is required
SELECT 
    'Description column info:' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'cases' 
AND table_schema = 'public'
AND column_name = 'description';

-- Check if priority column exists and is required
SELECT 
    'Priority column info:' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'cases' 
AND table_schema = 'public'
AND column_name = 'priority';
