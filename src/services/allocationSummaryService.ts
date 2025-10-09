import { supabase } from '@/integrations/supabase/client';

export interface AllocationSummaryData {
  gigWorkerId: string;
  gigWorkerName: string;
  gigWorkerType: 'gig' | 'vendor';
  totalCases: number;
  assignedCases: {
    caseId: string;
    caseNumber: string;
    pincode: string;
    pincodeTier: string;
  }[];
  associatedPincodes: string[];
  qualityScore: number;
  completionRate: number;
  onTimeRate: number;
  acceptanceRate: number;
}

export class AllocationSummaryService {
  /**
   * Get allocation summary for recently allocated cases
   */
  async getAllocationSummary(caseIds?: string[]): Promise<AllocationSummaryData[]> {
    try {
      let query = supabase
        .from('cases')
        .select(`
          id,
          case_number,
          status,
          current_assignee_id,
          current_assignee_type,
          locations!inner (
            pincode,
            pincode_tier
          ),
          gig_partners!current_assignee_id (
            id,
            coverage_pincodes,
            profiles (
              first_name,
              last_name
            )
          )
        `)
        .eq('status', 'auto_allocated')
        .not('current_assignee_id', 'is', null);

      if (caseIds && caseIds.length > 0) {
        query = query.in('id', caseIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      console.log('Raw allocation data:', data);

      // Group by gig worker
      const groupedByGigWorker = new Map<string, any[]>();
      
      data?.forEach(caseItem => {
        const gigWorker = caseItem.gig_partners;
        if (gigWorker) {
          const gigWorkerId = gigWorker.id;
          if (!groupedByGigWorker.has(gigWorkerId)) {
            groupedByGigWorker.set(gigWorkerId, []);
          }
          groupedByGigWorker.get(gigWorkerId)?.push(caseItem);
        }
      });

      console.log('Grouped by gig worker:', groupedByGigWorker);

      // Get performance metrics for all gig workers
      const gigWorkerIds = Array.from(groupedByGigWorker.keys());
      console.log('Gig worker IDs to fetch performance for:', gigWorkerIds);

      let performanceData = {};
      if (gigWorkerIds.length > 0) {
        const { data: perfData, error: perfError } = await supabase
          .from('performance_metrics')
          .select('gig_partner_id, quality_score, completion_rate, ontime_completion_rate, acceptance_rate')
          .in('gig_partner_id', gigWorkerIds)
          .order('created_at', { ascending: false });

        if (perfError) {
          console.error('Error fetching performance data:', perfError);
        } else {
          console.log('Performance data fetched:', perfData);
          // Create a map of gig_partner_id to latest performance data
          performanceData = (perfData || []).reduce((acc, item) => {
            if (!acc[item.gig_partner_id]) {
              acc[item.gig_partner_id] = item;
            }
            return acc;
          }, {});
        }
      }

      console.log('Performance data map:', performanceData);

      // Transform data
      const summaryData: AllocationSummaryData[] = [];
      
      groupedByGigWorker.forEach((cases, gigWorkerId) => {
        const firstCase = cases[0];
        const gigWorker = firstCase.gig_partners;
        
        if (gigWorker) {
          // Get all unique pincodes for this gig worker
          const pincodes = [...new Set(cases.map(c => c.locations.pincode))];
          const perf = performanceData[gigWorkerId] || {};
          
          console.log(`Performance for gig worker ${gigWorkerId}:`, perf);
          
          summaryData.push({
            gigWorkerId: gigWorker.id,
            gigWorkerName: `${gigWorker.profiles?.first_name || ''} ${gigWorker.profiles?.last_name || ''}`.trim() || 'Unknown',
            gigWorkerType: firstCase.current_assignee_type,
            totalCases: cases.length,
            assignedCases: cases.map(caseItem => ({
              caseId: caseItem.id,
              caseNumber: caseItem.case_number,
              pincode: caseItem.locations.pincode,
              pincodeTier: caseItem.locations.pincode_tier
            })),
            associatedPincodes: gigWorker.coverage_pincodes || [],
            qualityScore: perf.quality_score || 0,
            completionRate: perf.completion_rate || 0,
            onTimeRate: perf.ontime_completion_rate || 0,
            acceptanceRate: perf.acceptance_rate || 0
          });
        }
      });

      // Sort by total cases (descending)
      summaryData.sort((a, b) => b.totalCases - a.totalCases);

      return summaryData;
    } catch (error) {
      console.error('Failed to get allocation summary:', error);
      return [];
    }
  }

  /**
   * Get allocation summary for a specific time range
   */
  async getAllocationSummaryByDateRange(startDate: string, endDate: string): Promise<AllocationSummaryData[]> {
    try {
      const { data, error } = await supabase
        .from('cases')
        .select(`
          id,
          case_number,
          status,
          current_assignee_id,
          current_assignee_type,
          created_at,
          locations!inner (
            pincode
          ),
          gig_partners!current_assignee_id (
            id,
            coverage_pincodes,
            profiles (
              first_name,
              last_name
            ),
            performance_metrics (
              quality_score,
              completion_rate,
              ontime_completion_rate,
              acceptance_rate
            )
          )
        `)
        .eq('status', 'auto_allocated')
        .not('current_assignee_id', 'is', null)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error) throw error;

      // Use the same grouping logic as getAllocationSummary
      return this.processAllocationData(data || []);
    } catch (error) {
      console.error('Failed to get allocation summary by date range:', error);
      return [];
    }
  }

  /**
   * Process allocation data into summary format
   */
  private processAllocationData(data: any[]): AllocationSummaryData[] {
    const groupedByPincode = new Map<string, any[]>();
    
    data.forEach(caseItem => {
      const pincode = caseItem.locations.pincode;
      if (!groupedByPincode.has(pincode)) {
        groupedByPincode.set(pincode, []);
      }
      groupedByPincode.get(pincode)?.push(caseItem);
    });

    const summaryData: AllocationSummaryData[] = [];
    
    groupedByPincode.forEach((cases, pincode) => {
      const assigneeMap = new Map<string, any>();
      
      cases.forEach(caseItem => {
        const assigneeId = caseItem.current_assignee_id;
        if (!assigneeMap.has(assigneeId)) {
          assigneeMap.set(assigneeId, {
            id: caseItem.gig_partners.id,
            name: `${caseItem.gig_partners.profiles?.first_name || ''} ${caseItem.gig_partners.profiles?.last_name || ''}`.trim() || 'Unknown',
            type: caseItem.current_assignee_type,
            associatedPincodes: caseItem.gig_partners.coverage_pincodes || [],
            qualityScore: caseItem.gig_partners.performance_metrics?.quality_score || 0,
            completionRate: caseItem.gig_partners.performance_metrics?.completion_rate || 0,
            onTimeRate: caseItem.gig_partners.performance_metrics?.ontime_completion_rate || 0,
            acceptanceRate: caseItem.gig_partners.performance_metrics?.acceptance_rate || 0,
            caseCount: 0
          });
        }
        assigneeMap.get(assigneeId).caseCount++;
      });

      summaryData.push({
        pincode,
        totalCases: cases.length,
        allocatedTo: Array.from(assigneeMap.values()).map(assignee => ({
          id: assignee.id,
          name: assignee.name,
          type: assignee.type,
          associatedPincodes: assignee.associatedPincodes,
          qualityScore: assignee.qualityScore,
          completionRate: assignee.completionRate,
          onTimeRate: assignee.onTimeRate,
          acceptanceRate: assignee.acceptanceRate
        }))
      });
    });

    summaryData.sort((a, b) => b.totalCases - a.totalCases);
    return summaryData;
  }
}

// Export singleton instance
export const allocationSummaryService = new AllocationSummaryService();
