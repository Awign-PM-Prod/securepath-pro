-- Check the constraint that's causing the error
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname LIKE '%vendor%consistency%' 
   OR conname LIKE '%current_vendor_id%'
   OR conrelid = 'cases'::regclass;
