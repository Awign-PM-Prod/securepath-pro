-- Fix RLS policies for storage bucket access
-- This script ensures authenticated users can access the storage bucket

-- First, let's check what policies currently exist
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
ORDER BY policyname;

-- Drop all existing policies for form_submissions to start fresh
DO $$
DECLARE
    policy_name TEXT;
BEGIN
    -- Drop existing policies that might be conflicting
    FOR policy_name IN (
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'storage' 
        AND tablename = 'objects'
        AND (policyname LIKE '%form_submissions%' OR policyname LIKE '%Allow%')
    )
    LOOP
        EXECUTE FORMAT('DROP POLICY IF EXISTS %I ON storage.objects;', policy_name);
        RAISE NOTICE 'Dropped policy: %', policy_name;
    END LOOP;
END
$$;

-- Create new, simpler RLS policies for storage.objects
-- Allow authenticated users to do everything with storage objects
CREATE POLICY "Allow authenticated users full access to storage objects"
ON storage.objects FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow service role to do everything (for admin operations)
CREATE POLICY "Allow service role full access to storage objects"
ON storage.objects FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Verify the policies were created
SELECT 
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
ORDER BY policyname;

-- Test if we can now access storage.objects
SELECT 
    COUNT(*) as total_objects,
    'storage.objects now accessible' as status
FROM storage.objects;

-- Test if we can access the form_submissions bucket specifically
SELECT 
    COUNT(*) as form_submissions_objects,
    'form_submissions bucket now accessible' as status
FROM storage.objects 
WHERE bucket_id = 'form_submissions';
