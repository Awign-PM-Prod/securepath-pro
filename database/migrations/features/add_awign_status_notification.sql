-- =====================================================
-- Add AWIGN API Status Notification
-- =====================================================
-- This migration adds a database trigger that automatically notifies
-- the AWIGN API when API-sourced cases transition to 'in_progress' status.
--
-- Prerequisites:
-- 1. pg_net extension must be enabled (for calling edge functions)
-- 2. Supabase URL and anon key must be configured (via ALTER DATABASE or system_configs)
-- 3. Edge function 'update-awign-lead-status' must be deployed
-- 4. AWIGN API credentials must be set as edge function secrets
--
-- =====================================================

-- Enable pg_net extension if available (required for HTTP calls from triggers)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
  RAISE NOTICE 'pg_net extension enabled';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'pg_net extension not available. AWIGN notifications will be skipped. Error: %', SQLERRM;
END $$;

-- Create or replace the trigger function
-- This function calls the Supabase Edge Function which then calls AWIGN API
CREATE OR REPLACE FUNCTION public.notify_awign_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_supabase_url TEXT;
  v_supabase_anon_key TEXT;
  v_edge_function_url TEXT;
  v_request_body JSONB;
BEGIN
  -- Only process if:
  -- 1. Case source is 'api'
  -- 2. Status changed to 'in_progress'
  -- 3. Previous status was NOT 'in_progress' (avoid duplicate calls)
  -- 4. client_case_id is not null (required for API call)
  
  IF NEW.source = 'api' 
     AND NEW.status = 'in_progress' 
     AND (OLD.status IS NULL OR OLD.status != 'in_progress')
     AND NEW.client_case_id IS NOT NULL THEN
    
    -- Get Supabase URL and anon key from system_configs table
    -- These should be set using the INSERT statements provided in the setup guide
    BEGIN
      -- Try to get from system_configs table
      -- config_value is JSONB, so we extract the text value
      SELECT config_value->>'value' INTO v_supabase_url
      FROM public.system_configs
      WHERE config_key = 'supabase_url'
        AND config_category = 'awign_integration'
        AND is_active = true
        AND (effective_until IS NULL OR effective_until >= now())
      LIMIT 1;
      
      -- If not found with 'value' key, try direct text extraction
      IF v_supabase_url IS NULL THEN
        SELECT config_value::TEXT INTO v_supabase_url
        FROM public.system_configs
        WHERE config_key = 'supabase_url'
          AND config_category = 'awign_integration'
          AND is_active = true
          AND (effective_until IS NULL OR effective_until >= now())
        LIMIT 1;
      END IF;
      
      SELECT config_value->>'value' INTO v_supabase_anon_key
      FROM public.system_configs
      WHERE config_key = 'supabase_anon_key'
        AND config_category = 'awign_integration'
        AND is_active = true
        AND (effective_until IS NULL OR effective_until >= now())
      LIMIT 1;
      
      -- If not found with 'value' key, try direct text extraction
      IF v_supabase_anon_key IS NULL THEN
        SELECT config_value::TEXT INTO v_supabase_anon_key
        FROM public.system_configs
        WHERE config_key = 'supabase_anon_key'
          AND config_category = 'awign_integration'
          AND is_active = true
          AND (effective_until IS NULL OR effective_until >= now())
        LIMIT 1;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        -- Table might not exist or have different structure
        -- Log warning but continue
        RAISE WARNING 'Error reading system_configs: %', SQLERRM;
    END;
    
    -- If still not set, log warning and skip (don't fail the transaction)
    IF v_supabase_url IS NULL OR v_supabase_anon_key IS NULL THEN
      RAISE WARNING 'AWIGN notification skipped: Supabase URL or anon key not configured. Case ID: %, Client Case ID: %', NEW.id, NEW.client_case_id;
      RETURN NEW;
    END IF;
    
    -- Construct edge function URL
    v_edge_function_url := v_supabase_url || '/functions/v1/update-awign-lead-status';
    
    -- Build request body
    v_request_body := jsonb_build_object(
      'caseId', NEW.id::TEXT,
      'clientCaseId', NEW.client_case_id,
      'status', NEW.status::TEXT
    );
    
    -- Call the edge function asynchronously using pg_net
    -- This is fire-and-forget, so errors won't block the case update
    BEGIN
      -- Check if pg_net extension is available
      IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
        PERFORM net.http_post(
          url := v_edge_function_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_supabase_anon_key,
            'apikey', v_supabase_anon_key
          ),
          body := v_request_body::TEXT
        );
      ELSE
        -- Fallback: log that pg_net is not available
        RAISE WARNING 'AWIGN notification skipped: pg_net extension not available. Case ID: %, Client Case ID: %', NEW.id, NEW.client_case_id;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        -- Log error but don't fail the transaction
        RAISE WARNING 'Failed to notify AWIGN API for case % (client_case_id: %): %', NEW.id, NEW.client_case_id, SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION public.notify_awign_on_status_change() IS 'Notifies AWIGN API when API-sourced cases transition to in_progress status by calling the update-awign-lead-status edge function';

