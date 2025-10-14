-- Fix pincode_tier enum values to match the new client contract system
-- This migration ensures the enum values are consistent
-- Split into separate transactions to avoid the enum value commit issue

-- Step 1: Add new enum values (this will be committed first)
DO $$
DECLARE
    enum_values text[];
    value text;
BEGIN
    -- Get all current enum values
    SELECT ARRAY_AGG(e.enumlabel ORDER BY e.enumsortorder) INTO enum_values
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
    WHERE t.typname = 'pincode_tier';
    
    RAISE NOTICE 'Current pincode_tier enum values: %', array_to_string(enum_values, ', ');
    
    -- If we don't have tier1, tier2, tier3, add them
    IF NOT ('tier1' = ANY(enum_values)) THEN
        ALTER TYPE pincode_tier ADD VALUE 'tier1';
        RAISE NOTICE 'Added tier1 to pincode_tier enum';
    END IF;
    
    IF NOT ('tier2' = ANY(enum_values)) THEN
        ALTER TYPE pincode_tier ADD VALUE 'tier2';
        RAISE NOTICE 'Added tier2 to pincode_tier enum';
    END IF;
    
    IF NOT ('tier3' = ANY(enum_values)) THEN
        ALTER TYPE pincode_tier ADD VALUE 'tier3';
        RAISE NOTICE 'Added tier3 to pincode_tier enum';
    END IF;
END $$;
