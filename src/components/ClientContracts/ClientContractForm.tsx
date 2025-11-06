import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Trash2, 
  X, 
  Building,
  Clock,
  DollarSign,
  Award,
  AlertTriangle,
  Calendar
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Client {
  id: string;
  name: string;
}

interface ContractType {
  type_key: string;
  display_name: string;
  description: string;
  is_active: boolean;
  sort_order: number;
}

interface Bonus {
  id: string;
  name: string;
  tiers: string[];
  time_after_acceptance: number;
  amount: number;
}

interface Penalty {
  id: string;
  name: string;
  tiers: string[];
  time_after_acceptance: number;
  amount: number;
}

interface ClientContractFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onCancel: () => void;
  editingContract?: any;
}

export default function ClientContractForm({
  isOpen,
  onOpenChange,
  onSuccess,
  onCancel,
  editingContract
}: ClientContractFormProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [contractTypes, setContractTypes] = useState<ContractType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    client_id: '',
    contract_type: 'residential_address_check',
    // Tier-based pricing
    tier1_tat_days: 1,
    tier1_revenue_inr: 0,
    tier1_base_payout_inr: 0,
    tier2_tat_days: 2,
    tier2_revenue_inr: 0,
    tier2_base_payout_inr: 0,
    tier3_tat_days: 3,
    tier3_revenue_inr: 0,
    tier3_base_payout_inr: 0,
    // Working hours
    working_hours_start: '09:00',
    working_hours_end: '19:00',
  });

  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [duplicateMessage, setDuplicateMessage] = useState('');

  // Check for duplicate contracts when client or contract type changes
  useEffect(() => {
    const checkForDuplicate = async () => {
      if (formData.client_id && formData.contract_type && !editingContract) {
        try {
          const { data: existingContract, error } = await supabase
            .from('client_contracts')
            .select('id, contract_type')
            .eq('client_id', formData.client_id)
            .eq('contract_type', formData.contract_type)
            .single();

          if (existingContract && !error) {
            setIsDuplicate(true);
            setDuplicateMessage('A contract with this client and contract type combination already exists.');
          } else {
            setIsDuplicate(false);
            setDuplicateMessage('');
          }
        } catch (error) {
          // No duplicate found or error (which is fine)
          setIsDuplicate(false);
          setDuplicateMessage('');
        }
      } else {
        setIsDuplicate(false);
        setDuplicateMessage('');
      }
    };

    checkForDuplicate();
  }, [formData.client_id, formData.contract_type, editingContract]);

  // Load clients and contract types
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load clients
        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select('id, name')
          .eq('is_active', true)
          .order('name');

        if (clientsError) throw clientsError;

        // Load contract types
        const { data: contractTypesData, error: contractTypesError } = await supabase
          .from('contract_type_config')
          .select('type_key, display_name, description, is_active, sort_order')
          .eq('is_active', true)
          .order('sort_order');

        if (contractTypesError) {
          console.warn('Contract type config table not found, using fallback types:', contractTypesError);
          // Fallback to hardcoded contract types if table doesn't exist
          setContractTypes([
            {
              type_key: 'residential_address_check',
              display_name: 'Residential Address Check',
              description: 'Verification of residential addresses for individuals',
              is_active: true,
              sort_order: 1
            },
            {
              type_key: 'business_address_check',
              display_name: 'Business Address Check',
              description: 'Verification of business addresses for companies',
              is_active: true,
              sort_order: 2
            }
          ]);
        } else {
          setContractTypes(contractTypesData || []);
        }

        setClients(clientsData || []);
      } catch (error) {
        console.error('Failed to load data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load clients and contract types',
          variant: 'destructive',
        });
      }
    };

    if (isOpen) {
      loadData();
    }
  }, [isOpen, toast]);

  // Load editing contract data
  useEffect(() => {
    if (editingContract) {
      setFormData({
        client_id: editingContract.client_id || '',
        contract_type: editingContract.contract_type || 'standard',
        tier1_tat_days: editingContract.tier1_tat_days || 1,
        tier1_revenue_inr: editingContract.tier1_revenue_inr || 0,
        tier1_base_payout_inr: editingContract.tier1_base_payout_inr || 0,
        tier2_tat_days: editingContract.tier2_tat_days || 2,
        tier2_revenue_inr: editingContract.tier2_revenue_inr || 0,
        tier2_base_payout_inr: editingContract.tier2_base_payout_inr || 0,
        tier3_tat_days: editingContract.tier3_tat_days || 3,
        tier3_revenue_inr: editingContract.tier3_revenue_inr || 0,
        tier3_base_payout_inr: editingContract.tier3_base_payout_inr || 0,
        working_hours_start: editingContract.working_hours_start || '09:00',
        working_hours_end: editingContract.working_hours_end || '19:00',
      });
      setBonuses(editingContract.bonuses || []);
      setPenalties(editingContract.penalties || []);
    } else {
      // Reset form
      setFormData({
        client_id: '',
        contract_type: 'residential_address_check',
        tier1_tat_days: 1,
        tier1_revenue_inr: 0,
        tier1_base_payout_inr: 0,
        tier2_tat_days: 2,
        tier2_revenue_inr: 0,
        tier2_base_payout_inr: 0,
        tier3_tat_days: 3,
        tier3_revenue_inr: 0,
        tier3_base_payout_inr: 0,
        working_hours_start: '09:00',
        working_hours_end: '19:00',
      });
      setBonuses([]);
      setPenalties([]);
    }
  }, [editingContract, isOpen]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addBonus = () => {
    const newBonus: Bonus = {
      id: Date.now().toString(),
      name: '',
      tiers: ['all'],
      time_after_acceptance: 6,
      amount: 0
    };
    setBonuses(prev => [...prev, newBonus]);
  };

  const updateBonus = (index: number, field: string, value: any) => {
    setBonuses(prev => prev.map((bonus, i) => 
      i === index ? { ...bonus, [field]: value } : bonus
    ));
  };

  const removeBonus = (index: number) => {
    setBonuses(prev => prev.filter((_, i) => i !== index));
  };

  const addPenalty = () => {
    const newPenalty: Penalty = {
      id: Date.now().toString(),
      name: '',
      tiers: ['all'],
      time_after_acceptance: 24,
      amount: 0
    };
    setPenalties(prev => [...prev, newPenalty]);
  };

  const updatePenalty = (index: number, field: string, value: any) => {
    setPenalties(prev => prev.map((penalty, i) => 
      i === index ? { ...penalty, [field]: value } : penalty
    ));
  };

  const removePenalty = (index: number) => {
    setPenalties(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Check for duplicate contract before creating new one
      if (!editingContract) {
        const { data: existingContract, error: checkError } = await supabase
          .from('client_contracts')
          .select('id')
          .eq('client_id', formData.client_id)
          .eq('contract_type', formData.contract_type)
          .single();

        if (existingContract && !checkError) {
          toast({
            title: 'Contract Already Exists',
            description: 'A contract with this client and contract type combination already exists. Please edit the existing contract instead.',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }
      }

      const contractData = {
        ...formData,
        bonuses: bonuses as any,
        penalties: penalties as any,
        is_active: true,
        created_by: (await supabase.auth.getUser()).data.user?.id
      };

      if (editingContract) {
        // Update existing contract
        const { error } = await supabase
          .from('client_contracts')
          .update(contractData)
          .eq('id', editingContract.id);

        if (error) throw error;
      } else {
        // Create new contract
        const { error } = await supabase
          .from('client_contracts')
          .insert([contractData]);

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: editingContract ? 'Contract updated successfully' : 'Contract created successfully',
      });

      onSuccess();
    } catch (error: any) {
      console.error('Failed to save contract:', error);
      
      // Handle specific error cases
      if (error?.code === '23505') {
        // Unique constraint violation
        toast({
          title: 'Contract Already Exists',
          description: 'A contract with this client and contract type combination already exists. Please choose a different contract type or edit the existing contract.',
          variant: 'destructive',
        });
      } else if (error?.code === '23503') {
        // Foreign key constraint violation
        toast({
          title: 'Invalid Selection',
          description: 'Please ensure all selected options are valid.',
          variant: 'destructive',
        });
      } else {
        // Use enhanced error messages
        const { getErrorToast } = await import('@/utils/errorMessages');
        toast(getErrorToast(error));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const tierOptions = [
    { value: 'all', label: 'All Tiers' },
    { value: 'tier1', label: 'Tier 1 (Metro)' },
    { value: 'tier2', label: 'Tier 2 (City)' },
    { value: 'tier3', label: 'Tier 3 (Rural)' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingContract ? 'Edit Client Contract' : 'Create New Client Contract'}
          </DialogTitle>
          <DialogDescription>
            Define tier-based pricing, working hours, bonuses, and penalties for client contracts
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="pricing">Tier Pricing</TabsTrigger>
              <TabsTrigger value="bonuses">Bonuses</TabsTrigger>
              <TabsTrigger value="penalties">Penalties</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="client_id">Client *</Label>
                  <Select
                    value={formData.client_id}
                    onValueChange={(value) => handleInputChange('client_id', value)}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4" />
                            {client.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contract_type">Contract Type *</Label>
                  <Select
                    value={formData.contract_type}
                    onValueChange={(value) => handleInputChange('contract_type', value)}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select contract type" />
                    </SelectTrigger>
                    <SelectContent>
                      {contractTypes.map((contractType) => (
                        <SelectItem key={contractType.type_key} value={contractType.type_key}>
                          <div className="flex flex-col">
                            <span className="font-medium">{contractType.display_name}</span>
                            {contractType.description && (
                              <span className="text-sm text-muted-foreground">
                                {contractType.description}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Note: Each client can have only one contract per contract type. If a contract already exists for this client and contract type combination, you'll need to edit the existing contract instead.
                  </p>
                  {isDuplicate && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <p className="text-sm text-red-700">{duplicateMessage}</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pricing" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Tier-Based Pricing
                  </CardTitle>
                  <CardDescription>
                    Define TAT (in days), revenue, and base payout for each tier
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Tier 1 */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="bg-blue-100 text-blue-800">
                          Tier 1 (Metro)
                        </Badge>
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="tier1_tat_days">TAT (Days) *</Label>
                          <Input
                            id="tier1_tat_days"
                            type="number"
                            min="1"
                            value={formData.tier1_tat_days}
                            onChange={(e) => handleInputChange('tier1_tat_days', parseInt(e.target.value) || 1)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="tier1_revenue_inr">Revenue (₹) *</Label>
                          <Input
                            id="tier1_revenue_inr"
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.tier1_revenue_inr}
                            onChange={(e) => handleInputChange('tier1_revenue_inr', parseFloat(e.target.value) || 0)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="tier1_base_payout_inr">Base Payout (₹) *</Label>
                          <Input
                            id="tier1_base_payout_inr"
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.tier1_base_payout_inr}
                            onChange={(e) => handleInputChange('tier1_base_payout_inr', parseFloat(e.target.value) || 0)}
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* Tier 2 */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          Tier 2 (City)
                        </Badge>
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="tier2_tat_days">TAT (Days) *</Label>
                          <Input
                            id="tier2_tat_days"
                            type="number"
                            min="1"
                            value={formData.tier2_tat_days}
                            onChange={(e) => handleInputChange('tier2_tat_days', parseInt(e.target.value) || 2)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="tier2_revenue_inr">Revenue (₹) *</Label>
                          <Input
                            id="tier2_revenue_inr"
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.tier2_revenue_inr}
                            onChange={(e) => handleInputChange('tier2_revenue_inr', parseFloat(e.target.value) || 0)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="tier2_base_payout_inr">Base Payout (₹) *</Label>
                          <Input
                            id="tier2_base_payout_inr"
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.tier2_base_payout_inr}
                            onChange={(e) => handleInputChange('tier2_base_payout_inr', parseFloat(e.target.value) || 0)}
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* Tier 3 */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="bg-orange-100 text-orange-800">
                          Tier 3 (Rural)
                        </Badge>
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="tier3_tat_days">TAT (Days) *</Label>
                          <Input
                            id="tier3_tat_days"
                            type="number"
                            min="1"
                            value={formData.tier3_tat_days}
                            onChange={(e) => handleInputChange('tier3_tat_days', parseInt(e.target.value) || 3)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="tier3_revenue_inr">Revenue (₹) *</Label>
                          <Input
                            id="tier3_revenue_inr"
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.tier3_revenue_inr}
                            onChange={(e) => handleInputChange('tier3_revenue_inr', parseFloat(e.target.value) || 0)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="tier3_base_payout_inr">Base Payout (₹) *</Label>
                          <Input
                            id="tier3_base_payout_inr"
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.tier3_base_payout_inr}
                            onChange={(e) => handleInputChange('tier3_base_payout_inr', parseFloat(e.target.value) || 0)}
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* Working Hours */}
                    <div className="space-y-4 pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        <h3 className="text-lg font-semibold">Working Hours</h3>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="working_hours_start">Start Time *</Label>
                          <Input
                            id="working_hours_start"
                            type="time"
                            value={formData.working_hours_start}
                            onChange={(e) => handleInputChange('working_hours_start', e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="working_hours_end">End Time *</Label>
                          <Input
                            id="working_hours_end"
                            type="time"
                            value={formData.working_hours_end}
                            onChange={(e) => handleInputChange('working_hours_end', e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bonuses" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Bonuses
                  </CardTitle>
                  <CardDescription>
                    Define bonuses for completing work before TAT
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {bonuses.map((bonus, index) => (
                      <div key={bonus.id} className="p-4 border rounded-lg space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">Bonus {index + 1}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeBonus(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Bonus Name *</Label>
                            <Input
                              value={bonus.name}
                              onChange={(e) => updateBonus(index, 'name', e.target.value)}
                              placeholder="e.g., Early Completion Bonus"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Time After Acceptance (Hours) *</Label>
                            <Input
                              type="number"
                              min="1"
                              value={bonus.time_after_acceptance}
                              onChange={(e) => updateBonus(index, 'time_after_acceptance', parseInt(e.target.value) || 6)}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Amount (₹) *</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={bonus.amount}
                              onChange={(e) => updateBonus(index, 'amount', parseFloat(e.target.value) || 0)}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Applicable Tiers *</Label>
                            <Select
                              value={bonus.tiers[0]}
                              onValueChange={(value) => updateBonus(index, 'tiers', [value])}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {tierOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addBonus}
                      className="w-full"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Bonus
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="penalties" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Penalties
                  </CardTitle>
                  <CardDescription>
                    Define penalties for completing work after TAT
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {penalties.map((penalty, index) => (
                      <div key={penalty.id} className="p-4 border rounded-lg space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">Penalty {index + 1}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removePenalty(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Penalty Name *</Label>
                            <Input
                              value={penalty.name}
                              onChange={(e) => updatePenalty(index, 'name', e.target.value)}
                              placeholder="e.g., Late Completion Penalty"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Time After Acceptance (Hours) *</Label>
                            <Input
                              type="number"
                              min="1"
                              value={penalty.time_after_acceptance}
                              onChange={(e) => updatePenalty(index, 'time_after_acceptance', parseInt(e.target.value) || 24)}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Amount (₹) *</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={penalty.amount}
                              onChange={(e) => updatePenalty(index, 'amount', parseFloat(e.target.value) || 0)}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Applicable Tiers *</Label>
                            <Select
                              value={penalty.tiers[0]}
                              onValueChange={(value) => updatePenalty(index, 'tiers', [value])}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {tierOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addPenalty}
                      className="w-full"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Penalty
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || isDuplicate}>
              {isLoading ? 'Saving...' : editingContract ? 'Update Contract' : 'Create Contract'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}