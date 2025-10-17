-- =====================================================
-- Update QC response handling to include QC_Response column
-- Background Verification Platform - Phase 1
-- =====================================================

-- Update the process_qc_review function to include QC_Response column updates
CREATE OR REPLACE FUNCTION public.process_qc_review(
  p_qc_review_id UUID,
  p_result TEXT
) RETURNS VOID AS $$
DECLARE
  review_record RECORD;
  case_id UUID;
  submission_id UUID;
  workflow_id UUID;
  qc_response_value public."QC_Response";
BEGIN
  -- Get review details
  SELECT qr.*, s.case_id, s.id as submission_id
  INTO review_record
  FROM public.qc_reviews qr
  JOIN public.submissions s ON qr.submission_id = s.id
  WHERE qr.id = p_qc_review_id;
  
  case_id := review_record.case_id;
  submission_id := review_record.submission_id;
  
  -- Map QC result to QC_Response enum value
  qc_response_value := CASE p_result
    WHEN 'pass' THEN 'Approved'::public."QC_Response"
    WHEN 'reject' THEN 'Rejected'::public."QC_Response"
    WHEN 'rework' THEN 'Rework'::public."QC_Response"
    ELSE 'New'::public."QC_Response"
  END;
  
  -- Update case status based on QC result
  IF p_result = 'pass' THEN
    UPDATE public.cases 
    SET 
      status = 'qc_passed',
      status_updated_at = now(),
      updated_at = now(),
      "QC_Response" = qc_response_value
    WHERE id = case_id;
    
    -- Update submission status
    UPDATE public.submissions 
    SET 
      status = 'qc_passed',
      updated_at = now()
    WHERE id = submission_id;
    
  ELSIF p_result = 'reject' THEN
    UPDATE public.cases 
    SET 
      status = 'qc_rejected',
      status_updated_at = now(),
      updated_at = now(),
      "QC_Response" = qc_response_value
    WHERE id = case_id;
    
    -- Update submission status
    UPDATE public.submissions 
    SET 
      status = 'qc_rejected',
      updated_at = now()
    WHERE id = submission_id;
    
  ELSIF p_result = 'rework' THEN
    UPDATE public.cases 
    SET 
      status = 'qc_rework',
      status_updated_at = now(),
      updated_at = now(),
      "QC_Response" = qc_response_value
    WHERE id = case_id;
    
    -- Update submission status
    UPDATE public.submissions 
    SET 
      status = 'qc_rework',
      updated_at = now()
    WHERE id = submission_id;
  END IF;
  
  -- Update QC workflow
  UPDATE public.qc_workflow 
  SET 
    current_stage = p_result::TEXT,
    completed_at = now(),
    updated_at = now()
  WHERE case_id = case_id AND is_active = true;
  
  -- If rework, create new workflow entry
  IF p_result = 'rework' THEN
    PERFORM public.create_qc_workflow(case_id, submission_id);
  END IF;
END;
$$ LANGUAGE plpgsql;
