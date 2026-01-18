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
        // Log all errors with details for debugging
        console.error('Error fetching user profile:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          userId: userId
        });
        
        // Only return null for actual errors (not PGRST116 which means no rows found)
        if (error.code !== 'PGRST116') {
          return null;
        }
        // PGRST116 means no profile found - this is also an error case
        return null;
      }

      if (!data) {
        console.warn('No profile found for user:', userId);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Exception fetching user profile:', error);
      return null;
    }
  };

  // Update last_seen_at for gig workers when they sign in
  // Only updates if last sign-in was today, otherwise attendance popup will handle it
  const updateGigWorkerLastSeen = async (userId: string): Promise<void> => {
    try {
      // First, check the current last_seen_at
      const { data: gigWorker, error: fetchError } = await supabase
        .from('gig_partners')
        .select('last_seen_at')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (fetchError) {
        // Only log if it's not a "no rows found" error (user might not be a gig worker)
        if (fetchError.code !== 'PGRST116') {
          console.error('Error fetching gig worker last_seen_at:', fetchError);
        }
        return;
      }

      if (!gigWorker) return;

      // Check if last_seen_at is today
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today
      
      const lastSeenAt = gigWorker.last_seen_at ? new Date(gigWorker.last_seen_at) : null;
      
      // Only update if last sign-in was today
      // If last sign-in was NULL (never signed in), yesterday, or earlier - don't update (attendance popup will handle it)
      const shouldUpdate = lastSeenAt && lastSeenAt >= today;
      
      if (!shouldUpdate) {
        // Last sign-in was NULL, yesterday, or earlier - don't update, attendance popup will handle it
        return;
      }

      // Update last_seen_at in gig_partners table for this user
      const { error } = await supabase
        .from('gig_partners')
        .update({ 
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        // Only log if it's not a "no rows found" error
        if (error.code !== 'PGRST116') {
          console.error('Error updating gig worker last_seen_at:', error);
        }
      }
    } catch (error) {
      // Silently fail - this is not critical functionality
      console.warn('Exception updating gig worker last_seen_at:', error);
    }
  };

  useEffect(() => {
    let mounted = true;
    let hasInitialized = false;
    let subscription: { unsubscribe: () => void } | null = null;
    let sessionValidationInterval: NodeJS.Timeout | null = null;

    // Helper function to load user profile and set state
    const loadUserFromSession = async (session: Session | null): Promise<void> => {
      if (!mounted) return;
      
      // Set session immediately for faster UI update
      setSession(session);
      
      if (session?.user) {
        // Retry profile fetch up to 3 times with exponential backoff
        let profile: UserProfile | null = null;
        let lastError: any = null;
        
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            profile = await Promise.race([
              fetchUserProfile(session.user.id),
              new Promise<UserProfile | null>((_, reject) => 
                setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
              )
            ]);
            
            if (profile) {
              break; // Success, exit retry loop
            }
          } catch (error) {
            lastError = error;
            // Wait before retrying (exponential backoff: 500ms, 1000ms, 2000ms)
            if (attempt < 2) {
              await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
            }
          }
        }
        
        if (mounted) {
          if (profile) {
            setUser({
              id: session.user.id,
              email: session.user.email!,
              profile
            });
            
            // Update last_seen_at if user is a gig worker
            if (profile.role === 'gig_worker') {
              updateGigWorkerLastSeen(session.user.id);
            }
          } else {
            // Only set user to null if session is also invalid
            // If session is valid but profile fetch failed, keep the session
            // This prevents unnecessary logouts due to temporary network issues
            console.warn('Profile fetch failed after retries, but session is valid. Keeping session.');
            // Don't set user to null - keep the session alive
            // The profile will be retried on next auth state change
          }
        }
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
          // Check if session is expired (with 5 minute buffer to refresh before actual expiration)
          const expiresAt = session.expires_at ? session.expires_at * 1000 : null;
          const bufferTime = 5 * 60 * 1000; // 5 minutes
          const isExpired = expiresAt && (expiresAt - bufferTime) < Date.now();
          
          if (isExpired) {
            // Try to refresh with longer timeout and retry logic
            let refreshedSession: Session | null = null;
            let refreshError: any = null;
            
            // Retry refresh up to 2 times
            for (let attempt = 0; attempt < 2; attempt++) {
              try {
                const refreshPromise = supabase.auth.refreshSession();
                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Refresh timeout')), 10000) // Increased to 10 seconds
                );
                
                const result = await Promise.race([refreshPromise, timeoutPromise]) as any;
                
                if (result?.data?.session) {
                  refreshedSession = result.data.session;
                  break; // Success
                } else if (result?.error) {
                  refreshError = result.error;
                }
              } catch (err) {
                refreshError = err;
                // Wait before retrying
                if (attempt < 1) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              }
            }
              
            if (refreshError || !refreshedSession) {
              // Only clear session if refresh truly failed (not just timeout)
              // If it's a network issue, keep the existing session
              console.warn('Session refresh failed, but keeping existing session:', refreshError);
              // Don't clear session - let Supabase auto-refresh handle it
              // Load user from existing session
              loadUserFromSession(session).finally(() => {
                if (mounted) {
                  setLoading(false);
                  hasInitialized = true;
                }
              });
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

        // Handle SIGNED_OUT event explicitly
        if (event === 'SIGNED_OUT') {
          if (mounted) {
            setSession(null);
            setUser(null);
          }
          return;
        }

        // For USER_UPDATED events (like password changes), wait a bit longer for profile to be available
        if (event === 'USER_UPDATED') {
          console.log('🔄 USER_UPDATED event detected, waiting for profile reload...');
          // Wait a moment for any database updates to complete
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        // For all other events (SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED, etc.)
        await loadUserFromSession(session);
        
        // For USER_UPDATED, retry profile fetch after a delay if it might have failed
        // This helps with timing issues after password updates
        if (event === 'USER_UPDATED' && session?.user) {
          setTimeout(async () => {
            if (mounted) {
              // Check if user was loaded, if not, try again
              const { data: { session: currentSession } } = await supabase.auth.getSession();
              if (currentSession?.user && mounted) {
                // Only retry if we still don't have a user after the initial load
                // We'll check this by trying to load again
                await loadUserFromSession(currentSession);
              }
            }
          }, 1500);
        }
      }
    );
    
    subscription = authSubscription;

    // Set up periodic session validation (every 5 minutes)
    sessionValidationInterval = setInterval(() => {
      if (!mounted) return;
      
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (!mounted) return;
        
        if (error) {
          console.warn('Session validation error:', error);
          return;
        }
        
        if (session) {
          // Check if session is still valid
          const expiresAt = session.expires_at ? session.expires_at * 1000 : null;
          const bufferTime = 5 * 60 * 1000; // 5 minutes
          if (expiresAt && (expiresAt - bufferTime) < Date.now()) {
            console.warn('Session expiring soon, attempting refresh...');
            supabase.auth.refreshSession().catch(err => {
              console.error('Failed to refresh session:', err);
            });
          } else {
            // Session is valid - ensure user is loaded
            // loadUserFromSession will handle retrying if needed
            loadUserFromSession(session);
          }
        } else {
          // No session - clear user if it exists
          if (mounted) {
            setUser(null);
            setSession(null);
          }
        }
      });
    }, 5 * 60 * 1000); // Every 5 minutes

    // Initialize auth
    initializeAuth();

    return () => {
      mounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
      if (sessionValidationInterval) {
        clearInterval(sessionValidationInterval);
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
    
    // Supply team can manage vendors and gig workers
    if (currentRole === 'supply_team' && ['vendor', 'gig_worker'].includes(targetRole)) {
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