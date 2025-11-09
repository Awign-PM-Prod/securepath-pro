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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('Step 1: Verifying OTP for phone:', phone_number);

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

    console.log('Step 4: Creating session for user_id:', profile.user_id);

    // Create auth session using admin API
    const { data: { session }, error: sessionError } = await supabase.auth.admin.createSession({
      user_id: profile.user_id
    });

    if (sessionError) {
      console.error('Session creation error:', sessionError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to create session: ' + sessionError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!session) {
      console.error('No session returned from createSession');
      return new Response(
        JSON.stringify({ success: false, error: 'No session created' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Step 5: Session created successfully for user:', profile.user_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Login successful',
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
        user: session.user,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Server error: ' + (error as Error).message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
