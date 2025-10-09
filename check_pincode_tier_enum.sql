-- Check the actual pincode_tier enum values in the database
SELECT 
    t.typname as enum_name,
    e.enumlabel as enum_value,
    e.enumsortorder as sort_order
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'pincode_tier'
ORDER BY e.enumsortorder;
