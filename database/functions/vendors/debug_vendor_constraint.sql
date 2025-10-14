-- Debug the vendor constraint that's causing the error
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition,
    contype as constraint_type
FROM pg_constraint 
WHERE conrelid = 'cases'::regclass
  AND conname LIKE '%vendor%consistency%';

-- Also check all constraints on the cases table
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition,
    contype as constraint_type
FROM pg_constraint 
WHERE conrelid = 'cases'::regclass
ORDER BY conname;
