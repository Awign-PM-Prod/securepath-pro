# Setup API Reports Storage Bucket

## Overview
This guide explains how to set up the `api-reports` storage bucket for storing PDF reports for API-sourced cases.

## Why Manual Setup?
Storage buckets cannot be created directly via SQL in the Supabase SQL Editor due to permission restrictions. The bucket must be created manually through the Supabase Dashboard.

## Step-by-Step Instructions

### Step 1: Create the Storage Bucket

1. **Open Supabase Dashboard**
   - Navigate to your Supabase project
   - Go to **Storage** in the left sidebar

2. **Create New Bucket**
   - Click the **"New bucket"** button
   - Fill in the following details:
     - **Name**: `api-reports`
     - **Public bucket**: ✅ **YES** (check this box - important!)
     - **File size limit**: `52428800` (50MB)
     - **Allowed MIME types**: `application/pdf`
   - Click **"Create bucket"**

3. **Verify Bucket Creation**
   - You should see `api-reports` in your list of buckets
   - Ensure it shows as "Public"

### Step 2: Run the SQL Migration

After creating the bucket manually, run the SQL migration to set up RLS policies:

```sql
-- Run this in Supabase SQL Editor
\i database/migrations/features/create_api_reports_storage_bucket.sql
```

Or copy and paste the contents of `database/migrations/features/create_api_reports_storage_bucket.sql` into the SQL Editor.

### Step 3: Verify Setup

Run this query to verify everything is set up correctly:

```sql
-- Check bucket exists and is public
SELECT 
  id, 
  name, 
  public, 
  file_size_limit,
  allowed_mime_types
FROM storage.buckets 
WHERE id = 'api-reports';

-- Check policies are created
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE 'api_reports%';
```

## Troubleshooting

### Error: "must be owner of table buckets"
- **Solution**: Create the bucket manually via Dashboard (Step 1 above)
- The SQL migration only creates RLS policies, not the bucket itself

### Error: "Storage bucket 'api-reports' does not exist"
- **Solution**: Make sure you've created the bucket via Dashboard first
- Check that the bucket name is exactly `api-reports` (case-sensitive)

### Policies not working
- Verify the bucket is set to **Public**
- Check that policies were created successfully (use verification query above)
- Ensure you're authenticated when uploading files

## What This Bucket Is Used For

- Stores PDF reports generated for cases with `source = 'api'`
- Provides public URLs that can be used in API calls
- Reports are organized by case ID: `{caseId}/{filename}.pdf`

## Security Notes

- The bucket is **public** to allow API access without authentication
- Only authenticated users can upload files
- Anyone with the URL can download the PDF (by design, for API integration)






