-- =====================================================
-- Fix AWIGN Trigger - Correct net.http_post signature
-- =====================================================
-- The issue: net.http_post requires body as jsonb, not text
-- This fixes the function signature to match pg_net requirements

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
    BEGIN
      -- Try multiple ways to extract the value
      SELECT 
        COALESCE(
          config_value->>'value',  -- If stored as {"value": "..."}
          config_value::TEXT,      -- If stored as plain JSONB string
          NULL
        ) INTO v_supabase_url
      FROM public.system_configs
      WHERE config_key = 'supabase_url'
        AND config_category = 'awign_integration'
        AND is_active = true
        AND (effective_until IS NULL OR effective_until >= now())
      LIMIT 1;
      
      -- Remove quotes if present (JSONB string representation)
      IF v_supabase_url IS NOT NULL AND v_supabase_url LIKE '"%"' THEN
        v_supabase_url := trim(both '"' from v_supabase_url);
      END IF;
      
      SELECT 
        COALESCE(
          config_value->>'value',  -- If stored as {"value": "..."}
          config_value::TEXT,      -- If stored as plain JSONB string
          NULL
        ) INTO v_supabase_anon_key
      FROM public.system_configs
      WHERE config_key = 'supabase_anon_key'
        AND config_category = 'awign_integration'
        AND is_active = true
        AND (effective_until IS NULL OR effective_until >= now())
      LIMIT 1;
      
      -- Remove quotes if present (JSONB string representation)
      IF v_supabase_anon_key IS NOT NULL AND v_supabase_anon_key LIKE '"%"' THEN
        v_supabase_anon_key := trim(both '"' from v_supabase_anon_key);
      END IF;
      
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Error reading system_configs: %', SQLERRM;
    END;
    
    -- If still not set, log warning and skip
    IF v_supabase_url IS NULL OR v_supabase_anon_key IS NULL THEN
      RAISE WARNING 'AWIGN notification skipped: Supabase URL or anon key not configured. URL: %, Key: %', 
        v_supabase_url, CASE WHEN v_supabase_anon_key IS NULL THEN 'NULL' ELSE 'SET' END;
      RETURN NEW;
    END IF;
    
    -- Construct edge function URL
    v_edge_function_url := v_supabase_url || '/functions/v1/update-awign-lead-status';
    
    -- Build request body as JSONB (not TEXT!)
    v_request_body := jsonb_build_object(
      'caseId', NEW.id::TEXT,
      'clientCaseId', NEW.client_case_id,
      'status', NEW.status::TEXT
    );
    
    -- Call the edge function asynchronously using pg_net
    -- IMPORTANT: body must be jsonb, not text!
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
        PERFORM net.http_post(
          url := v_edge_function_url,
          body := v_request_body,  -- JSONB, not TEXT!
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_supabase_anon_key,
            'apikey', v_supabase_anon_key
          )
        );
        RAISE NOTICE 'AWIGN notification sent for case % (client_case_id: %)', NEW.id, NEW.client_case_id;
      ELSE
        RAISE WARNING 'AWIGN notification skipped: pg_net extension not available';
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

-- Verify the function was updated
SELECT 'AWIGN trigger function updated successfully' AS status;

