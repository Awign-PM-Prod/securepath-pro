import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { notificationService } from '@/services/notificationService';

interface Notification {
  id: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
  delivered_at?: string;
  metadata?: Record<string, any>;
}

interface NotificationCenterProps {
  gigWorkerId: string;
}

export default function NotificationCenter({ gigWorkerId }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (gigWorkerId) {
      loadNotifications();
    }
  }, [gigWorkerId]);

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      const result = await notificationService.getNotifications(gigWorkerId, 50);
      
      if (result.success && result.notifications) {
        setNotifications(result.notifications);
        const unread = result.notifications.filter(n => n.status === 'pending').length;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      toast({
        title: 'Error',
        description: 'Failed to load notifications',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const result = await notificationService.markAsRead(notificationId);
      
      if (result.success) {
        setNotifications(prev => 
          prev.map(n => 
            n.id === notificationId 
              ? { ...n, status: 'delivered', delivered_at: new Date().toISOString() }
              : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'case_allocated':
        return <Bell className="h-4 w-4 text-blue-500" />;
      case 'case_accepted':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'case_rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'case_timeout':
        return <Clock className="h-4 w-4 text-orange-500" />;
      case 'case_submitted':
        return <CheckCircle className="h-4 w-4 text-purple-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Unread</Badge>;
      case 'delivered':
        return <Badge variant="outline" className="bg-green-100 text-green-800">Read</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={loadNotifications}>
            Refresh
          </Button>
        </CardTitle>
        <CardDescription>
          Stay updated with your case assignments and status changes
        </CardDescription>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No notifications yet</p>
            <p className="text-sm">You'll receive notifications when cases are assigned to you</p>
          </div>
        ) : (
          <ScrollArea className="h-96">
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    notification.status === 'pending' 
                      ? 'bg-blue-50 border-blue-200 hover:bg-blue-100' 
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                  onClick={() => {
                    if (notification.status === 'pending') {
                      markAsRead(notification.id);
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.metadata?.type || 'default')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {notification.subject}
                        </h4>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(notification.status)}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(notification.created_at), 'MMM dd, HH:mm')}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {notification.body}
                      </p>
                      {notification.metadata && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {notification.metadata.case_number && (
                            <span>Case: {notification.metadata.case_number}</span>
                          )}
                          {notification.metadata.action_required && (
                            <span className="ml-2">
                              Action: {notification.metadata.action_required}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
