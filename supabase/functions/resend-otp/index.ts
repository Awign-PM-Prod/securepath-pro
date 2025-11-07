import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResendOTPRequest {
  phone_number: string;
  purpose: 'login' | 'account_setup';
  email?: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone_number, purpose, email }: ResendOTPRequest = await req.json();

    // Validation
    if (!phone_number || !purpose) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Invalidate previous unverified OTPs
    await supabase
      .from('otp_tokens')
      .update({ is_verified: true }) // Mark as verified to invalidate
      .eq('phone_number', phone_number)
      .eq('purpose', purpose)
      .eq('is_verified', false);

    // Get user_id if not provided
    let userId: string | undefined;
    if (email) {
      const { data: userData } = await supabase.auth.admin.listUsers();
      const user = userData?.users?.find(u => u.email === email);
      userId = user?.id;
      
      if (userId) {
        console.log(`✅ Found user_id ${userId} for email ${email}`);
      } else {
        console.warn(`❌ No user found for email ${email}`);
      }
    }
    
    console.log(`Resend OTP request - user_id: ${userId}, phone: ${phone_number}, purpose: ${purpose}`);

    // Generate new OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Store new OTP
    const { error: insertError } = await supabase
      .from('otp_tokens')
      .insert({
        user_id: userId,
        phone_number,
        otp_code: otpCode,
        purpose,
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error('Error inserting OTP:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to generate OTP' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send OTP via AWIGN SMS API
    const smsAccessToken = Deno.env.get('SMS_ACCESS_TOKEN');
    const smsClientId = Deno.env.get('SMS_CLIENT_ID');
    const smsUid = Deno.env.get('SMS_UID');

    if (!smsAccessToken || !smsClientId || !smsUid) {
      console.error('SMS credentials not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'SMS service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const message = `${otpCode} is the OTP for your verification.\n\nTeam AWIGN`;

    const smsResponse = await fetch('https://core-api.awign.com/api/v1/sms/to_number', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access-token': smsAccessToken,
        'client': smsClientId,
        'uid': smsUid,
        'X-CLIENT_ID': 'core',
      },
      body: JSON.stringify({
        sms: {
          mobile_number: phone_number,
          template_id: '1107160412653314461',
          message: message,
          sender_id: 'IAWIGN',
          channel: 'telspiel',
        },
      }),
    });

    const smsResponseText = await smsResponse.text();
    console.log(`SMS API Response - Status: ${smsResponse.status}, Body:`, smsResponseText);

    if (!smsResponse.ok) {
      console.error('SMS API error - Status:', smsResponse.status, 'Response:', smsResponseText);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to send OTP SMS' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`OTP resent successfully to ${phone_number}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'OTP resent successfully',
        expires_in_seconds: 300 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in resend-otp function:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});