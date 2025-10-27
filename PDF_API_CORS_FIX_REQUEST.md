# CORS Configuration Fix Request for PDF API

## Issue
When calling the PDF API from a web browser, we're getting a CORS error:
```
Access to fetch at 'https://stipkqfnfogxuegxgdba.supabase.co/functions/v1/generate-pdf' 
from origin 'http://localhost:8080' has been blocked by CORS policy: 
Request header field x-api-key is not allowed by Access-Control-Allow-Headers 
in preflight response.
```

## What This Means
The browser is blocking the request because the API server isn't configured to allow the custom header `x-api-key`.

## What Needs to be Fixed
The PDF API server needs to be updated to allow these headers in its CORS configuration.

## Solution for Supabase Edge Functions

If your PDF API is a Supabase Edge Function, update it with these CORS headers:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Add x-api-key to allowed headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',  // or specify your domain: 'https://yourdomain.com'
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // IMPORTANT: Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Your existing code here
    
    // Verify the API key
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey || apiKey !== 'qcpk_a1dcaccc6ac0433bb353528b1f25f828') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid or inactive API key',
          code: 'INVALID_API_KEY'
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Rest of your existing code...
    
    // Make sure to include corsHeaders in all responses
    return new Response(
      JSON.stringify({ 
        success: true, 
        pdf_url: pdfUrl,
        lead_id: leadId,
        generated_at: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    // Error handling with CORS headers
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
```

## Key Changes Needed

1. **Add `x-api-key` to CORS headers:**
   ```typescript
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key'
   ```

2. **Handle OPTIONS preflight request:**
   ```typescript
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders })
   }
   ```

3. **Include CORS headers in ALL responses:**
   - Success responses: `{ ...corsHeaders, 'Content-Type': 'application/json' }`
   - Error responses: `{ ...corsHeaders, 'Content-Type': 'application/json' }`

## Alternative: Specify Allowed Origins

Instead of `'Access-Control-Allow-Origin': '*'`, you can restrict to specific domains:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://your-production-domain.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
```

For multiple origins, you might need to check the origin header:

```typescript
const allowedOrigins = [
  'https://yourdomain.com',
  'https://app.yourdomain.com',
  'http://localhost:8080',  // for development
]

const origin = req.headers.get('origin')
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigins.includes(origin || '') ? origin : '',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
```

## Current API Information

- **API URL**: `https://stipkqfnfogxuegxgdba.supabase.co/functions/v1/generate-pdf`
- **API Key**: `qcpk_a1dcaccc6ac0433bb353528b1f25f828`
- **Expected Headers**: 
  - `Content-Type: text/csv`
  - `x-api-key: qcpk_a1dcaccc6ac0433bb353528b1f25f828`

## Testing After Fix

Once CORS is fixed, you can test with this curl command (no CORS in command line):

```bash
curl -X POST "https://stipkqfnfogxuegxgdba.supabase.co/functions/v1/generate-pdf" \
  -H "Content-Type: text/csv" \
  -H "x-api-key: qcpk_a1dcaccc6ac0433bb353528b1f25f828" \
  --data-binary @- << 'EOF'
Name,Email,Phone
John Doe,john@example.com,1234567890
EOF
```

If this works but browser requests don't, it confirms CORS is the issue.

## Contact

If you control this API, please apply these changes and let us know when it's deployed.
If you don't control the API, please forward this document to the API owner.


