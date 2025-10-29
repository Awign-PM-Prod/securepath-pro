1. Authentication & User Management Errors
Login Failures
Error: "Invalid credentials" or "Authentication failed"
Reasons:
Incorrect email/password combination
User account is disabled or deleted
Database connection failure
Supabase authentication service down
Password Reset Errors
Error: "Failed to send reset email" or "Invalid email"
Reasons:
Email address doesn't exist in system
SMTP service configuration issues
Invalid email format
Rate limiting exceeded
User Creation Failures
Error: "Failed to create user"
Reasons:
Email already exists (unique constraint violation)
Invalid email format
Missing required fields (name, email, phone)
Database connection failure
RLS policy violation
2. Case Management Errors
Case Creation Failures
Error: "Failed to create the case. Please try again."
Reasons:
Unregistered pincode: Pincode not found in pincode_tiers table
Location creation failure: Invalid address data
Payout calculation failure: Missing client contract or pincode tier
Database constraint violation: Duplicate case ID
Missing required fields: Client ID, contract type, or location data
Authentication failure: User not authenticated
RLS policy violation: Insufficient permissions
Case Update/Deletion Failures
Error: "Failed to update case" / "Failed to delete case"
Reasons:
Case not found in database
Case already in progress (cannot modify)
Foreign key constraint violations
Insufficient permissions
Database transaction failure
3. Form Validation Errors
Required Field Errors
Error: "Field is required"
Reasons:
Field marked as validation_type: 'mandatory' but left empty
File upload field with no files selected
Array field with empty array
Text field with only whitespace
File Upload Validation Errors
Error: "Invalid file type. Allowed: [types]"
Reasons:
File type not in allowed_file_types array
File extension not matching MIME type
Corrupted file header
Error: "File size must be less than [size]MB"
Reasons:
File size exceeds max_file_size_mb limit
Large image files not compressed
Multiple files exceeding total size limit
Error: "Maximum [number] file(s) allowed"
Reasons:
Number of files exceeds max_files limit
User trying to upload more than allowed
Phone Number Validation
Error: "Phone number is required" / "Invalid phone format"
Reasons:
Empty phone number field
Phone number doesn't match regex: /^[6-9]\d{9}$/
Phone number not exactly 10 digits
Phone number doesn't start with 6, 7, 8, or 9
Email Validation
Error: "Email is required" / "Invalid email format"
Reasons:
Empty email field
Email doesn't match regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
Missing @ symbol or domain
Invalid characters in email
Pincode Validation
Error: "Pincode is required" / "Invalid pincode format"
Reasons:
Empty pincode field
Pincode doesn't match regex: /^\d{6}$/
Pincode not exactly 6 digits
Non-numeric characters in pincode
4. Bulk Upload Errors
File Selection Errors
Error: "No File Selected" / "Please select a CSV file"
Reasons:
No file selected in file input
File input is null or undefined
User clicked upload without selecting file
Invalid File Type
Error: "Please upload a CSV file" / "Invalid file type"
Reasons:
File is not a CSV file
File extension is not .csv
File MIME type is not text/csv
File is corrupted or not readable
CSV Parsing Errors
Error: "Failed to parse CSV file. Please check the format."
Reasons:
Invalid CSV format (missing headers, malformed rows)
Encoding issues (non-UTF8 characters)
Empty CSV file
CSV structure doesn't match expected format
Bulk Creation Failures
Error: "Failed to create cases. Please try again."
Reasons:
Database connection failure
Batch processing timeout
Memory limit exceeded
Transaction rollback due to constraint violations
Specific Row Errors
Error: "Row X: Email or phone already exists"
Reasons:
Duplicate email address in CSV
Duplicate phone number in CSV
Unique constraint violation in database
Error: "Row X: Invalid enum value in row data"
Reasons:
Invalid contract type (not in allowed enum values)
Invalid priority level (not low/medium/high)
Invalid status value
Error: "Row X: Missing required field"
Reasons:
Empty required fields in CSV
Null values in mandatory columns
Missing headers in CSV
Error: "Row X: Invalid vendor ID - vendor does not exist in system"
Reasons:
Vendor ID in CSV doesn't exist in database
Foreign key constraint violation
Invalid vendor reference
5. Allocation Errors
No Cases Selected
Error: "Please select cases to manually allocate"
Reasons:
User clicked allocate without selecting any cases
Selected cases array is empty
No cases available for allocation
No Gig Worker/Vendor Selected
Error: "Please select a gig worker/vendor for manual allocation"
Reasons:
User clicked allocate without selecting gig worker/vendor
Selected allocation target is null/undefined
No available gig workers/vendors in the area
Allocation Failures
Error: "An error occurred during allocation"
Reasons:
Database transaction failure
Gig worker/vendor not available
Case already allocated
Insufficient permissions
Allocation engine failure
6. Gig Worker Management Errors
Load Failures
Error: "Failed to load gig workers and vendors"
Reasons:
Database connection failure
RLS policy violation
Missing tables or columns
Query timeout
Creation Failures
Error: "Failed to create gig worker"
Reasons:
Email already exists (unique constraint)
Invalid email format
Missing required fields (first name, last name, email, phone)
Database transaction failure
RLS policy violation
Validation Errors
Error: "First name is required" / "Last name is required" / "Email is required" / "Phone number is required"
Reasons:
Empty required fields in form
Form submission without filling mandatory fields
Client-side validation failure
Bulk Upload Failures
Error: "Bulk Upload Failed" / "Bulk Upload Completed with Errors"
Reasons:
CSV parsing errors
Database constraint violations
Invalid data in CSV rows
Memory or timeout issues
7. Vendor Management Errors
Vendor Creation Failures
Error: "Failed to create vendor"
Reasons:
Email already exists (unique constraint)
Invalid email format
Missing required fields
Database transaction failure
RLS policy violation
Vendor Update/Deletion Failures
Error: "Failed to update vendor" / "Failed to delete vendor"
Reasons:
Vendor not found in database
Vendor has active cases (cannot delete)
Foreign key constraint violations
Insufficient permissions
Database transaction failure
Vendor Association Failures
Error: "Failed to associate vendor"
Reasons:
Invalid vendor ID
Vendor not available in area
Association already exists
Database constraint violation
8. Client & Contract Management Errors
Client Creation Failures
Error: "Failed to create client"
Reasons:
Email already exists (unique constraint)
Invalid email format
Missing required fields (name, contact person, email, phone, address)
Database transaction failure
RLS policy violation
Client Update/Deletion Failures
Error: "Failed to update client" / "Failed to delete client"
Reasons:
Client not found in database
Client has active cases (cannot delete)
Foreign key constraint violations
Insufficient permissions
Database transaction failure
Contract Creation Failures
Error: "Failed to save contract"
Reasons:
Database connection failure
Missing required fields
Invalid client ID
RLS policy violation
Contract Already Exists
Error: "A contract with this client and contract type combination already exists"
Reasons:
Database error code 23505 (unique constraint violation)
Duplicate combination of client_id and contract_type
User trying to create duplicate contract
Invalid Selection
Error: "Please ensure all selected options are valid"
Reasons:
Database error code 23503 (foreign key constraint violation)
Invalid client ID (doesn't exist in database)
Invalid contract type (not in enum values)
Referenced entity doesn't exist
9. Form Template Management Errors
Template Load Failures
Error: "Failed to load form templates"
Reasons:
Database connection failure
RLS policy violation
Missing form_templates table
Query timeout
Template Save Failures
Error: "Failed to save form template"
Reasons:
Invalid form structure
Missing required fields
Database transaction failure
RLS policy violation
Template Deletion Failures
Error: "Failed to delete form template"
Reasons:
Template not found
Template in use by active cases
Foreign key constraint violations
Insufficient permissions
Template Publish/Unpublish Failures
Error: "Failed to publish/unpublish form template"
Reasons:
Template not found
Invalid template structure
Database transaction failure
RLS policy violation
10. QC (Quality Control) Errors
QC Submission Failures
Error: "Failed to submit QC review"
Reasons:
Missing required feedback (reason codes or comments)
User not authenticated
Case not found
Database transaction failure
Feedback Required
Error: "Please select at least one reason code OR provide comments for rejection or rework"
Reasons:
User selected reject/rework but didn't provide feedback
Empty reason codes array and empty comments
Validation rule: reasonCodes.length === 0 && !comments.trim()
Authentication Error
Error: "User not authenticated. Please log in again"
Reasons:
User session expired
Invalid authentication token
User not logged in
Authentication service failure
Case Recreation Failures
Error: "Failed to recreate case"
Reasons:
Original case not found
User not authenticated
Database transaction failure
RLS policy violation
11. Payment & Rate Card Errors
Rate Card Creation Failures
Error: "Failed to create rate card"
Reasons:
Missing required fields (name, pincode tier, completion slab)
Invalid base rate (must be > 0)
Negative travel allowance or bonus
Database transaction failure
RLS policy violation
Rate Card Update/Deletion Failures
Error: "Failed to update rate card" / "Failed to delete rate card"
Reasons:
Rate card not found
Rate card in use by active contracts
Foreign key constraint violations
Insufficient permissions
Database transaction failure
Payment Processing Failures
Error: "Failed to process payment"
Reasons:
Invalid payment amount
Payment gateway failure
Insufficient funds
Invalid payment method
Database transaction failure
12. Pincode Tier Management Errors
Pincode Tier Creation Failures
Error: "Failed to create pincode tier"
Reasons:
Pincode already exists (unique constraint)
Invalid pincode format (not 6 digits)
Missing required fields (pincode, tier, city, state)
Database transaction failure
RLS policy violation
Pincode Tier Update/Deletion Failures
Error: "Failed to update pincode tier" / "Failed to delete pincode tier"
Reasons:
Pincode tier not found
Pincode tier in use by active cases
Foreign key constraint violations
Insufficient permissions
Database transaction failure
Bulk Pincode Tier Failures
Error: "Failed to bulk create pincode tiers"
Reasons:
CSV parsing errors
Duplicate pincodes in CSV
Invalid data in CSV rows
Database constraint violations
13. Database Connection Errors
Connection Failures
Error: "Failed to connect to database"
Reasons:
Supabase service down
Network connectivity issues
Invalid database credentials
Database server overloaded
Query Failures
Error: "Failed to execute query"
Reasons:
Invalid SQL syntax
Missing tables or columns
Database timeout
RLS policy blocking query
Transaction Failures
Error: "Failed to complete transaction"
Reasons:
Constraint violation during transaction
Deadlock in database
Transaction timeout
Rollback due to error
14. File Upload Errors
File Upload Failures
Error: "Failed to upload file"
Reasons:
File size exceeds server limit
Invalid file type
Network timeout during upload
Storage service failure
File Processing Failures
Error: "Failed to process file"
Reasons:
Corrupted file
Unsupported file format
Processing timeout
Memory limit exceeded
File Validation Failures
Error: "File validation failed"
Reasons:
File doesn't meet size requirements
File type not allowed
File corrupted
File contains malicious content
15. Notification Errors
Notification Sending Failures
Error: "Failed to send notification"
Reasons:
Email service configuration issues
Invalid email addresses
SMTP server down
Rate limiting exceeded
Permission Errors
Error: "Notification permission denied"
Reasons:
User denied notification permissions
Browser blocking notifications
Invalid notification settings
Service worker not registered
Push Notification Failures
Error: "Failed to send push notification"
Reasons:
Invalid device token
Push service down
Invalid notification payload
Device not registered
16. Mobile App Errors
Offline Sync Failures
Error: "Failed to sync offline data"
Reasons:
Network connectivity issues
Database connection failure
Data corruption
Sync timeout
Photo Capture Failures
Error: "Failed to capture photo"
Reasons:
Camera permission denied
Camera hardware failure
Storage space insufficient
Invalid camera settings
Location Access Failures
Error: "Failed to access location"
Reasons:
Location permission denied
GPS disabled
Location services unavailable
Invalid coordinates
17. System Status Errors
Overdue Cases
Error: Cases marked as overdue with red styling
Reasons:
Case due date has passed
isOverdue(caseItem.due_at) returns true
Current date > case due date
Failed Status
Error: Various status indicators showing "Failed" in red
Reasons:
Case status is 'qc_rejected'
Allocation failed
Submission failed
Payment failed
Error States
Error: System error states displayed in red
Reasons:
Database connection lost
Service unavailable
System maintenance
Critical system failure
Warning States
Error: Critical warnings displayed in red
Reasons:
High system load
Storage space low
Security alerts
Performance issues
18. Visual Error Indicators
Red Borders
Error: Form fields with validation errors
Reasons:
Required field empty
Invalid format
Validation rule violation
Field marked as invalid
Red Text
Error: Error messages below form fields
Reasons:
Field validation failure
Format validation error
Required field missing
Custom validation rule violation
Red Badges
Error: Status indicators for failed states
Reasons:
Case status is failed
Allocation failed
QC rejected
Payment failed
Red Backgrounds
Error: Alert boxes and error containers
Reasons:
Critical error occurred
System failure
Validation errors
Database errors
Red Icons
Error: Error icons (X, warning triangles)
Reasons:
Operation failed
Validation error
System error
Critical warning
Red Progress Bars
Error: Failed operations progress indicators
Reasons:
Upload failed
Processing failed
Sync failed
Operation timeout
19. Specific Error Scenarios
Duplicate Entries
Error: "Email or phone already exists"
Reasons:
Unique constraint violation
Duplicate data in database
User trying to create duplicate record
Data integrity violation
Foreign Key Violations
Error: "Invalid vendor ID - vendor does not exist in system"
Reasons:
Referenced entity doesn't exist
Invalid foreign key reference
Data integrity violation
Orphaned record reference
Enum Value Errors
Error: "Invalid enum value in row data"
Reasons:
Value not in allowed enum values
Invalid status or type
Data validation failure
Schema constraint violation
Null Value Errors
Error: "Missing required field"
Reasons:
Required field is null
Data integrity violation
Schema constraint violation
Validation rule violation
Constraint Violations
Error: "Unique constraint violation"
Reasons:
Duplicate unique key
Data integrity violation
Business rule violation
Database constraint violation
Permission Errors
Error: "Access denied" / "Insufficient permissions"
Reasons:
User role doesn't allow action
RLS policy violation
Authentication failure
Authorization failure
20. Context-Specific Errors
Case-Specific
Error: "Case not found" / "Case already exists"
Reasons:
Invalid case ID
Case deleted
Duplicate case ID
Case in wrong status
User-Specific
Error: "User not authenticated" / "User not found"
Reasons:
Session expired
Invalid user ID
User deleted
Authentication failure
Location-Specific
Error: "Location not found" / "Invalid coordinates"
Reasons:
Invalid location ID
Coordinates out of range
Location deleted
Invalid address data
Time-Specific
Error: "Session expired" / "Operation timeout"
Reasons:
Authentication token expired
Database timeout
Network timeout
Operation deadline exceeded
