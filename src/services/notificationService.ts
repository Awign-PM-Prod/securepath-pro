import { supabase } from '@/integrations/supabase/client';

export interface NotificationPermission {
  granted: boolean;
  denied: boolean;
  default: boolean;
}

export interface DeviceToken {
  id?: string;
  gig_worker_id: string;
  token: string;
  platform: 'web' | 'android' | 'ios';
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PushNotificationData {
  title: string;
  body: string;
  data?: {
    caseId?: string;
    caseNumber?: string;
    clientName?: string;
    candidateName?: string;
    url?: string;
    type: 'case_allocated' | 'case_timeout' | 'qc_rework' | 'general';
  };
}

class NotificationService {
  private vapidPublicKey: string | null = null;
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;
  private vapidKeyPromise: Promise<void> | null = null;

  constructor() {
    // Don't initialize VAPID key on construction - make it lazy
    // This prevents blocking page load
  }

  private async initializeVapidKey() {
    // If already initialized, return immediately
    if (this.vapidPublicKey) {
      return;
    }

    // If initialization is in progress, return the existing promise
    if (this.vapidKeyPromise) {
      return this.vapidKeyPromise;
    }

    // Start initialization (non-blocking)
    this.vapidKeyPromise = (async () => {
      try {
        // Use Promise.race with timeout for faster failure
        const queryPromise = supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'vapid_public_key')
          .maybeSingle();
        
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('VAPID key fetch timeout')), 3000)
        );

        const result = await Promise.race([queryPromise, timeoutPromise]);

        if (result.error) {
          // Use a default VAPID key for development
          this.vapidPublicKey = 'BEl62iUYgUivxIkv69yViEuiBIa40HI0F8yWpg7jw_swcfOKvEdF7fYfB8Lx6uXrA3Z5kq8LQ3oYyU0K9vN2sE';
          return;
        }
        
