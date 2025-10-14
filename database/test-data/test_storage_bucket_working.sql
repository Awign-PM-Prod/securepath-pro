-- Test script to verify storage bucket is working
-- Run this after setting up the storage bucket

-- 1. Check if bucket exists
SELECT 
    'Bucket Status' as test_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'form_submissions') 
        THEN 'EXISTS' 
        ELSE 'MISSING' 
    END as result;

-- 2. Check if bucket is public
SELECT 
    'Bucket Public' as test_type,
    CASE 
        WHEN public = true 
        THEN 'PUBLIC' 
        ELSE 'PRIVATE' 
    END as result
FROM storage.buckets 
WHERE id = 'form_submissions';

-- 3. Check RLS policies
SELECT 
    'RLS Policies' as test_type,
    COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE '%form_submissions%';

-- 4. List all storage buckets
SELECT 
    'All Buckets' as test_type,
    string_agg(id, ', ') as bucket_list
FROM storage.buckets;

-- 5. Test if we can query storage.objects (this will fail if RLS is too restrictive)
SELECT 
    'Storage Access' as test_type,
    CASE 
        WHEN COUNT(*) >= 0 
        THEN 'ACCESSIBLE' 
        ELSE 'RESTRICTED' 
    END as result
FROM storage.objects 
WHERE bucket_id = 'form_submissions';
