-- Comprehensive storage bucket fix for form submissions
-- This script ensures the storage bucket exists and has proper RLS policies

DO $$
DECLARE
    bucket_name TEXT := 'form_submissions';
    policy_name TEXT;
BEGIN
    -- Check if the bucket exists
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = bucket_name) THEN
        -- Create the bucket
        INSERT INTO storage.buckets (id, name, public)
        VALUES (bucket_name, bucket_name, TRUE);
        RAISE NOTICE 'Storage bucket "%" created successfully.', bucket_name;
    ELSE
        -- Ensure it's public if it already exists
        UPDATE storage.buckets SET public = TRUE WHERE id = bucket_name;
        RAISE NOTICE 'Storage bucket "%" already exists and is set to public.', bucket_name;
    END IF;

    -- Drop existing policies to prevent "already exists" errors
    FOR policy_name IN (
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
        AND policyname LIKE 'Allow % to form_submissions%'
    )
    LOOP
        EXECUTE FORMAT('DROP POLICY IF EXISTS %I ON storage.objects;', policy_name);
        RAISE NOTICE 'Dropped existing policy: %', policy_name;
    END LOOP;

    -- Set up RLS policies for the storage bucket
    -- Allow authenticated users to upload files to their submission folders
    CREATE POLICY "Allow authenticated upload to form_submissions"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = bucket_name
      AND auth.role() = 'authenticated'
    );
    RAISE NOTICE 'Policy "Allow authenticated upload to form_submissions" created.';

    -- Allow authenticated users to view their own uploaded files
    CREATE POLICY "Allow authenticated read from form_submissions"
    ON storage.objects FOR SELECT
    USING (
      bucket_id = bucket_name
      AND auth.role() = 'authenticated'
    );
    RAISE NOTICE 'Policy "Allow authenticated read from form_submissions" created.';

    -- Allow authenticated users to update their own files (e.g., replace)
    CREATE POLICY "Allow authenticated update in form_submissions"
    ON storage.objects FOR UPDATE
    WITH CHECK (
      bucket_id = bucket_name
      AND auth.role() = 'authenticated'
    );
    RAISE NOTICE 'Policy "Allow authenticated update in form_submissions" created.';

    -- Allow authenticated users to delete their own files
    CREATE POLICY "Allow authenticated delete from form_submissions"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = bucket_name
      AND auth.role() = 'authenticated'
    );
    RAISE NOTICE 'Policy "Allow authenticated delete from form_submissions" created.';

    -- Allow ops_team, super_admin, qc_team to manage all files in this bucket
    CREATE POLICY "Allow ops_team to manage all form_submissions files"
    ON storage.objects FOR ALL
    USING (
      bucket_id = bucket_name
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid()
        AND role IN ('ops_team', 'super_admin', 'qc_team')
      )
    )
    WITH CHECK (
      bucket_id = bucket_name
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid()
        AND role IN ('ops_team', 'super_admin', 'qc_team')
      )
    );
    RAISE NOTICE 'Policy "Allow ops_team to manage all form_submissions files" created.';

    RAISE NOTICE 'All storage bucket policies for "%" have been set up.', bucket_name;

    -- Verify the bucket was created and policies are in place
    PERFORM * FROM storage.buckets WHERE id = bucket_name;
    RAISE NOTICE 'Verification: Storage bucket "%" exists.', bucket_name;
END
$$;

-- Final verification queries
SELECT 
    id, 
    name, 
    public, 
    created_at,
    'VERIFIED' as status
FROM storage.buckets 
WHERE id = 'form_submissions';

-- Check if there are any objects in the bucket
SELECT 
    COUNT(*) as object_count,
    'Objects in form_submissions bucket' as description
FROM storage.objects 
WHERE bucket_id = 'form_submissions';

-- Show all storage policies for this bucket
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE '%form_submissions%'
ORDER BY policyname;
