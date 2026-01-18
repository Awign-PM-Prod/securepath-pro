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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole, UserProfile } from '@/types/auth';

const editUserSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  role: z.enum(['super_admin', 'ops_team', 'vendor_team', 'supply_team', 'qc_team', 'vendor', 'gig_worker', 'client'] as const),
  is_active: z.boolean(),
});

type EditUserForm = z.infer<typeof editUserSchema>;

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile | null;
  onUserUpdated?: () => void;
}

export function EditUserDialog({ open, onOpenChange, user, onUserUpdated }: EditUserDialogProps) {
  const { user: currentUser, canManageRole } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
  });

  const selectedRole = watch('role');
  const isActive = watch('is_active');

  // Reset form when user changes
  useEffect(() => {
    if (user) {
      reset({
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone || '',
        role: user.role,
        is_active: user.is_active,
      });
    }
  }, [user, reset]);

  const getAvailableRoles = (): { value: UserRole; label: string }[] => {
    if (!currentUser || !user) return [];

    const currentRole = currentUser.profile.role;
    const userRole = user.role;
    const roles: { value: UserRole; label: string }[] = [];

    // Super admin can edit any role
    if (currentRole === 'super_admin') {
      roles.push(
        { value: 'super_admin', label: 'Super Admin' },
        { value: 'ops_team', label: 'Operations Team' },
        { value: 'vendor_team', label: 'Vendor Team' },
        { value: 'supply_team', label: 'Supply Team' },
        { value: 'qc_team', label: 'QC Team' },
        { value: 'vendor', label: 'Vendor' },
        { value: 'gig_worker', label: 'Gig Worker' },
        { value: 'client', label: 'Client' },
      );
    } else if (currentRole === 'ops_team') {
      // Ops team can only edit client roles
      if (userRole === 'client') {
        roles.push({ value: 'client', label: 'Client' });
      }
    } else if (currentRole === 'vendor_team') {
      // Vendor team can edit vendor and gig worker roles
      if (userRole === 'vendor' || userRole === 'gig_worker') {
        roles.push(
          { value: 'vendor', label: 'Vendor' },
          { value: 'gig_worker', label: 'Gig Worker' },
        );
      }
    } else if (currentRole === 'vendor') {
      // Vendor can only edit gig worker roles
      if (userRole === 'gig_worker') {
        roles.push({ value: 'gig_worker', label: 'Gig Worker' });
      }
    }

    return roles;
  };

  const availableRoles = getAvailableRoles();

  const onSubmit = async (data: EditUserForm) => {
    if (!user) return;

    setIsLoading(true);
    setError('');

    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone || null,
          role: data.role,
          is_active: data.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Update user metadata in auth
      const { error: authError } = await supabase.auth.admin.updateUserById(
        user.user_id,
        {
          user_metadata: {
            first_name: data.first_name,
            last_name: data.last_name,
            role: data.role,
          },
        }
      );

      if (authError) {
        console.warn('Could not update auth metadata:', authError);
        // Don't throw error as profile was updated successfully
      }

      toast({
        title: 'Success',
        description: 'User updated successfully',
      });

      onUserUpdated?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating user:', error);
      setError(error instanceof Error ? error.message : 'Failed to update user');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setError('');
      onOpenChange(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] z-[100]">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user information and role. Changes will be applied immediately.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="first_name">First Name</Label>
            <Input
              id="first_name"
              {...register('first_name')}
              className={errors.first_name ? 'border-destructive' : ''}
            />
            {errors.first_name && (
              <p className="text-sm text-destructive">{errors.first_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="last_name">Last Name</Label>
            <Input
              id="last_name"
              {...register('last_name')}
              className={errors.last_name ? 'border-destructive' : ''}
            />
            {errors.last_name && (
              <p className="text-sm text-destructive">{errors.last_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone (Optional)</Label>
            <Input
              id="phone"
              {...register('phone')}
              className={errors.phone ? 'border-destructive' : ''}
            />
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select onValueChange={(value) => setValue('role', value as UserRole)}>
              <SelectTrigger className={errors.role ? 'border-destructive' : ''}>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent 
                className="select-content-fixed z-[9999]" 
                side="bottom" 
                align="start"
                position="popper"
                sideOffset={4}
              >
                {availableRoles.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="text-sm text-destructive">{errors.role.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="is_active">Status</Label>
            <Select onValueChange={(value) => setValue('is_active', value === 'true')}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent 
                className="select-content-fixed z-[9999]" 
                side="bottom" 
                align="start"
                position="popper"
                sideOffset={4}
              >
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Update User'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
