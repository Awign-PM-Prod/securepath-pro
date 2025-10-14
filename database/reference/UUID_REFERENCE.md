# UUID Reference - Development Database

## Test User IDs

### Super Admin
- **User ID**: `4b8d1bd5-7090-4e32-8192-675ca86e2e4a`
- **Profile ID**: `4b8d1bd5-7090-4e32-8192-675ca86e2e4a`
- **Email**: `admin@awign.com`
- **Role**: `super_admin`

### Ops Team
- **User ID**: `9c744d72-967e-42e3-9170-837d8540acef`
- **Profile ID**: `9c744d72-967e-42e3-9170-837d8540acef`
- **Email**: `ops@awign.com`
- **Role**: `ops_team`

### QC Team
- **User ID**: `qc-team-user-id`
- **Profile ID**: `qc-team-profile-id`
- **Email**: `qc@awign.com`
- **Role**: `qc_team`

## Test Gig Workers

### Direct Gig Worker 1
- **User ID**: `gig-worker-1-user-id`
- **Profile ID**: `gig-worker-1-profile-id`
- **Gig Partner ID**: `9412c360-8d5a-41f7-b749-48679904467f`
- **Email**: `gigworker1@awign.com`
- **Name**: `Gig Worker 1`
- **Pincode**: `560102`
- **Coverage**: `["560102", "560068"]`
- **Vendor**: None (Direct)

### Direct Gig Worker 2
- **User ID**: `gig-worker-2-user-id`
- **Profile ID**: `gig-worker-2-profile-id`
- **Gig Partner ID**: `gig-worker-2-partner-id`
- **Email**: `gigworker2@awign.com`
- **Name**: `Gig Worker 2`
- **Pincode**: `560001`
- **Coverage**: `["560001", "tier_1"]`
- **Vendor**: None (Direct)

### Vendor-Managed Gig Worker
- **User ID**: `vendor-gig-worker-user-id`
- **Profile ID**: `vendor-gig-worker-profile-id`
- **Gig Partner ID**: `vendor-gig-worker-partner-id`
- **Email**: `vendorworker@awign.com`
- **Name**: `Vendor Gig Worker`
- **Pincode**: `560102`
- **Coverage**: `["560102", "560068"]`
- **Vendor**: `14b53a3d-87fb-414c-af37-fd4aae0c9764`

## Test Vendors

### Vendor 6
- **Vendor ID**: `14b53a3d-87fb-414c-af37-fd4aae0c9764`
- **Profile ID**: `50d606ec-6426-4bd2-a920-49a3118e17bc`
- **User ID**: `3f9f50e2-eb8a-4451-996e-ddecadd0c253`
- **Email**: `vendor6@awign.com`
- **Name**: `Vendor 6`
- **Pincode**: `560102`
- **Coverage**: `["560102", "560068"]`

### Vendor 7
- **Vendor ID**: `vendor-7-id`
- **Profile ID**: `vendor-7-profile-id`
- **User ID**: `vendor-7-user-id`
- **Email**: `vendor7@awign.com`
- **Name**: `Vendor 7`
- **Pincode**: `560001`
- **Coverage**: `["560001", "tier_1"]`

## Test Clients

### Test Client
- **Client ID**: `5429e4a7-8ea6-4cee-8b06-1cce3bf9cc95`
- **Name**: `Test Client`
- **Email**: `test@example.com`
- **Contact Person**: `Test Contact`

### Test Company
- **Client ID**: `5026b6f3-63e6-4c2f-9be4-0fa9d1d20351`
- **Name**: `Test Company`
- **Email**: `deepanshu.shahara@awign.com`
- **Contact Person**: `Deepanshu Shahara`

## Test Cases

### Case 1 - Business Address Check
- **Case ID**: `95620c3a-f9e6-4d04-b66e-f6e1a46acc10`
- **Case Number**: `BG-20251009-KN765Q`
- **Title**: `Candidate 1 - BUSINESS ADDRESS_CHECK`
- **Status**: `auto_allocated`
- **Assignee**: `14b53a3d-87fb-414c-af37-fd4aae0c9764` (Vendor)
- **Assignee Type**: `vendor`
- **Pincode**: `560102`
- **Client**: `5429e4a7-8ea6-4cee-8b06-1cce3bf9cc95`

### Case 2 - Residential Address Check
- **Case ID**: `24767e76-6769-4745-ac9a-9669162cf2c1`
- **Case Number**: `BG-20251009-6AW4CN`
- **Title**: `John Doe - residential_address_check`
- **Status**: `auto_allocated`
- **Assignee**: `14b53a3d-87fb-414c-af37-fd4aae0c9764` (Vendor)
- **Assignee Type**: `vendor`
- **Pincode**: `560001`
- **Client**: `5026b6f3-63e6-4c2f-9be4-0fa9d1d20351`

### Case 3 - Unassigned Case
- **Case ID**: `11282596-a21a-47c5-a38b-d7f5e89c2d5e`
- **Case Number**: `BG-20251009-EQOATP`
- **Title**: `John Doe - residential_address_check`
- **Status**: `created`
- **Assignee**: `null`
- **Assignee Type**: `null`
- **Pincode**: `560001`
- **Client**: `5026b6f3-63e6-4c2f-9be4-0fa9d1d20351`

