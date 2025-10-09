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
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { to, firstName, token, setupUrl } = await req.json()

    if (!to || !firstName || !token || !setupUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create email content
    const emailContent = {
      to: to,
      subject: 'Welcome! Set up your password - Background Verification Platform',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Background Verification Platform</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .token-box { background: #e8f2ff; border: 2px solid #667eea; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center; }
            .token { font-family: monospace; font-size: 18px; font-weight: bold; color: #667eea; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Background Verification Platform!</h1>
              <p>Your account has been created successfully</p>
            </div>
            <div class="content">
              <h2>Hi ${firstName},</h2>
              <p>Welcome to the Background Verification Platform! Your account has been created and you're ready to start working.</p>
              
              <h3>Next Steps:</h3>
              <ol>
                <li>Click the button below to set up your password</li>
                <li>Use the setup token provided below</li>
                <li>Create a secure password for your account</li>
                <li>Start accepting and completing verification cases</li>
              </ol>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${setupUrl}" class="button">Set Up My Password</a>
              </div>
              
              <div class="token-box">
                <p><strong>Setup Token:</strong></p>
                <div class="token">${token}</div>
                <p><small>This token will expire in 24 hours</small></p>
              </div>
              
              <h3>Important Information:</h3>
              <ul>
                <li><strong>Setup URL:</strong> ${setupUrl}</li>
                <li><strong>Email:</strong> ${to}</li>
                <li><strong>Token Expires:</strong> 24 hours from now</li>
              </ul>
              
              <p>If you have any questions or need assistance, please contact your team lead or support team.</p>
              
              <p>Best regards,<br>The Background Verification Team</p>
            </div>
            <div class="footer">
              <p>This email was sent to ${to}. If you didn't expect this email, please ignore it.</p>
              <p>&copy; 2024 Background Verification Platform. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Welcome to Background Verification Platform!
        
        Hi ${firstName},
        
        Your account has been created successfully. Please set up your password using the following details:
        
        Setup URL: ${setupUrl}
        Email: ${to}
        Setup Token: ${token}
        
        This token will expire in 24 hours.
        
        Best regards,
        The Background Verification Team
      `
    }

    // For now, we'll just log the email content
    // In production, you would integrate with an email service like SendGrid, AWS SES, etc.
    console.log('📧 Setup Email Content:', emailContent)

    // TODO: Implement actual email sending
    // This could be done via:
    // 1. SendGrid API
    // 2. AWS SES API
    // 3. Nodemailer with SMTP
    // 4. Other email service providers

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email content generated successfully',
        emailContent: emailContent
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in send-setup-email function:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
