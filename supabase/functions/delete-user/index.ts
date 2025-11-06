import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('=== delete-user edge function called ===')
  console.log('Method:', req.method)
  console.log('URL:', req.url)

  try {
    // Create a Supabase client with the Auth context of the logged in user.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the current user to verify permissions
    const {
      data: { user: currentUser },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !currentUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get current user's profile to check role
    const { data: currentProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('user_id', currentUser.id)
      .single()

    if (profileError || !currentProfile) {
      return new Response(
        JSON.stringify({ error: 'Unable to verify user role' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const body = await req.json()
    console.log('Request body:', body)
    const { user_id } = body

    if (!user_id) {
      console.error('Missing user_id in request body')
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verify permission to delete users
    const canDelete = checkPermissions(currentProfile.role)
    if (!canDelete) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions to delete users' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create admin client for user deletion
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Delete the auth user
    console.log('Attempting to delete auth user:', user_id)
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id)

    if (authDeleteError) {
      console.error('Auth delete error:', authDeleteError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to delete auth user', 
          details: authDeleteError.message 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('✅ Successfully deleted auth user:', user_id)
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User deleted successfully from auth'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in delete-user function:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error occurred' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

function checkPermissions(currentRole: string): boolean {
  // Super admin can delete users
  if (currentRole === 'super_admin') {
    return true
  }
  
  // Ops team can delete users (clients, vendors, gig workers)
  if (currentRole === 'ops_team') {
    return true
  }
  
  // Vendor team can delete users (vendors, gig workers)
  if (currentRole === 'vendor_team') {
    return true
  }
  
  // Vendors can delete their own gig workers
  if (currentRole === 'vendor') {
    return true
  }
  
  return false
}

