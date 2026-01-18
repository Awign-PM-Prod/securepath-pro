import React, { useState, useEffect, useRef } from 'react';
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
  const { signIn, user, loading: authLoading } = useAuth();
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
  
  // Track if we're currently processing OTP verification to prevent race condition
  const isProcessingOTP = useRef(false);
  const pendingFirstLoginRedirect = useRef(false);

  // Redirect if already logged in (but skip if we're processing OTP verification)
  useEffect(() => {
    // Don't redirect if we're currently processing OTP verification
    if (isProcessingOTP.current || pendingFirstLoginRedirect.current) {
      console.log('⏸️ Skipping auto-redirect - OTP verification in progress or first login redirect pending');
      return;
    }
    
    // Don't redirect if we're already on the setup-password page
    if (window.location.pathname === '/setup-password') {
      console.log('⏸️ Skipping auto-redirect - already on setup-password page');
      return;
    }
    
    // Don't redirect if we're on the OTP step (user is still verifying)
    if (step === 'otp') {
      console.log('⏸️ Skipping auto-redirect - user is on OTP step');
      return;
    }
    
    if (!authLoading && user) {
      const redirectPath = getRoleRedirectPath(user.profile.role);
      console.log('🔄 Redirecting authenticated user to:', redirectPath);
      navigate(redirectPath, { replace: true });
    }
  }, [user, authLoading, navigate, step]);

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
      // Use limit(1) instead of single() to handle cases where multiple profiles have the same phone
      const { data: profilesData, error: profileError } = await supabase
        .from('profiles')
        .select('email, first_name, user_id')
        .eq('phone', data.phone)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (profileError || !profilesData || profilesData.length === 0) {
        setError('No active account found with this phone number');
        setIsLoading(false);
        return;
      }

      // Take the first (most recent) profile if multiple exist
      const profile = profilesData[0];

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
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otpCode.length !== 6) return;

    setIsLoading(true);
    setError('');
    isProcessingOTP.current = true; // Mark that we're processing OTP

    try {
      // Create Supabase session - this function handles OTP verification and session creation
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
      
      let sessionData;
      try {
        sessionData = JSON.parse(responseText);
      } catch (e) {
        setError('Server returned invalid response. Please try again.');
        setIsLoading(false);
        isProcessingOTP.current = false;
        return;
      }

      if (!response.ok) {
        const errorMessage = sessionData?.error || sessionData?.message || `Server error (${response.status})`;
        setError(errorMessage);
        setIsLoading(false);
        isProcessingOTP.current = false;
        return;
      }

      if (!sessionData?.success || !sessionData?.access_token) {
        const errorMessage = sessionData?.error || 'Invalid or expired OTP. Please try again.';
        setError(errorMessage);
        setIsLoading(false);
        isProcessingOTP.current = false;
        return;
      }

      // Store is_first_login from response for later use
      // Check multiple ways to ensure we catch the value correctly
      const isFirstLogin = sessionData?.is_first_login === true || 
                          sessionData?.is_first_login === 'true' ||
                          String(sessionData?.is_first_login).toLowerCase() === 'true';
      console.log('📥 Received is_first_login from server:', sessionData?.is_first_login);
      console.log('📥 Type of is_first_login:', typeof sessionData?.is_first_login);
      console.log('📥 Parsed isFirstLogin:', isFirstLogin);
      console.log('📥 Will redirect to password setup?', isFirstLogin);

      // Get user profile with role for redirect
      // Use limit(1) instead of single() to handle cases where multiple profiles have the same phone
      const { data: profilesData, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, email, role, first_name, created_at')
        .eq('phone', phoneNumber)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (profileError || !profilesData || profilesData.length === 0) {
        setError('Failed to load user profile');
        setIsLoading(false);
        isProcessingOTP.current = false;
        return;
      }

      // Take the first (most recent) profile if multiple exist
      const profile = profilesData[0];

      // Set the session in Supabase client
      console.log('🔐 Setting session with tokens...');
      const { data: authData, error: setSessionError } = await supabase.auth.setSession({
        access_token: sessionData.access_token,
        refresh_token: sessionData.refresh_token
      });
      
      // Store is_first_login in the session data for later reference
      if (authData?.session) {
        (authData.session as any).is_first_login = isFirstLogin;
      }

      if (setSessionError || !authData.session) {
        console.error('❌ Set session error:', setSessionError);
        setError('Failed to establish session. Please try again.');
        setIsLoading(false);
        isProcessingOTP.current = false;
        return;
      }

      console.log('✅ Session set, verifying persistence...');
      console.log('📅 Session expires at:', new Date(authData.session.expires_at! * 1000).toLocaleString());

      // Wait a brief moment for localStorage to be updated
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify session is persisted by checking it again
      const { data: { session }, error: verifyError } = await supabase.auth.getSession();
      
      if (verifyError) {
        console.error('❌ Error verifying session:', verifyError);
        setError('Failed to verify session. Please try again.');
        setIsLoading(false);
        isProcessingOTP.current = false;
        return;
      }
      
      if (!session) {
        console.error('❌ Session not persisted after setSession');
        // Check localStorage directly
        const storageKeys = Object.keys(localStorage).filter(key => key.includes('supabase') || key.includes('sb-'));
        console.log('📦 localStorage keys:', storageKeys);
        setError('Session not established. Please try again.');
        setIsLoading(false);
        isProcessingOTP.current = false;
        return;
      }

      console.log('✅ Session verified and persisted successfully');
      console.log('✅ Verified session user ID:', session.user.id);

      // Only redirect to password setup if this is user's first login
      // isFirstLogin was already declared earlier from sessionData
      console.log('🔀 Checking redirect logic - isFirstLogin:', isFirstLogin);
      console.log('🔀 sessionData.is_first_login:', sessionData?.is_first_login);
      console.log('🔀 typeof isFirstLogin:', typeof isFirstLogin);
      
      if (isFirstLogin) {
        console.log('➡️ FIRST LOGIN DETECTED - Redirecting to password setup');
        console.log('➡️ User:', profile.first_name, 'Role:', profile.role);
        console.log('➡️ Session user ID:', session.user.id);
        
        // CRITICAL: Set flags FIRST to prevent useEffect from interfering
        pendingFirstLoginRedirect.current = true;
        isProcessingOTP.current = false;
        
        // Clear loading state immediately
        setIsLoading(false);
        
        // Reset step to prevent useEffect from checking step === 'otp'
        setStep('phone');
        
        // Show toast (non-blocking) - but don't wait for it
        toast({
          title: 'Welcome!',
          description: `Welcome, ${profile.first_name}! Please set your password for future logins.`,
        });
        
        // Store redirect info in sessionStorage BEFORE redirect
        sessionStorage.setItem('redirectAfterAuth', '/setup-password');
        sessionStorage.setItem('isFirstLogin', 'true');
        sessionStorage.setItem('firstLoginUserId', session.user.id);
        
        console.log('🚀 Executing redirect to /setup-password');
        console.log('🚀 Current location:', window.location.href);
        console.log('🚀 Flags set - pendingFirstLoginRedirect:', pendingFirstLoginRedirect.current);
        console.log('🚀 Session user ID stored:', session.user.id);
        
        // CRITICAL: Use window.location.replace for immediate, unblockable redirect
        // This replaces the current history entry and forces navigation
        // Using replace instead of href prevents back button issues
        try {
          window.location.replace('/setup-password');
          console.log('✅ window.location.replace called successfully');
        } catch (e) {
          console.error('❌ window.location.replace failed:', e);
          // Fallback to href if replace fails
          window.location.href = '/setup-password';
        }
        
        // Return immediately - don't execute any code after this
        // The redirect should happen synchronously above
        return;
      } else {
        console.log('➡️ NOT first login - proceeding to dashboard redirect');
        console.log('➡️ isFirstLogin value was:', isFirstLogin);
        console.log('➡️ sessionData.is_first_login was:', sessionData?.is_first_login);
      }
      
      console.log('➡️ Redirecting to dashboard (returning user)');

      toast({
        title: 'Success',
        description: `Welcome back, ${profile.first_name}!`,
      });

      // Redirect based on role
      const redirectPath = getRoleRedirectPath(profile.role as UserRole);
      console.log('🔄 Navigating to:', redirectPath);
      
      // Clear processing flag before navigation
      isProcessingOTP.current = false;
      
      // Add a small delay to ensure toast is visible and state is settled
      setTimeout(() => {
        navigate(redirectPath, { replace: true });
        // Force a navigation if React Router doesn't pick it up
        // This ensures the redirect happens even if there are state issues
        setTimeout(() => {
          // Double-check we're on the right page, if not, force navigation
          if (window.location.pathname !== redirectPath) {
            console.log('⚠️ Navigation may have failed, forcing redirect...');
            window.location.href = redirectPath;
          }
        }, 1000);
      }, 500);

    } catch (err: any) {
      setError('An unexpected error occurred. Please try again.');
      console.error('OTP verification error:', err);
      // Clear processing flags on error
      isProcessingOTP.current = false;
      pendingFirstLoginRedirect.current = false;
      setIsLoading(false);
    }
    // Note: Removed finally block to prevent interference with redirect
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

  // Show loading screen while auth is initializing
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

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
