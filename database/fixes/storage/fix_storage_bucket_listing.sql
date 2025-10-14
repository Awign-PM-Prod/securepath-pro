-- Fix storage bucket listing permissions
-- This script ensures authenticated users can list storage buckets

-- First, let's check what policies exist for storage.buckets
SELECT 
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'buckets'
ORDER BY policyname;

-- Drop existing policies for storage.buckets to start fresh
DO $$
DECLARE
    policy_name TEXT;
BEGIN
    -- Drop existing policies that might be conflicting
    FOR policy_name IN (
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'storage' 
        AND tablename = 'buckets'
    )
    LOOP
        EXECUTE FORMAT('DROP POLICY IF EXISTS %I ON storage.buckets;', policy_name);
        RAISE NOTICE 'Dropped policy: %', policy_name;
    END LOOP;
END
$$;

-- Create new policies for storage.buckets
-- Allow authenticated users to read storage buckets
CREATE POLICY "Allow authenticated users to read storage buckets"
ON storage.buckets FOR SELECT
TO authenticated
USING (true);

-- Allow service role to do everything with storage buckets
CREATE POLICY "Allow service role full access to storage buckets"
ON storage.buckets FOR ALL
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
AND tablename = 'buckets'
ORDER BY policyname;

-- Test if we can now access storage.buckets
SELECT 
    COUNT(*) as total_buckets,
    'storage.buckets now accessible' as status
FROM storage.buckets;

-- Show all available buckets
SELECT 
    id,
    name,
    public,
    created_at
FROM storage.buckets
ORDER BY created_at;
