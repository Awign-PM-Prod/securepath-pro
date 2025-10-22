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

    const { email, password, first_name, last_name, phone, role, vendor_data, gig_worker_data } = await req.json()

    // Verify permission to create user with this role
    const canCreate = checkPermissions(currentProfile.role, role)
    if (!canCreate) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions to create user with this role' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create admin client for user creation
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Create the user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name,
        last_name,
        role,
      },
    })

    if (authError) {
      return new Response(
        JSON.stringify({ error: authError.message }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create or update profile (upsert in case trigger already created one)
    const { data: profileData, error: profileInsertError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        user_id: authData.user.id,
        email,
        first_name,
        last_name,
        phone,
        role,
        created_by: currentUser.id,
      }, {
        onConflict: 'user_id'
      })
      .select('id')
      .single()

    if (profileInsertError) {
      console.error('Profile insertion error:', profileInsertError)
      // If profile creation fails, we should delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create user profile', 
          details: profileInsertError.message || profileInsertError 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // If this is a gig worker, create gig_partners record
    if (role === 'gig_worker') {
      const gigPartnerInsert: any = {
        user_id: authData.user.id,
        profile_id: profileData.id,
        is_active: true,
        is_available: true,
        created_by: currentUser.id,
      }

      // Add gig worker specific data if provided
      if (gig_worker_data) {
        gigPartnerInsert.address = gig_worker_data.address
        gigPartnerInsert.city = gig_worker_data.city
        gigPartnerInsert.state = gig_worker_data.state
        gigPartnerInsert.pincode = gig_worker_data.pincode
        gigPartnerInsert.alternate_phone = gig_worker_data.alternate_phone || null
        gigPartnerInsert.country = gig_worker_data.country || 'India'
        gigPartnerInsert.coverage_pincodes = gig_worker_data.coverage_pincodes || []
        gigPartnerInsert.max_daily_capacity = gig_worker_data.max_daily_capacity || 1
        gigPartnerInsert.capacity_available = gig_worker_data.max_daily_capacity || 1
        gigPartnerInsert.vendor_id = gig_worker_data.vendor_id || null
        gigPartnerInsert.is_direct_gig = gig_worker_data.is_direct_gig !== false
      }

      const { data: gigPartnerData, error: gigPartnerError } = await supabaseAdmin
        .from('gig_partners')
        .insert(gigPartnerInsert)
        .select('id')
        .single()

      if (gigPartnerError) {
        console.error('Gig partner creation error:', gigPartnerError)
        // If gig_partners creation fails, clean up auth user and profile
        await supabaseAdmin.from('profiles').delete().eq('user_id', authData.user.id)
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        
        return new Response(
          JSON.stringify({ 
            error: 'Failed to create gig worker profile', 
            details: gigPartnerError.message || gigPartnerError 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Initialize capacity tracking for today
      if (gigPartnerData && gig_worker_data) {
        const maxCapacity = gig_worker_data.max_daily_capacity || 1
        const { error: capacityError } = await supabaseAdmin
          .from('capacity_tracking')
          .insert({
            gig_partner_id: gigPartnerData.id,
            date: new Date().toISOString().split('T')[0],
            max_daily_capacity: maxCapacity,
            initial_capacity_available: maxCapacity,
            current_capacity_available: maxCapacity,
            is_active: true,
          })

        if (capacityError) {
          console.error('Capacity tracking creation error:', capacityError)
          // Non-fatal error, log but continue
        }
      }
    }

    // If this is a vendor, create vendors record
    if (role === 'vendor' && vendor_data) {
      const { error: vendorError } = await supabaseAdmin
        .from('vendors')
        .insert({
          profile_id: profileData.id, // Link to the profile that was just created
          name: vendor_data.name,
          email: email,
          phone: phone || '',
          contact_person: vendor_data.contact_person,
          address: vendor_data.address,
          city: vendor_data.city,
          state: vendor_data.state,
          pincode: vendor_data.pincode,
          country: vendor_data.country || 'India',
          coverage_pincodes: vendor_data.coverage_pincodes || [vendor_data.pincode],
          created_by: currentUser.id,
        })

      if (vendorError) {
        console.error('Vendor creation error:', vendorError)
        // If vendor creation fails, clean up auth user and profile
        await supabaseAdmin.from('profiles').delete().eq('user_id', authData.user.id)
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        
        return new Response(
          JSON.stringify({ 
            error: 'Failed to create vendor profile', 
            details: vendorError.message || vendorError 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: authData.user.id,
          email: authData.user.email,
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

function checkPermissions(currentRole: string, targetRole: string): boolean {
  // Super admin can manage all roles except other super admins
  if (currentRole === 'super_admin' && targetRole !== 'super_admin') {
    return true
  }
  
  // Ops team can manage clients, vendors, and gig workers
  if (currentRole === 'ops_team' && ['client', 'vendor', 'gig_worker'].includes(targetRole)) {
    return true
  }
  
  // Vendor team can manage vendors and gig workers
  if (currentRole === 'vendor_team' && ['vendor', 'gig_worker'].includes(targetRole)) {
    return true
  }
  
  // Vendors can manage gig workers
  if (currentRole === 'vendor' && targetRole === 'gig_worker') {
    return true
  }
  
  return false
}