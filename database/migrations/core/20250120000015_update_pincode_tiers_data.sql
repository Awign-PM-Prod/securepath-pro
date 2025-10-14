-- Update existing pincode_tiers data to use the new enum values
-- This runs after the enum values have been committed

-- Update any existing pincode_tiers data to use the new enum values
-- This is a mapping from old values to new values
DO $$
DECLARE
    old_value text;
    new_value text;
    update_count integer;
BEGIN
    -- Map common old values to new values
    -- You can add more mappings here if needed
    
    -- If tier_1 exists, map it to tier1
    IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'tier_1' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pincode_tier')) THEN
        UPDATE public.pincode_tiers SET tier = 'tier1'::pincode_tier WHERE tier = 'tier_1'::pincode_tier;
        GET DIAGNOSTICS update_count = ROW_COUNT;
        RAISE NOTICE 'Mapped tier_1 to tier1: % rows updated', update_count;
    END IF;
    
    -- If tier_2 exists, map it to tier2
    IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'tier_2' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pincode_tier')) THEN
        UPDATE public.pincode_tiers SET tier = 'tier2'::pincode_tier WHERE tier = 'tier_2'::pincode_tier;
        GET DIAGNOSTICS update_count = ROW_COUNT;
        RAISE NOTICE 'Mapped tier_2 to tier2: % rows updated', update_count;
    END IF;
    
    -- If tier_3 exists, map it to tier3
    IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'tier_3' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pincode_tier')) THEN
        UPDATE public.pincode_tiers SET tier = 'tier3'::pincode_tier WHERE tier = 'tier_3'::pincode_tier;
        GET DIAGNOSTICS update_count = ROW_COUNT;
        RAISE NOTICE 'Mapped tier_3 to tier3: % rows updated', update_count;
    END IF;
    
    -- If metro exists, map it to tier1
    IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'metro' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pincode_tier')) THEN
        UPDATE public.pincode_tiers SET tier = 'tier1'::pincode_tier WHERE tier = 'metro'::pincode_tier;
        GET DIAGNOSTICS update_count = ROW_COUNT;
        RAISE NOTICE 'Mapped metro to tier1: % rows updated', update_count;
    END IF;
    
    -- If city exists, map it to tier2
    IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'city' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pincode_tier')) THEN
        UPDATE public.pincode_tiers SET tier = 'tier2'::pincode_tier WHERE tier = 'city'::pincode_tier;
        GET DIAGNOSTICS update_count = ROW_COUNT;
        RAISE NOTICE 'Mapped city to tier2: % rows updated', update_count;
    END IF;
    
    -- If rural exists, map it to tier3
    IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'rural' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pincode_tier')) THEN
        UPDATE public.pincode_tiers SET tier = 'tier3'::pincode_tier WHERE tier = 'rural'::pincode_tier;
        GET DIAGNOSTICS update_count = ROW_COUNT;
        RAISE NOTICE 'Mapped rural to tier3: % rows updated', update_count;
    END IF;
    
    -- If tier1 exists, map it to tier1 (no change needed, but let's check)
    IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'tier1' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pincode_tier')) THEN
        RAISE NOTICE 'tier1 already exists in enum';
    END IF;
    
    -- If tier2 exists, map it to tier2 (no change needed, but let's check)
    IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'tier2' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pincode_tier')) THEN
        RAISE NOTICE 'tier2 already exists in enum';
    END IF;
    
    -- If tier3 exists, map it to tier3 (no change needed, but let's check)
    IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'tier3' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pincode_tier')) THEN
        RAISE NOTICE 'tier3 already exists in enum';
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
