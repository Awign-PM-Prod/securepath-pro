-- =====================================================
-- Update qc_reviews table to support form_submissions
-- Background Verification Platform - Phase 1
-- =====================================================

-- Make submission_id nullable and add form_submission_id
ALTER TABLE public.qc_reviews 
ALTER COLUMN submission_id DROP NOT NULL;

-- Add form_submission_id column
ALTER TABLE public.qc_reviews 
ADD COLUMN form_submission_id UUID REFERENCES public.form_submissions(id) ON DELETE CASCADE;

-- Add check constraint to ensure at least one submission reference exists
ALTER TABLE public.qc_reviews 
ADD CONSTRAINT qc_reviews_submission_check 
CHECK (submission_id IS NOT NULL OR form_submission_id IS NOT NULL);

-- Add index for form_submission_id
CREATE INDEX idx_qc_reviews_form_submission_id ON public.qc_reviews(form_submission_id);

