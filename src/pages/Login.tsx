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

type PhoneForm = z.infer<typeof phoneSchema>;

export default function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showOTP, setShowOTP] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema),
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

      if (otpError || !otpData?.success) {
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
      console.error('Error sending OTP:', err);
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
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token
      });

      if (sessionError) {
        console.error('Set session error:', sessionError);
        setError('Failed to establish session');
        setIsLoading(false);
        return;
      }

      setShowOTP(false);
      setIsLoading(false);
      toast({
        title: 'Success',
        description: 'Login successful!',
      });
      // The useEffect will handle the redirect
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Background Verification System</CardTitle>
          <CardDescription>
            {showOTP ? 'Verify your identity' : 'Enter your phone number to sign in'}
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
                <Label htmlFor="phone">Phone Number</Label>
                <div className="flex">
                  <div className="flex items-center px-3 border border-r-0 rounded-l-md border-input bg-muted">
                    <span className="text-sm text-muted-foreground">+91</span>
                  </div>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="Enter 10-digit phone number"
                    {...register('phone')}
                    className={`rounded-l-none ${errors.phone ? 'border-destructive' : ''}`}
                  />
                </div>
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Sending OTP...' : 'Send OTP'}
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                <p>You will receive an OTP on your registered mobile number</p>
              </div>
            </form>
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
