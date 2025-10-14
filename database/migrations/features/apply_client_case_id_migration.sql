-- =====================================================
-- Apply Client Case ID Migration
-- Copy and paste this into Supabase SQL Editor
-- =====================================================

-- Add client_case_id column to cases table
ALTER TABLE public.cases 
ADD COLUMN IF NOT EXISTS client_case_id text;

-- Add constraint to make client_case_id mandatory
ALTER TABLE public.cases 
ALTER COLUMN client_case_id SET NOT NULL;

-- Add unique constraint for client_case_id per client
CREATE UNIQUE INDEX IF NOT EXISTS cases_client_case_id_client_id_unique 
ON public.cases (client_id, client_case_id);

-- Add comment for documentation
COMMENT ON COLUMN public.cases.client_case_id IS 'Client-provided case identifier for tracking purposes';

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'cases' AND column_name = 'client_case_id';

