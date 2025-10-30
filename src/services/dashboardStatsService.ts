import { supabase } from '@/integrations/supabase/client';

export interface DashboardStats {
  totalCases: number;
  activeClients: number;
  pendingCases: number;
  completedCases: number;
}

export class DashboardStatsService {
  /**
   * Get dashboard statistics for the Ops team
   */
  static async getOpsDashboardStats(): Promise<DashboardStats> {
    try {
      // Restrict to cases shown in ops/cases page: created today (>= start of today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayIso = today.toISOString();

      // Get total cases count
      const { count: totalCases } = await supabase
        .from('cases')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayIso);

      // Get active clients count (clients with cases or active contracts)
      const { count: activeClients } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Get pending cases (cases awaiting assignment)
      const { count: pendingCases } = await supabase
        .from('cases')
        .select('*', { count: 'exact', head: true })
        .in('status', ['new', 'pending_allocation'])
        .gte('created_at', todayIso);

      // Get completed cases (cases that are completed/passed QC)
      const { count: completedCases } = await supabase
        .from('cases')
        .select('*', { count: 'exact', head: true })
        .in('status', ['qc_passed', 'reported', 'payment_complete'])
        .gte('created_at', todayIso);

      return {
        totalCases: totalCases || 0,
        activeClients: activeClients || 0,
        pendingCases: pendingCases || 0,
        completedCases: completedCases || 0,
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      // Return zeros on error
      return {
        totalCases: 0,
        activeClients: 0,
        pendingCases: 0,
        completedCases: 0,
      };
    }
  }

  /**
   * Get case count by status
   */
  static async getCaseCountByStatus(status: string): Promise<number> {
    try {
      const { count } = await supabase
        .from('cases')
        .select('*', { count: 'exact', head: true })
        .eq('status', status);

      return count || 0;
    } catch (error) {
      console.error(`Error fetching case count for status ${status}:`, error);
      return 0;
    }
  }

  /**
   * Get case count by multiple statuses
   */
  static async getCaseCountByStatuses(statuses: string[]): Promise<number> {
    try {
      const { count } = await supabase
        .from('cases')
        .select('*', { count: 'exact', head: true })
        .in('status', statuses);

      return count || 0;
    } catch (error) {
      console.error('Error fetching case count for statuses:', error);
      return 0;
    }
  }
}

