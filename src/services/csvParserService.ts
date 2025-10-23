// =====================================================
// CSV Parser Service for Bulk Case Creation
// =====================================================

import { supabase } from '@/integrations/supabase/client';
import { CSVTemplateData } from './csvTemplateService';

export interface ParsedCaseData {
  client_id: string;
  contract_type: string;
  candidate_name: string;
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

      // Parse each row
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

        // Validate and convert row
        const parsedRow = await this.parseRow(rowData, clients, contractTypes, i + 2);
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
   * Parse and validate a single row
   */
  private static async parseRow(
    rowData: any, 
    clients: any[], 
    contractTypes: any[], 
    rowNumber: number
  ): Promise<{ success: boolean; data?: ParsedCaseData; errors: string[] }> {
    const errors: string[] = [];

    // Find client by name
    const client = clients.find(c => c.name.toLowerCase() === rowData.client_name?.toLowerCase());
    if (!client) {
      errors.push(`Client '${rowData.client_name}' not found`);
    }

    // Validate contract type
    const contractType = contractTypes.find(ct => ct.type_key === rowData.contract_type);
    if (!contractType) {
      errors.push(`Invalid contract type '${rowData.contract_type}'`);
    }

    // Validate priority
    const validPriorities = ['low', 'medium', 'high'];
    if (!validPriorities.includes(rowData.priority?.toLowerCase())) {
      errors.push(`Invalid priority '${rowData.priority}'. Must be one of: ${validPriorities.join(', ')}`);
    }

    // Validate phone number
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(rowData.phone_primary)) {
      errors.push(`Invalid phone number '${rowData.phone_primary}'. Must be 10 digits starting with 6-9`);
    }

    // Validate pincode
    const pincodeRegex = /^\d{6}$/;
    if (!pincodeRegex.test(rowData.pincode)) {
      errors.push(`Invalid pincode '${rowData.pincode}'. Must be 6 digits`);
    }

    // Validate numeric fields
    const numericFields = ['tat_hours'];
    for (const field of numericFields) {
      if (rowData[field] && isNaN(Number(rowData[field]))) {
        errors.push(`Invalid ${field} '${rowData[field]}'. Must be a number`);
      }
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    // Create parsed data
    const parsedData: ParsedCaseData = {
      client_id: client!.id,
      contract_type: rowData.contract_type,
      candidate_name: rowData.candidate_name,
      phone_primary: rowData.phone_primary,
      phone_secondary: rowData.phone_secondary || undefined,
      address_line: rowData.address_line,
      city: rowData.city,
      state: rowData.state,
      pincode: rowData.pincode,
      country: rowData.country || 'India',
      priority: rowData.priority.toLowerCase() as 'low' | 'medium' | 'high',
      tat_hours: Number(rowData.tat_hours),
      instructions: rowData.instructions || undefined,
      client_case_id: rowData.client_case_id,
      location_url: rowData.location_url || undefined
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
