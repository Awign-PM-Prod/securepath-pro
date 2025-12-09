// =====================================================
// CREATE CASE API ENDPOINT
// Allows case creation via API key or JWT authentication
// Background Verification Platform
// =====================================================

// @ts-ignore - Deno types are available at runtime
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

// @ts-ignore - Deno URL imports are valid in Supabase Edge Functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore - Deno URL imports are valid in Supabase Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// @ts-ignore - Deno global is available at runtime
declare const Deno: any

// =====================================================
// API KEY VALIDATION HELPERS (Inlined)
// =====================================================

interface ApiKeyValidation {
  valid: boolean;
  key_id?: string;
  client_id?: string;
  permissions?: any;
  error?: string;
}

async function validateApiKey(
  apiKey: string | null,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<ApiKeyValidation> {
  if (!apiKey) {
    return { valid: false, error: 'API key is required' };
  }

  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    return { valid: false, error: 'API key cannot be empty' };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data, error } = await supabase.rpc('validate_api_key', {
      p_api_key: trimmedKey
    });

    if (error) {
      console.error('API key validation error:', error);
      return { valid: false, error: 'Failed to validate API key' };
    }

    if (!data || !data.valid) {
      return { 
        valid: false, 
        error: data?.error || 'Invalid API key' 
      };
    }

    return {
      valid: true,
      key_id: data.key_id,
      client_id: data.client_id,
      permissions: data.permissions
    };
  } catch (error) {
    console.error('API key validation exception:', error);
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    };
  }
}

function checkPermission(
  permissions: any,
  requiredPermission: string
): boolean {
  if (!permissions || typeof permissions !== 'object') {
    return false;
  }
  return permissions[requiredPermission] === true;
}

