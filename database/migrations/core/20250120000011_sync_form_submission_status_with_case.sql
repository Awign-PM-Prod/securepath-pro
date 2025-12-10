-- =====================================================
-- Sync form_submissions.status with cases.status
-- =====================================================
-- This trigger ensures form_submissions.status is always in sync with cases.status:
-- - NULL: Before in_progress
-- - 'draft': When case status = 'in_progress'
-- - 'final': When case status = 'submitted' (and never changes after)

-- Create trigger function to update form_submissions.status based on case status
CREATE OR REPLACE FUNCTION public.sync_form_submission_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Update form_submissions status based on case status
    IF NEW.status = 'in_progress' THEN
      -- Set to draft when case goes to in_progress (only if not already final)
      UPDATE public.form_submissions
      SET status = 'draft',
          updated_at = now()
      WHERE case_id = NEW.id
        AND status != 'final';
        
    ELSIF NEW.status = 'submitted' THEN
      -- Set to final when case goes to submitted (only if not already final)
      UPDATE public.form_submissions
      SET status = 'final',
          updated_at = now(),
          submitted_at = COALESCE(submitted_at, now())
      WHERE case_id = NEW.id
        AND status != 'final';
        
    ELSIF NEW.status NOT IN ('in_progress', 'submitted') THEN
      -- Set to NULL for all other statuses (but don't change if already final)
      UPDATE public.form_submissions
      SET status = NULL,
          updated_at = now()
      WHERE case_id = NEW.id
        AND status != 'final';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS sync_form_submission_status_trigger ON public.cases;

-- Create trigger on cases table
CREATE TRIGGER sync_form_submission_status_trigger
  AFTER UPDATE OF status ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_form_submission_status();

-- Add comment
COMMENT ON FUNCTION public.sync_form_submission_status() IS 'Syncs form_submissions.status with cases.status: NULL before in_progress, draft when in_progress, final when submitted (and never changes after)';

