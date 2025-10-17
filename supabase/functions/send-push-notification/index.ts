import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PushNotificationRequest {
  gig_worker_id: string;
  notification: {
    title: string;
    body: string;
    data?: {
      caseId?: string;
      caseNumber?: string;
      clientName?: string;
      candidateName?: string;
      url?: string;
      type: 'case_allocated' | 'case_timeout' | 'qc_rework' | 'general';
    };
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { gig_worker_id, notification }: PushNotificationRequest = await req.json()

    if (!gig_worker_id || !notification) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get device tokens for the gig worker
    const { data: deviceTokens, error: tokensError } = await supabaseClient
      .from('device_tokens')
      .select('token, platform')
      .eq('gig_worker_id', gig_worker_id)
      .eq('is_active', true)

    if (tokensError) {
      console.error('Error fetching device tokens:', tokensError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch device tokens' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!deviceTokens || deviceTokens.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No active device tokens found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check notification preferences
    const { data: preferences } = await supabaseClient
      .from('notification_preferences')
      .select('*')
      .eq('gig_worker_id', gig_worker_id)
      .single()

    // Check if this type of notification is enabled
    const notificationType = notification.data?.type || 'general'
    const isEnabled = preferences ? preferences[notificationType] : true

    if (!isEnabled) {
      return new Response(
        JSON.stringify({ message: 'Notification type disabled by user' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Send push notifications to all active devices
    const results = await Promise.allSettled(
      deviceTokens.map(async (deviceToken) => {
        try {
          const subscription = JSON.parse(deviceToken.token)
          
          // Prepare notification payload
          const payload = {
            title: notification.title,
            body: notification.body,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: 'securepath-notification',
            requireInteraction: true,
            data: {
              ...notification.data,
              url: notification.data?.url || '/gig',
              timestamp: new Date().toISOString()
            },
            actions: [
              {
                action: 'view',
                title: 'View Details',
                icon: '/favicon.ico'
              }
            ]
          }

          // Add accept action for case_allocated notifications
          if (notificationType === 'case_allocated') {
            payload.actions.push({
              action: 'accept',
              title: 'Accept Case',
              icon: '/favicon.ico'
            })
          }

          // Send web push notification
          const response = await fetch(subscription.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `key=${Deno.env.get('FCM_SERVER_KEY')}`,
              'TTL': '86400' // 24 hours
            },
            body: JSON.stringify({
              ...subscription,
              payload: JSON.stringify(payload)
            })
          })

          if (!response.ok) {
            throw new Error(`Push notification failed: ${response.status} ${response.statusText}`)
          }

          return { success: true, platform: deviceToken.platform }
        } catch (error) {
          console.error(`Failed to send notification to ${deviceToken.platform}:`, error)
          return { success: false, platform: deviceToken.platform, error: error.message }
        }
      })
    )

    // Count successful and failed notifications
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length

    console.log(`Push notification results: ${successful} successful, ${failed} failed`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Notifications sent: ${successful} successful, ${failed} failed`,
        results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason })
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in send-push-notification function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
