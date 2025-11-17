import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, CheckCircle, XCircle, MapPin, User, Building, Phone, Calendar, FileText, AlertCircle, Bell, Filter, X } from 'lucide-react';
import { format, differenceInMinutes, addHours, startOfMonth, endOfMonth, isSameMonth, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { gigWorkerService } from '@/services/gigWorkerService';
import { DynamicForm, DynamicFormRef } from '@/components/DynamicForm';
import { FormData } from '@/types/form';
import DynamicFormSubmission from '@/components/CaseManagement/DynamicFormSubmission';
import { getGigWorkerVendorInfo } from '@/utils/vendorGigWorkerUtils';
import { NotificationPermission } from '@/components/NotificationPermission';
import { isRecreatedCase } from '@/utils/caseUtils';

interface AllocatedCase {
  id: string;
  case_number: string;
  client_case_id: string;
  client_id: string;
  contract_type: string;
  candidate_name: string;
  phone_primary: string;
  phone_secondary?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  status: string;
  priority: string;
  vendor_tat_start_date: string;
  due_at: string;
  base_rate_inr: number;
  total_payout_inr: number;
  acceptance_deadline: string;
  is_direct_gig: boolean;
  vendor_id?: string;
  actual_submitted_at?: string;
  QC_Response?: string;
  fi_type?: 'business' | 'residence' | 'office';
  allocated_at?: string; // When case was allocated to worker
  accepted_at?: string; // When case was accepted by worker
  in_progress_at?: string; // When case entered in_progress status (first draft saved)
  submitted_at?: string; // When case was submitted
  qc_passed_at?: string; // When case was approved (qc_passed)
  rework_at?: string; // When case was marked for rework
  is_positive?: boolean; // Whether this case is positive (true) or negative (false)
  clients: {
    id: string;
    name: string;
  };
  locations: {
    address_line: string;
    city: string;
    state: string;
    pincode: string;
    location_url?: string;
  };
  form_submissions?: Array<{
    id: string;
    submitted_at?: string;
    created_at: string;
  }>;
  submissions?: Array<{
    id: string;
    submitted_at?: string;
    created_at: string;
  }>;
}

interface CaseSubmission {
  caseId: string;
  answers: Record<string, any>;
  notes: string;
  photos: string[];
  submission_lat?: number;
  submission_lng?: number;
  submission_address?: string;
}

export default function GigWorkerDashboard() {
  const [allocatedCases, setAllocatedCases] = useState<AllocatedCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<AllocatedCase | null>(null);
  const [isAcceptDialogOpen, setIsAcceptDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isSubmissionDialogOpen, setIsSubmissionDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionData, setSubmissionData] = useState<CaseSubmission>({
    caseId: '',
    answers: {},
    notes: '',
    photos: []
  });
  const [rejectReason, setRejectReason] = useState('');
  const [gigWorkerId, setGigWorkerId] = useState<string>('');
  const [selectedSubmissionCase, setSelectedSubmissionCase] = useState<AllocatedCase | null>(null);
  const [isViewSubmissionDialogOpen, setIsViewSubmissionDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [qcReviewData, setQcReviewData] = useState<any>(null);
  const [allQcReviewData, setAllQcReviewData] = useState<Record<string, any>>({});
  const [draftData, setDraftData] = useState<any>(null);
  const formRef = useRef<DynamicFormRef>(null);
  const [isDraftResumeDialogOpen, setIsDraftResumeDialogOpen] = useState(false);
  const [pendingDraftCase, setPendingDraftCase] = useState<AllocatedCase | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [gigWorkerVendorInfo, setGigWorkerVendorInfo] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showNotificationTest, setShowNotificationTest] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    // Default to current month in YYYY-MM format
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isPositiveNegativeDialogOpen, setIsPositiveNegativeDialogOpen] = useState(false);
  const [pendingCaseForForm, setPendingCaseForForm] = useState<AllocatedCase | null>(null);
  const [isNegativeForm, setIsNegativeForm] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Check if filter is applied (not current month)
  const isFilterApplied = () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return selectedMonth !== currentMonth;
  };
  
  // Clear filter - reset to current month
  const clearFilter = () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(currentMonth);
  };

  useEffect(() => {
    if (user) {
      initializeGigWorker();
      // Set up interval to check for timeouts every minute
      const interval = setInterval(checkTimeouts, 60000);
      return () => clearInterval(interval);
    } else {
      // If no user, ensure loading state is cleared
      setIsLoading(false);
    }
  }, [user]);

  // Load cases when gigWorkerId becomes available
  useEffect(() => {
    if (gigWorkerId) {
      loadAllocatedCases();
    }
  }, [gigWorkerId]);

  // Mobile detection and responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      // More comprehensive mobile detection
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isSmallScreen = width < 768;
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      // Consider it mobile if it's a small screen OR a mobile device OR touch device
      setIsMobile(isSmallScreen || (isMobileDevice && width < 1024) || (isTouchDevice && width < 900));
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, []);

  // Fallback timeout to ensure page loads even if there are network issues
  useEffect(() => {
    const fallbackTimeout = setTimeout(() => {
      if (isLoading) {
        console.warn('Page loading timeout - forcing page to load');
        setIsLoading(false);
      }
    }, 20000); // 20 second fallback

    return () => clearTimeout(fallbackTimeout);
  }, [isLoading]);


  const initializeGigWorker = async () => {
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Gig worker initialization timeout')), 15000)
      );
      
      const result = await Promise.race([
        gigWorkerService.getGigWorkerId(user?.id || ''),
        timeoutPromise
      ]);
      
      if ((result as any).success && (result as any).gigWorkerId) {
        setGigWorkerId((result as any).gigWorkerId);
        
        // Get vendor association info
        const vendorInfo = await getGigWorkerVendorInfo((result as any).gigWorkerId);
        setGigWorkerVendorInfo(vendorInfo);
        
        // loadAllocatedCases() will be called automatically via useEffect when gigWorkerId changes
      } else {
        toast({
          title: 'Error',
          description: 'Gig worker profile not found',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error initializing gig worker:', error);
      // Don't show error toast for timeout to avoid blocking UX
      if (error.message !== 'Gig worker initialization timeout') {
        toast({
          title: 'Error',
          description: 'Failed to initialize gig worker profile',
          variant: 'destructive',
        });
      }
    }
  };

  // Helper function to determine if payout should be hidden
  const shouldHidePayout = (caseItem: AllocatedCase) => {
    // Hide payout if:
    // 1. Gig worker is associated with a vendor (not direct gig)
    // 2. AND the case is allocated (not just created)
    return gigWorkerVendorInfo && 
           !gigWorkerVendorInfo.isDirectGig && 
           gigWorkerVendorInfo.vendorId && 
           (caseItem.status === 'allocated' || caseItem.status === 'accepted' || caseItem.status === 'in_progress' || caseItem.status === 'submitted');
  };

  // Helper function to determine if payout section should be completely hidden
  const shouldHidePayoutSection = (caseItem: AllocatedCase) => {
    // Hide entire payout section if:
    // 1. Direct gig worker, OR
    // 2. Vendor-associated gig worker with allocated case
    return caseItem.is_direct_gig || shouldHidePayout(caseItem);
  };

  const loadAllocatedCases = async () => {
    if (!gigWorkerId) {
      setIsLoading(false); // Ensure loading state is cleared even without gigWorkerId
      return;
    }
    
    try {
      setIsLoading(true);
      const result = await gigWorkerService.getAllocatedCases(gigWorkerId);
      
      if (result.success && result.cases) {
        setAllocatedCases(result.cases);
        
        // Fetch QC review data for all cases
        const qcDataMap: Record<string, any> = {};
        for (const caseItem of result.cases) {
          const qcData = await fetchQcReviewData(caseItem.id);
          if (qcData && qcData.result === 'rework') {
            qcDataMap[caseItem.id] = qcData;
          }
        }
        setAllQcReviewData(qcDataMap);
      } else {
        throw new Error(result.error || 'Failed to load cases');
      }
    } catch (error) {
      console.error('Error loading allocated cases:', error);
      const { getErrorToast } = await import('@/utils/errorMessages');
      toast(getErrorToast(error));
    } finally {
      setIsLoading(false);
    }
  };

  const checkTimeouts = async () => {
    const now = new Date();
    const timeoutCases = allocatedCases.filter(caseItem => {
      // Direct gig workers don't have timeout - they can accept at any time
      if (caseItem.is_direct_gig) return false;
      if (caseItem.status !== 'allocated') return false;
      const deadline = new Date(caseItem.acceptance_deadline);
      return now > deadline;
    });

    if (timeoutCases.length > 0) {
      // Handle timeout cases
      for (const caseItem of timeoutCases) {
        await handleCaseTimeout(caseItem.id);
      }
      // Reload cases
      loadAllocatedCases();
    }
  };

  const handleCaseTimeout = async (caseId: string) => {
    try {
      // Update case status to pending_allocation and remove assignee
      const { error: caseError } = await supabase
        .from('cases')
        .update({
          status: 'pending_allocation' as any,
          current_assignee_id: null,
          current_assignee_type: null,
          status_updated_at: new Date().toISOString()
        })
        .eq('id', caseId);

      if (caseError) throw caseError;

      // Update allocation log
      const { error: logError } = await supabase
        .from('allocation_logs')
        .update({
          decision: 'timeout' as any,
          decision_at: new Date().toISOString(),
          reallocation_reason: 'Not accepted within 1 hour'
        })
        .eq('case_id', caseId)
        .eq('decision', 'allocated');

      if (logError) throw logError;

      // Free up capacity
      const { error: capacityError } = await supabase
        .rpc('free_capacity' as any, {
          p_gig_partner_id: gigWorkerId,
          p_case_id: caseId,
          p_reason: 'Case timeout - not accepted'
        });

      if (capacityError) {
        console.warn('Could not free capacity:', capacityError);
      }

      toast({
        title: 'Case Timeout',
        description: 'Case was not accepted within 1 hour and has been unassigned',
        variant: 'destructive',
      });
    } catch (error) {
      console.error('Error handling case timeout:', error);
    }
  };


  const handleAcceptCase = async () => {
    if (!selectedCase || !gigWorkerId) return;

    try {
      const result = await gigWorkerService.acceptCase({
        caseId: selectedCase.id,
        gigWorkerId: gigWorkerId
      });

      if (result.success) {
        toast({
          title: 'Case Accepted',
          description: 'You have successfully accepted the case',
        });
        setIsAcceptDialogOpen(false);
        setSelectedCase(null);
        loadAllocatedCases();
      } else {
        throw new Error(result.error || 'Failed to accept case');
      }
    } catch (error) {
      console.error('Error accepting case:', error);
      const { getErrorToast } = await import('@/utils/errorMessages');
      toast(getErrorToast(error));
    }
  };

  const handleRejectCase = async () => {
    if (!selectedCase || !gigWorkerId) return;

    try {
      const result = await gigWorkerService.rejectCase({
        caseId: selectedCase.id,
        gigWorkerId: gigWorkerId,
        reason: rejectReason || 'Rejected by gig worker'
      });

      if (result.success) {
        toast({
          title: 'Case Rejected',
          description: 'You have rejected the case',
        });
        setIsRejectDialogOpen(false);
        setSelectedCase(null);
        setRejectReason('');
        loadAllocatedCases();
      } else {
        throw new Error(result.error || 'Failed to reject case');
      }
    } catch (error) {
      console.error('Error rejecting case:', error);
      const { getErrorToast } = await import('@/utils/errorMessages');
      toast(getErrorToast(error));
    }
  };

  const handleSubmitCase = async () => {
    if (!selectedCase || !gigWorkerId) return;

    try {
      setIsSubmitting(true);
      const result = await gigWorkerService.submitCase({
        caseId: selectedCase.id,
        gigWorkerId: gigWorkerId,
        answers: submissionData.answers,
        notes: submissionData.notes,
        photos: submissionData.photos,
        submissionLat: submissionData.submission_lat,
        submissionLng: submissionData.submission_lng,
        submissionAddress: submissionData.submission_address
      });

      if (result.success) {
        toast({
          title: 'Case Submitted',
          description: 'Your case submission has been received',
        });
        setIsSubmissionDialogOpen(false);
        setSelectedCase(null);
        setSubmissionData({
          caseId: '',
          answers: {},
          notes: '',
          photos: []
        });
        loadAllocatedCases();
      } else {
        throw new Error(result.error || 'Failed to submit case');
      }
    } catch (error) {
      console.error('Error submitting case:', error);
      const { getErrorToast } = await import('@/utils/errorMessages');
      toast(getErrorToast(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDynamicFormSubmit = async (formData: FormData) => {
    // Use selectedSubmissionCase when in edit mode (for rework cases), otherwise selectedCase
    const caseToSubmit = isEditMode && selectedSubmissionCase ? selectedSubmissionCase : selectedCase;
    
    if (!caseToSubmit || !gigWorkerId) return;

    setIsSubmitting(true);
    try {
      const result = await gigWorkerService.submitCase({
        caseId: caseToSubmit.id,
        gigWorkerId,
        formData: formData,
        notes: '', // Will be handled by the form
        submissionLat: 0, // Will be handled by the form
        submissionLng: 0, // Will be handled by the form
        submissionAddress: '', // Will be handled by the form
      });

      if (result.success) {
        toast({
          title: 'Success',
          description: isEditMode ? 'Case resubmitted successfully!' : 'Case submitted successfully!',
        });
        setIsSubmissionDialogOpen(false);
        setIsViewSubmissionDialogOpen(false);
        setIsEditMode(false);
        setDraftData(null);
        loadAllocatedCases();
      } else {
        const errorObj = new Error(result.error || 'Failed to submit case');
        const { getErrorToast } = await import('@/utils/errorMessages');
        toast(getErrorToast(errorObj));
      }
    } catch (error) {
      console.error('Error submitting case:', error);
        const { getErrorToast } = await import('@/utils/errorMessages');
        toast(getErrorToast(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async (formData: FormData) => {
    // Use selectedSubmissionCase.id when in edit mode, otherwise selectedCase.id
    const caseId = isEditMode && selectedSubmissionCase ? selectedSubmissionCase.id : selectedCase?.id;
    
    if (!caseId || !gigWorkerId) return;

    setIsSubmitting(true);
    try {
      const result = await gigWorkerService.saveDraft({
        caseId: caseId,
        gigWorkerId,
        formData: formData,
      });

      if (result.success) {
        // Inform user
        toast({
          title: 'Draft Saved',
          description: 'Your progress has been saved and the case is In Progress.',
        });
        // Do not refresh the entire list to avoid page flicker
        // Optimistically update local state if needed
        if (selectedCase && selectedCase.status === 'accepted') {
          setAllocatedCases(prev => prev.map(c => c.id === selectedCase.id ? { ...c, status: 'in_progress' } : c));
        }
      } else {
        const errorObj = new Error(result.error || 'Failed to save draft');
        const { getErrorToast } = await import('@/utils/errorMessages');
        toast(getErrorToast(errorObj));
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      const { getErrorToast } = await import('@/utils/errorMessages');
      toast(getErrorToast(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImmediateSave = async (formData: FormData) => {
    // Use selectedSubmissionCase.id when in edit mode, otherwise selectedCase.id
    const caseId = isEditMode && selectedSubmissionCase ? selectedSubmissionCase.id : selectedCase?.id;
    
    if (!caseId || !gigWorkerId || isSaving) return;

    console.log('Auto-save triggered with formData:', formData);
    console.log('Files in formData:', Object.keys(formData).map(key => {
      if (key === '_metadata') return null;
      const fieldData = formData[key];
      return {
        fieldKey: key,
        hasFiles: !!(fieldData && fieldData.files && fieldData.files.length > 0),
        fileCount: fieldData?.files?.length || 0
      };
    }).filter(Boolean));

    setIsSaving(true);
    try {
      const result = await gigWorkerService.saveDraft({
        caseId: caseId,
        gigWorkerId,
        formData: formData,
        isNegative: isNegativeForm, // Pass the isNegative flag for negative cases
      });

      if (result.success) {
        setLastSaveTime(new Date());
        console.log('Form saved successfully');
        console.log('Auto-save result:', result);
        
        // Check if this case is currently in 'accepted' status and move it to 'in_progress'
        const currentCase = allocatedCases.find(c => c.id === caseId);
        if (currentCase && currentCase.status === 'accepted') {
          console.log('Case is in accepted status, updating to in_progress...');
          
          // Update case status to in_progress
          const { error: caseUpdateError } = await supabase
            .from('cases')
            .update({
              status: 'in_progress',
              status_updated_at: new Date().toISOString()
            })
            .eq('id', caseId);

          if (caseUpdateError) {
            console.error('Failed to update case status to in_progress:', caseUpdateError);
          } else {
            console.log('Case status updated to in_progress, updating local state...');
            // Avoid full refresh; update local list
            setAllocatedCases(prev => prev.map(c => c.id === caseId ? { ...c, status: 'in_progress' } : c));
            
            // Show a toast notification
            toast({
              title: "Case Moved to In Progress",
              description: "Your case has been moved to the In Progress tab as you started working on it.",
            });
          }
        }
      } else {
        console.warn('Save failed:', result.error);
      }
    } catch (error) {
      console.error('Error during save:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const openFormForCase = async (caseItem: AllocatedCase, isNegative: boolean = false) => {
    setSelectedCase(caseItem);
    setIsNegativeForm(isNegative);
    
    try {
      const { formService } = await import('@/services/formService');
      
      // Check if this is a rework case (QC_Response = 'Rework')
      if (caseItem.QC_Response === 'Rework') {
        console.log('Rework case detected, opening view submission dialog...');
        
        // For rework cases, open the view submission dialog to show previous submission
        setSelectedSubmissionCase(caseItem);
        setIsViewSubmissionDialogOpen(true);
        
        toast({
          title: "Previous Submission View",
          description: "Viewing your previous submission for this rework case.",
        });
      } else {
        // Determine if this is a negative case based on is_positive flag
        // If is_positive is false, it's negative. If true or undefined, it's positive
        const caseIsNegative = caseItem.is_positive === false;
        
        // If explicitly opening as negative, or if case is marked as negative, set negative flag
        if (isNegative || caseIsNegative) {
          setIsNegativeForm(true);
          console.log('Case is negative, loading negative form');
        } else {
          setIsNegativeForm(false);
          console.log('Case is positive, loading positive form');
        }
        
        // Check for draft
        console.log('Checking for draft for case:', caseItem.id);
        const draftResult = await formService.getDraftSubmission(caseItem.id);
        
        console.log('Draft check result:', draftResult);
        
        if (draftResult.success && draftResult.draft) {
          // Auto-load draft for both accepted and in_progress so saved responses always appear
          console.log('Draft found: auto-loading draft and opening form');
          setDraftData(draftResult.draft);
          setIsSubmissionDialogOpen(true);
        } else {
          // No draft exists - start fresh
          console.log('No draft exists, starting fresh');
          setDraftData(null);
          setIsSubmissionDialogOpen(true);
        }
      }
    } catch (error) {
      console.error('Error checking for draft or previous submission:', error);
      setDraftData(null);
      setIsSubmissionDialogOpen(true);
    }
  };

  const handleSubmitResponse = async (caseItem: AllocatedCase) => {
    // Check if case is in accepted status (from accepted tab)
    if (caseItem.status === 'accepted' && caseItem.QC_Response !== 'Rework') {
      // Show Positive/Negative popup first
      setPendingCaseForForm(caseItem);
      setIsPositiveNegativeDialogOpen(true);
    } else {
      // For other cases (in_progress, etc.), open form directly
      await openFormForCase(caseItem);
    }
  };

  const handlePositiveSelection = async () => {
    setIsPositiveNegativeDialogOpen(false);
    if (pendingCaseForForm) {
      // Update case to set is_positive = true
      const { error } = await supabase
        .from('cases')
        .update({ is_positive: true })
        .eq('id', pendingCaseForForm.id);

      if (error) {
        console.error('Error updating case is_positive:', error);
        toast({
          title: "Error",
          description: "Failed to update case status.",
          variant: "destructive",
        });
      } else {
        // Update local state
        setAllocatedCases(prev => prev.map(c => 
          c.id === pendingCaseForForm.id ? { ...c, is_positive: true } : c
        ));
        // Update pending case
        const updatedCase = { ...pendingCaseForForm, is_positive: true };
        await openFormForCase(updatedCase);
      }
      setPendingCaseForForm(null);
    }
  };

  const handleNegativeSelection = async () => {
    setIsPositiveNegativeDialogOpen(false);
    if (pendingCaseForForm) {
      // Update case to set is_positive = false
      const { error } = await supabase
        .from('cases')
        .update({ is_positive: false })
        .eq('id', pendingCaseForForm.id);

      if (error) {
        console.error('Error updating case is_positive:', error);
        toast({
          title: "Error",
          description: "Failed to update case status.",
          variant: "destructive",
        });
      } else {
        // Update local state
        setAllocatedCases(prev => prev.map(c => 
          c.id === pendingCaseForForm.id ? { ...c, is_positive: false } : c
        ));
        // Update pending case
        const updatedCase = { ...pendingCaseForForm, is_positive: false };
        await openFormForCase(updatedCase, true); // true = isNegative
      }
      setPendingCaseForForm(null);
    }
  };

  const handleStartEditing = async (caseItem: AllocatedCase) => {
    try {
      const { formService } = await import('@/services/formService');
      
      // Get the previous form submission for this case
      const submissionResult = await formService.getFormSubmission(caseItem.id);
      
      if (submissionResult.success && submissionResult.submission) {
        console.log('Loading previous submission for editing:', submissionResult.submission);
        
        // Transform the previous submission data to match draft format
        let submissionData = submissionResult.submission.submission_data;
        
        // Handle different data formats
        if (typeof submissionData === 'string') {
          try {
            submissionData = JSON.parse(submissionData);
          } catch (e) {
            console.error('Error parsing submission data as JSON:', e);
            submissionData = {};
          }
        }
        
        const transformedSubmissionData = {
          submission_data: submissionData,
          form_submission_files: (submissionResult.submission as any).form_submission_files || [],
          files: (submissionResult.submission as any).form_submission_files || [] // Keep both for compatibility
        };
        
        console.log('Transformed submission data for editing:', {
          hasSubmissionData: !!transformedSubmissionData.submission_data,
          filesCount: transformedSubmissionData.form_submission_files?.length || 0,
          files: transformedSubmissionData.form_submission_files
        });
        
        // Fetch QC review data for this case if not already available
        if (allQcReviewData[caseItem.id]) {
          setQcReviewData(allQcReviewData[caseItem.id]);
        } else {
          const qcData = await fetchQcReviewData(caseItem.id);
          if (qcData) {
            setQcReviewData(qcData);
            setAllQcReviewData(prev => ({ ...prev, [caseItem.id]: qcData }));
          }
        }
        
        // Set the previous submission data as draft data for editing
        setDraftData(transformedSubmissionData);
        setIsEditMode(true);
        
        toast({
          title: "Edit Mode Enabled",
          description: "You can now edit your previous submission.",
        });
      } else {
        console.log('No previous submission found for editing');
        toast({
          title: "Error",
          description: "No previous submission found to edit.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading previous submission for editing:', error);
      toast({
        title: "Error",
        description: "Failed to load previous submission for editing.",
        variant: "destructive",
      });
    }
  };

  // Fetch QC review data for a case
  const fetchQcReviewData = async (caseId: string) => {
    try {
      const { data, error } = await supabase
        .from('qc_reviews')
        .select('*')
        .eq('case_id', caseId)
        .order('reviewed_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching QC review data:', error);
        return null;
      }

      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Error fetching QC review data:', error);
      return null;
    }
  };

  const handleViewSubmission = async (caseItem: AllocatedCase) => {
    setSelectedSubmissionCase(caseItem);
    setIsViewSubmissionDialogOpen(true);
    
    // Fetch QC review data if not already available
    if (allQcReviewData[caseItem.id]) {
      setQcReviewData(allQcReviewData[caseItem.id]);
    } else {
      // Fetch QC review data for this case
      const qcData = await fetchQcReviewData(caseItem.id);
      if (qcData) {
        setQcReviewData(qcData);
        // Also update allQcReviewData for future use
        setAllQcReviewData(prev => ({ ...prev, [caseItem.id]: qcData }));
      } else {
        setQcReviewData(null);
      }
    }
  };

  const handleResumeDraft = async () => {
    if (!pendingDraftCase) return;
    
    try {
      console.log('Resuming draft for case:', pendingDraftCase.id);
      const { formService } = await import('@/services/formService');
      const draftResult = await formService.getDraftSubmission(pendingDraftCase.id);
      
      console.log('Draft result:', draftResult);
      
      if (draftResult.success && draftResult.draft) {
        console.log('Draft found, setting draft data:', draftResult.draft);
        setDraftData(draftResult.draft);
        setIsDraftResumeDialogOpen(false);
        setIsSubmissionDialogOpen(true);
      } else {
        console.log('No draft found or error:', draftResult.error);
        throw new Error('Draft not found');
      }
    } catch (error) {
      console.error('Error resuming draft:', error);
      const { getErrorToast } = await import('@/utils/errorMessages');
      toast(getErrorToast(error));
    }
  };

  const handleStartFresh = async () => {
    if (!pendingDraftCase) return;
    
    try {
      const { formService } = await import('@/services/formService');
      await formService.deleteDraftSubmission(pendingDraftCase.id);
      
      setDraftData(null);
      setIsDraftResumeDialogOpen(false);
      setIsSubmissionDialogOpen(true);
      
      toast({
        title: 'Draft Deleted',
        description: 'Starting with a fresh form',
      });
    } catch (error) {
      console.error('Error deleting draft:', error);
      const { getErrorToast } = await import('@/utils/errorMessages');
      toast(getErrorToast(error));
    }
  };

  const getStatusBadge = (status: string, caseId?: string) => {
    // Check if this is a QC rework case by looking at the allQcReviewData
    const isQcRework = caseId && allQcReviewData[caseId] && allQcReviewData[caseId].result === 'rework';
    
    if (isQcRework && status === 'accepted') {
      return <Badge variant="destructive" className="bg-red-100 text-red-800">QC Rework - Pending Acceptance</Badge>;
    }
    
    switch (status) {
      case 'allocated':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Allocated</Badge>;
      case 'accepted':
        return <Badge variant="outline" className="bg-green-100 text-green-800">Accepted</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="bg-green-100 text-green-800">In Progress</Badge>;
      case 'submitted':
        return <Badge variant="outline" className="bg-purple-100 text-purple-800">Submitted</Badge>;
      case 'qc_passed':
        return <Badge variant="outline" className="bg-green-100 text-green-800">Approved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="destructive">Urgent</Badge>;
      case 'high':
        return <Badge variant="destructive" className="bg-orange-500">High</Badge>;
      case 'medium':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Medium</Badge>;
      case 'low':
        return <Badge variant="outline" className="bg-green-100 text-green-800">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getTimeRemaining = (deadline: string) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffMinutes = differenceInMinutes(deadlineDate, now);
    
    if (diffMinutes <= 0) return 'Expired';
    if (diffMinutes < 60) return `${diffMinutes}m remaining`;
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return `${hours}h ${minutes}m remaining`;
  };

  const formatTimeRemaining = (minutes: number) => {
    if (minutes <= 0) return 'Expired';
    if (minutes < 60) return `${minutes}m left`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m left`;
  };

  const isExpired = (deadline: string, isDirectGig: boolean = false) => {
    // Direct gig workers can accept at any time - no expiration
    if (isDirectGig) return false;
    return new Date() > new Date(deadline);
  };

  // Helper function to check if a date falls within the selected month
  const isInSelectedMonth = (dateString: string | undefined | null): boolean => {
    if (!dateString) return false;
    try {
      const date = parseISO(dateString);
      const [year, month] = selectedMonth.split('-').map(Number);
      return isSameMonth(date, new Date(year, month - 1));
    } catch {
      return false;
    }
  };

  // Get available years (last 2 years + current year)
  const getYearOptions = () => {
    const years: number[] = [];
    const currentYear = new Date().getFullYear();
    for (let i = 0; i <= 2; i++) {
      years.push(currentYear - i);
    }
    return years;
  };

  // Get current selected year
  const selectedYear = parseInt(selectedMonth.split('-')[0]);
  
  // Generate month options for the selected year
  const getMonthOptions = () => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      const month = String(i + 1).padStart(2, '0');
      const value = `${selectedYear}-${month}`;
      const date = new Date(selectedYear, i, 1);
      months.push({
        value,
        label: format(date, 'MMM'),
        fullLabel: format(date, 'MMMM')
      });
    }
    return months;
  };

  const pendingCases = allocatedCases.filter(c => {
    if (c.status !== 'allocated') return false;
    // Filter by when case was allocated (entered allocated status)
    return isInSelectedMonth(c.allocated_at);
  });
  
  // Helper function to check if case has form responses
  const hasFormResponse = (caseItem: AllocatedCase) => {
    return (caseItem.form_submissions && caseItem.form_submissions.length > 0) ||
           (caseItem.submissions && caseItem.submissions.length > 0);
  };
  
  // Accepted tab: show only accepted cases with NO form response yet (and not rework)
  const acceptedCases = allocatedCases.filter(c => {
    if (c.status !== 'accepted' || c.QC_Response === 'Rework' || hasFormResponse(c)) return false;
    // Filter by when case was accepted (entered accepted status)
    return isInSelectedMonth(c.accepted_at);
  });

  // Debug logging for accepted cases
  console.log('Accepted cases filter debug:', {
    totalCases: allocatedCases.length,
    acceptedCases: acceptedCases.length,
    casesWithoutFormResponse: allocatedCases.filter(c => !hasFormResponse(c)).length,
    acceptedCasesDetails: acceptedCases.map(c => ({
      case_number: c.case_number,
      status: c.status,
      hasFormResponse: hasFormResponse(c),
      QC_Response: c.QC_Response
    }))
  });
  
  // In Progress tab: include normal in_progress OR accepted-with-response (and not rework)
  const inProgressCases = allocatedCases.filter(c => {
    if ((c.status !== 'in_progress' && !(c.status === 'accepted' && hasFormResponse(c))) || c.QC_Response === 'Rework') return false;
    // Filter by when case entered in_progress (first draft saved)
    return isInSelectedMonth(c.in_progress_at);
  });

  // Debug logging for in-progress cases
  console.log('In-progress cases filter debug:', {
    totalInProgressStatus: allocatedCases.filter(c => c.status === 'in_progress').length,
    inProgressCases: inProgressCases.length,
    inProgressCasesDetails: inProgressCases.map(c => ({
      case_number: c.case_number,
      status: c.status,
      hasFormResponse: hasFormResponse(c),
      QC_Response: c.QC_Response
    }))
  });
  const reworkCases = allocatedCases
    .filter(c => {
      // Include cases with QC_Response='Rework' OR status='qc_rework'
      const isReworkCase = c.QC_Response === 'Rework' || c.status === 'qc_rework';
      
      // Debug logging for rework cases
      if (isReworkCase) {
        console.log('Rework case found:', {
          case_number: c.case_number,
          QC_Response: c.QC_Response,
          status: c.status,
          rework_at: c.rework_at,
          allocated_at: c.allocated_at,
          selectedMonth,
          rework_at_in_month: isInSelectedMonth(c.rework_at),
          allocated_at_in_month: isInSelectedMonth(c.allocated_at)
        });
      }
      
      if (!isReworkCase) return false;
      // For rework cases, show if:
      // 1. rework_at is in selected month, OR
      // 2. allocated_at is in selected month (for newly allocated rework cases, regardless of when originally reworked)
      // 3. status is 'qc_rework' (show regardless of month filter to ensure visibility)
      // This ensures newly allocated rework cases appear in the rework tab
      if (c.status === 'qc_rework') return true; // Always show qc_rework status cases
      if (isInSelectedMonth(c.rework_at)) return true;
      if (isInSelectedMonth(c.allocated_at)) return true;
      return false;
    })
    .sort((a, b) => {
      // Sort by submitted_at field in descending order (most recent first)
      const aSubmittedAt = a.actual_submitted_at || a.due_at;
      const bSubmittedAt = b.actual_submitted_at || b.due_at;
      return new Date(bSubmittedAt).getTime() - new Date(aSubmittedAt).getTime();
    });
  const approvedCases = allocatedCases
    .filter(c => {
      if (c.status !== 'qc_passed') return false;
      // Filter by when case was approved (qc_passed)
      return isInSelectedMonth(c.qc_passed_at);
    })
    .sort((a, b) => {
      // Sort by submitted_at field in descending order (most recent first)
      const aSubmittedAt = a.actual_submitted_at || a.due_at;
      const bSubmittedAt = b.actual_submitted_at || b.due_at;
      return new Date(bSubmittedAt).getTime() - new Date(aSubmittedAt).getTime();
    });
  const submittedCases = allocatedCases
    .filter(c => {
      if (c.status !== 'submitted') return false;
      // Filter by when case was submitted (entered submitted status)
      return isInSelectedMonth(c.submitted_at || c.actual_submitted_at);
    })
    .sort((a, b) => {
      // Sort by submitted_at field in descending order (most recent first)
      const aSubmittedAt = a.actual_submitted_at || a.due_at;
      const bSubmittedAt = b.actual_submitted_at || b.due_at;
      return new Date(bSubmittedAt).getTime() - new Date(aSubmittedAt).getTime();
    });

  // Mobile-friendly case card component
  const MobileCaseCard = ({ caseItem, onAccept, onReject, onSubmit, onViewSubmission, showEditDraft = false }: {
    caseItem: AllocatedCase;
    onAccept?: () => void;
    onReject?: () => void;
    onSubmit?: () => void;
    onViewSubmission?: () => void;
    showEditDraft?: boolean;
  }) => {
    const isExpired = (deadline: string, isDirectGig: boolean = false) => {
      // Direct gig workers can accept at any time - no expiration
      if (isDirectGig) return false;
      return new Date() > new Date(deadline);
    };
    const getTimeRemaining = (deadline: string) => {
      const now = new Date();
      const deadlineDate = new Date(deadline);
      const diffMinutes = differenceInMinutes(deadlineDate, now);
      
      if (diffMinutes <= 0) return 'Expired';
      if (diffMinutes < 60) return `${diffMinutes}m`;
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return `${hours}h ${minutes}m`;
    };

    return (
      <Card className="mb-3 shadow-sm border-0 bg-white">
        <CardHeader className="pb-2 px-4 pt-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-2">
              <CardTitle className="text-base font-semibold text-gray-900 truncate leading-tight">
                {caseItem.case_number}
                {caseItem.QC_Response === 'Rework' && (
                  <Badge variant="destructive" className="ml-2 text-xs">
                    Rework
                  </Badge>
                )}
                {isRecreatedCase(caseItem.case_number) && (
                  <Badge variant="outline" className="ml-2 text-xs border-orange-300 text-orange-700 bg-orange-50">
                    Recreated
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-sm text-blue-700 font-medium mt-1">
                Client: {caseItem.clients?.name}
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              {getStatusBadge(caseItem.status, caseItem.id)}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {/* Candidate Info */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600 flex-shrink-0" />
              <span className="font-semibold text-sm text-gray-900">{caseItem.candidate_name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
              <span className="break-all">{caseItem.phone_primary}</span>
              {caseItem.phone_secondary && (
                <>
                  <span className="text-gray-400">•</span>
                  <span className="break-all">{caseItem.phone_secondary}</span>
                </>
              )}
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 leading-tight">
                  {caseItem.locations?.address_line || caseItem.address}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {caseItem.locations?.location_url ? (
                    <a 
                      href={caseItem.locations.location_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline font-medium"
                    >
                      {caseItem.locations?.city || caseItem.city}
                    </a>
                  ) : (
                    <span>{caseItem.locations?.city || caseItem.city}</span>
                  )}, {caseItem.locations?.state || caseItem.state} - {caseItem.locations?.pincode || caseItem.pincode}
                </div>
              </div>
            </div>
          </div>

          {/* Time */}
          <div className="flex items-center justify-end bg-blue-50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-600 flex-shrink-0" />
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                isExpired(caseItem.acceptance_deadline, caseItem.is_direct_gig) 
                  ? 'bg-red-100 text-red-700' 
                  : 'bg-orange-100 text-orange-700'
              }`}>
                {caseItem.is_direct_gig ? 'No time limit' : getTimeRemaining(caseItem.acceptance_deadline)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {onAccept && (
              <Button
                size="sm"
                onClick={onAccept}
                disabled={isExpired(caseItem.acceptance_deadline, caseItem.is_direct_gig)}
                className="flex-1 h-10 text-sm font-medium bg-green-600 hover:bg-green-700 disabled:bg-gray-300"
              >
                <CheckCircle className="h-4 w-4 mr-1.5" />
                Accept
              </Button>
            )}
            {onReject && (
              <Button
                size="sm"
                variant="outline"
                onClick={onReject}
                disabled={isExpired(caseItem.acceptance_deadline, caseItem.is_direct_gig)}
                className="flex-1 h-10 text-sm font-medium border-red-300 text-red-700 hover:bg-red-50 disabled:bg-gray-100"
              >
                <XCircle className="h-4 w-4 mr-1.5" />
                Reject
              </Button>
            )}
            {onSubmit && (
              <Button
                size="sm"
                onClick={onSubmit}
                className="flex-1 h-10 text-sm font-medium bg-blue-600 hover:bg-blue-700"
              >
                <FileText className="h-4 w-4 mr-1.5" />
                {showEditDraft ? 'Edit Draft' : 'Submit'}
              </Button>
            )}
            {onViewSubmission && (
              <Button
                size="sm"
                variant="outline"
                onClick={onViewSubmission}
                className="flex-1 h-10 text-sm font-medium border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                <FileText className="h-4 w-4 mr-1.5" />
                View
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };


  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gig Worker Dashboard</CardTitle>
          <CardDescription>Loading your allocated cases...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${isMobile ? 'min-h-screen bg-gray-50 pb-4' : 'space-y-6'}`}>
      {/* Desktop Header with Notifications */}
      {!isMobile && gigWorkerId && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gig Worker Dashboard</h1>
            <p className="text-gray-600">Manage your assigned background verification cases</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowNotificationTest(!showNotificationTest)}
            className="flex items-center gap-2"
          >
            <Bell className="h-4 w-4" />
            {notificationsEnabled ? 'Notifications On' : 'Setup Notifications'}
          </Button>
        </div>
      )}

      {/* Mobile Header */}
      {isMobile && (
        <div className="bg-white shadow-sm border-b sticky top-0 z-10">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold text-gray-900">Gig Worker Dashboard</h1>
                <p className="text-sm text-gray-600">Background Verification</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500">Total Cases</div>
                <div className="text-lg font-bold text-blue-600">{allocatedCases.length}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Permission Card - Only show when bell button is clicked */}
      {showNotificationTest && gigWorkerId && (
        <div className={isMobile ? 'mx-2 mb-4' : 'mb-4'}>
          <NotificationPermission 
            gigWorkerId={gigWorkerId}
            onPermissionChange={setNotificationsEnabled}
          />
        </div>
      )}

      <Card className={isMobile ? 'mx-2 shadow-sm border-0' : ''}>
        <CardHeader className={isMobile ? 'px-4 py-4' : ''}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className={isMobile ? 'text-lg' : ''}>My Allocated Cases</CardTitle>
              <CardDescription className={isMobile ? 'text-sm' : ''}>
                Manage your assigned background verification cases
              </CardDescription>
            </div>
            {gigWorkerId && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowNotificationTest(!showNotificationTest)}
                className="text-xs"
              >
                🔔 Notifications
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className={isMobile ? 'px-2' : ''}>
          {/* Notification Test Component - Removed duplicate, using main notification card */}
          
          {/* Month Filter */}
          <div className={`mb-4 ${isMobile ? 'px-1' : ''}`}>
            <div className={`flex items-center gap-2 mb-2 ${isMobile ? 'flex-wrap' : ''}`}>
              <Button
                variant={isFilterApplied() ? "default" : "outline"}
                size="sm"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`${isFilterApplied() ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''} ${isMobile ? 'flex-1 min-w-0' : ''}`}
              >
                <Filter className={`h-4 w-4 ${isMobile ? 'mr-1' : 'mr-2'}`} />
                {isMobile ? 'Filter' : 'Filter by Month'}
                {isFilterApplied() && (
                  <span className={`${isMobile ? 'ml-1' : 'ml-2'} px-1.5 py-0.5 bg-blue-700 rounded-full text-xs whitespace-nowrap`}>
                    {format(parseISO(`${selectedMonth}-01`), 'MMM yyyy')}
                  </span>
                )}
              </Button>
              {isFilterApplied() && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilter}
                  className={`text-red-600 hover:text-red-700 hover:bg-red-50 ${isMobile ? 'flex-shrink-0' : ''}`}
                >
                  <X className="h-4 w-4 mr-1" />
                  {isMobile ? 'Clear' : 'Clear Filter'}
                </Button>
              )}
            </div>
            
            {isFilterOpen && (
              <Card className="border-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">Filter by Month</CardTitle>
                    <Select 
                      value={selectedYear.toString()} 
                      onValueChange={(year) => {
                        const currentMonth = selectedMonth.split('-')[1];
                        setSelectedMonth(`${year}-${currentMonth}`);
                      }}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue>{selectedYear}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {getYearOptions().map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {getMonthOptions().map((month) => {
                      const isSelected = selectedMonth === month.value;
                      const [year, monthNum] = month.value.split('-').map(Number);
                      const monthDate = new Date(year, monthNum - 1, 1);
                      const isCurrentMonth = isSameMonth(monthDate, new Date());
                      
                      return (
                        <Button
                          key={month.value}
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setSelectedMonth(month.value);
                            setIsFilterOpen(false); // Close filter after selection
                          }}
                          className={`h-12 ${isSelected ? 'bg-primary text-primary-foreground' : ''} ${
                            isCurrentMonth && !isSelected ? 'border-primary/50' : ''
                          }`}
                        >
                          <div className="flex flex-col items-center">
                            <span className="text-xs font-medium">{month.label}</span>
                            {isCurrentMonth && !isSelected && (
                              <span className="text-[10px] text-muted-foreground">Current</span>
                            )}
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Tabs defaultValue="pending" className="w-full">
            <TabsList className={`grid w-full ${isMobile ? 'grid-cols-6 gap-1 h-12' : 'grid-cols-6'} ${isMobile ? 'overflow-x-auto' : ''}`}>
              <TabsTrigger 
                value="pending" 
                className={isMobile ? 'text-xs px-2 min-w-0 h-10 text-center flex flex-col items-center justify-center py-1' : ''}
              >
                <span className={isMobile ? 'text-xs font-medium' : ''}>
                  {isMobile ? 'Pending' : 'Pending'}
                </span>
                <span className={isMobile ? 'text-xs font-bold text-blue-600' : ''}>
                  ({pendingCases.length})
                </span>
              </TabsTrigger>
              <TabsTrigger 
                value="accepted" 
                className={isMobile ? 'text-xs px-2 min-w-0 h-10 text-center flex flex-col items-center justify-center py-1' : ''}
              >
                <span className={isMobile ? 'text-xs font-medium' : ''}>
                  {isMobile ? 'Accepted' : 'Accepted'}
                </span>
                <span className={isMobile ? 'text-xs font-bold text-green-600' : ''}>
                  ({acceptedCases.length})
                </span>
              </TabsTrigger>
              <TabsTrigger 
                value="in_progress" 
                className={isMobile ? 'text-xs px-2 min-w-0 h-10 text-center flex flex-col items-center justify-center py-1' : ''}
              >
                <span className={isMobile ? 'text-xs font-medium' : ''}>
                  {isMobile ? 'Progress' : 'In Progress'}
                </span>
                <span className={isMobile ? 'text-xs font-bold text-orange-600' : ''}>
                  ({inProgressCases.length})
                </span>
              </TabsTrigger>
              <TabsTrigger 
                value="rework" 
                className={isMobile ? 'text-xs px-2 min-w-0 h-10 text-center flex flex-col items-center justify-center py-1' : ''}
              >
                <span className={isMobile ? 'text-xs font-medium' : ''}>
                  {isMobile ? 'Rework' : 'Rework'}
                </span>
                <span className={isMobile ? 'text-xs font-bold text-red-600' : ''}>
                  ({reworkCases.length})
                </span>
              </TabsTrigger>
              <TabsTrigger 
                value="approved" 
                className={isMobile ? 'text-xs px-2 min-w-0 h-10 text-center flex flex-col items-center justify-center py-1' : ''}
              >
                <span className={isMobile ? 'text-xs font-medium' : ''}>
                  {isMobile ? 'Approved' : 'Approved'}
                </span>
                <span className={isMobile ? 'text-xs font-bold text-green-600' : ''}>
                  ({approvedCases.length})
                </span>
              </TabsTrigger>
              <TabsTrigger 
                value="submitted" 
                className={isMobile ? 'text-xs px-2 min-w-0 h-10 text-center flex flex-col items-center justify-center py-1' : ''}
              >
                <span className={isMobile ? 'text-xs font-medium' : ''}>
                  {isMobile ? 'Submitted' : 'Submitted'}
                </span>
                <span className={isMobile ? 'text-xs font-bold text-purple-600' : ''}>
                  ({submittedCases.length})
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className={`space-y-4 ${isMobile ? 'px-1' : ''}`}>
              {pendingCases.length === 0 ? (
                <Alert className={isMobile ? 'mx-2' : ''}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No pending cases to accept or reject.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {isMobile ? (
                    // Mobile: Card layout
                    <div className="space-y-3 px-1">
                      {pendingCases.map((caseItem) => (
                        <MobileCaseCard
                          key={caseItem.id}
                          caseItem={caseItem}
                          onAccept={() => {
                            setSelectedCase(caseItem);
                            setIsAcceptDialogOpen(true);
                          }}
                          onReject={() => {
                            setSelectedCase(caseItem);
                            setIsRejectDialogOpen(true);
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    // Desktop: Table layout
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Case Number</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Candidate</TableHead>
                          <TableHead>Location</TableHead>
                          {!shouldHidePayoutSection(pendingCases[0] || {} as AllocatedCase) && <TableHead>Payout</TableHead>}
                          <TableHead>Time Remaining</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingCases.map((caseItem) => (
                          <TableRow key={caseItem.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {caseItem.case_number}
                                {caseItem.QC_Response === 'Rework' && (
                                  <Badge variant="destructive" className="text-xs">
                                    Rework
                                  </Badge>
                                )}
                                {isRecreatedCase(caseItem.case_number) && (
                                  <Badge variant="outline" className="text-xs border-orange-300 text-orange-700 bg-orange-50">
                                    Recreated
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{caseItem.clients?.name}</TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{caseItem.candidate_name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {caseItem.phone_primary}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 text-sm">
                                  <MapPin className="h-3 w-3" />
                                  {caseItem.locations?.location_url ? (
                                    <a 
                                      href={caseItem.locations.location_url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 underline font-medium"
                                    >
                                      {caseItem.locations?.address_line || caseItem.address}
                                    </a>
                                  ) : (
                                    <span>{caseItem.locations?.address_line || caseItem.address}</span>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {caseItem.locations?.city || caseItem.city}, {caseItem.locations?.state || caseItem.state} - {caseItem.locations?.pincode || caseItem.pincode}
                                </div>
                              </div>
                            </TableCell>
                            {!shouldHidePayoutSection(caseItem) && (
                              <TableCell>
                                <div className="font-medium">
                                  ₹{caseItem.total_payout_inr}
                                </div>
                              </TableCell>
                            )}
                            <TableCell>
                              <div className={`text-sm ${isExpired(caseItem.acceptance_deadline, caseItem.is_direct_gig) ? 'text-red-600' : 'text-orange-600'}`}>
                                {caseItem.is_direct_gig ? 'No time limit' : getTimeRemaining(caseItem.acceptance_deadline)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedCase(caseItem);
                                    setIsAcceptDialogOpen(true);
                                  }}
                                  disabled={isExpired(caseItem.acceptance_deadline, caseItem.is_direct_gig)}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedCase(caseItem);
                                    setIsRejectDialogOpen(true);
                                  }}
                                  disabled={isExpired(caseItem.acceptance_deadline, caseItem.is_direct_gig)}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="accepted" className={`space-y-4 ${isMobile ? 'px-1' : ''}`}>
              {acceptedCases.length === 0 ? (
                <Alert className={isMobile ? 'mx-2' : ''}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No accepted cases. Accept cases from the Pending tab or cases without form responses will appear here.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {isMobile ? (
                    // Mobile: Card layout
                    <div className="space-y-3 px-1">
                      {acceptedCases.map((caseItem) => (
                        <MobileCaseCard
                          key={caseItem.id}
                          caseItem={caseItem}
                          onSubmit={() => handleSubmitResponse(caseItem)}
                        />
                      ))}
                    </div>
                  ) : (
                    // Desktop: Table layout
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Case Number</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Candidate</TableHead>
                          <TableHead>Location</TableHead>
                          {!shouldHidePayoutSection(acceptedCases[0] || {} as AllocatedCase) && <TableHead>Payout</TableHead>}
                          <TableHead>Due Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {acceptedCases.map((caseItem) => (
                          <TableRow key={caseItem.id}>
                            <TableCell className="font-medium">
                              {caseItem.case_number}
                            </TableCell>
                            <TableCell>{caseItem.clients?.name}</TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{caseItem.candidate_name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {caseItem.phone_primary}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 text-sm">
                                  <MapPin className="h-3 w-3" />
                                  {caseItem.locations?.location_url ? (
                                    <a 
                                      href={caseItem.locations.location_url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 underline font-medium"
                                    >
                                      {caseItem.locations?.address_line || caseItem.address}
                                    </a>
                                  ) : (
                                    <span>{caseItem.locations?.address_line || caseItem.address}</span>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {caseItem.locations?.city || caseItem.city}, {caseItem.locations?.state || caseItem.state} - {caseItem.locations?.pincode || caseItem.pincode}
                                </div>
                              </div>
                            </TableCell>
                            {!shouldHidePayoutSection(caseItem) && (
                              <TableCell>
                                <div className="font-medium">
                                  ₹{caseItem.total_payout_inr}
                                </div>
                              </TableCell>
                            )}
                            <TableCell>
                              <div className="text-sm">
                                {format(new Date(caseItem.due_at), 'MMM dd, yyyy HH:mm')}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                onClick={() => handleSubmitResponse(caseItem)}
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                Submit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="in_progress" className={`space-y-4 ${isMobile ? 'px-1' : ''}`}>
              {inProgressCases.length === 0 ? (
                <Alert className={isMobile ? 'mx-2' : ''}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No cases in progress. Cases with form responses will appear here.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {isMobile ? (
                    // Mobile: Card layout
                    <div className="space-y-3 px-1">
                      {inProgressCases.map((caseItem) => (
                        <MobileCaseCard
                          key={caseItem.id}
                          caseItem={caseItem}
                          onSubmit={() => handleSubmitResponse(caseItem)}
                          onViewSubmission={() => handleViewSubmission(caseItem)}
                          showEditDraft={true}
                        />
                      ))}
                    </div>
                  ) : (
                    // Desktop: Table layout
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Case Number</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Candidate</TableHead>
                          <TableHead>Location</TableHead>
                          {!shouldHidePayoutSection(inProgressCases[0] || {} as AllocatedCase) && <TableHead>Payout</TableHead>}
                          <TableHead>Due Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inProgressCases.map((caseItem) => (
                          <TableRow key={caseItem.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {caseItem.case_number}
                                {caseItem.QC_Response === 'Rework' && (
                                  <Badge variant="destructive" className="text-xs">
                                    Rework
                                  </Badge>
                                )}
                                {isRecreatedCase(caseItem.case_number) && (
                                  <Badge variant="outline" className="text-xs border-orange-300 text-orange-700 bg-orange-50">
                                    Recreated
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{caseItem.clients?.name || 'N/A'}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="font-medium">{caseItem.candidate_name}</div>
                                <div className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {caseItem.phone_primary}
                                </div>
                                {caseItem.phone_secondary && (
                                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {caseItem.phone_secondary}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 text-sm">
                                  <MapPin className="h-3 w-3" />
                                  {caseItem.locations?.location_url ? (
                                    <a 
                                      href={caseItem.locations.location_url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 underline font-medium"
                                    >
                                      {caseItem.locations?.address_line || caseItem.address}
                                    </a>
                                  ) : (
                                    <span>{caseItem.locations?.address_line || caseItem.address}</span>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {caseItem.locations?.city || caseItem.city}, {caseItem.locations?.state || caseItem.state} - {caseItem.locations?.pincode || caseItem.pincode}
                                </div>
                              </div>
                            </TableCell>
                            {!shouldHidePayoutSection(caseItem) && (
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="font-medium">
                                    ₹{caseItem.total_payout_inr}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    Base: ₹{caseItem.base_rate_inr}
                                  </div>
                                </div>
                              </TableCell>
                            )}
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(caseItem.due_at), 'MMM dd, yyyy')}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {isExpired(caseItem.due_at) ? (
                                    <span className="text-red-600">Overdue</span>
                                  ) : (
                                    formatTimeRemaining(differenceInMinutes(new Date(caseItem.due_at), new Date()))
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSubmitResponse(caseItem)}
                                  className="bg-blue-600 hover:bg-blue-700"
                                >
                                  <FileText className="h-4 w-4 mr-1" />
                                  Continue Draft
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleViewSubmission(caseItem)}
                                >
                                  View Submission
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="submitted" className={`space-y-4 ${isMobile ? 'px-1' : ''}`}>
              {submittedCases.length === 0 ? (
                <Alert className={isMobile ? 'mx-2' : ''}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No submitted cases yet. Submit cases from the Accepted tab.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {isMobile ? (
                    // Mobile: Card layout
                    <div className="space-y-3 px-1">
                      {submittedCases.map((caseItem) => (
                        <MobileCaseCard
                          key={caseItem.id}
                          caseItem={caseItem}
                          onViewSubmission={() => {
                            setSelectedSubmissionCase(caseItem);
                            setIsViewSubmissionDialogOpen(true);
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    // Desktop: Table layout
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Case Number</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Candidate</TableHead>
                          <TableHead>Location</TableHead>
                          {!shouldHidePayoutSection(submittedCases[0] || {} as AllocatedCase) && <TableHead>Payout</TableHead>}
                          <TableHead>Submitted At</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {submittedCases.map((caseItem) => (
                          <TableRow key={caseItem.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {caseItem.case_number}
                                {caseItem.QC_Response === 'Rework' && (
                                  <Badge variant="destructive" className="text-xs">
                                    Rework
                                  </Badge>
                                )}
                                {isRecreatedCase(caseItem.case_number) && (
                                  <Badge variant="outline" className="text-xs border-orange-300 text-orange-700 bg-orange-50">
                                    Recreated
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{caseItem.clients?.name}</TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{caseItem.candidate_name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {caseItem.phone_primary}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 text-sm">
                                  <MapPin className="h-3 w-3" />
                                  {caseItem.locations?.location_url ? (
                                    <a 
                                      href={caseItem.locations.location_url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 underline font-medium"
                                    >
                                      {caseItem.locations?.address_line || caseItem.address}
                                    </a>
                                  ) : (
                                    <span>{caseItem.locations?.address_line || caseItem.address}</span>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {caseItem.locations?.city || caseItem.city}, {caseItem.locations?.state || caseItem.state} - {caseItem.locations?.pincode || caseItem.pincode}
                                </div>
                              </div>
                            </TableCell>
                            {!shouldHidePayoutSection(caseItem) && (
                              <TableCell>
                                <div className="font-medium">
                                  ₹{caseItem.total_payout_inr}
                                </div>
                              </TableCell>
                            )}
                            <TableCell>
                              <div className="text-sm">
                                {(() => {
                                  console.log('Case submission debug:', {
                                    case_number: caseItem.case_number,
                                    status: caseItem.status,
                                    actual_submitted_at: caseItem.actual_submitted_at,
                                    vendor_tat_start_date: caseItem.vendor_tat_start_date
                                  });
                                  
                                  if (caseItem.actual_submitted_at) {
                                    return format(new Date(caseItem.actual_submitted_at), 'MMM dd, yyyy HH:mm');
                                  } else {
                                    return format(new Date(caseItem.vendor_tat_start_date), 'MMM dd, yyyy HH:mm');
                                  }
                                })()}
                              </div>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(caseItem.status, caseItem.id)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedSubmissionCase(caseItem);
                                  setIsViewSubmissionDialogOpen(true);
                                }}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                View Submission
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="rework" className={`space-y-4 ${isMobile ? 'px-1' : ''}`}>
              {reworkCases.length === 0 ? (
                <Alert className={isMobile ? 'mx-2' : ''}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No rework cases at the moment.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {isMobile ? (
                    // Mobile: Card layout
                    <div className="space-y-3 px-1">
                      {reworkCases.map((caseItem) => (
                        <MobileCaseCard
                          key={caseItem.id}
                          caseItem={caseItem}
                          onViewSubmission={() => {
                            setSelectedSubmissionCase(caseItem);
                            setIsViewSubmissionDialogOpen(true);
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    // Desktop: Table layout
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Case Number</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Candidate</TableHead>
                          <TableHead>Location</TableHead>
                          {!shouldHidePayoutSection(reworkCases[0] || {} as AllocatedCase) && <TableHead>Payout</TableHead>}
                          <TableHead>Due Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reworkCases.map((caseItem) => (
                          <TableRow key={caseItem.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {caseItem.case_number}
                                <Badge variant="destructive" className="text-xs">
                                  Rework
                                </Badge>
                                {isRecreatedCase(caseItem.case_number) && (
                                  <Badge variant="outline" className="text-xs border-orange-300 text-orange-700 bg-orange-50">
                                    Recreated
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{caseItem.clients?.name}</TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{caseItem.candidate_name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {caseItem.phone_primary}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 text-sm">
                                  <MapPin className="h-3 w-3" />
                                  {caseItem.locations?.location_url ? (
                                    <a 
                                      href={caseItem.locations.location_url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 underline font-medium"
                                    >
                                      {caseItem.locations?.address_line || caseItem.address}
                                    </a>
                                  ) : (
                                    <span>{caseItem.locations?.address_line || caseItem.address}</span>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {caseItem.locations?.city || caseItem.city}, {caseItem.locations?.state || caseItem.state} - {caseItem.locations?.pincode || caseItem.pincode}
                                </div>
                              </div>
                            </TableCell>
                            {!shouldHidePayoutSection(caseItem) && (
                              <TableCell>
                                <div className="font-medium">
                                  ₹{caseItem.total_payout_inr}
                                </div>
                              </TableCell>
                            )}
                            <TableCell>
                              <div className="text-sm">
                                {format(new Date(caseItem.due_at), 'MMM dd, yyyy HH:mm')}
                              </div>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(caseItem.status, caseItem.id)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedSubmissionCase(caseItem);
                                  setIsViewSubmissionDialogOpen(true);
                                }}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                View Submission
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="approved" className={`space-y-4 ${isMobile ? 'px-1' : ''}`}>
              {approvedCases.length === 0 ? (
                <Alert className={isMobile ? 'mx-2' : ''}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No approved cases at the moment.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {isMobile ? (
                    // Mobile: Card layout
                    <div className="space-y-3 px-1">
                      {approvedCases.map((caseItem) => (
                        <MobileCaseCard
                          key={caseItem.id}
                          caseItem={caseItem}
                          onViewSubmission={() => {
                            setSelectedSubmissionCase(caseItem);
                            setIsViewSubmissionDialogOpen(true);
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    // Desktop: Table layout
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Case Number</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Candidate</TableHead>
                          <TableHead>Location</TableHead>
                          {!shouldHidePayoutSection(approvedCases[0] || {} as AllocatedCase) && <TableHead>Payout</TableHead>}
                          <TableHead>Submitted At</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {approvedCases.map((caseItem) => (
                          <TableRow key={caseItem.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {caseItem.case_number}
                                {isRecreatedCase(caseItem.case_number) && (
                                  <Badge variant="outline" className="text-xs border-orange-300 text-orange-700 bg-orange-50">
                                    Recreated
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{caseItem.clients?.name}</TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{caseItem.candidate_name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {caseItem.phone_primary}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 text-sm">
                                  <MapPin className="h-3 w-3" />
                                  {caseItem.locations?.location_url ? (
                                    <a 
                                      href={caseItem.locations.location_url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 underline font-medium"
                                    >
                                      {caseItem.locations?.address_line || caseItem.address}
                                    </a>
                                  ) : (
                                    <span>{caseItem.locations?.address_line || caseItem.address}</span>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {caseItem.locations?.city || caseItem.city}, {caseItem.locations?.state || caseItem.state} - {caseItem.locations?.pincode || caseItem.pincode}
                                </div>
                              </div>
                            </TableCell>
                            {!shouldHidePayoutSection(caseItem) && (
                              <TableCell>
                                <div className="font-medium">
                                  ₹{caseItem.total_payout_inr}
                                </div>
                              </TableCell>
                            )}
                            <TableCell>
                              <div className="text-sm">
                                {(() => {
                                  if (caseItem.actual_submitted_at) {
                                    return format(new Date(caseItem.actual_submitted_at), 'MMM dd, yyyy HH:mm');
                                  } else {
                                    return format(new Date(caseItem.vendor_tat_start_date), 'MMM dd, yyyy HH:mm');
                                  }
                                })()}
                              </div>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(caseItem.status, caseItem.id)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedSubmissionCase(caseItem);
                                  setIsViewSubmissionDialogOpen(true);
                                }}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                View Submission
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Accept Case Dialog */}
      <Dialog open={isAcceptDialogOpen} onOpenChange={setIsAcceptDialogOpen}>
        <DialogContent className={isMobile ? 'max-w-[95vw] max-h-[90vh] mx-2 my-2' : ''}>
          <DialogHeader>
            <DialogTitle>Accept Case</DialogTitle>
            <DialogDescription>
              Are you sure you want to accept this case? You will be responsible for completing it within the specified timeframe.
            </DialogDescription>
          </DialogHeader>
          {selectedCase && (
            <div className="space-y-4">
              <div className={`grid gap-4 text-sm ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
                <div>
                  <span className="font-medium">Case Number:</span> {selectedCase.case_number}
                </div>
                <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-500">
                  <span className="font-semibold text-blue-900">Client:</span> 
                  <span className="ml-2 text-blue-800 font-medium text-lg">{selectedCase.clients?.name}</span>
                </div>
                <div>
                  <span className="font-medium">Candidate:</span> {selectedCase.candidate_name}
                </div>
                <div>
                  <span className="font-medium">Location:</span> 
                  {selectedCase.locations?.location_url ? (
                    <a 
                      href={selectedCase.locations.location_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline ml-1"
                    >
                      {selectedCase.locations?.city}
                    </a>
                  ) : (
                    <span className="ml-1">{selectedCase.locations?.city}</span>
                  )}
                </div>
                {!shouldHidePayoutSection(selectedCase) && (
                  <div>
                    <span className="font-medium">Payout:</span> ₹{selectedCase.total_payout_inr}
                  </div>
                )}
                <div>
                  <span className="font-medium">Due Date:</span> {format(new Date(selectedCase.due_at), 'MMM dd, yyyy HH:mm')}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className={isMobile ? 'flex-col gap-2' : ''}>
            <Button variant="outline" onClick={() => setIsAcceptDialogOpen(false)} className={isMobile ? 'w-full' : ''}>
              Cancel
            </Button>
            <Button onClick={handleAcceptCase} className={isMobile ? 'w-full' : ''}>
              Accept Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Case Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className={isMobile ? 'max-w-[95vw] max-h-[90vh] mx-2 my-2' : ''}>
          <DialogHeader>
            <DialogTitle>Reject Case</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this case. The case will be reassigned to another gig worker.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Reason for rejection:</label>
              <textarea
                className="w-full mt-1 p-2 border rounded-md"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Please provide a reason for rejecting this case..."
              />
            </div>
          </div>
          <DialogFooter className={isMobile ? 'flex-col gap-2' : ''}>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)} className={isMobile ? 'w-full' : ''}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRejectCase} className={isMobile ? 'w-full' : ''}>
              Reject Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Positive/Negative Selection Dialog */}
      <Dialog 
        open={isPositiveNegativeDialogOpen} 
        onOpenChange={(open) => {
          setIsPositiveNegativeDialogOpen(open);
          if (!open) {
            setPendingCaseForForm(null);
          }
        }}
      >
        <DialogContent className={isMobile ? 'max-w-[95vw] mx-2 my-2' : 'max-w-md'}>
          <DialogHeader>
            <DialogTitle>Case Type Selection</DialogTitle>
            <DialogDescription>
              Please select the case type before proceeding.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center">
              <p className="text-lg font-medium mb-6">Positive/Negative</p>
            </div>
            <div className="flex gap-4 justify-center">
              <Button
                onClick={handlePositiveSelection}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                size="lg"
              >
                Positive
              </Button>
              <Button
                onClick={handleNegativeSelection}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                size="lg"
              >
                Negative
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsPositiveNegativeDialogOpen(false);
                setPendingCaseForForm(null);
              }} 
              className={isMobile ? 'w-full' : ''}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit Case Dialog */}
      <Dialog open={isSubmissionDialogOpen} onOpenChange={setIsSubmissionDialogOpen}>
        <DialogContent className={`${isMobile ? 'max-w-[95vw] max-h-[95vh] mx-2' : 'max-w-4xl max-h-[90vh]'} flex flex-col`}>
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              {isNegativeForm ? 'Submit Negative Case' : 'Submit Case'}
            </DialogTitle>
            <DialogDescription>
              {isNegativeForm 
                ? 'Fill in the negative case verification details and submit your findings.'
                : 'Fill in the verification details and submit your findings.'
              }
            </DialogDescription>
          </DialogHeader>
           <div className="flex-1 overflow-y-auto">
             {selectedCase && (
               <>
                 {/* QC Review Details for QC Rework Cases */}
                 {allQcReviewData[selectedCase.id] && (
                   <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                     <h4 className="font-semibold text-red-900 flex items-center gap-2 mb-3">
                       <AlertCircle className="h-5 w-5" />
                       QC Review - Rework Required
                     </h4>
                     <div className="space-y-3 text-sm">
                       <div className="bg-red-100 rounded-lg p-3">
                         <div className="font-medium text-red-800 mb-1">QC Decision: Rework Required</div>
                         <div className="text-red-700">
                           Reviewed by: QC Team (ID: {allQcReviewData[selectedCase.id].reviewer_id})
                         </div>
                         <div className="text-red-700">
                           Reviewed on: {new Date(allQcReviewData[selectedCase.id].reviewed_at).toLocaleString()}
                         </div>
                       </div>
                       
                       {allQcReviewData[selectedCase.id].issues_found && allQcReviewData[selectedCase.id].issues_found.length > 0 && (
                         <div>
                           <div className="font-medium text-gray-900 mb-2">Issues Found:</div>
                           <div className="space-y-1">
                             {allQcReviewData[selectedCase.id].issues_found.map((issue: string, index: number) => (
                               <div key={index} className="bg-yellow-50 rounded p-2 text-sm">
                                 • {issue.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                               </div>
                             ))}
                           </div>
                         </div>
                       )}
                       
                       {allQcReviewData[selectedCase.id].rework_instructions && (
                         <div>
                           <div className="font-medium text-gray-900 mb-2">Rework Instructions:</div>
                           <div className="bg-blue-50 rounded-lg p-3 text-sm">
                             {allQcReviewData[selectedCase.id].rework_instructions}
                           </div>
                         </div>
                       )}
                       
                       {allQcReviewData[selectedCase.id].rework_deadline && (
                         <div>
                           <div className="font-medium text-gray-900 mb-2">Original Rework Deadline:</div>
                           <div className="bg-orange-50 rounded-lg p-3 text-sm">
                             <div className="flex items-center gap-2">
                               <Clock className="h-4 w-4 text-orange-600" />
                               <span className="text-orange-800">
                                 {new Date(allQcReviewData[selectedCase.id].rework_deadline).toLocaleString()}
                               </span>
                             </div>
                           </div>
                         </div>
                       )}
                     </div>
                   </div>
                 )}
                 
                 <DynamicForm
                   contractTypeId={selectedCase.contract_type}
                   caseId={selectedCase.id}
                   gigWorkerId={gigWorkerId}
                   onSubmit={handleDynamicFormSubmit}
                   onSaveDraft={handleSaveDraft}
                   onAutoSave={handleImmediateSave}
                   onCancel={() => {
                     setIsSubmissionDialogOpen(false);
                     setDraftData(null);
                     setIsNegativeForm(false);
                   }}
                   loading={isSubmitting}
                   draftData={draftData}
                   isAutoSaving={isSaving}
                   lastAutoSaveTime={lastSaveTime}
                   isNegative={isNegativeForm}
                   caseData={{
                     id: selectedCase.id,
                     case_number: selectedCase.case_number,
                     client_case_id: selectedCase.client_case_id,
                     candidate_name: selectedCase.candidate_name,
                     phone_primary: selectedCase.phone_primary,
                     location: {
                       address_line: selectedCase.locations?.address_line || selectedCase.address,
                       city: selectedCase.locations?.city || selectedCase.city,
                       pincode: selectedCase.locations?.pincode || selectedCase.pincode
                     },
                      fi_type: selectedCase.fi_type,
                      company_name: (selectedCase as any).company_name
                   }}
                 />
               </>
             )}
           </div>
        </DialogContent>
      </Dialog>

      {/* View Form Submission Dialog */}
      <Dialog open={isViewSubmissionDialogOpen} onOpenChange={setIsViewSubmissionDialogOpen}>
        <DialogContent className={`${isMobile ? 'max-w-[95vw] max-h-[95vh] mx-2' : 'max-w-6xl max-h-[90vh]'} flex flex-col`}>
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {selectedSubmissionCase?.QC_Response === 'Rework' 
                ? (isEditMode ? 'Edit Previous Submission (Rework Case)' : 'Previous Submission Details (Rework Case)')
                : selectedSubmissionCase?.status === 'in_progress' 
                  ? 'Current Draft Details' 
                  : 'Form Submission Details'
              }
              {isEditMode && isSaving && (
                <div className="flex items-center gap-1 text-sm text-blue-600">
                  <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full"></div>
                  <span>Auto-saving...</span>
                </div>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedSubmissionCase?.QC_Response === 'Rework'
                ? (isEditMode 
                    ? 'Edit your previous submission. Changes are automatically saved as you type.'
                    : 'This case was marked for rework. View your previous submission that needs to be corrected.'
                  )
                : selectedSubmissionCase?.status === 'in_progress' 
                  ? 'View the current saved answers and files for this case.' 
                  : 'View the submitted form data and files for this case.'
              }
            </DialogDescription>
          </DialogHeader>
          <div className={`flex-1 overflow-hidden ${isEditMode ? (isMobile ? 'pb-32' : 'pb-24') : ''}`}>
            {selectedSubmissionCase && (
              <>
                {/* QC Review Details for QC Rework Cases */}
                {qcReviewData && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h4 className="font-semibold text-red-900 flex items-center gap-2 mb-3">
                      <AlertCircle className="h-5 w-5" />
                      QC Review - Rework Required
                    </h4>
                    <div className="space-y-3 text-sm">
                      <div className="bg-red-100 rounded-lg p-3">
                        <div className="font-medium text-red-800 mb-1">QC Decision: Rework Required</div>
                        <div className="text-red-700">
                          Reviewed by: QC Team (ID: {qcReviewData.reviewer_id})
                        </div>
                        <div className="text-red-700">
                          Reviewed on: {new Date(qcReviewData.reviewed_at).toLocaleString()}
                        </div>
                      </div>
                      
                      {/* QC Remarks/Comments */}
                      {qcReviewData.comments && (
                        <div>
                          <div className="font-medium text-gray-900 mb-2">QC Remarks:</div>
                          <div className="bg-purple-50 rounded-lg p-3 text-sm whitespace-pre-wrap">
                            {qcReviewData.comments}
                          </div>
                        </div>
                      )}
                      
                      {/* Reason Code */}
                      {qcReviewData.reason_code && (
                        <div>
                          <div className="font-medium text-gray-900 mb-2">Reason Code:</div>
                          <div className="bg-indigo-50 rounded-lg p-3 text-sm">
                            {qcReviewData.reason_code.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          </div>
                        </div>
                      )}
                      
                      {/* Issues Found */}
                      {qcReviewData.issues_found && qcReviewData.issues_found.length > 0 && (
                        <div>
                          <div className="font-medium text-gray-900 mb-2">Issues Found:</div>
                          <div className="space-y-1">
                            {qcReviewData.issues_found.map((issue: string, index: number) => (
                              <div key={index} className="bg-yellow-50 rounded p-2 text-sm">
                                • {issue.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Rework Instructions */}
                      {qcReviewData.rework_instructions && (
                        <div>
                          <div className="font-medium text-gray-900 mb-2">Rework Instructions:</div>
                          <div className="bg-blue-50 rounded-lg p-3 text-sm whitespace-pre-wrap">
                            {qcReviewData.rework_instructions}
                          </div>
                        </div>
                      )}
                      
                      {qcReviewData.rework_deadline && (
                        <div>
                          <div className="font-medium text-gray-900 mb-2">Original Rework Deadline:</div>
                          <div className="bg-orange-50 rounded-lg p-3 text-sm">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-orange-600" />
                              <span className="text-orange-800">
                                {new Date(qcReviewData.rework_deadline).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {isEditMode ? (
                  // Edit Mode - Show DynamicForm
                  <DynamicForm
                    ref={formRef}
                    contractTypeId={selectedSubmissionCase.contract_type}
                    caseId={selectedSubmissionCase.id}
                    gigWorkerId={gigWorkerId}
                    onSubmit={handleDynamicFormSubmit}
                    onSaveDraft={handleSaveDraft}
                    onAutoSave={handleImmediateSave}
                    onCancel={() => {
                      setIsEditMode(false);
                      setDraftData(null);
                    }}
                    loading={isSubmitting}
                    draftData={draftData}
                    isAutoSaving={isSaving}
                    lastAutoSaveTime={lastSaveTime}
                    hideFooterButtons={true}
                    caseData={{
                      id: selectedSubmissionCase.id,
                      case_number: selectedSubmissionCase.case_number,
                      client_case_id: selectedSubmissionCase.client_case_id,
                      candidate_name: selectedSubmissionCase.candidate_name,
                      phone_primary: selectedSubmissionCase.phone_primary,
                      location: {
                        address_line: selectedSubmissionCase.locations.address_line,
                        city: selectedSubmissionCase.locations.city,
                        pincode: selectedSubmissionCase.locations.pincode
                      },
                      fi_type: selectedSubmissionCase.fi_type,
                      company_name: (selectedSubmissionCase as any).company_name
                    }}
                  />
                ) : (
                  // View Mode - Show submission details
                  <DynamicFormSubmission caseId={selectedSubmissionCase.id} />
                )}
              </>
            )}
          </div>
          <DialogFooter className="flex-shrink-0">
            <div className={`flex gap-2 w-full ${isMobile ? 'flex-col' : 'flex-row justify-end items-center'}`}>
              {isEditMode && (
                <>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setIsEditMode(false);
                      setDraftData(null);
                    }}
                    disabled={isSubmitting}
                    className={isMobile ? 'w-full' : ''}
                  >
                    Cancel
                  </Button>
                  {handleSaveDraft && (
                    <Button 
                      variant="secondary" 
                      onClick={() => {
                        if (formRef.current) {
                          formRef.current.saveDraft();
                        }
                      }}
                      disabled={isSubmitting || isSaving}
                      className={isMobile ? 'w-full' : ''}
                    >
                      {isSaving ? 'Saving...' : 'Save as Draft'}
                    </Button>
                  )}
                  <Button 
                    onClick={() => {
                      if (formRef.current) {
                        formRef.current.submit();
                      }
                    }}
                    disabled={isSubmitting || (formRef.current && !formRef.current.isFormComplete())}
                    className={isMobile ? 'w-full' : ''}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Form'}
                  </Button>
                </>
              )}
              {!isEditMode && (selectedSubmissionCase?.QC_Response === 'Rework' || selectedSubmissionCase?.status === 'qc_rework') && 
               (selectedSubmissionCase?.status === 'accepted' || selectedSubmissionCase?.status === 'allocated' || selectedSubmissionCase?.status === 'qc_rework') && (
                <Button 
                  onClick={() => handleStartEditing(selectedSubmissionCase)}
                  className={isMobile ? 'w-full' : ''}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Edit & Resubmit
                </Button>
              )}
              <Button variant="outline" onClick={() => {
                setIsViewSubmissionDialogOpen(false);
                setIsEditMode(false);
                setDraftData(null);
              }} className={isMobile ? 'w-full' : ''}>
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Draft Resume Dialog */}
      <Dialog open={isDraftResumeDialogOpen} onOpenChange={setIsDraftResumeDialogOpen}>
        <DialogContent className={isMobile ? 'max-w-[95vw] mx-2 my-2' : 'max-w-md'}>
          <DialogHeader>
            <DialogTitle>
              {pendingDraftCase?.QC_Response === 'Rework' ? 'Resume Previous Submission or Start Fresh?' : 'Resume Draft or Start Fresh?'}
            </DialogTitle>
            <DialogDescription>
              {pendingDraftCase?.QC_Response === 'Rework' 
                ? 'This case was marked for rework. Your previous submission has been loaded. Would you like to continue editing your previous work or start with a fresh form?'
                : 'A draft exists for this case. Would you like to continue editing your previous work or start with a fresh form?'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <Button 
              onClick={handleResumeDraft}
              className="w-full"
            >
              <FileText className="h-4 w-4 mr-2" />
              {pendingDraftCase?.QC_Response === 'Rework' ? 'Continue Editing Previous Submission' : 'Continue Editing Draft'}
            </Button>
            <Button 
              onClick={handleStartFresh}
              variant="outline"
              className="w-full"
            >
              {pendingDraftCase?.QC_Response === 'Rework' ? 'Start Fresh (Ignore Previous Submission)' : 'Start Fresh (Delete Draft)'}
            </Button>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsDraftResumeDialogOpen(false);
                setPendingDraftCase(null);
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
