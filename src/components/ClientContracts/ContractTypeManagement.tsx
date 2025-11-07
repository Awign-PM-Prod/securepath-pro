import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Settings,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ContractType {
  id: string;
  type_key: string;
  display_name: string;
  description: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

interface ContractTypeFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onCancel: () => void;
  editingType?: ContractType | null;
}

export default function ContractTypeManagement() {
  const [contractTypes, setContractTypes] = useState<ContractType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingType, setEditingType] = useState<ContractType | null>(null);
  const { toast } = useToast();

  const loadContractTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('contract_type_config')
        .select('*')
        .order('sort_order');

      if (error) {
        console.warn('Contract type config table not found:', error);
        // Show a message that migrations need to be run
        toast({
          title: 'Info',
          description: 'Contract type management requires database migrations. Please run the migrations first.',
          variant: 'default',
        });
        setContractTypes([]);
      } else {
        setContractTypes(data || []);
      }
    } catch (error) {
      console.error('Failed to load contract types:', error);
      toast({
        title: 'Error',
        description: 'Failed to load contract types. Please run the database migrations first.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadContractTypes();
  }, []);

  const handleEdit = (contractType: ContractType) => {
    setEditingType(contractType);
    setShowForm(true);
  };

  const handleDelete = async (contractType: ContractType) => {
    if (!confirm(`Are you sure you want to delete "${contractType.display_name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('contract_type_config')
        .update({ is_active: false })
        .eq('id', contractType.id);

      if (error) throw error;

      loadContractTypes();
      toast({
        title: 'Success',
        description: 'Contract type deleted successfully',
      });
    } catch (error) {
      console.error('Failed to delete contract type:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete contract type',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (contractType: ContractType) => {
    try {
      const { error } = await supabase
        .from('contract_type_config')
        .update({ is_active: !contractType.is_active })
        .eq('id', contractType.id);

      if (error) throw error;

      loadContractTypes();
      toast({
        title: 'Success',
        description: `Contract type ${contractType.is_active ? 'deactivated' : 'activated'} successfully`,
      });
    } catch (error) {
      console.error('Failed to toggle contract type:', error);
      toast({
        title: 'Error',
        description: 'Failed to update contract type',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contract Type Management</h1>
          <p className="text-muted-foreground">
            Manage contract types for client contracts
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Contract Type
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contract Types</CardTitle>
          <CardDescription>
            Manage the types of contracts available for clients
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2">Loading contract types...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Type Key</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contractTypes.map((contractType) => (
                  <TableRow key={contractType.id}>
                    <TableCell className="font-medium">
                      {contractType.display_name}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {contractType.type_key}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {contractType.description || 'No description'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={contractType.is_active ? "default" : "secondary"}
                        className={contractType.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}
                      >
                        {contractType.is_active ? (
                          <>
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Active
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 mr-1" />
                            Inactive
                          </>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(contractType)}
                        >
                          {contractType.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(contractType)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(contractType)}
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

      {/* Contract Type Form */}
      <ContractTypeForm
        isOpen={showForm}
        onOpenChange={setShowForm}
        onSuccess={() => {
          loadContractTypes();
          setShowForm(false);
          setEditingType(null);
        }}
        onCancel={() => {
          setShowForm(false);
          setEditingType(null);
        }}
        editingType={editingType}
      />
    </div>
  );
}

function ContractTypeForm({
  isOpen,
  onOpenChange,
  onSuccess,
  onCancel,
  editingType
}: ContractTypeFormProps) {
  const [formData, setFormData] = useState({
    type_key: '',
    display_name: '',
    description: '',
    sort_order: 0,
    is_active: true
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (editingType) {
      setFormData({
        type_key: editingType.type_key,
        display_name: editingType.display_name,
        description: editingType.description || '',
        sort_order: editingType.sort_order,
        is_active: editingType.is_active
      });
    } else {
      setFormData({
        type_key: '',
        display_name: '',
        description: '',
        sort_order: 0,
        is_active: true
      });
    }
  }, [editingType, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const contractTypeData = {
        ...formData
      };

      if (editingType) {
        // Update existing contract type
        const { error } = await supabase
          .from('contract_type_config')
          .update(contractTypeData)
          .eq('id', editingType.id);

        if (error) throw error;
      } else {
        // Create new contract type
        const { error } = await supabase
          .from('contract_type_config')
          .insert([contractTypeData]);

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: editingType ? 'Contract type updated successfully' : 'Contract type created successfully',
      });

      onSuccess();
    } catch (error) {
      console.error('Failed to save contract type:', error);
      toast({
        title: 'Error',
        description: 'Failed to save contract type',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingType ? 'Edit Contract Type' : 'Create New Contract Type'}
          </DialogTitle>
          <DialogDescription>
            Define a new contract type for client contracts
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type_key">Type Key *</Label>
            <Input
              id="type_key"
              value={formData.type_key}
              onChange={(e) => setFormData(prev => ({ ...prev, type_key: e.target.value }))}
              placeholder="e.g., residential_address_check"
              required
              disabled={!!editingType} // Don't allow editing type_key for existing types
            />
            <p className="text-xs text-muted-foreground">
              Unique identifier for the contract type (cannot be changed after creation)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="display_name">Display Name *</Label>
            <Input
              id="display_name"
              value={formData.display_name}
              onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
              placeholder="e.g., Residential Address Check"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of this contract type"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sort_order">Sort Order</Label>
            <Input
              id="sort_order"
              type="number"
              value={formData.sort_order}
              onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Lower numbers appear first in the list
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : editingType ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
