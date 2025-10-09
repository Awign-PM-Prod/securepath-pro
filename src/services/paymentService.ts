import { supabase } from '@/integrations/supabase/client';

export interface PaymentCycle {
  id: string;
  cycle_tag: string;
  start_date: string;
  end_date: string;
  status: 'draft' | 'processing' | 'completed' | 'cancelled';
  total_amount_inr: number;
  total_cases: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export interface PaymentLine {
  id: string;
  payment_cycle_id: string;
  case_id: string;
  gig_partner_id: string;
  vendor_id?: string;
  assignment_type: 'gig' | 'vendor';
  base_rate_inr: number;
  travel_allowance_inr: number;
  bonus_inr: number;
  adjustment_inr: number;
  total_amount_inr: number;
  status: 'pending' | 'approved' | 'paid' | 'cancelled';
  payment_method?: 'bank_transfer' | 'upi' | 'wallet';
  payment_reference?: string;
  paid_at?: string;
  created_at: string;
  updated_at: string;
}

export interface VendorPayout {
  id: string;
  payment_cycle_id: string;
  vendor_id: string;
  total_amount_inr: number;
  total_cases: number;
  status: 'pending' | 'approved' | 'paid' | 'cancelled';
  payment_method: 'bank_transfer' | 'upi' | 'wallet';
  payment_reference?: string;
  paid_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentAdjustment {
  id: string;
  payment_line_id: string;
  adjustment_type: 'bonus' | 'penalty' | 'correction' | 'refund';
  amount_inr: number;
  reason: string;
  approved_by: string;
  created_at: string;
}

export interface FinancialReport {
  id: string;
  report_type: 'payment_cycle' | 'vendor_summary' | 'gig_worker_summary' | 'client_billing';
  period_start: string;
  period_end: string;
  total_amount_inr: number;
  total_cases: number;
  report_data: any;
  generated_at: string;
  generated_by: string;
}

export class PaymentService {
  /**
   * Create a new payment cycle
   */
  async createPaymentCycle(
    startDate: string,
    endDate: string,
    cycleTag?: string
  ): Promise<PaymentCycle | null> {
    try {
      const tag = cycleTag || `CYCLE-${new Date().toISOString().slice(0, 10)}`;
      
      const { data, error } = await supabase
        .from('payment_cycles')
        .insert({
          cycle_tag: tag,
          start_date: startDate,
          end_date: endDate,
          status: 'draft',
          total_amount_inr: 0,
          total_cases: 0,
          created_by: (await supabase.auth.getUser()).data.user?.id,
          updated_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to create payment cycle:', error);
      return null;
    }
  }

  /**
   * Get all payment cycles
   */
  async getPaymentCycles(): Promise<PaymentCycle[]> {
    try {
      const { data, error } = await supabase
        .from('payment_cycles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get payment cycles:', error);
      return [];
    }
  }

  /**
   * Process a payment cycle
   */
  async processPaymentCycle(cycleId: string): Promise<boolean> {
    try {
      // Update cycle status to processing
      const { error: cycleError } = await supabase
        .from('payment_cycles')
        .update({ status: 'processing' })
        .eq('id', cycleId);

      if (cycleError) throw cycleError;

      // Get all completed cases in the cycle period
      const { data: cycle, error: cycleDataError } = await supabase
        .from('payment_cycles')
        .select('start_date, end_date')
        .eq('id', cycleId)
        .single();

      if (cycleDataError) throw cycleDataError;

      const { data: cases, error: casesError } = await supabase
        .from('cases')
        .select(`
          id,
          current_assignee_id,
          current_assignee_type,
          current_vendor_id,
          base_rate_inr,
          total_rate_inr,
          travel_allowance_inr,
          bonus_inr,
          status_updated_at
        `)
        .eq('status', 'completed')
        .gte('status_updated_at', cycle.start_date)
        .lte('status_updated_at', cycle.end_date);

      if (casesError) throw casesError;

      // Create payment lines
      const paymentLines = cases.map(caseItem => ({
        payment_cycle_id: cycleId,
        case_id: caseItem.id,
        gig_partner_id: caseItem.current_assignee_id,
        vendor_id: caseItem.current_vendor_id,
        assignment_type: caseItem.current_assignee_type,
        base_rate_inr: caseItem.base_rate_inr,
        travel_allowance_inr: caseItem.travel_allowance_inr || 0,
        bonus_inr: caseItem.bonus_inr || 0,
        adjustment_inr: 0,
        total_amount_inr: caseItem.total_rate_inr,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error: linesError } = await supabase
        .from('payment_lines')
        .insert(paymentLines);

      if (linesError) throw linesError;

      // Calculate totals
      const totalAmount = paymentLines.reduce((sum, line) => sum + line.total_amount_inr, 0);
      const totalCases = paymentLines.length;

      // Update cycle with totals
      const { error: updateError } = await supabase
        .from('payment_cycles')
        .update({
          total_amount_inr: totalAmount,
          total_cases: totalCases,
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', cycleId);

      if (updateError) throw updateError;

      return true;
    } catch (error) {
      console.error('Failed to process payment cycle:', error);
      return false;
    }
  }

  /**
   * Get payment lines for a cycle
   */
  async getPaymentLines(cycleId: string): Promise<PaymentLine[]> {
    try {
      const { data, error } = await supabase
        .from('payment_lines')
        .select('*')
        .eq('payment_cycle_id', cycleId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get payment lines:', error);
      return [];
    }
  }

  /**
   * Approve payment lines
   */
  async approvePaymentLines(lineIds: string[]): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('payment_lines')
        .update({ 
          status: 'approved',
          updated_at: new Date().toISOString()
        })
        .in('id', lineIds);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to approve payment lines:', error);
      return false;
    }
  }

  /**
   * Mark payment lines as paid
   */
  async markPaymentLinesAsPaid(
    lineIds: string[],
    paymentMethod: 'bank_transfer' | 'upi' | 'wallet',
    paymentReference?: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('payment_lines')
        .update({
          status: 'paid',
          payment_method: paymentMethod,
          payment_reference: paymentReference,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .in('id', lineIds);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to mark payment lines as paid:', error);
      return false;
    }
  }

  /**
   * Create payment adjustment
   */
  async createPaymentAdjustment(
    paymentLineId: string,
    adjustmentType: 'bonus' | 'penalty' | 'correction' | 'refund',
    amountInr: number,
    reason: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('payment_adjustments')
        .insert({
          payment_line_id: paymentLineId,
          adjustment_type: adjustmentType,
          amount_inr: amountInr,
          reason: reason,
          approved_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;

      // Update payment line total
      const { data: paymentLine, error: lineError } = await supabase
        .from('payment_lines')
        .select('total_amount_inr, adjustment_inr')
        .eq('id', paymentLineId)
        .single();

      if (lineError) throw lineError;

      const newAdjustmentTotal = (paymentLine.adjustment_inr || 0) + amountInr;
      const newTotal = paymentLine.total_amount_inr + amountInr;

      const { error: updateError } = await supabase
        .from('payment_lines')
        .update({
          adjustment_inr: newAdjustmentTotal,
          total_amount_inr: newTotal,
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentLineId);

      if (updateError) throw updateError;
      return true;
    } catch (error) {
      console.error('Failed to create payment adjustment:', error);
      return false;
    }
  }

  /**
   * Get vendor payouts for a cycle
   */
  async getVendorPayouts(cycleId: string): Promise<VendorPayout[]> {
    try {
      const { data, error } = await supabase
        .from('vendor_payouts')
        .select('*')
        .eq('payment_cycle_id', cycleId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get vendor payouts:', error);
      return [];
    }
  }

  /**
   * Generate financial report
   */
  async generateFinancialReport(
    reportType: 'payment_cycle' | 'vendor_summary' | 'gig_worker_summary' | 'client_billing',
    periodStart: string,
    periodEnd: string
  ): Promise<FinancialReport | null> {
    try {
      let reportData: any = {};

      switch (reportType) {
        case 'payment_cycle':
          reportData = await this.generatePaymentCycleReport(periodStart, periodEnd);
          break;
        case 'vendor_summary':
          reportData = await this.generateVendorSummaryReport(periodStart, periodEnd);
          break;
        case 'gig_worker_summary':
          reportData = await this.generateGigWorkerSummaryReport(periodStart, periodEnd);
          break;
        case 'client_billing':
          reportData = await this.generateClientBillingReport(periodStart, periodEnd);
          break;
      }

      const { data, error } = await supabase
        .from('financial_reports')
        .insert({
          report_type: reportType,
          period_start: periodStart,
          period_end: periodEnd,
          total_amount_inr: reportData.total_amount || 0,
          total_cases: reportData.total_cases || 0,
          report_data: reportData,
          generated_at: new Date().toISOString(),
          generated_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to generate financial report:', error);
      return null;
    }
  }

  private async generatePaymentCycleReport(periodStart: string, periodEnd: string) {
    const { data: cycles, error } = await supabase
      .from('payment_cycles')
      .select(`
        *,
        payment_lines(*)
      `)
      .gte('start_date', periodStart)
      .lte('end_date', periodEnd);

    if (error) throw error;

    const totalAmount = cycles?.reduce((sum, cycle) => sum + cycle.total_amount_inr, 0) || 0;
    const totalCases = cycles?.reduce((sum, cycle) => sum + cycle.total_cases, 0) || 0;

    return {
      cycles: cycles || [],
      total_amount: totalAmount,
      total_cases: totalCases,
      period_start: periodStart,
      period_end: periodEnd
    };
  }

  private async generateVendorSummaryReport(periodStart: string, periodEnd: string) {
    const { data: payouts, error } = await supabase
      .from('vendor_payouts')
      .select(`
        *,
        vendors!inner(
          id,
          profiles!inner(first_name, last_name)
        )
      `)
      .gte('created_at', periodStart)
      .lte('created_at', periodEnd);

    if (error) throw error;

    return {
      payouts: payouts || [],
      total_amount: payouts?.reduce((sum, payout) => sum + payout.total_amount_inr, 0) || 0,
      total_cases: payouts?.reduce((sum, payout) => sum + payout.total_cases, 0) || 0
    };
  }

  private async generateGigWorkerSummaryReport(periodStart: string, periodEnd: string) {
    const { data: paymentLines, error } = await supabase
      .from('payment_lines')
      .select(`
        *,
        gig_partners!inner(
          id,
          profiles!inner(first_name, last_name)
        )
      `)
      .gte('created_at', periodStart)
      .lte('created_at', periodEnd);

    if (error) throw error;

    return {
      payment_lines: paymentLines || [],
      total_amount: paymentLines?.reduce((sum, line) => sum + line.total_amount_inr, 0) || 0,
      total_cases: paymentLines?.length || 0
    };
  }

  private async generateClientBillingReport(periodStart: string, periodEnd: string) {
    const { data: cases, error } = await supabase
      .from('cases')
      .select(`
        id,
        case_number,
        client_id,
        total_rate_inr,
        status,
        created_at,
        clients!inner(
          id,
          profiles!inner(first_name, last_name, email)
        )
      `)
      .gte('created_at', periodStart)
      .lte('created_at', periodEnd);

    if (error) throw error;

    return {
      cases: cases || [],
      total_amount: cases?.reduce((sum, caseItem) => sum + caseItem.total_rate_inr, 0) || 0,
      total_cases: cases?.length || 0
    };
  }

  /**
   * Get payment configuration
   */
  async getPaymentConfig(): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('payment_config')
        .select('config_key, config_value')
        .in('config_key', [
          'payment_cycle_frequency',
          'payment_methods',
          'approval_workflow',
          'notification_settings'
        ]);

      if (error) throw error;

      const config: any = {};
      data?.forEach(item => {
        config[item.config_key] = item.config_value;
      });

      return config;
    } catch (error) {
      console.error('Failed to get payment config:', error);
      return {};
    }
  }
}

// Export singleton instance
export const paymentService = new PaymentService();

