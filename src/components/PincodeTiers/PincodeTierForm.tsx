import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { pincodeTierService, CreatePincodeTierData } from '@/services/pincodeTierService';

interface PincodeTierFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingTier?: any;
}

export default function PincodeTierForm({ 
  onSuccess, 
  onCancel, 
  isOpen, 
  onOpenChange, 
  editingTier 
}: PincodeTierFormProps) {
  const [formData, setFormData] = useState<CreatePincodeTierData>({
    pincode: '',
    tier: 'tier_3',
    city: '',
    state: '',
    region: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (editingTier) {
      setFormData({
        pincode: editingTier.pincode || '',
        tier: editingTier.tier || 'tier_3',
        city: editingTier.city || '',
        state: editingTier.state || '',
        region: editingTier.region || '',
      });
    } else {
      setFormData({
        pincode: '',
        tier: 'tier_3',
        city: '',
        state: '',
        region: '',
      });
    }
    setErrors({});
  }, [editingTier, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.pincode.trim()) {
      newErrors.pincode = 'Pincode is required';
    } else if (!/^\d{6}$/.test(formData.pincode)) {
      newErrors.pincode = 'Pincode must be 6 digits';
    }

    if (!formData.tier) {
      newErrors.tier = 'Tier is required';
    }

    if (formData.city && formData.city.length < 2) {
      newErrors.city = 'City must be at least 2 characters';
    }

    if (formData.state && formData.state.length < 2) {
      newErrors.state = 'State must be at least 2 characters';
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
      if (editingTier) {
        await pincodeTierService.updatePincodeTier(editingTier.id, formData);
      } else {
        await pincodeTierService.createPincodeTier(formData);
      }
      
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Failed to save pincode tier:', error);
      setErrors({ submit: error.message || 'Failed to save pincode tier' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof CreatePincodeTierData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editingTier ? 'Edit Pincode Tier' : 'Add New Pincode Tier'}
          </DialogTitle>
          <DialogDescription>
            {editingTier 
              ? 'Update the pincode tier information.' 
              : 'Add a new pincode with its tier classification.'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pincode">Pincode *</Label>
              <Input
                id="pincode"
                value={formData.pincode}
                onChange={(e) => handleInputChange('pincode', e.target.value)}
                placeholder="e.g., 110001"
                maxLength={6}
                className={errors.pincode ? 'border-red-500' : ''}
              />
              {errors.pincode && (
                <p className="text-sm text-red-500">{errors.pincode}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tier">Tier *</Label>
              <Select
                value={formData.tier}
                onValueChange={(value: 'tier_1' | 'tier_2' | 'tier_3') => 
                  handleInputChange('tier', value)
                }
              >
                <SelectTrigger className={errors.tier ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tier_1">Tier 1 (Metro)</SelectItem>
                  <SelectItem value="tier_2">Tier 2 (Cities)</SelectItem>
                  <SelectItem value="tier_3">Tier 3 (Towns/Rural)</SelectItem>
                </SelectContent>
              </Select>
              {errors.tier && (
                <p className="text-sm text-red-500">{errors.tier}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city || ''}
                onChange={(e) => handleInputChange('city', e.target.value)}
                placeholder="e.g., New Delhi"
                className={errors.city ? 'border-red-500' : ''}
              />
              {errors.city && (
                <p className="text-sm text-red-500">{errors.city}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={formData.state || ''}
                onChange={(e) => handleInputChange('state', e.target.value)}
                placeholder="e.g., Delhi"
                className={errors.state ? 'border-red-500' : ''}
              />
              {errors.state && (
                <p className="text-sm text-red-500">{errors.state}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="region">Region</Label>
            <Input
              id="region"
              value={formData.region || ''}
              onChange={(e) => handleInputChange('region', e.target.value)}
              placeholder="e.g., North, South, East, West"
            />
          </div>

          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingTier ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

