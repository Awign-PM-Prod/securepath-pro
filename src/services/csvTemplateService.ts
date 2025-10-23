// =====================================================
// CSV Template Service for Bulk Case Creation
// =====================================================

export interface CSVTemplateData {
  client_name: string;
  contract_type: string;
  candidate_name: string;
  phone_primary: string;
  phone_secondary?: string;
  address_line: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  priority: string;
  tat_hours: number;
  instructions?: string;
  client_case_id: string;
  location_url?: string;
}

export class CSVTemplateService {
  /**
   * Generate CSV template with sample data
   */
  static generateTemplate(): string {
    const headers = [
      'client_name',
      'contract_type', 
      'candidate_name',
      'phone_primary',
      'phone_secondary',
      'address_line',
      'city',
      'state',
      'pincode',
      'country',
      'priority',
      'tat_hours',
      'instructions',
      'client_case_id',
      'location_url'
    ];

    const sampleData: CSVTemplateData[] = [
      {
        client_name: 'Test Client',
        contract_type: 'residential_address_check',
        candidate_name: 'John Doe',
        phone_primary: '9876543210',
        phone_secondary: '9876543211',
        address_line: '123 Main Street, HSR Layout',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560102',
        country: 'India',
        priority: 'medium',
        tat_hours: 24,
        instructions: 'Please verify the address thoroughly',
        client_case_id: 'CLIENT-001',
        location_url: 'https://maps.google.com/?q=123+Main+Street+HSR+Layout+Bangalore'
      },
      {
        client_name: 'Test Client',
        contract_type: 'business_address_check',
        candidate_name: 'Jane Smith',
        phone_primary: '9876543212',
        phone_secondary: '',
        address_line: '456 Business Park, Sector 5',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        country: 'India',
        priority: 'high',
        tat_hours: 12,
        instructions: 'Urgent verification required',
        client_case_id: 'CLIENT-002',
        location_url: 'https://maps.google.com/?q=456+Business+Park+Sector+5+Mumbai'
      },
      {
        client_name: 'Another Client',
        contract_type: 'employment_verification',
        candidate_name: 'Bob Johnson',
        phone_primary: '9876543213',
        phone_secondary: '9876543214',
        address_line: '789 Corporate Tower, MG Road',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110001',
        country: 'India',
        priority: 'low',
        tat_hours: 48,
        instructions: 'Standard employment verification',
        client_case_id: 'CLIENT-003',
        location_url: ''
      }
    ];

    // Convert to CSV format
    const csvContent = [
      headers.join(','),
      ...sampleData.map(row => 
        headers.map(header => {
          const value = row[header as keyof CSVTemplateData];
          // Escape commas and quotes in values
          if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value || '';
        }).join(',')
      )
    ].join('\n');

    return csvContent;
  }

  /**
   * Download CSV template
   */
  static downloadTemplate(): void {
    const csvContent = this.generateTemplate();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'case_creation_template.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  /**
   * Get field descriptions for help
   */
  static getFieldDescriptions(): Record<string, string> {
    return {
      client_name: 'Name of the client (must exist in system)',
      contract_type: 'Type of verification (residential_address_check, business_address_check, employment_verification)',
      candidate_name: 'Full name of the candidate to be verified',
      phone_primary: 'Primary phone number (10 digits)',
      phone_secondary: 'Secondary phone number (optional)',
      address_line: 'Complete address to be verified',
      city: 'City name',
      state: 'State name',
      pincode: '6-digit pincode',
      country: 'Country (default: India)',
      priority: 'Priority level (low, medium, high)',
      tat_hours: 'Turnaround time in hours (number)',
      instructions: 'Special instructions for the case (optional)',
      client_case_id: 'Client\'s internal case ID (unique identifier)',
      location_url: 'Google Maps or other location URL (optional)',
      note: 'Financial fields (base_rate_inr, travel_allowance_inr, bonus_inr, penalty_inr) are automatically calculated from client contract'
    };
  }

  /**
   * Get valid values for dropdown fields
   */
  static getValidValues(): Record<string, string[]> {
    return {
      contract_type: [
        'residential_address_check',
        'business_address_check', 
        'employment_verification',
        'education_verification',
        'reference_check'
      ],
      priority: ['low', 'medium', 'high'],
      country: ['India', 'USA', 'UK', 'Canada', 'Australia'],
      state: [
        'Karnataka', 'Maharashtra', 'Delhi', 'Tamil Nadu', 'Gujarat',
        'Rajasthan', 'Uttar Pradesh', 'West Bengal', 'Andhra Pradesh', 'Kerala'
      ]
    };
  }
}
