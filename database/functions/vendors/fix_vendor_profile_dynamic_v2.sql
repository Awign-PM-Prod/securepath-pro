-- =====================================================
-- Fix Vendor Profile Link Issue - Dynamic Version V2
-- Background Verification Platform
-- =====================================================

-- First, let's see all vendor profiles and their vendor records
SELECT 
    'Current State' as section,
    p.id as profile_id,
    p.user_id,
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

-- Get a valid user ID to use as created_by (use the first super admin or ops user)
DO $$
DECLARE
    valid_user_id UUID;
BEGIN
    -- Try to get a super admin user first
    SELECT user_id INTO valid_user_id
    FROM profiles 
    WHERE role = 'super_admin' 
    LIMIT 1;
    
    -- If no super admin, try ops_team
    IF valid_user_id IS NULL THEN
        SELECT user_id INTO valid_user_id
        FROM profiles 
        WHERE role = 'ops_team' 
        LIMIT 1;
    END IF;
    
    -- If still no user, get any user
    IF valid_user_id IS NULL THEN
        SELECT user_id INTO valid_user_id
        FROM profiles 
        LIMIT 1;
    END IF;
    
    RAISE NOTICE 'Using user ID % as created_by', valid_user_id;
END $$;

-- Fix: Create vendor records for ALL vendor profiles that don't have them
DO $$
DECLARE
    profile_record RECORD;
    vendor_id UUID;
    created_count INTEGER := 0;
    valid_user_id UUID;
BEGIN
    -- Get a valid user ID to use as created_by
    SELECT user_id INTO valid_user_id
    FROM profiles 
    WHERE role IN ('super_admin', 'ops_team')
    LIMIT 1;
    
    -- If no admin user, get any user
    IF valid_user_id IS NULL THEN
        SELECT user_id INTO valid_user_id
        FROM profiles 
        LIMIT 1;
    END IF;
    
    RAISE NOTICE 'Using user ID % as created_by', valid_user_id;
    
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
                valid_user_id, -- Use valid user ID
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
    p.user_id,
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
