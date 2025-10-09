-- Fix assignment_type enum values
-- This script checks and fixes the assignment_type enum

-- First, let's check what enum values currently exist
SELECT 
    'Current assignment_type enum values:' as info,
    unnest(enum_range(NULL::assignment_type)) as enum_values;

-- Check if assignment_type enum exists
SELECT 
    'assignment_type enum exists:' as info,
    EXISTS (
        SELECT 1 FROM pg_type 
        WHERE typname = 'assignment_type'
    ) as enum_exists;

-- If the enum doesn't exist, create it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_type') THEN
        CREATE TYPE assignment_type AS ENUM ('gig_worker', 'vendor', 'direct');
        RAISE NOTICE 'Created assignment_type enum with values: gig_worker, vendor, direct';
    ELSE
        RAISE NOTICE 'assignment_type enum already exists';
    END IF;
END $$;

-- Check what values are currently in the enum
SELECT 
    'Current assignment_type values:' as info,
    unnest(enum_range(NULL::assignment_type)) as enum_values;

-- If the enum exists but doesn't have the right values, we need to add them
DO $$
DECLARE
    enum_values text[];
    missing_values text[] := ARRAY['gig_worker', 'vendor', 'direct'];
    val text;
BEGIN
    -- Get current enum values
    SELECT ARRAY(SELECT unnest(enum_range(NULL::assignment_type))::text) INTO enum_values;
    
    -- Check which values are missing
    FOREACH val IN ARRAY missing_values
    LOOP
        IF NOT (val = ANY(enum_values)) THEN
            EXECUTE format('ALTER TYPE assignment_type ADD VALUE %L', val);
            RAISE NOTICE 'Added value % to assignment_type enum', val;
        ELSE
            RAISE NOTICE 'Value % already exists in assignment_type enum', val;
        END IF;
    END LOOP;
END $$;

-- Verify the final enum values
SELECT 
    'Final assignment_type enum values:' as info,
    unnest(enum_range(NULL::assignment_type)) as enum_values;

-- Check if cases table has assignment_type column
SELECT 
    'Cases table columns:' as info,
    column_name,
    data_type,
    udt_name
FROM information_schema.columns 
WHERE table_name = 'cases' 
AND table_schema = 'public'
AND column_name LIKE '%assign%'
ORDER BY column_name;

-- If cases table doesn't have assignment_type column, we might need to add it
-- But first let's check what columns it actually has
SELECT 
    'All cases table columns:' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'cases' 
AND table_schema = 'public'
ORDER BY ordinal_position;
