import { supabase } from '@/integrations/supabase/client';

export interface AllocationSummaryData {
  assigneeId: string;
  assigneeName: string;
  assigneeType: 'gig' | 'vendor';
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

      // Simplified query to avoid foreign key relationship issues
      let casesQuery = supabase
        .from('cases')
        .select(`
          id,
          case_number,
          status,
          current_assignee_id,
          current_assignee_type,
          current_vendor_id,
          locations!inner (
            pincode,
            pincode_tier
          )
        `)
        .eq('status', 'allocated')
        .not('current_assignee_id', 'is', null);

      if (caseIds && caseIds.length > 0) {
        casesQuery = casesQuery.in('id', caseIds);
      }

      const { data: casesData, error: casesError } = await casesQuery;

      if (casesError) throw casesError;

      // Get gig worker data separately
      const gigWorkerIds = casesData?.filter(c => c.current_assignee_type === 'gig').map(c => c.current_assignee_id) || [];
      const vendorIds = casesData?.filter(c => c.current_assignee_type === 'vendor').map(c => c.current_assignee_id) || [];

      let gigWorkerData = {};
      if (gigWorkerIds.length > 0) {
        const { data: gigData, error: gigError } = await supabase
          .from('gig_partners')
          .select(`
            id,
            coverage_pincodes,
            profiles (
              first_name,
              last_name
            )
          `)
          .in('id', gigWorkerIds);

        if (!gigError && gigData) {
          gigWorkerData = gigData.reduce((acc, item) => {
            acc[item.id] = item;
            return acc;
          }, {});
        }
      }

      let vendorData = {};
      if (vendorIds.length > 0) {
        const { data: vendorDataResult, error: vendorError } = await supabase
          .from('vendors')
          .select(`
            id,
            name,
            coverage_pincodes
          `)
          .in('id', vendorIds);

        if (!vendorError && vendorDataResult) {
          vendorData = vendorDataResult.reduce((acc, item) => {
            acc[item.id] = item;
            return acc;
          }, {});
        }
      }

      // Combine the data
      const data = casesData?.map(caseItem => ({
        ...caseItem,
        gig_partners: caseItem.current_assignee_type === 'gig' ? gigWorkerData[caseItem.current_assignee_id] : null,
        vendors: caseItem.current_assignee_type === 'vendor' ? vendorData[caseItem.current_assignee_id] : null
      })) || [];

      console.log('Raw allocation data:', data);

      // Group by assignee (gig worker or vendor)
      const groupedByAssignee = new Map<string, any[]>();
      
      data?.forEach(caseItem => {
        const assigneeId = caseItem.current_assignee_id;
        if (assigneeId) {
          if (!groupedByAssignee.has(assigneeId)) {
            groupedByAssignee.set(assigneeId, []);
          }
          groupedByAssignee.get(assigneeId)?.push(caseItem);
        }
      });

      console.log('Grouped by assignee:', groupedByAssignee);

      // Get performance metrics for gig workers (using existing gigWorkerIds and vendorIds)

      let gigWorkerPerformanceData = {};
      if (gigWorkerIds.length > 0) {
        const { data: perfData, error: perfError } = await supabase
          .from('performance_metrics')
          .select('gig_partner_id, quality_score, completion_rate, ontime_completion_rate, acceptance_rate')
          .in('gig_partner_id', gigWorkerIds)
          .order('created_at', { ascending: false });

        if (perfError) {
          console.error('Error fetching gig worker performance data:', perfError);
        } else {
          console.log('Gig worker performance data fetched:', perfData);
          gigWorkerPerformanceData = (perfData || []).reduce((acc, item) => {
            if (!acc[item.gig_partner_id]) {
              acc[item.gig_partner_id] = item;
            }
            return acc;
          }, {});
        }
      }

      // Get vendor performance data
      let vendorPerformanceData = {};
      if (vendorIds.length > 0) {
        const { data: vendorData, error: vendorError } = await supabase
          .from('vendors')
          .select('id, quality_score, performance_score')
          .in('id', vendorIds);

        if (vendorError) {
          console.error('Error fetching vendor performance data:', vendorError);
        } else {
          console.log('Vendor performance data fetched:', vendorData);
          vendorPerformanceData = (vendorData || []).reduce((acc, item) => {
            acc[item.id] = {
              quality_score: item.quality_score || 0,
              completion_rate: item.performance_score || 0,
              ontime_completion_rate: item.performance_score || 0,
              acceptance_rate: 1.0 // Assume 100% acceptance for vendors
            };
            return acc;
          }, {});
        }
      }

      console.log('Performance data maps:', { gigWorkerPerformanceData, vendorPerformanceData });

      // Transform data
      const summaryData: AllocationSummaryData[] = [];
      
      groupedByAssignee.forEach((cases, assigneeId) => {
        const firstCase = cases[0];
        const assigneeType = firstCase.current_assignee_type;
        
        if (assigneeType === 'gig') {
          const gigWorker = firstCase.gig_partners;
          if (gigWorker) {
            const perf = gigWorkerPerformanceData[assigneeId] || {};
            
            summaryData.push({
              assigneeId: gigWorker.id,
              assigneeName: `${gigWorker.profiles?.first_name || ''} ${gigWorker.profiles?.last_name || ''}`.trim() || 'Unknown',
              assigneeType: 'gig',
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
        } else if (assigneeType === 'vendor') {
          const vendor = firstCase.vendors;
          if (vendor) {
            const perf = vendorPerformanceData[assigneeId] || {};
            
            summaryData.push({
              assigneeId: vendor.id,
              assigneeName: vendor.name || 'Unknown Vendor',
              assigneeType: 'vendor',
              totalCases: cases.length,
              assignedCases: cases.map(caseItem => ({
                caseId: caseItem.id,
                caseNumber: caseItem.case_number,
                pincode: caseItem.locations.pincode,
                pincodeTier: caseItem.locations.pincode_tier
              })),
              associatedPincodes: vendor.coverage_pincodes || [],
              qualityScore: perf.quality_score || 0,
              completionRate: perf.completion_rate || 0,
              onTimeRate: perf.ontime_completion_rate || 0,
              acceptanceRate: perf.acceptance_rate || 0
            });
          }
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
        .eq('status', 'allocated')
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
