-- =====================================================
-- Add total_score column to gig_partners table
-- Background Verification Platform
-- =====================================================
-- This migration adds a total_score column to track overall
-- performance score for gig workers (calculated as percentage)
-- =====================================================

-- Add total_score column to gig_partners table
ALTER TABLE public.gig_partners
ADD COLUMN total_score DECIMAL(3,2) NOT NULL DEFAULT 0.00;

-- Add comment to document the column
COMMENT ON COLUMN public.gig_partners.total_score IS 'Overall performance score calculated as a percentage (0.00 to 1.00, displayed as 0% to 100%)';

-- Verify the column was added
SELECT 
  'Column added successfully' as status,
  column_name,
  data_type,
  numeric_precision,
  numeric_scale,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'gig_partners'
  AND column_name = 'total_score';

