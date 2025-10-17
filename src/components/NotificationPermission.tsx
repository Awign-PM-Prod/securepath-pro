import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, BellOff, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { notificationService } from '@/services/notificationService';
import { useToast } from '@/hooks/use-toast';

interface NotificationPermissionProps {
  gigWorkerId: string;
  onPermissionChange?: (granted: boolean) => void;
}

export function NotificationPermission({ gigWorkerId, onPermissionChange }: NotificationPermissionProps) {
  const [permissionStatus, setPermissionStatus] = useState<'checking' | 'granted' | 'denied' | 'default'>('checking');
  const [isSupported, setIsSupported] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initializationResult, setInitializationResult] = useState<{
    permissionGranted: boolean;
    serviceWorkerRegistered: boolean;
    pushSubscribed: boolean;
  } | null>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    checkNotificationSupport();
  }, []);

  const checkNotificationSupport = () => {
    const supported = notificationService.isSupported();
    setIsSupported(supported);
    
    if (supported) {
      const status = notificationService.getPermissionStatus();
      setPermissionStatus(
        status.granted ? 'granted' : 
        status.denied ? 'denied' : 'default'
      );
    }
  };

  const handleRequestPermission = async () => {
    if (!isSupported) {
      toast({
        title: 'Not Supported',
        description: 'Push notifications are not supported on this device.',
        variant: 'destructive',
      });
      return;
    }

    setIsInitializing(true);
    
    try {
      const result = await notificationService.initializeNotifications(gigWorkerId);
      setInitializationResult(result);
      
      if (result.permissionGranted) {
        setPermissionStatus('granted');
        onPermissionChange?.(true);
        
        toast({
          title: 'Notifications Enabled',
          description: 'You will now receive push notifications for new cases and updates.',
        });
      } else {
        setPermissionStatus('denied');
        onPermissionChange?.(false);
        
        toast({
          title: 'Permission Denied',
          description: 'Please enable notifications in your browser settings to receive case updates.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error initializing notifications:', error);
      toast({
        title: 'Error',
        description: 'Failed to set up notifications. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsInitializing(false);
    }
  };

  const handleDisableNotifications = async () => {
    try {
      await notificationService.removeDeviceToken(gigWorkerId);
      setPermissionStatus('default');
      onPermissionChange?.(false);
      
      toast({
        title: 'Notifications Disabled',
        description: 'You will no longer receive push notifications.',
      });
    } catch (error) {
      console.error('Error disabling notifications:', error);
      toast({
        title: 'Error',
        description: 'Failed to disable notifications. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (!isSupported) {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            Notifications Not Supported
          </CardTitle>
          <CardDescription className="text-xs">
            Push notifications are not supported on this device or browser.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (permissionStatus === 'checking') {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-sm text-gray-600">Checking notification status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (permissionStatus === 'granted') {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            Notifications Enabled
          </CardTitle>
          <CardDescription className="text-xs">
            You will receive push notifications for new cases and updates.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {initializationResult && (
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span>Permission granted</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span>Service worker registered</span>
              </div>
              <div className="flex items-center gap-2">
                {initializationResult.pushSubscribed ? (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                ) : (
                  <XCircle className="h-3 w-3 text-red-500" />
                )}
                <span>Push subscription {initializationResult.pushSubscribed ? 'active' : 'failed'}</span>
              </div>
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleDisableNotifications}
            className="mt-3 w-full text-xs"
          >
            <BellOff className="h-3 w-3 mr-1" />
            Disable Notifications
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (permissionStatus === 'denied') {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-600" />
            Notifications Blocked
          </CardTitle>
          <CardDescription className="text-xs">
            Please enable notifications in your browser settings to receive case updates.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Alert className="text-xs">
            <AlertCircle className="h-3 w-3" />
            <AlertDescription>
              To enable notifications: Click the lock icon in your browser's address bar and allow notifications.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Default state - permission not requested yet
  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bell className="h-4 w-4 text-blue-600" />
          Enable Notifications
        </CardTitle>
        <CardDescription className="text-xs">
          Get instant notifications when new cases are allocated to you.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2 text-xs text-gray-600 mb-3">
          <div>• New case assignments</div>
          <div>• Case timeout warnings</div>
          <div>• QC rework requests</div>
        </div>
        <Button
          size="sm"
          onClick={handleRequestPermission}
          disabled={isInitializing}
          className="w-full text-xs"
        >
          {isInitializing ? (
            <>
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
              Setting up...
            </>
          ) : (
            <>
              <Bell className="h-3 w-3 mr-1" />
              Enable Notifications
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
