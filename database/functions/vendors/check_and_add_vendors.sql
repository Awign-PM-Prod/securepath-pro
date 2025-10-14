-- Check if vendors exist and add test vendors if needed

-- First, check if there are any vendors
SELECT 
  COUNT(*) as vendor_count,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_vendors
FROM public.vendors;

-- If no vendors exist, add some test vendors
-- Get the first super_admin user to use as created_by
DO $$
DECLARE
  admin_user_id UUID;
  vendor_count INTEGER;
BEGIN
  -- Get the first super_admin user
  SELECT user_id INTO admin_user_id
  FROM public.profiles 
  WHERE role = 'super_admin' 
  LIMIT 1;
  
  -- Check if vendors exist
  SELECT COUNT(*) INTO vendor_count FROM public.vendors;
  
  -- If no vendors exist and we have an admin user, add test vendors
  IF vendor_count = 0 AND admin_user_id IS NOT NULL THEN
    INSERT INTO public.vendors (
      name, email, phone, contact_person, address, city, state, pincode, country,
      coverage_pincodes, is_active, created_by, created_at, updated_at
    ) VALUES 
    (
      'Metro Verification Services',
      'contact@metroverification.com',
      '+91 98765 43210',
      'Rajesh Kumar',
      '123 Business Park, Sector 5',
      'Mumbai',
      'Maharashtra',
      '400001',
      'India',
      ARRAY['400001', '400002', '400003', '400004', '400005'],
      true,
      admin_user_id,
      NOW(),
      NOW()
    ),
    (
      'Delhi Verification Co.',
      'info@delhiverification.com',
      '+91 98765 43211',
      'Priya Sharma',
      '456 Corporate Plaza, Connaught Place',
      'New Delhi',
      'Delhi',
      '110001',
      'India',
      ARRAY['110001', '110002', '110003', '110004', '110005'],
      true,
      admin_user_id,
      NOW(),
      NOW()
    ),
    (
      'South India Verifications',
      'admin@southverification.com',
      '+91 98765 43212',
      'Kumar Rajan',
      '789 Tech Hub, Electronic City',
      'Bangalore',
      'Karnataka',
      '560001',
      'India',
      ARRAY['560001', '560002', '560003', '560004', '560005'],
      true,
      admin_user_id,
      NOW(),
      NOW()
    );
    
    RAISE NOTICE 'Added 3 test vendors';
  ELSE
    RAISE NOTICE 'Vendors already exist or no admin user found';
  END IF;
END $$;

-- Show the vendors that exist now
SELECT 
  id,
  name,
  email,
  phone,
  contact_person,
  city,
  state,
  is_active,
  created_at
FROM public.vendors
ORDER BY created_at;
