import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { otpService } from '@/services/otpService';
import { Loader2 } from 'lucide-react';

export default function VerifyPhone() {
  const { phoneNumber } = useParams<{ phoneNumber: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const purpose = (searchParams.get('purpose') as 'login' | 'account_setup') || 'account_setup';

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleVerify = async () => {
    if (!phoneNumber || !otp) {
      toast.error('Please enter the OTP');
      return;
    }

    if (otp.length !== 6) {
      toast.error('OTP must be 6 digits');
      return;
    }

    setLoading(true);
    try {
      const result = await otpService.verifyOTP(phoneNumber, otp, purpose);
      
      if (result.success) {
        toast.success('Phone number verified successfully!');
        // Redirect to success page or login page
        navigate('/verification-success');
      } else {
        toast.error(result.error || 'Verification failed');
      }
    } catch (error) {
      toast.error('An error occurred during verification');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!phoneNumber) return;

    setResendLoading(true);
    try {
      const result = await otpService.resendOTP(phoneNumber, purpose);
      
      if (result.success) {
        toast.success('OTP resent successfully!');
        setCountdown(60);
      } else {
        toast.error(result.error || 'Failed to resend OTP');
      }
    } catch (error) {
      toast.error('An error occurred while resending OTP');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Verify Your Phone Number</CardTitle>
          <CardDescription>
            Enter the 6-digit OTP sent to {phoneNumber}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setOtp(value);
              }}
              maxLength={6}
              className="text-center text-2xl tracking-widest"
            />
          </div>

          <Button
            onClick={handleVerify}
            disabled={loading || otp.length !== 6}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify OTP'
            )}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Didn't receive the OTP?{' '}
            <Button
              variant="link"
              className="p-0 h-auto"
              onClick={handleResend}
              disabled={resendLoading || countdown > 0}
            >
              {resendLoading ? (
                'Resending...'
              ) : countdown > 0 ? (
                `Resend in ${countdown}s`
              ) : (
                'Resend OTP'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
