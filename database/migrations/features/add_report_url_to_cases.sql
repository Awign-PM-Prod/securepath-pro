-- =====================================================
-- Add report_url column to cases table
-- This migration adds a column to store the public URL of generated PDF reports
-- for API-sourced cases
-- =====================================================

-- Add report_url column to cases table
ALTER TABLE public.cases 
ADD COLUMN IF NOT EXISTS report_url TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_cases_report_url ON public.cases(report_url) WHERE report_url IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.cases.report_url IS 'Public URL of the generated PDF report (for API-sourced cases)';






