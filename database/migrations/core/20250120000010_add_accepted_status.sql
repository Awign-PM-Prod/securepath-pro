-- =====================================================
-- Add 'accepted' status to case_status_v3 enum
-- Background Verification Platform - Phase 1
-- =====================================================

-- Add the new 'accepted' status to the existing enum
ALTER TYPE public.case_status_v3 ADD VALUE 'accepted' AFTER 'allocated';

-- Update the comment to reflect the new status
COMMENT ON TYPE public.case_status_v3 IS 'Updated case status enum with streamlined workflow statuses for the background verification platform. Accepted status represents when a worker/vendor accepts an allocated case.';
