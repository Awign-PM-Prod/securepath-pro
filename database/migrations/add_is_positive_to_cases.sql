-- =====================================================
-- Add is_positive flag to cases table
-- =====================================================
-- This migration adds support for tracking whether a case is positive or negative
-- Run this in Supabase SQL Editor

-- Add is_positive column to cases table
ALTER TABLE public.cases 
ADD COLUMN IF NOT EXISTS is_positive BOOLEAN;

-- Add comment to explain the column
COMMENT ON COLUMN public.cases.is_positive IS 'Indicates if this case is positive (true) or negative (false). NULL means not yet determined.';

-- Create index for better query performance when filtering by is_positive
CREATE INDEX IF NOT EXISTS idx_cases_is_positive 
ON public.cases(is_positive) 
WHERE is_positive IS NOT NULL;

-- Verify the changes
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'cases' 
  AND column_name = 'is_positive';

