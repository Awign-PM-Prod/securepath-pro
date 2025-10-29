# Red Error Messages Analysis - Complete List

This document lists all conditions where red error messages are displayed on the UI across the entire project.

## Error Display Methods

The project uses several methods to display red errors:
1. **Toast notifications** with `variant: 'destructive'`
2. **Alert components** with `variant="destructive"`
3. **Inline form errors** using `text-destructive`, `text-red-500`, `text-red-600`, etc.
4. **FormMessage component** (automatic red styling)
5. **Badge components** with `variant="destructive"`
6. **Border styling** with `border-red-*` classes
7. **Background styling** with `bg-red-*` classes

---

## 1. Authentication & Login Errors

### Login Page (`src/pages/Login.tsx`)
- **Login failure**: Error message from Supabase auth (shown in Alert with destructive variant)
  - *Message displayed: `error.message || 'An error occurred during login'`*
- **Invalid email format**: "Please enter a valid email" (form validation, red text `text-destructive`)
- **Missing password**: "Password is required" (form validation, red text `text-destructive`)

### Forgot Password (`src/pages/ForgotPassword.tsx`)
- **Email send failure**: Error message from Supabase auth (shown in Alert with destructive variant)
  - *Message displayed: `err.message || 'Failed to send reset email'`*
- **Invalid email format**: "Please enter a valid email address" (form validation, red text `text-red-500`)

### Reset Password (`src/pages/ResetPassword.tsx`)
- **Password reset failure**: Error message (shown in Alert with destructive variant)
  - *Generic error from password update operation*
- **Invalid password**: Password validation errors (red text `text-red-500`)
  - *Messages: Various password strength/validation errors*
- **Password mismatch**: "Passwords do not match" (red text `text-red-500`)

### Gig Worker Auth (`src/pages/GigWorkerAuth.tsx`)
- **Password setup failure**: Error during password setup (Alert with destructive variant)
  - *Message displayed: Error message from the error state variable*
- **Password reset failure**: Error during password reset (Alert with destructive variant)
  - *Message displayed: Error message from the error state variable*

### Gig Worker Reset Password (`src/pages/GigWorkerResetPassword.tsx`)
- **Password reset failure**: Error message (Alert destructive)

---

## 2. Form Validation Errors

### Form Components (Using FormMessage or inline errors)

#### Dynamic Form (`src/components/DynamicForm.tsx`)
- **Missing mandatory fields**: "{field_title} is required" (red text)
- **Max files exceeded**: "Maximum {maxFiles} file(s) allowed" (red text)
- **Invalid file type**: "Invalid file type. Allowed: {types}" (red text)
- **File size exceeded**: "File size must be less than {maxSize}MB" (red text)
- **Field rendering error**: "Error rendering field: {field_title}" (red background box)

#### Create User Dialog (`src/components/UserManagement/CreateUserDialog.tsx`)
- **Missing first name**: "First name is required" (text-destructive)
- **Missing last name**: "Last name is required" (text-destructive)
- **Invalid/missing email**: Email validation errors (text-destructive)
- **Missing/invalid password**: Password validation errors (text-destructive)
- **Invalid phone**: Phone validation errors (text-destructive)
- **Missing role**: "Role is required" (text-destructive)
- **User creation failure**: Error message (Alert destructive)

#### Client Form (`src/components/ClientManagement/ClientForm.tsx`)
- **Missing company name**: "Company name is required"
- **Missing contact person**: "Contact person is required"
- **Invalid/missing email**: "Email is required" or "Please enter a valid email address"
- **Invalid phone**: "Phone number is required" or "Please enter a valid 10-digit Indian phone number"
- **Missing address**: "Address is required"
- **Missing city**: "City is required"
- **Missing state**: "State is required"
- **Invalid pincode**: "Pincode is required" or "Please enter a valid 6-digit pincode"
- **Client creation failure**: Error toast (destructive)

