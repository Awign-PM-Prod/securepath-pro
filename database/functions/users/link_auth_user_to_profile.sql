-- =====================================================
-- Link Auth User to Existing Profile
-- This function links a newly created auth user to an existing profile
-- =====================================================

CREATE OR REPLACE FUNCTION public.link_auth_user_to_profile(
  profile_email TEXT,
  auth_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_record RECORD;
  gig_partner_record RECORD;
  result JSONB;
BEGIN
  -- Find the profile by email
  SELECT * INTO profile_record
  FROM public.profiles
  WHERE email = profile_email AND user_id IS NULL;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Profile not found or already linked to an auth user'
    );
  END IF;
  
  -- Update the profile with the auth user ID
  UPDATE public.profiles
  SET user_id = auth_user_id
  WHERE id = profile_record.id;
  
  -- If this is a gig worker, also update the gig_partners table
  IF profile_record.role = 'gig_worker' THEN
    UPDATE public.gig_partners
    SET user_id = auth_user_id
    WHERE profile_id = profile_record.id;
  END IF;
  
  -- Return success
  result := jsonb_build_object(
    'success', true,
    'profile_id', profile_record.id,
    'auth_user_id', auth_user_id,
    'message', 'Profile successfully linked to auth user'
  );
  
  -- Add gig_partner_id if applicable
  IF profile_record.role = 'gig_worker' THEN
    SELECT id INTO gig_partner_record
    FROM public.gig_partners
    WHERE profile_id = profile_record.id;
    
    result := result || jsonb_build_object('gig_partner_id', gig_partner_record.id);
  END IF;
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.link_auth_user_to_profile TO authenticated;

-- Test the function
-- SELECT public.link_auth_user_to_profile('user@example.com', 'auth-user-uuid-here');
