-- =====================================================
-- Create User Function Without Permission Checking
-- Background Verification Platform
-- =====================================================

-- Drop existing function
DROP FUNCTION IF EXISTS public.create_user_no_permissions;

-- Create a function that creates users without permission checking
CREATE OR REPLACE FUNCTION public.create_user_no_permissions(
  user_email TEXT,
  user_first_name TEXT,
  user_last_name TEXT,
  user_phone TEXT,
  user_role TEXT,
  created_by_user_id UUID,
  vendor_data JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_auth_user_id UUID;
  new_profile_id UUID;
  new_vendor_id UUID;
  new_gig_partner_id UUID;
  result JSONB;
BEGIN
  -- Generate a new UUID for the auth user
  new_auth_user_id := gen_random_uuid();
  
  -- Create the profile
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
    user_email,
    user_first_name,
    user_last_name,
    user_phone,
    user_role::app_role,
    created_by_user_id
  ) RETURNING id INTO new_profile_id;
  
  -- Create role-specific records
  IF user_role = 'gig_worker' THEN
    -- Create gig partner record
    INSERT INTO public.gig_partners (
      profile_id,
      user_id,
      vendor_id,
      max_daily_capacity,
      created_by
    ) VALUES (
      new_profile_id,
      new_auth_user_id,
      COALESCE((vendor_data->>'vendor_id')::UUID, NULL),
      5, -- Default capacity
      created_by_user_id
    ) RETURNING id INTO new_gig_partner_id;
    
  ELSIF user_role = 'vendor' THEN
    -- Create vendor record if vendor_data is provided
    IF vendor_data IS NOT NULL THEN
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
        COALESCE(vendor_data->>'name', user_first_name || ' ' || user_last_name),
        user_email,
        user_phone,
        COALESCE(vendor_data->>'contact_person', user_first_name || ' ' || user_last_name),
        COALESCE(vendor_data->>'address', ''),
        COALESCE(vendor_data->>'city', ''),
        COALESCE(vendor_data->>'state', ''),
        COALESCE(vendor_data->>'pincode', ''),
        COALESCE(vendor_data->>'country', 'India'),
        COALESCE(ARRAY(SELECT jsonb_array_elements_text(vendor_data->'coverage_pincodes')), ARRAY[COALESCE(vendor_data->>'pincode', '')]),
        created_by_user_id
      ) RETURNING id INTO new_vendor_id;
    END IF;
  END IF;
  
  -- Return success with the created IDs
  result := jsonb_build_object(
    'success', true,
    'profile_id', new_profile_id,
    'auth_user_id', new_auth_user_id,
    'user_id', new_auth_user_id, -- For compatibility with existing code
    'message', 'User profile created successfully. Auth user needs to be created manually in Supabase Auth dashboard.'
  );
  
  -- Add role-specific IDs to result
  IF user_role = 'gig_worker' THEN
    result := result || jsonb_build_object('gig_partner_id', new_gig_partner_id);
  ELSIF user_role = 'vendor' AND new_vendor_id IS NOT NULL THEN
    result := result || jsonb_build_object('vendor_id', new_vendor_id);
  END IF;
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Clean up on error
    IF new_vendor_id IS NOT NULL THEN
      DELETE FROM public.vendors WHERE id = new_vendor_id;
    END IF;
    IF new_gig_partner_id IS NOT NULL THEN
      DELETE FROM public.gig_partners WHERE id = new_gig_partner_id;
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
GRANT EXECUTE ON FUNCTION public.create_user_no_permissions TO authenticated;

-- Test the function with vendor creation
SELECT public.create_user_no_permissions(
  'test@vendor.com',
  'Test',
  'Vendor',
  '+91 98765 43210',
  'vendor',
  '00000000-0000-0000-0000-000000000000'::UUID, -- Dummy UUID for testing
  '{
    "name": "Test Vendor Company",
    "contact_person": "Test Contact",
    "address": "123 Test Street",
    "city": "Test City",
    "state": "Test State",
    "pincode": "123456",
    "country": "India",
    "coverage_pincodes": ["123456", "123457"]
  }'::jsonb
);