#### Client Contract Form (`src/components/ClientContracts/ClientContractForm.tsx`)
- **Contract already exists**: "A contract with this client and contract type combination already exists. Please choose a different contract type or edit the existing contract." (toast destructive)
  - *Title: "Contract Already Exists"*
  - *Triggered by error code '23505' (unique constraint violation)*
- **Invalid selection**: "Please ensure all selected options are valid." (toast destructive)
  - *Title: "Invalid Selection"*
  - *Triggered by error code '23503' (foreign key constraint violation)*
- **Generic save failure**: `error?.message || 'Failed to save contract'` (toast destructive)
  - *Title: "Error"*
- **Missing required fields**: Form validation errors (inline red text)

#### Vendor Form (`src/components/VendorManagement/CreateVendorDialog.tsx`)
- **Vendor creation failure**: Error message (Alert destructive)

---

## 3. Case Management Errors

### Case Management (`src/pages/CaseManagement.tsx`)
- **Case creation failure**: "Failed to create the case. Please try again." (toast destructive)
- **Case update failure**: "Failed to update case. Please try again." (toast destructive)
- **Case deletion failure**: "Failed to delete the case. Please try again." (toast destructive)
- **Case fetch failure for editing**: "Failed to load case for editing" (toast destructive)
- **Case fetch failure**: "Failed to load cases and clients" (toast destructive)

### Case List with Allocation (`src/components/CaseManagement/CaseListWithAllocation.tsx`)
- **Allocation error**: "An error occurred during allocation" (toast destructive)
  - *Title: "Error"*
- **Manual allocation - no cases**: "Please select cases to manually allocate" (toast destructive)
  - *Title: "Error"*
- **Allocation options fetch failure**: "Failed to load available allocation options" (toast destructive)
  - *Title: "Error"*
- **Manual allocation - no worker**: "Please select a gig worker for manual allocation" (toast destructive)
  - *Title: "Error"*
- **Manual allocation - no vendor**: "Please select a vendor for manual allocation" (toast destructive)
  - *Title: "Error"*
- **Manual allocation failure**: "Failed to complete manual allocation" (toast destructive)
  - *Title: "Error"*
- **Bulk allocation success with failures**: `Successfully allocated ${results.successful} cases. ${results.failed} failed.` (toast destructive if failed > 0)
  - *Title: "Error" (if failures)*
- **Unallocation success with failures**: `Successfully unallocated ${results.successful} cases. ${results.failed > 0 ? `${results.failed} failed.` : ''}` (toast destructive if failed > 0)
- **Unallocation error**: "An error occurred during unallocation" (toast destructive)
  - *Title: "Error"*
- **Partial allocation failures**: `${results.failed} cases could not be allocated` (toast destructive)
  - *Title: "Error"*

### Allocation Actions (`src/components/CaseManagement/AllocationActions.tsx`)
- **Allocation failed**: `result.error || 'Failed to allocate case'` (toast destructive)
  - *Title: "Allocation Failed"*
- **Reallocation failed**: `result.error || 'Failed to reallocate case'` (toast destructive)
  - *Title: "Reallocation Failed"*
- **Allocation error**: "An error occurred during allocation" (toast destructive)
  - *Title: "Error"*
- **Reallocation error**: "An error occurred during reallocation" (toast destructive)
  - *Title: "Error"*
- **Load allocation status failure**: "Failed to load allocation status" (toast destructive)
  - *Title: "Error"*

### Bulk Case Upload (`src/components/BulkCaseUpload.tsx`)
- **Invalid file type**: "Please upload a CSV file." (toast destructive)
  - *Title: "Invalid File"*
- **Template download failure**: "Failed to download template. Please try again." (toast destructive)
  - *Title: "Download Failed"*
- **CSV parsing errors**: `Found ${result.errors.length} errors in the CSV file.` (toast destructive)
  - *Title: "Parsing Failed"*
- **CSV parsing failure**: "Failed to parse CSV file. Please check the format." (toast destructive)
  - *Title: "Parsing Error"*
