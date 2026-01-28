-- =====================================================
-- Verify API Reports Setup
-- Run this to verify everything is set up correctly
-- =====================================================

-- 1. Check if report_url column exists in cases table
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'cases'
  AND column_name = 'report_url';

-- 2. Check if api-reports bucket exists
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
WHERE id = 'api-reports';

-- 3. Check if RLS policies are created
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN cmd = 'SELECT' THEN 'Public read access'
    WHEN cmd = 'INSERT' THEN 'Authenticated upload'
    WHEN cmd = 'UPDATE' THEN 'Authenticated update'
    WHEN cmd = 'DELETE' THEN 'Authenticated delete'
  END as description
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE 'api_reports%'
ORDER BY cmd;

-- 4. Check if there are any API-sourced cases
SELECT 
  COUNT(*) as total_api_cases,
  COUNT(CASE WHEN status = 'qc_passed' THEN 1 END) as qc_passed_api_cases,
  COUNT(CASE WHEN report_url IS NOT NULL THEN 1 END) as cases_with_reports
FROM public.cases
WHERE source = 'api'
  AND is_active = true;

-- 5. Show any existing report URLs (if any)
SELECT 
  id,
  case_number,
  client_case_id,
  status,
  report_url,
  status_updated_at
FROM public.cases
WHERE source = 'api'
  AND report_url IS NOT NULL
ORDER BY status_updated_at DESC
LIMIT 10;






