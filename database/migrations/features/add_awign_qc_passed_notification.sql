-- =====================================================
-- Add AWIGN API QC Passed Status Notification
-- =====================================================
-- This migration extends the AWIGN integration to notify the API
-- when API-sourced cases transition to 'qc_passed' status.
--
-- Prerequisites:
-- 1. pg_net extension must be enabled (for calling edge functions)
-- 2. Supabase URL and anon key must be configured (via system_configs)
-- 3. Edge function 'update-awign-lead-completion' must be deployed
-- 4. AWIGN API credentials must be set as edge function secrets
-- 5. Report URL must be generated before status reaches qc_passed
--
-- =====================================================

-- Update the trigger function to handle both in_progress and qc_passed statuses
-- This replaces the function with the updated version that handles qc_passed status
CREATE OR REPLACE FUNCTION public.notify_awign_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_supabase_url TEXT;
  v_supabase_anon_key TEXT;
  v_edge_function_url TEXT;
  v_request_body JSONB;
  -- Additional variables for qc_passed status
  v_contract_type TEXT;
  v_is_positive BOOLEAN;
  v_report_url TEXT;
  v_submitted_at TIMESTAMP WITH TIME ZONE;
  v_allocated_at TIMESTAMP WITH TIME ZONE;
  v_qc_comments TEXT;
