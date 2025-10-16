import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { notificationService } from '@/services/notificationService';
import { gigWorkerService } from '@/services/gigWorkerService';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bell, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle,
  Filter,
  SortAsc,
  SortDesc,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';
import { format } from 'date-fns';

interface Notification {
  id: string;
  subject: string;
  body: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'cancelled';
  created_at: string;
  case_id?: string;
  metadata?: {
    type?: string;
    case_number?: string;
    [key: string]: any;
  };
}

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'latest' | 'oldest'>('latest');
  const [filterBy, setFilterBy] = useState<'all' | 'unread' | 'read'>('all');
  const [isMobile, setIsMobile] = useState(false);
  const [gigWorkerId, setGigWorkerId] = useState<string>('');

  // Get gig worker ID from gig worker service (same as main dashboard)
  useEffect(() => {
    const initializeGigWorker = async () => {
      if (user?.profile?.role === 'gig_worker' && user.id) {
        try {
          const result = await gigWorkerService.getGigWorkerId(user.id);
          if (result.success && result.gigWorkerId) {
            setGigWorkerId(result.gigWorkerId);
          }
        } catch (error) {
          console.error('Error getting gig worker ID:', error);
        }
      }
    };

    initializeGigWorker();
  }, [user]);

  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isSmallScreen = width < 768;
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      setIsMobile(isSmallScreen || (isMobileDevice && width < 1024) || (isTouchDevice && width < 900));
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, []);

  useEffect(() => {
    if (gigWorkerId) {
      loadNotifications();
    } else {
      setIsLoading(false);
    }
  }, [gigWorkerId]);

  const loadNotifications = async () => {
    if (!gigWorkerId) return;
    
    try {
      setIsLoading(true);
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Notification loading timeout')), 10000)
      );
      
      const result = await Promise.race([
        notificationService.getNotifications(gigWorkerId, 100),
        timeoutPromise
      ]);
      
      if (result.success && result.notifications) {
        setNotifications(result.notifications);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      if (error.message !== 'Notification loading timeout') {
        toast({
          title: 'Error',
          description: 'Failed to load notifications',
          variant: 'destructive',
        });
      }
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
              ? { ...n, status: 'delivered' as const }
              : n
          )
        );
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifications = filteredNotifications.filter(n => 
        n.status === 'pending' || n.status === 'sent'
      );
      
      await Promise.all(
        unreadNotifications.map(n => markAsRead(n.id))
      );
      
      toast({
        title: 'Success',
        description: 'All notifications marked as read',
      });
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const getNotificationIcon = (type?: string) => {
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
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'sent':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Sent</Badge>;
      case 'delivered':
        return <Badge variant="outline" className="bg-green-100 text-green-800">Read</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Filter and sort notifications
  const filteredNotifications = notifications
    .filter(notification => {
      if (filterBy === 'unread') {
        return notification.status === 'pending' || notification.status === 'sent';
      } else if (filterBy === 'read') {
        return notification.status === 'delivered';
      }
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return sortBy === 'latest' ? dateB.getTime() - dateA.getTime() : dateA.getTime() - dateB.getTime();
    });

  const unreadCount = notifications.filter(n => n.status === 'pending' || n.status === 'sent').length;
  const readCount = notifications.filter(n => n.status === 'delivered').length;

  if (user?.profile?.role !== 'gig_worker') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">Notifications are only available for gig workers</p>
        </div>
      </div>
    );
  }

  if (!gigWorkerId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-500">Loading gig worker information...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${isMobile ? 'p-4' : 'p-6'}`}>
      {/* Header */}
      {isMobile ? (
        <div className="space-y-4">
          {/* Back Button */}
          <div className="flex justify-start">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate('/gig')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
          
          {/* Centered Title and Description */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
              <Bell className="h-6 w-6" />
              Notifications
            </h1>
            <p className="text-muted-foreground text-sm">
              Stay updated with your case assignments and status changes. These are the same notifications shown on your main dashboard.
            </p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={loadNotifications}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllAsRead}>
                Mark All Read
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate('/gig')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Bell className="h-6 w-6" />
                Notifications
              </h1>
              <p className="text-muted-foreground">
                Stay updated with your case assignments and status changes. These are the same notifications shown on your main dashboard.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadNotifications}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllAsRead}>
                Mark All Read
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className={`grid gap-4 ${isMobile ? 'grid-cols-2' : 'grid-cols-3'}`}>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{notifications.length}</p>
              </div>
              <Bell className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unread</p>
                <p className="text-2xl font-bold text-blue-600">{unreadCount}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className={isMobile ? 'col-span-2' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Read</p>
                <p className="text-2xl font-bold text-green-600">{readCount}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Sort */}
      <Card>
        <CardContent className="p-4">
          <div className={`flex gap-4 ${isMobile ? 'flex-col' : 'items-center'}`}>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">Filter:</span>
              <Select value={filterBy} onValueChange={(value: 'all' | 'unread' | 'read') => setFilterBy(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Sort:</span>
              <Select value={sortBy} onValueChange={(value: 'latest' | 'oldest') => setSortBy(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">
                    <div className="flex items-center gap-2">
                      <SortDesc className="h-4 w-4" />
                      Latest
                    </div>
                  </SelectItem>
                  <SelectItem value="oldest">
                    <div className="flex items-center gap-2">
                      <SortAsc className="h-4 w-4" />
                      Oldest
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Notifications</CardTitle>
        <CardDescription>
          {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''} 
          {filterBy !== 'all' && ` (${filterBy})`} • Updates in real-time
        </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No notifications yet</p>
              <p className="text-sm">You'll receive notifications when cases are assigned to you</p>
            </div>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      notification.status === 'pending' || notification.status === 'sent'
                        ? 'bg-blue-50 border-blue-200 hover:bg-blue-100' 
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      if (notification.status === 'pending' || notification.status === 'sent') {
                        markAsRead(notification.id);
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.metadata?.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-medium text-gray-900 truncate">
                            {notification.subject}
                          </h4>
                          <div className="flex items-center gap-2 ml-2">
                            {getStatusBadge(notification.status)}
                            <span className="text-xs text-gray-500">
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
    </div>
  );
}