- **Partial case creation**: `Created ${result.created} cases, failed ${result.failed} cases.` (toast destructive)
  - *Title: "Creation Partially Failed"*
- **Case creation failure**: "Failed to create cases. Please try again." (toast destructive)
  - *Title: "Creation Failed"*
- **CSV parsing errors display**: Shown in Alert (destructive) with error list
  - *Shows up to 3 errors with "... and X more errors" if applicable*

### CSV Management (`src/components/CaseManagement/CSVManagement.tsx`)
- **Import success with failures**: `Successfully processed ${result.successful} cases. ${result.failed} failed.` (toast destructive if failed > 0)
- **Import errors**: "Failed to import cases" (toast destructive)
  - *Title: "Import Error"*
- **Export errors**: "Failed to export cases" (toast destructive)
  - *Title: "Export Error"*
- **Template download error**: "Failed to download template" (toast destructive)
  - *Title: "Download Error"*
- **Test payout error**: "Failed to test payout calculation" (toast destructive)
  - *Title: "Test Error"*
- **Failed cases badge**: Badge showing failed count with destructive variant

### Case Detail (`src/components/CaseManagement/CaseDetail.tsx`)
- **No submissions for download**: "No form submissions available to download" (sonner toast.error)
- **CSV generation failure**: "Failed to generate CSV file" (sonner toast.error)
- **PDF generation failure**: "Failed to generate PDF file" (sonner toast.error)
- **No submissions for PDF**: "No form submissions available" (sonner toast.error)
- **No PDF URL**: "No PDF URL in API response" (sonner toast.error)
- **Unexpected API response**: "Unexpected response format from API" (sonner toast.error)
- **CORS error**: "CORS Error: PDF API server needs to allow \"x-api-key\" header. Please contact the API owner." (sonner toast.error, duration: 8000ms)
- **Generic PDF API error**: `Error: ${error.message}` (sonner toast.error)
- **PDF API failure**: "Failed to generate PDF via API" (sonner toast.error)
- **CSV content generation failure**: "Failed to generate CSV content" (sonner toast.error)
- **Bonus add failure**: Error message (sonner toast.error)

---

## 4. Gig Worker Management Errors

### Gig Worker Management (`src/pages/GigWorkerManagement.tsx`)
- **Gig worker fetch failure**: "Failed to load gig workers and vendors" (toast destructive)
  - *Title: "Error"*
- **Gig worker creation - validation errors**:
  - "First name is required" (toast destructive, title: "Validation Error")
  - "Last name is required" (toast destructive, title: "Validation Error")
  - "Email is required" (toast destructive, title: "Validation Error")
  - "Phone number is required" (toast destructive, title: "Validation Error")
- **Gig worker creation - duplicate user**: "A user with this email or phone number already exists." (toast destructive)
  - *Title: "Error"*
- **Gig worker creation failure**: "Failed to create gig worker" (toast destructive)
  - *Title: "Error"*
- **Gig worker creation - email send failure**: "Gig worker created but failed to send setup email. Please send password reset manually." (toast default)
  - *Title: "User Created"*
- **Gig worker update - validation errors**: Same as creation (toast destructive, title: "Validation Error")
- **Gig worker update - duplicate phone**: "A gig worker with this phone number already exists. Please use a different phone number." (toast destructive)
- **Gig worker update failure**: "Failed to update gig worker" (toast destructive)
  - *Title: "Error"*
- **Gig worker deletion failure**: "Failed to delete gig worker" (toast destructive)
  - *Title: "Error"*
- **Bulk upload file missing**: "Please select a CSV file to upload" (toast destructive)
- **Bulk upload errors** (shown in error list):
  - `Row ${i + 2}: Email or phone ${rowData.email} already exists` (for duplicate constraint)
  - `Row ${i + 2}: Invalid enum value in row data` (for enum errors)
  - `Row ${i + 2}: Missing required field` (for null constraint)
  - `Row ${i + 2}: Invalid vendor ID - vendor does not exist in system` (for foreign key constraint)
  - `Row ${i + 2}: ${errorMessage}` (generic errors)
  - `Row ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}` (catch block errors)
