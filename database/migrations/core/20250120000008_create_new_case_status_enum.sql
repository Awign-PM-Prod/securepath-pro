-- =====================================================
-- Create new case_status_v3 enum with updated statuses
-- Background Verification Platform - Phase 1
-- =====================================================

-- Create the new enum with the specified statuses
CREATE TYPE public.case_status_v3 AS ENUM (
  'new',                    -- When the case is created from ops
  'allocated',              -- When the case is allocated to a worker/vendor
  'pending_allocation',     -- When the assigned vendor/worker rejects the case or doesn't choose within the 30 minute timer
  'in_progress',            -- When the form is saved as a draft
  'submitted',              -- When the form is submitted by the gig worker
  'qc_passed',              -- When QC approves the case
  'qc_rejected',            -- When QC rejects the case
  'qc_rework',              -- When QC asks for rework on the case
  'reported',               -- When the ops download the csv file for the submitted form
  'in_payment_cycle',       -- When the case enters the payment cycle
  'payment_complete',       -- When the worker is paid
  'cancelled'               -- When the case payment was cancelled
);

-- Add a new column with the new enum type to the cases table
ALTER TABLE public.cases ADD COLUMN status_v3 public.case_status_v3;

-- Create an index on the new status column for better query performance
CREATE INDEX idx_cases_status_v3 ON public.cases(status_v3);

-- Add a comment to document the new enum
COMMENT ON TYPE public.case_status_v3 IS 'Updated case status enum with streamlined workflow statuses for the background verification platform';