function getAuthMethod(req: Request): 'api_key' | 'jwt' | null {
  const apiKey = req.headers.get('x-api-key');
  const authHeader = req.headers.get('Authorization');
  
  if (apiKey) {
    return 'api_key';
  } else if (authHeader) {
    return 'jwt';
  }
  
  return null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use POST.' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Determine authentication method
    const authMethod = getAuthMethod(req)
    let clientId: string | null = null
    let permissions: any = null
    let userId: string | null = null
    let isApiKeyAuth = false

    if (authMethod === 'api_key') {
      // Validate API key
      const apiKey = req.headers.get('x-api-key')
      const validation = await validateApiKey(apiKey, supabaseUrl, supabaseServiceKey)
      
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: validation.error || 'Invalid API key' }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Check permission
      if (!checkPermission(validation.permissions, 'create_cases')) {
        return new Response(
          JSON.stringify({ error: 'API key does not have permission to create cases' }),
          { 
            status: 403, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      clientId = validation.client_id || null
      permissions = validation.permissions
      isApiKeyAuth = true
    } else if (authMethod === 'jwt') {
      // JWT authentication (for portal users)
      const authHeader = req.headers.get('Authorization')
      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader! } }
      })

      const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Get user profile to check role
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single()

      if (!profile || !['super_admin', 'ops_team', 'client'].includes(profile.role)) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { 
            status: 403, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      userId = user.id
    } else {
      return new Response(
        JSON.stringify({ error: 'Missing authentication. Provide either x-api-key header or Authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse request body
    let body: any
    try {
      body = await req.json()
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const {
      client_case_id,
      contract_type,
      candidate_name,
      company_name,
      phone_primary,
      phone_secondary,
      client_id, // Use from API key if available, otherwise from body
      location,
      vendor_tat_start_date,
      due_at,
      base_rate_inr,
      bonus_inr,
      penalty_inr,
      total_payout_inr,
      tat_hours,
      instructions
    } = body

    // Validate required fields
    if (!client_case_id || !contract_type || !candidate_name || !phone_primary) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields',
          required: ['client_case_id', 'contract_type', 'candidate_name', 'phone_primary']
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Use client_id from API key if available, otherwise from body
    const finalClientId = clientId || client_id
    if (!finalClientId) {
      return new Response(
        JSON.stringify({ error: 'client_id is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate location
    if (!location || !location.address_line || !location.city || !location.state || !location.pincode) {
      return new Response(
        JSON.stringify({ 
          error: 'location is required with address_line, city, state, and pincode'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate dates
    if (!vendor_tat_start_date || !due_at) {
      return new Response(
        JSON.stringify({ error: 'vendor_tat_start_date and due_at are required (ISO 8601 format)' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate tat_hours
    if (!tat_hours || typeof tat_hours !== 'number' || tat_hours <= 0) {
      return new Response(
        JSON.stringify({ error: 'tat_hours is required and must be a positive number' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create service role client for database operations
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Create or get location
    let locationId: string
    
    // Check if location exists
    const { data: existingLocation } = await supabaseService
      .from('locations')
      .select('id, pincode_tier')
      .eq('pincode', location.pincode)
      .eq('address_line', location.address_line)
      .eq('city', location.city)
      .eq('state', location.state)
      .limit(1)
      .maybeSingle()

    if (existingLocation) {
      locationId = existingLocation.id
    } else {
      // Get pincode tier
      const { data: pincodeTierData } = await supabaseService
        .from('pincode_tiers')
        .select('tier')
        .eq('pincode', location.pincode)
        .eq('is_active', true)
        .maybeSingle()

      const pincodeTier = pincodeTierData?.tier || 'tier_3' // Default to tier_3

      // Create new location
      const { data: newLocation, error: locError } = await supabaseService
        .from('locations')
        .insert({
          address_line: location.address_line,
          city: location.city,
          state: location.state,
          pincode: location.pincode,
          country: 'India',
          lat: location.lat || null,
          lng: location.lng || null,
          pincode_tier: pincodeTier
        })
        .select('id')
        .single()

      if (locError || !newLocation) {
        return new Response(
          JSON.stringify({ 
            error: 'Failed to create location', 
            details: locError?.message 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
      locationId = newLocation.id
    }

    // Step 2: Calculate or validate payout
    let finalBaseRate = base_rate_inr
    let finalBonus = bonus_inr || 0
    let finalPenalty = penalty_inr || 0
    let finalTotalPayout = total_payout_inr

    // If payout values not provided, try to calculate
    if (finalBaseRate === undefined || finalTotalPayout === undefined) {
      try {
        // Get client contract
        const { data: contract, error: contractError } = await supabaseService
          .from('client_contracts')
          .select('*')
          .eq('client_id', finalClientId)
          .eq('contract_type', contract_type)
          .maybeSingle()

        if (contractError || !contract) {
          return new Response(
            JSON.stringify({ 
              error: 'Payout calculation failed',
              details: 'No contract found for this client and contract type. Please provide base_rate_inr and total_payout_inr in the request, or set up a client contract first.'
            }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }

        // Get pincode tier from location
        const { data: locationData } = await supabaseService
          .from('locations')
          .select('pincode_tier')
          .eq('id', locationId)
          .single()

        const tier = locationData?.pincode_tier || 'tier_3'

        // Calculate base rate based on tier
        switch (tier) {
          case 'tier_1':
            finalBaseRate = contract.tier1_base_payout_inr || 0
            break
          case 'tier_2':
            finalBaseRate = contract.tier2_base_payout_inr || 0
            break
          case 'tier_3':
            finalBaseRate = contract.tier3_base_payout_inr || 0
            break
          default:
            finalBaseRate = contract.tier3_base_payout_inr || 0
        }

        finalTotalPayout = finalBaseRate + finalBonus - finalPenalty
      } catch (calcError) {
        return new Response(
          JSON.stringify({ 
            error: 'Payout calculation failed',
            details: 'Please provide base_rate_inr and total_payout_inr in the request'
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    } else {
      // Validate provided payout values
      if (finalBaseRate < 0 || finalBonus < 0 || finalPenalty < 0) {
        return new Response(
          JSON.stringify({ error: 'Payout values cannot be negative' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
      finalTotalPayout = finalBaseRate + finalBonus - finalPenalty
    }

    // Step 3: Generate case number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const randomSuffix = Math.random().toString(36).substr(2, 6).toUpperCase()
    const caseNumber = `BG-${dateStr}-${randomSuffix}`

    // Step 4: Prepare metadata
    const metadata = {
      instructions: instructions || '',
      candidate_name: candidate_name,
      phone_primary: phone_primary,
      phone_secondary: phone_secondary || null,
      contract_type: contract_type
    }

    // Step 5: Get created_by user ID
    // For API key auth, get user from client record or use system user
    let createdByUserId = userId
    
    if (isApiKeyAuth && !createdByUserId) {
      // Try to get user from client record
      const { data: clientData } = await supabaseService
        .from('clients')
        .select('created_by')
        .eq('id', finalClientId)
        .single()
      
      if (clientData?.created_by) {
        createdByUserId = clientData.created_by
      } else {
        // Try to find a system/admin user as fallback
        const { data: adminUser } = await supabaseService
          .from('profiles')
          .select('user_id')
          .in('role', ['super_admin', 'ops_team'])
          .eq('is_active', true)
          .limit(1)
          .maybeSingle()
        
        if (adminUser?.user_id) {
          createdByUserId = adminUser.user_id
        } else {
          return new Response(
            JSON.stringify({ 
              error: 'Unable to determine user for case creation',
              details: 'Please ensure client has a created_by user or system has admin users'
            }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }
      }
    }

    if (!createdByUserId) {
      return new Response(
        JSON.stringify({ error: 'Unable to determine user for case creation' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Step 6: Create case
    const caseData: any = {
      case_number: caseNumber,
      title: `${candidate_name} - ${contract_type.replace(/_/g, ' ').toUpperCase()}`,
      description: `Background verification for ${candidate_name}`,
      priority: 'medium',
      source: isApiKeyAuth ? 'api' : 'manual',
      client_case_id: client_case_id,
      contract_type: contract_type,
      candidate_name: candidate_name,
      company_name: company_name || null,
      phone_primary: phone_primary,
      phone_secondary: phone_secondary || null,
      status: 'new',
      client_id: finalClientId,
      location_id: locationId,
      vendor_tat_start_date: vendor_tat_start_date,
      due_at: due_at,
      base_rate_inr: finalBaseRate,
      bonus_inr: finalBonus,
      penalty_inr: finalPenalty,
      total_payout_inr: finalTotalPayout,
      tat_hours: tat_hours,
      metadata: metadata,
      created_by: createdByUserId,
      last_updated_by: createdByUserId,
      status_updated_at: new Date().toISOString()
    }

    const { data: newCase, error: caseError } = await supabaseService
      .from('cases')
      .insert(caseData)
      .select(`
        id,
        case_number,
        client_case_id,
        status,
        contract_type,
        candidate_name,
        phone_primary,
        phone_secondary,
        created_at,
        clients (
          id,
          name,
          contact_person,
          email
        ),
        locations (
          id,
          address_line,
          city,
          state,
          pincode
        )
      `)
      .single()

    if (caseError || !newCase) {
      console.error('Case creation error:', caseError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create case', 
          details: caseError?.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        case: {
          id: newCase.id,
          case_number: newCase.case_number,
          client_case_id: newCase.client_case_id,
          status: newCase.status,
          contract_type: newCase.contract_type,
          candidate_name: newCase.candidate_name,
          phone_primary: newCase.phone_primary,
          phone_secondary: newCase.phone_secondary,
          created_at: newCase.created_at,
          client: newCase.clients,
          location: newCase.locations
        }
      }),
      { 
        status: 201, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error creating case:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

