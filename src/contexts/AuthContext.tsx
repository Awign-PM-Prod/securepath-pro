import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthUser, UserProfile, UserRole } from '@/types/auth';

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  canManageRole: (targetRole: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    return data;
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        
        if (session?.user) {
          const profile = await fetchUserProfile(session.user.id);
          if (profile) {
            setUser({
              id: session.user.id,
              email: session.user.email!,
              profile
            });
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
        
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserProfile(session.user.id).then(profile => {
          if (profile) {
            setUser({
              id: session.user.id,
              email: session.user.email!,
              profile
            });
          }
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasRole = (role: UserRole) => {
    return user?.profile?.role === role;
  };

  const canManageRole = (targetRole: UserRole) => {
    if (!user) return false;
    
    const currentRole = user.profile.role;
    
    // Super admin can manage all roles except other super admins
    if (currentRole === 'super_admin' && targetRole !== 'super_admin') {
      return true;
    }
    
    // Ops team can manage clients
    if (currentRole === 'ops_team' && targetRole === 'client') {
      return true;
    }
    
    // Vendor team can manage vendors and gig workers
    if (currentRole === 'vendor_team' && ['vendor', 'gig_worker'].includes(targetRole)) {
      return true;
    }
    
    // Vendors can manage gig workers
    if (currentRole === 'vendor' && targetRole === 'gig_worker') {
      return true;
    }
    
    return false;
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signOut,
    hasRole,
    canManageRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}