import { supabase } from '@/integrations/supabase/client';

export interface NotificationData {
  title: string;
  body: string;
  type: 'case_allocated' | 'case_timeout' | 'case_accepted' | 'case_rejected' | 'case_submitted';
  caseId?: string | undefined;
  gigWorkerId?: string;
  metadata?: Record<string, any>;
}

export class NotificationService {
  /**
   * Send notification to gig worker
   */
  async sendNotification(data: NotificationData): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: insertedData, error } = await supabase
        .from('notifications')
        .insert({
          recipient_type: 'gig_partner',
          recipient_id: data.gigWorkerId,
          recipient_contact: '', // Will be populated by trigger
          subject: data.title,
          body: data.body,
          variables: data.metadata || {},
          channel: 'push',
          priority: 'medium',
          status: 'pending',
          case_id: data.caseId || null, // Allow null for test notifications
          related_entity_type: data.caseId ? 'case' : null,
          related_entity_id: data.caseId || null,
          created_at: new Date().toISOString()
        })
        .select();

      if (error) {
        console.error('Error inserting notification:', error);
        throw error;
      }

      return { success: true };
    } catch (error) {
      console.error('Error sending notification:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Send case allocation notification
   */
  async sendCaseAllocationNotification(caseId: string, gigWorkerId: string, caseNumber: string): Promise<void> {
    await this.sendNotification({
      title: 'New Case Allocated',
      body: `You have been allocated case ${caseNumber}. Please accept or reject within 1 hour.`,
      type: 'case_allocated',
      caseId,
      gigWorkerId,
      metadata: {
        case_number: caseNumber,
        action_required: 'accept_or_reject',
        deadline_minutes: 60
      }
    });
  }

  /**
   * Send case timeout notification
   */
  async sendCaseTimeoutNotification(caseId: string, gigWorkerId: string, caseNumber: string): Promise<void> {
    await this.sendNotification({
      title: 'Case Timeout',
      body: `Case ${caseNumber} was not accepted within 1 hour and has been reassigned.`,
      type: 'case_timeout',
      caseId,
      gigWorkerId,
      metadata: {
        case_number: caseNumber,
        reason: 'timeout'
      }
    });
  }

  /**
   * Send case acceptance notification
   */
  async sendCaseAcceptanceNotification(caseId: string, gigWorkerId: string, caseNumber: string): Promise<void> {
    await this.sendNotification({
      title: 'Case Accepted',
      body: `You have accepted case ${caseNumber}. You can now start working on it.`,
      type: 'case_accepted',
      caseId,
      gigWorkerId,
      metadata: {
        case_number: caseNumber,
        action_required: 'submit_case'
      }
    });
  }

  /**
   * Send case rejection notification
   */
  async sendCaseRejectionNotification(caseId: string, gigWorkerId: string, caseNumber: string, reason: string): Promise<void> {
    await this.sendNotification({
      title: 'Case Rejected',
      body: `Case ${caseNumber} has been rejected. Reason: ${reason}`,
      type: 'case_rejected',
      caseId,
      gigWorkerId,
      metadata: {
        case_number: caseNumber,
        rejection_reason: reason
      }
    });
  }

  /**
   * Send case submission notification
   */
  async sendCaseSubmissionNotification(caseId: string, gigWorkerId: string, caseNumber: string): Promise<void> {
    await this.sendNotification({
      title: 'Case Submitted',
      body: `Case ${caseNumber} has been submitted successfully. Thank you for your work!`,
      type: 'case_submitted',
      caseId,
      gigWorkerId,
      metadata: {
        case_number: caseNumber,
        status: 'submitted'
      }
    });
  }

  /**
   * Get notifications for a gig worker
   */
  async getNotifications(gigWorkerId: string, limit: number = 50): Promise<{ success: boolean; notifications?: any[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', gigWorkerId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      return { success: true, notifications: data };
    } catch (error) {
      console.error('Error getting notifications:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          status: 'delivered',
          delivered_at: new Date().toISOString()
        })
        .eq('id', notificationId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();