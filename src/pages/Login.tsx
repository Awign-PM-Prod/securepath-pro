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
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/auth';
import { supabase } from '@/integrations/supabase/client';
import { OTPVerification } from '@/components/auth/OTPVerification';
import { useToast } from '@/hooks/use-toast';

const phoneSchema = z.object({
  phone: z.string().regex(/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number'),
});

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type PhoneForm = z.infer<typeof phoneSchema>;
type EmailForm = z.infer<typeof emailSchema>;

export default function Login() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showOTP, setShowOTP] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loginMethod, setLoginMethod] = useState<'phone' | 'email'>('phone');

  const phoneForm = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema),
  });

  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
  });

  // Redirect if already logged in
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

  const onSubmit = async (data: PhoneForm) => {
    setIsLoading(true);
    setError('');

    try {
      // Verify the phone number exists in the system
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('email, first_name, user_id')
        .eq('phone', data.phone)
        .eq('is_active', true)
        .single();

      if (profileError || !profileData) {
        setError('Phone number not registered in the system');
        setIsLoading(false);
        return;
      }

      // Send OTP to the phone number
      const { data: otpData, error: otpError } = await supabase.functions.invoke('send-otp', {
        body: {
          phone_number: data.phone,
          purpose: 'login',
          email: profileData.email,
          user_id: profileData.user_id,
          first_name: profileData.first_name,
        },
      });

      if (otpError) {
        setError(otpError.message || 'Failed to send OTP');
        setIsLoading(false);
        return;
      }

      if (!otpData?.success) {
        setError(otpData?.error || 'Failed to send OTP');
        setIsLoading(false);
        return;
      }
      // Show OTP verification screen
      setPhoneNumber(data.phone);
      setShowOTP(true);
      setIsLoading(false);
      
      toast({
        title: 'OTP Sent',
        description: 'Please check your phone for the verification code.',
      });
    } catch (err) {
      console.error('=== EXCEPTION IN onSubmit ===');
      console.error('Error type:', err instanceof Error ? err.constructor.name : typeof err);
      console.error('Error message:', err instanceof Error ? err.message : String(err));
      console.error('Full error:', err);
      setError('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  const handleOTPVerified = async (otp: string) => {
    setIsLoading(true);
    setError('');
    
    try {
      const requestBody = {
        phone_number: phoneNumber,
        otp_code: otp
      };
      
      console.log('=== CREATING AUTH SESSION ===');
      console.log('Phone Number:', phoneNumber);
      console.log('OTP Code:', otp);
      console.log('Request Body:', JSON.stringify(requestBody));
      
      // Call create-auth-session which verifies OTP and creates session
      const { data, error } = await supabase.functions.invoke('create-auth-session', {
        body: requestBody
      });
      
      console.log('=== AUTH SESSION RESPONSE ===');
      console.log('Success:', data?.success);
      console.log('Error:', error);
      console.log('Full Response:', JSON.stringify({ data, error }));

      if (error || !data?.success) {
        console.error('Session creation error:', error || data);
        setError(data?.error || 'Failed to create session');
        setIsLoading(false);
        return;
      }

      // Set the session using the tokens from the Edge Function
      console.log('🔐 Setting session with tokens...');
      const { error: sessionError, data: sessionData } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token
      });

      if (sessionError || !sessionData.session) {
        console.error('❌ Set session error:', sessionError);
        setError('Failed to establish session');
        setIsLoading(false);
        return;
      }

      console.log('✅ Session set, verifying persistence...');
      console.log('📅 Session expires at:', new Date(sessionData.session.expires_at! * 1000).toLocaleString());

      // Wait a brief moment for localStorage to be updated
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify session is persisted by checking it again
      const { data: { session: verifiedSession }, error: verifyError } = await supabase.auth.getSession();
      
      if (verifyError) {
        console.error('❌ Error verifying session:', verifyError);
        setError('Failed to verify session. Please try again.');
        setIsLoading(false);
        return;
      }
      
      if (!verifiedSession) {
        console.error('❌ Session not persisted after setSession');
        // Check localStorage directly
        const storageKeys = Object.keys(localStorage).filter(key => key.includes('supabase') || key.includes('sb-'));
        console.log('📦 localStorage keys:', storageKeys);
        setError('Session not established. Please try again.');
        setIsLoading(false);
        return;
      }

      console.log('✅ Session successfully established and persisted');
      console.log('✅ Verified session user ID:', verifiedSession.user.id);

      // Fetch user profile to get role for redirect
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, email, role, first_name')
        .eq('user_id', verifiedSession.user.id)
        .eq('is_active', true)
        .single();

      if (profileError || !profile) {
        console.error('❌ Error fetching profile:', profileError);
        setError('Failed to load user profile. Please try again.');
        setIsLoading(false);
        return;
      }

      console.log('✅ Profile loaded:', profile.role);

      setShowOTP(false);
      setIsLoading(false);
      
      toast({
        title: 'Success',
        description: `Welcome back, ${profile.first_name || 'User'}!`,
      });

      // Manually redirect based on role instead of relying on useEffect
      const redirectPath = getRoleRedirectPath(profile.role as UserRole);
      console.log('🔄 Redirecting to:', redirectPath);
      
      // Small delay to ensure toast is visible, then redirect
      setTimeout(() => {
        navigate(redirectPath, { replace: true });
      }, 500);
    } catch (err) {
      console.error('Unexpected error during session creation:', err);
      setError('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  const handleCancelOTP = () => {
    setShowOTP(false);
    setPhoneNumber('');
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

      toast({
        title: 'Success',
        description: 'Login successful!',
      });
      // The useEffect will handle the redirect
    } catch (err) {
      console.error('Email login error:', err);
      setError('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  const switchToEmail = () => {
    setLoginMethod('email');
    setError('');
    phoneForm.reset();
  };

  const switchToPhone = () => {
    setLoginMethod('phone');
    setError('');
    emailForm.reset();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative">
      {/* Email Login Button - Top Right (only show when in phone mode and not showing OTP) */}
      {!showOTP && loginMethod === 'phone' && (
        <Button
          type="button"
          variant="outline"
          onClick={switchToEmail}
          className="absolute top-4 right-4"
        >
          Sign in with Email
        </Button>
      )}
      
      {/* Phone Login Button - Top Right (only show when in email mode) */}
      {!showOTP && loginMethod === 'email' && (
        <Button
          type="button"
          variant="outline"
          onClick={switchToPhone}
          className="absolute top-4 right-4"
        >
          Sign in with Phone
        </Button>
      )}

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Background Verification System</CardTitle>
          <CardDescription>
            {showOTP 
              ? 'Verify your identity' 
              : loginMethod === 'phone' 
                ? 'Enter your phone number to sign in' 
                : 'Enter your email and password to sign in'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showOTP ? (
            <>
              {loginMethod === 'phone' ? (
                <form onSubmit={phoneForm.handleSubmit(onSubmit)} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="flex">
                      <div className="flex items-center px-3 border border-r-0 rounded-l-md border-input bg-muted">
                        <span className="text-sm text-muted-foreground">+91</span>
                      </div>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="Enter 10-digit phone number"
                        {...phoneForm.register('phone')}
                        className={`rounded-l-none ${phoneForm.formState.errors.phone ? 'border-destructive' : ''}`}
                      />
                    </div>
                    {phoneForm.formState.errors.phone && (
                      <p className="text-sm text-destructive">{phoneForm.formState.errors.phone.message}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Sending OTP...' : 'Send OTP'}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={switchToEmail}
                    className="w-full"
                  >
                    Sign in with Email
                  </Button>

                  <div className="text-center text-sm text-muted-foreground">
                    <p>You will receive an OTP on your registered mobile number</p>
                  </div>
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

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={switchToPhone}
                    className="w-full"
                  >
                    Sign in with Phone & OTP
                  </Button>
                </form>
              )}
            </>
          ) : (
            <OTPVerification
              phoneNumber={phoneNumber}
              purpose="login"
              onVerified={handleOTPVerified}
              onCancel={handleCancelOTP}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
