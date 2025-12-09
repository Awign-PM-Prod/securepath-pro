-- =====================================================
-- TEST API KEY SETUP
-- Run this to verify the API key system is working
-- Background Verification Platform
-- =====================================================

-- Return test results as a table
SELECT 
  'Table Exists' as test_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_keys') 
    THEN '✅ PASS' 
    ELSE '❌ FAIL' 
  END as result,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_keys') 
    THEN 'Table api_keys exists' 
    ELSE 'Table api_keys does not exist' 
  END as details

UNION ALL

SELECT 
  'Function: hash_api_key' as test_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'hash_api_key') 
    THEN '✅ PASS' 
    ELSE '❌ FAIL' 
  END as result,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'hash_api_key') 
    THEN 'Function exists' 
    ELSE 'Function does not exist' 
  END as details

UNION ALL

SELECT 
  'Function: generate_api_key' as test_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_api_key') 
    THEN '✅ PASS' 
    ELSE '❌ FAIL' 
  END as result,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_api_key') 
    THEN 'Function exists' 
    ELSE 'Function does not exist' 
  END as details

UNION ALL

SELECT 
  'Function: create_api_key' as test_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_api_key') 
    THEN '✅ PASS' 
    ELSE '❌ FAIL' 
  END as result,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_api_key') 
    THEN 'Function exists' 
    ELSE 'Function does not exist' 
  END as details

UNION ALL

SELECT 
  'Function: validate_api_key' as test_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'validate_api_key') 
    THEN '✅ PASS' 
    ELSE '❌ FAIL' 
  END as result,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'validate_api_key') 
    THEN 'Function exists' 
    ELSE 'Function does not exist' 
  END as details

UNION ALL

SELECT 
  'Hash Function Test' as test_name,
  CASE 
    WHEN public.hash_api_key('test_key_123') IS NOT NULL 
         AND length(public.hash_api_key('test_key_123')) = 64
    THEN '✅ PASS' 
    ELSE '❌ FAIL' 
  END as result,
  CASE 
    WHEN public.hash_api_key('test_key_123') IS NOT NULL 
         AND length(public.hash_api_key('test_key_123')) = 64
    THEN 'Hash function works correctly (64 char SHA-256 hash)' 
    ELSE 'Hash function returned invalid result' 
  END as details

UNION ALL

SELECT 
  'Generate Function Test' as test_name,
  CASE 
    WHEN public.generate_api_key() IS NOT NULL 
         AND public.generate_api_key() LIKE 'bgv_%'
    THEN '✅ PASS' 
    ELSE '❌ FAIL' 
  END as result,
  CASE 
    WHEN public.generate_api_key() IS NOT NULL 
         AND public.generate_api_key() LIKE 'bgv_%'
    THEN 'Generate function works correctly (key starts with bgv_)' 
    ELSE 'Generate function returned invalid result' 
  END as details

UNION ALL

SELECT 
  'RLS Policies' as test_name,
  CASE 
    WHEN (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'api_keys') >= 3
    THEN '✅ PASS' 
    ELSE '❌ FAIL' 
  END as result,
  'Found ' || (SELECT COUNT(*)::text FROM pg_policies WHERE tablename = 'api_keys') || ' RLS policies' as details

UNION ALL

SELECT 
  'Indexes' as test_name,
  CASE 
    WHEN (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'api_keys') >= 3
    THEN '✅ PASS' 
    ELSE '⚠️ WARNING' 
  END as result,
  'Found ' || (SELECT COUNT(*)::text FROM pg_indexes WHERE tablename = 'api_keys') || ' indexes' as details

ORDER BY test_name;
