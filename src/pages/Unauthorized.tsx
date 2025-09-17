import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function Unauthorized() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleGoBack = () => {
    // Redirect to appropriate dashboard based on role
    if (user?.profile?.role) {
      switch (user.profile.role) {
        case 'super_admin':
          navigate('/admin');
          break;
        case 'ops_team':
          navigate('/ops');
          break;
        case 'vendor_team':
          navigate('/vendor-team');
          break;
        case 'qc_team':
          navigate('/qc');
          break;
        case 'vendor':
          navigate('/vendor');
          break;
        case 'gig_worker':
          navigate('/gig');
          break;
        case 'client':
          navigate('/client');
          break;
        default:
          navigate('/');
      }
    } else {
      navigate('/');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <AlertTriangle className="h-12 w-12 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold">Access Denied</CardTitle>
          <CardDescription>
            You don't have permission to access this page
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Your current role doesn't allow access to this resource. 
            Please contact your administrator if you believe this is an error.
          </p>
          <Button onClick={handleGoBack} className="w-full">
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}