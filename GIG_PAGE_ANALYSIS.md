# Gig Worker Dashboard Page Analysis

## Overview
The `/gig` page (accessible at `http://localhost:8080/gig`) is the main dashboard for gig workers in the background verification platform. It provides a comprehensive interface for managing allocated cases, accepting/rejecting assignments, and submitting completed work.

## Page Structure

### Route Configuration
- **URL**: `http://localhost:8080/gig`
- **Component**: `GigWorkerDashboard` (`src/pages/GigWorkerDashboard.tsx`)
- **Protection**: Protected route requiring `gig_worker` role
- **Layout**: Uses `AppLayout` wrapper

### Main Components
1. **NotificationCenter** - Real-time notifications for case updates
2. **Case Management Tabs** - Four main sections:
   - Pending (auto_allocated cases)
   - Accepted (accepted cases)
   - In Progress (in_progress cases)
   - Submitted (submitted cases)
3. **Dynamic Forms** - Contract-type specific form submission
4. **Case Action Dialogs** - Accept, reject, and submit case dialogs

## Database Tables and Data Sources

### Primary Data Tables

#### 1. **cases** table
**Purpose**: Main case entity storing background verification cases
**Key Fields Fetched**:
```sql
SELECT 
  id, case_number, client_case_id, contract_type,
  candidate_name, phone_primary, phone_secondary,
  status, priority, vendor_tat_start_date, due_at,
  base_rate_inr, total_payout_inr, current_vendor_id,
  clients (name),
  locations (address_line, city, state, pincode)
FROM cases
WHERE current_assignee_id = gigWorkerId 
  AND current_assignee_type = 'gig'
  AND status IN ('auto_allocated', 'pending_acceptance', 'accepted', 'in_progress', 'submitted')
```

**Status Values**:
- `auto_allocated` - Newly assigned, awaiting acceptance
- `accepted` - Accepted by gig worker
- `in_progress` - Work in progress
- `submitted` - Work submitted for review

#### 2. **gig_partners** table
**Purpose**: Gig worker profiles and capacity management
**Key Fields Fetched**:
```sql
SELECT id, is_direct_gig, vendor_id
FROM gig_partners
WHERE user_id = userId
```

**Key Fields**:
- `is_direct_gig` - Determines if gig worker is direct or vendor-connected
- `vendor_id` - Links to vendor if not direct gig worker

#### 3. **allocation_logs** table
**Purpose**: Tracks case allocation history and acceptance deadlines
**Key Fields Fetched**:
```sql
SELECT case_id, acceptance_deadline
FROM allocation_logs
WHERE case_id IN (caseIds)
  AND candidate_id = gigWorkerId
  AND decision = 'allocated'
```

**Key Fields**:
- `acceptance_deadline` - 1-hour window for case acceptance
- `decision` - Allocation decision (allocated, accepted, rejected, timeout)

#### 4. **form_templates** table
**Purpose**: Dynamic form templates for different contract types
**Key Fields Fetched**:
```sql
SELECT id, template_name, form_fields
FROM form_templates
WHERE contract_type_id = contractTypeId
  AND is_active = true
```

#### 5. **form_submissions** table
**Purpose**: Stores form submission data
**Key Fields**:
- `case_id` - Links to case
- `template_id` - Links to form template
- `gig_partner_id` - Links to gig worker
- `submission_data` - JSONB field containing form responses

#### 6. **form_submission_files** table
**Purpose**: Stores uploaded files from form submissions
**Key Fields**:
- `submission_id` - Links to form submission
- `field_id` - Links to form field
- `file_url` - Public URL of uploaded file
- `file_name`, `file_size`, `mime_type` - File metadata

#### 7. **notifications** table
**Purpose**: Real-time notifications for gig workers
**Key Fields Fetched**:
```sql
SELECT *
FROM notifications
WHERE recipient_id = gigWorkerId
ORDER BY created_at DESC
LIMIT 50
```

### Supporting Tables

#### 8. **clients** table
**Purpose**: Client organizations
**Relationship**: `cases.client_id → clients.id`

#### 9. **locations** table
**Purpose**: Geographic locations with pincode information
**Relationship**: `cases.location_id → locations.id`

#### 10. **contract_type_config** table
**Purpose**: Contract type configuration
**Relationship**: `cases.contract_type → contract_type_config.type_key`

## Key Features and Functionality

### 1. Case Management
- **View Allocated Cases**: Displays cases assigned to the gig worker
- **Case Status Tracking**: Real-time status updates
- **Priority Display**: Visual priority indicators (urgent, high, medium, low)
- **Time Management**: Acceptance deadline tracking with countdown

### 2. Case Actions

#### Accept Case
**Database Operations**:
1. Update `cases` table: `status = 'accepted'`
2. Update `allocation_logs` table: `decision = 'accepted'`
3. Send notification via `notificationService`

#### Reject Case
**Database Operations**:
1. Update `cases` table: `status = 'created'`, clear assignee
2. Update `allocation_logs` table: `decision = 'rejected'`
3. Call `free_capacity` RPC function
4. Send notification