-- Drop existing trigger if it exists (to allow re-running migration)
DROP TRIGGER IF EXISTS cases_notify_awign_trigger ON public.cases;

-- Create trigger on cases table
-- Trigger fires AFTER UPDATE OF status to catch status changes
-- Uses WHEN clause to filter only relevant status changes (performance optimization)
CREATE TRIGGER cases_notify_awign_trigger
  AFTER UPDATE OF status ON public.cases
  FOR EACH ROW
  WHEN (
    NEW.source = 'api' 
    AND NEW.status = 'in_progress' 
    AND (OLD.status IS NULL OR OLD.status != 'in_progress')
    AND NEW.client_case_id IS NOT NULL
  )
  EXECUTE FUNCTION public.notify_awign_on_status_change();

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.notify_awign_on_status_change() TO authenticated;

-- =====================================================
-- Setup Instructions
-- =====================================================
-- After running this migration, you need to configure the Supabase URL and anon key.
-- Run these INSERT statements (replace with your actual values):
--
-- INSERT INTO public.system_configs (
--   config_category,
--   config_key,
--   config_value,
--   description,
--   value_type,
--   is_sensitive,
--   created_by,
--   updated_by
-- )
-- VALUES (
--   'awign_integration',
--   'supabase_url',
--   '"https://YOUR_PROJECT_REF.supabase.co"'::jsonb,
--   'Supabase project URL for AWIGN integration',
--   'string',
--   false,
--   (SELECT id FROM auth.users WHERE role = 'super_admin' LIMIT 1),
--   (SELECT id FROM auth.users WHERE role = 'super_admin' LIMIT 1)
-- )
-- ON CONFLICT (config_category, config_key, environment) 
-- DO UPDATE SET 
--   config_value = EXCLUDED.config_value,
--   updated_at = now();
--
-- INSERT INTO public.system_configs (
--   config_category,
--   config_key,
--   config_value,
--   description,
--   value_type,
--   is_sensitive,
--   created_by,
--   updated_by
-- )
-- VALUES (
--   'awign_integration',
--   'supabase_anon_key',
--   '"YOUR_ANON_KEY"'::jsonb,
--   'Supabase anon key for AWIGN integration',
--   'string',
--   true,
--   (SELECT id FROM auth.users WHERE role = 'super_admin' LIMIT 1),
--   (SELECT id FROM auth.users WHERE role = 'super_admin' LIMIT 1)
-- )
-- ON CONFLICT (config_category, config_key, environment) 
-- DO UPDATE SET 
--   config_value = EXCLUDED.config_value,
--   updated_at = now();

-- Migration complete
SELECT 'AWIGN status notification trigger created successfully. Please configure Supabase URL and anon key using the INSERT statements above.' AS status;

