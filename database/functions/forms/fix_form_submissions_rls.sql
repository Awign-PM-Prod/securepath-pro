-- Fix RLS policies for form_submissions table
-- Enable RLS if not already enabled
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow gig workers to manage their own submissions" ON public.form_submissions;
DROP POLICY IF EXISTS "Allow admins to manage all submissions" ON public.form_submissions;

-- Policy for gig workers to manage their own submissions
CREATE POLICY "Allow gig workers to manage their own submissions"
ON public.form_submissions FOR ALL
USING (
  gig_partner_id IN (
    SELECT id FROM public.gig_partners 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  gig_partner_id IN (
    SELECT id FROM public.gig_partners 
    WHERE user_id = auth.uid()
  )
);

-- Policy for admins to manage all submissions
CREATE POLICY "Allow admins to manage all submissions"
ON public.form_submissions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('ops_team', 'super_admin', 'qc_team')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('ops_team', 'super_admin', 'qc_team')
  )
);

-- Fix RLS policies for form_submission_files table
-- Enable RLS if not already enabled
ALTER TABLE public.form_submission_files ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow gig workers to manage their own submission files" ON public.form_submission_files;
DROP POLICY IF EXISTS "Allow admins to manage all submission files" ON public.form_submission_files;

-- Policy for gig workers to manage their own submission files
CREATE POLICY "Allow gig workers to manage their own submission files"
ON public.form_submission_files FOR ALL
USING (
  submission_id IN (
    SELECT fs.id FROM public.form_submissions fs
    JOIN public.gig_partners gp ON fs.gig_partner_id = gp.id
    WHERE gp.user_id = auth.uid()
  )
)
WITH CHECK (
  submission_id IN (
    SELECT fs.id FROM public.form_submissions fs
    JOIN public.gig_partners gp ON fs.gig_partner_id = gp.id
    WHERE gp.user_id = auth.uid()
  )
);

-- Policy for admins to manage all submission files
CREATE POLICY "Allow admins to manage all submission files"
ON public.form_submission_files FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('ops_team', 'super_admin', 'qc_team')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('ops_team', 'super_admin', 'qc_team')
  )
);
