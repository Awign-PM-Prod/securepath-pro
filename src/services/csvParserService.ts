// =====================================================
// CSV Parser Service for Bulk Case Creation
// =====================================================

import { supabase } from '@/integrations/supabase/client';
import { CSVTemplateData } from './csvTemplateService';

export interface ParsedCaseData {
  client_id: string;
  contract_type: string;
  candidate_name: string;
  company_name?: string;
  phone_primary: string;
  phone_secondary?: string;
  address_line: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  priority: 'low' | 'medium' | 'high';
  tat_hours: number;
  instructions?: string;
  client_case_id: string;
  location_url?: string;
}

export interface ParsingResult {
  success: boolean;
  data: ParsedCaseData[];
  errors: string[];
  warnings: string[];
}

export class CSVParserService {
  /**
   * Parse CSV content and convert names to IDs
   */
  static async parseCSV(csvContent: string): Promise<ParsingResult> {
    const result: ParsingResult = {
      success: true,
      data: [],
      errors: [],
      warnings: []
    };

    try {
      // Parse CSV content
      const lines = csvContent.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        result.errors.push('CSV must have at least a header row and one data row');
        result.success = false;
        return result;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const dataRows = lines.slice(1);

      // Validate headers
      const requiredHeaders = [
        'client_name', 'contract_type', 'candidate_name', 'phone_primary',
        'address_line', 'city', 'state', 'pincode', 'country', 'priority',
        'tat_hours', 'client_case_id'
      ];

      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        result.errors.push(`Missing required headers: ${missingHeaders.join(', ')}`);
        result.success = false;
        return result;
      }

      // Get lookup data
      const [clients, contractTypes] = await Promise.all([
        this.getClients(),
        this.getContractTypes()
      ]);

      // Create lookup maps for faster access (O(1) instead of O(n))
      const clientMap = new Map<string, any>();
      clients.forEach(client => {
        clientMap.set(client.name.toLowerCase(), client);
      });

      const contractTypeMap = new Map<string, any>();
      contractTypes.forEach(ct => {
        contractTypeMap.set(ct.type_key, ct);
      });

      // Parse each row (synchronously - no async operations needed)
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const values = this.parseCSVRow(row);
        
        if (values.length !== headers.length) {
          result.errors.push(`Row ${i + 2}: Column count mismatch`);
          continue;
        }

        const rowData: any = {};
        headers.forEach((header, index) => {
          rowData[header] = values[index];
        });

        // Validate and convert row (synchronous - no await needed)
        const parsedRow = this.parseRow(rowData, clientMap, contractTypeMap, i + 2);
        if (parsedRow.success) {
          result.data.push(parsedRow.data!);
        } else {
          result.errors.push(...parsedRow.errors.map(e => `Row ${i + 2}: ${e}`));
        }
      }

