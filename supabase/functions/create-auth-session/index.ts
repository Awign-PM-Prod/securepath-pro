import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateSessionRequest {
  email?: string;
  phone?: string;
  user_id: string;
  otp: string; // We need the OTP code to verify and create session
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, phone, user_id, otp }: CreateSessionRequest = await req.json();

    if (!user_id || !otp) {
      return new Response(
        JSON.stringify({ success: false, error: 'user_id and otp are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!email && !phone) {
      return new Response(
        JSON.stringify({ success: false, error: 'Either email or phone is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Use anon client to verify OTP (like a normal user would)
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    console.log('Verifying OTP and creating session for user:', user_id);

    // Verify OTP and get session tokens directly
    let verifyResult;
    
    if (phone) {
      console.log('Verifying phone OTP:', phone);
      verifyResult = await supabase.auth.verifyOtp({
        phone: phone,
        token: otp,
        type: 'sms'
      });
    } else if (email) {
      console.log('Verifying email OTP:', email);
      verifyResult = await supabase.auth.verifyOtp({
        email: email,
        token: otp,
        type: 'email'
      });
    }

    const { data, error } = verifyResult!;

    if (error) {
      console.error('OTP verification error:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to verify OTP: ' + error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data.session) {
      console.error('No session returned from OTP verification');
      return new Response(
        JSON.stringify({ success: false, error: 'No session created' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Session created successfully:', data.session.user.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Session created successfully',
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        expires_in: data.session.expires_in,
        user: data.user,
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
