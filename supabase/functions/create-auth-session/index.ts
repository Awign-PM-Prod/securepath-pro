import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateSessionRequest {
  email: string;
  user_id: string;
  phone?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, user_id, phone }: CreateSessionRequest = await req.json();

    if (!email || !user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email and user_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Creating session for user:', user_id);

    // Check if user exists in auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(user_id);

    if (authError || !authUser) {
      console.error('User not found in auth:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'User not found in authentication system' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update phone number if provided and not already set
    if (phone && !authUser.user.phone) {
      console.log('Updating user phone number:', phone);
      const { error: updateError } = await supabase.auth.admin.updateUserById(user_id, {
        phone: phone
      });
      
      if (updateError) {
        console.error('Failed to update phone:', updateError);
      }
    }

    // Generate a recovery link which includes valid session tokens
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email
    });

    if (linkError || !linkData) {
      console.error('Link generation error:', linkError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to generate auth tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract tokens from the properties
    const accessToken = linkData.properties?.access_token;
    const refreshToken = linkData.properties?.refresh_token;
    const expiresAt = linkData.properties?.expires_at;

    if (!accessToken || !refreshToken) {
      console.error('Tokens not found in response');
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to extract auth tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Auth tokens generated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Session tokens created successfully',
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
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
