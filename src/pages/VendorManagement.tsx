import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreateVendorDialog } from '@/components/VendorManagement/CreateVendorDialog';
import { EditVendorDialog } from '@/components/VendorManagement/EditVendorDialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  Plus, 
  Search, 
  MapPin, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  UserPlus,
  Settings,
  Trash2
} from 'lucide-react';

interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string;
  contact_person: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  is_active: boolean;
  total_gig_workers: number;
  active_gig_workers: number;
  total_cases: number;
  completed_cases: number;
  quality_score: number;
  created_at: string;
}

interface GigWorker {
  id: string;
  name: string;
  email: string;
  phone: string;
  vendor_id: string;
  is_active: boolean;
  coverage_pincodes: string[];
  max_daily_capacity: number;
  current_capacity: number;
  total_cases: number;
  completed_cases: number;
  quality_score: number;
  last_active: string;
}

export default function VendorManagement() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [gigWorkers, setGigWorkers] = useState<GigWorker[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load vendors
      const { data: vendorsData, error: vendorsError } = await supabase
        .from('vendors')
        .select('*')
        .order('created_at', { ascending: false });

      if (vendorsError) {
        throw vendorsError;
      }

      // Transform vendors data
      const transformedVendors = (vendorsData || []).map((vendor: any) => ({
        id: vendor.id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone || '',
        contact_person: vendor.contact_person || '',
        address: vendor.address || '',
        city: vendor.city || '',
        state: vendor.state || '',
        pincode: vendor.pincode || '',
        is_active: vendor.is_active,
        total_gig_workers: vendor.roster_size || 0,
        active_gig_workers: 0, // Will be calculated from gig_workers
        total_cases: vendor.total_cases_assigned || 0,
        completed_cases: 0, // Will be calculated from cases
        quality_score: Math.round(((vendor.quality_score || 0) * 100)), // Convert decimal to percentage
        created_at: vendor.created_at,
      }));

      setVendors(transformedVendors);

      // Load gig workers
      const { data: gigWorkersData, error: gigWorkersError } = await supabase
        .from('gig_partners')
        .select('*')
        .order('created_at', { ascending: false });

      if (gigWorkersError) {
        throw gigWorkersError;
      }

      // Load profiles for gig workers
      const profileIds = (gigWorkersData || []).map((worker: any) => worker.profile_id).filter(Boolean);
      let profilesData: any[] = [];
      
      if (profileIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, phone')
          .in('id', profileIds);
        
        if (profilesError) {
          console.warn('Error loading profiles:', profilesError);
        } else {
          profilesData = profiles || [];
        }
      }

      // Transform gig workers data
      const transformedGigWorkers = (gigWorkersData || []).map((worker: any) => {
        const profile = profilesData.find(p => p.id === worker.profile_id);
        return {
          id: worker.id,
          name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Unknown',
          email: profile?.email || '',
          phone: profile?.phone || '',
          vendor_id: worker.vendor_id || '',
          is_active: worker.is_active,
          coverage_pincodes: worker.coverage_pincodes || [],
          max_daily_capacity: worker.max_daily_capacity || 0,
          current_capacity: worker.capacity_available || 0,
          total_cases: worker.total_cases_completed || 0,
          completed_cases: worker.total_cases_completed || 0,
          quality_score: Math.round(((worker.quality_score || 0) * 100)), // Convert decimal to percentage
          last_active: worker.last_seen_at || worker.updated_at,
        };
      });

      setGigWorkers(transformedGigWorkers);

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load vendor data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredVendors = vendors.filter(vendor => {
    const matchesSearch = 
      vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.contact_person.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && vendor.is_active) ||
      (statusFilter === 'inactive' && !vendor.is_active);
    
    return matchesSearch && matchesStatus;
  });

  const getVendorGigWorkers = (vendorId: string) => {
    return gigWorkers.filter(gw => gw.vendor_id === vendorId);
  };

  const getCapacityPercentage = (current: number, max: number) => {
    return Math.round((current / max) * 100);
  };

  const getCapacityColor = (percentage: number) => {
    if (percentage >= 80) return 'text-red-600';
    if (percentage >= 60) return 'text-orange-600';
    if (percentage >= 40) return 'text-yellow-600';
    return 'text-green-600';
  };

  const handleDeleteVendor = async (vendorId: string) => {
    if (!window.confirm('Are you sure you want to delete this vendor? This will also delete their profile data.')) return;

    try {
      // First, fetch the profile_id from the vendors record
      const { data: vendor, error: fetchError } = await supabase
        .from('vendors')
        .select('profile_id')
        .eq('id', vendorId)
        .single();

      if (fetchError) throw fetchError;

      // Delete from vendors table
      const { error: deleteError } = await supabase
        .from('vendors')
        .delete()
        .eq('id', vendorId);

      if (deleteError) throw deleteError;

      // Delete from profiles table if profile_id exists
      if (vendor?.profile_id) {
        const { error: profileDeleteError } = await supabase
          .from('profiles')
          .delete()
          .eq('id', vendor.profile_id);

        if (profileDeleteError) {
          console.warn('Failed to delete profile, but vendor was deleted:', profileDeleteError);
          // Don't throw here - vendor is already deleted
        }
      }

      toast({
        title: 'Success',
        description: 'Vendor and profile deleted successfully',
      });

      loadData();
    } catch (error) {
      console.error('Failed to delete vendor:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete vendor',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vendor Management</h1>
          <p className="text-muted-foreground">
            Manage vendors and their gig workers
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <UserPlus className="h-4 w-4 mr-2" />
            Add Gig Worker
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Vendor
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vendors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vendors.length}</div>
            <p className="text-xs text-muted-foreground">
              {vendors.filter(v => v.is_active).length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gig Workers</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{gigWorkers.length}</div>
            <p className="text-xs text-muted-foreground">
              {gigWorkers.filter(gw => gw.is_active).length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {vendors.reduce((sum, v) => sum + v.total_cases, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {vendors.reduce((sum, v) => sum + v.completed_cases, 0)} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Quality Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(vendors.reduce((sum, v) => sum + v.quality_score, 0) / vendors.length).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Across all vendors
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="vendors" className="space-y-6">
        <TabsList>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="gig-workers">Gig Workers</TabsTrigger>
          <TabsTrigger value="capacity">Capacity Management</TabsTrigger>
        </TabsList>

        {/* Vendors Tab */}
        <TabsContent value="vendors" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Vendors</CardTitle>
                  <CardDescription>
                    Manage vendor accounts and performance
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Search vendors..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Gig Workers</TableHead>
                    <TableHead>Cases</TableHead>
                    <TableHead>Quality Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVendors.map((vendor) => (
                    <TableRow key={vendor.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div>
                          <div className="font-medium">{vendor.name}</div>
                          <div className="text-sm text-muted-foreground">{vendor.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{vendor.contact_person}</div>
                          <div className="text-sm text-muted-foreground">{vendor.phone}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{vendor.city}, {vendor.state}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{vendor.active_gig_workers}/{vendor.total_gig_workers}</div>
                          <div className="text-sm text-muted-foreground">active</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{vendor.completed_cases}/{vendor.total_cases}</div>
                          <div className="text-sm text-muted-foreground">completed</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{vendor.quality_score}%</span>
                          <div className="w-16 h-2 bg-muted rounded-full">
                            <div 
                              className="h-2 bg-primary rounded-full"
                              style={{ width: `${vendor.quality_score}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={vendor.is_active ? "default" : "secondary"}>
                          {vendor.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setEditingVendor(vendor);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleDeleteVendor(vendor.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gig Workers Tab */}
        <TabsContent value="gig-workers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Gig Workers</CardTitle>
              <CardDescription>
                Manage individual gig workers and their performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Coverage</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gigWorkers.map((worker) => (
                    <TableRow key={worker.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="font-medium">{worker.name}</div>
                        <div className="text-sm text-muted-foreground">{worker.email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{worker.phone}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {vendors.find(v => v.id === worker.vendor_id)?.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {worker.coverage_pincodes.slice(0, 2).join(', ')}
                          {worker.coverage_pincodes.length > 2 && ` +${worker.coverage_pincodes.length - 2}`}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">
                            {worker.current_capacity}/{worker.max_daily_capacity}
                          </span>
                          <div className="w-16 h-2 bg-muted rounded-full">
                            <div 
                              className={`h-2 rounded-full ${getCapacityColor(getCapacityPercentage(worker.current_capacity, worker.max_daily_capacity))}`}
                              style={{ width: `${getCapacityPercentage(worker.current_capacity, worker.max_daily_capacity)}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm font-medium">{worker.quality_score}%</div>
                          <div className="text-xs text-muted-foreground">
                            {worker.completed_cases}/{worker.total_cases} cases
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(worker.last_active).toLocaleDateString()}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={worker.is_active ? "default" : "secondary"}>
                          {worker.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Capacity Management Tab */}
        <TabsContent value="capacity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Capacity Management</CardTitle>
              <CardDescription>
                Monitor and manage gig worker capacity across locations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {vendors.map((vendor) => {
                  const vendorWorkers = getVendorGigWorkers(vendor.id);
                  const totalCapacity = vendorWorkers.reduce((sum, w) => sum + w.max_daily_capacity, 0);
                  const usedCapacity = vendorWorkers.reduce((sum, w) => sum + w.current_capacity, 0);
                  const utilizationRate = totalCapacity > 0 ? (usedCapacity / totalCapacity) * 100 : 0;

                  return (
                    <div key={vendor.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-medium">{vendor.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {vendor.active_gig_workers} active gig workers
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">
                            {utilizationRate.toFixed(1)}%
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {usedCapacity}/{totalCapacity} capacity used
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span>Capacity Utilization</span>
                          <span className={getCapacityColor(utilizationRate)}>
                            {utilizationRate.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full h-3 bg-muted rounded-full">
                          <div 
                            className={`h-3 rounded-full ${getCapacityColor(utilizationRate)}`}
                            style={{ width: `${utilizationRate}%` }}
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Total Capacity:</span>
                            <span className="ml-2 font-medium">{totalCapacity}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Used:</span>
                            <span className="ml-2 font-medium">{usedCapacity}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Available:</span>
                            <span className="ml-2 font-medium">{totalCapacity - usedCapacity}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Quality Score:</span>
                            <span className="ml-2 font-medium">{vendor.quality_score}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Vendor Dialog */}
      <CreateVendorDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onVendorCreated={loadData}
      />

      {/* Edit Vendor Dialog */}
      <EditVendorDialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditingVendor(null);
          }
        }}
        vendor={editingVendor}
        onVendorUpdated={loadData}
      />
    </div>
  );
}

