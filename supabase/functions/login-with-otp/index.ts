import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LoginWithOTPRequest {
  phone_number: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone_number }: LoginWithOTPRequest = await req.json();

    // Validation
    if (!phone_number) {
      return new Response(
        JSON.stringify({ success: false, error: 'Phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Looking up user by phone:', phone_number);

    // Find user by phone number
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, email, first_name, role, is_active')
      .eq('phone', phone_number)
      .eq('is_active', true)
      .single();

    if (profileError || !profile) {
      console.error('Profile lookup error:', profileError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No active account found with this phone number' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User found:', { email: profile.email, role: profile.role });

    // Invalidate any previous unverified OTPs for this phone and purpose
    await supabase
      .from('otp_tokens')
      .update({ is_verified: false })
      .eq('phone_number', phone_number)
      .eq('purpose', 'login')
      .eq('is_verified', false)
      .lt('expires_at', new Date().toISOString());

    // Generate OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    console.log('Generated OTP for login');

    // Store OTP
    const { error: otpError } = await supabase
      .from('otp_tokens')
      .insert({
        user_id: profile.user_id,
        phone_number: phone_number,
        otp_code: otpCode,
        purpose: 'login',
        expires_at: expiresAt.toISOString(),
        max_attempts: 3,
        attempt_count: 0,
        is_verified: false,
      });

    if (otpError) {
      console.error('Failed to store OTP:', otpError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to generate OTP' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get SMS API credentials
    const smsApiKey = Deno.env.get('AWIGN_SMS_API_KEY');
    const smsUrl = 'https://core-api.awign.com/api/v1/sms/to_number';

    if (!smsApiKey) {
      console.error('SMS API key not configured');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'SMS service not configured',
          expires_at: expiresAt.toISOString()
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use approved SMS template with first name
    const userName = profile.first_name || 'User';
    const message = `Hi ${userName}\nYour OTP to login to the BGV Portal is ${otpCode}\n\nRegards -Awign`;

    console.log('Sending SMS to:', phone_number);

    const smsResponse = await fetch(smsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': smsApiKey,
      },
      body: JSON.stringify({
        phone_number: phone_number,
        message: message,
      }),
    });

    const smsResult = await smsResponse.json();
    console.log('SMS API response:', smsResult);

    if (!smsResponse.ok) {
      console.error('SMS API error:', smsResult);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to send SMS',
          expires_at: expiresAt.toISOString()
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'OTP sent successfully',
        expires_at: expiresAt.toISOString()
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