- **Bulk upload completed with errors**: `Successfully created ${results.success} gig workers. ${results.failed} failed. See details below.` (toast destructive)
  - *Title: "Bulk Upload Completed with Errors"*
- **Bulk upload display**: Error list shown in red background box with title "Upload Errors (X)" (text-red-600, bg-red-50, text-red-700)
- **Bulk upload unknown error**: `error instanceof Error ? error.message : 'Unknown error occurred'` (toast destructive)
- **Unavailable worker badge**: Worker availability status (badge destructive variant when `is_available = false`)

### Gig Worker Dashboard (`src/pages/GigWorkerDashboard.tsx`)
- **Gig worker profile not found**: "Gig worker profile not found" (toast destructive)
  - *Title: "Error"*
- **Initialization failure**: "Failed to initialize gig worker profile" (toast destructive)
  - *Title: "Error"*
  - *Note: Timeout errors are handled silently (not shown)*
- **Case loading failure**: "Failed to load allocated cases" (toast destructive)
  - *Title: "Error"*
- **Case acceptance failure**: "Failed to accept case" (toast destructive)
  - *Title: "Error"*
- **Case rejection failure**: "Failed to reject case" (toast destructive)
  - *Title: "Error"*
- **Submission failure**: "Failed to submit case" (toast destructive)
  - *Title: "Error"*
  - *Alternative message: `result.error || 'Failed to submit case'`*
- **Unexpected submission error**: "An unexpected error occurred" (toast destructive)
  - *Title: "Error"*
- **Draft save failure**: `result.error || 'Failed to save draft'` (toast destructive)
  - *Title: "Error"*
- **Draft save generic failure**: "Failed to save draft" (toast destructive)
  - *Title: "Error"*
- **Draft resume failure**: "Failed to resume draft" (toast destructive)
  - *Title: "Error"*
- **Previous submission load failure**: "Failed to load previous submission for editing." (toast destructive)
  - *Title: "Error"*
- **Draft delete failure**: "Failed to delete draft" (toast destructive)
  - *Title: "Error"*
- **QC rework badge**: "QC Rework - Pending Acceptance" (badge destructive with red styling: `bg-red-100 text-red-800`)
- **Overdue case indication**: Text shown in red (text-red-600)
- **QC rework display**: Red alert box showing rework requirements (bg-red-50, text-red-800, text-red-700)
  - *Shows QC decision and rework reasons*

---

## 5. Vendor Dashboard Errors

### Vendor Dashboard (`src/pages/VendorDashboard.tsx`)
- **Gig worker fetch failure**: "Failed to fetch gig workers" (toast destructive)
  - *Title: "Error"*
- **Case fetch failure**: "Failed to fetch cases" (toast destructive)
  - *Title: "Error"*
- **Case acceptance failure**: "Failed to accept case" (toast destructive)
  - *Title: "Error"*
- **Case rejection failure**: "Failed to reject case" (toast destructive)
  - *Title: "Error"*
- **Case pickup failure**: "Failed to pick up case" (toast destructive)
  - *Title: "Error"*
- **Bulk assignment - no selection**: "Please select at least one case" (toast destructive)
  - *Title: "Error"*
- **Bulk assignment - no worker**: "Please select a gig worker and at least one case" (toast destructive)
  - *Title: "Error"*
- **Bulk assignment failure**: "Failed to assign cases. Please try again." (toast destructive)
  - *Title: "Error"*
- **Manual assignment - no selection**: "Please select both a case and a gig worker" (toast destructive)
  - *Title: "Error"*
- **Assignment failure**: "Failed to assign case" (toast destructive)
  - *Title: "Error"*
- **Reassignment - no worker**: "Please select a gig worker" (toast destructive)
  - *Title: "Error"*
- **Reassignment failure**: "Failed to reassign case" (toast destructive)
  - *Title: "Error"*
