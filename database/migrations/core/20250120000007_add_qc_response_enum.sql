-- =====================================================
-- Add QC_Response enum type
-- Background Verification Platform - Phase 1
-- =====================================================

-- Create QC_Response enum type
CREATE TYPE public."QC_Response" AS ENUM (
  'Rework',
  'Approved', 
  'Rejected',
  'New'
);

-- Add QC_Response column to cases table if it doesn't exist
-- (This should already be done based on the schema provided)
-- ALTER TABLE public.cases ADD COLUMN "QC_Response" public."QC_Response" DEFAULT 'New'::"QC_Response";

-- Update the default value to ensure it's set correctly
ALTER TABLE public.cases ALTER COLUMN "QC_Response" SET DEFAULT 'New'::"QC_Response";

-- Create index for QC_Response column for better query performance
CREATE INDEX IF NOT EXISTS idx_cases_qc_response ON public.cases("QC_Response");
