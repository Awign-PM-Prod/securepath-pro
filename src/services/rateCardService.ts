import { supabase } from '@/integrations/supabase/client';

export interface RateCard {
  id: string;
  name: string;
  pincode_tier: 'tier_1' | 'tier_2' | 'tier_3';
  completion_slab: 'within_24h' | 'within_48h' | 'within_72h' | 'within_1w';
  base_rate_inr: number;
  travel_allowance_inr: number;
  bonus_inr: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export interface RateCardConfig {
  pincode_tiers: {
    tier_1: {
      name: string;
      pincodes: string[];
      multiplier: number;
    };
    tier_2: {
      name: string;
      pincodes: string[];
      multiplier: number;
    };
    tier_3: {
      name: string;
      pincodes: string[];
      multiplier: number;
    };
  };
  completion_slabs: {
    within_24h: { multiplier: number; bonus_percentage: number };
    within_48h: { multiplier: number; bonus_percentage: number };
    within_72h: { multiplier: number; bonus_percentage: number };
    within_1w: { multiplier: number; bonus_percentage: number };
  };
  dynamic_pricing: {
    enabled: boolean;
    factors: {
      demand: { weight: number; threshold: number };
      quality: { weight: number; threshold: number };
      distance: { weight: number; max_km: number };
    };
  };
}

export interface RateCalculation {
  base_rate: number;
  travel_allowance: number;
  bonus: number;
  total_rate: number;
  breakdown: {
    pincode_tier: string;
    completion_slab: string;
    base_calculation: string;
    adjustments: string[];
  };
}

export class RateCardService {
  private config: RateCardConfig | null = null;

  constructor() {
    this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('system_config')
        .select('config_key, config_value')
        .eq('config_key', 'rate_card_config');

      if (error) throw error;

      if (data && data.length > 0) {
        this.config = data[0].config_value as RateCardConfig;
      } else {
        // Default configuration
        this.config = {
          pincode_tiers: {
            tier_1: {
              name: 'Metro Cities',
              pincodes: ['400001', '400002', '400003', '400004', '400005', '400006', '400007', '400008', '400009', '400010'],
              multiplier: 1.0
            },
            tier_2: {
              name: 'Tier-2 Cities',
              pincodes: ['110001', '110002', '110003', '110004', '110005'],
              multiplier: 0.8
            },
            tier_3: {
              name: 'Rural Areas',
              pincodes: ['123456', '123457', '123458', '123459', '123460'],
              multiplier: 0.6
            }
          },
          completion_slabs: {
            within_24h: { multiplier: 1.2, bonus_percentage: 0.1 },
            within_48h: { multiplier: 1.0, bonus_percentage: 0.05 },
            within_72h: { multiplier: 0.9, bonus_percentage: 0.0 },
            within_1w: { multiplier: 0.8, bonus_percentage: 0.0 }
          },
          dynamic_pricing: {
            enabled: true,
            factors: {
              demand: { weight: 0.3, threshold: 0.8 },
              quality: { weight: 0.4, threshold: 0.85 },
              distance: { weight: 0.3, max_km: 50 }
            }
          }
        };
      }
    } catch (error) {
      console.error('Failed to load rate card config:', error);
    }
  }

