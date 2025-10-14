-- =====================================================
-- Create Vendor Profile Only (No Auth User)
-- Background Verification Platform
-- =====================================================

-- Drop existing function
DROP FUNCTION IF EXISTS public.create_vendor_profile_only;

-- Create a function that creates vendor and profile without auth user
CREATE OR REPLACE FUNCTION public.create_vendor_profile_only(
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
  new_profile_id UUID;
  valid_created_by UUID;
  result JSONB;
BEGIN
  -- Find a valid created_by user ID
  SELECT user_id INTO valid_created_by
  FROM public.profiles 
  WHERE user_id IS NOT NULL
  ORDER BY created_at
  LIMIT 1;
  
  -- Create the vendor record first
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
    valid_created_by
  ) RETURNING id INTO new_vendor_id;
  
  -- Create the profile record WITHOUT user_id (it will be NULL)
  INSERT INTO public.profiles (
    user_id,  -- This will be NULL
    email,
    first_name,
    last_name,
    phone,
    role,
    created_by
  ) VALUES (
    NULL,  -- No auth user linked
    vendor_email,
    vendor_first_name,
    vendor_last_name,
    vendor_phone,
    'vendor',
    valid_created_by
  ) RETURNING id INTO new_profile_id;
  
  -- Return success with the created IDs
  result := jsonb_build_object(
    'success', true,
    'vendor_id', new_vendor_id,
    'profile_id', new_profile_id,
    'message', 'Vendor and profile created successfully. Auth user needs to be created manually in Supabase Auth dashboard and linked to the profile.'
  );
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Clean up on error
    IF new_vendor_id IS NOT NULL THEN
      DELETE FROM public.vendors WHERE id = new_vendor_id;
    END IF;
    IF new_profile_id IS NOT NULL THEN
      DELETE FROM public.profiles WHERE id = new_profile_id;
    END IF;
    
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_vendor_profile_only TO authenticated;

-- Test the function
SELECT public.create_vendor_profile_only(
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