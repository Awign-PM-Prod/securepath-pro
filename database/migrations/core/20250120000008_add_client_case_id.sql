-- =====================================================
-- Add client_case_id field to cases table
-- Background Verification Platform - Phase 1
-- =====================================================

-- Add client_case_id column to cases table
ALTER TABLE public.cases 
ADD COLUMN client_case_id text;

-- Add constraint to make client_case_id mandatory
ALTER TABLE public.cases 
ALTER COLUMN client_case_id SET NOT NULL;

-- Add unique constraint for client_case_id per client
CREATE UNIQUE INDEX cases_client_case_id_client_id_unique 
ON public.cases (client_id, client_case_id);

-- Add comment for documentation
COMMENT ON COLUMN public.cases.client_case_id IS 'Client-provided case identifier for tracking purposes';

