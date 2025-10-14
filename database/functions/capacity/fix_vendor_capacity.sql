-- =====================================================
-- Fix Vendor Capacity Issue
-- Background Verification Platform
-- =====================================================

-- Update vendors to have proper capacity
UPDATE vendors 
SET capacity_available = GREATEST(5, capacity_available)
WHERE is_active = true AND capacity_available <= 0;

-- Update gig workers to have better performance scores for testing
UPDATE gig_partners 
SET 
    completion_rate = GREATEST(0.5, COALESCE(completion_rate, 0)),
    ontime_completion_rate = GREATEST(0.5, COALESCE(ontime_completion_rate, 0)),
    acceptance_rate = GREATEST(0.5, COALESCE(acceptance_rate, 0))
WHERE is_active = true AND is_direct_gig = true;

-- Check the results
SELECT 'Vendors after capacity fix:' as info;
SELECT 
    id,
    name,
    capacity_available,
    quality_score,
    performance_score
FROM vendors 
WHERE is_active = true;

SELECT 'Gig workers after performance fix:' as info;
SELECT 
    id,
    completion_rate,
    ontime_completion_rate,
    acceptance_rate,
    quality_score,
    capacity_available
FROM gig_partners 
WHERE is_active = true AND is_direct_gig = true
LIMIT 5;
