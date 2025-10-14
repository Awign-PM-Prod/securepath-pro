-- Test RLS policies for storage bucket
-- This will help identify if RLS is blocking file uploads

-- 1. Check current RLS policies on storage.objects
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
ORDER BY policyname;

-- 2. Check if RLS is enabled on storage.objects
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'storage' 
AND tablename = 'objects';

-- 3. Test if we can access storage.objects (this should work if RLS is properly configured)
SELECT 
    COUNT(*) as total_objects,
    'storage.objects accessible' as status
FROM storage.objects;

-- 4. Check if we can access the form_submissions bucket specifically
SELECT 
    COUNT(*) as form_submissions_objects,
    'form_submissions bucket accessible' as status
FROM storage.objects 
WHERE bucket_id = 'form_submissions';

-- 5. Show current user context
SELECT 
    current_user as current_db_user,
    session_user as session_user,
    'User context' as info;
