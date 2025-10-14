-- Fix pincode_tier enum values to match the new client contract system
-- This migration ensures the enum values are consistent

-- First, let's check what enum values currently exist
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

-- Update any existing pincode_tiers data to use the new enum values
-- This is a mapping from old values to new values
DO $$
DECLARE
    old_value text;
    new_value text;
BEGIN
    -- Map common old values to new values
    -- You can add more mappings here if needed
    
    -- If tier_1 exists, map it to tier1
    IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'tier_1' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pincode_tier')) THEN
        UPDATE public.pincode_tiers SET tier = 'tier1'::pincode_tier WHERE tier = 'tier_1'::pincode_tier;
        RAISE NOTICE 'Mapped tier_1 to tier1';
    END IF;
    
    -- If tier_2 exists, map it to tier2
    IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'tier_2' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pincode_tier')) THEN
        UPDATE public.pincode_tiers SET tier = 'tier2'::pincode_tier WHERE tier = 'tier_2'::pincode_tier;
        RAISE NOTICE 'Mapped tier_2 to tier2';
    END IF;
    
    -- If tier_3 exists, map it to tier3
    IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'tier_3' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pincode_tier')) THEN
        UPDATE public.pincode_tiers SET tier = 'tier3'::pincode_tier WHERE tier = 'tier_3'::pincode_tier;
        RAISE NOTICE 'Mapped tier_3 to tier3';
    END IF;
    
    -- If metro exists, map it to tier1
    IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'metro' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pincode_tier')) THEN
        UPDATE public.pincode_tiers SET tier = 'tier1'::pincode_tier WHERE tier = 'metro'::pincode_tier;
        RAISE NOTICE 'Mapped metro to tier1';
    END IF;
    
    -- If city exists, map it to tier2
    IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'city' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pincode_tier')) THEN
        UPDATE public.pincode_tiers SET tier = 'tier2'::pincode_tier WHERE tier = 'city'::pincode_tier;
        RAISE NOTICE 'Mapped city to tier2';
    END IF;
    
    -- If rural exists, map it to tier3
    IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'rural' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pincode_tier')) THEN
        UPDATE public.pincode_tiers SET tier = 'tier3'::pincode_tier WHERE tier = 'rural'::pincode_tier;
        RAISE NOTICE 'Mapped rural to tier3';
    END IF;
END $$;

-- Verify the enum values are now correct
SELECT 'Verifying pincode_tier enum values:' as status;

SELECT 
    t.typname as enum_name,
    e.enumlabel as enum_value,
    e.enumsortorder as sort_order
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'pincode_tier'
ORDER BY e.enumsortorder;

-- Show current pincode_tiers data
SELECT 'Current pincode_tiers data:' as status;

SELECT DISTINCT tier, COUNT(*) as count
FROM public.pincode_tiers 
GROUP BY tier
ORDER BY tier;
