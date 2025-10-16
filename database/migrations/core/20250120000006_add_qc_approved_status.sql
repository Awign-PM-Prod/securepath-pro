-- =====================================================
-- Add qc_approved status to case_status enum
-- Background Verification Platform - Phase 1
-- =====================================================

-- Add qc_approved to the case_status enum
ALTER TYPE public.case_status ADD VALUE 'qc_approved' AFTER 'qc_passed';

-- Update any existing qc_passed cases to qc_approved
UPDATE public.cases 
SET status = 'qc_approved' 
WHERE status = 'qc_passed';

-- Update submission_status enum as well
ALTER TYPE public.submission_status ADD VALUE 'qc_approved' AFTER 'qc_passed';

-- Update any existing qc_passed submissions to qc_approved
UPDATE public.submissions 
SET status = 'qc_approved' 
WHERE status = 'qc_passed';
