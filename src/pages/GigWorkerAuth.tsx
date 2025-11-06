import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, EyeOff, Mail, Lock, Phone, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { emailService } from '@/services/emailService';
import { otpService } from '@/services/otpService';
import { OTPVerification } from '@/components/auth/OTPVerification';

export default function GigWorkerAuth() {
  const [activeTab, setActiveTab] = useState('setup');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showOTP, setShowOTP] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Setup password form - now uses phone and OTP instead of token
  const [setupForm, setSetupForm] = useState({
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });

  // Reset password form
  const [resetForm, setResetForm] = useState({
    email: ''
  });

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!setupForm.email || !setupForm.phone) {
      setError('Email and phone number are required');
      return;
    }

    setIsLoading(true);

    try {
      // Send OTP
      const result = await otpService.sendOTP(setupForm.phone, 'account_setup', setupForm.email);

      if (!result.success) {
        throw new Error(result.error || 'Failed to send OTP');
      }

      setShowOTP(true);
      setSuccess('OTP sent to your phone!');
      
      toast({
        title: 'OTP Sent',
        description: 'Please check your phone for the verification code.',
      });

    } catch (error) {
      console.error('Error sending OTP:', error);
      const { getErrorAlertMessage } = await import('@/utils/errorMessages');
      setError(getErrorAlertMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPVerified = () => {
    setOtpVerified(true);
    setShowOTP(false);
    setSuccess('Phone verified! Now set your password.');
    toast({
      title: 'Verified',
      description: 'Phone number verified successfully!',
    });
  };

  const handleSetupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!otpVerified) {
      setError('Please verify your phone number first');
      return;
    }

    if (setupForm.password !== setupForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (setupForm.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsLoading(true);

    try {
      // Find user by email and phone
      const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
      
      if (usersError) throw usersError;

      const user = users?.find(u => u.email === setupForm.email);
      
      if (!user) {
        throw new Error('User not found. Please contact your administrator.');
      }

      // Update user's password
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        user.id,
        { password: setupForm.password }
      );

      if (updateError) throw updateError;

      setSuccess('Password set successfully! You can now login with your credentials.');
      
      toast({
        title: 'Success',
        description: 'Password set successfully! You can now login.',
      });

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/');
      }, 2000);

    } catch (error) {
      console.error('Error setting up password:', error);
      const { getErrorAlertMessage } = await import('@/utils/errorMessages');
      setError(getErrorAlertMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Only validate email for reset password
    if (!resetForm.email) {
      setError('Email address is required');
      return;
    }

    setIsLoading(true);

    try {
      // Use the email service for password reset
      const result = await emailService.sendPasswordResetEmail(resetForm.email);

      if (!result.success) {
        throw new Error(result.error || 'Failed to send reset email');
      }

      setSuccess('Password reset email sent! Please check your inbox and follow the instructions.');
      
      toast({
        title: 'Email Sent',
        description: 'Password reset email sent! Check your inbox.',
      });

    } catch (error) {
      console.error('Error sending reset email:', error);
      const { getErrorAlertMessage } = await import('@/utils/errorMessages');
      setError(getErrorAlertMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">
            Gig Worker Access
          </CardTitle>
          <CardDescription>
            Set up your password or reset your existing password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="setup">Setup Password</TabsTrigger>
              <TabsTrigger value="reset">Reset Password</TabsTrigger>
            </TabsList>

            <TabsContent value="setup" className="space-y-4">
              {!showOTP ? (
                <>
                  <form onSubmit={otpVerified ? handleSetupPassword : handleSendOTP} className="space-y-4">
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

                    <div className="space-y-2">
                      <Label htmlFor="setup-email">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="setup-email"
                          type="email"
                          placeholder="Enter your email"
                          value={setupForm.email}
                          onChange={(e) => setSetupForm(prev => ({ ...prev, email: e.target.value }))}
                          className="pl-10"
                          required
                          disabled={otpVerified}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="setup-phone">Phone Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="setup-phone"
                          type="tel"
                          placeholder="Enter your phone number"
                          value={setupForm.phone}
                          onChange={(e) => setSetupForm(prev => ({ ...prev, phone: e.target.value }))}
                          className="pl-10"
                          required
                          disabled={otpVerified}
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        We'll send you a verification code.
                      </p>
                    </div>

                    {otpVerified && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="setup-password">New Password</Label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                              id="setup-password"
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Enter new password"
                              value={setupForm.password}
                              onChange={(e) => setSetupForm(prev => ({ ...prev, password: e.target.value }))}
                              className="pl-10 pr-10"
                              required
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="setup-confirm-password">Confirm Password</Label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                              id="setup-confirm-password"
                              type={showConfirmPassword ? 'text' : 'password'}
                              placeholder="Confirm new password"
                              value={setupForm.confirmPassword}
                              onChange={(e) => setSetupForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                              className="pl-10 pr-10"
                              required
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </>
                    )}

                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? 'Processing...' : otpVerified ? 'Setup Password' : 'Send Verification Code'}
                    </Button>
                  </form>
                </>
              ) : (
                <OTPVerification
                  phoneNumber={setupForm.phone}
                  purpose="account_setup"
                  email={setupForm.email}
                  onVerified={handleOTPVerified}
                  onCancel={() => setShowOTP(false)}
                />
              )}
            </TabsContent>

            <TabsContent value="reset" className="space-y-4">
              <form onSubmit={handleResetPassword} className="space-y-4">
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

                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="Enter your email"
                      value={resetForm.email}
                      onChange={(e) => setResetForm(prev => ({ ...prev, email: e.target.value }))}
                      className="pl-10"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    We'll send you a password reset link.
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Sending...' : 'Send Reset Email'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Button
                variant="link"
                className="p-0 h-auto font-normal"
                onClick={() => navigate('/')}
              >
                Sign in here
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
