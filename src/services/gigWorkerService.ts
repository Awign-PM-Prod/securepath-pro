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
      // Get full gig worker data
      const { data: gigWorkerData } = await supabase
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

      if (gigWorkerData && gigWorkerData.vendor_id) {
        // Get vendor data
        await supabase
          .from('vendors')
          .select('id, name, email')
          .eq('id', gigWorkerData.vendor_id)
          .single();
      }
    } catch (error) {
      // Silent error handling for debug function
    }
  }

  /**
   * Accept a case
   */
  async acceptCase(request: CaseAcceptanceRequest): Promise<{ success: boolean; error?: string }> {
    try {
      // Debug gig worker vendor association
      await this.debugGigWorkerVendorAssociation(request.gigWorkerId);

      // First, get the gig worker's vendor_id
      const { data: gigWorkerData, error: gigWorkerError } = await supabase
        .from('gig_partners')
        .select('vendor_id, is_direct_gig, id, user_id')
        .eq('id', request.gigWorkerId)
        .single();

      if (gigWorkerError) {
        throw gigWorkerError;
      }

      if (!gigWorkerData) {
        throw new Error('Gig worker not found');
      }

      // Prepare case update data
      const caseUpdateData: any = {
        status: 'accepted',
        status_updated_at: new Date().toISOString()
      };

      // If gig worker is associated with a vendor (has vendor_id), set current_vendor_id
      // Note: We check for vendor_id regardless of is_direct_gig flag
      if (gigWorkerData && gigWorkerData.vendor_id) {
        caseUpdateData.current_vendor_id = gigWorkerData.vendor_id;
      }

      // Update case status and vendor assignment
      const { error: acceptCaseError } = await supabase
        .from('cases')
        .update(caseUpdateData)
        .eq('id', request.caseId);

      if (acceptCaseError) {
        throw acceptCaseError;
      }

      // Verify the case was updated correctly
      await supabase
        .from('cases')
        .select('id, case_number, status, current_vendor_id, current_assignee_id, current_assignee_type')
        .eq('id', request.caseId)
        .single();

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

      // Note: Capacity error is non-critical, continue execution

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
      const submissionTime = new Date().toISOString();
      const { error: updateCaseError } = await supabase
        .from('cases')
        .update({
          status: 'submitted',
          submitted_at: submissionTime,
          status_updated_at: submissionTime
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

        // Note: Photo save error is non-critical, continue execution
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
   * @param request - Draft request with caseId, gigWorkerId, formData, and optional isNegative flag
   */
  async saveDraft(request: CaseDraftRequest & { isNegative?: boolean }): Promise<{ success: boolean; error?: string; submissionId?: string }> {
    try {
      let formTemplate;

      if (request.isNegative) {
        // For negative cases, find the negative template for the case's contract type
        // First get the case's contract type
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

        // Get the negative form template for this contract type
        const { data: negativeTemplate, error: negativeTemplateError } = await supabase
          .from('form_templates')
          .select('id')
          .eq('contract_type_id', contractType.id)
          .eq('is_active', true)
          .eq('is_negative', true)
          .order('template_version', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (negativeTemplateError) throw negativeTemplateError;

        if (!negativeTemplate) {
          return { success: false, error: `No negative form template found for contract type: ${caseData.contract_type}` };
        }

        formTemplate = negativeTemplate;
      } else {
        // For positive cases, use the case's contract type
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
        const { data: positiveTemplate, error: templateError } = await supabase
          .from('form_templates')
          .select('id')
          .eq('contract_type_id', contractType.id)
          .eq('is_active', true)
          .eq('is_negative', false)
          .order('template_version', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (templateError) throw templateError;

        if (!positiveTemplate) {
          return { success: false, error: 'No form template found for this contract type' };
        }

        formTemplate = positiveTemplate;
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
          status_updated_at,
          base_rate_inr,
          total_payout_inr,
          current_vendor_id,
          "QC_Response",
          is_positive,
          clients (id, name),
          locations (address_line, city, state, pincode, location_url),
          form_submissions (id, updated_at, created_at),
          submissions (id, submitted_at, created_at)
        `)
        .eq('current_assignee_id', gigWorkerId)
        .eq('current_assignee_type', 'gig')
        .eq('is_active', true)
        .in('status', ['allocated', 'accepted', 'in_progress', 'submitted', 'qc_passed', 'qc_rework']);

      if (error) throw error;


      // Get acceptance deadlines from allocation logs
      const caseIds = cases?.map(c => c.id) || [];
      
      // Fetch client data separately as fallback (in case relationship doesn't load)
      // Always fetch clients separately to ensure we have the data
      const clientIds = cases?.filter(c => c.client_id).map(c => c.client_id) || [];
      const uniqueClientIds = [...new Set(clientIds.filter(id => id))]; // Filter out null/undefined
      const clientsMap = new Map();
      if (uniqueClientIds.length > 0) {
        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select('id, name')
          .in('id', uniqueClientIds);
        
        if (!clientsError && clientsData) {
          (clientsData || []).forEach(client => {
            clientsMap.set(client.id, { id: client.id, name: client.name });
          });
        }
      }
      
      // For submitted cases, let's also query form_submissions directly to see what's there
      const submittedCaseIds = cases?.filter(c => c.status === 'submitted').map(c => c.id) || [];
      let directFormSubmissions = [];
      if (submittedCaseIds.length > 0) {
        const { data: formSubmissions } = await supabase
          .from('form_submissions')
          .select('case_id, updated_at, created_at')
          .in('case_id', submittedCaseIds);
        
        directFormSubmissions = formSubmissions || [];
      }
      const { data: allocationLogs } = await supabase
        .from('allocation_logs')
        .select('case_id, acceptance_deadline, allocated_at, accepted_at, decision')
        .in('case_id', caseIds)
        .eq('candidate_id', gigWorkerId)
        .order('allocated_at', { ascending: false });

      // Get form submissions to find in_progress_at (first draft created_at)
      // Note: form_submissions uses gig_partner_id, not gig_worker_id
      const { data: formSubmissions } = await supabase
        .from('form_submissions')
        .select('case_id, created_at')
        .in('case_id', caseIds)
        .eq('gig_partner_id', gigWorkerId)
        .order('created_at', { ascending: true });

      // Get QC reviews to find rework_at and qc_passed_at
      const { data: qcReviews } = await supabase
        .from('qc_reviews')
        .select('case_id, reviewed_at, result, created_at')
        .in('case_id', caseIds)
        .order('reviewed_at', { ascending: false });

      // Get case status history to find when status changed to qc_passed
      // We'll use status_updated_at from cases table when status is qc_passed
      
      // Get gig worker info to determine if they're direct or vendor-connected
      const { data: gigWorker } = await supabase
        .from('gig_partners')
        .select('is_direct_gig, vendor_id')
        .eq('id', gigWorkerId)
        .single();

      // Merge case data with acceptance deadlines and vendor info
      const casesWithDeadlines = cases?.map(caseItem => {
        // Find allocation log for this case (most recent allocated log)
        const allocatedLog = allocationLogs?.find(l => 
          l.case_id === caseItem.id && 
          (l.decision === 'allocated' || l.decision === 'accepted')
        );
        
        // Find accepted log (most recent accepted)
        const acceptedLog = allocationLogs?.find(l => 
          l.case_id === caseItem.id && 
          l.decision === 'accepted'
        );

        // Find first form submission (in_progress_at)
        const firstFormSubmission = formSubmissions?.find(f => f.case_id === caseItem.id);
        
        // Find rework review (most recent rework)
        // Filter all rework reviews for this case and get the most recent one
        const reworkReviews = qcReviews?.filter(q => 
          q.case_id === caseItem.id && 
          q.result === 'rework'
        ) || [];
        // Sort by reviewed_at descending to get most recent, fallback to created_at
        const reworkReview = reworkReviews.length > 0 
          ? reworkReviews.sort((a, b) => {
              const aDate = a.reviewed_at || a.created_at;
              const bDate = b.reviewed_at || b.created_at;
              return new Date(bDate).getTime() - new Date(aDate).getTime();
            })[0]
          : null;
        
        // Find qc_passed review
        const passedReview = qcReviews?.find(q => 
          q.case_id === caseItem.id && 
          q.result === 'passed'
        );

        const log = allocationLogs?.find(l => l.case_id === caseItem.id && l.decision === 'allocated');
        
        // Get the actual submission timestamp (prefer form_submissions over submissions)
        let actualSubmittedAt = null;
        
        if (caseItem.form_submissions && caseItem.form_submissions.length > 0) {
          actualSubmittedAt = caseItem.form_submissions[0].updated_at;
        } else if (caseItem.submissions && caseItem.submissions.length > 0) {
          actualSubmittedAt = caseItem.submissions[0].submitted_at;
        } else {
          // Try direct query results as fallback
          const directSubmission = directFormSubmissions.find(s => s.case_id === caseItem.id);
          if (directSubmission) {
            actualSubmittedAt = directSubmission.updated_at;
          }
        }
        
        // Get status_updated_at for qc_passed cases
        let qcPassedAt = null;
        if (caseItem.status === 'qc_passed') {
          // Use status_updated_at from cases table when status is qc_passed, fallback to QC review date
          qcPassedAt = (caseItem as any).status_updated_at || passedReview?.reviewed_at || passedReview?.created_at;
        }

        // Get accepted_at - use allocation log accepted_at, or status_updated_at when status is accepted
        let acceptedAt = acceptedLog?.accepted_at;
        if (!acceptedAt && caseItem.status === 'accepted') {
          acceptedAt = (caseItem as any).status_updated_at;
        }

        // Get allocated_at - use allocation log, or status_updated_at if status is allocated
        // For rework cases, we need allocated_at to be set so they show in the rework tab
        let allocatedAt = null;
        if (caseItem.status === 'allocated') {
          allocatedAt = allocatedLog?.allocated_at || (caseItem as any).status_updated_at;
        } else if (caseItem.status === 'qc_rework') {
          // For qc_rework status, try to get allocated_at from log, or use status_updated_at
          // This handles cases where qc_rework cases are allocated but status hasn't changed to 'allocated'
          allocatedAt = allocatedLog?.allocated_at || (caseItem as any).status_updated_at;
        } else {
          // For other statuses, still try to get allocated_at from log
          // If not found and this is a rework case, use status_updated_at as fallback
          allocatedAt = allocatedLog?.allocated_at;
          if (!allocatedAt && (caseItem.QC_Response === 'Rework' || caseItem.status === 'qc_rework')) {
            // For rework cases, if no allocation log found, use status_updated_at
            // This handles cases where allocation log might be missing
            allocatedAt = (caseItem as any).status_updated_at;
          }
        }

        // Get submitted_at - use actual_submitted_at or status_updated_at when status is submitted
        let submittedAt = actualSubmittedAt;
        if (caseItem.status === 'submitted' && !submittedAt) {
          submittedAt = (caseItem as any).status_updated_at;
        }

        // Get client data - prefer relationship data, fallback to fetched data
        let clientData = caseItem.clients;
        // If relationship data doesn't exist or doesn't have name, use fetched data
        if ((!clientData || !clientData.name) && caseItem.client_id) {
          const fetchedClient = clientsMap.get(caseItem.client_id);
          if (fetchedClient && fetchedClient.name) {
            clientData = fetchedClient;
          }
        }
        
        return {
          ...caseItem,
          is_direct_gig: gigWorker?.is_direct_gig ?? true,
          vendor_id: gigWorker?.vendor_id,
          acceptance_deadline: log?.acceptance_deadline || caseItem.due_at,
          actual_submitted_at: actualSubmittedAt,
          fi_type: this.determineFiType(caseItem.contract_type),
          // Ensure clients data is preserved or fetched - always use fetched data if relationship failed
          clients: clientData || (caseItem.client_id ? clientsMap.get(caseItem.client_id) : null) || null,
          // Date fields for month filtering
          allocated_at: allocatedAt,
          accepted_at: acceptedAt,
          in_progress_at: firstFormSubmission?.created_at || ((caseItem.status === 'in_progress') ? (caseItem as any).status_updated_at : null),
          submitted_at: submittedAt,
          qc_passed_at: qcPassedAt,
          // For rework_at, prefer rework review timestamp
          // For qc_rework status, use status_updated_at as the rework time
          // Only use status_updated_at as fallback if case is NOT newly allocated (status is not 'allocated' or 'accepted')
          // This prevents using allocation time as rework time
          rework_at: reworkReview?.reviewed_at || reworkReview?.created_at || 
            (caseItem.status === 'qc_rework' 
             ? (caseItem as any).status_updated_at 
             : (caseItem.QC_Response === 'Rework' && 
                caseItem.status !== 'allocated' && 
                caseItem.status !== 'accepted' 
                ? (caseItem as any).status_updated_at : null))
        };
      }) || [];

      // Filter: only show cases created after November 2nd, 2025
      const cutoffDate = new Date('2025-11-02T00:00:00.000Z');
      const filteredCases = casesWithDeadlines.filter(c => {
        const created = new Date((c as any).created_at);
        return created >= cutoffDate;
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
   * Note: Direct gig workers don't have timeout - they can accept at any time
   */
  async checkAndHandleTimeouts(gigWorkerId: string): Promise<{ success: boolean; timeoutCount?: number; error?: string }> {
    try {
      // Check if this is a direct gig worker - if so, skip timeout handling
      const { data: gigWorker, error: gigWorkerError } = await supabase
        .from('gig_partners')
        .select('is_direct_gig')
        .eq('id', gigWorkerId)
        .single();

      if (gigWorkerError) throw gigWorkerError;

      // Direct gig workers don't have timeout - they can accept at any time
      if (gigWorker?.is_direct_gig) {
        return { success: true, timeoutCount: 0 };
      }

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

        // Note: Capacity error is non-critical, continue execution

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