- **Unassigned cases fetch failure**: "Failed to fetch unassigned cases" (toast destructive)
  - *Title: "Error"*
- **Rework cases fetch failure**: "Failed to fetch rework cases" (toast destructive)
  - *Title: "Error"*
- **QC rework display**: Red alert showing QC rework decision (bg-red-50, text-red-800, text-red-700)
  - *Title: "QC Decision: Rework Required"*
  - *Shows rework reasons and deadline warnings*
- **Expired deadline warnings**: Red text styling for expired items (text-red-600, text-red-700)
- **Rejection button**: Reject case button (variant destructive)

---

## 6. QC (Quality Control) Errors

### QC Dashboard (`src/pages/dashboards/QCDashboard.tsx`)
- **QC review failure**: "Failed to load cases. Please try again." (toast destructive)
  - *Title: "Error"*
- **QC rejected status**: Badge styling (bg-red-100 text-red-800)

### QC Workbench (`src/components/QC/QCWorkbench.tsx`)
- **QC submission failure**: Error toast (destructive)
- **Missing required fields**: Badge shows destructive variant when field is empty
- **Rejection status**: Badge shows destructive variant for rejected reviews

### QC Submission Review (`src/components/QC/QCSubmissionReview.tsx`)
- **Validation error**: "Please select at least one reason code OR provide comments for rejection or rework." (toast destructive)
  - *Title: "Validation Error"*
- **Authentication error**: "User not authenticated. Please log in again." (toast destructive)
  - *Title: "Authentication Error"*
- **Review submission failure**: `error instanceof Error ? error.message : 'Failed to submit QC action. Please try again.'` (toast destructive)
  - *Title: "Error"*
- **Case recreation failure**: `error instanceof Error ? error.message : 'Failed to recreate case. Please try again.'` (toast destructive)
  - *Title: "Error"*

---

## 7. Form Management Errors

### Form Management (`src/pages/FormManagement.tsx`)
- **Form template fetch failure**: `result.error || 'Failed to load form templates'` (toast destructive)
  - *Title: "Error"*
- **Form template fetch generic failure**: "Failed to load form templates" (toast destructive)
  - *Title: "Error"*
- **Form template save failure**: `result.error || 'Failed to save form template'` (toast destructive)
  - *Title: "Error"*
- **Form template save generic failure**: "Failed to save form template" (toast destructive)
  - *Title: "Error"*
- **Form template deletion failure**: `result.error || 'Failed to delete form template'` (toast destructive)
  - *Title: "Error"*
- **Form template deletion generic failure**: "Failed to delete form template" (toast destructive)
  - *Title: "Error"*
- **Form template publish failure**: `result.error || 'Failed to publish form template'` (toast destructive)
  - *Title: "Error"*
- **Form template publish generic failure**: "Failed to publish form template" (toast destructive)
  - *Title: "Error"*
- **Form template unpublish failure**: `result.error || 'Failed to unpublish form template'` (toast destructive)
  - *Title: "Error"*
- **Form template unpublish generic failure**: "Failed to unpublish form template" (toast destructive)
  - *Title: "Error"*

---

## 8. User Management Errors

### Create User Dialog (see Form Validation section above)

### Edit User Dialog (`src/components/UserManagement/EditUserDialog.tsx`)
- **User update failure**: Error message (Alert destructive)

### User List (`src/components/UserManagement/UserList.tsx`)
- **User deletion failure**: Error toast (destructive)
  - *Generic error messages from delete operations*
- **User fetch failure**: Error toast (destructive)
  - *Generic error messages from fetch operations*

---

## 9. Allocation Errors

### Allocation Dashboard (`src/components/Allocation/AllocationDashboard.tsx`)
- **Allocation fetch failure**: "Failed to load allocation data" (toast destructive)
  - *Title: "Error"*
- **Manual allocation failure**: "Manual allocation failed" (toast destructive)
  - *Title: "Error"*
- **Capacity refresh failure**: "Failed to refresh capacity data" (toast destructive)
  - *Title: "Error"*
