import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  Plus, 
  Search, 
  Building,
  Calendar,
  DollarSign,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Settings,
  Award,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ClientContractForm from '@/components/ClientContracts/ClientContractForm';

interface ClientContract {
  id: string;
  contract_type: string;
  is_active: boolean;
  created_at: string;
  // Tier-based pricing
  tier1_tat_days: number;
  tier1_revenue_inr: number;
  tier1_base_payout_inr: number;
  tier2_tat_days: number;
  tier2_revenue_inr: number;
  tier2_base_payout_inr: number;
  tier3_tat_days: number;
  tier3_revenue_inr: number;
  tier3_base_payout_inr: number;
  // Working hours
  working_hours_start: string;
  working_hours_end: string;
  // Bonuses and penalties
  bonuses: Array<{
    id: string;
    name: string;
    tiers: string[];
    time_after_acceptance: number;
    amount: number;
  }>;
  penalties: Array<{
    id: string;
    name: string;
    tiers: string[];
    time_after_acceptance: number;
    amount: number;
  }>;
  clients?: {
    id: string;
    name: string;
  };
}

export default function ClientContractManagement() {
  const [contracts, setContracts] = useState<ClientContract[]>([]);
  const [filteredContracts, setFilteredContracts] = useState<ClientContract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingContract, setEditingContract] = useState<ClientContract | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<ClientContract | null>(null);
  const { toast } = useToast();

  const loadContracts = async (): Promise<ClientContract[]> => {
    const { data, error } = await supabase
      .from('client_contracts')
      .select(`
        *,
        clients!client_contracts_client_id_fkey(id, name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await loadContracts();
      setContracts(data);
      setFilteredContracts(data);
    } catch (error) {
      console.error('Failed to load contracts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load client contracts',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let filtered = contracts;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(contract =>
        contract.contract_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contract.clients?.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active';
      filtered = filtered.filter(contract => contract.is_active === isActive);
    }

    setFilteredContracts(filtered);
  }, [contracts, searchQuery, statusFilter]);

  const handleAddSuccess = () => {
    loadData();
    setShowAddForm(false);
    setEditingContract(null);
    toast({
      title: 'Success',
      description: 'Client contract created successfully',
    });
  };

  const handleEdit = (contract: ClientContract) => {
    setEditingContract(contract);
    setShowAddForm(true);
  };

  const handleDelete = (contract: ClientContract) => {
    setContractToDelete(contract);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!contractToDelete) return;

    try {
      const { error } = await supabase
        .from('client_contracts')
        .update({ is_active: false })
        .eq('id', contractToDelete.id);

      if (error) throw error;

      loadData();
      setDeleteDialogOpen(false);
      setContractToDelete(null);
      toast({
        title: 'Success',
        description: 'Client contract deleted successfully',
      });
    } catch (error) {
      console.error('Failed to delete contract:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete client contract',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge variant="default" className="bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3 mr-1" />
        Active
      </Badge>
    ) : (
      <Badge variant="secondary" className="bg-gray-100 text-gray-800">
        <XCircle className="w-3 h-3 mr-1" />
        Inactive
      </Badge>
    );
  };

  const getContractTypeBadge = (type: string) => {
    const typeColors: { [key: string]: string } = {
      'residential_address_check': 'bg-blue-100 text-blue-800',
      'business_address_check': 'bg-green-100 text-green-800',
    };

    const displayNames: { [key: string]: string } = {
      'residential_address_check': 'Residential Address Check',
      'business_address_check': 'Business Address Check',
    };

    return (
      <Badge variant="outline" className={typeColors[type] || 'bg-gray-100 text-gray-800'}>
        {displayNames[type] || type.charAt(0).toUpperCase() + type.slice(1)}
      </Badge>
    );
  };

  const stats = {
    total: contracts.length,
    active: contracts.filter(c => c.is_active).length,
    totalBonuses: contracts.reduce((sum, c) => sum + (c.bonuses?.length || 0), 0),
    totalPenalties: contracts.reduce((sum, c) => sum + (c.penalties?.length || 0), 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Client Contract Management</h1>
          <p className="text-muted-foreground">
            Manage client contracts, terms, and agreements
          </p>
        </div>
        <Button onClick={() => setShowAddForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Contract
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contracts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              All contracts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Contracts</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <p className="text-xs text-muted-foreground">
              Currently active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bonuses</CardTitle>
            <Award className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.totalBonuses}</div>
            <p className="text-xs text-muted-foreground">
              Bonus rules defined
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Penalties</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.totalPenalties}</div>
            <p className="text-xs text-muted-foreground">
              Penalty rules defined
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search contracts, clients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Contracts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Client Contracts ({filteredContracts.length})</CardTitle>
          <CardDescription>
            Manage client contracts with tier-based pricing, working hours, bonuses, and penalties
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2">Loading contracts...</span>
            </div>
          ) : filteredContracts.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No contracts found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || statusFilter !== 'all' 
                  ? 'Try adjusting your filters or search terms.'
                  : 'Get started by adding your first client contract.'
                }
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <Button onClick={() => setShowAddForm(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Contract
                </Button>
              )}
            </div>
          ) : (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="pricing">Tier Pricing</TabsTrigger>
                <TabsTrigger value="rules">Bonuses & Penalties</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="mt-6">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Working Hours</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredContracts.map((contract) => (
                        <TableRow key={contract.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building className="h-4 w-4 text-muted-foreground" />
                              {contract.clients?.name || 'Unknown Client'}
                            </div>
                          </TableCell>
                          <TableCell>{getContractTypeBadge(contract.contract_type)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {contract.working_hours_start} - {contract.working_hours_end}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(contract.is_active)}</TableCell>
                          <TableCell>
                            {new Date(contract.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(contract)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(contract)}
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
              </TabsContent>
              
              <TabsContent value="pricing" className="mt-6">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Tier 1</TableHead>
                        <TableHead>Tier 2</TableHead>
                        <TableHead>Tier 3</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredContracts.map((contract) => (
                        <TableRow key={contract.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building className="h-4 w-4 text-muted-foreground" />
                              {contract.clients?.name || 'Unknown Client'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="text-sm font-medium">TAT: {contract.tier1_tat_days} days</div>
                              <div className="text-sm text-green-600">Revenue: ₹{contract.tier1_revenue_inr}</div>
                              <div className="text-sm text-blue-600">Payout: ₹{contract.tier1_base_payout_inr}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="text-sm font-medium">TAT: {contract.tier2_tat_days} days</div>
                              <div className="text-sm text-green-600">Revenue: ₹{contract.tier2_revenue_inr}</div>
                              <div className="text-sm text-blue-600">Payout: ₹{contract.tier2_base_payout_inr}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="text-sm font-medium">TAT: {contract.tier3_tat_days} days</div>
                              <div className="text-sm text-green-600">Revenue: ₹{contract.tier3_revenue_inr}</div>
                              <div className="text-sm text-blue-600">Payout: ₹{contract.tier3_base_payout_inr}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(contract)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(contract)}
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
              </TabsContent>
              
              <TabsContent value="rules" className="mt-6">
                <div className="space-y-4">
                  {filteredContracts.map((contract) => (
                    <Card key={contract.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">{contract.clients?.name || 'Unknown Client'}</CardTitle>
                            <CardDescription>{getContractTypeBadge(contract.contract_type)}</CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(contract)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(contract)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-6 md:grid-cols-2">
                          {/* Bonuses */}
                          <div>
                            <h4 className="font-semibold mb-3 flex items-center gap-2">
                              <Award className="h-4 w-4 text-blue-600" />
                              Bonuses ({contract.bonuses?.length || 0})
                            </h4>
                            {contract.bonuses && contract.bonuses.length > 0 ? (
                              <div className="space-y-2">
                                {contract.bonuses.map((bonus, index) => (
                                  <div key={index} className="p-3 bg-blue-50 rounded-lg">
                                    <div className="font-medium text-sm">{bonus.name}</div>
                                    <div className="text-sm text-muted-foreground">
                                      Tiers: {bonus.tiers.join(', ')} | 
                                      Time: {bonus.time_after_acceptance}h | 
                                      Amount: ₹{bonus.amount}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">No bonuses defined</p>
                            )}
                          </div>
                          
                          {/* Penalties */}
                          <div>
                            <h4 className="font-semibold mb-3 flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-orange-600" />
                              Penalties ({contract.penalties?.length || 0})
                            </h4>
                            {contract.penalties && contract.penalties.length > 0 ? (
                              <div className="space-y-2">
                                {contract.penalties.map((penalty, index) => (
                                  <div key={index} className="p-3 bg-orange-50 rounded-lg">
                                    <div className="font-medium text-sm">{penalty.name}</div>
                                    <div className="text-sm text-muted-foreground">
                                      Tiers: {penalty.tiers.join(', ')} | 
                                      Time: {penalty.time_after_acceptance}h | 
                                      Amount: ₹{penalty.amount}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">No penalties defined</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Forms */}
      <ClientContractForm
        isOpen={showAddForm}
        onOpenChange={setShowAddForm}
        onSuccess={handleAddSuccess}
        onCancel={() => {
          setShowAddForm(false);
          setEditingContract(null);
        }}
        editingContract={editingContract}
      />

      {/* Delete Confirmation Dialog */}
      <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${deleteDialogOpen ? 'block' : 'hidden'}`}>
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <h3 className="text-lg font-semibold mb-2">Delete Contract</h3>
          <p className="text-muted-foreground mb-4">
            Are you sure you want to delete the contract for {contractToDelete?.clients?.name || 'this client'}? 
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
