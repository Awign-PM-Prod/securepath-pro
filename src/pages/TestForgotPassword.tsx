import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function TestForgotPassword() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Forgot Password Test</CardTitle>
            <CardDescription>
              Test the forgot password functionality
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Test Steps:</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                <li>Click "Test Forgot Password" below</li>
                <li>Enter a valid email address</li>
                <li>Check your email for the reset link</li>
                <li>Click the reset link in the email</li>
                <li>Set a new password on the reset page</li>
                <li>Try logging in with the new password</li>
              </ol>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Features:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                <li>✅ Email validation</li>
                <li>✅ Password strength indicator</li>
                <li>✅ Password confirmation</li>
                <li>✅ Show/hide password toggles</li>
                <li>✅ Responsive design</li>
                <li>✅ Error handling</li>
                <li>✅ Success feedback</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Button asChild className="w-full">
                <Link to="/forgot-password">Test Forgot Password</Link>
              </Button>
              
              <Button asChild variant="outline" className="w-full">
                <Link to="/login">Back to Login</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
