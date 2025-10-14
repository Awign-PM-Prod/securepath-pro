-- Fix assignee_type enum to match the expected values
-- Based on DATABASE_SCHEMA_DESIGN.md and types.ts, assignee_type should be "gig" | "vendor"

-- First, check if assignee_type enum exists and what values it has
SELECT 
    'Current assignee_type enum values:' as info,
    unnest(enum_range(NULL::assignee_type)) as enum_values;

-- Check if the enum exists
SELECT 
    'assignee_type enum exists:' as info,
    EXISTS (
        SELECT 1 FROM pg_type 
        WHERE typname = 'assignee_type'
    ) as enum_exists;

-- Create or update the assignee_type enum
DO $$
BEGIN
    -- Check if enum exists
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignee_type') THEN
        -- Create the enum with correct values
        CREATE TYPE assignee_type AS ENUM ('gig', 'vendor');
        RAISE NOTICE 'Created assignee_type enum with values: gig, vendor';
    ELSE
        -- Check if it has the right values
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'assignee_type') AND enumlabel = 'gig') THEN
            ALTER TYPE assignee_type ADD VALUE 'gig';
            RAISE NOTICE 'Added gig to assignee_type enum';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'assignee_type') AND enumlabel = 'vendor') THEN
            ALTER TYPE assignee_type ADD VALUE 'vendor';
            RAISE NOTICE 'Added vendor to assignee_type enum';
        END IF;
        
        RAISE NOTICE 'assignee_type enum already exists, verified values';
    END IF;
END $$;

-- Verify the enum values
SELECT 
    'Final assignee_type enum values:' as info,
    unnest(enum_range(NULL::assignee_type)) as enum_values;

-- Check if cases table has current_assignee_type column and what type it uses
SELECT 
    'Cases table assignee columns:' as info,
    column_name,
    data_type,
    udt_name,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'cases' 
AND table_schema = 'public'
AND column_name LIKE '%assign%'
ORDER BY column_name;

-- Update any existing data that might have wrong enum values
-- First check if there's any data with wrong values
DO $$
DECLARE
    wrong_count integer;
BEGIN
    -- Check for any records with 'gig_worker' in current_assignee_type
    SELECT COUNT(*) INTO wrong_count
    FROM public.cases 
    WHERE current_assignee_type::text = 'gig_worker';
    
    IF wrong_count > 0 THEN
        RAISE NOTICE 'Found % records with gig_worker, updating to gig', wrong_count;
        UPDATE public.cases 
        SET current_assignee_type = 'gig'::assignee_type
        WHERE current_assignee_type::text = 'gig_worker';
    ELSE
        RAISE NOTICE 'No records found with gig_worker value';
    END IF;
END $$;

-- Check if there are any triggers or functions that might be setting wrong values
SELECT 
    'Functions that might set assignee_type:' as info,
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public'
AND routine_definition ILIKE '%gig_worker%'
AND routine_definition ILIKE '%assignee_type%';

-- Final verification
SELECT 
    'Verification - current_assignee_type values in cases:' as info,
    current_assignee_type,
    COUNT(*) as count
FROM public.cases 
WHERE current_assignee_type IS NOT NULL
GROUP BY current_assignee_type
ORDER BY current_assignee_type;
