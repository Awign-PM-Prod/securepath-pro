-- =====================================================
-- Fix form_submissions status trigger for QC statuses
-- =====================================================
-- The trigger was trying to set form_submissions.status to NULL
-- when case status changes to post-submission statuses (qc_passed, qc_rejected, etc.),
-- but form_submissions.status has a NOT NULL constraint.
-- 
-- Fix: Once form_submissions.status is 'final', it should never change.
-- Post-submission statuses should not affect form_submissions.status.

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
      
      -- Also set submitted_at in cases table if not already set
      IF NEW.submitted_at IS NULL THEN
        UPDATE public.cases
        SET submitted_at = now()
        WHERE id = NEW.id;
      END IF;
        
    -- For all other statuses (including post-submission statuses like qc_passed, qc_rejected, etc.),
    -- ensure form_submissions.status is 'final' if it's not already.
    -- Post-submission statuses should not affect form_submissions.status if it's already 'final',
    -- but if it's not 'final' (edge case), set it to 'final' to avoid NULL constraint issues.
    ELSIF NEW.status NOT IN ('in_progress', 'submitted') THEN
      -- For post-submission statuses, ensure form_submissions.status is 'final'
      -- This handles edge cases and prevents NULL constraint violations
      UPDATE public.form_submissions
      SET status = 'final',
          updated_at = now()
      WHERE case_id = NEW.id
        AND status IS DISTINCT FROM 'final';
      -- Note: We set status to 'final' (never NULL) to avoid NOT NULL constraint violation
      -- If status is already 'final', the WHERE clause prevents unnecessary updates
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update comment to reflect the fix
COMMENT ON FUNCTION public.sync_form_submission_status() IS 'Syncs form_submissions.status with cases.status: NULL before in_progress, draft when in_progress, final when submitted (and never changes after, even for post-submission statuses like qc_passed)';

