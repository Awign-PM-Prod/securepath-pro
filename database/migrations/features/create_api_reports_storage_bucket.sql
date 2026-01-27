-- =====================================================
-- Create public storage bucket for API case reports
-- This bucket stores PDF reports for cases with source = 'api'
-- =====================================================
--
-- IMPORTANT: Storage buckets cannot be created via SQL in Supabase SQL Editor
-- due to permission restrictions. You must create the bucket manually first.
--
-- STEP 1: Create the bucket manually via Supabase Dashboard:
--   1. Go to Supabase Dashboard > Storage
--   2. Click "New bucket"
--   3. Set the following:
--      - Name: api-reports
--      - Public bucket: YES (checked)
--      - File size limit: 52428800 (50MB)
--      - Allowed MIME types: application/pdf
--   4. Click "Create bucket"
--
-- STEP 2: After creating the bucket, run this SQL to set up RLS policies
-- =====================================================

-- Check if bucket exists and create policies only if it does
DO $$
DECLARE
  bucket_exists BOOLEAN;
  bucket_record RECORD;
BEGIN
  -- Check if bucket exists
  SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'api-reports') INTO bucket_exists;
  
  IF NOT bucket_exists THEN
    RAISE WARNING 'Storage bucket "api-reports" does not exist. Skipping policy creation.';
    RAISE WARNING 'Please create the bucket manually via Supabase Dashboard > Storage, then run this migration again.';
    RAISE WARNING 'Bucket settings: Name=api-reports, Public=YES, File size limit=52428800 (50MB), Allowed MIME types=application/pdf';
    RETURN;
  END IF;
  
  -- Get bucket details for verification
  SELECT id, name, public, file_size_limit, allowed_mime_types
  INTO bucket_record
  FROM storage.buckets
  WHERE id = 'api-reports';
  
  RAISE NOTICE 'Bucket "api-reports" found. Creating RLS policies...';
  RAISE NOTICE '  Public: %', bucket_record.public;
  RAISE NOTICE '  File size limit: % bytes', bucket_record.file_size_limit;
  RAISE NOTICE '  Allowed MIME types: %', bucket_record.allowed_mime_types;
END $$;

-- Drop existing policies if they exist (to allow re-running this migration)
-- Only execute if bucket exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'api-reports') THEN
    DROP POLICY IF EXISTS "api_reports_insert_policy" ON storage.objects;
    DROP POLICY IF EXISTS "api_reports_select_policy" ON storage.objects;
    DROP POLICY IF EXISTS "api_reports_update_policy" ON storage.objects;
    DROP POLICY IF EXISTS "api_reports_delete_policy" ON storage.objects;
    RAISE NOTICE 'Dropped existing policies (if any)';
  END IF;
END $$;

-- Create RLS policies for the bucket (only if bucket exists)
-- Allow authenticated users to upload reports
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'api-reports') THEN
    CREATE POLICY "api_reports_insert_policy" ON storage.objects
    FOR INSERT WITH CHECK (
      bucket_id = 'api-reports' AND
      auth.role() = 'authenticated'
    );
    RAISE NOTICE 'Created policy: api_reports_insert_policy';
  END IF;
END $$;

-- Allow public read access (since bucket is public)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'api-reports') THEN
    CREATE POLICY "api_reports_select_policy" ON storage.objects
    FOR SELECT USING (bucket_id = 'api-reports');
    RAISE NOTICE 'Created policy: api_reports_select_policy';
  END IF;
END $$;

-- Allow authenticated users to update their own uploads
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'api-reports') THEN
    CREATE POLICY "api_reports_update_policy" ON storage.objects
    FOR UPDATE USING (
      bucket_id = 'api-reports' AND
      auth.role() = 'authenticated'
    );
    RAISE NOTICE 'Created policy: api_reports_update_policy';
  END IF;
END $$;

-- Allow authenticated users to delete reports
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'api-reports') THEN
    CREATE POLICY "api_reports_delete_policy" ON storage.objects
    FOR DELETE USING (
      bucket_id = 'api-reports' AND
      auth.role() = 'authenticated'
    );
    RAISE NOTICE 'Created policy: api_reports_delete_policy';
  END IF;
END $$;

-- Final verification
DO $$
DECLARE
  bucket_record RECORD;
  policy_count INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'api-reports') THEN
    SELECT id, name, public, file_size_limit, allowed_mime_types
    INTO bucket_record
    FROM storage.buckets
    WHERE id = 'api-reports';
    
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects'
      AND policyname LIKE 'api_reports%';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Setup completed successfully!';
    RAISE NOTICE 'Bucket: %', bucket_record.name;
    RAISE NOTICE 'Public: %', bucket_record.public;
    RAISE NOTICE 'Policies created: %', policy_count;
    RAISE NOTICE '========================================';
  ELSE
    RAISE WARNING 'Bucket does not exist. Policies were not created.';
  END IF;
END $$;

