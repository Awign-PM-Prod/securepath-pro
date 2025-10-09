import { supabase } from '@/integrations/supabase/client';

export interface PasswordSetupRequest {
  email: string;
  token: string;
  password: string;
}

export interface PasswordResetRequest {
  email: string;
}

export class GigWorkerAuthService {
  /**
   * Setup password for gig worker using token
   */
  async setupPassword(request: PasswordSetupRequest): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate the token
      const { data: tokenData, error: tokenError } = await supabase
        .rpc('validate_password_setup_token', {
          p_email: request.email,
          p_token: request.token
        });

      if (tokenError) throw tokenError;

      if (!tokenData || tokenData.length === 0 || !tokenData[0].is_valid) {
        return { success: false, error: 'Invalid or expired setup token' };
      }

      const tokenInfo = tokenData[0];

      // Update the user's password
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        tokenInfo.user_id,
        { password: request.password }
      );

      if (updateError) throw updateError;

      // Mark token as used
      const { error: markError } = await supabase
        .rpc('mark_setup_token_used', {
          p_email: request.email,
          p_token: request.token
        });

      if (markError) {
        console.warn('Could not mark token as used:', markError);
      }

      return { success: true };
    } catch (error) {
      console.error('Error setting up password:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to setup password' 
      };
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(request: PasswordResetRequest): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(request.email, {
        redirectTo: `${window.location.origin}/gig/reset-password`
      });

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error sending password reset:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send reset email' 
      };
    }
  }

  /**
   * Reset password using session tokens
   */
  async resetPassword(password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error resetting password:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to reset password' 
      };
    }
  }

  /**
   * Generate setup token for gig worker
   */
  async generateSetupToken(userId: string, email: string, createdBy: string): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
      const { data, error } = await supabase
        .rpc('generate_password_setup_token', {
          p_user_id: userId,
          p_email: email,
          p_created_by: createdBy
        });

      if (error) throw error;

      return { success: true, token: data };
    } catch (error) {
      console.error('Error generating setup token:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to generate setup token' 
      };
    }
  }

  /**
   * Send setup email to gig worker
   */
  async sendSetupEmail(email: string, token: string, firstName: string): Promise<{ success: boolean; error?: string }> {
    try {
      // This would integrate with your email service (SendGrid, AWS SES, etc.)
      // For now, we'll just log the email details
      console.log('Setup email details:', {
        to: email,
        subject: 'Welcome! Set up your password',
        body: `
          Hi ${firstName},
          
          Welcome to the Background Verification Platform!
          
          Your account has been created. Please set up your password using the following details:
          
          Setup Link: ${window.location.origin}/gig/setup
          Email: ${email}
          Setup Token: ${token}
          
          This token will expire in 24 hours.
          
          Best regards,
          The Team
        `
      });

      // TODO: Implement actual email sending
      // await emailService.send({
      //   to: email,
      //   subject: 'Welcome! Set up your password',
      //   template: 'gig-worker-setup',
      //   data: { firstName, token, setupUrl: `${window.location.origin}/gig/setup` }
      // });

      return { success: true };
    } catch (error) {
      console.error('Error sending setup email:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send setup email' 
      };
    }
  }
}

// Export singleton instance
export const gigWorkerAuthService = new GigWorkerAuthService();
