-- =====================================================
-- Fix Vendor Profile Link Issue
-- Background Verification Platform
-- =====================================================

-- First, let's see what we're working with
SELECT 
    'Current State' as section,
    p.id as profile_id,
    p.first_name,
    p.last_name,
    p.email,
    p.role,
    v.id as vendor_id,
    v.name as vendor_name
FROM profiles p
LEFT JOIN vendors v ON v.profile_id = p.id
WHERE p.role = 'vendor'
ORDER BY p.created_at DESC;

-- Fix: Create vendor record for the profile if it doesn't exist
DO $$
DECLARE
    profile_record RECORD;
    vendor_id UUID;
BEGIN
    -- Get the profile that needs a vendor record
    SELECT * INTO profile_record
    FROM profiles 
    WHERE id = '3f9f50e2-eb8a-4451-996e-ddecadd0c253'
    AND role = 'vendor';
    
    IF FOUND THEN
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
            
            RAISE NOTICE 'Created vendor record with ID: %', vendor_id;
        ELSE
            RAISE NOTICE 'Vendor record already exists with ID: %', vendor_id;
        END IF;
    ELSE
        RAISE NOTICE 'Profile not found or not a vendor role';
    END IF;
END $$;

-- Verify the fix
SELECT 
    'After Fix' as section,
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
WHERE p.id = '3f9f50e2-eb8a-4451-996e-ddecadd0c253';
