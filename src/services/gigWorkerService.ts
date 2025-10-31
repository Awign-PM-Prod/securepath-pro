import { supabase } from '@/integrations/supabase/client';
import { notificationService } from './notificationService';

export interface CaseAcceptanceRequest {
  caseId: string;
  gigWorkerId: string;
}

export interface CaseRejectionRequest {
  caseId: string;
  gigWorkerId: string;
  reason: string;
}

export interface CaseSubmissionRequest {
  caseId: string;
  gigWorkerId: string;
  answers?: Record<string, any>; // Legacy field
  notes?: string;
  photos?: string[]; // Legacy field
  submissionLat?: number;
  submissionLng?: number;
  submissionAddress?: string;
  formData?: Record<string, any>; // New dynamic form data
}

export interface CaseDraftRequest {
  caseId: string;
  gigWorkerId: string;
  formData: Record<string, any>;
}

export class GigWorkerService {
  /**
   * Determine FI Type based on contract type
   */
  private determineFiType(contractType: string): 'business' | 'residence' | 'office' {
    const contractTypeLower = contractType.toLowerCase();
    
    if (contractTypeLower.includes('business') || contractTypeLower.includes('verification')) {
      return 'business';
    } else if (contractTypeLower.includes('residence') || contractTypeLower.includes('residential')) {
      return 'residence';
    } else if (contractTypeLower.includes('office')) {
      return 'office';
    }
    
    // Default to business for unknown contract types
    return 'business';
  }

  /**
   * Debug gig worker vendor association
   */
  async debugGigWorkerVendorAssociation(gigWorkerId: string): Promise<void> {
    try {
      console.log('=== DEBUG GIG WORKER VENDOR ASSOCIATION ===');
      console.log('Gig Worker ID:', gigWorkerId);

      // Get full gig worker data
      const { data: gigWorkerData, error: gigWorkerError } = await supabase
        .from('gig_partners')
        .select(`
          id,
          user_id,
          vendor_id,
          is_direct_gig,
          profiles!inner(
            first_name,
            last_name,
            email
          )
        `)
        .eq('id', gigWorkerId)
        .single();

      console.log('Full gig worker data:', gigWorkerData);
      console.log('Gig worker query error:', gigWorkerError);

      if (gigWorkerData && gigWorkerData.vendor_id) {
        // Get vendor data
        const { data: vendorData, error: vendorError } = await supabase
          .from('vendors')
          .select('id, name, email')
          .eq('id', gigWorkerData.vendor_id)
          .single();

        console.log('Associated vendor data:', vendorData);
        console.log('Vendor query error:', vendorError);
      }

      console.log('=== END DEBUG ===');
    } catch (error) {
      console.error('Error debugging gig worker vendor association:', error);
    }
  }

  /**
   * Accept a case
   */
  async acceptCase(request: CaseAcceptanceRequest): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('=== GIG WORKER ACCEPT CASE DEBUG ===');
      console.log('Request:', request);

      // Debug gig worker vendor association
      await this.debugGigWorkerVendorAssociation(request.gigWorkerId);

      // First, get the gig worker's vendor_id
      const { data: gigWorkerData, error: gigWorkerError } = await supabase
        .from('gig_partners')
        .select('vendor_id, is_direct_gig, id, user_id')
        .eq('id', request.gigWorkerId)
        .single();

      console.log('Gig worker data query result:', gigWorkerData);
      console.log('Gig worker data query error:', gigWorkerError);

      if (gigWorkerError) {
        console.error('Error fetching gig worker vendor info:', gigWorkerError);
        throw gigWorkerError;
      }

      if (!gigWorkerData) {
        console.error('No gig worker data found for ID:', request.gigWorkerId);
        throw new Error('Gig worker not found');
      }

      // Prepare case update data
      const caseUpdateData: any = {
        status: 'accepted',
        status_updated_at: new Date().toISOString()
      };

      console.log('Gig worker vendor info:', {
        id: gigWorkerData.id,
        vendor_id: gigWorkerData.vendor_id,
        is_direct_gig: gigWorkerData.is_direct_gig
      });

