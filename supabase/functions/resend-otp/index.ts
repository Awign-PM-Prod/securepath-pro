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

    // Rate limiting removed - no cooldown on resend

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
    }

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

    // Build verification link for account_setup purpose
    let verificationLink = '';
    if (purpose === 'account_setup' && email) {
      const baseUrl = Deno.env.get('APP_URL') || 'https://securepath.awign.com';
      verificationLink = `${baseUrl}/gig/verify?phone=${encodeURIComponent(phone_number)}&email=${encodeURIComponent(email)}`;
    }

    // Build SMS message with link for account_setup, without link for login
    let message = '';
    if (purpose === 'account_setup' && verificationLink) {
      message = `${otpCode} is your OTP for account verification.\n\nVerify here: ${verificationLink}\n\nTeam AWIGN`;
    } else {
      message = `${otpCode} is the OTP for your verification.\n\nTeam AWIGN`;
    }

    // Normalize phone number - ensure it has +91 prefix if it's a 10-digit Indian number
    let normalizedPhone = phone_number.trim();
    if (normalizedPhone.length === 10 && /^[6-9]\d{9}$/.test(normalizedPhone)) {
      normalizedPhone = `+91${normalizedPhone}`;
    } else if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = `+91${normalizedPhone.replace(/^91/, '')}`;
    }

    console.log(`Resending SMS to normalized phone: ${normalizedPhone} (original: ${phone_number})`);
    console.log(`SMS Message: ${message.substring(0, 100)}...`);

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
          mobile_number: normalizedPhone,
          template_id: '1107160412653314461',
          message: message,
          sender_id: 'IAWIGN',
          channel: 'telspiel',
        },
      }),
    });

    const responseText = await smsResponse.text();
    console.log(`SMS API Response Status: ${smsResponse.status}`);
    console.log(`SMS API Response: ${responseText}`);

    if (!smsResponse.ok) {
      console.error('SMS API error:', responseText);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to send OTP SMS: ${responseText}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to parse response to check for errors in response body
    try {
      const responseData = JSON.parse(responseText);
      if (responseData.error || responseData.status === 'error') {
        console.error('SMS API returned error in response:', responseData);
        return new Response(
          JSON.stringify({ success: false, error: responseData.message || 'Failed to send OTP SMS' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (e) {
      // Response is not JSON, that's okay
      console.log('SMS API response is not JSON, assuming success');
    }

    console.log(`OTP resent successfully to ${normalizedPhone}`);

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