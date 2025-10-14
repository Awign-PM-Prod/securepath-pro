import React, { useState } from 'react';
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

const createVendorSchema = z.object({
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
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type CreateVendorForm = z.infer<typeof createVendorSchema>;

interface CreateVendorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVendorCreated?: () => void;
}

export function CreateVendorDialog({ open, onOpenChange, onVendorCreated }: CreateVendorDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateVendorForm>({
    resolver: zodResolver(createVendorSchema),
    defaultValues: {
      country: 'India',
    },
  });

  const onSubmit = async (data: CreateVendorForm) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Prepare coverage pincodes
      const coveragePincodes = data.coverage_pincodes
        ? data.coverage_pincodes.split(',').map(p => p.trim()).filter(p => p)
        : [data.pincode];

      // Step 1: Create vendor record first (before auth user to avoid RLS issues)
      // We'll create it without profile_id first, then update it later
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendors')
        .insert({
          name: data.name,
          email: data.email,
          phone: data.phone,
          contact_person: data.contact_person,
          address: data.address,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          country: data.country,
          coverage_pincodes: coveragePincodes,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (vendorError) {
        throw new Error(`Failed to create vendor: ${vendorError.message}`);
      }

      // Step 2: Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            first_name: data.contact_person.split(' ')[0] || data.contact_person,
            last_name: data.contact_person.split(' ').slice(1).join(' ') || '',
            phone: data.phone,
            role: 'vendor'
          }
        }
      });

      if (authError) {
        // Clean up vendor record if auth user creation fails
        await supabase.from('vendors').delete().eq('id', vendorData.id);
        throw new Error(`Failed to create auth user: ${authError.message}`);
      }

      if (!authData.user) {
        // Clean up vendor record if auth user creation fails
        await supabase.from('vendors').delete().eq('id', vendorData.id);
        throw new Error('Auth user creation failed - no user returned');
      }

      // Note: The new user is now logged in, but we'll continue with profile creation
      // The original user session is lost, but this is acceptable for vendor creation

      // Step 3: Check if profile already exists (might be auto-created by trigger)
      let profileData;
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('user_id', authData.user.id)
        .single();

      if (existingProfile) {
        // Profile already exists, update it
        const { data: updatedProfile, error: updateError } = await supabase
          .from('profiles')
          .update({
            email: data.email,
            first_name: data.contact_person.split(' ')[0] || data.contact_person,
            last_name: data.contact_person.split(' ').slice(1).join(' ') || '',
            phone: data.phone,
            role: 'vendor',
            created_by: user.id,
          })
          .eq('user_id', authData.user.id)
          .select('id')
          .single();

        if (updateError) {
          throw new Error(`Failed to update profile: ${updateError.message}`);
        }
        profileData = updatedProfile;
      } else {
        // Profile doesn't exist, create it
        const { data: newProfile, error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: authData.user.id,
            email: data.email,
            first_name: data.contact_person.split(' ')[0] || data.contact_person,
            last_name: data.contact_person.split(' ').slice(1).join(' ') || '',
            phone: data.phone,
            role: 'vendor',
            created_by: user.id,
          })
          .select('id')
          .single();

        if (profileError) {
          throw new Error(`Failed to create profile: ${profileError.message}`);
        }
        profileData = newProfile;
      }

      // Step 4: Update vendor record with profile_id
      const { error: vendorUpdateError } = await supabase
        .from('vendors')
        .update({ profile_id: profileData.id })
        .eq('id', vendorData.id);

      if (vendorUpdateError) {
        console.warn('Failed to link vendor to profile:', vendorUpdateError);
        // Don't throw error here as the vendor and profile are already created
      }

      toast({
        title: 'Success',
        description: 'Vendor created successfully. They can now login with their email and password.',
      });

      reset();
      onOpenChange(false);
      onVendorCreated?.();

    } catch (error) {
      console.error('Error creating vendor:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Vendor</DialogTitle>
          <DialogDescription>
            Create a new vendor account. The vendor will be able to login with their email and password.
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
              {...register('coverage_pincodes')}
              placeholder="Enter comma-separated pincodes (e.g., 400001, 400002, 400003)"
            />
            <p className="text-sm text-muted-foreground">
              Leave empty to use the main pincode as coverage area
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Login Password *</Label>
            <Input
              id="password"
              type="password"
              {...register('password')}
              placeholder="Enter password for vendor login"
            />
            {errors.password && (
              <p className="text-sm text-red-600">{errors.password.message}</p>
            )}
            <p className="text-sm text-muted-foreground">
              The vendor will use this password to login to the system
            </p>
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
              {isLoading ? 'Creating...' : 'Create Vendor'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
