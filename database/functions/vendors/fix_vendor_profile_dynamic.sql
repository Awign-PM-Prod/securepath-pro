-- =====================================================
-- Fix Vendor Profile Link Issue - Dynamic Version
-- Background Verification Platform
-- =====================================================

-- First, let's see all vendor profiles and their vendor records
SELECT 
    'Current State' as section,
    p.id as profile_id,
    p.first_name,
    p.last_name,
    p.email,
    p.role,
    v.id as vendor_id,
    v.name as vendor_name,
    v.is_active
FROM profiles p
LEFT JOIN vendors v ON v.profile_id = p.id
WHERE p.role = 'vendor'
ORDER BY p.created_at DESC;

-- Fix: Create vendor records for ALL vendor profiles that don't have them
DO $$
DECLARE
    profile_record RECORD;
    vendor_id UUID;
    created_count INTEGER := 0;
BEGIN
    -- Loop through all vendor profiles
    FOR profile_record IN 
        SELECT * FROM profiles 
        WHERE role = 'vendor'
    LOOP
        -- Check if vendor record already exists
        SELECT id INTO vendor_id
        FROM vendors 
        WHERE profile_id = profile_record.id;
        
        IF NOT FOUND THEN
            -- Create vendor record
            INSERT INTO vendors (
                name,
                email,
                profile_id,
                is_active,
                created_by,
                created_at,
                updated_at
            ) VALUES (
                COALESCE(profile_record.first_name || ' ' || profile_record.last_name, 'Vendor'),
                profile_record.email,
                profile_record.id,
                true,
                profile_record.id, -- Use profile ID as created_by for now
                NOW(),
                NOW()
            ) RETURNING id INTO vendor_id;
            
            created_count := created_count + 1;
            RAISE NOTICE 'Created vendor record for % (ID: %)', profile_record.email, vendor_id;
        ELSE
            RAISE NOTICE 'Vendor record already exists for % (ID: %)', profile_record.email, vendor_id;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Total vendor records created: %', created_count;
END $$;

-- Verify the fix - show all vendor profiles with their vendor records
SELECT 
    'After Fix' as section,
    p.id as profile_id,
    p.first_name,
    p.last_name,
    p.email,
    p.role,
    v.id as vendor_id,
    v.name as vendor_name,
    v.is_active,
    v.created_at as vendor_created_at
FROM profiles p
LEFT JOIN vendors v ON v.profile_id = p.id
WHERE p.role = 'vendor'
ORDER BY p.created_at DESC;
