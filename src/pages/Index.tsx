import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

const Index = () => {
  console.log('Index component rendering');
  
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  console.log('Index state:', { user: user?.profile?.role, loading });

  useEffect(() => {
    console.log('Index useEffect', { user, loading });
    if (!loading && user && user.profile) {
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
        console.log('Redirecting to:', redirectPath);
        navigate(redirectPath, { replace: true });
      }
    }
  }, [user, loading, navigate]);

  if (loading) {
    console.log('Index showing loading state');
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  console.log('Index showing main content');
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">
            Background Verification System
          </CardTitle>
          <CardDescription className="text-gray-600">
            Complete background verification task management platform
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600">
            Streamline your background verification process from intake to completion
          </p>
          <Button 
            onClick={() => {
              console.log('Sign in button clicked, navigating to /');
              navigate('/');
            }} 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            Sign In to Continue
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
