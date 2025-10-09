-- Check what pincode tier values are actually in the database
SELECT DISTINCT tier, COUNT(*) as count
FROM public.pincode_tiers 
GROUP BY tier
ORDER BY tier;
