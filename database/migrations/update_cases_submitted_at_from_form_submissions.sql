-- =====================================================
-- Update cases.submitted_at from form_submissions
-- =====================================================
-- This query populates the submitted_at column in cases table
-- by taking the submitted_at value from form_submissions (or updated_at as fallback)

UPDATE cases c
SET submitted_at = (
    SELECT COALESCE(fs.submitted_at, fs.updated_at)
    FROM form_submissions fs
    WHERE fs.case_id = c.id
    ORDER BY 
        COALESCE(fs.submitted_at, fs.updated_at) DESC
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1
    FROM form_submissions fs
    WHERE fs.case_id = c.id
    AND (fs.submitted_at IS NOT NULL OR fs.updated_at IS NOT NULL)
);

-- Verify the update
SELECT 
    COUNT(*) as total_cases,
    COUNT(submitted_at) as cases_with_submitted_at,
    COUNT(*) - COUNT(submitted_at) as cases_without_submitted_at
FROM cases
WHERE is_active = true;

