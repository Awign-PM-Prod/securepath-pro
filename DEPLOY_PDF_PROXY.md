# Deploy PDF Proxy Edge Function

## Problem
The external PDF API has CORS restrictions that prevent direct browser access. The error:
```
Request header field x-api-key is not allowed by Access-Control-Allow-Headers in preflight response
```

This happens because the PDF API server doesn't allow the `x-api-key` custom header from browsers.

## Solution
Create a Supabase Edge Function that acts as a proxy. The browser requests our proxy (no CORS), and the proxy forwards to the external API (server-to-server, no CORS).

## Steps to Deploy

### 1. Install Supabase CLI (if not installed)
```bash
npm install -g supabase
```

### 2. Login to Supabase
```bash
supabase login
```

### 3. Link Your Project (one-time setup)
```bash
cd D:\Awigna\Projects\BGV\securepath-pro
supabase link --project-ref your-project-ref
```
(Get your project ref from Supabase dashboard URL)

### 4. Deploy the Edge Function
```bash
npx supabase functions deploy generate-pdf-proxy
```

### 5. Verify Deployment
- Go to your Supabase Dashboard → Edge Functions
- You should see `generate-pdf-proxy` listed
- Test the endpoint if needed

## What This Does

1. **Browser** → Makes request to `YOUR_SUPABASE_URL/functions/v1/generate-pdf-proxy`
2. **Edge Function** → Forwards request to external PDF API with headers
3. **PDF API** → Returns PDF URL
4. **Edge Function** → Returns PDF URL to browser
5. **Browser** → Opens PDF in new tab

## Files Created

- `supabase/functions/generate-pdf-proxy/index.ts` - The edge function proxy
- Code in `CaseDetail.tsx` - Updated to use the proxy endpoint

## Testing

After deployment, test the "USE API PDF" button in:
`/ops/cases/[caseId]` → Dynamic Forms tab

The button should now work without CORS errors!


