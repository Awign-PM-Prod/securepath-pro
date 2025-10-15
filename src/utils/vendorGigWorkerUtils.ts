// =====================================================
// Vendor-Gig Worker Association Utilities
// Background Verification Platform
// =====================================================

import { supabase } from '@/integrations/supabase/client';

export interface GigWorkerVendorInfo {
  gigWorkerId: string;
  vendorId: string | null;
  isDirectGig: boolean;
  vendorName?: string;
  vendorEmail?: string;
}

/**
 * Check if a gig worker is associated with a vendor
 */
export async function isGigWorkerAssociatedWithVendor(
  gigWorkerId: string, 
  vendorId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('gig_partners')
      .select('vendor_id, is_direct_gig')
      .eq('id', gigWorkerId)
      .single();

    if (error || !data) {
      console.error('Error fetching gig worker vendor info:', error);
      return false;
    }

    return data.vendor_id === vendorId && !data.is_direct_gig;
  } catch (error) {
    console.error('Error checking gig worker vendor association:', error);
    return false;
  }
}

/**
 * Get vendor information for a gig worker
 */
export async function getGigWorkerVendorInfo(
  gigWorkerId: string
): Promise<GigWorkerVendorInfo | null> {
  try {
    const { data, error } = await supabase
      .from('gig_partners')
      .select(`
        id,
        vendor_id,
        is_direct_gig,
        vendors!inner(
          id,
          name,
          email
        )
      `)
      .eq('id', gigWorkerId)
      .single();

    if (error || !data) {
      console.error('Error fetching gig worker vendor info:', error);
      return null;
    }

    return {
      gigWorkerId: data.id,
      vendorId: data.vendor_id,
      isDirectGig: data.is_direct_gig,
      vendorName: data.vendors?.name,
      vendorEmail: data.vendors?.email
    };
  } catch (error) {
    console.error('Error getting gig worker vendor info:', error);
    return null;
  }
}

/**
 * Get all gig workers for a specific vendor
 */
export async function getVendorGigWorkers(vendorId: string) {
  try {
    const { data, error } = await supabase
      .from('gig_partners')
      .select(`
        id,
        user_id,
        profile_id,
        phone,
        alternate_phone,
        address,
        city,
        state,
        pincode,
        country,
        coverage_pincodes,
        max_daily_capacity,
        capacity_available,
        last_capacity_reset,
        completion_rate,
        ontime_completion_rate,
        acceptance_rate,
        quality_score,
        qc_pass_count,
        total_cases_completed,
        active_cases_count,
        last_assignment_at,
        vendor_id,
        is_direct_gig,
        device_info,
        last_seen_at,
        is_active,
        is_available,
        created_by,
        created_at,
        updated_at,
        profiles!inner(
          first_name,
          last_name,
          email
        )
      `)
      .eq('vendor_id', vendorId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching vendor gig workers:', error);
      return [];
    }

    return data?.map(gw => ({
      ...gw,
      first_name: gw.profiles.first_name,
      last_name: gw.profiles.last_name,
      email: gw.profiles.email
    })) || [];
  } catch (error) {
    console.error('Error getting vendor gig workers:', error);
    return [];
  }
}

/**
 * Get all direct gig workers (not associated with any vendor)
 */
export async function getDirectGigWorkers() {
  try {
    const { data, error } = await supabase
      .from('gig_partners')
      .select(`
        id,
        user_id,
        profile_id,
        phone,
        alternate_phone,
        address,
        city,
        state,
        pincode,
        country,
        coverage_pincodes,
        max_daily_capacity,
        capacity_available,
        last_capacity_reset,
        completion_rate,
        ontime_completion_rate,
        acceptance_rate,
        quality_score,
        qc_pass_count,
        total_cases_completed,
        active_cases_count,
        last_assignment_at,
        vendor_id,
        is_direct_gig,
        device_info,
        last_seen_at,
        is_active,
        is_available,
        created_by,
        created_at,
        updated_at,
        profiles!inner(
          first_name,
          last_name,
          email
        )
      `)
      .is('vendor_id', null)
      .eq('is_direct_gig', true)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching direct gig workers:', error);
      return [];
    }

    return data?.map(gw => ({
      ...gw,
      first_name: gw.profiles.first_name,
      last_name: gw.profiles.last_name,
      email: gw.profiles.email
    })) || [];
  } catch (error) {
    console.error('Error getting direct gig workers:', error);
    return [];
  }
}

/**
 * Check if a gig worker can be assigned to a case by a vendor
 */
export async function canVendorAssignGigWorker(
  vendorId: string,
  gigWorkerId: string
): Promise<{ canAssign: boolean; reason?: string }> {
  try {
    const vendorInfo = await getGigWorkerVendorInfo(gigWorkerId);
    
    if (!vendorInfo) {
      return { canAssign: false, reason: 'Gig worker not found' };
    }

    if (vendorInfo.isDirectGig) {
      return { canAssign: false, reason: 'Gig worker is direct (not vendor-associated)' };
    }

    if (vendorInfo.vendorId !== vendorId) {
      return { canAssign: false, reason: 'Gig worker belongs to a different vendor' };
    }

    return { canAssign: true };
  } catch (error) {
    console.error('Error checking vendor assignment permission:', error);
    return { canAssign: false, reason: 'Error checking permissions' };
  }
}

/**
 * Get vendor association status for display
 */
export function getVendorAssociationStatus(gigWorker: any): {
  status: 'vendor-associated' | 'direct' | 'unknown';
  vendorName?: string;
  displayText: string;
} {
  if (gigWorker.vendor_id && !gigWorker.is_direct_gig) {
    return {
      status: 'vendor-associated',
      vendorName: gigWorker.vendor_name,
      displayText: `Associated with ${gigWorker.vendor_name || 'Vendor'}`
    };
  } else if (gigWorker.is_direct_gig) {
    return {
      status: 'direct',
      displayText: 'Direct Gig Worker'
    };
  } else {
    return {
      status: 'unknown',
      displayText: 'Unknown Status'
    };
  }
}
