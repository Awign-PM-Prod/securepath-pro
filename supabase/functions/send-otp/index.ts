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
  first_name?: string;
}

serve(async (req) => {
  console.log('=== send-otp function called ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Parsing request body...');
    const body = await req.json();
    console.log('Received request body:', JSON.stringify(body));
    
    const { user_id, phone_number, purpose, email, first_name }: SendOTPRequest = body;

    console.log('Extracted values:', {
      phone_number,
      purpose,
      email,
      user_id,
      first_name
    });

    // Validation
    if (!phone_number || !purpose) {
      console.error('Validation failed: Missing required fields');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Rate limiting removed - no limit on OTP generation

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('Step 2: Generated OTP code:', otpCode);
    
    // Set expiry to 5 minutes from now
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    console.log('OTP expires at:', expiresAt);

    // Get user_id if not provided
    let userId = user_id;
    let userName = first_name;
    
    console.log('Step 1: Getting user_id. Provided:', userId);
    
    if (!userId && email) {
      console.log('User_id not provided, looking up by email:', email);
      const { data: userData } = await supabase.auth.admin.listUsers();
      const user = userData?.users?.find(u => u.email === email);
      userId = user?.id;
      console.log('Found user_id from email lookup:', userId);
    }

    // Get first_name from profile if not provided
    if (!userName && phone_number) {
      console.log('First name not provided, looking up from profile');
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('first_name')
        .eq('phone', phone_number)
        .eq('is_active', true)
        .maybeSingle();
      
      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile for first_name:', profileError);
      }
      userName = profile?.first_name;
      console.log('Found first_name from profile:', userName);
    }

    console.log('Final values - userId:', userId, 'userName:', userName);

    if (!userId) {
      console.error('User not found - userId is required');
      return new Response(
        JSON.stringify({ success: false, error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store OTP in database
    console.log('Step 3: Storing OTP in database');
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
    console.log('OTP stored successfully in database');

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

    // Build SMS message for login
    console.log('Step 4: Building SMS message');
    const displayName = userName || 'User';
    const message = `Hi ${displayName}\nYour OTP to login to the BGV Portal is ${otpCode}\n\nRegards -Awign`;
    console.log('SMS message:', message);

    // Normalize phone number - ensure it has +91 prefix if it's a 10-digit Indian number
    let normalizedPhone = phone_number.trim();
    if (normalizedPhone.length === 10 && /^[6-9]\d{9}$/.test(normalizedPhone)) {
      normalizedPhone = `+91${normalizedPhone}`;
    } else if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = `+91${normalizedPhone.replace(/^91/, '')}`;
    }

    console.log('Step 5: Sending SMS');
    console.log(`Sending SMS to normalized phone: ${normalizedPhone} (original: ${phone_number})`);
    console.log(`SMS Message: ${message.substring(0, 100)}...`);
    console.log('SMS API URL: https://core-api.awign.com/api/v1/sms/to_number');
    console.log('Template ID: 1107176258859911807');

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
          template_id: '1107176258859911807',
          message: message,
          sender_id: 'IAWIGN',
          channel: 'telspiel',
        },
      }),
    });

    const responseText = await smsResponse.text();
    console.log(`SMS API Response Status: ${smsResponse.status}`);
    console.log(`SMS API Response: ${responseText}`);
    console.log(`SMS Request Body: ${JSON.stringify({
      mobile_number: normalizedPhone,
      template_id: '1107176258859911807',
      message_length: message.length,
      sender_id: 'IAWIGN',
      channel: 'telspiel',
    })}`);

    if (!smsResponse.ok) {
      console.error('SMS API error:', responseText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to send OTP SMS: ${responseText}`,
          debug: {
            status: smsResponse.status,
            response: responseText,
            phone: normalizedPhone
          }
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to parse response to check for errors in response body
    let responseData: any = null;
    try {
      responseData = JSON.parse(responseText);
      console.log('SMS API Response parsed:', JSON.stringify(responseData));
      
      if (responseData.error || responseData.status === 'error' || responseData.success === false) {
        console.error('SMS API returned error in response:', responseData);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: responseData.message || responseData.error || 'Failed to send OTP SMS',
            debug: {
              status: smsResponse.status,
              response: responseData,
              phone: normalizedPhone
            }
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (e) {
      // Response is not JSON, that's okay
      console.log('SMS API response is not JSON, assuming success. Response:', responseText);
    }

    console.log(`OTP sent successfully to ${normalizedPhone} for login`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'OTP sent successfully',
        expires_in_seconds: 300,
        debug: {
          phone: normalizedPhone,
          sms_response: responseData || responseText
        }
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