-- Create storage bucket for form file uploads
-- This needs to be run in Supabase Dashboard > Storage

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'form-files',
  'form-files',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
);

-- Create RLS policies for the bucket
CREATE POLICY "form_files_select_policy" ON storage.objects
FOR SELECT USING (bucket_id = 'form-files');

CREATE POLICY "form_files_insert_policy" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'form-files' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "form_files_update_policy" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'form-files' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "form_files_delete_policy" ON storage.objects
FOR DELETE USING (
  bucket_id = 'form-files' AND
  auth.role() = 'authenticated'
);
