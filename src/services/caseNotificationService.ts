import { notificationService, PushNotificationData } from './notificationService';
import { supabase } from '@/integrations/supabase/client';

export interface CaseAllocationData {
  caseId: string;
  caseNumber: string;
  clientName: string;
  candidateName: string;
  location: string;
  dueAt: string;
  gigWorkerId: string;
}

class CaseNotificationService {
  async sendCaseAllocatedNotification(data: CaseAllocationData): Promise<boolean> {
    const notification: PushNotificationData = {
      title: 'New Case Allocated',
      body: `Case #${data.caseNumber} - ${data.clientName} - ${data.candidateName}`,
      data: {
        caseId: data.caseId,
        caseNumber: data.caseNumber,
        clientName: data.clientName,
        candidateName: data.candidateName,
        url: '/gig',
        type: 'case_allocated'
      }
    };

    return await notificationService.sendPushNotification(data.gigWorkerId, notification);
  }

  async sendCaseTimeoutNotification(data: CaseAllocationData): Promise<boolean> {
    const notification: PushNotificationData = {
      title: 'Case Timeout Warning',
      body: `Case #${data.caseNumber} will expire soon - ${data.candidateName}`,
      data: {
        caseId: data.caseId,
        caseNumber: data.caseNumber,
        clientName: data.clientName,
        candidateName: data.candidateName,
        url: '/gig',
        type: 'case_timeout'
      }
    };

    return await notificationService.sendPushNotification(data.gigWorkerId, notification);
  }

  async sendQcReworkNotification(data: CaseAllocationData & { qcIssues: string[] }): Promise<boolean> {
    const notification: PushNotificationData = {
      title: 'QC Rework Required',
      body: `Case #${data.caseNumber} needs rework - ${data.candidateName}`,
      data: {
        caseId: data.caseId,
        caseNumber: data.caseNumber,
        clientName: data.clientName,
        candidateName: data.candidateName,
        url: '/gig',
        type: 'qc_rework'
      }
    };

    return await notificationService.sendPushNotification(data.gigWorkerId, notification);
  }

  async sendGeneralNotification(gigWorkerId: string, title: string, body: string): Promise<boolean> {
    const notification: PushNotificationData = {
      title,
      body,
      data: {
        url: '/gig',
        type: 'general'
      }
    };

    return await notificationService.sendPushNotification(gigWorkerId, notification);
  }

  // Helper function to get case allocation data
  async getCaseAllocationData(caseId: string): Promise<CaseAllocationData | null> {
    try {
      const { data, error } = await supabase
        .from('cases')
        .select(`
          id,
          case_number,
          candidate_name,
          due_at,
          current_assignee_id,
          clients (name),
          locations (city, state, pincode)
        `)
        .eq('id', caseId)
        .single();

      if (error || !data) {
        console.error('Error fetching case data:', error);
        return null;
      }

      return {
        caseId: data.id,
        caseNumber: data.case_number,
        clientName: data.clients?.name || 'Unknown Client',
        candidateName: data.candidate_name,
        location: `${data.locations?.city || 'Unknown'}, ${data.locations?.state || ''} - ${data.locations?.pincode || ''}`,
        dueAt: data.due_at,
        gigWorkerId: data.current_assignee_id
      };
    } catch (error) {
      console.error('Error getting case allocation data:', error);
      return null;
    }
  }
}

export const caseNotificationService = new CaseNotificationService();
