-- =====================================================
-- Update AWIGN Trigger Logging
-- Change RAISE NOTICE to RAISE WARNING so it shows in logs
-- =====================================================

CREATE OR REPLACE FUNCTION public.notify_awign_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_supabase_url TEXT;
  v_supabase_anon_key TEXT;
  v_edge_function_url TEXT;
  v_request_body JSONB;
BEGIN
  IF NEW.source = 'api' 
     AND NEW.status = 'in_progress' 
     AND (OLD.status IS NULL OR OLD.status != 'in_progress')
     AND NEW.client_case_id IS NOT NULL THEN
    
    -- Get config values
    BEGIN
      SELECT 
        COALESCE(config_value->>'value', config_value::TEXT) INTO v_supabase_url
      FROM public.system_configs
      WHERE config_key = 'supabase_url'
        AND config_category = 'awign_integration'
        AND is_active = true
        AND (effective_until IS NULL OR effective_until >= now())
      LIMIT 1;
      
      IF v_supabase_url IS NOT NULL AND v_supabase_url LIKE '"%"' THEN
        v_supabase_url := trim(both '"' from v_supabase_url);
      END IF;
      
      SELECT 
        COALESCE(config_value->>'value', config_value::TEXT) INTO v_supabase_anon_key
      FROM public.system_configs
      WHERE config_key = 'supabase_anon_key'
        AND config_category = 'awign_integration'
        AND is_active = true
        AND (effective_until IS NULL OR effective_until >= now())
      LIMIT 1;
      
      IF v_supabase_anon_key IS NOT NULL AND v_supabase_anon_key LIKE '"%"' THEN
        v_supabase_anon_key := trim(both '"' from v_supabase_anon_key);
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Error reading system_configs: %', SQLERRM;
    END;
    
    IF v_supabase_url IS NULL OR v_supabase_anon_key IS NULL THEN
      RAISE WARNING 'AWIGN notification skipped: Supabase URL or anon key not configured';
      RETURN NEW;
    END IF;
    
    v_edge_function_url := v_supabase_url || '/functions/v1/update-awign-lead-status';
    
    -- Build request body as JSONB
    v_request_body := jsonb_build_object(
      'caseId', NEW.id::TEXT,
      'clientCaseId', NEW.client_case_id,
      'status', NEW.status::TEXT
    );
    
    -- Call the edge function asynchronously using pg_net
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
        PERFORM net.http_post(
          url := v_edge_function_url,
          body := v_request_body,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_supabase_anon_key,
            'apikey', v_supabase_anon_key
          )
        );
        -- Use WARNING level so it shows in logs
        RAISE WARNING 'AWIGN notification sent for case % (client_case_id: %)', NEW.id, NEW.client_case_id;
      ELSE
        RAISE WARNING 'AWIGN notification skipped: pg_net extension not available';
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to notify AWIGN API for case % (client_case_id: %): %', NEW.id, NEW.client_case_id, SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

