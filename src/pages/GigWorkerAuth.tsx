import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, EyeOff, Mail, Lock, User, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { emailService } from '@/services/emailService';

export default function GigWorkerAuth() {
  const [activeTab, setActiveTab] = useState('setup');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { toast } = useToast();
  const navigate = useNavigate();

  // Setup password form
  const [setupForm, setSetupForm] = useState({
    email: '',
    token: '',
    password: '',
    confirmPassword: ''
  });

  // Reset password form
  const [resetForm, setResetForm] = useState({
    email: ''
  });

  const handleSetupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

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
      // First, verify the token and get user info
      const { data: tokenData, error: tokenError } = await supabase
        .from('password_setup_tokens')
        .select('*')
        .eq('email', setupForm.email)
        .eq('token', setupForm.token)
        .eq('is_used', false)
        .single();

      if (tokenError || !tokenData) {
        throw new Error('Invalid or expired setup token');
      }

      // Check if token is expired (24 hours)
      const tokenExpiry = new Date(tokenData.expires_at);
      if (tokenExpiry < new Date()) {
        throw new Error('Setup token has expired. Please request a new one.');
      }

      // Update the user's password
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        tokenData.user_id,
        { password: setupForm.password }
      );

      if (updateError) throw updateError;

      // Mark token as used
      await supabase
        .from('password_setup_tokens')
        .update({ is_used: true, used_at: new Date().toISOString() })
        .eq('id', tokenData.id);

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
              <form onSubmit={handleSetupPassword} className="space-y-4">
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
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="setup-token">Setup Token</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="setup-token"
                      type="text"
                      placeholder="Enter setup token from email"
                      value={setupForm.token}
                      onChange={(e) => setSetupForm(prev => ({ ...prev, token: e.target.value }))}
                      className="pl-10"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Check your email for the setup token sent by your team.
                  </p>
                </div>

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

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Setting up...' : 'Setup Password'}
                </Button>
              </form>
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
