-- Function to get legacy submissions for a case (bypasses RLS for debugging)
CREATE OR REPLACE FUNCTION get_legacy_submissions_for_case(case_id UUID)
RETURNS TABLE (
  id UUID,
  case_id UUID,
  gig_partner_id UUID,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  answers JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.case_id,
    s.gig_partner_id,
    s.status,
    s.created_at,
    s.updated_at,
    s.submitted_at,
    s.answers
  FROM submissions s
  WHERE s.case_id = $1;
END;
$$;
