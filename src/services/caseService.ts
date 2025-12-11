import { supabase } from '@/integrations/supabase/client';
import { PayoutCalculationService } from './payoutCalculationService';
import { pincodeTierService } from './pincodeTierService';

export interface Case {
  id: string;
  case_number: string;
  client_case_id: string;
  contract_type: string;
  candidate_name: string;
  company_name?: string;
  phone_primary: string;
  phone_secondary?: string;
  status: 'new' | 'allocated' | 'accepted' | 'pending_allocation' | 'in_progress' | 'submitted' | 'qc_passed' | 'qc_rejected' | 'qc_rework' | 'reported' | 'in_payment_cycle' | 'payment_complete' | 'cancelled' | 'auto_allocated' | 'completed';
  client: {
    id: string;
    name: string;
    contact_person: string;
    phone: string;
    email: string;
  };
  location: {
    id: string;
    address_line: string;
    city: string;
    state: string;
    pincode: string;
    pincode_tier?: string;
    lat?: number;
    lng?: number;
    location_url?: string;
  };
  current_assignee?: {
    id: string;
    name: string;
    type: 'gig' | 'vendor';
  };
  vendor_tat_start_date: string;
  due_at: string;
  base_rate_inr: number;
  bonus_inr: number;
  penalty_inr: number;
  total_payout_inr: number;
  tat_hours: number;
  instructions?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  last_updated_by: string;
  status_updated_at: string;
  // QC Response field
  QC_Response?: 'Rework' | 'Approved' | 'Rejected' | 'New';
  // New fields for QC dashboard
  assigned_at?: string;
  submitted_at?: string;
  // FI Type field for auto-fill
  fi_type?: 'business' | 'residence' | 'office';
}

export interface CreateCaseData {
  client_case_id: string;
  contract_type: string;
  candidate_name: string;
  company_name?: string;
  phone_primary: string;
  phone_secondary?: string;
  client_id: string;
  location_id: string;
  vendor_tat_start_date: string;
  due_at: string;
  base_rate_inr: number;
  bonus_inr: number;
  penalty_inr: number;
  total_payout_inr: number;
  tat_hours: number;
  instructions?: string;
}

