import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateSessionRequest {
  phone_number: string;
  otp_code: string;
}

serve(async (req) => {
  console.log('=== create-auth-session function called ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Parsing request body...');
    const body = await req.json();
    console.log('Received request body:', JSON.stringify(body));
    
    const { phone_number, otp_code }: CreateSessionRequest = body;

    if (!phone_number || !otp_code) {
      console.error('Missing required fields:', { phone_number: !!phone_number, otp_code: !!otp_code });
      return new Response(
        JSON.stringify({ success: false, error: 'phone_number and otp_code are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing environment variables');
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('Step 1: Verifying OTP for phone:', phone_number);

    // Check if this is user's first login by checking if they have any previously verified OTP
    // IMPORTANT: Do this BEFORE marking current OTP as verified
    // IMPORTANT: Only count OTPs that have verified_at set (actually used)
    // OTPs marked as verified by resend-otp (to invalidate) don't have verified_at, so ignore those
    // If they have a verified OTP with verified_at for this phone number, they've logged in before
    // If no verified OTP with verified_at exists, this is their first login - show password setup
    let isFirstLogin = true;
    try {
      console.log('🔍 Checking for previously verified OTPs for phone:', phone_number);
      console.log('🔍 Query will only count OTPs with is_verified=true AND verified_at IS NOT NULL');
      
      // Query for verified OTPs that were actually used (have verified_at set)
      // IMPORTANT: Use .not('verified_at', 'is', null) to exclude OTPs invalidated by resend-otp
      // OTPs marked as verified by resend-otp have is_verified=true but verified_at=null
      const { data: previousVerifiedOTPs, error: otpCheckError } = await supabase
        .from('otp_tokens')
        .select('id, verified_at, created_at, is_verified')
        .eq('phone_number', phone_number)
        .eq('purpose', 'login')
        .eq('is_verified', true)
        .not('verified_at', 'is', null) // CRITICAL: Only count OTPs that were actually used
        .order('verified_at', { ascending: false })
        .limit(1); // We only need to know if at least one exists
      
      console.log('🔍 Previous verified OTPs query result:', {
        error: otpCheckError,
        count: previousVerifiedOTPs?.length || 0,
        data: previousVerifiedOTPs?.[0] || null,
        phone_number: phone_number
      });
      
      if (otpCheckError) {
        console.error('❌ Error checking previous OTPs:', otpCheckError);
        // On error, assume first login to be safe
        isFirstLogin = true;
        console.log('⚠️ Error occurred, defaulting to first login (safe default)');
      } else if (previousVerifiedOTPs && previousVerifiedOTPs.length > 0) {
        // User has previously verified an OTP (with verified_at), so they've logged in before
        isFirstLogin = false;
        console.log('✅ User has previously logged in (found verified OTP with verified_at)');
        console.log('   Last verified OTP ID:', previousVerifiedOTPs[0].id);
        console.log('   Last verified at:', previousVerifiedOTPs[0].verified_at);
      } else {
        // No previously verified OTP with verified_at found - this is first login
        isFirstLogin = true;
        console.log('🆕 First time login detected (no previously verified OTP with verified_at)');
        console.log('   This means: No OTP with is_verified=true AND verified_at IS NOT NULL exists for this phone');
      }
    } catch (e) {
      // If we can't check, assume first login to be safe (will prompt for password setup)
      console.error('❌ Exception checking previous OTP status, assuming first login:', e);
      isFirstLogin = true;
    }
    
    console.log(`📊 First login determination: ${isFirstLogin ? 'YES (first login)' : 'NO (returning user)'}`);

    // Verify the OTP from our custom otp_tokens table
    const { data: otpToken, error: otpError } = await supabase
      .from('otp_tokens')
      .select('*')
      .eq('phone_number', phone_number)
      .eq('otp_code', otp_code)
      .eq('purpose', 'login')
      .eq('is_verified', false)
      .single();

    if (otpError || !otpToken) {
      console.error('OTP verification failed:', otpError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired OTP code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if OTP expired
    if (new Date(otpToken.expires_at) < new Date()) {
      console.error('OTP expired at:', otpToken.expires_at);
      return new Response(
        JSON.stringify({ success: false, error: 'OTP has expired. Please request a new one.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Step 2: OTP verified, marking as used');
    
    // Mark OTP as verified
    await supabase
      .from('otp_tokens')
      .update({ 
        is_verified: true,
        verified_at: new Date().toISOString()
      })
      .eq('id', otpToken.id);

    console.log('Step 3: Getting user profile for phone:', phone_number);

    // Get user profile with this phone number
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, email, role, first_name')
      .eq('phone', phone_number)
      .eq('is_active', true)
      .single();

    if (profileError || !profile || !profile.user_id) {
      console.error('Profile lookup failed:', profileError);
      return new Response(
        JSON.stringify({ success: false, error: 'User not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Step 4: Getting user from auth system:', profile.user_id);

    // Get the user from auth.users to verify they exist
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(profile.user_id);

    if (userError || !user) {
      console.error('User lookup error:', userError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'User not found in auth system: ' + (userError?.message || 'Unknown error')
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Step 5: Creating session using GoTrue Admin API for user:', user.id);

    // Use GoTrue Admin API to create a session directly
    // We'll use the admin API endpoint to generate a session token
    const adminUsersUrl = `${supabaseUrl}/auth/v1/admin/users/${user.id}`;
    
    // First, let's try using the admin API to generate a recovery link and extract tokens from it
    // Recovery links sometimes contain tokens directly in the URL
    const { data: recoveryLinkData, error: recoveryError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: user.email || profile.email,
    });

    let accessToken: string | null = null;
    let refreshToken: string | null = null;

    if (!recoveryError && recoveryLinkData?.properties?.action_link) {
      const recoveryLink = recoveryLinkData.properties.action_link;
      console.log('Step 6: Processing recovery link');
      console.log('Recovery link (first 200 chars):', recoveryLink.substring(0, 200));
      
      try {
        const recoveryUrl = new URL(recoveryLink);
        
        // Try to extract tokens directly from the recovery link URL
        accessToken = recoveryUrl.searchParams.get('access_token');
        refreshToken = recoveryUrl.searchParams.get('refresh_token');
        
        // Check hash fragment
        if ((!accessToken || !refreshToken) && recoveryUrl.hash) {
          const hash = recoveryUrl.hash.substring(1);
          const hashParams = new URLSearchParams(hash);
          accessToken = hashParams.get('access_token') || accessToken;
          refreshToken = hashParams.get('refresh_token') || refreshToken;
        }
        
        if (accessToken && refreshToken) {
          console.log('Step 7: Tokens found directly in recovery link URL');
        } else {
          console.log('Step 7: Tokens not in URL, trying to use recovery link programmatically');
          
          // If tokens aren't in the URL, we need to actually "click" the link
          // We can do this by making a GET request to the recovery link
          // The link will redirect and we can extract tokens from the redirect
          const linkResponse = await fetch(recoveryLink, {
            method: 'GET',
            redirect: 'manual', // Don't follow redirects automatically
          });
          
          console.log('Recovery link response status:', linkResponse.status);
          console.log('Recovery link response headers:', Object.fromEntries(linkResponse.headers.entries()));
          
          // Check if there's a Location header with tokens
          const location = linkResponse.headers.get('Location');
          if (location) {
            try {
              const locationUrl = new URL(location, recoveryLink);
              accessToken = locationUrl.searchParams.get('access_token');
              refreshToken = locationUrl.searchParams.get('refresh_token');
              
              if ((!accessToken || !refreshToken) && locationUrl.hash) {
                const hash = locationUrl.hash.substring(1);
                const hashParams = new URLSearchParams(hash);
                accessToken = hashParams.get('access_token') || accessToken;
                refreshToken = hashParams.get('refresh_token') || refreshToken;
              }
              
              if (accessToken && refreshToken) {
                console.log('Step 8: Tokens extracted from redirect location');
              }
            } catch (e) {
              console.error('Failed to parse redirect location:', e);
            }
          }
        }
      } catch (e) {
        console.error('Failed to process recovery link:', e);
      }
    }

    // If we still don't have tokens, try using the GoTrue Admin API to create a session
    if (!accessToken || !refreshToken) {
      console.log('Step 8: Using GoTrue Admin API to create session directly');
      
      // Use the admin API to sign in the user by generating a password reset token
      // and then using that to create a session
      // Actually, the best approach is to use the admin API's ability to generate
      // a session token directly via the GoTrue admin endpoints
      
      // Try using the admin API to create a custom session
      // We'll use the GoTrue admin endpoint to generate a session
      const adminTokenUrl = `${supabaseUrl}/auth/v1/admin/users/${user.id}/generate_link`;
      
      const adminLinkResponse = await fetch(adminTokenUrl, {
        method: 'POST',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'recovery',
          email: user.email || profile.email,
        }),
      });

      if (adminLinkResponse.ok) {
        const adminLinkData = await adminLinkResponse.json();
        console.log('Admin link data received');
        
        if (adminLinkData?.properties?.action_link) {
          const adminLink = adminLinkData.properties.action_link;
          console.log('Admin recovery link generated');
          
          // Try to extract tokens from this link
          try {
            const adminUrl = new URL(adminLink);
            accessToken = adminUrl.searchParams.get('access_token');
            refreshToken = adminUrl.searchParams.get('refresh_token');
            
            if ((!accessToken || !refreshToken) && adminUrl.hash) {
              const hash = adminUrl.hash.substring(1);
              const hashParams = new URLSearchParams(hash);
              accessToken = hashParams.get('access_token') || accessToken;
              refreshToken = hashParams.get('refresh_token') || refreshToken;
            }
            
            if (accessToken && refreshToken) {
              console.log('Step 9: Tokens extracted from admin-generated link');
            }
          } catch (e) {
            console.error('Failed to extract tokens from admin link:', e);
          }
        }
      } else {
        const adminErrorText = await adminLinkResponse.text();
        console.error('Admin link generation failed:', adminLinkResponse.status, adminErrorText);
      }
    }

    if (!accessToken || !refreshToken) {
      console.error('Could not obtain session tokens from any method');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Could not create session tokens. Please try logging in again or contact support.'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Step 9: Returning session tokens to client');
    console.log(`📤 Returning is_first_login: ${isFirstLogin} (type: ${typeof isFirstLogin})`);
    console.log(`📤 ${isFirstLogin ? 'SHOW PASSWORD SETUP' : 'DIRECT LOGIN'}`);

    // Return the tokens directly - the client will handle setting the session
    // Calculate expiry (default to 1 hour from now)
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    
    // Ensure isFirstLogin is explicitly a boolean
    const isFirstLoginBool = Boolean(isFirstLogin);
    
    const responseData = { 
      success: true, 
      message: 'Login successful',
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      expires_in: 3600,
      is_first_login: isFirstLoginBool, // Explicitly ensure it's a boolean
      user: {
        id: profile.user_id,
        email: user.email || profile.email,
        phone: phone_number,
        role: profile.role,
        first_name: profile.first_name,
      },
    };
    
    console.log('📤 Response data (without tokens):', {
      success: responseData.success,
      is_first_login: responseData.is_first_login,
      is_first_login_type: typeof responseData.is_first_login,
      user_id: responseData.user.id,
      user_role: responseData.user.role,
      phone: phone_number
    });
    
    // Double-check the value before sending
    if (responseData.is_first_login !== true && responseData.is_first_login !== false) {
      console.error('⚠️ WARNING: is_first_login is not a boolean! Value:', responseData.is_first_login);
      // Force it to be true if it's not a proper boolean (safe default)
      responseData.is_first_login = true;
    }
    
    return new Response(
      JSON.stringify(responseData),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in create-auth-session:', error);
    console.error('Error details:', {
      message: (error as Error).message,
      stack: (error as Error).stack,
      name: (error as Error).name
    });
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Server error: ' + ((error as Error).message || 'Unknown error')
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
