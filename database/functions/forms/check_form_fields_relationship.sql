-- Check the relationship between form_templates and form_fields
-- This will help us understand why fields are not being fetched

-- Check if form_fields table has the correct foreign key
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'form_fields'
    AND tc.table_schema = 'public';

-- Check if there are any form_fields for our template
SELECT 
    ft.id as template_id,
    ft.template_name,
    COUNT(ff.id) as field_count
FROM public.form_templates ft
LEFT JOIN public.form_fields ff ON ft.id = ff.template_id
WHERE ft.template_name = 'Business Address Verification Form'
GROUP BY ft.id, ft.template_name;

-- Check the actual form_fields data
SELECT 
    ff.id,
    ff.field_key,
    ff.field_title,
    ff.field_type,
    ff.field_order,
    ff.template_id
FROM public.form_fields ff
JOIN public.form_templates ft ON ff.template_id = ft.id
WHERE ft.template_name = 'Business Address Verification Form'
ORDER BY ff.field_order;
