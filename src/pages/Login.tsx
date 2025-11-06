import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/auth';
import { supabase } from '@/integrations/supabase/client';
import { OTPVerification } from '@/components/auth/OTPVerification';
import { otpService } from '@/services/otpService';
import { useToast } from '@/hooks/use-toast';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showOTP, setShowOTP] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [userEmail, setUserEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  // Redirect if already logged in (but not if OTP verification is pending)
  useEffect(() => {
    if (user && !showOTP) {
      const redirectPath = getRoleRedirectPath(user.profile.role);
      navigate(redirectPath, { replace: true });
    }
  }, [user, navigate, showOTP]);

  const getRoleRedirectPath = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return '/admin';
      case 'ops_team':
        return '/ops';
      case 'vendor_team':
        return '/vendor-team';
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

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError('');

    // First, try to sign in with email and password
    const { error: signInError } = await signIn(data.email, data.password);

    if (signInError) {
      const { getErrorAlertMessage } = await import('@/utils/errorMessages');
      setError(getErrorAlertMessage(signInError));
      setIsLoading(false);
      return;
    }

    // Get user profile to check role
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) {
      setError('Failed to get user information');
      setIsLoading(false);
      return;
    }

    // Get profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', authUser.id)
      .single();

    if (profileError || !profile) {
      setError('Failed to get user profile');
      setIsLoading(false);
      return;
    }

    // If user is gig_worker, require OTP verification
    if (profile.role === 'gig_worker') {
      // Get phone number from gig_partners table
      const { data: gigWorker, error: gigError } = await supabase
        .from('gig_partners')
        .select('phone')
        .eq('user_id', authUser.id)
        .single();

      if (gigError || !gigWorker || !gigWorker.phone) {
        setError('Phone number not found. Please contact administrator.');
        await supabase.auth.signOut(); // Sign out since OTP verification is required
        setIsLoading(false);
        return;
      }

      // Send OTP
      const otpResult = await otpService.sendOTP(gigWorker.phone, 'login', data.email);
      
      if (!otpResult.success) {
        setError(otpResult.error || 'Failed to send OTP');
        await supabase.auth.signOut(); // Sign out since OTP verification is required
        setIsLoading(false);
        return;
      }

      // Show OTP verification screen
      setPhoneNumber(gigWorker.phone);
      setUserEmail(data.email);
      setShowOTP(true);
      setIsLoading(false);
      
      toast({
        title: 'OTP Sent',
        description: 'Please check your phone for the verification code.',
      });
    } else {
      // For non-gig workers, login is complete
      setIsLoading(false);
    }
  };

  const handleOTPVerified = () => {
    setShowOTP(false);
    toast({
      title: 'Success',
      description: 'Login successful!',
    });
    // The useEffect will handle the redirect now that showOTP is false
  };

  const handleCancelOTP = async () => {
    await supabase.auth.signOut();
    setShowOTP(false);
    setPhoneNumber('');
    setUserEmail('');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Background Verification System</CardTitle>
          <CardDescription>
            {showOTP ? 'Verify your identity' : 'Sign in to access your dashboard'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showOTP ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
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
                  placeholder="Enter your password"
                  {...register('password')}
                  className={errors.password ? 'border-destructive' : ''}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>

              <div className="text-center">
                <Link
                  to="/forgot-password"
                  className="text-sm text-blue-600 hover:text-blue-500 hover:underline"
                >
                  Forgot your password?
                </Link>
              </div>
            </form>
          ) : (
            <OTPVerification
              phoneNumber={phoneNumber}
              purpose="login"
              email={userEmail}
              onVerified={handleOTPVerified}
              onCancel={handleCancelOTP}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}