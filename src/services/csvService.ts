export interface CSVField {
  question: string;
  answer: string;
}

export interface CSVImportResult {
  successful: number;
  failed: number;
  errors: string[];
}

export interface CSVExportOptions {
  status?: string[];
  priority?: string[];
  date_from?: string;
  date_to?: string;
}

export interface FormSubmissionData {
  id: string;
  template_name: string;
  template_version: number;
  status: 'draft' | 'final';
  submitted_at?: string;
  form_fields: Array<{
    field_key: string;
    field_title: string;
    field_type: string;
    field_order?: number;
  }>;
  submission_data: Record<string, any>;
  form_submission_files?: Array<{
    id: string;
    field_id: string;
    file_url: string;
    file_name: string;
    file_size: number;
    mime_type: string;
    uploaded_at: string;
    form_field?: {
      field_title: string;
      field_type: string;
      field_key: string;
    };
  }>;
}

export class CSVService {
  /**
   * Convert form submission data to CSV format
   * Questions in row 1, Answers in row 2
   * @param submissions - Form submission data
   * @param contractType - Contract type key (for negative case merging)
   * @param isPositive - Whether the case is positive (for negative case merging)
   */
  static async convertFormSubmissionsToCSV(
    submissions: FormSubmissionData[], 
    contractType?: string, 
    isPositive?: boolean
  ): Promise<string> {
    if (submissions.length === 0) {
      return '';
    }

    // For negative cases, merge original contract template with negative template
    // Show original contract fields first (with "Not provided"), then negative template fields (with actual responses)
    let processedSubmissions = submissions;
    if (isPositive === false && contractType && submissions.length > 0) {
      const { formService } = await import('./formService');
      const negativeSubmission = submissions[0]; // Usually only one submission for negative cases
      
      const mergeResult = await formService.mergeTemplatesForNegativeCase(contractType, negativeSubmission);
      
      if (mergeResult.success && mergeResult.mergedFields) {
        // Create merged submission data
        const mergedSubmissionData: Record<string, any> = {};
        
        // Process fields: original fields get "Not provided", negative fields get actual responses
        mergeResult.mergedFields.forEach(field => {
          if (field._isOriginalField) {
            // Original contract fields - show "Not provided"
            mergedSubmissionData[field._uniqueKey] = 'Not provided';
          } else if (field._isNegativeField && field._isNegativeOnly) {
            // Negative-only fields - use actual response
            mergedSubmissionData[field._uniqueKey] = negativeSubmission.submission_data[field._negativeFieldKey || field.field_key];
          }
        });
        
        // Create modified submission with merged fields
        processedSubmissions = [{
          ...negativeSubmission,
          form_fields: mergeResult.mergedFields.map(field => ({
            field_key: field._uniqueKey,
            field_title: field.field_title,
            field_type: field.field_type,
            field_order: field.field_order,
            // Keep original field_key for reference
            _originalFieldKey: field._originalFieldKey || field.field_key,
            _negativeFieldKey: field._negativeFieldKey || field.field_key,
            _isNegativeOnly: field._isNegativeOnly || false
          })),
          submission_data: mergedSubmissionData
        }];
      }
    }

    // Get all unique field keys from all submissions
    const allFieldKeys = new Set<string>();
    processedSubmissions.forEach(submission => {
      submission.form_fields?.forEach(field => {
        allFieldKeys.add(field.field_key);
      });
    });

    // Create field mapping with titles
    const fieldMapping = new Map<string, string>();
    processedSubmissions.forEach(submission => {
      submission.form_fields?.forEach(field => {
        fieldMapping.set(field.field_key, field.field_title);
      });
    });

    // Convert field keys to array and sort by field order
    const sortedFieldKeys = Array.from(allFieldKeys).sort((a, b) => {
      const fieldA = processedSubmissions.find(s => s.form_fields?.some(f => f.field_key === a))?.form_fields?.find(f => f.field_key === a);
      const fieldB = processedSubmissions.find(s => s.form_fields?.some(f => f.field_key === b))?.form_fields?.find(f => f.field_key === b);
      const orderA = fieldA?.field_order || 0;
      const orderB = fieldB?.field_order || 0;
      return orderA - orderB;
    });

    // Create CSV headers (questions)
    const headers = sortedFieldKeys.map(fieldKey => {
      const title = fieldMapping.get(fieldKey) || fieldKey;
      return this.escapeCSVValue(title);
    });

    // Create CSV rows for each submission
    const rows: string[] = [];
    
    processedSubmissions.forEach((submission, submissionIndex) => {
      const rowValues = sortedFieldKeys.map(fieldKey => {
        const value = submission.submission_data[fieldKey];
        const fieldType = submission.form_fields?.find(f => f.field_key === fieldKey)?.field_type || 'text';
        
        return this.escapeCSVValue(this.formatValueForCSV(value, fieldType, submission, fieldKey));
      });
      
      rows.push(rowValues.join(','));
    });

    // Combine headers and rows
    const csvContent = [headers.join(','), ...rows].join('\n');
    
    return csvContent;
  }

