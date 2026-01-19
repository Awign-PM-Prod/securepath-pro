# Gig Partners Availability Reset System

## Overview
This system automatically resets the `is_available` column to `False` for all gig partners every day at 6:00 AM. When gig workers log in and their `is_available` is `False`, they will see a popup to mark their attendance, which sets their `is_available` to `True`.

## Components

### 1. Database Function
**File**: `reset_gig_partners_availability.sql`

This PostgreSQL function resets `is_available` to `False` for all active gig partners.

**Usage**:
```sql
SELECT public.reset_gig_partners_availability();
```

### 2. Supabase Edge Function
**File**: `supabase/functions/reset-gig-partners-availability/index.ts`

This edge function can be called to trigger the availability reset. It's designed to be called by a scheduled job.

**Deploy**:
```bash
supabase functions deploy reset-gig-partners-availability
```

**Test**:
```bash
curl -X POST https://<your-project>.supabase.co/functions/v1/reset-gig-partners-availability \
  -H "Authorization: Bearer <your-anon-key>"
```

### 3. Frontend Integration
- **Service Method**: `gigWorkerService.markAttendance()` - Marks attendance for a gig worker
- **Service Method**: `gigWorkerService.checkAvailability()` - Checks if a gig worker is available
- **Dashboard**: `GigWorkerDashboard.tsx` - Shows attendance popup when `is_available` is `False`

## Setting Up the Scheduled Job

### Option 1: Using pg_cron (Recommended if available)

If your Supabase project has the `pg_cron` extension enabled:

```sql
-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the job to run daily at 6:00 AM (UTC)
SELECT cron.schedule(
  'reset-gig-partners-availability',
  '0 6 * * *', -- 6:00 AM every day
  $$SELECT public.reset_gig_partners_availability();$$
);

-- To view scheduled jobs
SELECT * FROM cron.job;

-- To unschedule the job
SELECT cron.unschedule('reset-gig-partners-availability');
```

**Note**: Adjust the timezone if needed. The cron expression `'0 6 * * *'` runs at 6:00 AM UTC. For IST (UTC+5:30), use `'0 0 * * *'` (midnight UTC = 5:30 AM IST).

### Option 2: Using External Cron Service

#### Using GitHub Actions (Free)

Create `.github/workflows/reset-availability.yml`:

```yaml
name: Reset Gig Partners Availability

on:
  schedule:
    # Runs daily at 6:00 AM UTC (11:30 AM IST)
    - cron: '0 6 * * *'
  workflow_dispatch: # Allows manual trigger

jobs:
  reset:
    runs-on: ubuntu-latest
    steps:
      - name: Reset Availability
        run: |
          curl -X POST https://${{ secrets.SUPABASE_URL }}/functions/v1/reset-gig-partners-availability \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}"
```

#### Using cron-job.org (Free)

1. Go to https://cron-job.org
2. Create a new cron job
3. Set schedule: `0 6 * * *` (6:00 AM daily)
4. Set URL: `https://<your-project>.supabase.co/functions/v1/reset-gig-partners-availability`
5. Set HTTP method: POST
6. Add header: `Authorization: Bearer <your-anon-key>`

#### Using Vercel Cron (If using Vercel)

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/reset-availability",
      "schedule": "0 6 * * *"
    }
  ]
}
```

### Option 3: Manual Trigger (For Testing)

You can manually trigger the reset by:

1. **Via SQL**:
   ```sql
   SELECT public.reset_gig_partners_availability();
   ```

2. **Via Edge Function**:
   ```bash
   curl -X POST https://<your-project>.supabase.co/functions/v1/reset-gig-partners-availability \
     -H "Authorization: Bearer <your-anon-key>"
   ```

3. **Via Supabase Dashboard**:
   - Go to Database → Functions
   - Find `reset_gig_partners_availability`
   - Click "Run"

## Testing

### Test the Database Function
```sql
-- Check current availability status
SELECT id, is_available FROM public.gig_partners WHERE is_active = true LIMIT 5;

-- Run the reset function
SELECT public.reset_gig_partners_availability();

-- Verify availability was reset
SELECT id, is_available FROM public.gig_partners WHERE is_active = true LIMIT 5;
```

### Test the Edge Function
```bash
# Make sure to replace with your actual project URL and anon key
curl -X POST https://<your-project>.supabase.co/functions/v1/reset-gig-partners-availability \
  -H "Authorization: Bearer <your-anon-key>" \
  -H "Content-Type: application/json"
```

### Test the Attendance Flow
1. Manually set a gig worker's `is_available` to `False`:
   ```sql
   UPDATE public.gig_partners 
   SET is_available = false 
   WHERE user_id = '<test-user-id>';
   ```
2. Log in as that gig worker
3. You should see the attendance popup
4. Click "Mark Attendance"
5. Verify `is_available` is now `True`

## Timezone Considerations

The cron schedule `'0 6 * * *'` runs at 6:00 AM UTC. If you need a different timezone:

- **IST (UTC+5:30)**: To run at 6:00 AM IST, use `'0 0 * * *'` (midnight UTC = 5:30 AM IST)
- **EST (UTC-5)**: To run at 6:00 AM EST, use `'0 11 * * *'` (11:00 AM UTC = 6:00 AM EST)

You can also adjust the cron expression based on your needs.

## Monitoring

Check the `audit_logs` table to see when the reset was last run:

```sql
SELECT 
  created_at,
  operation,
  new_values->>'reset_at' as reset_at,
  new_values->>'reset_count' as reset_count
FROM public.audit_logs
WHERE operation = 'AVAILABILITY_RESET'
ORDER BY created_at DESC
LIMIT 10;
```

## Troubleshooting

### Function Not Running
1. Check if pg_cron extension is enabled: `SELECT * FROM pg_extension WHERE extname = 'pg_cron';`
2. Check cron job status: `SELECT * FROM cron.job WHERE jobname = 'reset-gig-partners-availability';`
3. Check cron job run history: `SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'reset-gig-partners-availability') ORDER BY start_time DESC LIMIT 10;`

### Edge Function Not Working
1. Verify the function is deployed: `supabase functions list`
2. Check function logs: `supabase functions logs reset-gig-partners-availability`
3. Verify environment variables are set correctly

### Attendance Popup Not Showing
1. Verify `is_available` is `False` for the gig worker
2. Check browser console for errors
3. Verify the `checkAvailability` function is being called
4. Check network tab to see if the API call is successful


















