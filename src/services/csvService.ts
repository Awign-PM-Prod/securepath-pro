import { supabase } from '@/integrations/supabase/client';

export interface CaseCSVRow {
  case_number?: string;
  client_case_id: string;
  contract_type: string;
  candidate_name: string;
  phone_primary: string;
  phone_secondary?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  location_url?: string;
  vendor_tat_start_date: string;
  // Optional fields for updates
  status?: string;
  priority?: string;
  description?: string;
}

export interface CSVImportResult {
  successful: number;
  failed: number;
  errors: string[];
  created: string[];
  updated: string[];
}

export interface CSVExportOptions {
  status?: string[];
  client_id?: string;
  date_from?: string;
  date_to?: string;
  assignee_id?: string;
  priority?: string[];
}

export class CSVService {
  /**
   * Parse CSV file content
   */
  parseCSV(csvContent: string): CaseCSVRow[] {
    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = this.parseCSVLine(lines[0]);
    console.log('CSV Headers:', headers);
    const rows: CaseCSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length !== headers.length) continue;

      const row: CaseCSVRow = {} as CaseCSVRow;
      headers.forEach((header, index) => {
        const value = values[index]?.trim();
        if (value) {
          // Extract field name from header (remove description in parentheses)
          const fieldName = header.split(' (')[0];
          (row as any)[fieldName] = value;
        }
      });
      console.log('Parsed row:', row);
      rows.push(row);
    }

    return rows;
  }

  /**
   * Parse a single CSV line handling quoted values
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i += 2;
          continue;
        }
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
      i++;
    }

    result.push(current);
    return result;
  }

  /**
   * Validate CSV row data
   */
  validateCSVRow(row: CaseCSVRow, index: number): string[] {
    const errors: string[] = [];

    // Required fields
    if (!row.client_case_id) {
      errors.push(`Row ${index + 1}: client_case_id is required`);
    }
    if (!row.contract_type) {
      errors.push(`Row ${index + 1}: contract_type is required`);
    }
    if (!row.candidate_name) {
      errors.push(`Row ${index + 1}: candidate_name is required`);
    }
    if (!row.phone_primary) {
      errors.push(`Row ${index + 1}: phone_primary is required`);
    }
    if (!row.address) {
      errors.push(`Row ${index + 1}: address is required`);
    }
    if (!row.city) {
      errors.push(`Row ${index + 1}: city is required`);
    }
    if (!row.state) {
      errors.push(`Row ${index + 1}: state is required`);
    }
    if (!row.pincode) {
      errors.push(`Row ${index + 1}: pincode is required`);
    }
    if (!row.vendor_tat_start_date) {
      errors.push(`Row ${index + 1}: vendor_tat_start_date is required`);
    }

    // Validate phone number format
    if (row.phone_primary && !/^\d{10}$/.test(row.phone_primary.replace(/\D/g, ''))) {
      errors.push(`Row ${index + 1}: phone_primary must be a valid 10-digit number`);
    }
    if (row.phone_secondary && !/^\d{10}$/.test(row.phone_secondary.replace(/\D/g, ''))) {
      errors.push(`Row ${index + 1}: phone_secondary must be a valid 10-digit number`);
    }

    // Validate date format
    if (row.vendor_tat_start_date && isNaN(Date.parse(row.vendor_tat_start_date))) {
      errors.push(`Row ${index + 1}: vendor_tat_start_date must be a valid date (YYYY-MM-DD)`);
    }

    // Validate pincode format
    if (row.pincode && !/^\d{6}$/.test(row.pincode)) {
      errors.push(`Row ${index + 1}: pincode must be a valid 6-digit number`);
    }

    return errors;
  }

  /**
   * Import cases from CSV
   */
  async importCases(csvContent: string, isUpdate: boolean = false): Promise<CSVImportResult> {
    const rows = this.parseCSV(csvContent);
    const result: CSVImportResult = {
      successful: 0,
      failed: 0,
      errors: [],
      created: [],
      updated: []
    };

    // Validate all rows first
    for (let i = 0; i < rows.length; i++) {
      const errors = this.validateCSVRow(rows[i], i);
      if (errors.length > 0) {
        result.errors.push(...errors);
        result.failed++;
        continue;
      }
    }

    if (result.errors.length > 0) {
      return result;
    }

    // Process each valid row
    for (const row of rows) {
      try {
        if (isUpdate) {
          await this.updateCaseFromCSV(row);
          result.updated.push(row.client_case_id);
        } else {
          await this.createCaseFromCSV(row);
          result.created.push(row.client_case_id);
        }
        result.successful++;
      } catch (error) {
        result.failed++;
        result.errors.push(`${row.client_case_id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return result;
  }

  /**
   * Create case from CSV row
   */
  private async createCaseFromCSV(row: CaseCSVRow): Promise<void> {
    // Get or create location
    const locationId = await this.getOrCreateLocation(row);

    // Get client by contract type (assuming we can find client from contract type)
    const clientId = await this.getClientByContractType(row.contract_type);

    // Get case defaults including payout calculation
    const caseDefaults = await this.getCaseDefaults(clientId, row.contract_type, row.pincode);
    console.log('Case defaults for payout calculation:', caseDefaults);

    // Generate case number if not provided
    const caseNumber = row.case_number || await this.generateCaseNumber();

    // Calculate due date based on TAT
    const dueAt = new Date(Date.now() + (caseDefaults.tat_hours || 24) * 60 * 60 * 1000);

    // Create case
    const { error } = await supabase
      .from('cases')
      .insert({
        case_number: caseNumber,
        title: `${row.candidate_name} - ${row.contract_type}`,
        description: `Background verification for ${row.candidate_name}`,
        client_id: clientId,
        location_id: locationId,
        client_case_id: row.client_case_id,
        contract_type: row.contract_type,
        candidate_name: row.candidate_name,
        phone_primary: row.phone_primary,
        phone_secondary: row.phone_secondary,
        vendor_tat_start_date: row.vendor_tat_start_date,
        tat_hours: caseDefaults.tat_hours || 24,
        due_at: dueAt.toISOString(),
        status: 'created',
        priority: row.priority || 'medium',
        base_rate_inr: caseDefaults.base_rate_inr || 0,
        total_rate_inr: caseDefaults.total_rate_inr || 0,
        bonus_inr: 0, // Will be calculated based on completion time
        penalty_inr: 0, // Will be calculated based on completion time
        total_payout_inr: caseDefaults.total_rate_inr || 0,
        created_by: (await supabase.auth.getUser()).data.user?.id
      });

    if (error) throw error;
  }

  /**
   * Update case from CSV row
   */
  private async updateCaseFromCSV(row: CaseCSVRow): Promise<void> {
    // Find existing case by client_case_id
    const { data: existingCase, error: findError } = await supabase
      .from('cases')
      .select('id, location_id, client_id')
      .eq('client_case_id', row.client_case_id)
      .single();

    if (findError || !existingCase) {
      throw new Error('Case not found for update');
    }

    // Get or create location
    const locationId = await this.getOrCreateLocation(row);

    // Get case defaults for payout calculation
    const caseDefaults = await this.getCaseDefaults(existingCase.client_id, row.contract_type, row.pincode);

    // Update case
    const { error } = await supabase
      .from('cases')
      .update({
        candidate_name: row.candidate_name,
        phone_primary: row.phone_primary,
        phone_secondary: row.phone_secondary,
        vendor_tat_start_date: row.vendor_tat_start_date,
        location_id: locationId,
        status: row.status || 'created',
        priority: row.priority || 'medium',
        tat_hours: caseDefaults.tat_hours || 24,
        base_rate_inr: caseDefaults.base_rate_inr || 0,
        total_rate_inr: caseDefaults.total_rate_inr || 0,
        total_payout_inr: caseDefaults.total_rate_inr || 0,
        last_updated_by: (await supabase.auth.getUser()).data.user?.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingCase.id);

    if (error) throw error;
  }

  /**
   * Get or create location
   */
  private async getOrCreateLocation(row: CaseCSVRow): Promise<string> {
    // Check if location exists
    const { data: existingLocation } = await supabase
      .from('locations')
      .select('id')
      .eq('pincode', row.pincode)
      .eq('address_line', row.address)
      .single();

    if (existingLocation) {
      return existingLocation.id;
    }

    // Get pincode tier
    const { data: pincodeTier } = await supabase
      .from('pincode_tiers')
      .select('tier')
      .eq('pincode', row.pincode)
      .single();

    // Create new location
    const { data: newLocation, error } = await supabase
      .from('locations')
      .insert({
        address_line: row.address,
        city: row.city,
        state: row.state,
        pincode: row.pincode,
        pincode_tier: pincodeTier?.tier || 'tier_3',
        country: 'India',
        location_url: row.location_url || null
      })
      .select()
      .single();

    if (error) throw error;
    return newLocation.id;
  }

  /**
   * Get client by contract type
   */
  private async getClientByContractType(contractType: string): Promise<string> {
    // This is a simplified approach - you might want to implement more sophisticated client matching
    const { data: client, error } = await supabase
      .from('clients')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (error || !client) {
      throw new Error('No active client found');
    }

    return client.id;
  }

  /**
   * Get case defaults including payout calculation
   */
  private async getCaseDefaults(clientId: string, contractType: string, pincode: string): Promise<any> {
    try {
      // First, get the pincode tier
      const { data: pincodeData, error: pincodeError } = await supabase
        .from('pincode_tiers')
        .select('tier, city, state')
        .eq('pincode', pincode)
        .single();

      if (pincodeError || !pincodeData) {
        console.warn('Pincode tier not found, using default values');
        return {
          tat_hours: 72, // 3 days default
          base_rate_inr: 300, // Default rate
          total_rate_inr: 300,
          tier: 'tier_3'
        };
      }

      // Get client contract for the contract type
      const { data: contractData, error: contractError } = await supabase
        .from('client_contracts')
        .select('*')
        .eq('client_id', clientId)
        .eq('contract_type', contractType)
        .eq('is_active', true)
        .single();

      if (contractError || !contractData) {
        console.warn('Client contract not found, using default values');
        // Use default payouts based on tier
        let defaultRate = 0;
        let defaultTat = 24;
        
        switch (pincodeData.tier) {
          case 'tier1':
            defaultRate = 500;
            defaultTat = 24; // 1 day
            break;
          case 'tier2':
            defaultRate = 400;
            defaultTat = 48; // 2 days
            break;
          case 'tier3':
            defaultRate = 300;
            defaultTat = 72; // 3 days
            break;
          default:
            defaultRate = 300;
            defaultTat = 72;
        }
        
        return {
          tat_hours: defaultTat,
          base_rate_inr: defaultRate,
          total_rate_inr: defaultRate,
          tier: pincodeData.tier
        };
      }

      // Calculate payout based on tier
      let baseRate = 0;
      let tatHours = 24;

      switch (pincodeData.tier) {
        case 'tier1':
          baseRate = contractData.tier1_base_payout_inr || 0;
          tatHours = (contractData.tier1_tat_days || 1) * 24;
          break;
        case 'tier2':
          baseRate = contractData.tier2_base_payout_inr || 0;
          tatHours = (contractData.tier2_tat_days || 2) * 24;
          break;
        case 'tier3':
          baseRate = contractData.tier3_base_payout_inr || 0;
          tatHours = (contractData.tier3_tat_days || 3) * 24;
          break;
        default:
          baseRate = contractData.tier3_base_payout_inr || 0;
          tatHours = (contractData.tier3_tat_days || 3) * 24;
      }

      console.log('Payout calculation:', {
        pincode,
        tier: pincodeData.tier,
        baseRate,
        tatHours,
        contractType
      });

      return {
        tat_hours: tatHours,
        base_rate_inr: baseRate,
        total_rate_inr: baseRate,
        tier: pincodeData.tier
      };

    } catch (error) {
      console.error('Error in getCaseDefaults:', error);
      return {
        tat_hours: 24,
        base_rate_inr: 0,
        total_rate_inr: 0,
        tier: 'tier_3'
      };
    }
  }

  /**
   * Generate case number
   */
  private async generateCaseNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `BG-${dateStr}-${randomStr}`;
  }

  /**
   * Export cases to CSV
   */
  async exportCases(options: CSVExportOptions = {}): Promise<string> {
    let query = supabase
      .from('cases')
      .select(`
        case_number,
        client_case_id,
        contract_type,
        candidate_name,
        phone_primary,
        phone_secondary,
        status,
        priority,
        vendor_tat_start_date,
        created_at,
        due_at,
        clients (name),
        locations (address_line, city, state, pincode),
        current_assignee:gig_partners!current_assignee_id (profiles (first_name, last_name))
      `);

    // Apply filters
    if (options.status && options.status.length > 0) {
      query = query.in('status', options.status);
    }
    if (options.client_id) {
      query = query.eq('client_id', options.client_id);
    }
    if (options.assignee_id) {
      query = query.eq('current_assignee_id', options.assignee_id);
    }
    if (options.priority && options.priority.length > 0) {
      query = query.in('priority', options.priority);
    }
    if (options.date_from) {
      query = query.gte('created_at', options.date_from);
    }
    if (options.date_to) {
      query = query.lte('created_at', options.date_to);
    }

    const { data: cases, error } = await query;

    if (error) throw error;

    // Convert to CSV
    const headers = [
      'Case Number',
      'Client Case ID',
      'Contract Type',
      'Candidate Name',
      'Phone Primary',
      'Phone Secondary',
      'Address',
      'City',
      'State',
      'Pincode',
      'Status',
      'Priority',
      'Vendor TAT Start Date',
      'Created At',
      'Due At',
      'Client Name',
      'Assignee Name'
    ];

    const csvRows = cases?.map(caseItem => [
      caseItem.case_number || '',
      caseItem.client_case_id || '',
      caseItem.contract_type || '',
      caseItem.candidate_name || '',
      caseItem.phone_primary || '',
      caseItem.phone_secondary || '',
      caseItem.locations?.address_line || '',
      caseItem.locations?.city || '',
      caseItem.locations?.state || '',
      caseItem.locations?.pincode || '',
      caseItem.status || '',
      caseItem.priority || '',
      caseItem.vendor_tat_start_date || '',
      caseItem.created_at || '',
      caseItem.due_at || '',
      caseItem.clients?.name || '',
      caseItem.current_assignee?.profiles ? 
        `${caseItem.current_assignee.profiles.first_name} ${caseItem.current_assignee.profiles.last_name}` : ''
    ]) || [];

    return this.arrayToCSV([headers, ...csvRows]);
  }

  /**
   * Convert array to CSV string
   */
  private arrayToCSV(data: string[][]): string {
    return data.map(row => 
      row.map(cell => {
        const cellStr = String(cell || '');
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',')
    ).join('\n');
  }

  /**
   * Test payout calculation
   */
  async testPayoutCalculation(): Promise<void> {
    console.log('Testing payout calculation...');
    
    try {
      // Test with sample data
      const testData = [
        { pincode: '560001', contractType: 'residential_address_check' },
        { pincode: '400001', contractType: 'business_address_check' },
        { pincode: '999999', contractType: 'residential_address_check' } // Non-existent pincode
      ];

      for (const test of testData) {
        const clientId = await this.getClientByContractType(test.contractType);
        const defaults = await this.getCaseDefaults(clientId, test.contractType, test.pincode);
        console.log(`Test for pincode ${test.pincode}, contract ${test.contractType}:`, defaults);
      }
    } catch (error) {
      console.error('Error testing payout calculation:', error);
    }
  }

  /**
   * Generate CSV template
   */
  generateTemplate(): string {
    const headers = [
      'case_number (optional)',
      'client_case_id (required)',
      'contract_type (required)',
      'candidate_name (required)',
      'phone_primary (required)',
      'phone_secondary (optional)',
      'address (required)',
      'city (required)',
      'state (required)',
      'pincode (required)',
      'vendor_tat_start_date (required)',
      'status (optional)',
      'priority (optional)',
      'description (optional)'
    ];

    const sampleRow = [
      'BG-20250101-ABC123',
      'CLIENT-001',
      'residential_address_check',
      'John Doe',
      '9876543210',
      '9876543211',
      '123 Main Street',
      'Bangalore',
      'Karnataka',
      '560001',
      '2025-01-15',
      'created',
      'medium',
      'Background verification for John Doe'
    ];

    return this.arrayToCSV([headers, sampleRow]);
  }
}

// Export singleton instance
export const csvService = new CSVService();
