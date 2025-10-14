-- =====================================================
-- Create Simple Vendor Creation Function
-- Background Verification Platform
-- =====================================================

-- Drop existing functions
DROP FUNCTION IF EXISTS public.create_vendor_with_auth_user;
DROP FUNCTION IF EXISTS public.create_vendor_profile;
DROP FUNCTION IF EXISTS public.create_vendor_simple;

-- Create a simple function that just creates the vendor record
-- The RLS policies will handle the permission checking
CREATE OR REPLACE FUNCTION public.create_vendor_record(
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
  new_vendor_id UUID;
  current_user_id UUID;
  result JSONB;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
  END IF;

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
    current_user_id
  ) RETURNING id INTO new_vendor_id;
  
  -- Return success
  result := jsonb_build_object(
    'success', true,
    'vendor_id', new_vendor_id,
    'message', 'Vendor record created successfully'
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
GRANT EXECUTE ON FUNCTION public.create_vendor_record TO authenticated;

-- Test the function
SELECT public.create_vendor_record(
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
