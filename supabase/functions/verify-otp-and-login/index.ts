import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyOTPRequest {
  phone_number: string;
  otp_code: string;
  purpose: 'login' | 'account_setup';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone_number, otp_code, purpose }: VerifyOTPRequest = await req.json();

    if (!phone_number || !otp_code) {
      return new Response(
        JSON.stringify({ success: false, error: 'Phone number and OTP code are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Verifying OTP for phone:', phone_number);

    // Find the OTP token
    const { data: otpToken, error: otpError } = await supabase
      .from('otp_tokens')
      .select('*')
      .eq('phone_number', phone_number)
      .eq('otp_code', otp_code)
      .eq('purpose', purpose)
      .eq('is_verified', false)
      .single();

    if (otpError || !otpToken) {
      console.error('OTP lookup error:', otpError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired OTP' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if OTP is expired
    if (new Date(otpToken.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: 'OTP has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check attempt count
    if (otpToken.attempt_count >= otpToken.max_attempts) {
      return new Response(
        JSON.stringify({ success: false, error: 'Maximum attempts exceeded' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark OTP as verified
    await supabase
      .from('otp_tokens')
      .update({ is_verified: true })
      .eq('id', otpToken.id);

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, email, role')
      .eq('phone', phone_number)
      .eq('is_active', true)
      .single();

    if (profileError || !profile) {
      console.error('Profile lookup error:', profileError);
      return new Response(
        JSON.stringify({ success: false, error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating session for user:', profile.user_id);

    // Create session using admin API
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.createUser({
      email: profile.email,
      email_confirm: true,
      user_metadata: {
        phone: phone_number,
        role: profile.role
      }
    });

    if (sessionError) {
      console.error('Session creation error:', sessionError);
      // User might already exist, try to generate a session token instead
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: profile.email,
      });

      if (linkError || !linkData) {
        console.error('Link generation error:', linkError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to create session' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'OTP verified successfully',
          user_id: profile.user_id,
          role: profile.role,
          email: profile.email,
          magic_link: linkData.properties.action_link,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'OTP verified successfully',
        user_id: profile.user_id,
        role: profile.role,
        email: profile.email,
        session: sessionData.session,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
