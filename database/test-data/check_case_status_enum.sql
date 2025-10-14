-- =====================================================
-- Check case_status enum values
-- Background Verification Platform
-- =====================================================

-- Show all case_status enum values
SELECT 
    'case_status enum values' as section,
    enumlabel as value
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'case_status')
ORDER BY enumsortorder;

-- Show current cases and their statuses
SELECT 
    'Current case statuses' as section,
    status,
    COUNT(*) as count
FROM cases
GROUP BY status
ORDER BY count DESC;
