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

    // Build SMS message for login - replace placeholders with actual values
    console.log('Step 4: Building SMS message');
    const displayName = userName || 'User';
    const template = `Hi {#var#}\nYour OTP to login to the BGV Portal is {#var#}\n\nRegards -Awign`;
    
    // Replace {#var#} placeholders with actual values in order
    const variables = [displayName, otpCode];
    let varIndex = 0;
    const finalMessage = template.replace(/{#var#}/g, () => variables[varIndex++] || '');
    
    console.log('SMS message template:', template);
    console.log('Template variables (in order):', variables);
    console.log('Final message with substituted values:', finalMessage);
    console.log('Variables - Name:', displayName, 'OTP:', otpCode);

    // Normalize phone number - AWIGN API expects just 10 digits (no country code)
    let normalizedPhone = phone_number.trim().replace(/\s+/g, ''); // Remove all spaces
    
    // Only remove +91 or 91 prefix if the number is 12+ digits (has country code)
    // If it's already 10 digits, don't remove anything
    if (normalizedPhone.length >= 12) {
      // Has country code, remove it
      normalizedPhone = normalizedPhone.replace(/^\+?91/, '');
    } else if (normalizedPhone.length === 11 && normalizedPhone.startsWith('0')) {
      // Handle numbers starting with 0 (like 09151529142)
      normalizedPhone = normalizedPhone.substring(1);
    }
    
    // Validate it's a 10-digit Indian mobile number
    if (!/^[6-9]\d{9}$/.test(normalizedPhone)) {
      console.error('Invalid phone number format:', normalizedPhone, '(original:', phone_number, ')');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid Indian mobile number format. Must be 10 digits starting with 6-9.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Step 5: Sending SMS');
    console.log(`Sending SMS to normalized phone: ${normalizedPhone} (original: ${phone_number})`);
    console.log('SMS API URL: https://core-api.awign.com/api/v1/sms/to_number');
    console.log('Template ID: 1107176258859911807');
    console.log('Message to send:', finalMessage);

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
          message: finalMessage, // Send fully-formed message with values already substituted
          sender_id: 'IAWIGN',
          channel: 'telspiel',
        },
      }),
    });

    const responseText = await smsResponse.text();
    console.log(`SMS API Response Status: ${smsResponse.status}`);
    console.log(`SMS API Response: ${responseText}`);
    
    // Log request details
    const requestBody = {
      mobile_number: normalizedPhone,
      template_id: '1107176258859911807',
      message: finalMessage,
      sender_id: 'IAWIGN',
      channel: 'telspiel',
    };
    console.log(`SMS Request Body: ${JSON.stringify(requestBody, null, 2)}`);

    // Try to parse response
    let responseData: any = null;
    let parseError: string | null = null;
    try {
      responseData = JSON.parse(responseText);
      console.log('SMS API Response parsed successfully');
    } catch (e) {
      parseError = e instanceof Error ? e.message : 'Unknown parse error';
      console.log('SMS API response is not JSON:', parseError);
    }

    // Check HTTP status
    if (!smsResponse.ok) {
      console.error('SMS API HTTP error - Status:', smsResponse.status);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to send OTP SMS: HTTP ${smsResponse.status}`
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check response data for errors
    if (responseData) {
      console.log('Checking response data for errors...');
      console.log('Response status:', responseData.status);
      console.log('Response message:', responseData.message);
      console.log('Response data:', JSON.stringify(responseData.data, null, 2));
      
      if (responseData.error || responseData.status === 'error' || responseData.success === false) {
        console.error('SMS API returned error in response body');
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: responseData.message || responseData.error || 'Failed to send OTP SMS'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check SMS status in response data
      if (responseData.data) {
        const smsStatus = responseData.data.status;
        const smsId = responseData.data.id;
        console.log(`SMS Status: ${smsStatus}, SMS ID: ${smsId}`);
        
        // Log important fields
        if (responseData.data.message_reference_id) {
          console.log('Message Reference ID:', responseData.data.message_reference_id);
        }
        if (responseData.data.notify_at) {
          console.log('Notify At:', responseData.data.notify_at);
        }
        if (responseData.data.sync !== undefined) {
          console.log('Sync Status:', responseData.data.sync);
        }
      }
    }

    console.log(`OTP sent successfully to ${normalizedPhone} for login`);

    // Return sanitized response without OTP code or sensitive information
    // Only include essential status information for client
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'OTP sent successfully',
        expires_in_seconds: 300,
        // Only include non-sensitive status information
        sms_status: responseData?.data?.status || 'unknown',
        sms_id: responseData?.data?.id || null,
        // Add a visible warning if status is 'created'
        warning: responseData?.data?.status === 'created' 
          ? 'SMS status is "created" - it may be queued but not yet sent. Check SMS gateway logs.' 
          : undefined
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-otp function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        debug: {
          error_message: errorMessage,
          error_stack: errorStack,
          error_type: error?.constructor?.name || typeof error
        }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});