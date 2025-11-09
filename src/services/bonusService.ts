import { supabase } from '@/integrations/supabase/client';

export interface AddBonusData {
  caseId: string;
  amount: number;
  reason?: string;
}

export interface BonusRecord {
  id: string;
  case_id: string;
  amount: number;
  reason?: string;
  added_by: string;
  added_at: string;
}

export class BonusService {
  /**
   * Add bonus to a case
   */
  static async addBonus(data: AddBonusData): Promise<BonusRecord> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      throw new Error('User not authenticated');
    }

    // First, get the current case to check if bonus can be added
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('status, bonus_inr, total_payout_inr')
      .eq('id', data.caseId)
      .single();

    if (caseError) {
      throw new Error(`Failed to fetch case: ${caseError.message}`);
    }

    // Check if bonus can be added based on case status
    const allowedStatuses = ['created', 'allocated'];
    if (!allowedStatuses.includes(caseData.status)) {
      throw new Error(`Bonus cannot be added to cases in ${caseData.status} status`);
    }

    // Calculate new bonus amount
    const currentBonus = caseData.bonus_inr || 0;
    const newBonusAmount = currentBonus + data.amount;
    const newTotalPayout = (caseData.total_payout_inr || 0) + data.amount;

    // Update the case with new bonus amount
    const { data: updatedCase, error: updateError } = await supabase
      .from('cases')
      .update({
        bonus_inr: newBonusAmount,
        total_payout_inr: newTotalPayout,
        last_updated_by: user.user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', data.caseId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update case: ${updateError.message}`);
    }

    // Log the bonus addition in audit logs
    await supabase
      .from('audit_logs')
      .insert({
        entity_type: 'case',
        entity_id: data.caseId,
        action: 'bonus_added',
        old_values: { bonus_inr: currentBonus, total_payout_inr: caseData.total_payout_inr },
        new_values: { bonus_inr: newBonusAmount, total_payout_inr: newTotalPayout },
        changed_fields: ['bonus_inr', 'total_payout_inr'],
        case_id: data.caseId,
        user_id: user.user.id,
        metadata: {
          bonus_amount: data.amount,
          reason: data.reason,
          previous_bonus: currentBonus
        }
      });

    return {
      id: data.caseId,
      case_id: data.caseId,
      amount: data.amount,
      reason: data.reason,
      added_by: user.user.id,
      added_at: new Date().toISOString()
    };
  }

  /**
   * Get bonus history for a case
   */
  static async getBonusHistory(caseId: string): Promise<BonusRecord[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('case_id', caseId)
      .eq('action', 'bonus_added')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch bonus history: ${error.message}`);
    }

    return data.map(record => ({
      id: record.id,
      case_id: record.case_id,
      amount: (record.metadata as any)?.bonus_amount || 0,
      reason: (record.metadata as any)?.reason,
      added_by: record.user_id,
      added_at: record.created_at
    }));
  }

  /**
   * Check if bonus can be added to a case
   */
  static async canAddBonus(caseId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('cases')
      .select('status')
      .eq('id', caseId)
      .single();

    if (error) {
      return false;
    }

    const allowedStatuses = ['created', 'allocated'];
    return allowedStatuses.includes(data.status);
  }
}
