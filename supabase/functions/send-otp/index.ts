import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendOTPRequest {
  user_id?: string;
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
    const { user_id, phone_number, purpose, email }: SendOTPRequest = await req.json();

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

    // Invalidate previous unverified OTPs for this phone number and purpose
    await supabase
      .from('otp_tokens')
      .update({ is_verified: true })
      .eq('phone_number', phone_number)
      .eq('purpose', purpose)
      .eq('is_verified', false);

    // Check rate limiting - max 3 OTPs per phone number per 5 minutes (only unverified ones)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentOTPs, error: rateLimitError } = await supabase
      .from('otp_tokens')
      .select('id')
      .eq('phone_number', phone_number)
      .eq('is_verified', false)
      .gte('created_at', fiveMinutesAgo);

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
    }

    if (recentOTPs && recentOTPs.length >= 3) {
      return new Response(
        JSON.stringify({ success: false, error: 'Too many OTP requests. Please try again after 5 minutes.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set expiry to 5 minutes from now
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Get user_id if not provided (for login purpose)
    let userId = user_id;
    if (!userId && purpose === 'login' && email) {
      const { data: userData } = await supabase.auth.admin.listUsers();
      const user = userData?.users?.find(u => u.email === email);
      userId = user?.id;
    }

    if (!userId && purpose === 'login') {
      return new Response(
        JSON.stringify({ success: false, error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store OTP in database
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

    console.log('SMS Credentials check:', {
      hasAccessToken: !!smsAccessToken,
      hasClientId: !!smsClientId,
      hasUid: !!smsUid,
    });

    if (!smsAccessToken || !smsClientId || !smsUid) {
      console.error('SMS credentials not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'SMS service not configured. Please contact administrator.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create verification link
    const verificationUrl = `https://preview--securepath-pro.lovable.app/verify-phone/${phone_number}?purpose=${purpose}`;
    const message = `${otpCode} is the OTP for your verification.\n\nVerify here: ${verificationUrl}\n\nCheers!\nTeam AWIGN`;

    console.log('Attempting to send SMS to:', phone_number);
    console.log('Verification URL:', verificationUrl);

    try {
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

      const responseText = await smsResponse.text();
      console.log('SMS API Response Status:', smsResponse.status);
      console.log('SMS API Response Body:', responseText);

      if (!smsResponse.ok) {
        console.error('SMS API error - Status:', smsResponse.status);
        console.error('SMS API error - Body:', responseText);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Failed to send OTP SMS. API returned status ${smsResponse.status}. Please contact administrator.` 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Parse response to check for errors in the body
      let smsResponseData;
      try {
        smsResponseData = JSON.parse(responseText);
        console.log('SMS API Parsed Response:', smsResponseData);
      } catch (e) {
        console.log('Could not parse SMS response as JSON');
      }

      console.log(`✅ OTP sent successfully to ${phone_number} for ${purpose}`);
    } catch (fetchError) {
      console.error('Error calling SMS API:', fetchError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to connect to SMS service. Please contact administrator.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'OTP sent successfully',
        expires_in_seconds: 300 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-otp function:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});