      // If gig worker is associated with a vendor (has vendor_id), set current_vendor_id
      // Note: We check for vendor_id regardless of is_direct_gig flag
      if (gigWorkerData && gigWorkerData.vendor_id) {
        caseUpdateData.current_vendor_id = gigWorkerData.vendor_id;
        console.log(`✅ Setting current_vendor_id to ${gigWorkerData.vendor_id} for gig worker ${request.gigWorkerId} (is_direct_gig: ${gigWorkerData.is_direct_gig})`);
      } else {
        console.log(`❌ Gig worker ${request.gigWorkerId} has no vendor association:`, {
          has_vendor_id: !!gigWorkerData.vendor_id,
          is_direct_gig: gigWorkerData.is_direct_gig,
          vendor_id_value: gigWorkerData.vendor_id
        });
      }

      console.log('Case update data:', caseUpdateData);

      // Update case status and vendor assignment
      const { error: acceptCaseError } = await supabase
        .from('cases')
        .update(caseUpdateData)
        .eq('id', request.caseId);

      console.log('Case update error:', acceptCaseError);

      if (acceptCaseError) {
        console.error('Error updating case:', acceptCaseError);
        throw acceptCaseError;
      }

      console.log('✅ Case updated successfully with data:', caseUpdateData);

      // Verify the case was updated correctly
      const { data: updatedCase, error: verifyError } = await supabase
        .from('cases')
        .select('id, case_number, status, current_vendor_id, current_assignee_id, current_assignee_type')
        .eq('id', request.caseId)
        .single();

      console.log('Case verification after update:', updatedCase);
      console.log('Case verification error:', verifyError);

      // Update allocation log
      const { error: logError } = await supabase
        .from('allocation_logs')
        .update({
          decision: 'accepted',
          decision_at: new Date().toISOString(),
          accepted_at: new Date().toISOString()
        })
        .eq('case_id', request.caseId)
        .eq('candidate_id', request.gigWorkerId)
        .eq('decision', 'allocated');

      if (logError) throw logError;

      // Send notification
      const { data: acceptCaseInfo } = await supabase
        .from('cases')
        .select('case_number')
        .eq('id', request.caseId)
        .single();

      if (acceptCaseInfo) {
        await notificationService.sendCaseAcceptanceNotification(
          request.caseId,
          request.gigWorkerId,
          acceptCaseInfo.case_number
        );
      }

