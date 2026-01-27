# AWIGN API Integration Setup Guide

This guide explains how to set up the AWIGN API integration for automatic status updates when API-sourced cases transition to 'in_progress' or 'qc_passed' status.

## Overview

When a case with `source = 'api'` transitions to:
- **'in_progress'** status: The system automatically calls the AWIGN API to update the lead status
- **'qc_passed'** status: The system automatically calls the AWIGN API to send case completion details including the report URL

## Architecture

### For 'in_progress' Status:
1. **Database Trigger**: Fires when case status changes to 'in_progress'
2. **Edge Function** (`update-awign-lead-status`): Receives trigger notification and calls AWIGN API
3. **AWIGN API**: Updates the lead status

### For 'qc_passed' Status:
1. **Database Trigger**: Fires when case status changes to 'qc_passed' (requires `report_url` to be set)
2. **Edge Function** (`update-awign-lead-completion`): Receives trigger notification with case details and calls AWIGN API
3. **AWIGN API**: Receives case completion details including report URL, verification type, dates, and QC comments

## Setup Steps

### 1. Deploy Edge Functions

Deploy both edge functions:

```bash
# Deploy edge function for in_progress status
supabase functions deploy update-awign-lead-status

# Deploy edge function for qc_passed status
supabase functions deploy update-awign-lead-completion
```

### 2. Set Edge Function Secrets

In Supabase Dashboard → Edge Functions → Secrets, add the following secrets:

- `AWIGN_ACCESS_TOKEN`: `qrdXbDI70FL3sVTqSZsF5w`
- `AWIGN_CLIENT`: `jHUG1tpNALZ6GWhTVFV_8w`
- `AWIGN_UID`: `finverify-api-user@awign.com`
- `AWIGN_CALLER_ID`: `finverify-api-project`
- `AWIGN_EXECUTION_ID`: `696dd5543d08594e288feea0`
- `AWIGN_PROJECT_ROLE_ID`: `client` (or the actual project role ID)
- `AWIGN_SCREEN_ID`: `696dd514dcdeb544ad36a8e3`

### 3. Run Database Migrations

Execute the migration files to create the triggers:

**For in_progress status (if not already done):**
```sql
-- Run this in Supabase SQL Editor
\i database/migrations/features/add_awign_status_notification.sql
```

**For qc_passed status:**
```sql
-- Run this in Supabase SQL Editor
\i database/migrations/features/add_awign_qc_passed_notification.sql
```

Or copy and paste the contents of the migration files into the Supabase SQL Editor.

### 4. Configure Supabase URL and Anon Key

The trigger function needs to know your Supabase project URL and anon key to call the edge function. 

**Easy Method**: Edit and run `database/migrations/features/setup_awign_config.sql`:
1. Open the file and replace `YOUR_PROJECT_REF` and `YOUR_ANON_KEY` with your actual values
2. Run it in Supabase SQL Editor

**Manual Method**: Use the `system_configs` table to store these values:

```sql
-- Get your current user ID (or use a super_admin user ID)
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Get a super_admin user ID, or any user if none found
  SELECT p.user_id INTO admin_user_id 
  FROM public.profiles p 
  WHERE p.role = 'super_admin' AND p.is_active = true 
  LIMIT 1;
  
  IF admin_user_id IS NULL THEN
    SELECT id INTO admin_user_id FROM auth.users LIMIT 1;
  END IF;
  
  -- Insert or update Supabase URL
  INSERT INTO public.system_configs (
    config_category,
    config_key,
    config_value,
    description,
    value_type,
    is_sensitive,
    environment,
    created_by,
    updated_by
  )
  VALUES (
    'awign_integration',
    'supabase_url',
    jsonb_build_object('value', 'https://YOUR_PROJECT_REF.supabase.co'),
    'Supabase project URL for AWIGN integration',
    'string',
    false,
    'production',
    admin_user_id,
    admin_user_id
  )
  ON CONFLICT (config_category, config_key, environment) 
  DO UPDATE SET 
    config_value = EXCLUDED.config_value,
    updated_by = admin_user_id,
    updated_at = now();
  
  -- Insert or update Supabase anon key
  INSERT INTO public.system_configs (
    config_category,
    config_key,
    config_value,
    description,
    value_type,
    is_sensitive,
    environment,
    created_by,
    updated_by
  )
  VALUES (
    'awign_integration',
    'supabase_anon_key',
    jsonb_build_object('value', 'YOUR_ANON_KEY'),
    'Supabase anon key for AWIGN integration',
    'string',
    true,
    'production',
    admin_user_id,
    admin_user_id
  )
  ON CONFLICT (config_category, config_key, environment) 
  DO UPDATE SET 
    config_value = EXCLUDED.config_value,
    updated_by = admin_user_id,
    updated_at = now();
END $$;
```

