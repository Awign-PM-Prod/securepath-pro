-- =====================================================
-- Add vendor_allocated to allocation_decision enum
-- Background Verification Platform
-- =====================================================

-- Add 'vendor_allocated' to the allocation_decision enum
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'allocation_decision')
        AND enumlabel = 'vendor_allocated'
    ) THEN
        ALTER TYPE allocation_decision ADD VALUE 'vendor_allocated' AFTER 'rejected';
    END IF;
END $$;

-- Show the updated enum values
SELECT 
    'Updated allocation_decision enum' as section,
    enumlabel as value
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'allocation_decision')
ORDER BY enumsortorder;
