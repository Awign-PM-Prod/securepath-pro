# Push Notifications Setup Guide

## Overview
This guide explains how to set up push notifications for gig workers in the SecurePath Pro application.

## Features Implemented

### 1. Progressive Web App (PWA)
- ✅ Service Worker for background notifications
- ✅ Web App Manifest for mobile installation
- ✅ Push notification support
- ✅ Offline functionality

### 2. Notification Types
- ✅ **Case Allocated** - When a new case is assigned
- ✅ **Case Timeout** - When a case is about to expire
- ✅ **QC Rework** - When QC requires rework
- ✅ **General** - Other notifications

### 3. Mobile-First Design
- ✅ Notification permission request on mobile
- ✅ Responsive notification cards
- ✅ Deep linking to specific cases

## Setup Instructions

### Step 1: Database Migration
Run the database migration to create required tables:

```sql
-- Run this in your Supabase SQL editor or psql
\i database/migrations/core/20241201_add_device_tokens_and_notification_settings.sql
```

### Step 2: Generate VAPID Keys
Generate VAPID keys for web push notifications:

```bash
# Install web-push globally
npm install -g web-push

# Generate VAPID keys
npx web-push generate-vapid-keys
```

This will output:
```
=======================================

Public Key:
BEl62iUYgUivxIkv69yViEuiBIa40HI0F8yWpg7jw_swcfOKvEdF7fYfB8Lx6uXrA3Z5kq8LQ3oYyU0K9vN2sE

Private Key:
YOUR_PRIVATE_KEY_HERE

=======================================
```

### Step 3: Configure VAPID Keys
Update the VAPID keys in the database:

```sql
-- Update with your generated VAPID public key
UPDATE app_settings 
SET value = 'YOUR_VAPID_PUBLIC_KEY_HERE' 
WHERE key = 'vapid_public_key';

-- Update with your FCM server key (if using Firebase)
UPDATE app_settings 
SET value = 'YOUR_FCM_SERVER_KEY_HERE' 
WHERE key = 'fcm_server_key';
```

### Step 4: Deploy Supabase Edge Function
Deploy the push notification edge function:

```bash
# Deploy the edge function
supabase functions deploy send-push-notification
```

### Step 5: Environment Variables
Add the following environment variables to your Supabase project:

```bash
# In Supabase Dashboard > Settings > Edge Functions
FCM_SERVER_KEY=your_fcm_server_key_here
VAPID_PRIVATE_KEY=your_vapid_private_key_here
```

## How It Works

### 1. Permission Request
- Gig workers see a notification permission card on mobile
- They can enable/disable notifications
- Permissions are stored in the database

### 2. Case Allocation Flow
1. Case is allocated to a gig worker
2. System checks if gig worker has notifications enabled
3. Push notification is sent via Supabase Edge Function
4. Notification appears on mobile device (even when app is closed)

### 3. Notification Content
- **Title**: "New Case Allocated"
- **Body**: "Case #12345 - ABC Corp - John Doe"
- **Actions**: "View Details", "Accept Case"
- **Deep Link**: Opens directly to the gig dashboard

## Testing

### 1. Enable Notifications
1. Open the app on mobile
2. Sign in as a gig worker
3. Look for the notification permission card
4. Tap "Enable Notifications"
5. Grant permission when prompted

### 2. Test Case Allocation
1. Allocate a case to the gig worker
2. Check if push notification appears
3. Tap the notification to open the app
4. Verify it navigates to the correct case

### 3. Test Different Scenarios
- Case timeout warnings
- QC rework notifications
- General notifications

## Troubleshooting

### Common Issues

1. **Notifications not appearing**
   - Check if VAPID keys are correctly configured
   - Verify service worker is registered
   - Check browser console for errors

2. **Permission denied**
   - User needs to manually enable in browser settings
   - Clear browser data and try again

3. **Edge function errors**
   - Check Supabase logs
   - Verify environment variables
   - Test the function manually

### Debug Steps

1. Check service worker registration:
```javascript
navigator.serviceWorker.getRegistrations().then(registrations => {
  console.log('Service Workers:', registrations);
});
```

2. Check push subscription:
```javascript
navigator.serviceWorker.ready.then(registration => {
  registration.pushManager.getSubscription().then(subscription => {
    console.log('Push Subscription:', subscription);
  });
});
```

3. Check notification permission:
```javascript
console.log('Notification Permission:', Notification.permission);
```

## Security Considerations

1. **VAPID Keys**: Keep private keys secure
2. **Device Tokens**: Stored encrypted in database
3. **RLS Policies**: Proper row-level security for device tokens
4. **Rate Limiting**: Implement rate limiting for notifications

## Future Enhancements

1. **SMS Fallback**: Send SMS when push notifications fail
2. **Email Notifications**: Backup notification method
3. **Notification History**: Track notification delivery
4. **Advanced Scheduling**: Schedule notifications for specific times
5. **Rich Notifications**: Add images and more actions

## Support

For issues or questions:
1. Check the browser console for errors
2. Verify database configuration
3. Test with different browsers/devices
4. Check Supabase function logs