BEGIN
  -- Handle in_progress status (existing logic)
  IF NEW.source = 'api' 
     AND NEW.status = 'in_progress' 
     AND (OLD.status IS NULL OR OLD.status != 'in_progress')
     AND NEW.client_case_id IS NOT NULL THEN
    
    -- Get Supabase URL and anon key from system_configs table
    BEGIN
      SELECT config_value->>'value' INTO v_supabase_url
      FROM public.system_configs
      WHERE config_key = 'supabase_url'
        AND config_category = 'awign_integration'
        AND is_active = true
        AND (effective_until IS NULL OR effective_until >= now())
      LIMIT 1;
      
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
        RAISE WARNING 'Error reading system_configs: %', SQLERRM;
    END;
    
    IF v_supabase_url IS NULL OR v_supabase_anon_key IS NULL THEN
      RAISE WARNING 'AWIGN notification skipped: Supabase URL or anon key not configured. Case ID: %, Client Case ID: %', NEW.id, NEW.client_case_id;
      RETURN NEW;
    END IF;
    
    v_edge_function_url := v_supabase_url || '/functions/v1/update-awign-lead-status';
    
    v_request_body := jsonb_build_object(
      'caseId', NEW.id::TEXT,
      'clientCaseId', NEW.client_case_id,
      'status', NEW.status::TEXT
    );
    
    BEGIN
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
        RAISE WARNING 'AWIGN notification skipped: pg_net extension not available. Case ID: %, Client Case ID: %', NEW.id, NEW.client_case_id;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to notify AWIGN API for case % (client_case_id: %): %', NEW.id, NEW.client_case_id, SQLERRM;
    END;
  END IF;
  
  -- Handle qc_passed status (new logic)
  IF NEW.source = 'api' 
     AND NEW.status = 'qc_passed' 
     AND (OLD.status IS NULL OR OLD.status != 'qc_passed')
     AND NEW.client_case_id IS NOT NULL 
     AND NEW.report_url IS NOT NULL THEN
    
    -- Get Supabase URL and anon key from system_configs table
    BEGIN
      SELECT config_value->>'value' INTO v_supabase_url
      FROM public.system_configs
      WHERE config_key = 'supabase_url'
        AND config_category = 'awign_integration'
        AND is_active = true
        AND (effective_until IS NULL OR effective_until >= now())
      LIMIT 1;
      
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
        RAISE WARNING 'Error reading system_configs: %', SQLERRM;
    END;
    
    IF v_supabase_url IS NULL OR v_supabase_anon_key IS NULL THEN
      RAISE WARNING 'AWIGN notification skipped: Supabase URL or anon key not configured. Case ID: %, Client Case ID: %', NEW.id, NEW.client_case_id;
      RETURN NEW;
    END IF;
    
    -- Get additional case data needed for qc_passed API call
    BEGIN
      v_contract_type := NEW.contract_type;
      v_is_positive := COALESCE(NEW.is_positive, true);
      v_report_url := NEW.report_url;
      v_submitted_at := COALESCE(NEW.submitted_at, NEW.status_updated_at);
      
      -- Get allocated_at from allocation_logs (most recent accepted allocation)
      SELECT accepted_at INTO v_allocated_at
      FROM public.allocation_logs
      WHERE case_id = NEW.id
        AND decision = 'accepted'
        AND accepted_at IS NOT NULL
      ORDER BY accepted_at DESC
      LIMIT 1;
      
      -- Fallback to vendor_tat_start_date if no allocation log found
      IF v_allocated_at IS NULL THEN
        v_allocated_at := NEW.vendor_tat_start_date;
      END IF;
      
      -- Get QC comments from most recent pass review
      SELECT comments INTO v_qc_comments
      FROM public.qc_reviews
      WHERE case_id = NEW.id
        AND result = 'pass'
        AND comments IS NOT NULL
        AND comments != ''
      ORDER BY reviewed_at DESC, created_at DESC
      LIMIT 1;
      
      -- Fallback to default message if no QC comments
      IF v_qc_comments IS NULL OR v_qc_comments = '' THEN
        v_qc_comments := 'Completed the verification';
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Error fetching case data for AWIGN notification: %', SQLERRM;
        -- Use fallback values
        v_contract_type := COALESCE(NEW.contract_type, 'residential_address_check');
        v_is_positive := COALESCE(NEW.is_positive, true);
        v_report_url := NEW.report_url;
        v_submitted_at := COALESCE(NEW.submitted_at, NEW.status_updated_at);
        v_allocated_at := COALESCE(NEW.vendor_tat_start_date, NEW.created_at);
        v_qc_comments := 'Completed the verification';
    END;
    
    -- Construct edge function URL for completion
    v_edge_function_url := v_supabase_url || '/functions/v1/update-awign-lead-completion';
    
    -- Build request body with all required data
    v_request_body := jsonb_build_object(
      'caseId', NEW.id::TEXT,
      'clientCaseId', NEW.client_case_id,
      'contractType', v_contract_type,
      'isPositive', v_is_positive,
      'allocatedAt', v_allocated_at::TEXT,
      'submittedAt', v_submitted_at::TEXT,
      'reportUrl', v_report_url,
      'qcComments', v_qc_comments
    );
    
    -- Call the edge function asynchronously using pg_net
    BEGIN
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
        RAISE WARNING 'AWIGN notification skipped: pg_net extension not available. Case ID: %, Client Case ID: %', NEW.id, NEW.client_case_id;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to notify AWIGN API for case % (client_case_id: %): %', NEW.id, NEW.client_case_id, SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists (to allow re-running migration)
DROP TRIGGER IF EXISTS cases_notify_awign_trigger ON public.cases;
DROP TRIGGER IF EXISTS cases_notify_awign_qc_passed_trigger ON public.cases;

-- Create trigger for in_progress status (existing functionality)
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

-- Create trigger for qc_passed status (new functionality)
CREATE TRIGGER cases_notify_awign_qc_passed_trigger
  AFTER UPDATE OF status ON public.cases
  FOR EACH ROW
  WHEN (
    NEW.source = 'api' 
    AND NEW.status = 'qc_passed' 
    AND (OLD.status IS NULL OR OLD.status != 'qc_passed')
    AND NEW.client_case_id IS NOT NULL
    AND NEW.report_url IS NOT NULL
  )
  EXECUTE FUNCTION public.notify_awign_on_status_change();

-- Grant execute permission (if not already granted)
GRANT EXECUTE ON FUNCTION public.notify_awign_on_status_change() TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.notify_awign_on_status_change() IS 'Notifies AWIGN API when API-sourced cases transition to in_progress or qc_passed status by calling the appropriate edge function';

-- Migration complete
SELECT 'AWIGN qc_passed status notification trigger created successfully. Ensure edge function update-awign-lead-completion is deployed.' AS status;

