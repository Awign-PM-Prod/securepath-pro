-- Fix storage bucket issue for form submissions
-- This script ensures the storage bucket exists and is properly configured

-- First, check if the bucket exists
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

-- Create the bucket if it doesn't exist
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

-- Show all storage buckets for reference
SELECT 
    id, 
    name, 
    public, 
    created_at
FROM storage.buckets 
ORDER BY created_at;
