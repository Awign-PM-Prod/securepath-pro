import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Switch } from '@/components/ui/switch';

const editVendorSchema = z.object({
  name: z.string().min(1, 'Vendor name is required'),
  email: z.string().email('Please enter a valid email'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  contact_person: z.string().min(1, 'Contact person is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  pincode: z.string().min(6, 'Pincode must be at least 6 digits'),
  country: z.string().default('India'),
  coverage_pincodes: z.string().optional(),
  is_active: z.boolean().default(true),
});

type EditVendorForm = z.infer<typeof editVendorSchema>;

interface EditVendorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor: {
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
  } | null;
  onVendorUpdated?: () => void;
}

export function EditVendorDialog({ open, onOpenChange, vendor, onVendorUpdated }: EditVendorDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [coveragePincodes, setCoveragePincodes] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<EditVendorForm>({
    resolver: zodResolver(editVendorSchema),
    defaultValues: {
      country: 'India',
      is_active: true,
    },
  });

  const isActive = watch('is_active');

  // Load vendor data when dialog opens
  useEffect(() => {
    if (open && vendor) {
      // Load coverage pincodes
      supabase
        .from('vendors')
        .select('coverage_pincodes')
        .eq('id', vendor.id)
        .single()
        .then(({ data, error }) => {
          if (!error && data?.coverage_pincodes) {
            const pincodes = Array.isArray(data.coverage_pincodes)
              ? data.coverage_pincodes.join(', ')
              : '';
            setCoveragePincodes(pincodes);
          }
        });

      // Reset form with vendor data
      reset({
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        contact_person: vendor.contact_person,
        address: vendor.address,
        city: vendor.city,
        state: vendor.state,
        pincode: vendor.pincode,
        country: 'India',
        coverage_pincodes: '',
        is_active: vendor.is_active,
      });
    }
  }, [open, vendor, reset]);

  const onSubmit = async (data: EditVendorForm) => {
    if (!user || !vendor) {
      setError('User not authenticated or vendor not selected');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Prepare coverage pincodes
      const coveragePincodesArray = coveragePincodes
        ? coveragePincodes.split(',').map(p => p.trim()).filter(p => p)
        : [data.pincode];

      // Update vendor record
      const { error: vendorError } = await supabase
        .from('vendors')
        .update({
          name: data.name,
          email: data.email,
          phone: data.phone,
          contact_person: data.contact_person,
          address: data.address,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          country: data.country,
          coverage_pincodes: coveragePincodesArray,
          is_active: data.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', vendor.id);

      if (vendorError) {
        throw new Error(`Failed to update vendor: ${vendorError.message}`);
      }

      // Update profile if it exists (email, phone, contact person name)
      const { data: vendorData } = await supabase
        .from('vendors')
        .select('profile_id')
        .eq('id', vendor.id)
        .single();

      if (vendorData?.profile_id) {
        const contactNameParts = data.contact_person.split(' ');
        const firstName = contactNameParts[0] || data.contact_person;
        const lastName = contactNameParts.slice(1).join(' ') || '';

        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            email: data.email,
            phone: data.phone,
            first_name: firstName,
            last_name: lastName,
            updated_at: new Date().toISOString(),
          })
          .eq('id', vendorData.profile_id);

        if (profileError) {
          console.warn('Failed to update profile:', profileError);
          // Don't throw error here as vendor update succeeded
        }
      }

      toast({
        title: 'Success',
        description: 'Vendor details updated successfully.',
      });

      reset();
      setCoveragePincodes('');
      onOpenChange(false);
      onVendorUpdated?.();

    } catch (error) {
      console.error('Error updating vendor:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Vendor Details</DialogTitle>
          <DialogDescription>
            Update vendor information and settings.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Vendor Name *</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="Enter vendor name"
              />
              {errors.name && (
                <p className="text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="Enter email address"
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                {...register('phone')}
                placeholder="Enter phone number"
              />
              {errors.phone && (
                <p className="text-sm text-red-600">{errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_person">Contact Person *</Label>
              <Input
                id="contact_person"
                {...register('contact_person')}
                placeholder="Enter contact person name"
              />
              {errors.contact_person && (
                <p className="text-sm text-red-600">{errors.contact_person.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address *</Label>
            <Textarea
              id="address"
              {...register('address')}
              placeholder="Enter full address"
              rows={2}
            />
            {errors.address && (
              <p className="text-sm text-red-600">{errors.address.message}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                {...register('city')}
                placeholder="Enter city"
              />
              {errors.city && (
                <p className="text-sm text-red-600">{errors.city.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State *</Label>
              <Input
                id="state"
                {...register('state')}
                placeholder="Enter state"
              />
              {errors.state && (
                <p className="text-sm text-red-600">{errors.state.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="pincode">Pincode *</Label>
              <Input
                id="pincode"
                {...register('pincode')}
                placeholder="Enter pincode"
              />
              {errors.pincode && (
                <p className="text-sm text-red-600">{errors.pincode.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="coverage_pincodes">Coverage Pincodes</Label>
            <Input
              id="coverage_pincodes"
              value={coveragePincodes}
              onChange={(e) => setCoveragePincodes(e.target.value)}
              placeholder="Enter comma-separated pincodes (e.g., 400001, 400002, 400003)"
            />
            <p className="text-sm text-muted-foreground">
              Leave empty to use the main pincode as coverage area
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="is_active">Status</Label>
              <p className="text-sm text-muted-foreground">
                {isActive ? 'Vendor is active' : 'Vendor is inactive'}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Inactive</span>
              <Switch
                id="is_active"
                checked={isActive}
                onCheckedChange={(checked) => setValue('is_active', checked)}
              />
              <span className="text-sm font-medium">Active</span>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Update Vendor'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

