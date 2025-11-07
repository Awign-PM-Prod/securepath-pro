import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, X, DollarSign, MapPin, Clock, Building } from 'lucide-react';

export interface RateCardFormData {
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
}

interface RateCardFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Array<{ id: string; name: string; email: string }>;
}

const pincodeTiers = [
  { value: 'tier_1', label: 'Tier 1 - Metro Cities', description: 'Mumbai, Delhi, Bangalore, Chennai, Kolkata, Hyderabad, Pune, Ahmedabad' },
  { value: 'tier_2', label: 'Tier 2 - Major Cities', description: 'Jaipur, Lucknow, Kanpur, Nagpur, Indore, Bhopal, Coimbatore, Kochi' },
  { value: 'tier_3', label: 'Tier 3 - Towns & Rural', description: 'Smaller cities, towns, and rural areas' }
];

const completionSlabs = [
  { value: 'within_24h', label: 'Within 24 Hours', description: 'Same day or next day completion' },
  { value: 'within_48h', label: 'Within 48 Hours', description: '1-2 days completion' },
  { value: 'within_72h', label: 'Within 72 Hours', description: '2-3 days completion' },
  { value: 'within_168h', label: 'Within 1 Week', description: '3-7 days completion' },
  { value: 'beyond_168h', label: 'Beyond 1 Week', description: 'More than 7 days completion' }
];