      return { success: true };
    } catch (error) {
      console.error('Error accepting case:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Reject a case
   */
  async rejectCase(request: CaseRejectionRequest): Promise<{ success: boolean; error?: string }> {
    try {
      // Update case status
      const { error: rejectCaseError } = await supabase
        .from('cases')
        .update({
          status: 'pending_allocation',
          current_assignee_id: null,
          current_assignee_type: null,
          status_updated_at: new Date().toISOString()
        })
        .eq('id', request.caseId);

      if (rejectCaseError) throw rejectCaseError;

      // Update allocation log
      const { error: logError } = await supabase
        .from('allocation_logs')
        .update({
          decision: 'rejected',
          decision_at: new Date().toISOString(),
          reallocation_reason: request.reason
        })
        .eq('case_id', request.caseId)
        .eq('candidate_id', request.gigWorkerId)
        .eq('decision', 'allocated');

      if (logError) throw logError;

      // Free up capacity
      const { error: capacityError } = await supabase
        .rpc('free_capacity', {
          p_case_id: request.caseId,
          p_gig_partner_id: request.gigWorkerId,
          p_reason: 'Rejected by gig worker'
        });

      if (capacityError) {
        console.warn('Could not free capacity:', capacityError);
      }

      // Send notification
      const { data: rejectCaseInfo } = await supabase
        .from('cases')
        .select('case_number')
        .eq('id', request.caseId)
        .single();

      if (rejectCaseInfo) {
        await notificationService.sendCaseRejectionNotification(
          request.caseId,
          request.gigWorkerId,
          rejectCaseInfo.case_number,
          request.reason
        );
      }

      return { success: true };
    } catch (error) {
      console.error('Error rejecting case:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Submit a case
   */
  async submitCase(request: CaseSubmissionRequest): Promise<{ success: boolean; error?: string; submissionId?: string }> {
    try {
      // Get case details to determine contract type
      const { data: submitCaseData, error: submitCaseError } = await supabase
        .from('cases')
        .select(`
          id,
          client_id,
          contract_type
        `)
        .eq('id', request.caseId)
        .single();

      if (submitCaseError) throw submitCaseError;

      // Get contract type ID
      const { data: contractType, error: contractTypeError } = await supabase
        .from('contract_type_config')
        .select('id')
        .eq('type_key', submitCaseData.contract_type)
        .single();

      if (contractTypeError) throw contractTypeError;

      // Check if there's a form template for this contract type
      const { data: formTemplate, error: templateError } = await supabase
        .from('form_templates')
        .select('id')
        .eq('contract_type_id', contractType.id)
        .eq('is_active', true)
        .maybeSingle();

      if (templateError && templateError.code !== 'PGRST116') {
        throw templateError;
      }

      let submissionId: string;

      if (formTemplate) {
        // Use dynamic form submission
        const { formService } = await import('./formService');
        const formResult = await formService.submitForm(
          request.caseId,
          formTemplate.id,
          request.gigWorkerId,
          request.formData || {}
        );

        if (!formResult.success) {
          throw new Error(formResult.error || 'Failed to submit form');
        }

        submissionId = formResult.submissionId!;
      } else {
        // Fallback to legacy submission
        const { data: submission, error: submissionError } = await supabase
          .from('submissions')
          .insert({
            case_id: request.caseId,
            gig_partner_id: request.gigWorkerId,
            status: 'submitted',
            answers: request.answers,
            notes: request.notes,
            submission_lat: request.submissionLat,
            submission_lng: request.submissionLng,
            submission_address: request.submissionAddress,
            submitted_at: new Date().toISOString()
          })
          .select()
          .single();

        if (submissionError) throw submissionError;
        submissionId = submission.id;
      }

      // Update case status
      const { error: updateCaseError } = await supabase
        .from('cases')
        .update({
          status: 'submitted',
          status_updated_at: new Date().toISOString()
        })
        .eq('id', request.caseId);

      if (updateCaseError) throw updateCaseError;

      // Handle photos if any
      if (request.photos && request.photos.length > 0) {
        const photoInserts = request.photos.map(photoUrl => ({
          submission_id: submissionId,
          photo_url: photoUrl,
          file_name: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`,
          mime_type: 'image/jpeg',
          taken_at: new Date().toISOString()
        }));

        const { error: photosError } = await supabase
          .from('submission_photos')
          .insert(photoInserts);

        if (photosError) {
          console.warn('Could not save photos:', photosError);
        }
      }

      // Send notification
      const { data: caseInfo } = await supabase
        .from('cases')
        .select('case_number')
        .eq('id', request.caseId)
        .single();

      if (caseInfo) {
        await notificationService.sendCaseSubmissionNotification(
          request.caseId,
          request.gigWorkerId,
          caseInfo.case_number
        );
      }

      return { success: true, submissionId: submissionId };
    } catch (error) {
      console.error('Error submitting case:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Save case as draft
   */
  async saveDraft(request: CaseDraftRequest): Promise<{ success: boolean; error?: string; submissionId?: string }> {
    try {
      // Get case details to determine contract type
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .select(`
          id,
          client_id,
          contract_type
        `)
        .eq('id', request.caseId)
        .single();

      if (caseError) throw caseError;

      // Get contract type ID
      const { data: contractType, error: contractTypeError } = await supabase
        .from('contract_type_config')
        .select('id')
        .eq('type_key', caseData.contract_type)
        .single();

      if (contractTypeError) throw contractTypeError;

      // Check if there's a form template for this contract type
      const { data: formTemplate, error: templateError } = await supabase
        .from('form_templates')
        .select('id')
        .eq('contract_type_id', contractType.id)
        .eq('is_active', true)
        .order('template_version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (templateError) throw templateError;

      if (!formTemplate) {
        return { success: false, error: 'No form template found for this contract type' };
      }

      // Use formService to save draft
      const formService = new (await import('./formService')).FormService();
      const result = await formService.submitForm(
        request.caseId,
        formTemplate.id,
        request.gigWorkerId,
        request.formData,
        true // isDraft = true
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return { success: true, submissionId: result.submissionId };
    } catch (error) {
      console.error('Error saving draft:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get gig worker's allocated cases
   */
  async getAllocatedCases(gigWorkerId: string): Promise<{ success: boolean; cases?: any[]; error?: string }> {
    try {
      const { data: cases, error } = await supabase
        .from('cases')
        .select(`
          id,
          case_number,
          client_case_id,
          client_id,
          contract_type,
          company_name,
          candidate_name,
          phone_primary,
          phone_secondary,
          status,
          priority,
          vendor_tat_start_date,
          due_at,
          created_at,
          base_rate_inr,
          total_payout_inr,
          current_vendor_id,
          "QC_Response",
          clients (id, name),
          locations (address_line, city, state, pincode, location_url),
          form_submissions (id, submitted_at, created_at),
          submissions (id, submitted_at, created_at)
        `)
        .eq('current_assignee_id', gigWorkerId)
        .eq('current_assignee_type', 'gig')
        .in('status', ['allocated', 'accepted', 'in_progress', 'submitted']);

      if (error) throw error;

      console.log('Raw cases data from database:', cases);
      console.log('Client data for first case:', cases?.[0]?.clients);
      console.log('Client ID for first case:', cases?.[0]?.client_id);
      
      // Debug QC_Response field
      cases?.forEach((caseItem, index) => {
        console.log(`Case ${index + 1} (${caseItem.case_number}):`, {
          id: caseItem.id,
          QC_Response: caseItem.QC_Response,
          status: caseItem.status
        });
      });

      // Get acceptance deadlines from allocation logs
      const caseIds = cases?.map(c => c.id) || [];
      
      // For submitted cases, let's also query form_submissions directly to see what's there
      const submittedCaseIds = cases?.filter(c => c.status === 'submitted').map(c => c.id) || [];
      let directFormSubmissions = [];
      if (submittedCaseIds.length > 0) {
        console.log('Querying form_submissions directly for submitted cases:', submittedCaseIds);
        const { data: formSubmissions, error: formError } = await supabase
          .from('form_submissions')
          .select('case_id, submitted_at, created_at')
          .in('case_id', submittedCaseIds);
        
        console.log('Direct form_submissions query result:', formSubmissions, 'error:', formError);
        directFormSubmissions = formSubmissions || [];
      }
      const { data: allocationLogs } = await supabase
        .from('allocation_logs')
        .select('case_id, acceptance_deadline')
        .in('case_id', caseIds)
        .eq('candidate_id', gigWorkerId)
        .eq('decision', 'allocated');

      // Get gig worker info to determine if they're direct or vendor-connected
      const { data: gigWorker } = await supabase
        .from('gig_partners')
        .select('is_direct_gig, vendor_id')
        .eq('id', gigWorkerId)
        .single();

      // Merge case data with acceptance deadlines and vendor info
      const casesWithDeadlines = cases?.map(caseItem => {
        const log = allocationLogs?.find(l => l.case_id === caseItem.id);
        
        // Get the actual submission timestamp (prefer form_submissions over submissions)
        let actualSubmittedAt = null;
        console.log('Processing case:', caseItem.case_number, {
          form_submissions: caseItem.form_submissions,
          submissions: caseItem.submissions,
          status: caseItem.status
        });
        
        if (caseItem.form_submissions && caseItem.form_submissions.length > 0) {
          actualSubmittedAt = caseItem.form_submissions[0].submitted_at;
          console.log('Found form submission timestamp:', actualSubmittedAt, 'for case:', caseItem.case_number);
        } else if (caseItem.submissions && caseItem.submissions.length > 0) {
          actualSubmittedAt = caseItem.submissions[0].submitted_at;
          console.log('Found legacy submission timestamp:', actualSubmittedAt, 'for case:', caseItem.case_number);
        } else {
          // Try direct query results as fallback
          const directSubmission = directFormSubmissions.find(s => s.case_id === caseItem.id);
          if (directSubmission) {
            actualSubmittedAt = directSubmission.submitted_at;
            console.log('Found direct form submission timestamp:', actualSubmittedAt, 'for case:', caseItem.case_number);
          } else {
            console.log('No submission timestamp found for case:', caseItem.case_number, 'status:', caseItem.status);
          }
        }
        
        return {
          ...caseItem,
          is_direct_gig: gigWorker?.is_direct_gig ?? true,
          vendor_id: gigWorker?.vendor_id,
          acceptance_deadline: log?.acceptance_deadline || caseItem.due_at,
          actual_submitted_at: actualSubmittedAt,
          fi_type: this.determineFiType(caseItem.contract_type)
        };
      }) || [];

      // Filter: only show cases created today and after today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const filteredCases = casesWithDeadlines.filter(c => {
        const created = new Date((c as any).created_at);
        return created >= todayStart;
      });

      return { success: true, cases: filteredCases };
    } catch (error) {
      console.error('Error getting allocated cases:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get gig worker ID from user ID
   */
  async getGigWorkerId(userId: string): Promise<{ success: boolean; gigWorkerId?: string; error?: string }> {
    try {
      // Query gig_partners directly by user_id instead of going through profiles
      const { data: gigWorker, error: gigWorkerError } = await supabase
        .from('gig_partners')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (gigWorkerError || !gigWorker) {
        return { success: false, error: 'Gig worker not found' };
      }

      return { success: true, gigWorkerId: gigWorker.id };
    } catch (error) {
      console.error('Error getting gig worker ID:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get all vendors for dropdown selection
   */
  async getVendors(): Promise<{ success: boolean; vendors?: any[]; error?: string }> {
    try {
      const { data: vendors, error } = await supabase
        .from('vendors')
        .select('id, name, email, is_active')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      return { success: true, vendors: vendors || [] };
    } catch (error) {
      console.error('Error getting vendors:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Check for timeout cases and handle them
   */
  async checkAndHandleTimeouts(gigWorkerId: string): Promise<{ success: boolean; timeoutCount?: number; error?: string }> {
    try {
      const now = new Date().toISOString();
      
      // Get cases that should have timed out
      const { data: timeoutCases, error: casesError } = await supabase
        .from('allocation_logs')
        .select(`
          case_id,
          acceptance_deadline,
          cases!inner (
            id,
            status,
            current_assignee_id
          )
        `)
        .eq('candidate_id', gigWorkerId)
        .eq('decision', 'allocated')
        .lt('acceptance_deadline', now)
        .eq('cases.status', 'allocated');

      if (casesError) throw casesError;

      let timeoutCount = 0;

      for (const log of timeoutCases || []) {
        const caseId = log.case_id;
        
        // Update case status
        const { error: timeoutCaseError } = await supabase
          .from('cases')
          .update({
            status: 'pending_allocation',
            current_assignee_id: null,
            current_assignee_type: null,
            status_updated_at: new Date().toISOString()
          })
          .eq('id', caseId);

        if (timeoutCaseError) {
          console.error('Error updating timeout case:', timeoutCaseError);
          continue;
        }

        // Update allocation log
        const { error: logError } = await supabase
          .from('allocation_logs')
          .update({
            decision: 'timeout',
            decision_at: new Date().toISOString(),
            reallocation_reason: 'Not accepted within 1 hour'
          })
          .eq('case_id', caseId)
          .eq('candidate_id', gigWorkerId)
          .eq('decision', 'allocated');

        if (logError) {
          console.error('Error updating allocation log:', logError);
          continue;
        }

        // Free up capacity
        const { error: capacityError } = await supabase
          .rpc('free_capacity', {
            p_gig_partner_id: gigWorkerId,
            p_case_id: caseId,
            p_reason: 'Case timeout - not accepted'
          });

        if (capacityError) {
          console.warn('Could not free capacity for timeout case:', capacityError);
        }

        timeoutCount++;
      }

      return { success: true, timeoutCount };
    } catch (error) {
      console.error('Error checking timeouts:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// Export singleton instance
export const gigWorkerService = new GigWorkerService();