- **Worker availability badge**: Unavailable workers show destructive badge variant

### Allocation Config (`src/components/Allocation/AllocationConfig.tsx`)
- **Invalid weight configuration**: Badge shows destructive variant when weights are invalid

---

## 10. Rate Card Management Errors

### Rate Card Management (`src/pages/RateCardManagement.tsx`)
- **Rate card creation failure**: Error toast (destructive)
- **Rate card update failure**: Error toast (destructive)

### Rate Card Form (`src/components/RateCards/RateCardForm.tsx`)
- **Rate card save failure**: Error toast (destructive)

### Rate Calculator (`src/components/RateCards/RateCalculator.tsx`)
- **Calculation error**: Error toast (destructive)
- **Invalid input**: Error toast (destructive)

---

## 11. Pincode Tier Management Errors

### Pincode Tier Management (`src/pages/PincodeTierManagement.tsx`)
- **Pincode tier creation failure**: Error toast (destructive)
- **Pincode tier update failure**: Error toast (destructive)
- **Delete button**: Delete action button (variant destructive)

### Bulk Pincode Tier Form (`src/components/PincodeTiers/BulkPincodeTierForm.tsx`)
- **Upload errors**: Errors shown in Alert with error list
- **Failed upload count**: Badge showing failed count (text-red-600)

---

## 12. Payment Management Errors

### Payment Management (`src/pages/PaymentManagement.tsx`)
- **Payment processing failure**: Error toast (destructive)
- **Payment fetch failure**: Error toast (destructive)
- **Payout processing failure**: Error toast (destructive)
- **Payment update failure**: Error toast (destructive)

---

## 13. Client Management Errors

### Client Management (`src/pages/ClientManagement.tsx`)
- **Client creation failure**: Error toast (destructive)
- **Client fetch failure**: Error toast (destructive - shown when partial success)

### Client Contract Management (`src/pages/ClientContractManagement.tsx`)
- **Contract creation failure**: Error toast (destructive)
- **Contract update failure**: Error toast (destructive)
- **Delete button**: Delete contract button (variant destructive)

### Contract Type Management (`src/components/ClientContracts/ContractTypeManagement.tsx`)
- **Contract type creation failure**: Error toast (destructive)
- **Contract type update failure**: Error toast (destructive)
- **Contract type deletion failure**: Error toast (destructive)
- **Contract type fetch failure**: Error toast (destructive)

---

## 14. Reports & Dashboard Errors

### Reports Dashboard (`src/pages/dashboards/Reports.tsx`)
- **Cases fetch failure**: "Failed to load submitted cases" (toast destructive)
  - *Title: "Error"*
- **No submissions for CSV**: "No form submissions found for this case" (toast destructive)
  - *Title: "Error"*
- **CSV generation failure**: "Failed to generate CSV content" (toast destructive)
  - *Title: "Error"*
- **CSV download failure**: "Failed to download CSV" (toast destructive)
  - *Title: "Error"*
- **No submissions for PDF**: "No form submissions found for this case" (toast destructive)
  - *Title: "Error"*
- **PDF generation failure**: "Failed to generate PDF" (toast destructive)
  - *Title: "Error"*

### Reporting Dashboard (`src/pages/ReportingDashboard.tsx`)
- **Low on-time rate badge**: Badge shows destructive variant when onTimeRate < 90%

---

## 15. Notification Errors

### Notifications (`src/pages/Notifications.tsx`)
- **Notification fetch failure**: Error toast (destructive)
  - *Generic error messages*
- **Failed notification status**: Badge shows "Failed" with destructive variant

### Notification Center (`src/components/NotificationCenter.tsx`)
- **Notification load failure**: "Failed to load notifications" (toast destructive)
  - *Title: "Error"*
  - *Note: Timeout errors are handled silently (not shown)*
- **Failed notification badge**: Badge shows "Failed" with destructive variant
- **Notification send failure badge**: Destructive badge for failed sends (`variant="destructive"`)

