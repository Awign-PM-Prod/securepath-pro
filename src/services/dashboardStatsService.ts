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
      // Restrict to cases shown in ops/cases page: created after November 2nd, 2025
      const cutoffDate = new Date('2025-11-02T00:00:00.000Z');
      const cutoffDateISOString = cutoffDate.toISOString();

      // Get total cases count
      const { count: totalCases } = await supabase
        .from('cases')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .gte('created_at', cutoffDateISOString);

      // Get active clients count (clients with cases or active contracts)
      const { count: activeClients } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Get pending cases (cases awaiting assignment)
      const { count: pendingCases } = await supabase
        .from('cases')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .in('status', ['new', 'pending_allocation'])
        .gte('created_at', cutoffDateISOString);

      // Get completed cases (cases that are completed/passed QC)
      const { count: completedCases } = await supabase
        .from('cases')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .in('status', ['qc_passed', 'reported', 'payment_complete'])
        .gte('created_at', cutoffDateISOString);

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
        .eq('is_active', true)
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
        .eq('is_active', true)
        .in('status', statuses);

      return count || 0;
    } catch (error) {
      console.error('Error fetching case count for statuses:', error);
      return 0;
    }
  }
}