**Important**: Replace:
- `YOUR_PROJECT_REF` with your Supabase project reference ID (found in your Supabase project URL)
- `YOUR_ANON_KEY` with your Supabase anon key (found in Dashboard → Settings → API → "anon" key)

### 5. Enable pg_net Extension

The migration will attempt to enable `pg_net` extension automatically. If it fails, enable it manually:

```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

## Testing

### Test the Integration for 'in_progress' Status

1. Create or find a case with `source = 'api'` and `status != 'in_progress'`
2. Ensure the case has a `client_case_id` set
3. Update the case status to `'in_progress'`:

```sql
UPDATE public.cases
SET status = 'in_progress',
    status_updated_at = now()
WHERE source = 'api'
  AND status != 'in_progress'
  AND client_case_id IS NOT NULL
LIMIT 1;
```

4. Check the Supabase Edge Function logs to verify the API call was made
5. Verify the AWIGN API received the status update

### Test the Integration for 'qc_passed' Status

1. Create or find a case with `source = 'api'` and `status != 'qc_passed'`
2. Ensure the case has:
   - `client_case_id` set
   - `report_url` set (generate PDF report first)
   - `contract_type` set
   - `is_positive` set (true/false)
   - `submitted_at` set (or it will use `status_updated_at`)
3. Ensure there's an allocation log with `accepted_at` (or it will use `vendor_tat_start_date`)
4. Optionally add a QC review with `result = 'pass'` and comments
5. Update the case status to `'qc_passed'`:

```sql
UPDATE public.cases
SET status = 'qc_passed',
    status_updated_at = now()
WHERE source = 'api'
  AND status != 'qc_passed'
  AND client_case_id IS NOT NULL
  AND report_url IS NOT NULL
LIMIT 1;
```

6. Check the Supabase Edge Function logs to verify the API call was made
7. Verify the AWIGN API received the completion update with all required fields

### Test Edge Functions Directly

**Test in_progress edge function:**
```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/update-awign-lead-status' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "caseId": "test-case-id",
    "clientCaseId": "test-client-case-id",
    "status": "in_progress"
  }'
```

**Test qc_passed edge function:**
```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/update-awign-lead-completion' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "caseId": "test-case-id",
    "clientCaseId": "test-client-case-id",
    "contractType": "residential_address_check",
    "isPositive": true,
    "allocatedAt": "2024-10-23T09:03:22.416Z",
    "submittedAt": "2024-10-23T09:03:22.416Z",
    "reportUrl": "https://your-project.supabase.co/storage/v1/object/public/api-reports/case-id/report.pdf",
    "qcComments": "Completed the verification"
  }'
```

## Troubleshooting

### Trigger Not Firing

**For in_progress status:**
- Verify the trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'cases_notify_awign_trigger';`
- Check that the case has `source = 'api'` and `client_case_id IS NOT NULL`
- Verify the status actually changed (trigger only fires on status changes)

