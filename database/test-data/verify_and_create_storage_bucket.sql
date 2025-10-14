-- Verify and create storage bucket for form submissions
-- This script checks if the bucket exists and creates it if needed

-- First, check if the bucket exists in storage.buckets
SELECT 
    id, 
    name, 
    public, 
    created_at,
    CASE 
        WHEN id = 'form_submissions' THEN 'EXISTS'
        ELSE 'NOT_FOUND'
    END as status
FROM storage.buckets 
WHERE id = 'form_submissions';

-- If the bucket doesn't exist, create it
INSERT INTO storage.buckets (id, name, public)
VALUES ('form_submissions', 'form_submissions', true)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    updated_at = now();

-- Verify the bucket was created/updated
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

-- Show all storage buckets
SELECT 
    id, 
    name, 
    public, 
    created_at
FROM storage.buckets 
ORDER BY created_at;
