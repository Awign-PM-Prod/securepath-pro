import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      // Redirect authenticated users to their dashboard
      const roleRedirectMap = {
        super_admin: '/admin',
        ops_team: '/ops',
        vendor_team: '/vendor-team',
        qc_team: '/qc',
        vendor: '/vendor',
        gig_worker: '/gig',
        client: '/client',
      };
      
      const redirectPath = roleRedirectMap[user.profile.role];
      if (redirectPath) {
        navigate(redirectPath, { replace: true });
      }
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Background Verification System</CardTitle>
          <CardDescription>
            Complete background verification task management platform
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Streamline your background verification process from intake to completion
          </p>
          <Button onClick={() => navigate('/login')} className="w-full">
            Sign In to Continue
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
