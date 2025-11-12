import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { otpService } from '@/services/otpService';
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types/auth';
import { useAuth } from '@/contexts/AuthContext';

const phoneSchema = z.object({
  phone: z.string()
    .min(10, 'Phone number must be at least 10 digits')
    .regex(/^[0-9+\-() ]+$/, 'Please enter a valid phone number'),
});

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type PhoneForm = z.infer<typeof phoneSchema>;
type EmailForm = z.infer<typeof emailSchema>;

export default function OTPAuth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn } = useAuth();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userFirstName, setUserFirstName] = useState('');
  const [canResend, setCanResend] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [loginMethod, setLoginMethod] = useState<'phone' | 'email'>('phone');

  const phoneForm = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema),
  });

  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
  });

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

  const startResendTimer = () => {
    setCanResend(false);
    setResendTimer(30);
    
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const onPhoneSubmit = async (data: PhoneForm) => {
    setIsLoading(true);
    setError('');

    try {
      // Look up user by phone number
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email, first_name, user_id')
        .eq('phone', data.phone)
        .eq('is_active', true)
        .single();

      if (profileError || !profile) {
        setError('No active account found with this phone number');
        setIsLoading(false);
        return;
      }

      // Send OTP
      const otpResult = await otpService.sendOTP(
        data.phone,
        'login',
        profile.email,
        profile.user_id,
        profile.first_name
      );

      if (!otpResult.success) {
        setError(otpResult.error || 'Failed to send OTP');
        setIsLoading(false);
        return;
      }

      // Move to OTP step
      setPhoneNumber(data.phone);
      setUserEmail(profile.email);
      setUserFirstName(profile.first_name);
      setStep('otp');
      startResendTimer();
      
      toast({
        title: 'OTP Sent',
        description: 'Please check your phone for the verification code.',
      });
    } catch (err: any) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Phone submission error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otpCode.length !== 6) return;

    setIsLoading(true);
    setError('');

    try {
      // Create Supabase session - this function handles OTP verification and session creation
      console.log('Calling create-auth-session with:', { phone_number: phoneNumber, otp_code: otpCode });
      
      // Use fetch directly to get better error details
      const supabaseUrl = 'https://ycbftnwzoxktoroqpslo.supabase.co';
      const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYmZ0bnd6b3hrdG9yb3Fwc2xvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxMDU1MjYsImV4cCI6MjA3MzY4MTUyNn0.5MaCwrEC3yizhu62Ks2jFlS516MVWiPctlbPrVax2Ng';
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const accessToken = currentSession?.access_token;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/create-auth-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': accessToken ? `Bearer ${accessToken}` : `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          phone_number: phoneNumber,
          otp_code: otpCode
        })
      });
      
      const responseText = await response.text();
      console.log('Raw server response:', responseText);
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      let sessionData;
      try {
        sessionData = JSON.parse(responseText);
        console.log('Parsed response data:', sessionData);
      } catch (e) {
        console.error('Failed to parse response as JSON:', e);
        setError('Server returned invalid response. Please try again.');
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        const errorMessage = sessionData?.error || sessionData?.message || `Server error (${response.status})`;
        console.error('Server error response:', sessionData);
        setError(errorMessage);
        setIsLoading(false);
        return;
      }

      if (!sessionData?.success || !sessionData?.access_token) {
        console.error('Session creation failed:', sessionData);
        console.error('Response data:', JSON.stringify(sessionData, null, 2));
        const errorMessage = sessionData?.error || 'Invalid or expired OTP. Please try again.';
        setError(errorMessage);
        setIsLoading(false);
        return;
      }

      // Get user profile with role for redirect
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, email, role, first_name, created_at')
        .eq('phone', phoneNumber)
        .eq('is_active', true)
        .single();

      if (profileError || !profile) {
        setError('Failed to load user profile');
        setIsLoading(false);
        return;
      }

      // Set the session in Supabase client
      const { data: authData, error: setSessionError } = await supabase.auth.setSession({
        access_token: sessionData.access_token,
        refresh_token: sessionData.refresh_token
      });

      if (setSessionError || !authData.session) {
        console.error('Set session error:', setSessionError);
        setError('Failed to establish session. Please try again.');
        setIsLoading(false);
        return;
      }

      // Wait for auth state to update
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify session is active
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setError('Session not established. Please try again.');
        setIsLoading(false);
        return;
      }

      // Check if this is likely the user's first login
      // We'll check if the account was created recently (within last 48 hours)
      // New users created by admin/ops should set their password on first login
      const accountCreatedAt = new Date(profile.created_at);
      const hoursSinceCreation = (Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60);
      const isNewAccount = hoursSinceCreation < 48; // Account created within last 48 hours

      // Also check if last_sign_in_at is null or very close to created_at (first login)
      const userCreatedAt = session.user.created_at ? new Date(session.user.created_at) : null;
      const lastSignInAt = session.user.last_sign_in_at ? new Date(session.user.last_sign_in_at) : null;
      
      let isFirstLogin = false;
      if (!lastSignInAt) {
        // Never logged in before (this shouldn't happen after session is set, but check anyway)
        isFirstLogin = true;
      } else if (userCreatedAt && lastSignInAt) {
        // Check if last_sign_in_at is very close to created_at (within 10 minutes)
        // This indicates the account was just created and this might be first login
        const timeDiff = Math.abs(lastSignInAt.getTime() - userCreatedAt.getTime());
        isFirstLogin = timeDiff < 10 * 60 * 1000; // Within 10 minutes
      }

      // If it's a new account (created within 48 hours) or first login, redirect to password setup
      if (isNewAccount || isFirstLogin) {
        toast({
          title: 'Welcome!',
          description: `Welcome, ${profile.first_name}! Please set your password for future logins.`,
        });
        navigate('/setup-password', { replace: true });
        return;
      }

      toast({
        title: 'Success',
        description: `Welcome back, ${profile.first_name}!`,
      });

      // Redirect based on role
      const redirectPath = getRoleRedirectPath(profile.role as UserRole);
      navigate(redirectPath, { replace: true });

    } catch (err: any) {
      setError('An unexpected error occurred. Please try again.');
      console.error('OTP verification error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!canResend) return;

    setIsLoading(true);
    setError('');

    try {
      const otpResult = await otpService.resendOTP(
        phoneNumber,
        'login',
        userEmail,
        userFirstName
      );

      if (!otpResult.success) {
        setError(otpResult.error || 'Failed to resend OTP');
        setIsLoading(false);
        return;
      }

      startResendTimer();
      
      toast({
        title: 'OTP Resent',
        description: 'A new code has been sent to your phone.',
      });
    } catch (err: any) {
      setError('Failed to resend OTP. Please try again.');
      console.error('OTP resend error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPChange = (value: string) => {
    setOtpCode(value);
    if (value.length === 6) {
      // Auto-verify when 6 digits entered
      setTimeout(() => {
        handleVerifyOTP();
      }, 100);
    }
  };

  const handleBack = () => {
    setStep('phone');
    setOtpCode('');
    setError('');
  };

  const maskPhoneNumber = (phone: string) => {
    if (phone.length < 4) return phone;
    const last4 = phone.slice(-4);
    const masked = '*'.repeat(phone.length - 4);
    return masked + last4;
  };

  const onEmailSubmit = async (data: EmailForm) => {
    setIsLoading(true);
    setError('');

    try {
      const { error: signInError } = await signIn(data.email, data.password);

      if (signInError) {
        setError(signInError.message || 'Invalid email or password');
        setIsLoading(false);
        return;
      }

      // Wait for session to be established
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setError('Failed to establish session. Please try again.');
        setIsLoading(false);
        return;
      }

      // Fetch user profile to get role for redirect
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, email, role, first_name')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .single();

      if (profileError || !profile) {
        setError('Failed to load user profile. Please contact support.');
        setIsLoading(false);
        return;
      }

      toast({
        title: 'Success',
        description: `Welcome back, ${profile.first_name || 'User'}!`,
      });

      // Redirect based on role
      const redirectPath = getRoleRedirectPath(profile.role as UserRole);
      navigate(redirectPath, { replace: true });
    } catch (err) {
      console.error('Email login error:', err);
      setError('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  const switchToEmail = () => {
    setLoginMethod('email');
    setError('');
    setStep('phone');
    phoneForm.reset();
  };

  const switchToPhone = () => {
    setLoginMethod('phone');
    setError('');
    setStep('phone');
    emailForm.reset();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4">
        <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Background Verification System</CardTitle>
          <CardDescription>
            {step === 'otp' 
              ? 'Verify your identity' 
              : loginMethod === 'phone' 
                ? 'Enter your phone number to login' 
                : 'Enter your email and password to login'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'phone' ? (
            loginMethod === 'phone' ? (
              <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="Enter your phone number"
                    {...phoneForm.register('phone')}
                    className={phoneForm.formState.errors.phone ? 'border-destructive' : ''}
                  />
                  {phoneForm.formState.errors.phone && (
                    <p className="text-sm text-destructive">{phoneForm.formState.errors.phone.message}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Sending OTP...' : 'Send OTP'}
                </Button>
              </form>
            ) : (
              <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
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
                    placeholder="Enter your email address"
                    {...emailForm.register('email')}
                    className={emailForm.formState.errors.email ? 'border-destructive' : ''}
                  />
                  {emailForm.formState.errors.email && (
                    <p className="text-sm text-destructive">{emailForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    {...emailForm.register('password')}
                    className={emailForm.formState.errors.password ? 'border-destructive' : ''}
                  />
                  {emailForm.formState.errors.password && (
                    <p className="text-sm text-destructive">{emailForm.formState.errors.password.message}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            )
          ) : (
            <div className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label>Enter verification code</Label>
                <p className="text-sm text-muted-foreground">
                  Code sent to {maskPhoneNumber(phoneNumber)}
                </p>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otpCode}
                    onChange={handleOTPChange}
                    disabled={isLoading}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>

              <div className="flex justify-between items-center text-sm">
                <Button
                  type="button"
                  variant="link"
                  onClick={handleResendOTP}
                  disabled={!canResend || isLoading}
                  className="p-0 h-auto"
                >
                  {canResend ? 'Resend OTP' : `Resend in ${resendTimer}s`}
                </Button>
                
                <Button
                  type="button"
                  variant="link"
                  onClick={handleBack}
                  disabled={isLoading}
                  className="p-0 h-auto"
                >
                  Change number
                </Button>
              </div>

              <Button 
                onClick={handleVerifyOTP} 
                className="w-full" 
                disabled={isLoading || otpCode.length !== 6}
              >
                {isLoading ? 'Verifying...' : 'Verify OTP'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email/Phone Login Toggle Buttons - Below Card */}
      {step === 'phone' && loginMethod === 'phone' && (
        <Button
          type="button"
          variant="outline"
          onClick={switchToEmail}
          className="w-full"
        >
          Sign in with Email
        </Button>
      )}
      
      {step === 'phone' && loginMethod === 'email' && (
        <Button
          type="button"
          variant="outline"
          onClick={switchToPhone}
          className="w-full"
        >
          Sign in with Phone & OTP
        </Button>
      )}
      </div>
    </div>
  );
}