export class CaseService {
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
   * Get total count of active cases
   */
  async getCasesCount(): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('cases')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Failed to fetch cases count:', error);
      return 0;
    }
  }

  /**
   * Get all cases with related data - OPTIMIZED VERSION with pagination
   */
  async getCases(page: number = 1, pageSize: number = 10, filters?: {
    statusFilter?: string[];
    clientFilter?: string;
    dateFilter?: { from?: Date; to?: Date };
    tatExpiryFilter?: { from?: Date; to?: Date };
    tierFilter?: string;
    searchTerm?: string;
    qcResponseTab?: string;
  }): Promise<{ cases: Case[]; total: number }> {
    try {
      // Calculate pagination range
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // Build query with filters
      let query = supabase
        .from('cases')
        .select(`
          id,
          case_number,
          client_case_id,
          contract_type,
          candidate_name,
          company_name,
          phone_primary,
          phone_secondary,
          status,
          current_assignee_id,
          current_assignee_type,
          current_vendor_id,
          vendor_tat_start_date,
          due_at,
          base_rate_inr,
          bonus_inr,
          penalty_inr,
          total_payout_inr,
          tat_hours,
          created_at,
          updated_at,
          created_by,
          last_updated_by,
          status_updated_at,
          "QC_Response",
          is_positive,
          allocated_at,
          submitted_at,
          clients!inner (
            id,
            name,
            contact_person,
            phone,
            email
          ),
          locations!inner (
            id,
            address_line,
            city,
            state,
            pincode,
            pincode_tier,
            lat,
            lng,
            location_url
          )
        `, { count: 'exact' })
        .eq('is_active', true);

      // Apply filters
      if (filters?.statusFilter && filters.statusFilter.length > 0) {
        query = query.in('status', filters.statusFilter);
      }

      if (filters?.clientFilter && filters.clientFilter !== 'all') {
        query = query.eq('client_id', filters.clientFilter);
      }

      if (filters?.qcResponseTab && filters.qcResponseTab !== 'all') {
        query = query.eq('QC_Response', filters.qcResponseTab);
      }

      if (filters?.dateFilter) {
        if (filters.dateFilter.from) {
          const startOfDay = new Date(filters.dateFilter.from);
          startOfDay.setHours(0, 0, 0, 0);
          query = query.gte('created_at', startOfDay.toISOString());
        }
        if (filters.dateFilter.to) {
          const endOfDay = new Date(filters.dateFilter.to);
          endOfDay.setHours(23, 59, 59, 999);
          query = query.lte('created_at', endOfDay.toISOString());
        }
      }

      if (filters?.tatExpiryFilter) {
        if (filters.tatExpiryFilter.from) {
          const startOfDay = new Date(filters.tatExpiryFilter.from);
          startOfDay.setHours(0, 0, 0, 0);
          query = query.gte('due_at', startOfDay.toISOString());
        }
        if (filters.tatExpiryFilter.to) {
          const endOfDay = new Date(filters.tatExpiryFilter.to);
          endOfDay.setHours(23, 59, 59, 999);
          query = query.lte('due_at', endOfDay.toISOString());
        }
      }

      if (filters?.searchTerm) {
        const searchPattern = `%${filters.searchTerm.toLowerCase()}%`;
        query = query.or(`case_number.ilike.${searchPattern},client_case_id.ilike.${searchPattern},candidate_name.ilike.${searchPattern},phone_primary.ilike.${searchPattern},phone_secondary.ilike.${searchPattern}`);
      }

      // Order and paginate
      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data: casesData, error: casesError, count } = await query;

      if (casesError) throw casesError;
      
      // Apply tier filter client-side (since it requires location join)
      let filteredCases = casesData || [];
      let adjustedCount = count || 0;
      
      if (filters?.tierFilter && filters.tierFilter !== 'all') {
        filteredCases = filteredCases.filter(c => {
          const location = Array.isArray(c.locations) ? c.locations[0] : c.locations;
          return location?.pincode_tier === filters.tierFilter;
        });
        
        // Note: When tier filter is applied client-side, the count from server
        // doesn't reflect the tier filter. We need to recalculate.
        // For now, we'll use the filtered cases length as an approximation
        // A better solution would be to fetch count separately with tier filter
        if (filteredCases.length < (casesData || []).length) {
          // If filtering reduced results, we need to adjust the count
          // This is an approximation - ideally we'd fetch the actual count
          adjustedCount = Math.max(filteredCases.length, adjustedCount);
        }
      }

      const caseIds = filteredCases.map(c => c.id);
      const assigneeIds = filteredCases
        .filter(c => c.current_assignee_id)
        .map(c => c.current_assignee_id);

      if (filteredCases.length === 0) {
        return { cases: [], total: adjustedCount };
      }

      // Optimized: Only fetch related data if we have cases
      // Batch fetch all assignee information and related data in parallel
      const [gigWorkersData, vendorsData, allocationLogsData, formSubmissionsData, legacySubmissionsData] = await Promise.all([
        // Get all gig workers in one query (only if we have assignees)
        assigneeIds.length > 0 ? supabase
          .from('gig_partners')
          .select(`
            id,
            profiles!inner (
              first_name,
              last_name,
              email,
              phone
            )
          `)
          .in('id', assigneeIds) : Promise.resolve({ data: [] }),
        
        // Get all vendors in one query (only if we have assignees)
        assigneeIds.length > 0 ? supabase
          .from('vendors')
          .select('id, name')
          .in('id', assigneeIds) : Promise.resolve({ data: [] }),
        
        // Get allocation logs (only if we have cases)
        // Optimized: Only fetch the most recent log per case to reduce data transfer
        caseIds.length > 0 ? supabase
          .from('allocation_logs')
          .select('case_id, candidate_id, allocated_at, accepted_at, decision')
          .in('case_id', caseIds)
          .order('allocated_at', { ascending: false })
          : Promise.resolve({ data: [] }),
        
        // Query form_submissions (only if we have cases)
        // Optimized: Only get the most recent submission per case
        caseIds.length > 0 ? supabase
          .from('form_submissions')
          .select('case_id, submitted_at, updated_at')
          .in('case_id', caseIds)
          .order('updated_at', { ascending: false })
          : Promise.resolve({ data: [] }),
        
        // Query legacy submissions (only if we have cases)
        caseIds.length > 0 ? supabase
          .from('submissions')
          .select('case_id, submitted_at')
          .in('case_id', caseIds)
          .order('submitted_at', { ascending: false })
          : Promise.resolve({ data: [] })
      ]);

      // Create lookup maps for efficient data access
      const gigWorkersMap = new Map();
      (gigWorkersData.data || []).forEach(worker => {
        gigWorkersMap.set(worker.id, {
          id: worker.id,
          name: `${worker.profiles?.first_name || ''} ${worker.profiles?.last_name || ''}`.trim() || 'Unknown',
          type: 'gig' as const,
        });
      });

      const vendorsMap = new Map();
      (vendorsData.data || []).forEach(vendor => {
        vendorsMap.set(vendor.id, {
          id: vendor.id,
          name: vendor.name || 'Unknown Vendor',
          type: 'vendor' as const,
        });
      });

      // Group allocation logs by case_id
      const allocationLogsMap = new Map();
      (allocationLogsData.data || []).forEach(log => {
        if (!allocationLogsMap.has(log.case_id)) {
          allocationLogsMap.set(log.case_id, []);
        }
        allocationLogsMap.get(log.case_id).push(log);
      });

      // Group form submissions by case_id - prefer submitted_at, fallback to updated_at
      const formSubmissionsMap = new Map();
      (formSubmissionsData.data || []).forEach(submission => {
        // Use submitted_at if available, otherwise updated_at
        const timestamp = submission.submitted_at || submission.updated_at;
        if (timestamp) {
          if (!formSubmissionsMap.has(submission.case_id)) {
            formSubmissionsMap.set(submission.case_id, timestamp);
          } else {
            // Compare and keep the most recent (largest) timestamp
            const current = formSubmissionsMap.get(submission.case_id);
            if (new Date(timestamp) > new Date(current!)) {
              formSubmissionsMap.set(submission.case_id, timestamp);
            }
          }
        }
      });

      // Group legacy submissions by case_id - use submitted_at
      const legacySubmissionsMap = new Map();
      (legacySubmissionsData.data || []).forEach(submission => {
        if (submission.submitted_at) {
          if (!legacySubmissionsMap.has(submission.case_id)) {
            legacySubmissionsMap.set(submission.case_id, submission.submitted_at);
          } else {
            // Compare and keep the most recent (largest) timestamp
            const current = legacySubmissionsMap.get(submission.case_id);
            if (new Date(submission.submitted_at) > new Date(current!)) {
              legacySubmissionsMap.set(submission.case_id, submission.submitted_at);
            }
          }
        }
      });

      // Create a combined map - prefer form_submissions, fallback to legacy submissions
      const allSubmissionsMap = new Map();
      // First add all form_submissions
      formSubmissionsMap.forEach((timestamp, caseId) => {
        allSubmissionsMap.set(caseId, timestamp);
      });
      // Then add legacy submissions for cases that don't have form_submissions
      legacySubmissionsMap.forEach((timestamp, caseId) => {
        if (!allSubmissionsMap.has(caseId)) {
          allSubmissionsMap.set(caseId, timestamp);
        }
      });

      // Process cases with lookup data (use filteredCases to respect tier filter)
      const casesWithAssignees = filteredCases.map(caseItem => {
        let assigneeInfo = null;
        let assignedAt = null;
        let submittedAt = null;

        // Get assignee info from lookup maps
        if (caseItem.current_assignee_id && caseItem.current_assignee_type) {
          if (caseItem.current_assignee_type === 'gig') {
            assigneeInfo = gigWorkersMap.get(caseItem.current_assignee_id);
          } else if (caseItem.current_assignee_type === 'vendor') {
            assigneeInfo = vendorsMap.get(caseItem.current_assignee_id);
          }
        }

        // Get assignment date - first try from cases.allocated_at (new column)
        // Fallback to allocation_logs if cases.allocated_at is not set
        if (caseItem.allocated_at) {
          assignedAt = caseItem.allocated_at;
        } else {
          // Fallback: Get from allocation logs if cases.allocated_at is null
          const caseAllocationLogs = allocationLogsMap.get(caseItem.id) || [];
          if (caseAllocationLogs.length > 0) {
            // Sort all logs by allocated_at (most recent first) to get the latest
            const sortedLogs = [...caseAllocationLogs].sort((a, b) => 
              new Date(b.allocated_at).getTime() - new Date(a.allocated_at).getTime()
            );
            
            // Use the most recent allocation log's allocated_at value
            const mostRecentLog = sortedLogs[0];
            if (mostRecentLog && mostRecentLog.allocated_at) {
              assignedAt = mostRecentLog.allocated_at;
            }
          }
        }

        // Get submission date - first try from cases.submitted_at (new column)
        // Fallback to form_submissions or legacy submissions if cases.submitted_at is not set
        if (caseItem.submitted_at) {
          submittedAt = caseItem.submitted_at;
        } else {
          // Fallback: Get from form_submissions or legacy submissions
          submittedAt = allSubmissionsMap.get(caseItem.id) || null;
        }

        // If still no assignment found, but case has submissions, use case creation time as fallback
        if (!assignedAt && submittedAt) {
          assignedAt = caseItem.created_at;
        }

        return {
          id: caseItem.id,
          case_number: caseItem.case_number,
          client_case_id: caseItem.client_case_id,
          contract_type: caseItem.contract_type,
          candidate_name: caseItem.candidate_name,
          company_name: caseItem.company_name,
          phone_primary: caseItem.phone_primary,
          phone_secondary: caseItem.phone_secondary,
          status: caseItem.status,
          client: {
            id: caseItem.clients.id,
            name: caseItem.clients.name,
            contact_person: caseItem.clients.contact_person,
            phone: caseItem.clients.phone,
            email: caseItem.clients.email,
          },
          location: {
            id: caseItem.locations.id,
            address_line: caseItem.locations.address_line,
            city: caseItem.locations.city,
            state: caseItem.locations.state,
            pincode: caseItem.locations.pincode,
            pincode_tier: caseItem.locations.pincode_tier,
            lat: caseItem.locations.lat,
            lng: caseItem.locations.lng,
            location_url: (caseItem.locations as any).location_url,
          },
          current_assignee: assigneeInfo,
          vendor_tat_start_date: caseItem.vendor_tat_start_date,
          due_at: caseItem.due_at,
          base_rate_inr: caseItem.base_rate_inr,
          bonus_inr: caseItem.bonus_inr,
          penalty_inr: caseItem.penalty_inr,
          total_payout_inr: caseItem.total_payout_inr,
          tat_hours: caseItem.tat_hours,
          instructions: '', // Will be extracted from metadata
          created_at: caseItem.created_at,
          updated_at: caseItem.updated_at,
          created_by: caseItem.created_by,
          last_updated_by: caseItem.last_updated_by,
          status_updated_at: caseItem.status_updated_at,
          QC_Response: caseItem.QC_Response,
          // New fields for QC dashboard
          assigned_at: assignedAt,
          submitted_at: submittedAt,
          // FI Type determined from contract type
          fi_type: this.determineFiType(caseItem.contract_type),
        };
      });

      return { cases: casesWithAssignees, total: adjustedCount || count || 0 };
    } catch (error) {
      console.error('Failed to fetch cases:', error);
      return { cases: [], total: 0 };
    }
  }

  /**
   * Get cases by status
   */
  async getCasesByStatus(status: string): Promise<Case[]> {
    try {
      const { data, error } = await supabase
        .from('cases')
        .select(`
          id,
          case_number,
          client_case_id,
          contract_type,
          candidate_name,
          phone_primary,
          phone_secondary,
          status,
          current_assignee_id,
          current_assignee_type,
          current_vendor_id,
          vendor_tat_start_date,
          due_at,
          base_rate_inr,
          bonus_inr,
          penalty_inr,
          total_payout_inr,
          tat_hours,
          created_at,
          updated_at,
          created_by,
          last_updated_by,
          status_updated_at,
          "QC_Response",
          clients!inner (
            id,
            name,
            contact_person,
            phone,
            email
          ),
          locations!inner (
            id,
            address_line,
            city,
            state,
            pincode,
            pincode_tier,
            lat,
            lng
          ),
          submissions (
            id,
            submitted_at,
            created_at
          ),
          form_submissions (
            id,
            updated_at,
            created_at
          )
        `)
        .eq('status', status as any)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get assignee information separately for both gig workers and vendors
      const casesWithAssignees = await Promise.all(
        data?.map(async (caseItem) => {
          let assigneeInfo = null;
          let assignedAt = null;
          let submittedAt = null;

          if (caseItem.current_assignee_id && caseItem.current_assignee_type) {
            if (caseItem.current_assignee_type === 'gig') {
              const { data: gigWorker } = await supabase
                .from('gig_partners')
                .select(`
                  id,
                  profiles!inner (
                    first_name,
                    last_name,
                    phone
                  )
                `)
                .eq('id', caseItem.current_assignee_id)
                .single();

              if (gigWorker) {
                assigneeInfo = {
                  id: gigWorker.id,
                  name: `${gigWorker.profiles.first_name} ${gigWorker.profiles.last_name}`,
                  type: 'gig',
                  phone: gigWorker.profiles.phone,
                };
              }
            } else if (caseItem.current_assignee_type === 'vendor') {
              const { data: vendor } = await supabase
                .from('vendors')
                .select('id, name, contact_person, phone')
                .eq('id', caseItem.current_assignee_id)
                .single();

              if (vendor) {
                assigneeInfo = {
                  id: vendor.id,
                  name: vendor.name,
                  type: 'vendor',
                  contact_person: vendor.contact_person,
                  phone: vendor.phone,
                };
              }
            }
          }

          // Get allocation logs to find when case was assigned
          if (caseItem.current_assignee_id) {
            // First try to find accepted allocation
            const { data: acceptedLogs } = await supabase
              .from('allocation_logs')
              .select('allocated_at, accepted_at, decision')
              .eq('case_id', caseItem.id)
              .eq('candidate_id', caseItem.current_assignee_id)
              .eq('decision', 'accepted')
              .order('accepted_at', { ascending: false })
              .limit(1);

            if (acceptedLogs && acceptedLogs.length > 0) {
              assignedAt = acceptedLogs[0].accepted_at || acceptedLogs[0].allocated_at;
            } else {
              // If no accepted allocation, try to find allocated allocation (for cases with status 'allocated')
              const { data: allocatedLogs } = await supabase
                .from('allocation_logs')
                .select('allocated_at, decision')
                .eq('case_id', caseItem.id)
                .eq('candidate_id', caseItem.current_assignee_id)
                .eq('decision', 'allocated')
                .order('allocated_at', { ascending: false })
                .limit(1);

              if (allocatedLogs && allocatedLogs.length > 0) {
                assignedAt = allocatedLogs[0].allocated_at;
              }
            }
          }

          // Get submission date from either submissions or form_submissions
          // Use updated_at from form_submissions instead of submitted_at
          if (caseItem.submissions && Array.isArray(caseItem.submissions) && caseItem.submissions.length > 0) {
            submittedAt = caseItem.submissions[0].submitted_at;
          } else if (caseItem.form_submissions && Array.isArray(caseItem.form_submissions) && caseItem.form_submissions.length > 0) {
            submittedAt = caseItem.form_submissions[0].updated_at;
          }

          return {
            id: caseItem.id,
            case_number: caseItem.case_number,
            client_case_id: caseItem.client_case_id,
            contract_type: caseItem.contract_type,
            candidate_name: caseItem.candidate_name,
            phone_primary: caseItem.phone_primary,
            phone_secondary: caseItem.phone_secondary,
            status: caseItem.status,
            client: {
              id: caseItem.clients.id,
              name: caseItem.clients.name,
              contact_person: caseItem.clients.contact_person,
              phone: caseItem.clients.phone,
              email: caseItem.clients.email,
            },
            location: {
              id: caseItem.locations.id,
              address_line: caseItem.locations.address_line,
              city: caseItem.locations.city,
              state: caseItem.locations.state,
              pincode: caseItem.locations.pincode,
              pincode_tier: caseItem.locations.pincode_tier,
              lat: caseItem.locations.lat,
              lng: caseItem.locations.lng,
              location_url: (caseItem.locations as any).location_url,
            },
            current_assignee: assigneeInfo,
            vendor_tat_start_date: caseItem.vendor_tat_start_date,
            due_at: caseItem.due_at,
            base_rate_inr: caseItem.base_rate_inr,
            bonus_inr: caseItem.bonus_inr,
            penalty_inr: caseItem.penalty_inr,
            total_payout_inr: caseItem.total_payout_inr,
            tat_hours: caseItem.tat_hours,
            instructions: '', // Will be extracted from metadata
            created_at: caseItem.created_at,
            updated_at: caseItem.updated_at,
            created_by: caseItem.created_by,
            last_updated_by: caseItem.last_updated_by,
            status_updated_at: caseItem.status_updated_at,
            // New fields for QC dashboard
            assigned_at: assignedAt,
            submitted_at: submittedAt,
            // FI Type determined from contract type
            fi_type: this.determineFiType(caseItem.contract_type),
          };
        }) || []
      );

      return casesWithAssignees;
    } catch (error) {
      console.error('Failed to fetch cases by status:', error);
      return [];
    }
  }

  /**
   * Get a single case by ID
   */
  async getCaseById(id: string): Promise<Case | null> {
    try {
      const { data, error } = await supabase
        .from('cases')
        .select(`
          id,
          case_number,
          client_case_id,
          contract_type,
          candidate_name,
          phone_primary,
          phone_secondary,
          title,
          description,
          priority,
          status,
          current_assignee_id,
          current_assignee_type,
          current_vendor_id,
          vendor_tat_start_date,
          due_at,
          base_rate_inr,
          total_rate_inr,
          bonus_inr,
          penalty_inr,
          tat_hours,
          created_at,
          updated_at,
          created_by,
          last_updated_by,
          status_updated_at,
          allocated_at,
          submitted_at,
          "QC_Response",
          clients!inner (
            id,
            name,
            contact_person,
            phone,
            email
          ),
          locations!inner (
            id,
            address_line,
            city,
            state,
            pincode,
            pincode_tier,
            lat,
            lng
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Get assignee information
      let assigneeInfo = null;
      if (data.current_assignee_id && data.current_assignee_type) {
        if (data.current_assignee_type === 'gig') {
          const { data: gigWorker } = await supabase
            .from('gig_partners')
            .select(`
              id,
              vendor_id,
              profiles!inner (
                first_name,
                last_name,
                phone
              )
            `)
            .eq('id', data.current_assignee_id)
            .single();

          if (gigWorker) {
            // If gig worker belongs to a vendor, fetch vendor info
            let vendorInfo = null;
            if (gigWorker.vendor_id) {
              const { data: vendor } = await supabase
                .from('vendors')
                .select('id, name')
                .eq('id', gigWorker.vendor_id)
                .single();

              if (vendor) {
                vendorInfo = {
                  id: vendor.id,
                  name: vendor.name,
                };
              }
            }

            assigneeInfo = {
              id: gigWorker.id,
              name: `${gigWorker.profiles?.first_name || ''} ${gigWorker.profiles?.last_name || ''}`.trim() || 'Unknown',
              phone: gigWorker.profiles?.phone || 'N/A',
              type: 'gig' as const,
              vendor: vendorInfo || undefined,
            };
          }
        } else if (data.current_assignee_type === 'vendor') {
          const { data: vendor } = await supabase
            .from('vendors')
            .select('id, name, contact_person, phone')
            .eq('id', data.current_assignee_id)
            .single();

          if (vendor) {
            assigneeInfo = {
              id: vendor.id,
              name: vendor.name,
              phone: vendor.phone || 'N/A',
              type: 'vendor' as const,
            };
          }
        }
      }

      // Get assignment and submission dates
      // Use allocated_at and submitted_at from cases table first, then fallback to allocation_logs/form_submissions
      let assignedAt = data.allocated_at || null;
      let submittedAt = data.submitted_at || null;

      // Get allocation logs to find when case was assigned (fallback if allocated_at is null)
      if (!assignedAt && data.current_assignee_id) {
        const { data: acceptedLogs } = await supabase
          .from('allocation_logs')
          .select('allocated_at, accepted_at, decision')
          .eq('case_id', data.id)
          .eq('candidate_id', (data as any).current_assignee_id)
          .eq('decision', 'accepted')
          .order('accepted_at', { ascending: false })
          .limit(1);

        if (acceptedLogs && acceptedLogs.length > 0) {
          assignedAt = acceptedLogs[0].accepted_at || acceptedLogs[0].allocated_at;
        } else {
          // If no accepted allocation, try to find allocated allocation (for cases with status 'allocated')
          const { data: allocatedLogs } = await supabase
            .from('allocation_logs')
            .select('allocated_at, decision')
            .eq('case_id', data.id)
            .eq('candidate_id', (data as any).current_assignee_id)
            .eq('decision', 'allocated')
            .order('allocated_at', { ascending: false })
            .limit(1);

          if (allocatedLogs && allocatedLogs.length > 0) {
            assignedAt = allocatedLogs[0].allocated_at;
          }
        }
      }

      // If no assignment found with current assignee, try to find any allocation logs for this case
      if (!assignedAt) {
        // First try any accepted allocation
        const { data: anyAcceptedLogs } = await supabase
          .from('allocation_logs')
          .select('allocated_at, accepted_at, decision')
          .eq('case_id', data.id)
          .eq('decision', 'accepted')
          .order('accepted_at', { ascending: false })
          .limit(1);

        if (anyAcceptedLogs && anyAcceptedLogs.length > 0) {
          assignedAt = anyAcceptedLogs[0].accepted_at || anyAcceptedLogs[0].allocated_at;
        } else {
          // Fallback to any allocated allocation
          const { data: anyAllocatedLogs } = await supabase
            .from('allocation_logs')
            .select('allocated_at, decision')
            .eq('case_id', data.id)
            .eq('decision', 'allocated')
            .order('allocated_at', { ascending: false })
            .limit(1);

          if (anyAllocatedLogs && anyAllocatedLogs.length > 0) {
            assignedAt = anyAllocatedLogs[0].allocated_at;
          }
        }
      }

      // Get submission date from either submissions or form_submissions (fallback if submitted_at is null)
      if (!submittedAt) {
        const { data: formSubmissions } = await supabase
          .from('form_submissions')
          .select('submitted_at, updated_at')
          .eq('case_id', data.id)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (formSubmissions && formSubmissions.length > 0) {
          submittedAt = formSubmissions[0].submitted_at || formSubmissions[0].updated_at;
        } else {
          // Fallback to legacy submissions table
          const { data: submissions } = await supabase
            .from('submissions')
            .select('submitted_at')
            .eq('case_id', data.id)
            .order('submitted_at', { ascending: false })
            .limit(1);

          if (submissions && submissions.length > 0) {
            submittedAt = submissions[0].submitted_at;
          }
        }
      }

      return {
        id: data.id,
        case_number: data.case_number,
        client_case_id: data.client_case_id,
        contract_type: data.contract_type || '', // Add contract_type field
        candidate_name: data.candidate_name || '', // Add candidate_name field
        phone_primary: data.phone_primary || '', // Add phone_primary field
        phone_secondary: data.phone_secondary, // Add phone_secondary field
        // title: data.title,
        // description: data.description,
        // priority: data.priority,
        status: data.status as any,
        client: {
          id: data.clients.id,
          name: data.clients.name,
          contact_person: data.clients.contact_person,
          phone: data.clients.phone,
          email: data.clients.email,
        },
        location: {
          id: data.locations.id,
          address_line: data.locations.address_line,
          city: data.locations.city,
          state: data.locations.state,
          pincode: data.locations.pincode,
          pincode_tier: data.locations.pincode_tier,
          lat: data.locations.lat,
          lng: data.locations.lng,
        },
        vendor_tat_start_date: data.vendor_tat_start_date || data.created_at, // Add vendor_tat_start_date
        due_at: data.due_at,
        base_rate_inr: data.base_rate_inr,
        bonus_inr: data.bonus_inr || 0,
        penalty_inr: data.penalty_inr || 0,
        total_payout_inr: data.total_rate_inr, // Map total_rate_inr to total_payout_inr
        tat_hours: data.tat_hours,
        instructions: '', // Will be extracted from metadata
        created_at: data.created_at,
        updated_at: data.updated_at,
        created_by: data.created_by,
        last_updated_by: data.last_updated_by,
        status_updated_at: data.status_updated_at,
        QC_Response: data.QC_Response,
        assignee: assigneeInfo || undefined,
        allocated_at: assignedAt,
        submitted_at: submittedAt,
        // FI Type determined from contract type
        fi_type: this.determineFiType(data.contract_type || ''),
      };
    } catch (error) {
      console.error('Failed to fetch case:', error);
      return null;
    }
  }

  /**
   * Create a new case
   */
  async createCase(caseData: CreateCaseData): Promise<Case | null> {
    try {
      // Generate case number
      const caseNumber = `BG-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Calculate payout based on client contract and pincode tier
      let payoutResult;
      try {
        payoutResult = await PayoutCalculationService.calculatePayout(
          caseData.client_id,
          caseData.contract_type,
          caseData.location_id,
          caseData.bonus_inr || 0,
          caseData.penalty_inr || 0
        );
      } catch (payoutError: any) {
        // Re-throw with better context
        if (payoutError.name === 'PincodeNotRegisteredError' || payoutError.message?.includes('pincode')) {
          throw payoutError; // Already user-friendly
        }
        if (payoutError.name === 'ContractNotFoundError') {
          throw payoutError; // Already user-friendly
        }
        const calculationError = new Error(`Unable to calculate payout rates. Please ensure a valid contract and pincode tier exist for this combination. ${payoutError instanceof Error ? payoutError.message : ''}`);
        calculationError.name = 'PayoutCalculationError';
        throw calculationError;
      }

      // Prepare metadata JSONB for instructions and candidate info
      const metadata = {
        instructions: caseData.instructions || '',
        candidate_name: caseData.candidate_name,
        phone_primary: caseData.phone_primary,
        phone_secondary: caseData.phone_secondary || null,
        contract_type: caseData.contract_type
      };

      const { data, error } = await supabase
        .from('cases')
        .insert({
          case_number: caseNumber,
          title: `${caseData.candidate_name} - ${caseData.contract_type.replace('_', ' ').toUpperCase()}`,
          description: `Background verification for ${caseData.candidate_name}`,
          priority: 'medium',
          client_case_id: caseData.client_case_id,
          contract_type: caseData.contract_type,
          candidate_name: caseData.candidate_name,
          company_name: caseData.company_name || null,
          phone_primary: caseData.phone_primary,
          phone_secondary: caseData.phone_secondary,
          status: 'new',
          client_id: caseData.client_id,
          location_id: caseData.location_id,
          vendor_tat_start_date: caseData.vendor_tat_start_date,
          due_at: caseData.due_at,
          base_rate_inr: payoutResult.base_rate_inr,
          bonus_inr: payoutResult.bonus_inr,
          penalty_inr: payoutResult.penalty_inr,
          total_payout_inr: payoutResult.total_payout_inr,
          metadata: metadata,
          tat_hours: caseData.tat_hours,
          created_by: user.id,
          last_updated_by: user.id,
          status_updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Return the created case with related data
      return await this.getCaseById(data.id);
    } catch (error) {
      console.error('Failed to create case:', error);
      // Re-throw with context so error handler can provide user-friendly message
      throw error;
    }
  }

  /**
   * Update a case
   */
  async updateCase(id: string, updates: Partial<CreateCaseData>): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Prepare update data
      const updateData: any = {
        ...updates,
        last_updated_by: user.id,
        updated_at: new Date().toISOString(),
      };

      // If rate fields are being updated, recalculate total_rate_inr
      if (updates.base_rate_inr !== undefined || updates.bonus_inr !== undefined) {
        const currentCase = await this.getCaseById(id);
        if (currentCase) {
          const baseRate = updates.base_rate_inr ?? currentCase.base_rate_inr;
          const bonus = updates.bonus_inr ?? 0;
          updateData.total_payout_inr = baseRate + bonus;
          
          // Update rate_adjustments
          updateData.metadata = {
            ...(currentCase as any).metadata,
            bonus_inr: bonus
          };
        }
      }

      // If instructions are being updated, update metadata
      if (updates.instructions !== undefined) {
        updateData.metadata = {
          instructions: updates.instructions
        };
      }

      const { error } = await supabase
        .from('cases')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to update case:', error);
      return false;
    }
  }

  /**
   * Delete a case (soft delete - sets is_active to false)
   */
  async deleteCase(id: string): Promise<boolean> {
    try {
      console.log('Attempting to deactivate case with ID:', id);
      
      // Soft delete: Set is_active to false instead of deleting
      const { error: updateError } = await supabase
        .from('cases')
        .update({ is_active: false })
        .eq('id', id);

      if (updateError) {
        console.error('Error deactivating case:', updateError);
        return false;
      }

      console.log('Case deactivated successfully');
      return true;
    } catch (error) {
      console.error('Failed to deactivate case:', error);
      return false;
    }
  }

  /**
   * Get all clients
   */
  async getClients(): Promise<Array<{ id: string; name: string; contact_person: string; email: string }>> {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, contact_person, email')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to fetch clients:', error);
      return [];
    }
  }


  /**
   * Create or get location
   */
  async createOrGetLocation(locationData: {
    address_line: string;
    city: string;
    state: string;
    pincode: string;
    lat?: number;
    lng?: number;
    location_url?: string;
  }): Promise<string | null> {
    try {
      // First, try to find existing location
      const { data: existingLocations, error: queryError } = await supabase
        .from('locations')
        .select('id')
        .eq('address_line', locationData.address_line)
        .eq('city', locationData.city)
        .eq('state', locationData.state)
        .eq('pincode', locationData.pincode)
        .limit(1);

      if (queryError && queryError.code !== 'PGRST116') {
        throw queryError;
      }

      if (existingLocations && existingLocations.length > 0) {
        return existingLocations[0].id;
      }

      // Determine pincode tier
      const pincodeTierData = await pincodeTierService.getPincodeTier(locationData.pincode);
      const pincodeTier = pincodeTierData?.tier || 'tier3'; // Default to tier3 if not found

      // Create new location
      const { data, error } = await supabase
        .from('locations')
        .insert({
          address_line: locationData.address_line,
          city: locationData.city,
          state: locationData.state,
          pincode: locationData.pincode,
          country: 'India',
          lat: locationData.lat,
          lng: locationData.lng,
          location_url: locationData.location_url,
          pincode_tier: pincodeTier,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Failed to create/get location:', error);
      return null;
    }
  }

  /**
   * Recreate a case after QC rejection
   */
  async recreateCase(originalCaseId: string, userId: string): Promise<{ success: boolean; error?: string; newCaseId?: string }> {
    try {
      // Get the original case data
      const { data: originalCase, error: fetchError } = await supabase
        .from('cases')
        .select(`
          *,
          client:clients(*),
          location:locations(*)
        `)
        .eq('id', originalCaseId)
        .single();

      if (fetchError || !originalCase) {
        return { success: false, error: 'Original case not found' };
      }

      // Generate new case number with (1) suffix
      // Handle cases where case_number might already have a suffix
      let newCaseNumber = `${originalCase.case_number}(1)`;
      
      // If the original case_number already ends with a pattern like (1), (2), etc., increment it
      const caseNumberMatch = originalCase.case_number.match(/^(.+)\((\d+)\)$/);
      if (caseNumberMatch) {
        const baseNumber = caseNumberMatch[1];
        const currentNumber = parseInt(caseNumberMatch[2]);
        newCaseNumber = `${baseNumber}(${currentNumber + 1})`;
      }
      
      // Generate new client case ID with (1) suffix
      // Handle cases where client_case_id might already have a suffix
      let newClientCaseId = `${originalCase.client_case_id}(1)`;
      
      // If the original client_case_id already ends with a pattern like (1), (2), etc., increment it
      const clientCaseIdMatch = originalCase.client_case_id.match(/^(.+)\((\d+)\)$/);
      if (clientCaseIdMatch) {
        const baseId = clientCaseIdMatch[1];
        const currentNumber = parseInt(clientCaseIdMatch[2]);
        newClientCaseId = `${baseId}(${currentNumber + 1})`;
      }

      // Check if a case with this number already exists
      const { data: existingCases } = await supabase
        .from('cases')
        .select('id')
        .eq('case_number', newCaseNumber);

      if (existingCases && existingCases.length > 0) {
        return { success: false, error: 'A case with this number already exists' };
      }

      // Check if a case with this client_case_id already exists for the same client
      const { data: existingClientCases } = await supabase
        .from('cases')
        .select('id')
        .eq('client_case_id', newClientCaseId)
        .eq('client_id', originalCase.client_id);

      if (existingClientCases && existingClientCases.length > 0) {
        return { success: false, error: 'A case with this client case ID already exists for this client' };
      }

      // Create new case with same data but new case number and client case ID
      const newCaseData = {
        case_number: newCaseNumber,
        title: originalCase.title || `${originalCase.candidate_name} - ${originalCase.contract_type?.replace('_', ' ').toUpperCase() || 'BACKGROUND VERIFICATION'}`,
        description: originalCase.description || `Background verification for ${originalCase.candidate_name}`,
        priority: originalCase.priority || 'medium',
        source: originalCase.source || 'manual',
        client_case_id: newClientCaseId,
        contract_type: originalCase.contract_type,
        candidate_name: originalCase.candidate_name,
        phone_primary: originalCase.phone_primary,
        phone_secondary: originalCase.phone_secondary,
        client_id: originalCase.client_id,
        location_id: originalCase.location_id,
        base_rate_inr: originalCase.base_rate_inr || 0,
        bonus_inr: originalCase.bonus_inr || 0,
        penalty_inr: originalCase.penalty_inr || 0,
        total_payout_inr: originalCase.total_payout_inr || 0,
        tat_hours: originalCase.tat_hours,
        instructions: originalCase.instructions,
        status: 'new',
        created_by: userId,
        last_updated_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status_updated_at: new Date().toISOString(),
        vendor_tat_start_date: new Date().toISOString(),
        due_at: new Date(Date.now() + (originalCase.tat_hours || 24) * 60 * 60 * 1000).toISOString(),
        QC_Response: 'New' as any,
        metadata: originalCase.metadata || {},
        rate_adjustments: originalCase.rate_adjustments || {},
        total_rate_inr: originalCase.total_rate_inr || originalCase.base_rate_inr || 0,
        visible_to_gig: originalCase.visible_to_gig !== undefined ? originalCase.visible_to_gig : true
      };

      const { data: newCase, error: createError } = await supabase
        .from('cases')
        .insert(newCaseData as any)
        .select('id, case_number')
        .single();

      if (createError) {
        console.error('Error creating new case:', createError);
        return { success: false, error: 'Failed to create new case' };
      }

      // Log the recreation in allocation_logs for audit trail
      await supabase
        .from('allocation_logs')
        .insert({
          case_id: newCase.id,
          candidate_id: userId,
          candidate_type: 'gig',
          action: 'case_recreated',
          created_at: new Date().toISOString(),
          created_by: userId
        } as any);

      return { 
        success: true, 
        newCaseId: newCase.id 
      };

    } catch (error) {
      console.error('Error recreating case:', error);
      return { 
        success: false, 
        error: 'An unexpected error occurred while recreating the case' 
      };
    }
  }
}

// Export singleton instance
export const caseService = new CaseService();