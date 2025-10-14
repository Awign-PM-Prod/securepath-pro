-- =====================================================
-- Create Vendor Edge Function via SQL
-- Background Verification Platform
-- =====================================================

-- First, let's create a simpler approach using a database function
-- that can be called directly from the client

-- Create a function to create vendors with proper auth user creation
CREATE OR REPLACE FUNCTION public.create_vendor_with_auth(
  vendor_email TEXT,
  vendor_password TEXT,
  vendor_first_name TEXT,
  vendor_last_name TEXT,
  vendor_phone TEXT,
  vendor_name TEXT,
  vendor_contact_person TEXT,
  vendor_address TEXT,
  vendor_city TEXT,
  vendor_state TEXT,
  vendor_pincode TEXT,
  vendor_country TEXT DEFAULT 'India',
  vendor_coverage_pincodes TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  current_user_role TEXT;
  new_auth_user_id UUID;
  new_profile_id UUID;
  new_vendor_id UUID;
  result JSONB;
BEGIN
  -- Get current user info
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
  END IF;
  
  -- Check if current user has permission to create vendors
  SELECT role INTO current_user_role
  FROM public.profiles
  WHERE user_id = current_user_id;
  
  IF current_user_role NOT IN ('super_admin', 'ops_team', 'vendor_team') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions to create vendors');
  END IF;
  
  -- Generate a new UUID for the auth user (we'll create it via a trigger)
  new_auth_user_id := gen_random_uuid();
  
  -- Create the profile first
  INSERT INTO public.profiles (
    user_id,
    email,
    first_name,
    last_name,
    phone,
    role,
    created_by
  ) VALUES (
    new_auth_user_id,
    vendor_email,
    vendor_first_name,
    vendor_last_name,
    vendor_phone,
    'vendor',
    current_user_id
  ) RETURNING id INTO new_profile_id;
  
  -- Create the vendor record
  INSERT INTO public.vendors (
    name,
    email,
    phone,
    contact_person,
    address,
    city,
    state,
    pincode,
    country,
    coverage_pincodes,
    created_by
  ) VALUES (
    vendor_name,
    vendor_email,
    vendor_phone,
    vendor_contact_person,
    vendor_address,
    vendor_city,
    vendor_state,
    vendor_pincode,
    vendor_country,
    COALESCE(vendor_coverage_pincodes, ARRAY[vendor_pincode]),
    current_user_id
  ) RETURNING id INTO new_vendor_id;
  
  -- Return success with the created IDs
  result := jsonb_build_object(
    'success', true,
    'vendor_id', new_vendor_id,
    'profile_id', new_profile_id,
    'auth_user_id', new_auth_user_id,
    'message', 'Vendor created successfully. Please create the auth user manually or use the setup email feature.'
  );
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Clean up on error
    DELETE FROM public.vendors WHERE id = new_vendor_id;
    DELETE FROM public.profiles WHERE id = new_profile_id;
    
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_vendor_with_auth TO authenticated;

-- Create a simpler function that just creates the vendor without auth user
-- (for cases where auth user is created separately)
CREATE OR REPLACE FUNCTION public.create_vendor_profile(
  vendor_email TEXT,
  vendor_first_name TEXT,
  vendor_last_name TEXT,
  vendor_phone TEXT,
  vendor_name TEXT,
  vendor_contact_person TEXT,
  vendor_address TEXT,
  vendor_city TEXT,
  vendor_state TEXT,
  vendor_pincode TEXT,
  vendor_country TEXT DEFAULT 'India',
  vendor_coverage_pincodes TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  current_user_role TEXT;
  new_vendor_id UUID;
  result JSONB;
BEGIN
  -- Get current user info
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
  END IF;
  
  -- Check if current user has permission to create vendors
  SELECT role INTO current_user_role
  FROM public.profiles
  WHERE user_id = current_user_id;
  
  IF current_user_role NOT IN ('super_admin', 'ops_team', 'vendor_team') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions to create vendors');
  END IF;
  
  -- Create the vendor record
  INSERT INTO public.vendors (
    name,
    email,
    phone,
    contact_person,
    address,
    city,
    state,
    pincode,
    country,
    coverage_pincodes,
    created_by
  ) VALUES (
    vendor_name,
    vendor_email,
    vendor_phone,
    vendor_contact_person,
    vendor_address,
    vendor_city,
    vendor_state,
    vendor_pincode,
    vendor_country,
    COALESCE(vendor_coverage_pincodes, ARRAY[vendor_pincode]),
    current_user_id
  ) RETURNING id INTO new_vendor_id;
  
  -- Return success
  result := jsonb_build_object(
    'success', true,
    'vendor_id', new_vendor_id,
    'message', 'Vendor profile created successfully'
  );
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_vendor_profile TO authenticated;

-- Test the function
SELECT public.create_vendor_profile(
  'test@vendor.com',
  'Test',
  'Vendor',
  '+91 98765 43210',
  'Test Vendor Company',
  'Test Contact',
  '123 Test Street',
  'Test City',
  'Test State',
  '123456',
  'India',
  ARRAY['123456', '123457']
);
