-- Fix: Update handle_submission_created function to use 'submitted' instead of 'qc_pending'
-- The 'qc_pending' status no longer exists in the case_status enum

-- Update the existing trigger function for old submissions table
CREATE OR REPLACE FUNCTION public.handle_submission_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Create QC workflow entry
  PERFORM public.create_qc_workflow(NEW.case_id, NEW.id);
  
  -- Update case status to submitted (qc_pending no longer exists in enum)
  UPDATE public.cases 
  SET 
    status = 'submitted',
    status_updated_at = now(),
    updated_at = now()
  WHERE id = NEW.case_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for form_submissions table
CREATE OR REPLACE FUNCTION public.handle_form_submission_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Create QC workflow entry
  PERFORM public.create_qc_workflow(NEW.case_id, NEW.id);
  
  -- Update case status to submitted
  UPDATE public.cases 
  SET 
    status = 'submitted',
    status_updated_at = now(),
    updated_at = now()
  WHERE id = NEW.case_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for form_submissions updates (when draft becomes final)
CREATE OR REPLACE FUNCTION public.handle_form_submission_updated()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if status changed from draft to final
  IF OLD.status = 'draft' AND NEW.status = 'final' THEN
    -- Create QC workflow entry if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM public.qc_workflow 
      WHERE case_id = NEW.case_id AND is_active = true
    ) THEN
      PERFORM public.create_qc_workflow(NEW.case_id, NEW.id);
    END IF;
    
    -- Update case status to submitted
    UPDATE public.cases 
    SET 
      status = 'submitted',
      status_updated_at = now(),
      updated_at = now()
    WHERE id = NEW.case_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on form_submissions table for INSERT (if it doesn't exist)
DROP TRIGGER IF EXISTS handle_form_submission_created_trigger ON public.form_submissions;

CREATE TRIGGER handle_form_submission_created_trigger
  AFTER INSERT ON public.form_submissions
  FOR EACH ROW
  WHEN (NEW.status = 'final')  -- Only trigger for final submissions, not drafts
  EXECUTE FUNCTION public.handle_form_submission_created();

-- Create trigger on form_submissions table for UPDATE (when draft becomes final)
DROP TRIGGER IF EXISTS handle_form_submission_updated_trigger ON public.form_submissions;

CREATE TRIGGER handle_form_submission_updated_trigger
  AFTER UPDATE ON public.form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_form_submission_updated();

