-- =====================================================
-- Triggers to Update Gig Worker Metrics Automatically
-- Background Verification Platform
-- =====================================================
-- These triggers automatically update gig_worker_metrics table
-- when cases are allocated, accepted, submitted, or QC passed
-- =====================================================

-- Function to update cases_allocated_count when a case is allocated
CREATE OR REPLACE FUNCTION public.update_gig_worker_metrics_on_allocation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if candidate_type is 'gig'
  IF NEW.candidate_type = 'gig' AND NEW.allocated_at IS NOT NULL THEN
    -- Insert or update the metrics record
    INSERT INTO public.gig_worker_metrics (
      gig_worker_id,
      gig_worker_name,
      cases_allocated_count,
      last_updated_at
    )
    SELECT 
      NEW.candidate_id,
      CONCAT(p.first_name, ' ', p.last_name),
      1, -- Will be recalculated properly below
      now()
    FROM public.gig_partners gp
    LEFT JOIN public.profiles p ON gp.profile_id = p.id
    WHERE gp.id = NEW.candidate_id
    ON CONFLICT (gig_worker_id) 
    DO UPDATE SET
      cases_allocated_count = gig_worker_metrics.cases_allocated_count + 1,
      last_updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update cases_accepted_count when a case is accepted
CREATE OR REPLACE FUNCTION public.update_gig_worker_metrics_on_acceptance()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if candidate_type is 'gig' and case was just accepted
  IF NEW.candidate_type = 'gig' 
     AND (NEW.decision = 'accepted' OR NEW.accepted_at IS NOT NULL)
     AND (OLD.decision != 'accepted' AND OLD.accepted_at IS NULL) THEN
    -- Update the metrics record
    UPDATE public.gig_worker_metrics
    SET 
      cases_accepted_count = cases_accepted_count + 1,
      last_updated_at = now()
    WHERE gig_worker_id = NEW.candidate_id;
    
    -- If record doesn't exist, create it
    IF NOT FOUND THEN
      INSERT INTO public.gig_worker_metrics (
        gig_worker_id,
        gig_worker_name,
        cases_accepted_count,
        last_updated_at
      )
      SELECT 
        NEW.candidate_id,
        CONCAT(p.first_name, ' ', p.last_name),
        1,
        now()
      FROM public.gig_partners gp
      LEFT JOIN public.profiles p ON gp.profile_id = p.id
      WHERE gp.id = NEW.candidate_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update cases_submitted_count when a case is submitted
CREATE OR REPLACE FUNCTION public.update_gig_worker_metrics_on_submission()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if assignee is a gig worker and status changed to submitted or beyond
  IF NEW.current_assignee_type = 'gig' 
     AND NEW.current_assignee_id IS NOT NULL
     AND NEW.status IN ('submitted', 'qc_passed', 'qc_rejected', 'qc_rework', 'reported', 'in_payment_cycle', 'payment_complete')
     AND (OLD.status NOT IN ('submitted', 'qc_passed', 'qc_rejected', 'qc_rework', 'reported', 'in_payment_cycle', 'payment_complete')
          OR OLD.current_assignee_id != NEW.current_assignee_id) THEN
    -- Update the metrics record
    UPDATE public.gig_worker_metrics
    SET 
      cases_submitted_count = cases_submitted_count + 1,
      last_updated_at = now()
    WHERE gig_worker_id = NEW.current_assignee_id;
    
    -- If record doesn't exist, create it
    IF NOT FOUND THEN
      INSERT INTO public.gig_worker_metrics (
        gig_worker_id,
        gig_worker_name,
        cases_submitted_count,
        last_updated_at
      )
      SELECT 
        NEW.current_assignee_id,
        CONCAT(p.first_name, ' ', p.last_name),
        1,
        now()
      FROM public.gig_partners gp
      LEFT JOIN public.profiles p ON gp.profile_id = p.id
      WHERE gp.id = NEW.current_assignee_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update cases_qc_passed_count when a case passes QC
CREATE OR REPLACE FUNCTION public.update_gig_worker_metrics_on_qc_pass()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if assignee is a gig worker and status changed to qc_passed
  IF NEW.current_assignee_type = 'gig' 
     AND NEW.current_assignee_id IS NOT NULL
     AND NEW.status = 'qc_passed'
     AND OLD.status != 'qc_passed' THEN
    -- Update the metrics record
    UPDATE public.gig_worker_metrics
    SET 
      cases_qc_passed_count = cases_qc_passed_count + 1,
      last_updated_at = now()
    WHERE gig_worker_id = NEW.current_assignee_id;
    
    -- If record doesn't exist, create it
    IF NOT FOUND THEN
      INSERT INTO public.gig_worker_metrics (
        gig_worker_id,
        gig_worker_name,
        cases_qc_passed_count,
        last_updated_at
      )
      SELECT 
        NEW.current_assignee_id,
        CONCAT(p.first_name, ' ', p.last_name),
        1,
        now()
      FROM public.gig_partners gp
      LEFT JOIN public.profiles p ON gp.profile_id = p.id
      WHERE gp.id = NEW.current_assignee_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_update_metrics_on_allocation ON public.allocation_logs;
CREATE TRIGGER trigger_update_metrics_on_allocation
  AFTER INSERT ON public.allocation_logs
  FOR EACH ROW
  WHEN (NEW.candidate_type = 'gig' AND NEW.allocated_at IS NOT NULL)
  EXECUTE FUNCTION public.update_gig_worker_metrics_on_allocation();

DROP TRIGGER IF EXISTS trigger_update_metrics_on_acceptance ON public.allocation_logs;
CREATE TRIGGER trigger_update_metrics_on_acceptance
  AFTER UPDATE ON public.allocation_logs
  FOR EACH ROW
  WHEN (NEW.candidate_type = 'gig' 
        AND (NEW.decision = 'accepted' OR NEW.accepted_at IS NOT NULL)
        AND (OLD.decision != 'accepted' AND OLD.accepted_at IS NULL))
  EXECUTE FUNCTION public.update_gig_worker_metrics_on_acceptance();

DROP TRIGGER IF EXISTS trigger_update_metrics_on_submission ON public.cases;
CREATE TRIGGER trigger_update_metrics_on_submission
  AFTER UPDATE ON public.cases
  FOR EACH ROW
  WHEN (NEW.current_assignee_type = 'gig' 
        AND NEW.status IN ('submitted', 'qc_passed', 'qc_rejected', 'qc_rework', 'reported', 'in_payment_cycle', 'payment_complete')
        AND (OLD.status NOT IN ('submitted', 'qc_passed', 'qc_rejected', 'qc_rework', 'reported', 'in_payment_cycle', 'payment_complete')
             OR OLD.current_assignee_id != NEW.current_assignee_id))
  EXECUTE FUNCTION public.update_gig_worker_metrics_on_submission();

DROP TRIGGER IF EXISTS trigger_update_metrics_on_qc_pass ON public.cases;
CREATE TRIGGER trigger_update_metrics_on_qc_pass
  AFTER UPDATE ON public.cases
  FOR EACH ROW
  WHEN (NEW.current_assignee_type = 'gig' 
        AND NEW.status = 'qc_passed'
        AND OLD.status != 'qc_passed')
  EXECUTE FUNCTION public.update_gig_worker_metrics_on_qc_pass();

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.update_gig_worker_metrics_on_allocation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_gig_worker_metrics_on_acceptance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_gig_worker_metrics_on_submission() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_gig_worker_metrics_on_qc_pass() TO authenticated;

