import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Plus, 
  Upload, 
  Search, 
  Edit, 
  Trash2, 
  MapPin, 
  Filter,
  Download,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { pincodeTierService, PincodeTier } from '@/services/pincodeTierService';
import PincodeTierForm from '@/components/PincodeTiers/PincodeTierForm';
import BulkPincodeTierForm from '@/components/PincodeTiers/BulkPincodeTierForm';

export default function PincodeTierManagement() {
  const [pincodeTiers, setPincodeTiers] = useState<PincodeTier[]>([]);
  const [filteredTiers, setFilteredTiers] = useState<PincodeTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [editingTier, setEditingTier] = useState<PincodeTier | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tierToDelete, setTierToDelete] = useState<PincodeTier | null>(null);
  const { toast } = useToast();

  const loadPincodeTiers = async () => {
    setIsLoading(true);
    try {
      const data = await pincodeTierService.getPincodeTiers();
      setPincodeTiers(data);
      setFilteredTiers(data);
    } catch (error) {
      console.error('Failed to load pincode tiers:', error);
      toast({
        title: 'Error',
        description: 'Failed to load pincode tiers',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPincodeTiers();
  }, []);

  useEffect(() => {
    let filtered = pincodeTiers;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(tier =>
        tier.pincode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tier.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tier.state?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tier.region?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply tier filter
    if (tierFilter !== 'all') {
      filtered = filtered.filter(tier => tier.tier === tierFilter);
    }

    setFilteredTiers(filtered);
  }, [pincodeTiers, searchQuery, tierFilter]);

  const handleAddSuccess = () => {
    loadPincodeTiers();
    setShowAddForm(false);
    toast({
      title: 'Success',
      description: 'Pincode tier added successfully',
    });
  };

  const handleBulkSuccess = () => {
    loadPincodeTiers();
    setShowBulkForm(false);
    toast({
      title: 'Success',
      description: 'Pincode tiers uploaded successfully',
    });
  };

  const handleEdit = (tier: PincodeTier) => {
    setEditingTier(tier);
    setShowAddForm(true);
  };

  const handleDelete = (tier: PincodeTier) => {
    setTierToDelete(tier);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!tierToDelete) return;

    try {
      await pincodeTierService.deletePincodeTier(tierToDelete.id);
      loadPincodeTiers();
      setDeleteDialogOpen(false);
      setTierToDelete(null);
      toast({
        title: 'Success',
        description: 'Pincode tier deleted successfully',
      });
    } catch (error) {
      console.error('Failed to delete pincode tier:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete pincode tier',
        variant: 'destructive',
      });
    }
  };

  const exportToCSV = () => {
    const csvContent = [
      'Pincode,Tier,City,State,Region,Status',
      ...filteredTiers.map(tier => 
        `${tier.pincode},${tier.tier},${tier.city || ''},${tier.state || ''},${tier.region || ''},${tier.is_active ? 'Active' : 'Inactive'}`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pincode_tiers_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getTierBadgeVariant = (tier: string) => {
    switch (tier) {
      case 'tier_1': return 'default';
      case 'tier_2': return 'secondary';
      case 'tier_3': return 'outline';
      default: return 'outline';
    }
  };

  const getTierLabel = (tier: string) => {
    switch (tier) {
      case 'tier_1': return 'Tier 1 (Metro)';
      case 'tier_2': return 'Tier 2 (Cities)';
      case 'tier_3': return 'Tier 3 (Towns/Rural)';
      default: return tier;
    }
  };

  const stats = {
    total: pincodeTiers.length,
    tier1: pincodeTiers.filter(t => t.tier === 'tier_1').length,
    tier2: pincodeTiers.filter(t => t.tier === 'tier_2').length,
    tier3: pincodeTiers.filter(t => t.tier === 'tier_3').length,
    active: pincodeTiers.filter(t => t.is_active).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pincode Tier Management</h1>
          <p className="text-muted-foreground">
            Manage pincode classifications for rate card and allocation logic
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => setShowBulkForm(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Bulk Upload
          </Button>
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Pincode
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pincodes</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.active} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tier 1 (Metro)</CardTitle>
            <Badge variant="default">T1</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.tier1}</div>
            <p className="text-xs text-muted-foreground">
              Metro cities
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tier 2 (Cities)</CardTitle>
            <Badge variant="secondary">T2</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.tier2}</div>
            <p className="text-xs text-muted-foreground">
              Tier-2 cities
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tier 3 (Rural)</CardTitle>
            <Badge variant="outline">T3</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.tier3}</div>
            <p className="text-xs text-muted-foreground">
              Towns & rural
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Badge variant="default">Active</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">
              Currently active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search pincodes, cities, states..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="tier_1">Tier 1 (Metro)</SelectItem>
                <SelectItem value="tier_2">Tier 2 (Cities)</SelectItem>
                <SelectItem value="tier_3">Tier 3 (Rural)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Pincode Tiers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pincode Tiers ({filteredTiers.length})</CardTitle>
          <CardDescription>
            Manage pincode classifications and geographic data
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading pincode tiers...</span>
            </div>
          ) : filteredTiers.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No pincode tiers found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || tierFilter !== 'all' 
                  ? 'Try adjusting your filters or search terms.'
                  : 'Get started by adding your first pincode tier.'
                }
              </p>
              {!searchQuery && tierFilter === 'all' && (
                <Button onClick={() => setShowAddForm(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Pincode
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pincode</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTiers.map((tier) => (
                    <TableRow key={tier.id}>
                      <TableCell className="font-mono">{tier.pincode}</TableCell>
                      <TableCell>
                        <Badge variant={getTierBadgeVariant(tier.tier)}>
                          {getTierLabel(tier.tier)}
                        </Badge>
                      </TableCell>
                      <TableCell>{tier.city || '-'}</TableCell>
                      <TableCell>{tier.state || '-'}</TableCell>
                      <TableCell>{tier.region || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={tier.is_active ? 'default' : 'secondary'}>
                          {tier.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(tier.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(tier)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(tier)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Forms */}
      <PincodeTierForm
        isOpen={showAddForm}
        onOpenChange={setShowAddForm}
        onSuccess={handleAddSuccess}
        onCancel={() => {
          setShowAddForm(false);
          setEditingTier(null);
        }}
        editingTier={editingTier}
      />

      <BulkPincodeTierForm
        isOpen={showBulkForm}
        onOpenChange={setShowBulkForm}
        onSuccess={handleBulkSuccess}
        onCancel={() => setShowBulkForm(false)}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Pincode Tier</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete pincode {tierToDelete?.pincode}? 
              This action will mark it as inactive and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

