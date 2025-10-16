import { useState, useEffect } from 'react';
import { notificationService } from '@/services/notificationService';

export function useNotifications(gigWorkerId: string | null) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!gigWorkerId) {
      setUnreadCount(0);
      return;
    }

    const loadUnreadCount = async () => {
      try {
        setIsLoading(true);
        const result = await notificationService.getNotifications(gigWorkerId, 100);
        
        if (result.success && result.notifications) {
          const unread = result.notifications.filter(n => 
            n.status === 'pending' || n.status === 'sent'
          ).length;
          setUnreadCount(unread);
        }
      } catch (error) {
        console.error('Error loading notification count:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUnreadCount();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000);
    
    return () => clearInterval(interval);
  }, [gigWorkerId]);

  return { unreadCount, isLoading };
}
