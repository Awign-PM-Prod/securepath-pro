-- =====================================================
-- Setup Vendor Test Data
-- Background Verification Platform
-- =====================================================

-- First, let's see what we have
SELECT 
    'Current Vendor' as section,
    v.id as vendor_id,
    v.name as vendor_name,
    v.email,
    v.is_active
FROM vendors v
WHERE v.email = 'vendor6@awign.com';

-- Check if there are any gig workers assigned to this vendor
SELECT 
    'Gig Workers for Vendor' as section,
    gp.id as gig_partner_id,
    p.first_name,
    p.last_name,
    p.email,
    gp.is_active,
    gp.is_available,
    gp.max_daily_capacity,
    gp.capacity_available
FROM gig_partners gp
JOIN profiles p ON gp.profile_id = p.id
WHERE gp.vendor_id = (SELECT id FROM vendors WHERE email = 'vendor6@awign.com');

-- Check if there are any cases assigned to this vendor
SELECT 
    'Cases for Vendor' as section,
    c.id as case_id,
    c.case_number,
    c.title,
    c.status,
    c.current_assignee_type,
    c.current_vendor_id,
    cl.name as client_name
FROM cases c
JOIN clients cl ON c.client_id = cl.id
WHERE c.current_vendor_id = (SELECT id FROM vendors WHERE email = 'vendor6@awign.com');

-- Create some test gig workers for this vendor
DO $$
DECLARE
    vendor_record RECORD;
    gig_worker_id UUID;
    profile_id UUID;
    user_id UUID;
BEGIN
    -- Get the vendor record
    SELECT * INTO vendor_record
    FROM vendors 
    WHERE email = 'vendor6@awign.com';
    
    IF FOUND THEN
        RAISE NOTICE 'Found vendor: %', vendor_record.name;
        
        -- Create test gig worker 1
        INSERT INTO profiles (
            user_id,
            email,
            first_name,
            last_name,
            role,
            is_active,
            created_by,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            'gigworker1@test.com',
            'Gig',
            'Worker 1',
            'gig_worker',
            true,
            vendor_record.created_by,
            NOW(),
            NOW()
        ) RETURNING id INTO profile_id;
        
        -- Get the user_id from the profile
        SELECT user_id INTO user_id FROM profiles WHERE id = profile_id;
        
        -- Create gig_partner record
        INSERT INTO gig_partners (
            user_id,
            profile_id,
            phone,
            address,
            city,
            state,
            pincode,
            coverage_pincodes,
            max_daily_capacity,
            capacity_available,
            vendor_id,
            is_direct_gig,
            is_active,
            is_available,
            created_by,
            created_at,
            updated_at
        ) VALUES (
            user_id,
            profile_id,
            '9876543210',
            'Test Address 1',
            'Mumbai',
            'Maharashtra',
            '400001',
            ARRAY['400001', '400002', '400003'],
            5,
            5,
            vendor_record.id,
            false, -- Not direct gig, assigned to vendor
            true,
            true,
            vendor_record.created_by,
            NOW(),
            NOW()
        ) RETURNING id INTO gig_worker_id;
        
        RAISE NOTICE 'Created gig worker 1: %', gig_worker_id;
        
        -- Create test gig worker 2
        INSERT INTO profiles (
            user_id,
            email,
            first_name,
            last_name,
            role,
            is_active,
            created_by,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            'gigworker2@test.com',
            'Gig',
            'Worker 2',
            'gig_worker',
            true,
            vendor_record.created_by,
            NOW(),
            NOW()
        ) RETURNING id INTO profile_id;
        
        -- Get the user_id from the profile
        SELECT user_id INTO user_id FROM profiles WHERE id = profile_id;
        
        -- Create gig_partner record
        INSERT INTO gig_partners (
            user_id,
            profile_id,
            phone,
            address,
            city,
            state,
            pincode,
            coverage_pincodes,
            max_daily_capacity,
            capacity_available,
            vendor_id,
            is_direct_gig,
            is_active,
            is_available,
            created_by,
            created_at,
            updated_at
        ) VALUES (
            user_id,
            profile_id,
            '9876543211',
            'Test Address 2',
            'Mumbai',
            'Maharashtra',
            '400001',
            ARRAY['400001', '400002', '400003'],
            3,
            3,
            vendor_record.id,
            false, -- Not direct gig, assigned to vendor
            true,
            true,
            vendor_record.created_by,
            NOW(),
            NOW()
        ) RETURNING id INTO gig_worker_id;
        
        RAISE NOTICE 'Created gig worker 2: %', gig_worker_id;
        
    ELSE
        RAISE NOTICE 'Vendor not found';
    END IF;
