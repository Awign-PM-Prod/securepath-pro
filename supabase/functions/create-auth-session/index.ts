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
    const { phone_number, otp_code }: CreateSessionRequest = await req.json();

    if (!phone_number || !otp_code) {
      return new Response(
        JSON.stringify({ success: false, error: 'phone_number and otp_code are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role client for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Verifying OTP for phone:', phone_number);

    // Step 1: Verify the OTP from our custom otp_tokens table
    const { data: otpToken, error: otpError } = await supabase
      .from('otp_tokens')
      .select('*')
      .eq('phone_number', phone_number)
      .eq('otp_code', otp_code)
      .eq('purpose', 'login')
      .eq('is_verified', false)
      .single();

    if (otpError || !otpToken) {
      console.error('OTP verification error:', otpError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired OTP' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if OTP expired
    if (new Date(otpToken.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: 'OTP has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check attempts
    if (otpToken.attempts >= otpToken.max_attempts) {
      return new Response(
        JSON.stringify({ success: false, error: 'Maximum attempts exceeded' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark OTP as verified
    await supabase
      .from('otp_tokens')
      .update({ 
        is_verified: true,
        verified_at: new Date().toISOString()
      })
      .eq('id', otpToken.id);

    // Step 2: Get user profile with this phone number
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, email, role, first_name')
      .eq('phone', phone_number)
      .eq('is_active', true)
      .single();

    if (profileError || !profile || !profile.user_id) {
      console.error('Profile lookup error:', profileError);
      return new Response(
        JSON.stringify({ success: false, error: 'User not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating session for user:', profile.user_id);

    // Step 3: Create auth session using admin API
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.createSession({
      user_id: profile.user_id
    });

    if (sessionError || !sessionData.session) {
      console.error('Session creation error:', sessionError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create session: ' + sessionError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Session created successfully for user:', profile.user_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Session created successfully',
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        expires_at: sessionData.session.expires_at,
        expires_in: sessionData.session.expires_in,
        user: sessionData.user,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'An unexpected error occurred: ' + (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
