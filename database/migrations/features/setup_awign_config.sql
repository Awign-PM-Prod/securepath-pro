-- =====================================================
-- Setup AWIGN Integration Configuration
-- =====================================================
-- Run this SQL script to configure Supabase URL and anon key
-- for the AWIGN integration trigger.
--
-- IMPORTANT: Replace YOUR_PROJECT_REF and YOUR_ANON_KEY with your actual values
-- =====================================================

DO $$
DECLARE
  admin_user_id UUID;
  v_supabase_url TEXT := 'https://YOUR_PROJECT_REF.supabase.co';  -- REPLACE THIS
  v_supabase_anon_key TEXT := 'YOUR_ANON_KEY';  -- REPLACE THIS
BEGIN
  -- Get a super_admin user ID, or any user if none found
  SELECT p.user_id INTO admin_user_id 
  FROM public.profiles p 
  WHERE p.role = 'super_admin' AND p.is_active = true 
  LIMIT 1;
  
  IF admin_user_id IS NULL THEN
    SELECT id INTO admin_user_id FROM auth.users LIMIT 1;
  END IF;
  
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found. Cannot create config entries.';
  END IF;
  
  -- Insert or update Supabase URL
  INSERT INTO public.system_configs (
    config_category,
    config_key,
    config_value,
    description,
    value_type,
    is_sensitive,
    environment,
    created_by,
    updated_by
  )
  VALUES (
    'awign_integration',
    'supabase_url',
    jsonb_build_object('value', v_supabase_url),
    'Supabase project URL for AWIGN integration',
    'string',
    false,
    'production',
    admin_user_id,
    admin_user_id
  )
  ON CONFLICT (config_category, config_key, environment) 
  DO UPDATE SET 
    config_value = jsonb_build_object('value', v_supabase_url),
    updated_by = admin_user_id,
    updated_at = now();
  
  RAISE NOTICE 'Supabase URL configured: %', v_supabase_url;
  
  -- Insert or update Supabase anon key
  INSERT INTO public.system_configs (
    config_category,
    config_key,
    config_value,
    description,
    value_type,
    is_sensitive,
    environment,
    created_by,
    updated_by
  )
  VALUES (
    'awign_integration',
    'supabase_anon_key',
    jsonb_build_object('value', v_supabase_anon_key),
    'Supabase anon key for AWIGN integration',
    'string',
    true,
    'production',
    admin_user_id,
    admin_user_id
  )
  ON CONFLICT (config_category, config_key, environment) 
  DO UPDATE SET 
    config_value = jsonb_build_object('value', v_supabase_anon_key),
    updated_by = admin_user_id,
    updated_at = now();
  
  RAISE NOTICE 'Supabase anon key configured';
  RAISE NOTICE 'AWIGN integration configuration complete!';
  
END $$;

-- Verify the configuration
SELECT 
  config_key,
  CASE 
    WHEN config_key = 'supabase_anon_key' THEN '***HIDDEN***'
    ELSE config_value->>'value'
  END AS config_value,
  is_active,
  effective_until
FROM public.system_configs 
WHERE config_category = 'awign_integration'
ORDER BY config_key;

