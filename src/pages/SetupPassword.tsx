import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Lock, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/auth';

const passwordSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type PasswordForm = z.infer<typeof passwordSchema>;

export default function SetupPassword() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [checkingPassword, setCheckingPassword] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const password = watch('password');

  useEffect(() => {
    const checkPasswordStatus = async () => {
      // Check if this is a first login redirect from sessionStorage
      const isFirstLoginRedirect = sessionStorage.getItem('isFirstLogin') === 'true';
      const storedUserId = sessionStorage.getItem('firstLoginUserId');
      
      // If we're waiting for auth to load (first login redirect), be patient
      if (authLoading && isFirstLoginRedirect) {
        console.log('⏳ Auth is loading, waiting for first login session...');
        return;
      }

      // If not authenticated but we have a first login flag, wait a bit for auth to load
      if (!user && isFirstLoginRedirect) {
        console.log('⏳ Waiting for auth to load after first login redirect...');
        console.log('⏳ Stored user ID:', storedUserId);
        
        // Wait up to 5 seconds for auth to load (allowing time for localStorage session to be read)
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds (100ms each)
        
        const checkAuth = setInterval(() => {
          attempts++;
          
          // Check if user is now available
          if (user) {
            console.log('✅ Auth loaded successfully after', attempts * 100, 'ms');
            clearInterval(checkAuth);
            // Clear flags and continue
            sessionStorage.removeItem('isFirstLogin');
            sessionStorage.removeItem('redirectAfterAuth');
            sessionStorage.removeItem('firstLoginUserId');
            setCheckingPassword(false);
            return;
          }
          
          // If we've waited too long, redirect to login
          if (attempts >= maxAttempts) {
            console.log('⚠️ Auth not loaded after', maxAttempts * 100, 'ms, redirecting to login');
            clearInterval(checkAuth);
            sessionStorage.removeItem('isFirstLogin');
            sessionStorage.removeItem('redirectAfterAuth');
            sessionStorage.removeItem('firstLoginUserId');
            navigate('/');
            return;
          }
        }, 100);
        
        // Cleanup interval on unmount
        return () => clearInterval(checkAuth);
      }

      // If not authenticated and not a first login redirect, redirect to login
      if (!user && !isFirstLoginRedirect) {
        navigate('/');
        return;
      }

      // If we have a user, clear sessionStorage flags
      if (user) {
        if (isFirstLoginRedirect) {
          console.log('✅ User authenticated, clearing first login flags');
          sessionStorage.removeItem('isFirstLogin');
          sessionStorage.removeItem('redirectAfterAuth');
          sessionStorage.removeItem('firstLoginUserId');
        }
        setCheckingPassword(false);
      }
    };

    checkPasswordStatus();
  }, [user, authLoading, navigate]);

  const getRoleRedirectPath = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return '/admin';
      case 'ops_team':
        return '/ops';
      case 'vendor_team':
        return '/vendor-team';
      case 'supply_team':
        return '/supply';
      case 'qc_team':
        return '/qc';
      case 'vendor':
        return '/vendor';
      case 'gig_worker':
        return '/gig';
      case 'client':
        return '/client';
      default:
        return '/';
    }
  };

  const getPasswordStrength = (password: string) => {
    if (!password) return { strength: 0, label: '', color: '' };
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    const strengthMap = {
      0: { label: 'Very Weak', color: 'bg-red-500' },
      1: { label: 'Weak', color: 'bg-red-400' },
      2: { label: 'Fair', color: 'bg-yellow-400' },
      3: { label: 'Good', color: 'bg-yellow-300' },
      4: { label: 'Strong', color: 'bg-green-400' },
      5: { label: 'Very Strong', color: 'bg-green-500' },
    };

    return { strength, ...strengthMap[strength as keyof typeof strengthMap] };
  };

  const onSubmit = async (data: PasswordForm) => {
    setIsLoading(true);
    setError('');

    try {
      // Store current user role and ID before password update
      const currentRole = user?.profile?.role;
      const currentUserId = user?.id;
      
      if (!currentRole) {
        throw new Error('Unable to determine user role. Please try again.');
      }

      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.password
      });

      if (updateError) {
        throw updateError;
      }

      toast({
        title: 'Success',
        description: 'Password set successfully! Redirecting to your dashboard...',
      });

      // Wait for USER_UPDATED event to process and ensure session is still valid
      await new Promise(resolve => setTimeout(resolve, 300));

      // Verify session is still valid after password update
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('Session lost after password update:', sessionError);
        // If session is lost, redirect to login
        navigate('/', { replace: true });
        return;
      }

      // Fetch profile directly to get role (bypassing AuthContext which might be updating)
      let profileRole: UserRole | null = null;
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle();
        
        if (!profileError && profile?.role) {
          profileRole = profile.role as UserRole;
        }
      } catch (e) {
        console.warn('Could not fetch profile directly:', e);
      }

      // Use profile role if available, otherwise fall back to stored role
      const finalRole = profileRole || currentRole;

      if (finalRole) {
        const redirectPath = getRoleRedirectPath(finalRole);
        console.log('🔄 Redirecting after password setup to:', redirectPath, 'for role:', finalRole);
        
        // Use a small delay to ensure toast is visible, then redirect
        setTimeout(() => {
          navigate(redirectPath, { replace: true });
        }, 500);
      } else {
        console.warn('⚠️ No role found for redirect, going to home');
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      console.error('Error setting password:', err);
      setError(err.message || 'Failed to set password. Please try again.');
      setIsLoading(false);
    }
    // Note: Don't set isLoading to false here if redirecting, let the redirect happen
  };

  if (authLoading || checkingPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  const passwordStrength = getPasswordStrength(password || '');

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Set Your Password</CardTitle>
          <CardDescription>
            Set a password to enable email/password login for future access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  {...register('password')}
                  className={`pr-10 ${errors.password ? 'border-destructive' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
              {password && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Password strength</span>
                    <span className={passwordStrength.color === 'bg-green-500' || passwordStrength.color === 'bg-green-400' ? 'text-green-600' : passwordStrength.color === 'bg-yellow-400' || passwordStrength.color === 'bg-yellow-300' ? 'text-yellow-600' : 'text-red-600'}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${passwordStrength.color}`}
                      style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  {...register('confirmPassword')}
                  className={`pr-10 ${errors.confirmPassword ? 'border-destructive' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            <div className="bg-muted p-3 rounded-md text-sm space-y-1">
              <p className="font-medium">Password requirements:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>At least 8 characters</li>
                <li>At least one uppercase letter</li>
                <li>At least one lowercase letter</li>
                <li>At least one number</li>
                <li>At least one special character</li>
              </ul>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Setting Password...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Set Password
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

