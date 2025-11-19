import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/auth';

export function useRequireAuth(allowedRoles?: UserRole[]) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/', { replace: true });
        return;
      }

      // Wait for profile to load before checking roles
      if (!user.profile) {
        return;
      }

      if (allowedRoles && !allowedRoles.includes(user.profile.role)) {
        navigate('/unauthorized', { replace: true });
        return;
      }
    }
  }, [user, loading, navigate, allowedRoles]);

  return { user, loading };
}