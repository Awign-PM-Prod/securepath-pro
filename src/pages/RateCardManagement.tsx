import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign, 
  Plus, 
  Search, 
  MapPin, 
  Clock,
  Building,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  FileText,
  Settings
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import RateCardForm from '@/components/RateCards/RateCardForm';
import ClientContractForm from '@/components/ClientContracts/ClientContractForm';

interface RateCard {
  id: string;
  name: string;
  client_id: string | null;
  pincode_tier: string;
  completion_slab: string;
  base_rate_inr: number;
  default_travel_inr: number;
  default_bonus_inr: number;
  is_active: boolean;
  effective_from: string;
  effective_until: string | null;
  created_at: string;
  clients?: {
    id: string;
    name: string;
  };
}

interface ClientContract {
  id: string;
  client_id: string;
  contract_number: string;
  contract_name: string;
  contract_type: string;
  start_date: string;
  end_date: string;
  default_tat_hours: number;
  rate_card_id: string | null;
  rate_override_policy: string;
  report_delivery_method: string;
  is_active: boolean;
  created_at: string;
  clients?: {
    id: string;
    name: string;
  };
  rate_cards?: {
    id: string;
    name: string;
  };
}

export default function RateCardManagement() {
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [contracts, setContracts] = useState<ClientContract[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isRateCardFormOpen, setIsRateCardFormOpen] = useState(false);
  const [isContractFormOpen, setIsContractFormOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [rateCardsData, contractsData, clientsData] = await Promise.all([
        loadRateCards(),
        loadContracts(),
        loadClients()
      ]);
      setRateCards(rateCardsData);
      setContracts(contractsData);
      setClients(clientsData);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadRateCards = async (): Promise<RateCard[]> => {
    const { data, error } = await supabase
      .from('rate_cards')
      .select(`
        *,
        clients!rate_cards_client_id_fkey(id, name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  };

  const loadContracts = async (): Promise<ClientContract[]> => {
    const { data, error } = await supabase
      .from('client_contracts')
      .select(`
        *,
        clients!client_contracts_client_id_fkey(id, name),
        rate_cards!client_contracts_rate_card_id_fkey(id, name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  };

  const loadClients = async (): Promise<Array<{ id: string; name: string; email: string }>> => {
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, email')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  };

  const handleCreateRateCard = () => {
    setIsRateCardFormOpen(true);
  };

  const handleCreateContract = () => {
    setIsContractFormOpen(true);
  };

  const handleFormSuccess = () => {
    loadData(); // Reload all data
  };

  const handleFormCancel = () => {
    setIsRateCardFormOpen(false);
    setIsContractFormOpen(false);
  };

  const handleDeleteRateCard = async (rateCardId: string) => {
    if (window.confirm('Are you sure you want to delete this rate card?')) {
      try {
        const { error } = await supabase
          .from('rate_cards')
          .update({ is_active: false })
          .eq('id', rateCardId);

        if (error) throw error;
        
        await loadData();
        toast({
          title: 'Rate Card Deleted',
          description: 'The rate card has been deactivated successfully',
        });
      } catch (error) {
        console.error('Failed to delete rate card:', error);
        toast({
          title: 'Error',
          description: 'Failed to delete rate card',
          variant: 'destructive',
        });
      }
    }
  };

  const handleDeleteContract = async (contractId: string) => {
    if (window.confirm('Are you sure you want to delete this contract?')) {
      try {
        const { error } = await supabase
          .from('client_contracts')
          .update({ is_active: false })
          .eq('id', contractId);

        if (error) throw error;
        
        await loadData();
        toast({
          title: 'Contract Deleted',
          description: 'The contract has been deactivated successfully',
        });
      } catch (error) {
        console.error('Failed to delete contract:', error);
        toast({
          title: 'Error',
          description: 'Failed to delete contract',
          variant: 'destructive',
        });
      }
    }
  };

  const filteredRateCards = rateCards.filter(rateCard => {
    const matchesSearch = 
      rateCard.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rateCard.pincode_tier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rateCard.completion_slab.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rateCard.client?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && rateCard.is_active) ||
      (statusFilter === 'inactive' && !rateCard.is_active);
    
    return matchesSearch && matchesStatus;
  });

  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = 
      contract.contract_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.contract_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.clients?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && contract.is_active) ||
      (statusFilter === 'inactive' && !contract.is_active);
    
    return matchesSearch && matchesStatus;
  });

  const getPincodeTierLabel = (tier: string) => {
    const tiers: { [key: string]: string } = {
      'tier_1': 'Tier 1 - Metro',
      'tier_2': 'Tier 2 - Major Cities',
      'tier_3': 'Tier 3 - Towns & Rural'
    };
    return tiers[tier] || tier;
  };

  const getCompletionSlabLabel = (slab: string) => {
    const slabs: { [key: string]: string } = {
      'within_24h': 'Within 24h',
      'within_48h': 'Within 48h',
      'within_72h': 'Within 72h',
      'within_168h': 'Within 1 week',
      'beyond_168h': 'Beyond 1 week'
    };
    return slabs[slab] || slab;
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
          <h1 className="text-3xl font-bold">Rate Card & Contract Management</h1>
          <p className="text-muted-foreground">
            Manage rate cards and client contracts for background verification services
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleCreateRateCard}>
            <Plus className="h-4 w-4 mr-2" />
            Create Rate Card
          </Button>
          <Button onClick={handleCreateContract} variant="outline">
            <FileText className="h-4 w-4 mr-2" />
            Create Contract
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rate Cards</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rateCards.length}</div>
            <p className="text-xs text-muted-foreground">
              {rateCards.filter(rc => rc.is_active).length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rate Cards</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rateCards.filter(rc => rc.is_active).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contracts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contracts.length}</div>
            <p className="text-xs text-muted-foreground">
              {contracts.filter(c => c.is_active).length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Contracts</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {contracts.filter(c => c.is_active).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="rate-cards" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rate-cards">Rate Cards</TabsTrigger>
          <TabsTrigger value="contracts">Client Contracts</TabsTrigger>
        </TabsList>

        {/* Rate Cards Tab */}
        <TabsContent value="rate-cards">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Rate Cards</CardTitle>
                  <CardDescription>
                    Manage pricing tiers for different geographic regions and completion times
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Search rate cards..."
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
              {filteredRateCards.length === 0 ? (
                <div className="text-center py-8">
                  <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No rate cards found</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchTerm || statusFilter !== 'all'
                      ? 'Try adjusting your filters'
                      : 'Get started by creating your first rate card'
                    }
                  </p>
                  {!searchTerm && statusFilter === 'all' && (
                    <Button onClick={handleCreateRateCard}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Rate Card
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Pincode Tier</TableHead>
                      <TableHead>Completion Time</TableHead>
                      <TableHead>Base Rate</TableHead>
                      <TableHead>Total Rate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRateCards.map((rateCard) => (
                      <TableRow key={rateCard.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="font-medium">{rateCard.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {rateCard.effective_from} - {rateCard.effective_until || 'Ongoing'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {rateCard.clients ? (
                            <div className="flex items-center gap-1">
                              <Building className="h-4 w-4 text-muted-foreground" />
                              <span>{rateCard.clients?.name}</span>
                            </div>
                          ) : (
                            <Badge variant="secondary">Global</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getPincodeTierLabel(rateCard.pincode_tier)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getCompletionSlabLabel(rateCard.completion_slab)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">₹{rateCard.base_rate_inr.toFixed(2)}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-green-600">
                            ₹{(rateCard.base_rate_inr + rateCard.default_travel_inr + rateCard.default_bonus_inr).toFixed(2)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            +₹{rateCard.default_travel_inr.toFixed(2)} travel + ₹{rateCard.default_bonus_inr.toFixed(2)} bonus
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={rateCard.is_active ? "default" : "secondary"}>
                            {rateCard.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleDeleteRateCard(rateCard.id)}
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contracts Tab */}
        <TabsContent value="contracts">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Client Contracts</CardTitle>
                  <CardDescription>
                    Manage client contracts with specific terms and rate card assignments
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Search contracts..."
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
              {filteredContracts.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No contracts found</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchTerm || statusFilter !== 'all'
                      ? 'Try adjusting your filters'
                      : 'Get started by creating your first contract'
                    }
                  </p>
                  {!searchTerm && statusFilter === 'all' && (
                    <Button onClick={handleCreateContract}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Contract
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contract</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Default TAT</TableHead>
                      <TableHead>Rate Card</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContracts.map((contract) => (
                      <TableRow key={contract.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="font-medium">{contract.contract_name}</div>
                          <div className="text-sm text-muted-foreground">{contract.contract_number}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            <span>{contract.clients?.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {contract.contract_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {contract.start_date} to {contract.end_date}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>{contract.default_tat_hours}h</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {contract.rate_cards ? (
                            <div className="text-sm">
                              <div className="font-medium">{contract.rate_cards.name}</div>
                              <div className="text-muted-foreground">{contract.rate_override_policy}</div>
                            </div>
                          ) : (
                            <Badge variant="secondary">No Rate Card</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={contract.is_active ? "default" : "secondary"}>
                            {contract.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleDeleteContract(contract.id)}
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
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Forms */}
      <RateCardForm
        isOpen={isRateCardFormOpen}
        onOpenChange={setIsRateCardFormOpen}
        onSuccess={handleFormSuccess}
        onCancel={handleFormCancel}
        clients={clients}
      />

      <ClientContractForm
        isOpen={isContractFormOpen}
        onOpenChange={setIsContractFormOpen}
        onSuccess={handleFormSuccess}
        onCancel={handleFormCancel}
        clients={clients}
        rateCards={rateCards.map(rc => ({
          id: rc.id,
          name: rc.name,
          pincode_tier: rc.pincode_tier,
          completion_slab: rc.completion_slab,
          base_rate_inr: rc.base_rate_inr,
          client_id: rc.client_id
        }))}
      />
    </div>
  );
}