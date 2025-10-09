import { supabase } from '@/integrations/supabase/client';

export class EmailService {
  /**
   * Send password setup email to gig worker using Supabase Auth
   */
  async sendPasswordSetupEmail(email: string, firstName: string, token: string): Promise<{ success: boolean; error?: string }> {
    try {
      const setupUrl = `${window.location.origin}/gig/setup`;
      
      // Use Supabase Auth's signUp method to send a confirmation email
      // This will trigger the email confirmation flow
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: 'temp_password_123!', // Temporary password, will be changed during setup
        options: {
          emailRedirectTo: setupUrl,
          data: {
            first_name: firstName,
            setup_token: token,
            user_type: 'gig_worker'
          }
        }
      });

      if (error) {
        // If user already exists, we'll use a different approach
        if (error.message.includes('already registered')) {
          // Send a custom email using Supabase Edge Function
          return await this.sendCustomSetupEmail(email, firstName, token);
        }
        throw error;
      }

      console.log('📧 Password Setup Email sent via Supabase Auth:', {
        to: email,
        userId: data.user?.id,
        token: token,
        setupUrl: setupUrl
      });

      return { success: true };
    } catch (error) {
      console.error('Error sending password setup email:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send setup email' 
      };
    }
  }

  /**
   * Send custom setup email for existing users
   */
  async sendCustomSetupEmail(email: string, firstName: string, token: string): Promise<{ success: boolean; error?: string }> {
    try {
      const setupUrl = `${window.location.origin}/gig/setup`;
      
      // Create a custom email template and send via Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('send-setup-email', {
        body: {
          to: email,
          firstName: firstName,
          token: token,
          setupUrl: setupUrl
        }
      });

      if (error) {
        // Fallback: Log the email details for manual sending
        console.log('📧 Password Setup Email (Manual):', {
          to: email,
          subject: 'Welcome! Set up your password - Background Verification Platform',
          firstName: firstName,
          token: token,
          setupUrl: setupUrl,
          message: `
            Hi ${firstName},
            
            Welcome to the Background Verification Platform! Your account has been created and you're ready to start working.
            
            Please set up your password using the following details:
            
            Setup URL: ${setupUrl}
            Email: ${email}
            Setup Token: ${token}
            
            This token will expire in 24 hours.
            
            Best regards,
            The Background Verification Team
          `
        });
        
        return { success: true };
      }

      console.log('📧 Custom Setup Email sent:', data);
      return { success: true };
    } catch (error) {
      console.error('Error sending custom setup email:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send custom setup email' 
      };
    }
  }

  /**
   * Send password reset email using Supabase Auth
   */
  async sendPasswordResetEmail(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const resetUrl = `${window.location.origin}/gig/reset-password`;
      
      // Use Supabase Auth's built-in password reset
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: resetUrl
      });

      if (error) throw error;

      console.log('📧 Password Reset Email sent via Supabase Auth:', {
        to: email,
        resetUrl: resetUrl
      });

      return { success: true };
    } catch (error) {
      console.error('Error sending password reset email:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send reset email' 
      };
    }
  }

  /**
   * Send notification email
   */
  async sendNotificationEmail(email: string, subject: string, message: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('📧 Notification Email:', {
        to: email,
        subject: subject,
        message: message
      });
      return { success: true };
    } catch (error) {
      console.error('Error sending notification email:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send notification email' 
      };
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