      if (result.errors.length > 0) {
        result.success = false;
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Failed to parse CSV: ${error}`);
    }

    return result;
  }

  /**
   * Parse a single CSV row
   */
  private static parseCSVRow(row: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      
      if (char === '"') {
        if (inQuotes && row[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  /**
   * Parse and validate a single row (synchronous - no async operations)
   */
  private static parseRow(
    rowData: any, 
    clientMap: Map<string, any>, 
    contractTypeMap: Map<string, any>, 
    rowNumber: number
  ): { success: boolean; data?: ParsedCaseData; errors: string[] } {
    const errors: string[] = [];

    // Helper function to check if a field is blank (after trimming)
    const isBlank = (value: any): boolean => {
      if (value === null || value === undefined) return true;
      const str = String(value).trim();
      return str === '';
    };

    // Validate all mandatory fields (matching UI form validation)
    // These fields must not be blank/empty
    if (isBlank(rowData.client_case_id)) {
      errors.push('Client Case ID is required');
    }

    if (isBlank(rowData.contract_type)) {
      errors.push('Contract Type is required');
    }

    if (isBlank(rowData.candidate_name)) {
      errors.push('Candidate Name is required');
    }

    if (isBlank(rowData.phone_primary)) {
      errors.push('Primary Phone is required');
    }

    if (isBlank(rowData.client_name)) {
      errors.push('Client Name is required');
    }

    if (isBlank(rowData.address_line)) {
      errors.push('Address is required');
    }

    if (isBlank(rowData.city)) {
      errors.push('City is required');
    }

    if (isBlank(rowData.state)) {
      errors.push('State is required');
    }

    if (isBlank(rowData.pincode)) {
      errors.push('Pincode is required');
    }

    if (isBlank(rowData.tat_hours)) {
      errors.push('TAT Hours is required');
    }

    if (isBlank(rowData.priority)) {
      errors.push('Priority is required');
    }

    // Find client by name using map (O(1) lookup) - only if client_name is not blank
    const clientNameKey = rowData.client_name?.toLowerCase()?.trim();
    const client = clientNameKey ? clientMap.get(clientNameKey) : undefined;
    if (!client && !isBlank(rowData.client_name)) {
      errors.push(`Client '${rowData.client_name}' not found`);
    }

    // Validate contract type using map (O(1) lookup) - only if contract_type is not blank
    const contractType = contractTypeMap.get(rowData.contract_type);
    if (!contractType && !isBlank(rowData.contract_type)) {
      errors.push(`Invalid contract type '${rowData.contract_type}'`);
    }

    // Validate priority - only if priority is not blank
    if (!isBlank(rowData.priority)) {
      const validPriorities = ['low', 'medium', 'high'];
      if (!validPriorities.includes(rowData.priority?.toLowerCase())) {
        errors.push(`Invalid priority '${rowData.priority}'. Must be one of: ${validPriorities.join(', ')}`);
      }
    }

    // Validate phone number - only if phone_primary is not blank
    if (!isBlank(rowData.phone_primary)) {
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phoneRegex.test(String(rowData.phone_primary).trim())) {
        errors.push(`Invalid phone number '${rowData.phone_primary}'. Must be 10 digits starting with 6-9`);
      }
    }

    // If business verification, company_name must be provided
    const isBusiness = typeof rowData.contract_type === 'string' && rowData.contract_type.toLowerCase().includes('business');
    if (isBusiness && isBlank(rowData.company_name)) {
      errors.push('Company Name is required for business verification');
    }

    // Validate pincode - only if pincode is not blank
    if (!isBlank(rowData.pincode)) {
      const pincodeRegex = /^\d{6}$/;
      if (!pincodeRegex.test(String(rowData.pincode).trim())) {
        errors.push(`Invalid pincode '${rowData.pincode}'. Must be 6 digits`);
      }
    }

    // Validate numeric fields - only if field is not blank
    if (!isBlank(rowData.tat_hours)) {
      if (isNaN(Number(rowData.tat_hours))) {
        errors.push(`Invalid tat_hours '${rowData.tat_hours}'. Must be a number`);
      }
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    // Helper function to trim string values
    const trimValue = (value: any): string | undefined => {
      if (value === null || value === undefined) return undefined;
      const trimmed = String(value).trim();
      return trimmed === '' ? undefined : trimmed;
    };

    // Create parsed data with trimmed values
    const parsedData: ParsedCaseData = {
      client_id: client!.id,
      contract_type: String(rowData.contract_type).trim(),
      candidate_name: String(rowData.candidate_name).trim(),
      company_name: trimValue(rowData.company_name),
      phone_primary: String(rowData.phone_primary).trim(),
      phone_secondary: trimValue(rowData.phone_secondary),
      address_line: String(rowData.address_line).trim(),
      city: String(rowData.city).trim(),
      state: String(rowData.state).trim(),
      pincode: String(rowData.pincode).trim(),
      country: trimValue(rowData.country) || 'India',
      priority: String(rowData.priority).toLowerCase().trim() as 'low' | 'medium' | 'high',
      tat_hours: Number(rowData.tat_hours),
      instructions: trimValue(rowData.instructions),
      client_case_id: String(rowData.client_case_id).trim(),
      location_url: trimValue(rowData.location_url)
    };

    return { success: true, data: parsedData, errors: [] };
  }

  /**
   * Get all clients for lookup
   */
  private static async getClients(): Promise<any[]> {
    const { data, error } = await supabase
      .from('clients')
      .select('id, name')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching clients:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get all contract types for lookup
   */
  private static async getContractTypes(): Promise<any[]> {
    const { data, error } = await supabase
      .from('contract_type_config')
      .select('id, type_key, display_name')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching contract types:', error);
      return [];
    }

    return data || [];
  }
}