### Notification Permission (`src/components/NotificationPermission.tsx`)
- **Permission request failure**: Error toast (destructive)
  - *Generic error messages*
- **Notification enable failure**: Error toast (destructive)
  - *Generic error messages*
- **Notification test failure**: Error toast (destructive)
  - *Generic error messages*
- **Subscription failure**: Error toast (destructive)
  - *Generic error messages*

---

## 16. Mobile-Specific Errors

### Gig Worker Mobile (`src/pages/mobile/GigWorkerMobile.tsx`)
- **Case acceptance failure**: "Failed to accept case. Please try again." (toast destructive)
  - *Title: "Error"*
- **Case rejection failure**: "Failed to reject case. Please try again." (toast destructive)
  - *Title: "Error"*
- **Case start failure**: "Failed to start case. Please try again." (toast destructive)
  - *Title: "Error"*
- **Case submission failure**: "Failed to submit case. Please try again." (toast destructive)
  - *Title: "Error"*
- **Offline indicator**: Red dot for offline status (bg-red-500)
- **Overdue case indication**: Red text (text-red-600)

### Photo Capture (`src/components/mobile/PhotoCapture.tsx`)
- **Photo capture failure**: Error or permission denied (button variant destructive)
  - *Error messages vary based on camera/permission errors*

### Offline Sync (`src/components/mobile/OfflineSync.tsx`)
- **Failed sync count**: Badge showing failed count (variant destructive)
  - *Displays number of failed sync operations*

---

## 17. Status & State Indicators (Red Styling)

### Case Status Badges
- **QC Rejected**: Badge with `bg-red-100 text-red-800`
- **Case Overdue**: Text styling with `text-red-600` or `text-red-500`
- **Expired deadlines**: Red background rows or text (bg-red-50, text-red-600)
- **Urgent/High Priority**: Badge variants (destructive)
- **Penalty amounts**: Red text styling (text-red-600)
- **QC Rework Required**: Red alert boxes with detailed messages

### Worker Status
- **Unavailable workers**: Badge with destructive variant
- **Low capacity**: Visual indicators with red styling

### System Status
- **Low on-time rate**: Badge shows destructive when < 90%
- **Failed operations**: Various destructive badges throughout

---

## 18. Layout & Navigation Errors

### Error Fallback (`src/components/LoadingFallback.tsx`)
- **Error boundary**: ErrorFallback component displays errors with destructive styling

### App Layout (`src/components/Layout/AppLayout.tsx`)
- **Navigation errors**: Destructive badge for errors

### No Sidebar Layout (`src/components/Layout/NoSidebarLayout.tsx`)
- **Error display**: Destructive badge for errors

---

## 19. Generic Error Patterns

### Database Errors
- **Unique constraint violation**: "Already exists" errors
- **Foreign key constraint violation**: "Invalid selection" errors
- **Null constraint violation**: "Missing required field" errors
- **Enum value errors**: "Invalid enum value" errors

### Network Errors
- **Timeout errors**: Some handled silently, others show destructive toasts
- **CORS errors**: Specific CORS error messages for PDF API
- **Connection failures**: Generic connection error messages

### Permission Errors
- **Unauthorized access**: Handled at route level
- **RLS violations**: Supabase RLS errors shown as generic errors

---

## Summary

**Total Error Categories**: 19 major categories
**Primary Error Display Methods**:
1. Toast notifications with `variant: 'destructive'` (most common)
2. Alert components with `variant="destructive"`
3. Inline form errors with red text classes
4. Status badges with destructive variants
5. Visual indicators (red text, borders, backgrounds)

**Most Common Error Types**:
- Form validation errors
- Database operation failures
- Network/timeout errors
- Permission/authentication errors
- File upload/processing errors

All red error messages use either:
- Tailwind CSS classes: `text-red-*`, `bg-red-*`, `border-red-*`
- shadcn/ui variants: `variant="destructive"` or `variant: 'destructive'`
- CSS classes: `text-destructive` (which maps to red in the theme)