export default function RateCardForm({ onSuccess, onCancel, isOpen, onOpenChange, clients }: RateCardFormProps) {
  const [formData, setFormData] = useState<RateCardFormData>({
    name: '',
    client_id: null,
    pincode_tier: '',
    completion_slab: '',
    base_rate_inr: 0,
    default_travel_inr: 0,
    default_bonus_inr: 0,
    is_active: true,
    effective_from: new Date().toISOString().split('T')[0],
    effective_until: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<RateCardFormData>>({});
  const { toast } = useToast();

  const validateForm = (): boolean => {
    const newErrors: Partial<RateCardFormData> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Rate card name is required';
    }

    if (!formData.pincode_tier) {
      newErrors.pincode_tier = 'Pincode tier is required';
    }

    if (!formData.completion_slab) {
      newErrors.completion_slab = 'Completion slab is required';
    }

    if (Number(formData.base_rate_inr) <= 0) {
      newErrors.base_rate_inr = 'Base rate must be greater than 0';
    }

    if (Number(formData.default_travel_inr) < 0) {
      newErrors.default_travel_inr = 'Travel allowance cannot be negative';
    }

    if (Number(formData.default_bonus_inr) < 0) {
      newErrors.default_bonus_inr = 'Bonus amount cannot be negative';
    }

    if (!formData.effective_from) {
      newErrors.effective_from = 'Effective from date is required';
    }

    if (formData.effective_until && formData.effective_until <= formData.effective_from) {
      newErrors.effective_until = 'Effective until date must be after effective from date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user?.user?.id) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('rate_cards')
        .insert({
          name: formData.name.trim(),
          client_id: formData.client_id || null,
          pincode_tier: formData.pincode_tier,
          completion_slab: formData.completion_slab,
          base_rate_inr: formData.base_rate_inr,
          default_travel_inr: formData.default_travel_inr,
          default_bonus_inr: formData.default_bonus_inr,
          is_active: formData.is_active,
          effective_from: formData.effective_from,
          effective_until: formData.effective_until || null,
          created_by: user.user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Rate Card Created',
        description: `${formData.name} has been successfully created.`,
      });

      // Reset form
      setFormData({
        name: '',
        client_id: null,
        pincode_tier: '',
        completion_slab: '',
        base_rate_inr: 0,
        default_travel_inr: 0,
        default_bonus_inr: 0,
        is_active: true,
        effective_from: new Date().toISOString().split('T')[0],
        effective_until: null,
      });
      setErrors({});
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Failed to create rate card:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create rate card. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof RateCardFormData, value: string | number | boolean | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleCancel = () => {
    setFormData({
      name: '',
      client_id: null,
      pincode_tier: '',
      completion_slab: '',
      base_rate_inr: 0,
      default_travel_inr: 0,
      default_bonus_inr: 0,
      is_active: true,
      effective_from: new Date().toISOString().split('T')[0],
      effective_until: null,
    });
    setErrors({});
    onCancel();
    onOpenChange(false);
  };

  const calculateTotalRate = () => {
    return formData.base_rate_inr + formData.default_travel_inr + formData.default_bonus_inr;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Create Rate Card
          </DialogTitle>
          <DialogDescription>
            Create a new rate card for background verification services with pricing tiers and completion time slabs.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Building className="h-4 w-4" />
              Basic Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Rate Card Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter rate card name"
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="client_id">Client (Optional)</Label>
                <Select 
                  value={formData.client_id || undefined} 
                  onValueChange={(value) => handleInputChange('client_id', value || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select client (leave empty for global rate card)" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Geographic and Time Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Geographic & Time Configuration
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pincode_tier">Pincode Tier *</Label>
                <Select 
                  value={formData.pincode_tier} 
                  onValueChange={(value) => handleInputChange('pincode_tier', value)}
                >
                  <SelectTrigger className={errors.pincode_tier ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select pincode tier" />
                  </SelectTrigger>
                  <SelectContent>
                    {pincodeTiers.map((tier) => (
                      <SelectItem key={tier.value} value={tier.value}>
                        <div>
                          <div className="font-medium">{tier.label}</div>
                          <div className="text-xs text-muted-foreground">{tier.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.pincode_tier && (
                  <p className="text-sm text-red-500">{errors.pincode_tier}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="completion_slab">Completion Time Slab *</Label>
                <Select 
                  value={formData.completion_slab} 
                  onValueChange={(value) => handleInputChange('completion_slab', value)}
                >
                  <SelectTrigger className={errors.completion_slab ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select completion time slab" />
                  </SelectTrigger>
                  <SelectContent>
                    {completionSlabs.map((slab) => (
                      <SelectItem key={slab.value} value={slab.value}>
                        <div>
                          <div className="font-medium">{slab.label}</div>
                          <div className="text-xs text-muted-foreground">{slab.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.completion_slab && (
                  <p className="text-sm text-red-500">{errors.completion_slab}</p>
                )}
              </div>
            </div>
          </div>

          {/* Pricing Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Pricing Configuration
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="base_rate_inr">Base Rate (INR) *</Label>
                <Input
                  id="base_rate_inr"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.base_rate_inr}
                  onChange={(e) => handleInputChange('base_rate_inr', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className={errors.base_rate_inr ? 'border-red-500' : ''}
                />
                {errors.base_rate_inr && (
                  <p className="text-sm text-red-500">{errors.base_rate_inr}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="default_travel_inr">Travel Allowance (INR)</Label>
                <Input
                  id="default_travel_inr"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.default_travel_inr}
                  onChange={(e) => handleInputChange('default_travel_inr', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className={errors.default_travel_inr ? 'border-red-500' : ''}
                />
                {errors.default_travel_inr && (
                  <p className="text-sm text-red-500">{errors.default_travel_inr}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="default_bonus_inr">Bonus Amount (INR)</Label>
                <Input
                  id="default_bonus_inr"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.default_bonus_inr}
                  onChange={(e) => handleInputChange('default_bonus_inr', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className={errors.default_bonus_inr ? 'border-red-500' : ''}
                />
                {errors.default_bonus_inr && (
                  <p className="text-sm text-red-500">{errors.default_bonus_inr}</p>
                )}
              </div>
            </div>

            {/* Total Rate Display */}
            <div className="bg-muted p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="font-medium">Total Rate:</span>
                <span className="text-2xl font-bold text-green-600">
                  ₹{calculateTotalRate().toFixed(2)}
                </span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Base: ₹{formData.base_rate_inr.toFixed(2)} + 
                Travel: ₹{formData.default_travel_inr.toFixed(2)} + 
                Bonus: ₹{formData.default_bonus_inr.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Validity Period */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Validity Period
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="effective_from">Effective From *</Label>
                <Input
                  id="effective_from"
                  type="date"
                  value={formData.effective_from}
                  onChange={(e) => handleInputChange('effective_from', e.target.value)}
                  className={errors.effective_from ? 'border-red-500' : ''}
                />
                {errors.effective_from && (
                  <p className="text-sm text-red-500">{errors.effective_from}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="effective_until">Effective Until (Optional)</Label>
                <Input
                  id="effective_until"
                  type="date"
                  value={formData.effective_until || ''}
                  onChange={(e) => handleInputChange('effective_until', e.target.value || null)}
                  className={errors.effective_until ? 'border-red-500' : ''}
                />
                {errors.effective_until && (
                  <p className="text-sm text-red-500">{errors.effective_until}</p>
                )}
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Status</h3>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => handleInputChange('is_active', checked as boolean)}
              />
              <Label htmlFor="is_active">Active Rate Card</Label>
            </div>
            <p className="text-sm text-muted-foreground">
              Inactive rate cards will not be used for new case allocations.
            </p>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Rate Card
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}