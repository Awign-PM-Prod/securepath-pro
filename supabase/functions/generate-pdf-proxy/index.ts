import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// External PDF API configuration
const PDF_API_URL = 'https://stipkqfnfogxuegxgdba.supabase.co/functions/v1/generate-pdf'
const PDF_API_KEY = 'qcpk_a1dcaccc6ac0433bb353528b1f25f828'

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get CSV data from request body
    const csvData = await req.text()

    if (!csvData) {
      return new Response(
        JSON.stringify({ success: false, error: 'No CSV data provided' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Forward request to external PDF API
    const response = await fetch(PDF_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/csv',
        'x-api-key': PDF_API_KEY
      },
      body: csvData
    })

    // Parse response from external API
    const result = await response.json()

    // Return the result to client
    return new Response(
      JSON.stringify(result),
      { 
        status: response.status, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in generate-pdf-proxy:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})


