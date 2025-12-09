-- =====================================================
-- VALIDATE API KEY FUNCTION
-- Used by edge functions to verify API keys
-- Background Verification Platform
-- =====================================================

CREATE OR REPLACE FUNCTION public.validate_api_key(
  p_api_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key_hash TEXT;
  v_key_record RECORD;
  v_result JSONB;
BEGIN
  -- Validate input
  IF p_api_key IS NULL OR length(trim(p_api_key)) = 0 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'API key is required'
    );
  END IF;
  
  -- Hash the provided key
  v_key_hash := public.hash_api_key(trim(p_api_key));
  
  -- Look up the key
  SELECT 
    id,
    key_name,
    client_id,
    permissions,
    rate_limit_per_minute,
    rate_limit_per_day,
    is_active,
    expires_at,
    last_used_at,
    usage_count
  INTO v_key_record
  FROM public.api_keys
  WHERE api_key_hash = v_key_hash;
  
  -- Check if key exists
  IF v_key_record IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Invalid API key'
    );
  END IF;
  
  -- Check if key is active
  IF NOT v_key_record.is_active THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'API key is inactive'
    );
  END IF;
  
  -- Check if key is expired
  IF v_key_record.expires_at IS NOT NULL AND v_key_record.expires_at < now() THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'API key has expired'
    );
  END IF;
  
  -- Update usage tracking
  UPDATE public.api_keys
  SET 
    last_used_at = now(),
    usage_count = usage_count + 1,
    updated_at = now()
  WHERE id = v_key_record.id;
  
  -- Return validation result
  RETURN jsonb_build_object(
    'valid', true,
    'key_id', v_key_record.id,
    'key_name', v_key_record.key_name,
    'client_id', v_key_record.client_id,
    'permissions', v_key_record.permissions,
    'rate_limit_per_minute', v_key_record.rate_limit_per_minute,
    'rate_limit_per_day', v_key_record.rate_limit_per_day
  );
END;
$$;