## Test Locations

### Location 1 - HSR Layout
- **Location ID**: `85f3d034-ff14-4081-a11f-8a3551b3f9f6`
- **Address**: `hsr layout`
- **City**: `Bangalore`
- **State**: `Karnataka`
- **Pincode**: `560102`
- **Tier**: `tier_1`

### Location 2 - Main Street
- **Location ID**: `a9a76db2-b058-4687-a214-5b411a522e32`
- **Address**: `123 Main Street`
- **City**: `Bangalore`
- **State**: `Karnataka`
- **Pincode**: `560001`
- **Tier**: `tier_1`

## Test Contract Types

### Business Address Check
- **Type Key**: `business_address_check`
- **Display Name**: `Business Address Check`
- **Description**: `Verification of business address`

### Residential Address Check
- **Type Key**: `residential_address_check`
- **Display Name**: `Residential Address Check`
- **Description**: `Verification of residential address`

## Test Form Templates

### Business Address Form
- **Template ID**: `business-address-template-id`
- **Contract Type**: `business_address_check`
- **Template Name**: `Business Address Verification Form`
- **Version**: `1`

### Residential Address Form
- **Template ID**: `residential-address-template-id`
- **Contract Type**: `residential_address_check`
- **Template Name**: `Residential Address Verification Form`
- **Version**: `1`

## Test Rate Cards

### Tier 1 Business Address
- **Rate Card ID**: `tier1-business-rate-id`
- **Pincode Tier**: `tier_1`
- **Completion Slab**: `24h`
- **Base Rate**: `60.00 INR`

### Tier 1 Residential Address
- **Rate Card ID**: `tier1-residential-rate-id`
- **Pincode Tier**: `tier_1`
- **Completion Slab**: `24h`
- **Base Rate**: `50.00 INR`

## Test Pincode Tiers

### Tier 1 Pincodes
- `110001` - New Delhi
- `110002` - New Delhi
- `560001` - Bangalore
- `560102` - Bangalore
- `400001` - Mumbai
- `600001` - Chennai

### Tier 2 Pincodes
- `302001` - Jaipur
- `411001` - Pune
- `700001` - Kolkata
- `380001` - Ahmedabad

### Tier 3 Pincodes
- `123456` - Rural Area 1
- `234567` - Rural Area 2
- `345678` - Rural Area 3

## Test Storage Buckets

### Case Attachments
- **Bucket Name**: `case-attachments`
- **Public**: `false`
- **File Size Limit**: `10MB`
- **Allowed MIME Types**: `image/*, application/pdf`

### Submission Photos
- **Bucket Name**: `submission-photos`
- **Public**: `false`
- **File Size Limit**: `5MB`
- **Allowed MIME Types**: `image/jpeg, image/png`

### Form Files
- **Bucket Name**: `form-files`
- **Public**: `false`
- **File Size Limit**: `10MB`
- **Allowed MIME Types**: `image/*, application/pdf, application/msword`

## Test Notifications

### Allocation Notification
- **Template ID**: `allocation-notification-template`
- **Type**: `allocation`
- **Channels**: `['email', 'sms', 'push']`
- **Priority**: `medium`

### QC Result Notification
- **Template ID**: `qc-result-notification-template`
- **Type**: `qc_result`
- **Channels**: `['email', 'push']`
- **Priority**: `high`

## Test Payment Cycles

### Current Cycle
- **Cycle ID**: `current-payment-cycle-id`
- **Tag**: `2025-Q4-Cycle-1`
- **Start Date**: `2025-10-01`
- **End Date**: `2025-10-15`
- **Status**: `draft`

## Development Notes

### Creating Test Data
1. Use the provided UUIDs for consistency
2. Maintain relationships between entities
3. Update this reference when adding new test data
4. Use descriptive names for easy identification

### UUID Generation
- Use `gen_random_uuid()` for new records
- Maintain consistency across related tables
- Document all test data relationships

### Data Cleanup
- Use test data prefixes for easy identification
- Clean up test data after development
- Maintain referential integrity during cleanup

## Quick Reference Commands

### Get User by Email
```sql
SELECT * FROM profiles WHERE email = 'user@example.com';
```

### Get Gig Worker by Email
```sql
SELECT gp.*, p.email, p.first_name, p.last_name 
FROM gig_partners gp 
JOIN profiles p ON gp.profile_id = p.id 
WHERE p.email = 'gigworker@example.com';
```

### Get Vendor by Email
```sql
SELECT v.*, p.email, p.first_name, p.last_name 
FROM vendors v 
JOIN profiles p ON v.profile_id = p.id 
WHERE p.email = 'vendor@example.com';
```

### Get Cases for User
```sql
SELECT c.*, l.city, l.pincode, cl.name as client_name
FROM cases c
JOIN locations l ON c.location_id = l.id
JOIN clients cl ON c.client_id = cl.id
WHERE c.current_assignee_id IN (
  SELECT id FROM gig_partners WHERE user_id = auth.uid()
);
```