  /**
   * Format a value for CSV output based on field type
   */
  private static formatValueForCSV(value: any, fieldType: string, submission: FormSubmissionData, fieldKey?: string): string {
    if (value === null || value === undefined) {
      return 'Not provided';
    }

    switch (fieldType) {
      case 'multiple_choice':
        if (Array.isArray(value)) {
          return value.map(item => {
            if (typeof item === 'object' && item !== null && 'label' in item) {
              return item.label;
            }
            return String(item);
          }).join('; ');
        } else if (typeof value === 'object' && value !== null && 'label' in value) {
          return value.label;
        }
        return String(value);

      case 'file_upload':
        // Find files for this specific field
        const fieldFiles = submission.form_submission_files?.filter(file => 
          file.form_field?.field_key === fieldKey
        ) || [];
        
        if (fieldFiles.length === 0) {
          return 'No files uploaded';
        }
        
        return fieldFiles.map(file => file.file_url).join(', ');

      case 'date':
        try {
          return new Date(value).toLocaleDateString();
        } catch (e) {
          return 'Invalid date';
        }

      case 'boolean':
        return value ? 'Yes' : 'No';

      default:
        if (typeof value === 'object' && value !== null) {
          if ('label' in value) {
            return value.label;
          }
          if ('value' in value) {
            return value.value;
          }
          try {
            return JSON.stringify(value);
          } catch (e) {
            return '[Object]';
          }
        }
        return String(value);
    }
  }

  /**
   * Escape CSV value to handle commas, quotes, and newlines
   */
  private static escapeCSVValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
      // Escape quotes by doubling them and wrap in quotes
      const escapedValue = value.replace(/"/g, '""');
      return `"${escapedValue}"`;
    }
    return value;
  }

  /**
   * Download CSV content as a file
   */
  static downloadCSV(csvContent: string, filename: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Import cases from CSV content
   */
  async importCases(csvContent: string, updateMode: boolean = false): Promise<CSVImportResult> {
    // This is a placeholder implementation
    // In a real app, this would parse the CSV and create/update cases in the database
    console.log('Importing cases from CSV:', { csvContent: csvContent.substring(0, 100), updateMode });
    
    return {
      successful: 0,
      failed: 0,
      errors: ['CSV import not implemented yet']
    };
  }

  /**
   * Export cases to CSV content
   */
  async exportCases(options: CSVExportOptions = {}): Promise<string> {
    // This is a placeholder implementation
    // In a real app, this would fetch cases from the database and convert to CSV
    console.log('Exporting cases to CSV:', options);
    
    return 'Case ID,Title,Status,Priority\n1,Sample Case,Active,High';
  }

  /**
   * Generate CSV template
   */
  generateTemplate(): string {
    return 'Case ID,Title,Description,Priority,Status,Client ID,Location ID,Due Date,Base Rate,Travel Allowance,Bonus,TAT Hours,Instructions\n';
  }

  /**
   * Test payout calculation
   */
  async testPayoutCalculation(): Promise<void> {
    console.log('Testing payout calculation...');
    // This is a placeholder implementation
    console.log('Payout calculation test completed');
  }
}

// Export a singleton instance
export const csvService = new CSVService();