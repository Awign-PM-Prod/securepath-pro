-- Safe storage bucket setup script
-- This script handles existing policies and ensures the bucket is created

-- First, check if the bucket exists
DO $$
BEGIN
    -- Check if bucket exists
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'form_submissions') THEN
        -- Create the storage bucket
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('form_submissions', 'form_submissions', true);
        
        RAISE NOTICE 'Storage bucket "form_submissions" created successfully.';
    ELSE
        RAISE NOTICE 'Storage bucket "form_submissions" already exists.';
    END IF;
END $$;

-- Drop existing policies if they exist to prevent conflicts
DROP POLICY IF EXISTS "Allow authenticated upload to form_submissions" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated read from form_submissions" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update in form_submissions" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete from form_submissions" ON storage.objects;
DROP POLICY IF EXISTS "Allow ops_team to manage all form_submissions files" ON storage.objects;

-- Create new policies
-- Allow authenticated users to upload files to their submission folders
CREATE POLICY "Allow authenticated upload to form_submissions"
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'form_submissions' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to view their own uploaded files
CREATE POLICY "Allow authenticated read from form_submissions"
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'form_submissions' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to update their own files (e.g., replace)
CREATE POLICY "Allow authenticated update in form_submissions"
ON storage.objects FOR UPDATE 
WITH CHECK (
  bucket_id = 'form_submissions' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to delete their own files
CREATE POLICY "Allow authenticated delete from form_submissions"
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'form_submissions' 
  AND auth.role() = 'authenticated'
);

-- Allow ops_team to manage all files in this bucket
CREATE POLICY "Allow ops_team to manage all form_submissions files"
ON storage.objects FOR ALL 
USING (
  bucket_id = 'form_submissions' 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('ops_team', 'super_admin', 'qc_team')
  )
)
WITH CHECK (
  bucket_id = 'form_submissions' 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('ops_team', 'super_admin', 'qc_team')
  )
);

-- Verify the bucket was created
SELECT 
    id, 
    name, 
    public, 
    created_at 
FROM storage.buckets 
WHERE id = 'form_submissions';

-- Show all policies for this bucket
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE '%form_submissions%';
