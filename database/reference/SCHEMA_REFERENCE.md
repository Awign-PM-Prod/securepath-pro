# Database Schema Reference

## Core Tables

### 1. Authentication & Users
- `auth.users` - Supabase auth users
- `profiles` - User profiles with roles
- `password_setup_tokens` - Password setup tokens

### 2. Core Entities
- `cases` - Main case entity
- `clients` - Client organizations
- `locations` - Geographic locations with pincode tiers
- `pincode_tiers` - Pincode tier classification

### 3. Gig Workers & Vendors
- `gig_partners` - Gig worker profiles with capacity
- `vendors` - Vendor organizations
- `capacity_tracking` - Daily capacity tracking

### 4. Allocation System
- `allocation_logs` - Allocation history
- `allocation_config` - Allocation configuration
- `performance_metrics` - Performance tracking

### 5. Quality Control
- `submissions` - Case submissions
- `qc_reviews` - QC review records
- `qc_workflow` - QC workflow tracking
- `submission_photos` - Photo evidence

### 6. Financial
- `rate_cards` - Dynamic pricing
- `payment_cycles` - Payment processing cycles
- `payment_lines` - Individual payment items
- `vendor_payouts` - Vendor payments

### 7. Forms & Templates
- `form_templates` - Dynamic form templates
- `form_fields` - Form field definitions
- `form_submissions` - Form submission data
- `contract_type_config` - Contract type configuration

### 8. Communication
- `notifications` - Multi-channel notifications
- `notification_templates` - Notification templates
- `email_intake_logs` - Email parsing logs

### 9. System
- `system_configs` - System configuration
- `audit_logs` - System audit trail
- `communication_preferences` - User communication settings

## Key Enums

### case_status
- `created` - Case created
- `auto_allocated` - Auto-allocated to worker/vendor
- `accepted` - Accepted by assignee
- `in_progress` - Work in progress
- `submitted` - Work submitted
- `qc_pending` - Awaiting QC
- `qc_passed` - QC approved
- `qc_failed` - QC rejected
- `completed` - Case completed
- `cancelled` - Case cancelled

### assignment_type
- `gig` - Gig worker assignment
- `vendor` - Vendor assignment

### app_role
- `super_admin` - Super administrator
- `ops_team` - Operations team
- `vendor_team` - Vendor team
- `qc_team` - Quality control team
- `vendor` - Vendor user
- `gig_worker` - Gig worker
- `client` - Client user

### pincode_tier_enum
- `tier_1` - Metro cities
- `tier_2` - Tier-2 cities
- `tier_3` - Rural areas

### notification_channel
- `email` - Email notifications
- `sms` - SMS notifications
- `whatsapp` - WhatsApp notifications
- `push` - Push notifications
- `ivr` - IVR calls

### notification_priority
- `low` - Low priority
- `medium` - Medium priority
- `high` - High priority
- `urgent` - Urgent priority

### notification_status
- `pending` - Pending delivery
- `sent` - Sent successfully
- `delivered` - Delivered to recipient
- `failed` - Delivery failed
- `cancelled` - Cancelled

### payment_status
- `pending` - Pending payment
- `processing` - Processing payment
- `completed` - Payment completed
- `failed` - Payment failed
- `cancelled` - Payment cancelled

### payment_method
- `bank_transfer` - Bank transfer
- `upi` - UPI payment
- `wallet` - Digital wallet
- `cash` - Cash payment

### submission_status
- `submitted` - Submitted for review
- `qc_pending` - Awaiting QC
- `qc_passed` - QC approved
- `qc_failed` - QC rejected
- `rework_required` - Rework needed

## Key Relationships

### Case Assignment
- `cases.current_assignee_id` → `gig_partners.id` OR `vendors.id`
- `cases.current_assignee_type` → `assignment_type` enum
- `cases.current_vendor_id` → `vendors.id` (for vendor-managed gig workers)

### Capacity Management
- `gig_partners.capacity_available` - Real-time capacity
- `capacity_tracking` - Daily capacity tracking
- `capacity_tracking.gig_partner_id` → `gig_partners.id`

### Allocation Logs
- `allocation_logs.case_id` → `cases.id`
- `allocation_logs.candidate_id` → `gig_partners.id` OR `vendors.id`
- `allocation_logs.candidate_type` → `assignment_type` enum

### Form System
- `form_templates.contract_type_id` → `contract_type_config.id`
- `form_fields.template_id` → `form_templates.id`
- `form_submissions.case_id` → `cases.id`

## Indexes

### Performance Critical
- `cases.status` - Case status filtering
- `cases.current_assignee_id` - Assignment queries
- `gig_partners.coverage_pincodes` - GIN index for pincode matching
- `vendors.coverage_pincodes` - GIN index for pincode matching
- `allocation_logs.case_id` - Allocation history
- `capacity_tracking.gig_partner_id, date` - Capacity queries

### Composite Indexes
- `cases(status, current_assignee_type)` - Status + type filtering
- `gig_partners(is_active, is_available, capacity_available)` - Allocation queries
- `vendors(is_active, capacity_available)` - Vendor allocation

## Constraints

### Check Constraints
- `cases.bonus_inr >= 0` - Non-negative bonus
- `cases.penalty_inr >= 0` - Non-negative penalty
- `cases.total_payout_inr >= 0` - Non-negative payout
- `allocation_logs.candidate_type` - Valid assignment types
- `cases.current_assignee_type` - Valid assignment types

### Foreign Key Constraints
- All foreign keys properly defined
- Cascade rules for data integrity
- Referential integrity maintained

## RLS Policies

### Core Principles
- Users can only access their own data
- Role-based access control
- Vendors can access their gig workers
- Gig workers can access assigned cases
- Ops team has full access

### Key Policies
- `profiles` - Users can read own profile
- `cases` - Role-based case access
- `gig_partners` - Self + vendor access
- `vendors` - Self + team access
- `allocation_logs` - Assignment-based access
- `submissions` - Case-based access

## Functions

### Allocation Functions
- `get_allocation_candidates()` - Get eligible candidates
- `allocate_case_to_candidate()` - Assign case to candidate
- `assign_case_to_gig_worker()` - Vendor assigns to gig worker

### Capacity Functions
- `update_capacity_on_submission()` - Update capacity on submission
- `fix_capacity_for_submitted_cases()` - Fix capacity data

### User Functions
- `setup_gig_worker_password()` - Setup gig worker password
- `create_user()` - Create new user with profile

### Vendor Functions
- `get_vendor_gig_workers()` - Get vendor's gig workers
- `get_vendor_assigned_cases()` - Get vendor's assigned cases

## Triggers

### Capacity Management
- `update_capacity_on_submission` - Decrements capacity on case submission
- `capacity_tracking_upsert` - Maintains capacity tracking records

### Audit Trail
- `audit_log_trigger` - Logs all changes to audit_logs table

## Storage

### Buckets
- `case-attachments` - Case file attachments
- `submission-photos` - Submission photo evidence
- `form-files` - Form submission files

### RLS Policies
- Users can upload to their assigned cases
- Vendors can access their case files
- Gig workers can access their case files