#### Submit Case
**Database Operations**:
1. Check for form template in `form_templates` table
2. If template exists: Use `formService.submitForm()`
3. If no template: Use legacy `submissions` table
4. Update `cases` table: `status = 'submitted'`
5. Upload files to Supabase storage
6. Send notification

### 3. Dynamic Form System
- **Form Loading**: Fetches form template based on contract type
- **Field Types Supported**:
  - Short answer (text input)
  - Paragraph (textarea)
  - Multiple choice (checkboxes)
  - File upload (with validation)
  - Number input
  - Date picker
  - Boolean (checkbox)
- **File Upload**: Files stored in Supabase storage bucket `form_submissions`
- **Validation**: Client-side validation with mandatory field checking

### 4. Timeout Management
- **Automatic Timeout**: Cases not accepted within 1 hour are automatically unassigned
- **Timeout Handling**:
  1. Update case status to `created`
  2. Clear assignee information
  3. Update allocation log with timeout reason
  4. Free up gig worker capacity
  5. Send timeout notification

### 5. Notification System
- **Real-time Updates**: Notifications for case events
- **Notification Types**:
  - Case allocated
  - Case accepted
  - Case rejected
  - Case timeout
  - Case submitted
- **Status Tracking**: Read/unread notification states

## Data Flow

### 1. Page Load
1. Get gig worker ID from `gig_partners` table using user ID
2. Load allocated cases from `cases` table with joins to `clients` and `locations`
3. Get acceptance deadlines from `allocation_logs` table
4. Load notifications from `notifications` table
5. Set up timeout checking interval (every minute)

### 2. Case Acceptance Flow
1. User clicks "Accept" button
2. Update case status in `cases` table
3. Update allocation log in `allocation_logs` table
4. Send notification
5. Refresh case list

### 3. Case Submission Flow
1. User clicks "Submit" button
2. Load form template from `form_templates` table
3. Display dynamic form based on contract type
4. User fills and submits form
5. Save form data to `form_submissions` table
6. Upload files to Supabase storage
7. Update case status to `submitted`
8. Send notification

### 4. Timeout Handling Flow
1. Background interval checks for expired cases
2. Find cases past acceptance deadline
3. Update case status and clear assignee
4. Update allocation log with timeout reason
5. Free up capacity
6. Send timeout notification
7. Refresh case list

## Security and Access Control

### Row Level Security (RLS)
- Gig workers can only access their own allocated cases
- Form submissions are restricted to case assignee
- Notifications are user-specific

### Authentication
- Requires `gig_worker` role
- Uses Supabase auth system
- Protected route wrapper

## Performance Considerations

### Database Indexes
- `cases.current_assignee_id` - Fast case lookup
- `allocation_logs.case_id` - Fast allocation history
- `gig_partners.user_id` - Fast gig worker lookup
- `form_templates.contract_type_id` - Fast template lookup

### Caching
- No explicit caching implemented
- Relies on Supabase's built-in query optimization
- Real-time updates via polling (1-minute intervals)

## Error Handling

### Database Errors
- Try-catch blocks around all database operations
- User-friendly error messages via toast notifications
- Graceful degradation for non-critical operations

### File Upload Errors
- File validation (type, size, count)
- Storage bucket existence checking
- Fallback to continue form submission if file upload fails

### Timeout Handling
- Automatic case timeout after 1 hour
- Capacity freeing on timeout
- Notification of timeout events

## Mobile Responsiveness

### Mobile Support
- Responsive design with Tailwind CSS
- Mobile-optimized table layouts
- Touch-friendly button sizes
- Scrollable content areas

### Mobile-Specific Components
- `GigWorkerMobile` component available
- Optimized for mobile form submission
- Touch gestures for file uploads

## Integration Points

### External Services
- **Supabase Auth**: User authentication
- **Supabase Storage**: File uploads
- **Supabase Realtime**: Real-time updates (not implemented)

### Internal Services
- **gigWorkerService**: Core gig worker operations
- **formService**: Dynamic form handling
- **notificationService**: Notification management
- **DynamicForm**: Form rendering component

## Future Enhancements

### Planned Features
- Real-time updates via Supabase Realtime
- Push notifications for mobile
- Offline form submission
- Advanced file compression
- GPS location tracking for submissions
- Photo capture with camera integration

### Performance Improvements
- Implement proper caching strategy
- Optimize database queries
- Add pagination for large case lists
- Implement virtual scrolling for notifications

## Troubleshooting

### Common Issues
1. **Form Template Not Found**: Check `form_templates` table for active template
2. **File Upload Fails**: Verify storage bucket exists and permissions
3. **Timeout Not Working**: Check allocation log acceptance deadlines
4. **Notifications Not Showing**: Verify RLS policies on notifications table

### Debug Information
- Console logging for form template loading
- Error logging for database operations
- File upload progress tracking
- Case status change logging

