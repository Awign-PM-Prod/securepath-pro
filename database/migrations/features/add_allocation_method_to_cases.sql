-- =====================================================
-- Add allocation_method field to cases table
-- Background Verification Platform
-- =====================================================

-- Create enum for allocation method
CREATE TYPE public.allocation_method AS ENUM (
  'auto',
  'manual'
);

-- Add allocation_method column to cases table
ALTER TABLE public.cases 
ADD COLUMN allocation_method public.allocation_method;

-- Add comment for documentation
COMMENT ON COLUMN public.cases.allocation_method IS 'Indicates whether the case was allocated automatically by the allocation engine or manually by ops team';

-- Create index for better query performance
CREATE INDEX idx_cases_allocation_method ON public.cases(allocation_method);

-- Update existing cases based on allocation_logs
-- Cases with manual_allocation=true in score_snapshot are manual, others are auto
UPDATE public.cases c
SET allocation_method = CASE
  WHEN EXISTS (
    SELECT 1 
    FROM public.allocation_logs al 
    WHERE al.case_id = c.id 
      AND al.decision = 'allocated'
      AND al.score_snapshot->>'manual_allocation' = 'true'
  ) THEN 'manual'::public.allocation_method
  WHEN EXISTS (
    SELECT 1 
    FROM public.allocation_logs al 
    WHERE al.case_id = c.id 
      AND al.decision = 'allocated'
  ) THEN 'auto'::public.allocation_method
  ELSE NULL
END
WHERE c.status IN ('allocated', 'accepted', 'in_progress', 'submitted', 'qc_passed', 'qc_rejected', 'qc_rework', 'reported', 'completed', 'in_payment_cycle', 'payment_complete');




