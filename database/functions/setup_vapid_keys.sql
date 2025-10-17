-- Setup VAPID keys for push notifications
-- This should be run after the migration to add VAPID keys to app_settings

-- Insert VAPID public key (replace with your actual VAPID public key)
INSERT INTO app_settings (key, value, description) 
VALUES (
  'vapid_public_key', 
  'BEl62iUYgUivxIkv69yViEuiBIa40HI0F8yWpg7jw_swcfOKvEdF7fYfB8Lx6uXrA3Z5kq8LQ3oYyU0K9vN2sE', 
  'VAPID public key for web push notifications'
) ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- Insert FCM server key (replace with your actual FCM server key)
INSERT INTO app_settings (key, value, description) 
VALUES (
  'fcm_server_key', 
  'YOUR_FCM_SERVER_KEY_HERE', 
  'Firebase Cloud Messaging server key for push notifications'
) ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- Note: You need to replace the VAPID keys and FCM server key with your actual values
-- Generate VAPID keys using: npx web-push generate-vapid-keys
-- Get FCM server key from Firebase Console > Project Settings > Cloud Messaging
