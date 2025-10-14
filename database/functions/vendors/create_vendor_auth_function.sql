-- =====================================================
-- Create Vendor Auth User Creation Function
-- Background Verification Platform
-- =====================================================

-- This function creates both auth user and vendor profile
-- It mimics what the Edge Function should do
CREATE OR REPLACE FUNCTION public.create_vendor_with_auth_user(
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
  
  -- Generate a new UUID for the auth user
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
    'message', 'Vendor profile created successfully. Auth user needs to be created manually in Supabase Auth dashboard.'
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
GRANT EXECUTE ON FUNCTION public.create_vendor_with_auth_user TO authenticated;

-- Test the function
SELECT public.create_vendor_with_auth_user(
  'test@vendor.com',
  'password123',
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