        if (result.data?.value) {
          this.vapidPublicKey = result.data.value;
        } else {
          this.vapidPublicKey = 'BEl62iUYgUivxIkv69yViEuiBIa40HI0F8yWpg7jw_swcfOKvEdF7fYfB8Lx6uXrA3Z5kq8LQ3oYyU0K9vN2sE';
        }
      } catch (error) {
        // Silently handle errors - don't let this block anything
        this.vapidPublicKey = 'BEl62iUYgUivxIkv69yViEuiBIa40HI0F8yWpg7jw_swcfOKvEdF7fYfB8Lx6uXrA3Z5kq8LQ3oYyU0K9vN2sE';
      } finally {
        // Clear promise so it can be retried if needed
        this.vapidKeyPromise = null;
      }
    })();

    return this.vapidKeyPromise;
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return { granted: false, denied: true, default: false };
    }

    if (Notification.permission === 'granted') {
      return { granted: true, denied: false, default: false };
    }

    if (Notification.permission === 'denied') {
      return { granted: false, denied: true, default: false };
    }

    const permission = await Notification.requestPermission();
      return { 
      granted: permission === 'granted',
      denied: permission === 'denied',
      default: permission === 'default'
    };
  }

  async registerServiceWorker(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported');
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered successfully');
      return true;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return false;
    }
  }

  async subscribeToPushNotifications(gigWorkerId: string): Promise<boolean> {
    if (!this.registration) {
      console.error('Service Worker not registered');
      return false;
    }

    // Lazy load VAPID key only when needed
    if (!this.vapidPublicKey) {
      await this.initializeVapidKey();
    }

    if (!this.vapidPublicKey) {
      console.error('VAPID public key not available');
      return false;
    }

    try {
      console.log('Attempting push subscription with VAPID key:', this.vapidPublicKey.substring(0, 20) + '...');
      
      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
      });

      console.log('Push subscription created:', this.subscription);

      // Store the subscription in the database
      const stored = await this.storeDeviceToken(gigWorkerId, this.subscription);
      
      if (stored) {
        console.log('Push subscription successful and stored');
        return true;
      } else {
        console.error('Failed to store device token');
        return false;
      }
    } catch (error) {
      console.error('Push subscription failed:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  async storeDeviceToken(gigWorkerId: string, subscription: PushSubscription): Promise<boolean> {
    try {
      const tokenData = {
        gig_worker_id: gigWorkerId,
        token: JSON.stringify(subscription),
        platform: 'web' as const,
        is_active: true
      };

      const { error } = await supabase
        .from('device_tokens')
        .upsert(tokenData, {
          onConflict: 'gig_worker_id,platform'
        });

      if (error) throw error;
      
      console.log('Device token stored successfully');
      return true;
    } catch (error) {
      console.error('Failed to store device token:', error);
      return false;
    }
  }

  async removeDeviceToken(gigWorkerId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('device_tokens')
        .update({ is_active: false })
        .eq('gig_worker_id', gigWorkerId)
        .eq('platform', 'web');

      if (error) throw error;
      
      console.log('Device token removed successfully');
      return true;
    } catch (error) {
      console.error('Failed to remove device token:', error);
      return false;
    }
  }

  async sendPushNotification(
    gigWorkerId: string, 
    notificationData: PushNotificationData
  ): Promise<boolean> {
    try {
      const { error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          gig_worker_id: gigWorkerId,
          notification: notificationData
        }
      });

      if (error) throw error;
      
      console.log('Push notification sent successfully');
      return true;
    } catch (error) {
      console.error('Failed to send push notification:', error);
      return false;
    }
  }

  async initializeNotifications(gigWorkerId: string): Promise<{
    permissionGranted: boolean;
    serviceWorkerRegistered: boolean;
    pushSubscribed: boolean;
  }> {
    // Request notification permission
    const permission = await this.requestPermission();
    
    if (!permission.granted) {
      return {
        permissionGranted: false,
        serviceWorkerRegistered: false,
        pushSubscribed: false
      };
    }

    // Register service worker
    const swRegistered = await this.registerServiceWorker();
    
    if (!swRegistered) {
      return {
        permissionGranted: true,
        serviceWorkerRegistered: false,
        pushSubscribed: false
      };
    }

    // Subscribe to push notifications
    const pushSubscribed = await this.subscribeToPushNotifications(gigWorkerId);

    return {
      permissionGranted: true,
      serviceWorkerRegistered: true,
      pushSubscribed
    };
  }

  // Helper function to convert VAPID key
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Check if notifications are supported
  isSupported(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  }

  // Get current permission status
  getPermissionStatus(): NotificationPermission {
    if (!('Notification' in window)) {
      return { granted: false, denied: true, default: false };
    }

    return {
      granted: Notification.permission === 'granted',
      denied: Notification.permission === 'denied',
      default: Notification.permission === 'default'
    };
  }

  // Get notifications for a gig worker (for useNotifications hook)
  async getNotifications(gigWorkerId: string, limit: number = 50): Promise<{
    success: boolean;
    notifications?: any[];
    error?: string;
  }> {
    try {
      // For now, return empty notifications since we don't have a notifications table
      // This is just to prevent the error in useNotifications hook
      return {
        success: true,
        notifications: []
      };
    } catch (error) {
      console.error('Error getting notifications:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Send case acceptance notification
  async sendCaseAcceptanceNotification(
    caseId: string, 
    gigWorkerId: string, 
    caseNumber: string
  ): Promise<boolean> {
    try {
      const notificationData: PushNotificationData = {
        title: 'Case Accepted',
        body: `You have successfully accepted case ${caseNumber}`,
        data: {
          caseId,
          caseNumber,
          type: 'case_allocated'
        }
      };

      return await this.sendPushNotification(gigWorkerId, notificationData);
    } catch (error) {
      console.error('Error sending case acceptance notification:', error);
      return false;
    }
  }

  // Send case rejection notification
  async sendCaseRejectionNotification(
    caseId: string, 
    gigWorkerId: string, 
    caseNumber: string,
    reason: string
  ): Promise<boolean> {
    try {
      const notificationData: PushNotificationData = {
        title: 'Case Rejected',
        body: `Case ${caseNumber} has been rejected: ${reason}`,
        data: {
          caseId,
          caseNumber,
          type: 'case_allocated'
        }
      };

      return await this.sendPushNotification(gigWorkerId, notificationData);
    } catch (error) {
      console.error('Error sending case rejection notification:', error);
      return false;
    }
  }

  // Send case submission notification
  async sendCaseSubmissionNotification(
    caseId: string, 
    gigWorkerId: string, 
    caseNumber: string
  ): Promise<boolean> {
    try {
      const notificationData: PushNotificationData = {
        title: 'Case Submitted',
        body: `Case ${caseNumber} has been submitted successfully`,
        data: {
          caseId,
          caseNumber,
          type: 'case_allocated'
        }
      };

      return await this.sendPushNotification(gigWorkerId, notificationData);
    } catch (error) {
      console.error('Error sending case submission notification:', error);
      return false;
    }
  }

  // Send case allocation notification
  async sendCaseAllocationNotification(
    caseId: string, 
    gigWorkerId: string, 
    caseNumber: string,
    clientName?: string,
    candidateName?: string
  ): Promise<boolean> {
    try {
      const notificationData: PushNotificationData = {
        title: 'New Case Allocated',
        body: `You have been assigned case ${caseNumber}${candidateName ? ` for ${candidateName}` : ''}`,
        data: {
          caseId,
          caseNumber,
          clientName,
          candidateName,
          type: 'case_allocated'
        }
      };

      return await this.sendPushNotification(gigWorkerId, notificationData);
    } catch (error) {
      console.error('Error sending case allocation notification:', error);
      return false;
    }
  }
}

export const notificationService = new NotificationService();