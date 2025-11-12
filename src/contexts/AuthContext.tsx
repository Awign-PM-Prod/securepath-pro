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
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(); // Use maybeSingle() instead of single() to avoid 406 error when no profile exists

      if (error) {
        // Only log unexpected errors (not PGRST116 which means no rows found)
        if (error.code !== 'PGRST116') {
          console.error('Error fetching user profile:', error);
        }
        return null;
      }

      return data;
    } catch (error) {
      console.error('Exception fetching user profile:', error);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;
    let hasInitialized = false;
    let subscription: { unsubscribe: () => void } | null = null;

    // Helper function to load user profile and set state
    const loadUserFromSession = async (session: Session | null): Promise<void> => {
      if (!mounted) return;
      
      // Set session immediately for faster UI update
      setSession(session);
      
      if (session?.user) {
        // Fetch profile with shorter timeout (3 seconds) - don't block UI
        Promise.race([
          fetchUserProfile(session.user.id),
          new Promise<UserProfile | null>((_, reject) => 
            setTimeout(() => reject(new Error('Profile fetch timeout')), 3000)
          )
        ]).then(profile => {
          if (mounted) {
            if (profile) {
              setUser({
                id: session.user.id,
                email: session.user.email!,
                profile
              });
            } else {
              setUser(null);
            }
          }
        }).catch(error => {
          // Profile fetch failed - set user to null but don't block
          if (mounted) {
            setUser(null);
          }
        });
      } else {
        if (mounted) {
          setUser(null);
        }
      }
    };

    // Initialize session from localStorage FIRST
    const initializeAuth = async () => {
      try {
        // Get session from localStorage (this is fast, synchronous read)
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          if (mounted) {
            setSession(null);
            setUser(null);
            setLoading(false);
            hasInitialized = true;
          }
          return;
        }
        
        if (session) {
          // Check if session is expired (quick check)
          const isExpired = session.expires_at && session.expires_at * 1000 < Date.now();
          
          if (isExpired) {
            // Try to refresh, but don't wait too long
            const refreshPromise = supabase.auth.refreshSession();
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Refresh timeout')), 2000)
            );
            
            try {
              const { data: { session: refreshedSession }, error: refreshError } = await Promise.race([
                refreshPromise,
                timeoutPromise
              ]) as any;
              
              if (refreshError || !refreshedSession) {
                if (mounted) {
                  setSession(null);
                  setUser(null);
                  setLoading(false);
                  hasInitialized = true;
                }
                return;
              }
              
              // Load user from refreshed session (non-blocking)
              loadUserFromSession(refreshedSession).finally(() => {
                if (mounted) {
                  setLoading(false);
                  hasInitialized = true;
                }
              });
              return; // Exit early, loading will be set in finally
            } catch (refreshErr) {
              // Refresh failed or timed out, clear session
              if (mounted) {
                setSession(null);
                setUser(null);
                setLoading(false);
                hasInitialized = true;
              }
              return;
            }
          } else {
            // Session is valid, load user (non-blocking)
            loadUserFromSession(session).finally(() => {
              if (mounted) {
                setLoading(false);
                hasInitialized = true;
              }
            });
            return; // Exit early, loading will be set in finally
          }
        } else {
          // No session, set loading to false immediately
          if (mounted) {
            setSession(null);
            setUser(null);
            setLoading(false);
            hasInitialized = true;
          }
        }
      } catch (error) {
        console.error('❌ Error initializing auth:', error);
        if (mounted) {
          setSession(null);
          setUser(null);
          setLoading(false);
          hasInitialized = true;
        }
      }
    };

    // Set up auth state listener to handle future changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('🔄 Auth state change:', event, session ? `user: ${session.user.id}` : 'no session');
        
        // Ignore INITIAL_SESSION events until we've loaded from getSession()
        // This prevents the listener from clearing the session before we restore it
        if (event === 'INITIAL_SESSION') {
          if (!hasInitialized) {
            console.log('⏳ Skipping INITIAL_SESSION - waiting for manual initialization');
            return;
          }
          // Only process INITIAL_SESSION if we've already initialized
          if (session) {
            console.log('✅ Processing INITIAL_SESSION with session');
            await loadUserFromSession(session);
          }
          return;
        }

        // For all other events (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, etc.)
        await loadUserFromSession(session);
      }
    );
    
    subscription = authSubscription;

    // Initialize auth
    initializeAuth();

    return () => {
      mounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    try {
      console.log('AuthContext: Starting sign out...');
      
      // Clear state first
      setUser(null);
      setSession(null);
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error);
      }
      
      // Manually clear all Supabase auth storage
      try {
        // Clear all Supabase-related localStorage keys
        Object.keys(localStorage).forEach(key => {
          if (key.includes('supabase') || key.includes('sb-') || key.includes('auth')) {
            console.log('Clearing localStorage key:', key);
            localStorage.removeItem(key);
          }
        });
        
        console.log('AuthContext: Cleared localStorage');
      } catch (storageError) {
        console.warn('AuthContext: Error clearing storage:', storageError);
      }
      
      console.log('AuthContext: Sign out successful');
    } catch (error) {
      console.error('AuthContext: Sign out failed:', error);
      // Clear state even on error
      setUser(null);
      setSession(null);
      throw error;
    }
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