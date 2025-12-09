// =====================================================
// GET CASE DETAILS API ENDPOINT
// Fetches case details and responses via API key or JWT authentication
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

  // Only allow GET
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use GET.' }),
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
      if (!checkPermission(validation.permissions, 'read_cases')) {
        return new Response(
          JSON.stringify({ error: 'API key does not have permission to read cases' }),
          { 
            status: 403, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      clientId = validation.client_id || null
      permissions = validation.permissions
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

      if (!profile || !['super_admin', 'ops_team', 'client', 'vendor', 'gig_worker'].includes(profile.role)) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { 
            status: 403, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Missing authentication. Provide either x-api-key header or Authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get query parameters
    const url = new URL(req.url)
    const caseId = url.searchParams.get('case_id')
    const caseNumber = url.searchParams.get('case_number')

    if (!caseId && !caseNumber) {
      return new Response(
        JSON.stringify({ error: 'Missing parameter. Provide either case_id or case_number' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create service role client for database operations
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Fetch case details
    let caseQuery = supabaseService
      .from('cases')
      .select(`
        id,
        case_number,
        client_case_id,
        contract_type,
        candidate_name,
        company_name,
        phone_primary,
        phone_secondary,
        title,
        description,
        priority,
        status,
        vendor_tat_start_date,
        due_at,
        base_rate_inr,
        bonus_inr,
        penalty_inr,
        total_payout_inr,
        tat_hours,
        created_at,
        updated_at,
        status_updated_at,
        "QC_Response",
        clients (
          id,
          name,
          contact_person,
          phone,
          email
        ),
        locations (
          id,
          address_line,
          city,
          state,
          pincode,
          pincode_tier,
          lat,
          lng
        )
      `)

    if (caseId) {
      caseQuery = caseQuery.eq('id', caseId)
    } else {
      caseQuery = caseQuery.eq('case_number', caseNumber)
    }

    const { data: caseData, error: caseError } = await caseQuery.single()

    if (caseError || !caseData) {
      return new Response(
        JSON.stringify({ 
          error: 'Case not found',
          details: caseError?.message 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if API key client matches case client (for API key auth)
    if (authMethod === 'api_key' && clientId && caseData.clients?.id !== clientId) {
      return new Response(
        JSON.stringify({ error: 'Access denied. This case belongs to a different client.' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const caseIdValue = caseData.id

    // Step 2: Fetch form submissions (preferred)
    const { data: formSubmissions, error: formSubError } = await supabaseService
      .from('form_submissions')
      .select(`
        id,
        case_id,
        template_id,
        submission_data,
        status,
        submitted_at,
        created_at,
        updated_at,
        form_template:form_templates (
          id,
          template_name,
          template_version
        ),
        form_submission_files (
          id,
          field_id,
          file_url,
          file_name,
          file_size,
          mime_type,
          uploaded_at,
          form_field:form_fields (
            field_key,
            field_title,
            field_type
          )
        )
      `)
      .eq('case_id', caseIdValue)
      .order('created_at', { ascending: false })

    // Step 3: Fetch legacy submissions (if no form submissions)
    let legacySubmissions: any[] = []
    if (!formSubmissions || formSubmissions.length === 0) {
      const { data: legacyData, error: legacyError } = await supabaseService
        .from('submissions')
        .select(`
          id,
          case_id,
          submitted_at,
          status,
          answers,
          notes,
          submission_lat,
          submission_lng,
          submission_address,
          location_verified,
          created_at
        `)
        .eq('case_id', caseIdValue)
        .order('submitted_at', { ascending: false })

      if (!legacyError && legacyData) {
        legacySubmissions = legacyData
      }
    }

    // Step 4: Fetch QC reviews
    const { data: qcReviews, error: qcError } = await supabaseService
      .from('qc_reviews')
      .select(`
        id,
        case_id,
        result,
        comments,
        issues_found,
        rework_instructions,
        rework_deadline,
        reviewed_at,
        created_at
      `)
      .eq('case_id', caseIdValue)
      .order('reviewed_at', { ascending: false })

    // Step 5: Get assignment information
    const { data: allocationLogs } = await supabaseService
      .from('allocation_logs')
      .select('allocated_at, accepted_at, decision')
      .eq('case_id', caseIdValue)
      .in('decision', ['allocated', 'accepted'])
      .order('allocated_at', { ascending: false })
      .limit(1)

    const assignedAt = allocationLogs && allocationLogs.length > 0
      ? (allocationLogs[0].accepted_at || allocationLogs[0].allocated_at)
      : null

    // Step 6: Get submission timestamp
    let submittedAt = null
    if (formSubmissions && formSubmissions.length > 0) {
      submittedAt = formSubmissions[0].updated_at || formSubmissions[0].submitted_at
    } else if (legacySubmissions.length > 0) {
      submittedAt = legacySubmissions[0].submitted_at
    }

    // Step 7: Extract metadata
    const metadata = caseData.metadata || {}
    const instructions = metadata.instructions || ''

    // Step 8: Build response
    const response = {
      success: true,
      case: {
        id: caseData.id,
        case_number: caseData.case_number,
        client_case_id: caseData.client_case_id,
        contract_type: caseData.contract_type,
        candidate_name: caseData.candidate_name,
        company_name: caseData.company_name,
        phone_primary: caseData.phone_primary,
        phone_secondary: caseData.phone_secondary,
        title: caseData.title,
        description: caseData.description,
        priority: caseData.priority,
        status: caseData.status,
        vendor_tat_start_date: caseData.vendor_tat_start_date,
        due_at: caseData.due_at,
        tat_hours: caseData.tat_hours,
        instructions: instructions,
        pricing: {
          base_rate_inr: caseData.base_rate_inr,
          bonus_inr: caseData.bonus_inr || 0,
          penalty_inr: caseData.penalty_inr || 0,
          total_payout_inr: caseData.total_payout_inr
        },
        timeline: {
          created_at: caseData.created_at,
          assigned_at: assignedAt,
          submitted_at: submittedAt,
          status_updated_at: caseData.status_updated_at,
          updated_at: caseData.updated_at
        },
        qc_response: caseData.QC_Response,
        client: caseData.clients,
        location: caseData.locations
      },
      form_submissions: formSubmissions && formSubmissions.length > 0
        ? formSubmissions.map((sub: any) => ({
            id: sub.id,
            template_name: sub.form_template?.template_name,
            template_version: sub.form_template?.template_version,
            submission_data: sub.submission_data,
            status: sub.status,
            submitted_at: sub.submitted_at,
            created_at: sub.created_at,
            updated_at: sub.updated_at,
            files: sub.form_submission_files?.map((file: any) => ({
              id: file.id,
              field_key: file.form_field?.field_key,
              field_title: file.form_field?.field_title,
              field_type: file.form_field?.field_type,
              file_url: file.file_url,
              file_name: file.file_name,
              file_size: file.file_size,
              mime_type: file.mime_type,
              uploaded_at: file.uploaded_at
            })) || []
          }))
        : [],
      legacy_submissions: legacySubmissions.map((sub: any) => ({
        id: sub.id,
        submitted_at: sub.submitted_at,
        status: sub.status,
        answers: sub.answers,
        notes: sub.notes,
        location: {
          lat: sub.submission_lat,
          lng: sub.submission_lng,
          address: sub.submission_address,
          verified: sub.location_verified
        },
        created_at: sub.created_at
      })),
      qc_reviews: qcReviews && qcReviews.length > 0
        ? qcReviews.map((review: any) => ({
            id: review.id,
            result: review.result,
            comments: review.comments,
            issues_found: review.issues_found,
            rework_instructions: review.rework_instructions,
            rework_deadline: review.rework_deadline,
            reviewed_at: review.reviewed_at,
            created_at: review.created_at
          }))
        : []
    }

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error fetching case details:', error)
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