**For qc_passed status:**
- Verify the trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'cases_notify_awign_qc_passed_trigger';`
- Check that the case has `source = 'api'`, `client_case_id IS NOT NULL`, and `report_url IS NOT NULL`
- Ensure the report was generated before status change (report_url must be set)
- Verify the status actually changed (trigger only fires on status changes)

### Edge Function Not Being Called

- Check Supabase logs for warnings about missing URL or anon key
- Verify `pg_net` extension is enabled: `SELECT * FROM pg_extension WHERE extname = 'pg_net';`
- Verify config values are set correctly:
  ```sql
  SELECT config_key, config_value 
  FROM public.system_configs 
  WHERE config_category = 'awign_integration';
  ```
- Check that the config values are active and not expired:
  ```sql
  SELECT config_key, config_value, is_active, effective_until
  FROM public.system_configs 
  WHERE config_category = 'awign_integration'
    AND is_active = true
    AND (effective_until IS NULL OR effective_until >= now());
  ```

### AWIGN API Errors

**For in_progress status:**
- Check edge function logs in Supabase Dashboard → Edge Functions → update-awign-lead-status → Logs
- Verify all environment variables are set correctly
- Check that the `client_case_id` matches a valid lead ID in AWIGN system
- Verify the AWIGN API endpoint URL is correct

**For qc_passed status:**
- Check edge function logs in Supabase Dashboard → Edge Functions → update-awign-lead-completion → Logs
- Verify all environment variables are set correctly (same as in_progress)
- Check that the `client_case_id` matches a valid lead ID in AWIGN system
- Verify the AWIGN API endpoint URL is correct (different endpoint structure)
- Ensure all required fields are present: `contract_type`, `is_positive`, `report_url`, `submitted_at`
- Check that allocation_logs has an accepted entry (or vendor_tat_start_date is set)
- Verify report_url is accessible (public bucket)

## Monitoring

- **Database Logs**: Check PostgreSQL logs for trigger warnings
- **Edge Function Logs**: 
  - `update-awign-lead-status`: Supabase Dashboard → Edge Functions → update-awign-lead-status → Logs
  - `update-awign-lead-completion`: Supabase Dashboard → Edge Functions → update-awign-lead-completion → Logs
- **AWIGN API**: Check AWIGN system for status updates

## API Endpoints and Payloads

### For 'in_progress' Status

**Endpoint:** `PATCH /workforce/executions/{executionId}/project_roles/{projectRoleId}/screens/{screenId}/leads/{clientCaseId}/status`

**Payload:**
```json
{
  "lead": {
    "_status": "in_progress"
  }
}
```

### For 'qc_passed' Status

**Endpoint:** `PATCH /executions/{executionId}/screens/{screenId}/leads/{clientCaseId}`

**Payload:**
```json
{
  "lead": {
    "case_id": "client_case_id",
    "file_no": "client_case_id",
    "case_status": "Positive" | "Negative",
    "verification_type": "Residence/Office" | "Business",
    "date_time_of_allocation": "2024-10-23T09:03:22.416Z",
    "date_time_of_report": "2024-10-23T09:03:22.416Z",
    "comments": "QC comments or default message",
    "report_link": "https://storage-url/report.pdf"
  }
}
```

**Field Mappings:**
- `case_id`: `client_case_id` from cases table
- `file_no`: `client_case_id` from cases table
- `case_status`: "Positive" if `is_positive = true`, "Negative" if `is_positive = false`
- `verification_type`: "Residence/Office" for residential contracts, "Business" for business contracts
- `date_time_of_allocation`: `accepted_at` from allocation_logs (fallback to `vendor_tat_start_date`)
- `date_time_of_report`: `submitted_at` from cases (fallback to `status_updated_at`)
- `comments`: Comments from most recent QC pass review (fallback to "Completed the verification")
- `report_link`: `report_url` from cases table (must be set before status reaches qc_passed)

## Notes

- The triggers are designed to be non-blocking - if the API call fails, it won't prevent the case status update
- The triggers only fire when transitioning TO the target status, not when already in that status
- The API calls are asynchronous (fire-and-forget) to avoid blocking database transactions
- For `qc_passed` status, the `report_url` must be generated before the status change (reports are automatically uploaded when PDF is generated for API-sourced cases)
- If `report_url` is null when status changes to `qc_passed`, the API call will be skipped

