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
      console.error('Profile fetch error:', profileError)
      return new Response(
        JSON.stringify({ error: 'Unable to verify user role', details: profileError?.message }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { email, first_name, last_name, phone, role, vendor_data, gig_worker_data } = await req.json()

    // Validate required fields
    if (!email || !first_name || !last_name || !phone || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, first_name, last_name, phone, and role are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Debug logging
    console.log('Permission check:', {
      currentRole: currentProfile.role,
      targetRole: role,
      userId: currentUser.id
    })

    // Verify permission to create user with this role
    const canCreate = checkPermissions(currentProfile.role, role)
    console.log('Can create result:', canCreate)
    
    if (!canCreate) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient permissions to create user with this role',
          details: `Current role: ${currentProfile.role}, Target role: ${role}`
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Generate a secure random password (user will set their own via OTP)
    const generateRandomPassword = () => {
      const length = 16;
      const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
      let password = '';
      // Ensure at least one of each required character type
      password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
      password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
      password += '0123456789'[Math.floor(Math.random() * 10)]; // number
      password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // special char
      // Fill the rest randomly
      for (let i = password.length; i < length; i++) {
        password += charset[Math.floor(Math.random() * charset.length)];
      }
      // Shuffle the password
      return password.split('').sort(() => Math.random() - 0.5).join('');
    }

    const generatedPassword = generateRandomPassword();

    // Create admin client for user creation
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Create the user
    // For gig workers, don't confirm email automatically (they'll use SMS OTP instead)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: generatedPassword,
      email_confirm: role !== 'gig_worker', // Don't send email to gig workers
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
  // Normalize roles (trim whitespace)
  const normalizedCurrentRole = (currentRole || '').trim()
  const normalizedTargetRole = (targetRole || '').trim()
  
  console.log('checkPermissions called:', { 
    currentRole: normalizedCurrentRole, 
    targetRole: normalizedTargetRole,
    currentRoleType: typeof normalizedCurrentRole,
    targetRoleType: typeof normalizedTargetRole
  })
  
  // Super admin can manage all roles except other super admins
  if (normalizedCurrentRole === 'super_admin' && normalizedTargetRole !== 'super_admin') {
    return true
  }
  
  // Ops team can manage clients, vendors, and gig workers
  if (normalizedCurrentRole === 'ops_team' && ['client', 'vendor', 'gig_worker'].includes(normalizedTargetRole)) {
    return true
  }
  
  // Vendor team can manage vendors and gig workers
  if (normalizedCurrentRole === 'vendor_team' && ['vendor', 'gig_worker'].includes(normalizedTargetRole)) {
    return true
  }
  
  // Supply team can manage vendors and gig workers
  if (normalizedCurrentRole === 'supply_team' && ['vendor', 'gig_worker'].includes(normalizedTargetRole)) {
    console.log('✅ Supply team permission granted for role:', normalizedTargetRole)
    return true
  }
  
  // Vendors can manage gig workers
  if (normalizedCurrentRole === 'vendor' && normalizedTargetRole === 'gig_worker') {
    return true
  }
  
  console.log('❌ Permission denied - no matching rule found')
  return false
}