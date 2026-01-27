import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AwignLeadCompletionRequest {
  caseId: string;
  clientCaseId: string;
  contractType: string;
  isPositive: boolean;
  allocatedAt: string;
  submittedAt: string;
  reportUrl: string;
  qcComments?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: AwignLeadCompletionRequest = await req.json();
    const { 
      caseId, 
      clientCaseId, 
      contractType, 
      isPositive, 
      allocatedAt, 
      submittedAt, 
      reportUrl,
      qcComments 
    } = body;

    if (!caseId || !clientCaseId || !reportUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'caseId, clientCaseId, and reportUrl are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get API credentials from environment variables
    const accessToken = Deno.env.get('AWIGN_ACCESS_TOKEN');
    const client = Deno.env.get('AWIGN_CLIENT');
    const uid = Deno.env.get('AWIGN_UID');
    const callerId = Deno.env.get('AWIGN_CALLER_ID');
    const executionId = Deno.env.get('AWIGN_EXECUTION_ID');
    const screenId = Deno.env.get('AWIGN_SCREEN_ID');

    if (!accessToken || !client || !uid || !callerId || !executionId || !screenId) {
      console.error('Missing AWIGN API credentials. Required:', {
        hasAccessToken: !!accessToken,
        hasClient: !!client,
        hasUid: !!uid,
        hasCallerId: !!callerId,
        hasExecutionId: !!executionId,
        hasScreenId: !!screenId,
      });
      return new Response(
        JSON.stringify({ success: false, error: 'AWIGN API credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Map contract_type to verification_type
    const contractTypeLower = (contractType || '').toLowerCase();
    let verificationType: string;
    if (contractTypeLower.includes('business')) {
      verificationType = 'Business';
    } else if (contractTypeLower.includes('residence') || contractTypeLower.includes('residential')) {
      verificationType = 'Residence/Office';
    } else if (contractTypeLower.includes('office')) {
      verificationType = 'Residence/Office';
    } else {
      // Default fallback
      verificationType = 'Residence/Office';
    }

    // Map is_positive to case_status
    const caseStatus = isPositive ? 'Positive' : 'Negative';

    // Use QC comments if available, otherwise default message
    const comments = qcComments || 'Completed the verification';

    // Construct the API URL - different endpoint structure for completion
    const apiUrl = `https://ih-oms-api.awign.com/office/api/v1/executions/${executionId}/screens/${screenId}/leads/${clientCaseId}`;

    // Build payload according to AWIGN API specification
    const payload = {
      lead: {
        case_id: clientCaseId,
        file_no: clientCaseId,
        case_status: caseStatus,
        verification_type: verificationType,
        date_time_of_allocation: allocatedAt,
        date_time_of_report: submittedAt,
        comments: comments,
        report_link: reportUrl
      }
    };

    console.log('Calling AWIGN API for lead completion:', {
      url: apiUrl,
      caseId,
      clientCaseId,
      caseStatus,
      verificationType,
      reportUrl,
    });

    // Make the API call
    const response = await fetch(apiUrl, {
      method: 'PATCH',
      headers: {
        'access-token': accessToken,
        'client': client,
        'uid': uid,
        'caller_id': callerId,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AWIGN API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        url: apiUrl,
        payload: JSON.stringify(payload),
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

    console.log('AWIGN API success:', {
      caseId,
      clientCaseId,
      caseStatus,
      verificationType,
      responseStatus: response.status,
    });

    return new Response(
      JSON.stringify({ success: true, result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error updating AWIGN lead completion:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});




