import { supabase } from '@/integrations/supabase/client';

export interface OTPResponse {
  success: boolean;
  message?: string;
  error?: string;
  expires_in_seconds?: number;
  user_id?: string;
}

export class OTPService {
  /**
   * Send OTP to phone number
   */
  async sendOTP(
    phoneNumber: string,
    purpose: 'login' | 'account_setup',
    email?: string,
    userId?: string
  ): Promise<OTPResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: {
          phone_number: phoneNumber,
          purpose,
          email,
          user_id: userId,
        },
      });

      if (error) throw error;

      return data as OTPResponse;
    } catch (error) {
      console.error('Error sending OTP:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send OTP',
      };
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOTP(
    phoneNumber: string,
    otpCode: string,
    purpose: 'login' | 'account_setup'
  ): Promise<OTPResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: {
          phone_number: phoneNumber,
          otp_code: otpCode,
          purpose,
        },
      });

      if (error) throw error;

      return data as OTPResponse;
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to verify OTP',
      };
    }
  }

  /**
   * Resend OTP
   */
  async resendOTP(
    phoneNumber: string,
    purpose: 'login' | 'account_setup',
    email?: string
  ): Promise<OTPResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('resend-otp', {
        body: {
          phone_number: phoneNumber,
          purpose,
          email,
        },
      });

      if (error) throw error;

      return data as OTPResponse;
    } catch (error) {
      console.error('Error resending OTP:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resend OTP',
      };
    }
  }
}

// Export singleton instance
export const otpService = new OTPService();