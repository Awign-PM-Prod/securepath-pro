// =====================================================
// Vendor-Gig Worker Association Examples
// Background Verification Platform
// =====================================================

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Building2, Users, User, AlertCircle } from 'lucide-react';
import { 
  isGigWorkerAssociatedWithVendor,
  getGigWorkerVendorInfo,
  getVendorGigWorkers,
  getDirectGigWorkers,
  canVendorAssignGigWorker
} from '@/utils/vendorGigWorkerUtils';
import VendorAssociationBadge from '@/components/VendorAssociationBadge';

// Example 1: Check if a specific gig worker belongs to a vendor
export function GigWorkerVendorCheck({ gigWorkerId, vendorId }: { gigWorkerId: string; vendorId: string }) {
  const [isAssociated, setIsAssociated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAssociation = async () => {
      setLoading(true);
      const result = await isGigWorkerAssociatedWithVendor(gigWorkerId, vendorId);
      setIsAssociated(result);
      setLoading(false);
    };
    checkAssociation();
  }, [gigWorkerId, vendorId]);

  if (loading) return <div>Checking association...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gig Worker Association Check</CardTitle>
        <CardDescription>
          Checking if gig worker {gigWorkerId} belongs to vendor {vendorId}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Badge variant={isAssociated ? 'default' : 'destructive'}>
          {isAssociated ? 'Associated with Vendor' : 'Not Associated'}
        </Badge>
      </CardContent>
    </Card>
  );
}

// Example 2: Display vendor information for a gig worker
export function GigWorkerVendorInfo({ gigWorkerId }: { gigWorkerId: string }) {
  const [vendorInfo, setVendorInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVendorInfo = async () => {
      setLoading(true);
      const info = await getGigWorkerVendorInfo(gigWorkerId);
      setVendorInfo(info);
      setLoading(false);
    };
    fetchVendorInfo();
  }, [gigWorkerId]);

  if (loading) return <div>Loading vendor info...</div>;
  if (!vendorInfo) return <div>Gig worker not found</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gig Worker Vendor Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <VendorAssociationBadge gigWorker={vendorInfo} />
        
        {vendorInfo.vendorName && (
          <div className="flex items-center space-x-2">
            <Building2 className="h-4 w-4" />
            <span>Vendor: {vendorInfo.vendorName}</span>
          </div>
        )}
        
        {vendorInfo.vendorEmail && (
          <div className="text-sm text-muted-foreground">
            Email: {vendorInfo.vendorEmail}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Example 3: List all gig workers for a vendor
export function VendorGigWorkersList({ vendorId }: { vendorId: string }) {
  const [gigWorkers, setGigWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGigWorkers = async () => {
      setLoading(true);
      const workers = await getVendorGigWorkers(vendorId);
      setGigWorkers(workers);
      setLoading(false);
    };
    fetchGigWorkers();
  }, [vendorId]);

  if (loading) return <div>Loading gig workers...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vendor Gig Workers</CardTitle>
        <CardDescription>
          All gig workers associated with vendor {vendorId}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {gigWorkers.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No gig workers found for this vendor.
            </AlertDescription>
          </Alert>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Capacity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gigWorkers.map((worker) => (
                <TableRow key={worker.id}>
                  <TableCell>{worker.first_name} {worker.last_name}</TableCell>
                  <TableCell>{worker.email}</TableCell>
                  <TableCell>{worker.phone}</TableCell>
                  <TableCell>
                    <VendorAssociationBadge gigWorker={worker} size="sm" />
                  </TableCell>
                  <TableCell>
                    {worker.capacity_available}/{worker.max_daily_capacity}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// Example 4: Check assignment permissions
export function AssignmentPermissionCheck({ 
  vendorId, 
  gigWorkerId 
}: { 
  vendorId: string; 
  gigWorkerId: string; 
}) {
  const [permission, setPermission] = useState<{ canAssign: boolean; reason?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPermission = async () => {
      setLoading(true);
      const result = await canVendorAssignGigWorker(vendorId, gigWorkerId);
      setPermission(result);
      setLoading(false);
    };
    checkPermission();
  }, [vendorId, gigWorkerId]);

  if (loading) return <div>Checking permissions...</div>;
  if (!permission) return <div>Error checking permissions</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assignment Permission Check</CardTitle>
        <CardDescription>
          Can vendor {vendorId} assign cases to gig worker {gigWorkerId}?
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Badge variant={permission.canAssign ? 'default' : 'destructive'}>
            {permission.canAssign ? 'Can Assign' : 'Cannot Assign'}
          </Badge>
          {permission.reason && (
            <p className="text-sm text-muted-foreground">
              Reason: {permission.reason}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Example 5: Complete vendor-gig worker management dashboard
export function VendorGigWorkerDashboard({ vendorId }: { vendorId: string }) {
  const [vendorWorkers, setVendorWorkers] = useState<any[]>([]);
  const [directWorkers, setDirectWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [vendor, direct] = await Promise.all([
        getVendorGigWorkers(vendorId),
        getDirectGigWorkers()
      ]);
      setVendorWorkers(vendor);
      setDirectWorkers(direct);
      setLoading(false);
    };
    fetchData();
  }, [vendorId]);

  if (loading) return <div>Loading dashboard...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Vendor Gig Workers ({vendorWorkers.length})
            </CardTitle>
            <CardDescription>
              Gig workers associated with your vendor
            </CardDescription>
          </CardHeader>
          <CardContent>
            {vendorWorkers.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No gig workers associated with this vendor.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                {vendorWorkers.slice(0, 3).map((worker) => (
                  <div key={worker.id} className="flex items-center justify-between">
                    <span>{worker.first_name} {worker.last_name}</span>
                    <VendorAssociationBadge gigWorker={worker} size="sm" />
                  </div>
                ))}
                {vendorWorkers.length > 3 && (
                  <p className="text-sm text-muted-foreground">
                    +{vendorWorkers.length - 3} more...
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Direct Gig Workers ({directWorkers.length})
            </CardTitle>
            <CardDescription>
              Gig workers not associated with any vendor
            </CardDescription>
          </CardHeader>
          <CardContent>
            {directWorkers.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No direct gig workers available.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                {directWorkers.slice(0, 3).map((worker) => (
                  <div key={worker.id} className="flex items-center justify-between">
                    <span>{worker.first_name} {worker.last_name}</span>
                    <VendorAssociationBadge gigWorker={worker} size="sm" />
                  </div>
                ))}
                {directWorkers.length > 3 && (
                  <p className="text-sm text-muted-foreground">
                    +{directWorkers.length - 3} more...
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
