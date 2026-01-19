# AWIGN API Integration Setup Guide

This guide explains how to set up the AWIGN API integration for automatic status updates when API-sourced cases transition to 'in_progress' status.

## Overview

When a case with `source = 'api'` transitions to `'in_progress'` status, the system automatically calls the AWIGN API to update the lead status.

## Architecture

1. **Database Trigger**: Fires when case status changes to 'in_progress'
2. **Edge Function**: Receives trigger notification and calls AWIGN API
3. **AWIGN API**: Updates the lead status

## Setup Steps

### 1. Deploy Edge Function

The edge function `update-awign-lead-status` should already be created. Deploy it using:

```bash
supabase functions deploy update-awign-lead-status
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

### 3. Run Database Migration

Execute the migration file to create the trigger:

```sql
-- Run this in Supabase SQL Editor
\i database/migrations/features/add_awign_status_notification.sql
```

Or copy and paste the contents of `database/migrations/features/add_awign_status_notification.sql` into the Supabase SQL Editor.

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

### Test the Integration

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

### Test Edge Function Directly

You can also test the edge function directly:

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

## Troubleshooting

### Trigger Not Firing

- Verify the trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'cases_notify_awign_trigger';`
- Check that the case has `source = 'api'` and `client_case_id IS NOT NULL`
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

- Check edge function logs in Supabase Dashboard
- Verify all environment variables are set correctly
- Check that the `client_case_id` matches a valid lead ID in AWIGN system
- Verify the AWIGN API endpoint URL is correct

## Monitoring

- **Database Logs**: Check PostgreSQL logs for trigger warnings
- **Edge Function Logs**: Supabase Dashboard → Edge Functions → update-awign-lead-status → Logs
- **AWIGN API**: Check AWIGN system for status updates

## Notes

- The trigger is designed to be non-blocking - if the API call fails, it won't prevent the case status update
- The trigger only fires when transitioning TO 'in_progress', not when already in that status
- The API call is asynchronous (fire-and-forget) to avoid blocking database transactions

