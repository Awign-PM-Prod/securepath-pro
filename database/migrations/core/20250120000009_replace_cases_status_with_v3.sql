-- =====================================================
-- Replace cases.status with case_status_v3 enum
-- Background Verification Platform - Phase 1
-- =====================================================

-- Step 1: Check current case status distribution
SELECT 'Current case status distribution:' as info;
SELECT status, COUNT(*) as count 
FROM public.cases 
GROUP BY status 
ORDER BY count DESC;

-- Step 2: Map old statuses to new case_status_v3 values
UPDATE public.cases 
SET status_v3 = CASE 
  -- Direct mappings
  WHEN status::text = 'created' THEN 'new'::case_status_v3
  WHEN status::text = 'auto_allocated' THEN 'allocated'::case_status_v3
  WHEN status::text = 'pending_acceptance' THEN 'pending_allocation'::case_status_v3
  WHEN status::text = 'accepted' THEN 'allocated'::case_status_v3  -- accepted cases are allocated
  WHEN status::text = 'rejected' THEN 'pending_allocation'::case_status_v3  -- rejected goes back to pending
  WHEN status::text = 'in_progress' THEN 'in_progress'::case_status_v3
  WHEN status::text = 'submitted' THEN 'submitted'::case_status_v3
  WHEN status::text = 'qc_pending' THEN 'submitted'::case_status_v3  -- qc_pending is still submitted
  WHEN status::text = 'qc_passed' THEN 'qc_passed'::case_status_v3
  WHEN status::text = 'qc_approved' THEN 'qc_passed'::case_status_v3  -- qc_approved maps to qc_passed
  WHEN status::text = 'qc_rejected' THEN 'qc_rejected'::case_status_v3
  WHEN status::text = 'qc_rework' THEN 'qc_rework'::case_status_v3
  WHEN status::text = 'completed' THEN 'reported'::case_status_v3  -- completed maps to reported
  WHEN status::text = 'reported' THEN 'reported'::case_status_v3
  WHEN status::text = 'in_payment_cycle' THEN 'in_payment_cycle'::case_status_v3
  WHEN status::text = 'cancelled' THEN 'cancelled'::case_status_v3
  -- Default fallback
  ELSE 'new'::case_status_v3
END;

-- Step 3: Verify the mapping
SELECT 'Status mapping verification:' as info;
SELECT 
  status as old_status,
  status_v3 as new_status,
  COUNT(*) as count
FROM public.cases 
GROUP BY status, status_v3
ORDER BY count DESC;

-- Step 4: Drop the old status column
ALTER TABLE public.cases DROP COLUMN status;

-- Step 5: Rename status_v3 to status
ALTER TABLE public.cases RENAME COLUMN status_v3 TO status;

-- Step 6: Set the new default value
ALTER TABLE public.cases ALTER COLUMN status SET DEFAULT 'new'::case_status_v3;

-- Step 7: Rename the enum type to case_status (replacing the old one)
-- First, drop the old case_status enum (this will fail if it's still in use)
-- We need to be careful here - let's rename it first
ALTER TYPE public.case_status RENAME TO case_status_old;

-- Now rename case_status_v3 to case_status
ALTER TYPE public.case_status_v3 RENAME TO case_status;

-- Step 8: Update the column to use the renamed enum
ALTER TABLE public.cases ALTER COLUMN status TYPE case_status USING status::text::case_status;

-- Step 9: Create index on the new status column
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.cases(status);

-- Step 10: Verify the final result
SELECT 'Final case status distribution:' as info;
SELECT status, COUNT(*) as count 
FROM public.cases 
GROUP BY status 
ORDER BY count DESC;

-- Step 11: Show the new enum values
SELECT 'New case_status enum values:' as info;
SELECT unnest(enum_range(NULL::case_status)) as case_status_values;

-- Step 12: Add comment to document the change
COMMENT ON COLUMN public.cases.status IS 'Case status using the unified case_status enum with streamlined workflow statuses';
