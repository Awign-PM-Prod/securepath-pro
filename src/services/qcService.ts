import { supabase } from '@/integrations/supabase/client';

export interface QCReviewRequest {
  caseId: string;
  submissionId: string;
  reviewerId: string;
  result: 'pass' | 'reject' | 'rework';
  reasonCodes: string[];
  comments: string;
  qualityScores?: {
    photo_quality_score?: number;
    location_accuracy_score?: number;
    data_completeness_score?: number;
    overall_score?: number;
  };
  reworkInstructions?: string;
  reworkDeadline?: string;
}

export interface QCReviewResponse {
  success: boolean;
  error?: string;
  reviewId?: string;
}

export class QCService {
  /**
   * Submit a QC review for a case submission
   */
  async submitQCReview(request: QCReviewRequest): Promise<QCReviewResponse> {
    try {
      // First, try to get form submission ID for the case
      const { data: formSubmissions, error: formSubmissionError } = await supabase
        .from('form_submissions')
        .select('id')
        .eq('case_id', request.caseId)
        .order('created_at', { ascending: false })
        .limit(1);

      let submissionId = null;
      let formSubmissionId = null;

      if (formSubmissions && formSubmissions.length > 0) {
        formSubmissionId = formSubmissions[0].id;
        console.log('Found form submission:', formSubmissionId);
      } else {
        // Fallback to regular submissions table
        const { data: submissions, error: submissionError } = await supabase
          .from('submissions')
          .select('id')
          .eq('case_id', request.caseId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (submissionError) {
          console.error('Error finding submission:', submissionError);
          return { success: false, error: 'Error finding submission for this case' };
        }

        if (!submissions || submissions.length === 0) {
          console.error('No submission found for case:', request.caseId);
          return { success: false, error: 'No submission found for this case. Please ensure the case has been submitted by a field worker.' };
        }

        submissionId = submissions[0].id;
        console.log('Found regular submission:', submissionId);
      }

      if (!submissionId && !formSubmissionId) {
        return { success: false, error: 'No submission found for this case. Please ensure the case has been submitted by a field worker.' };
      }

      // Prepare the QC review data
      const qcReviewData = {
        submission_id: submissionId,
        form_submission_id: formSubmissionId,
        case_id: request.caseId,
        reviewer_id: request.reviewerId,
        result: request.result,
        comments: request.comments || null,
        issues_found: request.reasonCodes.length > 0 ? request.reasonCodes : null,
        rework_instructions: request.reworkInstructions || null,
        rework_deadline: request.reworkDeadline || null,
        ...request.qualityScores,
      };

      // Insert the QC review
      const { data: reviewData, error: reviewError } = await supabase
        .from('qc_reviews')
        .insert(qcReviewData)
        .select('id')
        .single();

      if (reviewError) {
        console.error('Error creating QC review:', reviewError);
        return { success: false, error: 'Failed to create QC review' };
      }

      // Map QC result to QC_Response enum value
      const qcResponse = request.result === 'pass' ? 'Approved' : 
                        request.result === 'reject' ? 'Rejected' : 'Rework';

      console.log('QC Service Debug:', {
        caseId: request.caseId,
        result: request.result,
        qcResponse
      });

      // Update case status based on QC result
      const now = new Date().toISOString();
      let updateData: any = { 
        "QC_Response": qcResponse, // Always update QC_Response column
        status_updated_at: now,
        updated_at: now // Also update the updated_at timestamp
      };

      // Update status based on QC result
      if (request.result === 'pass') {
        updateData.status = 'qc_passed';
      } else if (request.result === 'reject') {
        updateData.status = 'qc_rejected';
      } else if (request.result === 'rework') {
        updateData.status = 'qc_rework';
        
        // For rework cases, set a 24-hour deadline
        const reworkDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        updateData.due_at = reworkDeadline;
      }

      console.log('Updating case with data:', updateData);

      const { data: updatedCase, error: caseUpdateError } = await supabase
        .from('cases')
        .update(updateData)
        .eq('id', request.caseId)
        .select('id, status, QC_Response')
        .single();

      if (caseUpdateError) {
        console.error('Error updating case status:', caseUpdateError);
        // Fail the operation if case update fails - this is critical
        return { 
          success: false, 
          error: `Failed to update case status: ${caseUpdateError.message}` 
        };
      }

      if (!updatedCase) {
        console.error('Case update returned no data');
        return { 
          success: false, 
          error: 'Case update failed: No data returned' 
        };
      }

      // Verify the update was successful
      if (updatedCase.status !== updateData.status) {
        console.error('Case status mismatch after update:', {
          expected: updateData.status,
          actual: updatedCase.status
        });
        return { 
          success: false, 
          error: `Case status update failed: Expected ${updateData.status} but got ${updatedCase.status}` 
        };
      }

      if (updatedCase.QC_Response !== qcResponse) {
        console.error('QC_Response mismatch after update:', {
          expected: qcResponse,
          actual: updatedCase.QC_Response
        });
        return { 
          success: false, 
          error: `QC_Response update failed: Expected ${qcResponse} but got ${updatedCase.QC_Response}` 
        };
      }

      console.log('Case update successful:', {
        caseId: updatedCase.id,
        status: updatedCase.status,
        QC_Response: updatedCase.QC_Response
      });

      // Update QC workflow for all QC results
      const workflowStage = request.result === 'pass' ? 'passed' : 
                           request.result === 'reject' ? 'rejected' : 'rework';
      
      const { error: workflowError } = await supabase
        .from('qc_workflow')
        .update({
          current_stage: workflowStage,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sla_deadline: updateData.due_at || null // Set deadline for rework cases
        })
        .eq('case_id', request.caseId)
        .eq('is_active', true);

      if (workflowError) {
        console.warn('QC workflow update failed:', workflowError);
        // Don't fail the entire operation
      }

      return { 
        success: true, 
        reviewId: reviewData.id 
      };

    } catch (error) {
      console.error('QC review submission failed:', error);
      return { 
        success: false, 
        error: 'An unexpected error occurred while submitting QC review' 
      };
    }
  }

  /**
   * Get QC reviews for a specific case
   */
  async getCaseQCReviews(caseId: string) {
    try {
      const { data, error } = await supabase
        .from('qc_reviews')
        .select(`
          id,
          result,
          comments,
          issues_found,
          rework_instructions,
          rework_deadline,
          reviewed_at,
          created_at,
          reviewer:auth.users!qc_reviews_reviewer_id_fkey (
            id,
            profiles!inner (
              first_name,
              last_name
            )
          )
        `)
        .eq('case_id', caseId)
        .order('reviewed_at', { ascending: false });

      if (error) throw error;

      return { success: true, reviews: data || [] };
    } catch (error) {
      console.error('Failed to fetch QC reviews:', error);
      return { success: false, error: 'Failed to fetch QC reviews', reviews: [] };
    }
  }

  /**
   * Get QC statistics for dashboard
   */
  async getQCStats() {
    try {
      const { data, error } = await supabase
        .from('qc_reviews')
        .select('result, reviewed_at')
        .gte('reviewed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Last 7 days

      if (error) throw error;

      const stats = {
        pending: 0,
        approved: 0,
        rejected: 0,
        rework: 0,
        total: data?.length || 0
      };

      data?.forEach(review => {
        switch (review.result) {
          case 'pass':
            stats.approved++;
            break;
          case 'reject':
            stats.rejected++;
            break;
          case 'rework':
            stats.rework++;
            break;
        }
      });

      return { success: true, stats };
    } catch (error) {
      console.error('Failed to fetch QC stats:', error);
      return { success: false, error: 'Failed to fetch QC statistics', stats: null };
    }
  }
}

// Export singleton instance
export const qcService = new QCService();
