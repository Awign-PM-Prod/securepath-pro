import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Loader2, RefreshCw } from 'lucide-react';
import { otpService } from '@/services/otpService';

interface OTPVerificationProps {
  phoneNumber: string;
  purpose: 'login' | 'account_setup';
  email?: string;
  onVerified: (otp: string) => void;
  onCancel?: () => void;
}

export function OTPVerification({
  phoneNumber,
  purpose,
  email,
  onVerified,
  onCancel,
}: OTPVerificationProps) {
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const [canResend, setCanResend] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60); // 60 seconds cooldown

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

    setIsVerifying(true);
    setError('');
    setSuccess('');

    const result = await otpService.verifyOTP(phoneNumber, otp, purpose);

    if (result.success) {
      setSuccess('OTP verified successfully!');
      setTimeout(() => {
        onVerified(otp); // Pass the OTP code to the callback
      }, 500);
    } else {
      setError(result.error || 'Invalid OTP code');
      setOtp(''); // Clear OTP on error
    }

    setIsVerifying(false);
  };

  const handleResend = async () => {
    setIsResending(true);
    setError('');
    setSuccess('');

    const result = await otpService.resendOTP(phoneNumber, purpose, email);

    if (result.success) {
      setSuccess('OTP resent successfully!');
      setTimeLeft(300); // Reset timer
      setCanResend(false);
      setResendCooldown(60);
      setOtp(''); // Clear OTP input
    } else {
      setError(result.error || 'Failed to resend OTP');
    }

    setIsResending(false);
  };

  // Auto-verify when OTP is complete
  useEffect(() => {
    if (otp.length === 6 && !isVerifying) {
      handleVerify();
    }
  }, [otp]);

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Enter Verification Code</h3>
        <p className="text-sm text-muted-foreground">
          We've sent a 6-digit code to {maskPhoneNumber(phoneNumber)}
        </p>
        <p className="text-xs text-muted-foreground">
          Code expires in: <span className="font-semibold">{formatTime(timeLeft)}</span>
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50">
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

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleResend}
            className="flex-1"
            disabled={!canResend || isResending || timeLeft <= 0}
          >
            {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isResending ? (
              'Resending...'
            ) : canResend ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Resend OTP
              </>
            ) : (
              `Resend in ${resendCooldown}s`
            )}
          </Button>

          {onCancel && (
            <Button variant="ghost" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Didn't receive the code? Check your phone or try resending.
      </p>
    </div>
  );
}