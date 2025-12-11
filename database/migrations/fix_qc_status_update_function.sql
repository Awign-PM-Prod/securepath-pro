-- =====================================================
-- Fix QC Status Update - Direct Function
-- =====================================================
-- This function ensures case status can be updated to qc_passed
-- without trigger interference

CREATE OR REPLACE FUNCTION public.update_case_qc_status(
  p_case_id UUID,
  p_status TEXT,
  p_qc_response public."QC_Response"
)
RETURNS BOOLEAN AS $$
BEGIN
  -- First, ensure form_submissions.status is 'final' to prevent trigger issues
  UPDATE public.form_submissions
  SET status = 'final',
      updated_at = now()
  WHERE case_id = p_case_id
    AND status IS DISTINCT FROM 'final';
  
  -- Now update the case status
  UPDATE public.cases
  SET 
    status = p_status::case_status,
    "QC_Response" = p_qc_response,
    status_updated_at = now(),
    updated_at = now()
  WHERE id = p_case_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to update case QC status: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.update_case_qc_status(UUID, TEXT, public."QC_Response") TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.update_case_qc_status(UUID, TEXT, public."QC_Response") IS 'Updates case status to QC status (qc_passed, qc_rejected, qc_rework) and ensures form_submissions.status is final';

