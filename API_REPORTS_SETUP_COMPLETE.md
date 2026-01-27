# API Reports Setup - Complete! ✅

## What Has Been Set Up

### 1. Database Changes ✅
- **`report_url` column** added to `cases` table
- Stores the public URL of generated PDF reports for API-sourced cases

### 2. Storage Bucket ✅
- **`api-reports` bucket** created in Supabase Storage
- Configured as **public** bucket (URLs accessible without authentication)
- File size limit: 50MB
- Allowed MIME types: `application/pdf`

### 3. RLS Policies ✅
- **Public read access** - Anyone with URL can download PDFs
- **Authenticated upload** - Only authenticated users can upload reports
- **Authenticated update/delete** - Only authenticated users can manage files

### 4. Code Changes ✅
- **PDFService** updated to upload PDFs to storage for API cases
- **Reports.tsx** updated to store report URLs for API cases
- **CaseDetail.tsx** updated to store report URLs for API cases

## How It Works

### When a PDF is Generated for an API-Sourced Case:

1. **PDF Generation**: Normal PDF generation happens (with AI summary, etc.)
2. **Upload to Storage**: PDF is automatically uploaded to `api-reports` bucket
3. **Store URL**: The public URL is saved in `cases.report_url` column
4. **User Download**: PDF is also downloaded to user's computer

### File Structure in Storage:
```
api-reports/
  └── {caseId}/
      └── {client_case_id}_{candidate_name}.pdf
```

## Testing the Setup

### Step 1: Verify Setup
Run the verification script:
```sql
\i database/migrations/features/VERIFY_API_REPORTS_SETUP.sql
```

### Step 2: Test Report Generation
1. Find or create a case with `source = 'api'`
2. Ensure the case has form submissions
3. Go to Reports page or Case Detail page
4. Click "Download PDF"
5. Check that:
   - PDF downloads to your computer ✅
   - PDF is uploaded to storage ✅
   - `report_url` is stored in database ✅

### Step 3: Verify Report URL
```sql
-- Check the report URL was stored
SELECT 
  case_number,
  client_case_id,
  status,
  report_url
FROM cases
WHERE source = 'api'
  AND report_url IS NOT NULL
ORDER BY updated_at DESC
LIMIT 5;
```

### Step 4: Test Public Access
Copy the `report_url` from the database and open it in a browser (or use curl):
```bash
curl -I "https://your-project.supabase.co/storage/v1/object/public/api-reports/{caseId}/{filename}.pdf"
```

Should return `200 OK` if accessible.

## Using Report URL in API Calls

### For qc_passed Status API Call:

When implementing the API call for `qc_passed` status, you can include the report URL:

```typescript
// Example: In your edge function or API service
const caseData = await getCaseById(caseId);

const apiPayload = {
  caseId: caseData.id,
  clientCaseId: caseData.client_case_id,
  status: 'qc_passed',
  reportUrl: caseData.report_url // Include the report URL
};

await callAWIGNAPI(apiPayload);
```

### Getting Report URL:
```sql
-- Get report URL for a specific case
SELECT report_url 
FROM cases 
WHERE id = '{caseId}' 
  AND source = 'api';
```

## Next Steps

### 1. Implement qc_passed API Call
Now that reports are being stored, you can implement the API call for `qc_passed` status:

- Update the trigger function to also fire on `qc_passed` status
- Update the edge function to handle `qc_passed` status
- Include the `report_url` in the API payload

### 2. Monitor Report Generation
- Check that reports are being generated for API cases
- Verify URLs are being stored correctly
- Monitor storage usage

### 3. Handle Edge Cases
- What if report generation fails?
- What if storage upload fails?
- Should we retry failed uploads?

## Troubleshooting

### Report URL Not Being Stored
- Check browser console for errors
- Verify case has `source = 'api'`
- Check Supabase logs for storage errors
- Verify bucket permissions

### Storage Upload Fails
- Check bucket exists: `SELECT * FROM storage.buckets WHERE id = 'api-reports'`
- Verify RLS policies: Run verification script
- Check file size (should be < 50MB)
- Check authentication (must be authenticated user)

### Report URL Not Accessible
- Verify bucket is public: `SELECT public FROM storage.buckets WHERE id = 'api-reports'`
- Check file exists in storage dashboard
- Verify URL format is correct

## Files Modified

1. `database/migrations/features/add_report_url_to_cases.sql` - Added report_url column
2. `database/migrations/features/create_api_reports_storage_bucket.sql` - Storage bucket setup
3. `src/services/pdfService.ts` - Added upload functionality
4. `src/pages/dashboards/Reports.tsx` - Store URL for API cases
5. `src/components/CaseManagement/CaseDetail.tsx` - Store URL for API cases

## Questions?

If you encounter any issues:
1. Check Supabase logs
2. Run verification script
3. Check browser console for errors
4. Verify bucket and policies are set up correctly




