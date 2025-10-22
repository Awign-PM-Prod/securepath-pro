# Bulk Case Creation Guide

## Overview
The bulk case creation feature allows you to create multiple cases at once by uploading a CSV file. This is much more efficient than creating cases one by one.

## How to Use

### Step 1: Download Template
1. Go to the Cases page (`/ops/cases`)
2. Click the "Bulk Upload" button
3. Click "Download Template" to get the CSV template
4. The template will be downloaded as `case_creation_template.csv`

### Step 2: Fill the Template
Open the downloaded CSV file and fill in your case data. The template includes sample data to guide you.

### Step 3: Upload and Create
1. Click "I have the template ready"
2. Choose your filled CSV file
3. Click "Parse CSV" to validate the data
4. Review any errors or warnings
5. Click "Create X Cases" to create all cases

## CSV Format

### Required Fields
- `client_name`: Name of the client (must exist in system)
- `contract_type`: Type of verification
- `candidate_name`: Full name of the candidate
- `phone_primary`: Primary phone number (10 digits)
- `address_line`: Complete address to be verified
- `city`: City name
- `state`: State name
- `pincode`: 6-digit pincode
- `priority`: Priority level
- `tat_hours`: Turnaround time in hours
- `client_case_id`: Client's internal case ID

### Optional Fields
- `phone_secondary`: Secondary phone number
- `country`: Country (default: India)
- `instructions`: Special instructions

### Auto-Calculated Fields
- `base_rate_inr`: Automatically calculated from client contract
- `travel_allowance_inr`: Automatically calculated from client contract
- `bonus_inr`: Automatically calculated from client contract
- `penalty_inr`: Automatically calculated from client contract

### Valid Values

#### Contract Types
- `residential_address_check`
- `business_address_check`
- `employment_verification`
- `education_verification`
- `reference_check`

#### Priority Levels
- `low`
- `medium`
- `high`

#### Countries
- `India` (default)
- `USA`
- `UK`
- `Canada`
- `Australia`

#### States (India)
- `Karnataka`
- `Maharashtra`
- `Delhi`
- `Tamil Nadu`
- `Gujarat`
- `Rajasthan`
- `Uttar Pradesh`
- `West Bengal`
- `Andhra Pradesh`
- `Kerala`

## Validation Rules

### Phone Numbers
- Must be exactly 10 digits
- Must start with 6, 7, 8, or 9

### Pincodes
- Must be exactly 6 digits

### Numeric Fields
- `tat_hours`: Must be a positive number

### Client Names
- Must match exactly with existing clients in the system
- Case-insensitive matching

## Error Handling

### Common Errors
1. **Client not found**: The client name doesn't exist in the system
2. **Invalid contract type**: The contract type is not in the valid list
3. **Invalid phone number**: Phone number doesn't meet the format requirements
4. **Invalid pincode**: Pincode is not 6 digits
5. **Invalid priority**: Priority is not low/medium/high
6. **Invalid numeric field**: A numeric field contains non-numeric data

### Error Resolution
- Fix the errors in your CSV file
- Re-upload the corrected file
- The system will show specific row and column information for each error

## Best Practices

### Data Preparation
1. **Use the template**: Always start with the downloaded template
2. **Check client names**: Ensure client names match exactly with the system
3. **Validate phone numbers**: Use the correct 10-digit format
4. **Use valid pincodes**: Ensure pincodes are 6 digits
5. **Test with small batches**: Start with a few cases to test the process

### File Management
1. **Keep backups**: Save your CSV files for future reference
2. **Use descriptive names**: Name your files with dates and purpose
3. **Review before upload**: Double-check your data before uploading

### Performance
1. **Batch size**: The system processes cases in batches of 10
2. **Large files**: For very large files, consider splitting them
3. **Network stability**: Ensure stable internet connection during upload

## Troubleshooting

### Upload Issues
- **File not uploading**: Check file format (must be .csv)
- **Parsing errors**: Review the error messages and fix the data
- **Creation failures**: Check if all required fields are filled

### Data Issues
- **Client not found**: Verify client name spelling and case
- **Invalid data**: Check the validation rules for each field
- **Missing data**: Ensure all required fields are filled

### System Issues
- **Timeout errors**: Try uploading smaller batches
- **Permission errors**: Contact administrator for access issues
- **Database errors**: Contact technical support

## Sample Data

The template includes sample data that you can use as a reference:

```csv
client_name,contract_type,candidate_name,phone_primary,phone_secondary,address_line,city,state,pincode,country,priority,tat_hours,instructions,client_case_id
Test Client,residential_address_check,John Doe,9876543210,9876543211,123 Main Street HSR Layout,Bangalore,Karnataka,560102,India,medium,24,Please verify the address thoroughly,CLIENT-001
Test Client,business_address_check,Jane Smith,9876543212,,456 Business Park Sector 5,Mumbai,Maharashtra,400001,India,high,12,Urgent verification required,CLIENT-002
Another Client,employment_verification,Bob Johnson,9876543213,9876543214,789 Corporate Tower MG Road,Delhi,Delhi,110001,India,low,48,Standard employment verification,CLIENT-003
```

## Support

If you encounter any issues:
1. Check this guide first
2. Review the error messages carefully
3. Contact your system administrator
4. Provide specific error details when seeking help

---

*Last updated: January 2025*
