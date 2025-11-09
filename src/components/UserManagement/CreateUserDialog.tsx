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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SelectWithPortal } from './SelectWithPortal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { emailService } from '@/services/emailService';
import { UserRole, CreateUserData } from '@/types/auth';

const createUserSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  role: z.enum(['super_admin', 'ops_team', 'vendor_team', 'qc_team', 'vendor', 'gig_worker', 'client'] as const),
}).refine((data) => {
  if (data.role === 'gig_worker' && !data.phone) {
    return false;
  }
  return true;
}, {
  message: 'Phone number is required for gig workers',
  path: ['phone'],
});

type CreateUserForm = z.infer<typeof createUserSchema>;

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserCreated?: () => void;
}

export function CreateUserDialog({ open, onOpenChange, onUserCreated }: CreateUserDialogProps) {
  const { user, canManageRole } = useAuth();
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
  } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
  });

  const selectedRole = watch('role');

  const getAvailableRoles = (): { value: UserRole; label: string }[] => {
    if (!user) return [];

    const role = user.profile.role;
    const roles: { value: UserRole; label: string }[] = [];

    if (role === 'super_admin') {
      roles.push(
        { value: 'ops_team', label: 'Operations Team' },
        { value: 'vendor_team', label: 'Vendor Team' },
        { value: 'qc_team', label: 'QC Team' },
        { value: 'vendor', label: 'Vendor' },
        { value: 'gig_worker', label: 'Gig Worker' },
        { value: 'client', label: 'Client' },
      );
    } else if (role === 'ops_team') {
      roles.push({ value: 'client', label: 'Client' });
    } else if (role === 'vendor_team') {
      roles.push(
        { value: 'vendor', label: 'Vendor' },
        { value: 'gig_worker', label: 'Gig Worker' },
      );
    } else if (role === 'vendor') {
      roles.push({ value: 'gig_worker', label: 'Gig Worker' });
    }

    return roles;
  };

  const onSubmit = async (data: CreateUserForm) => {
    if (!canManageRole(data.role)) {
      setError('You do not have permission to create users with this role');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Call the Edge Function to create user with auth
      const { data: result, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: data.email,
          password: data.password,
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone,
          role: data.role,
          vendor_data: data.role === 'vendor' ? {
            name: `${data.first_name} ${data.last_name}`,
            contact_person: `${data.first_name} ${data.last_name}`,
            address: '',
            city: '',
            state: '',
            pincode: '',
            country: 'India',
            coverage_pincodes: []
          } : null,
          gig_worker_data: null
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to create user');
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to create user');
      }

      console.log('✅ User created:', { role: data.role, userId: result.user?.id, phone: data.phone });

      // Send SMS OTP for account setup to ALL users (not just gig workers)
      if (result.user?.id && data.phone) {
        console.log('📱 Attempting to send OTP to:', data.phone);
        try {
          const { data: otpResult, error: otpError } = await supabase.functions.invoke('send-otp', {
            body: {
              user_id: result.user.id,
              phone_number: data.phone,
              purpose: 'account_setup',
              email: data.email,
              first_name: data.first_name
            }
          });

          if (otpError) {
            console.warn('❌ Failed to send OTP:', otpError);
            toast({
              title: 'SMS Warning',
              description: 'User created but SMS failed to send.',
              variant: 'destructive',
            });
          } else if (otpResult?.success) {
            console.log('✅ OTP sent successfully to:', data.phone);
            toast({
              title: 'SMS Sent',
              description: `OTP sent to ${data.phone}. Gig worker can now set up their account.`,
            });
          } else {
            console.warn('❌ OTP send failed:', otpResult?.error);
            toast({
              title: 'SMS Warning',
              description: `User created but SMS failed: ${otpResult?.error}`,
              variant: 'destructive',
            });
          }
        } catch (error) {
          console.warn('Could not send OTP:', error);
          toast({
            title: 'SMS Warning',
            description: 'User created but SMS failed to send.',
            variant: 'destructive',
          });
        }
      }

      // All users now receive OTP for account setup
      const successMessage = `${data.first_name} ${data.last_name} has been added. They will receive an SMS OTP to login for the first time.`;

      toast({
        title: 'User created successfully',
        description: successMessage,
      });

      reset();
      onOpenChange(false);
      onUserCreated?.();
    } catch (err: any) {
      const { getErrorAlertMessage } = await import('@/utils/errorMessages');
      setError(getErrorAlertMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const availableRoles = getAvailableRoles();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] z-[100]">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Add a new user to the system with appropriate role permissions.
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              className={errors.email ? 'border-destructive' : ''}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              {...register('password')}
              className={errors.password ? 'border-destructive' : ''}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">
              Phone {selectedRole === 'gig_worker' && <span className="text-destructive">*</span>}
              {selectedRole !== 'gig_worker' && <span className="text-muted-foreground">(Optional)</span>}
            </Label>
            <Input
              id="phone"
              placeholder={selectedRole === 'gig_worker' ? 'Required for SMS OTP' : 'Optional'}
              {...register('phone')}
              className={errors.phone ? 'border-destructive' : ''}
            />
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <SelectWithPortal
              value={selectedRole}
              onValueChange={(value) => setValue('role', value as UserRole)}
              placeholder="Select a role"
              error={!!errors.role}
            >
              {availableRoles.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectWithPortal>
            {errors.role && (
              <p className="text-sm text-destructive">{errors.role.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create User'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}