END $$;

-- Create some test cases and assign them to the vendor
DO $$
DECLARE
    vendor_record RECORD;
    client_record RECORD;
    location_record RECORD;
    case_id UUID;
BEGIN
    -- Get the vendor record
    SELECT * INTO vendor_record
    FROM vendors 
    WHERE email = 'vendor6@awign.com';
    
    -- Get or create a test client
    SELECT * INTO client_record
    FROM clients 
    WHERE email = 'testclient@example.com';
    
    IF NOT FOUND THEN
        INSERT INTO clients (
            name,
            email,
            phone,
            contact_person,
            address,
            city,
            state,
            pincode,
            country,
            is_active,
            created_by,
            created_at,
            updated_at
        ) VALUES (
            'Test Client',
            'testclient@example.com',
            '9876543210',
            'Test Contact',
            'Test Address',
            'Mumbai',
            'Maharashtra',
            '400001',
            'India',
            true,
            vendor_record.created_by,
            NOW(),
            NOW()
        ) RETURNING * INTO client_record;
    END IF;
    
    -- Get or create a test location
    SELECT * INTO location_record
    FROM locations 
    WHERE pincode = '400001'
    LIMIT 1;
    
    IF NOT FOUND THEN
        INSERT INTO locations (
            address_line,
            city,
            state,
            country,
            pincode,
            pincode_tier,
            is_verified,
            created_at,
            updated_at
        ) VALUES (
            'Test Address Line',
            'Mumbai',
            'Maharashtra',
            'India',
            '400001',
            'tier_1',
            true,
            NOW(),
            NOW()
        ) RETURNING * INTO location_record;
    END IF;
    
    -- Create test cases
    FOR i IN 1..3 LOOP
        INSERT INTO cases (
            case_number,
            title,
            description,
            priority,
            source,
            client_id,
            location_id,
            tat_hours,
            due_at,
            current_vendor_id,
            status,
            status_updated_at,
            base_rate_inr,
            total_rate_inr,
            visible_to_gig,
            created_by,
            last_updated_by,
            created_at,
            updated_at
        ) VALUES (
            'TEST-' || LPAD(i::text, 4, '0'),
            'Test Case ' || i,
            'This is a test case for vendor dashboard',
            'medium',
            'manual',
            client_record.id,
            location_record.id,
            24,
            NOW() + INTERVAL '2 days',
            vendor_record.id,
            'auto_allocated',
            NOW(),
            100.00,
            100.00,
            true,
            vendor_record.created_by,
            vendor_record.created_by,
            NOW(),
            NOW()
        ) RETURNING id INTO case_id;
        
        RAISE NOTICE 'Created test case %: %', i, case_id;
    END LOOP;
    
END $$;

-- Verify the setup
SELECT 
    'Final Verification' as section,
    'Gig Workers' as type,
    COUNT(*) as count
FROM gig_partners gp
JOIN profiles p ON gp.profile_id = p.id
WHERE gp.vendor_id = (SELECT id FROM vendors WHERE email = 'vendor6@awign.com')

UNION ALL

SELECT 
    'Final Verification' as section,
    'Assigned Cases' as type,
    COUNT(*) as count
FROM cases c
WHERE c.current_vendor_id = (SELECT id FROM vendors WHERE email = 'vendor6@awign.com');
