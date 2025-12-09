-- =====================================================
-- CREATE API KEY FUNCTION
-- Allows admins to create API keys for clients
-- Background Verification Platform
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_api_key(
  p_key_name TEXT,
  p_client_id UUID,
  p_permissions JSONB DEFAULT '{"create_cases": true, "read_cases": true}'::jsonb,
  p_rate_limit_per_minute INTEGER DEFAULT 60,
  p_rate_limit_per_day INTEGER DEFAULT 10000,
  p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_api_key TEXT;
  v_api_key_hash TEXT;
  v_key_id UUID;
  v_result JSONB;
BEGIN
  -- Get current user (or use provided created_by)
  v_user_id := COALESCE(p_created_by, auth.uid());
  
  -- If no user provided and no authenticated user, try to find an admin user
  IF v_user_id IS NULL THEN
    SELECT user_id INTO v_user_id
    FROM public.profiles
    WHERE role IN ('super_admin', 'ops_team')
    AND is_active = true
    LIMIT 1;
    
    -- If still no user found, allow NULL (for direct SQL execution)
    -- You may want to create a system user for API operations
  END IF;
  
  -- If we have a user, check if they're admin (skip check if no user)
  IF v_user_id IS NOT NULL THEN
    SELECT role INTO v_user_role
    FROM public.profiles
    WHERE user_id = v_user_id
    AND is_active = true;
    
    IF v_user_role IS NOT NULL AND v_user_role NOT IN ('super_admin', 'ops_team') THEN
      RAISE EXCEPTION 'Insufficient permissions. Only admins can create API keys.';
    END IF;
  END IF;
  
  -- Validate client exists
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = p_client_id AND is_active = true) THEN
    RAISE EXCEPTION 'Client not found or inactive';
  END IF;
  
  -- Generate API key
  v_api_key := public.generate_api_key();
  
  -- Hash the key for storage
  v_api_key_hash := public.hash_api_key(v_api_key);
  
  -- Check if hash already exists (extremely unlikely, but safety check)
  IF EXISTS (SELECT 1 FROM public.api_keys WHERE api_key_hash = v_api_key_hash) THEN
    -- Regenerate if collision (should never happen, but just in case)
    v_api_key := public.generate_api_key();
    v_api_key_hash := public.hash_api_key(v_api_key);
  END IF;
  
  -- Insert into database
  INSERT INTO public.api_keys (
    key_name,
    api_key,
    api_key_hash,
    client_id,
    permissions,
    rate_limit_per_minute,
    rate_limit_per_day,
    expires_at,
    created_by
  ) VALUES (
    p_key_name,
    v_api_key, -- Store plain text only for initial display
    v_api_key_hash,
    p_client_id,
    p_permissions,
    p_rate_limit_per_minute,
    p_rate_limit_per_day,
    p_expires_at,
    v_user_id
  )
  RETURNING id INTO v_key_id;
  
  -- Return result (include plain key only once - this is the only time it's returned)
  v_result := jsonb_build_object(
    'success', true,
    'id', v_key_id,
    'api_key', v_api_key, -- ⚠️ Only time this is returned - save it immediately!
    'key_name', p_key_name,
    'client_id', p_client_id,
    'permissions', p_permissions,
    'rate_limit_per_minute', p_rate_limit_per_minute,
    'rate_limit_per_day', p_rate_limit_per_day,
    'expires_at', p_expires_at,
    'created_at', now()
  );
  
  RETURN v_result;
END;
$$;

