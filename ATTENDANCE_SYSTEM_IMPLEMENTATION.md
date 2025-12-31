# Gig Worker Attendance System - Implementation Summary

## Overview
This system implements a daily attendance marking requirement for gig workers. Every day at 6:00 AM, all gig workers' `is_available` status is reset to `False`. When they log in, they must mark their attendance to set `is_available` to `True` and become available for case assignments.

## Implementation Details

### 1. Database Function
**Location**: `database/functions/attendance/reset_gig_partners_availability.sql`

- Function: `reset_gig_partners_availability()`
- Purpose: Resets `is_available` to `False` for all active gig partners
- Logs the reset operation to `audit_logs` table

### 2. Supabase Edge Function
**Location**: `supabase/functions/reset-gig-partners-availability/index.ts`

- Endpoint: `/functions/v1/reset-gig-partners-availability`
- Purpose: Wrapper around the database function for scheduled execution
- Can be called via HTTP POST request

### 3. Service Methods
**Location**: `src/services/gigWorkerService.ts`

Added two new methods:
- `markAttendance(gigWorkerId: string)`: Sets `is_available` to `True` for a gig worker
- `checkAvailability(gigWorkerId: string)`: Checks the current `is_available` status

### 4. Frontend Integration
**Location**: `src/pages/GigWorkerDashboard.tsx`

- Added attendance dialog that appears when `is_available` is `False`
- Dialog is shown automatically when the dashboard loads
- User must click "Mark Attendance" to proceed
- Dialog cannot be closed without marking attendance (intentional UX design)

## User Flow

1. **Daily Reset (6:00 AM)**:
   - Scheduled job calls `reset_gig_partners_availability()`
   - All active gig partners' `is_available` is set to `False`

2. **Gig Worker Login**:
   - Gig worker logs into the portal
   - Dashboard loads and checks `is_available` status
   - If `is_available` is `False`, attendance dialog appears

3. **Marking Attendance**:
   - Gig worker clicks "Mark Attendance" button
   - `is_available` is set to `True`
   - Dialog closes and user can proceed with normal dashboard usage

## Setup Instructions

### Step 1: Run Database Migration
```sql
-- Run the SQL file to create the function
\i database/functions/attendance/reset_gig_partners_availability.sql
```

### Step 2: Deploy Edge Function
```bash
supabase functions deploy reset-gig-partners-availability
```

### Step 3: Set Up Scheduled Job

Choose one of the following options:

#### Option A: pg_cron (If available)
```sql
SELECT cron.schedule(
  'reset-gig-partners-availability',
  '0 6 * * *', -- 6:00 AM UTC daily
  $$SELECT public.reset_gig_partners_availability();$$
);
```

#### Option B: External Cron Service
See `database/functions/attendance/README.md` for detailed instructions on using:
- GitHub Actions
- cron-job.org
- Vercel Cron
- Other external services

### Step 4: Test the System

1. **Test Database Function**:
   ```sql
   SELECT public.reset_gig_partners_availability();
   ```

2. **Test Edge Function**:
   ```bash
   curl -X POST https://<your-project>.supabase.co/functions/v1/reset-gig-partners-availability \
     -H "Authorization: Bearer <your-anon-key>"
   ```

3. **Test Attendance Flow**:
   - Manually set a test gig worker's `is_available` to `False`
   - Log in as that gig worker
   - Verify attendance popup appears
   - Mark attendance and verify `is_available` becomes `True`

## Files Modified/Created

### Created Files:
1. `database/functions/attendance/reset_gig_partners_availability.sql`
2. `supabase/functions/reset-gig-partners-availability/index.ts`
3. `database/functions/attendance/README.md`
4. `ATTENDANCE_SYSTEM_IMPLEMENTATION.md` (this file)

### Modified Files:
1. `src/services/gigWorkerService.ts` - Added `markAttendance()` and `checkAvailability()` methods
2. `src/pages/GigWorkerDashboard.tsx` - Added attendance dialog and availability check logic

## Configuration

### Timezone Adjustment
The default schedule is `'0 6 * * *'` which runs at 6:00 AM UTC. To adjust for your timezone:

- **IST (UTC+5:30)**: Use `'0 0 * * *'` for 5:30 AM IST
- **EST (UTC-5)**: Use `'0 11 * * *'` for 6:00 AM EST

### Customizing the Reset Time
Modify the cron expression in your scheduled job setup. The format is:
```
minute hour day month day-of-week
```

Example: `'0 6 * * *'` = 6:00 AM every day

## Monitoring

### Check Reset History
```sql
SELECT 
  created_at,
  operation,
  new_values->>'reset_at' as reset_at,
  new_values->>'reset_count' as reset_count
FROM public.audit_logs
WHERE operation = 'AVAILABILITY_RESET'
ORDER BY created_at DESC;
```

### Check Gig Worker Availability Status
```sql
SELECT 
  id,
  user_id,
  is_available,
  updated_at
FROM public.gig_partners
WHERE is_active = true
ORDER BY updated_at DESC;
```

## Troubleshooting

### Attendance Popup Not Showing
1. Verify `is_available` is `False` in the database
2. Check browser console for JavaScript errors
3. Verify `checkAvailability()` is being called in the dashboard
4. Check network tab for API call failures

### Scheduled Job Not Running
1. Verify pg_cron extension is enabled (if using Option A)
2. Check cron job status in `cron.job` table
3. Review cron job run history in `cron.job_run_details`
4. For external services, check their logs/dashboard

### Edge Function Errors
1. Check function logs: `supabase functions logs reset-gig-partners-availability`
2. Verify environment variables are set
3. Test the function manually via curl or Supabase dashboard

## Security Considerations

- The database function uses `SECURITY DEFINER` to ensure it can be executed by the service role
- The edge function requires proper authentication
- Only authenticated gig workers can mark their own attendance
- The reset function only affects active gig partners (`is_active = true`)

## Future Enhancements

Potential improvements:
1. Add attendance history tracking
2. Add late attendance warnings
3. Add attendance statistics dashboard
4. Add email/SMS notifications for attendance reminders
5. Add configurable reset time per gig worker or group










