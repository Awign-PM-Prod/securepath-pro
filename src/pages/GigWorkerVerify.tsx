import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Loader2, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { otpService } from '@/services/otpService';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function GigWorkerVerify() {
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const [canResend, setCanResend] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Get phone and email from URL params
  useEffect(() => {
    const phone = searchParams.get('phone');
    const emailParam = searchParams.get('email');
    
    if (phone) {
      setPhoneNumber(phone);
    }
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  // Countdown timer for OTP expiry
  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setError('OTP has expired. Please request a new one.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) {
      setCanResend(true);
      return;
    }

    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCooldown]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const maskPhoneNumber = (phone: string) => {
    if (phone.length < 4) return phone;
    return `+91-XXXX-XX-${phone.slice(-4)}`;
  };

  const handleVerify = async () => {
    if (otp.length !== 6) {
      setError('Please enter a 6-digit OTP');
      return;
    }

    if (!phoneNumber) {
      setError('Phone number is required');
      return;
    }

    setIsVerifying(true);
    setError('');
    setSuccess('');

    const result = await otpService.verifyOTP(phoneNumber, otp, 'account_setup');

    if (result.success) {
      setSuccess('Account verified successfully!');
      
      // Email confirmation is handled by the OTP verification itself
      // The OTP verification confirms the phone number, which serves as the verification method
      
      toast({
        title: 'Success',
        description: 'Your account has been verified! You can now set up your password.',
      });

      // Redirect to setup page after 2 seconds
      setTimeout(() => {
        navigate(`/gig/setup?email=${encodeURIComponent(email || '')}&phone=${encodeURIComponent(phoneNumber)}`);
      }, 2000);
    } else {
      setError(result.error || 'Invalid OTP code');
      setOtp(''); // Clear OTP on error
    }

    setIsVerifying(false);
  };

  const handleResend = async () => {
    if (!phoneNumber || !email) {
      setError('Phone number and email are required');
      return;
    }

    setIsResending(true);
    setError('');
    setSuccess('');

    const result = await otpService.resendOTP(phoneNumber, 'account_setup', email);

    if (result.success) {
      setSuccess('OTP resent successfully!');
      setTimeLeft(300); // Reset timer
      setCanResend(false);
      setResendCooldown(0); // No cooldown needed
      setOtp(''); // Clear OTP input
      
      toast({
        title: 'OTP Resent',
        description: 'A new OTP has been sent to your phone.',
      });
    } else {
      setError(result.error || 'Failed to resend OTP');
    }

    setIsResending(false);
  };

  // Auto-verify when OTP is complete
  useEffect(() => {
    if (otp.length === 6 && !isVerifying && phoneNumber) {
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, isVerifying, phoneNumber]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">
            Verify Your Account
          </CardTitle>
          <CardDescription>
            Enter the OTP sent to your phone to verify your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                {phoneNumber ? (
                  <>We've sent a 6-digit code to {maskPhoneNumber(phoneNumber)}</>
                ) : (
                  'Please check your phone for the verification code'
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Code expires in: <span className="font-semibold">{formatTime(timeLeft)}</span>
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">{success}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={(value) => {
                  setOtp(value);
                  setError('');
                }}
                disabled={isVerifying || timeLeft <= 0}
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

            <div className="space-y-2">
              <Button
                onClick={handleVerify}
                className="w-full"
                disabled={otp.length !== 6 || isVerifying || timeLeft <= 0}
              >
                {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isVerifying ? 'Verifying...' : 'Verify OTP'}
              </Button>

              <Button
                variant="outline"
                onClick={handleResend}
                className="w-full"
                disabled={isResending || timeLeft <= 0}
              >
                {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isResending ? (
                  'Resending...'
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Resend OTP
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Didn't receive the code? Check your phone or try resending.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

