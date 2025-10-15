// =====================================================
// Vendor Association Badge Component
// Background Verification Platform
// =====================================================

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Building2, User, HelpCircle } from 'lucide-react';
import { getVendorAssociationStatus } from '@/utils/vendorGigWorkerUtils';

interface VendorAssociationBadgeProps {
  gigWorker: {
    vendor_id?: string | null;
    is_direct_gig?: boolean;
    vendor_name?: string;
  };
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function VendorAssociationBadge({ 
  gigWorker, 
  showIcon = true, 
  size = 'md' 
}: VendorAssociationBadgeProps) {
  const status = getVendorAssociationStatus(gigWorker);
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  const getBadgeVariant = () => {
    switch (status.status) {
      case 'vendor-associated':
        return 'default';
      case 'direct':
        return 'secondary';
      case 'unknown':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getIcon = () => {
    if (!showIcon) return null;
    
    switch (status.status) {
      case 'vendor-associated':
        return <Building2 className={iconSizes[size]} />;
      case 'direct':
        return <User className={iconSizes[size]} />;
      case 'unknown':
        return <HelpCircle className={iconSizes[size]} />;
      default:
        return null;
    }
  };

  return (
    <Badge 
      variant={getBadgeVariant()} 
      className={`${sizeClasses[size]} flex items-center gap-1`}
    >
      {getIcon()}
      <span>{status.displayText}</span>
    </Badge>
  );
}

// Helper component for table display
export function VendorAssociationCell({ gigWorker }: { gigWorker: any }) {
  return (
    <div className="flex items-center space-x-2">
      <VendorAssociationBadge gigWorker={gigWorker} size="sm" />
    </div>
  );
}

// Helper component for detailed view
export function VendorAssociationDetails({ gigWorker }: { gigWorker: any }) {
  const status = getVendorAssociationStatus(gigWorker);
  
  return (
    <div className="space-y-2">
      <VendorAssociationBadge gigWorker={gigWorker} size="md" />
      {status.status === 'vendor-associated' && status.vendorName && (
        <p className="text-sm text-muted-foreground">
          Vendor: {status.vendorName}
        </p>
      )}
    </div>
  );
}
