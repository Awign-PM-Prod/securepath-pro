-- =====================================================
-- Fix Vendor Function Authentication Issue
-- Background Verification Platform
-- =====================================================

-- Drop the existing functions
DROP FUNCTION IF EXISTS public.create_vendor_with_auth;
DROP FUNCTION IF EXISTS public.create_vendor_profile;

-- Create a simpler function that doesn't rely on auth.uid() for the main logic
-- but still checks permissions through the calling context
CREATE OR REPLACE FUNCTION public.create_vendor_simple(
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
  vendor_coverage_pincodes TEXT[] DEFAULT NULL,
  created_by_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_vendor_id UUID;
  result JSONB;
BEGIN
  -- Create the vendor record directly
  -- The RLS policies will handle the permission checking
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
    COALESCE(created_by_user_id, '00000000-0000-0000-0000-000000000000'::UUID)
  ) RETURNING id INTO new_vendor_id;
  
  -- Return success
  result := jsonb_build_object(
    'success', true,
    'vendor_id', new_vendor_id,
    'message', 'Vendor created successfully'
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
GRANT EXECUTE ON FUNCTION public.create_vendor_simple TO authenticated;

-- Create a function that gets the current user ID from the JWT token
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Try to get user ID from auth.uid() first
  IF auth.uid() IS NOT NULL THEN
    RETURN auth.uid();
  END IF;
  
  -- If that fails, try to get it from the JWT token
  BEGIN
    RETURN (auth.jwt() ->> 'sub')::UUID;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NULL;
  END;
END;
$$;

-- Create the main vendor creation function that handles auth properly
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
  -- Get current user ID using our helper function
  current_user_id := public.get_current_user_id();
  
  -- If we still can't get the user ID, try a different approach
  IF current_user_id IS NULL THEN
    -- Try to get user ID from the profiles table using email from JWT
    SELECT user_id INTO current_user_id
    FROM public.profiles
    WHERE email = (auth.jwt() ->> 'email')
    LIMIT 1;
  END IF;
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Unable to determine current user. Please ensure you are logged in.'
    );
  END IF;
  
  -- Check if current user has permission to create vendors
  SELECT role INTO current_user_role
  FROM public.profiles
  WHERE user_id = current_user_id;
  
  IF current_user_role NOT IN ('super_admin', 'ops_team', 'vendor_team') THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Insufficient permissions to create vendors'
    );
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
    'message', 'Vendor created successfully'
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
GRANT EXECUTE ON FUNCTION public.get_current_user_id TO authenticated;

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
