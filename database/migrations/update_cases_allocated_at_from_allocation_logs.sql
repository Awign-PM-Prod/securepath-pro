-- =====================================================
-- Update cases.allocated_at from allocation_logs
-- =====================================================
-- This query populates the allocated_at column in cases table
-- by taking the most recent allocated_at value from allocation_logs

UPDATE cases c
SET allocated_at = (
    SELECT al.allocated_at
    FROM allocation_logs al
    WHERE al.case_id = c.id
    ORDER BY al.allocated_at DESC
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1
    FROM allocation_logs al
    WHERE al.case_id = c.id
    AND al.allocated_at IS NOT NULL
);

-- Verify the update
SELECT 
    COUNT(*) as total_cases,
    COUNT(allocated_at) as cases_with_allocated_at,
    COUNT(*) - COUNT(allocated_at) as cases_without_allocated_at
FROM cases
WHERE is_active = true;

