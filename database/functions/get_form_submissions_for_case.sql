-- Function to get form submissions for a case (bypasses RLS for debugging)
CREATE OR REPLACE FUNCTION get_form_submissions_for_case(case_id UUID)
RETURNS TABLE (
  id UUID,
  case_id UUID,
  gig_partner_id UUID,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fs.id,
    fs.case_id,
    fs.gig_partner_id,
    fs.status,
    fs.created_at,
    fs.updated_at,
    fs.submitted_at
  FROM form_submissions fs
  WHERE fs.case_id = $1;
END;
$$;
