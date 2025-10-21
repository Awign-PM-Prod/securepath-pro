-- =====================================================
-- Create new case_status_v2 enum and update tables
-- Background Verification Platform - Phase 1
-- =====================================================

-- First, let's check current enum values and data
SELECT 'Current case_status enum values:' as info;
SELECT unnest(enum_range(NULL::case_status)) as current_values;

SELECT 'Current case status distribution:' as info;
SELECT status, COUNT(*) as count 
FROM public.cases 
GROUP BY status 
ORDER BY count DESC;

-- Step 1: Create the new enum with a different name
CREATE TYPE public.case_status_v2 AS ENUM (
  'new',
  'allocated', 
  'pending_allocation',
  'accepted',
  'rejected',
  'in_progress',
  'submitted',
  'qc_passed',
  'qc_rejected',
  'qc_rework',
  'completed',
  'reported',
  'in_payment_cycle',
  'payment_complete',
  'cancelled'
);

-- Step 2: Add a new column with the new enum type
ALTER TABLE public.cases ADD COLUMN status_v2 public.case_status_v2;

-- Step 3: Map old statuses to new statuses (using text comparison to avoid enum issues)
UPDATE public.cases 
SET status_v2 = CASE 
  WHEN status::text = 'created' THEN 'new'::case_status_v2
  WHEN status::text = 'auto_allocated' THEN 'allocated'::case_status_v2
  WHEN status::text = 'pending_acceptance' THEN 'pending_allocation'::case_status_v2
  WHEN status::text = 'qc_approved' THEN 'qc_passed'::case_status_v2
  WHEN status::text = 'qc_review' THEN 'qc_passed'::case_status_v2
  WHEN status::text = 'draft' THEN 'new'::case_status_v2
  WHEN status::text = 'accepted' THEN 'accepted'::case_status_v2
  WHEN status::text = 'rejected' THEN 'rejected'::case_status_v2
  WHEN status::text = 'in_progress' THEN 'in_progress'::case_status_v2
  WHEN status::text = 'submitted' THEN 'submitted'::case_status_v2
  WHEN status::text = 'completed' THEN 'completed'::case_status_v2
  WHEN status::text = 'cancelled' THEN 'cancelled'::case_status_v2
  ELSE 'new'::case_status_v2
END;

-- Step 4: Drop the old status column
ALTER TABLE public.cases DROP COLUMN status;

-- Step 5: Rename the new column to status
ALTER TABLE public.cases RENAME COLUMN status_v2 TO status;

-- Step 6: Add the new default constraint
ALTER TABLE public.cases ALTER COLUMN status SET DEFAULT 'new'::case_status_v2;

-- Step 7: Rename the enum type
ALTER TYPE public.case_status_v2 RENAME TO case_status;

-- Verify the changes
SELECT 'Updated case_status enum values:' as info;
SELECT unnest(enum_range(NULL::case_status)) as new_values;

-- Show final case status distribution
SELECT 'Final case status distribution:' as info;
SELECT status, COUNT(*) as count 
FROM public.cases 
GROUP BY status 
ORDER BY count DESC;
