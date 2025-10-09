import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Database,
  Upload
} from 'lucide-react';

interface OfflineItem {
  id: string;
  type: 'case_update' | 'photo_upload' | 'status_change' | 'location_update';
  data: any;
  timestamp: string;
  retryCount: number;
  status: 'pending' | 'syncing' | 'success' | 'failed';
}

interface OfflineSyncProps {
  isOnline: boolean;
  onSyncComplete?: () => void;
}

export default function OfflineSync({ isOnline, onSyncComplete }: OfflineSyncProps) {
  const [offlineItems, setOfflineItems] = useState<OfflineItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Load offline items from localStorage on mount
  useEffect(() => {
    const storedItems = localStorage.getItem('offline_items');
    if (storedItems) {
      try {
        const items = JSON.parse(storedItems);
        setOfflineItems(items);
      } catch (error) {
        console.error('Failed to load offline items:', error);
      }
    }
  }, []);

  // Save offline items to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('offline_items', JSON.stringify(offlineItems));
  }, [offlineItems]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && offlineItems.length > 0) {
      handleSync();
    }
  }, [isOnline]);

  const addOfflineItem = (type: OfflineItem['type'], data: any) => {
    const newItem: OfflineItem = {
      id: Date.now().toString(),
      type,
      data,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      status: 'pending',
    };
    
    setOfflineItems(prev => [...prev, newItem]);
  };

  const handleSync = async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    setSyncProgress(0);

    const pendingItems = offlineItems.filter(item => item.status === 'pending' || item.status === 'failed');
    
    for (let i = 0; i < pendingItems.length; i++) {
      const item = pendingItems[i];
      
      try {
        // Update item status to syncing
        setOfflineItems(prev => 
          prev.map(prevItem => 
            prevItem.id === item.id 
              ? { ...prevItem, status: 'syncing' as const }
              : prevItem
          )
        );

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

        // Simulate success/failure
        const success = Math.random() > 0.1; // 90% success rate

        if (success) {
          // Mark as success and remove from offline items
          setOfflineItems(prev => prev.filter(prevItem => prevItem.id !== item.id));
        } else {
          // Mark as failed and increment retry count
          setOfflineItems(prev => 
            prev.map(prevItem => 
              prevItem.id === item.id 
                ? { 
                    ...prevItem, 
                    status: 'failed' as const,
                    retryCount: prevItem.retryCount + 1
                  }
                : prevItem
            )
          );
        }

        setSyncProgress(((i + 1) / pendingItems.length) * 100);
      } catch (error) {
        console.error(`Failed to sync item ${item.id}:`, error);
        
        // Mark as failed
        setOfflineItems(prev => 
          prev.map(prevItem => 
            prevItem.id === item.id 
              ? { 
                  ...prevItem, 
                  status: 'failed' as const,
                  retryCount: prevItem.retryCount + 1
                }
              : prevItem
          )
        );
      }
    }

    setLastSyncTime(new Date());
    setIsSyncing(false);
    setSyncProgress(0);
    
    if (onSyncComplete) {
      onSyncComplete();
    }
  };

  const clearCompletedItems = () => {
    setOfflineItems(prev => prev.filter(item => item.status !== 'success'));
  };

  const retryFailedItems = () => {
    setOfflineItems(prev => 
      prev.map(item => 
        item.status === 'failed' 
          ? { ...item, status: 'pending' as const }
          : item
      )
    );
  };

  const getItemTypeLabel = (type: OfflineItem['type']) => {
    const labels = {
      case_update: 'Case Update',
      photo_upload: 'Photo Upload',
      status_change: 'Status Change',
      location_update: 'Location Update',
    };
    return labels[type];
  };

  const getItemIcon = (type: OfflineItem['type']) => {
    const icons = {
      case_update: Database,
      photo_upload: Upload,
      status_change: RefreshCw,
      location_update: Upload,
    };
    return icons[type];
  };

  const getStatusBadge = (status: OfflineItem['status']) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      syncing: 'bg-blue-100 text-blue-800',
      success: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    };
    
    return (
      <Badge className={colors[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const pendingCount = offlineItems.filter(item => item.status === 'pending').length;
  const failedCount = offlineItems.filter(item => item.status === 'failed').length;
  const syncingCount = offlineItems.filter(item => item.status === 'syncing').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isOnline ? (
            <Wifi className="h-5 w-5 text-green-600" />
          ) : (
            <WifiOff className="h-5 w-5 text-red-600" />
          )}
          Offline Sync
        </CardTitle>
        <CardDescription>
          {isOnline 
            ? 'You are online. Offline changes will sync automatically.'
            : 'You are offline. Changes will sync when you come back online.'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sync Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Pending Items:</span>
            <Badge variant="outline">{pendingCount}</Badge>
            {failedCount > 0 && (
              <>
                <span className="text-sm text-muted-foreground">Failed:</span>
                <Badge variant="destructive">{failedCount}</Badge>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isOnline && (
              <Button 
                onClick={handleSync} 
                disabled={isSyncing || pendingCount === 0}
                size="sm"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync Now
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Sync Progress */}
        {isSyncing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Syncing items...</span>
              <span>{Math.round(syncProgress)}%</span>
            </div>
            <Progress value={syncProgress} className="h-2" />
          </div>
        )}

        {/* Last Sync Time */}
        {lastSyncTime && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Last sync: {lastSyncTime.toLocaleTimeString()}</span>
          </div>
        )}

        {/* Offline Items List */}
        {offlineItems.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Offline Items</h4>
              <div className="flex gap-2">
                {failedCount > 0 && (
                  <Button 
                    onClick={retryFailedItems} 
                    variant="outline" 
                    size="sm"
                  >
                    Retry Failed
                  </Button>
                )}
                <Button 
                  onClick={clearCompletedItems} 
                  variant="outline" 
                  size="sm"
                >
                  Clear Completed
                </Button>
              </div>
            </div>
            
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {offlineItems.map((item) => {
                const IconComponent = getItemIcon(item.type);
                return (
                  <div key={item.id} className="flex items-center gap-3 p-2 border rounded-lg">
                    <IconComponent className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {getItemTypeLabel(item.type)}
                        </span>
                        {getStatusBadge(item.status)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{new Date(item.timestamp).toLocaleString()}</span>
                        {item.retryCount > 0 && (
                          <span>(Retry {item.retryCount})</span>
                        )}
                      </div>
                    </div>
                    {item.status === 'failed' && (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    {item.status === 'success' && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {offlineItems.length === 0 && (
          <div className="text-center py-4">
            <Database className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No offline items</p>
            <p className="text-xs text-muted-foreground">
              Changes made while offline will appear here
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