  /**
   * Get all active rate cards
   */
  async getRateCards(): Promise<RateCard[]> {
    try {
      const { data, error } = await supabase
        .from('rate_cards')
        .select('*')
        .eq('is_active', true)
        .order('pincode_tier', { ascending: true })
        .order('completion_slab', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get rate cards:', error);
      return [];
    }
  }

  /**
   * Create a new rate card
   */
  async createRateCard(rateCard: Omit<RateCard, 'id' | 'created_at' | 'updated_at'>): Promise<RateCard | null> {
    try {
      const { data, error } = await supabase
        .from('rate_cards')
        .insert({
          ...rateCard,
          created_by: (await supabase.auth.getUser()).data.user?.id,
          updated_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to create rate card:', error);
      return null;
    }
  }

  /**
   * Update an existing rate card
   */
  async updateRateCard(id: string, updates: Partial<RateCard>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('rate_cards')
        .update({
          ...updates,
          updated_by: (await supabase.auth.getUser()).data.user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to update rate card:', error);
      return false;
    }
  }

  /**
   * Delete a rate card
   */
  async deleteRateCard(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('rate_cards')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to delete rate card:', error);
      return false;
    }
  }

  /**
   * Get pincode tier for a given pincode
   */
  getPincodeTier(pincode: string): 'tier_1' | 'tier_2' | 'tier_3' {
    if (!this.config) return 'tier_2';

    for (const [tier, config] of Object.entries(this.config.pincode_tiers)) {
      if (config.pincodes.includes(pincode)) {
        return tier as 'tier_1' | 'tier_2' | 'tier_3';
      }
    }

    return 'tier_2'; // Default to tier 2
  }

  /**
   * Calculate rate for a case
   */
  async calculateRate(
    pincode: string,
    completionSlab: 'within_24h' | 'within_48h' | 'within_72h' | 'within_1w',
    baseRate?: number,
    qualityScore?: number,
    demandLevel?: number,
    distanceKm?: number
  ): Promise<RateCalculation> {
    try {
      const pincodeTier = this.getPincodeTier(pincode);
      
      // Get base rate card
      const { data: rateCard, error } = await supabase
        .from('rate_cards')
        .select('*')
        .eq('pincode_tier', pincodeTier)
        .eq('completion_slab', completionSlab)
        .eq('is_active', true)
        .single();

      if (error || !rateCard) {
        throw new Error('No rate card found for the given criteria');
      }

      let calculatedRate = baseRate || rateCard.base_rate_inr;
      const adjustments: string[] = [];

      // Apply pincode tier multiplier
      if (this.config) {
        const tierConfig = this.config.pincode_tiers[pincodeTier];
        calculatedRate *= tierConfig.multiplier;
        adjustments.push(`Pincode tier (${tierConfig.name}): ${(tierConfig.multiplier * 100).toFixed(0)}%`);
      }

      // Apply completion slab multiplier
      if (this.config) {
        const slabConfig = this.config.completion_slabs[completionSlab];
        calculatedRate *= slabConfig.multiplier;
        adjustments.push(`Completion slab (${completionSlab}): ${(slabConfig.multiplier * 100).toFixed(0)}%`);
      }

      // Apply dynamic pricing if enabled
      if (this.config?.dynamic_pricing.enabled) {
        const factors = this.config.dynamic_pricing.factors;
        let dynamicMultiplier = 1.0;

        // Quality factor
        if (qualityScore && qualityScore >= factors.quality.threshold) {
          const qualityBonus = (qualityScore - factors.quality.threshold) * factors.quality.weight;
          dynamicMultiplier += qualityBonus;
          adjustments.push(`Quality bonus: +${(qualityBonus * 100).toFixed(1)}%`);
        }

        // Demand factor
        if (demandLevel && demandLevel >= factors.demand.threshold) {
          const demandBonus = (demandLevel - factors.demand.threshold) * factors.demand.weight;
          dynamicMultiplier += demandBonus;
          adjustments.push(`Demand bonus: +${(demandBonus * 100).toFixed(1)}%`);
        }

        // Distance factor
        if (distanceKm && distanceKm <= factors.distance.max_km) {
          const distanceBonus = (1 - distanceKm / factors.distance.max_km) * factors.distance.weight;
          dynamicMultiplier += distanceBonus;
          adjustments.push(`Distance bonus: +${(distanceBonus * 100).toFixed(1)}%`);
        }

        calculatedRate *= dynamicMultiplier;
      }

      // Calculate travel allowance
      const travelAllowance = rateCard.travel_allowance_inr;

      // Calculate bonus
      let bonus = rateCard.bonus_inr;
      if (this.config) {
        const slabConfig = this.config.completion_slabs[completionSlab];
        bonus += calculatedRate * slabConfig.bonus_percentage;
        if (slabConfig.bonus_percentage > 0) {
          adjustments.push(`Completion bonus: ${(slabConfig.bonus_percentage * 100).toFixed(1)}%`);
        }
      }

      const totalRate = calculatedRate + travelAllowance + bonus;

      return {
        base_rate: Math.round(calculatedRate * 100) / 100,
        travel_allowance: travelAllowance,
        bonus: Math.round(bonus * 100) / 100,
        total_rate: Math.round(totalRate * 100) / 100,
        breakdown: {
          pincode_tier: pincodeTier,
          completion_slab: completionSlab,
          base_calculation: `₹${baseRate || rateCard.base_rate_inr} × ${(this.config?.pincode_tiers[pincodeTier].multiplier || 1) * (this.config?.completion_slabs[completionSlab].multiplier || 1)} = ₹${calculatedRate.toFixed(2)}`,
          adjustments
        }
      };
    } catch (error) {
      console.error('Failed to calculate rate:', error);
      throw error;
    }
  }

  /**
   * Get rate card configuration
   */
  async getConfig(): Promise<RateCardConfig | null> {
    if (!this.config) {
      await this.loadConfig();
    }
    return this.config;
  }

  /**
   * Update rate card configuration
   */
  async updateConfig(config: RateCardConfig): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('system_config')
        .upsert({
          config_key: 'rate_card_config',
          config_value: config,
          updated_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;
      
      this.config = config;
      return true;
    } catch (error) {
      console.error('Failed to update rate card config:', error);
      return false;
    }
  }

  /**
   * Get rate card suggestions for a case
   */
  async getRateCardSuggestions(
    pincode: string,
    completionSlab: 'within_24h' | 'within_48h' | 'within_72h' | 'within_1w'
  ): Promise<RateCard[]> {
    try {
      const pincodeTier = this.getPincodeTier(pincode);
      
      const { data, error } = await supabase
        .from('rate_cards')
        .select('*')
        .eq('pincode_tier', pincodeTier)
        .eq('is_active', true)
        .order('base_rate_inr', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get rate card suggestions:', error);
      return [];
    }
  }

  /**
   * Bulk create rate cards
   */
  async bulkCreateRateCards(rateCards: Omit<RateCard, 'id' | 'created_at' | 'updated_at'>[]): Promise<boolean> {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const now = new Date().toISOString();
      
      const rateCardsWithMeta = rateCards.map(rateCard => ({
        ...rateCard,
        created_by: userId,
        updated_by: userId,
        created_at: now,
        updated_at: now
      }));

      const { error } = await supabase
        .from('rate_cards')
        .insert(rateCardsWithMeta);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to bulk create rate cards:', error);
      return false;
    }
  }
}

// Export singleton instance
export const rateCardService = new RateCardService();

