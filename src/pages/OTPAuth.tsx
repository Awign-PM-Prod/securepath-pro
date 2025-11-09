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

const phoneSchema = z.object({
  phone: z.string()
    .min(10, 'Phone number must be at least 10 digits')
    .regex(/^[0-9+\-() ]+$/, 'Please enter a valid phone number'),
});

type PhoneForm = z.infer<typeof phoneSchema>;

export default function OTPAuth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userFirstName, setUserFirstName] = useState('');
  const [canResend, setCanResend] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema),
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
      // Step 1: Verify OTP using existing verify-otp function
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-otp', {
        body: {
          phone_number: phoneNumber,
          otp_code: otpCode,
          purpose: 'login'
        }
      });

      if (verifyError || !verifyData?.success) {
        setError(verifyData?.error || 'Invalid or expired OTP');
        setIsLoading(false);
        return;
      }

      // Step 2: Get user profile for authentication
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, email, role')
        .eq('phone', phoneNumber)
        .eq('is_active', true)
        .single();

      if (profileError || !profile) {
        setError('Failed to authenticate user');
        setIsLoading(false);
        return;
      }

      // Step 3: Create session using admin API
      const { data: sessionData, error: sessionError } = await supabase.functions.invoke('create-auth-session', {
        body: {
          email: profile.email,
          user_id: profile.user_id
        }
      });

      if (sessionError || !sessionData?.success) {
        console.error('Session creation error:', sessionError);
        setError('Failed to create session. Please try again.');
        setIsLoading(false);
        return;
      }

      // Step 4: Set the session in Supabase client
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: sessionData.access_token,
        refresh_token: sessionData.refresh_token,
      });

      if (setSessionError) {
        console.error('Failed to set session:', setSessionError);
        setError('Failed to establish session. Please try again.');
        setIsLoading(false);
        return;
      }

      toast({
        title: 'Success',
        description: 'Login successful!',
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Background Verification System</CardTitle>
          <CardDescription>
            {step === 'phone' ? 'Enter your phone number to login' : 'Verify your identity'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'phone' ? (
            <form onSubmit={handleSubmit(onPhoneSubmit)} className="space-y-4">
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
                  {...register('phone')}
                  className={errors.phone ? 'border-destructive' : ''}
                />
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Sending OTP...' : 'Send OTP'}
              </Button>
            </form>
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
    </div>
  );
}
