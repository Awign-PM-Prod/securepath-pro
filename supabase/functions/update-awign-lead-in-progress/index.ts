import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AwignInProgressRequest {
  caseId: string;
  clientCaseId: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: AwignInProgressRequest = await req.json();
    const { caseId, clientCaseId } = body;

    if (!caseId || !clientCaseId) {
      return new Response(
        JSON.stringify({ success: false, error: 'caseId and clientCaseId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get API credentials from environment variables
    const accessToken = Deno.env.get('AWIGN_ACCESS_TOKEN');
    const client = Deno.env.get('AWIGN_CLIENT');
    const uid = Deno.env.get('AWIGN_UID');
    const callerId = Deno.env.get('AWIGN_CALLER_ID');
    const executionId = Deno.env.get('AWIGN_EXECUTION_ID');
    const projectRoleId = Deno.env.get('AWIGN_PROJECT_ROLE_ID');
    const screenId = Deno.env.get('AWIGN_SCREEN_ID');

    if (!accessToken || !client || !uid || !callerId || !executionId || !projectRoleId || !screenId) {
      console.error('Missing AWIGN API credentials. Required:', {
        hasAccessToken: !!accessToken,
        hasClient: !!client,
        hasUid: !!uid,
        hasCallerId: !!callerId,
        hasExecutionId: !!executionId,
        hasProjectRoleId: !!projectRoleId,
        hasScreenId: !!screenId,
      });
      return new Response(
        JSON.stringify({ success: false, error: 'AWIGN API credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Construct the API URL - replace :lead_id with clientCaseId
    // URL format: /workforce/executions/{executionId}/project_roles/{projectRoleId}/screens/{screenId}/leads/{lead_id}/status
    const apiUrl = `https://ih-oms-api.awign.com/office/api/v1/workforce/executions/${executionId}/project_roles/${projectRoleId}/screens/${screenId}/leads/${clientCaseId}/status`;

    console.log('Calling AWIGN API for in_progress status:', {
      url: apiUrl,
      caseId,
      clientCaseId,
    });

    // Make the API call - exact match to the provided curl request
    const response = await fetch(apiUrl, {
      method: 'PATCH',
      headers: {
        'access-token': accessToken,
        'client': client,
        'uid': uid,
        'caller_id': callerId,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        lead: {
          _status: 'in_progress'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AWIGN API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        url: apiUrl,
      });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `AWIGN API error: ${response.status} ${response.statusText}`,
          details: errorText
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json().catch(() => ({}));

    console.log('AWIGN API success (in_progress):', {
      caseId,
      clientCaseId,
      responseStatus: response.status,
    });

    return new Response(
      JSON.stringify({ success: true, result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error updating AWIGN lead status to in_progress:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});



