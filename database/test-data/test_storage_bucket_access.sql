-- Test storage bucket access
-- This script tests if we can access the storage bucket

-- Test 1: Check if bucket exists
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'form_submissions') 
        THEN 'Bucket exists in storage.buckets table'
        ELSE 'Bucket does NOT exist in storage.buckets table'
    END as bucket_check;

-- Test 2: Try to list objects in the bucket (this will fail if bucket doesn't exist in actual storage)
SELECT 
    COUNT(*) as object_count,
    'This query will fail if bucket does not exist in actual Supabase storage' as note
FROM storage.objects 
WHERE bucket_id = 'form_submissions';

-- Test 3: Check bucket permissions
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE '%form_submissions%';
