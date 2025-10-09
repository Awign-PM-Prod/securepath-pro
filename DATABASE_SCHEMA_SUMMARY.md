# Database Schema Summary - Background Verification Platform

## Overview
This document provides a comprehensive summary of the database schema designed for the Background Verification Platform. The schema supports the complete workflow from case intake through payment processing with sophisticated capacity management and quality controls.

## Migration Files Created

1. **20250120000001_core_entities.sql** - Core business entities (cases, locations, clients, vendors, gig partners, rate cards)
2. **20250120000002_allocation_capacity.sql** - Allocation engine and capacity management
3. **20250120000003_quality_control.sql** - Quality control and submissions system
4. **20250120000004_payment_system.sql** - Payment processing and financial management
5. **20250120000005_communication_system.sql** - Notifications, email intake, and system configuration
6. **20250120000006_rls_policies.sql** - Row Level Security policies and access control

## Core Entities

### 1. User Management
- **profiles** - User profiles with role-based access (existing, enhanced)
- **gig_partners** - Extended gig worker profiles with capacity and performance tracking
- **vendors** - Vendor organization profiles with team management
- **clients** - Client organization profiles with contract management

### 2. Case Management
- **cases** - Main case entity with complete lifecycle tracking
- **locations** - Standardized location data with geocoding support
- **case_attachments** - File attachments per case
- **rate_cards** - Dynamic pricing by pincode tier and completion time

### 3. Allocation & Capacity
- **allocation_logs** - Complete allocation history and scoring
- **capacity_tracking** - Real-time capacity management per gig worker
- **performance_metrics** - Quality and performance scoring system
- **allocation_config** - Configurable allocation parameters

### 4. Quality Control
- **submissions** - Field execution submissions with GPS validation
- **submission_photos** - Photo evidence with EXIF data validation
- **qc_reviews** - Quality control review records
- **qc_workflow** - QC workflow tracking and assignment
- **qc_reason_codes** - Standardized QC rejection reasons
- **qc_quality_standards** - Quality scoring criteria

### 5. Financial System
- **payment_cycles** - Bi-weekly payment processing cycles
- **payment_lines** - Individual payment line items
- **payment_adjustments** - Travel, bonus, and override adjustments
- **vendor_payouts** - Vendor-specific payout calculations
- **payment_config** - Payment processing configuration
- **financial_reports** - Generated financial reports

### 6. Communication & Notifications
- **email_intake_logs** - Email parsing and case creation logs
- **notification_templates** - Reusable notification templates
- **notifications** - Multi-channel notification tracking
- **communication_preferences** - User notification preferences
- **system_configs** - System-wide configuration parameters
- **audit_logs** - Comprehensive audit trail
- **client_contracts** - Client-specific terms and defaults

## Key Features Implemented

### Capacity Management
- Dynamic capacity tracking per gig worker
- Real-time capacity updates on case state changes
- Capacity reset scheduling and management
- Capacity consumption/freeing based on configurable rules

### Quality Scoring System
- Multi-factor scoring algorithm (quality, completion rate, on-time rate, acceptance rate)
- Performance metrics tracking and updates
- Quality thresholds for allocation eligibility
- Configurable scoring weights

### Rate Card System
- Pincode tier-based pricing (Tier-1 metro, Tier-2 city, Tier-3 rural)
- Completion time slab pricing (24h, 48h, 72h+)
- Ops overrides and post-assignment incentives
- Vendor vs direct gig rate visibility rules

### Email Intake Automation
- Structured email parsing with attachment support
- Trusted sender domain validation
- Automatic case creation from parsed emails
- Error handling and quarantine system

### Payment Processing
- Bi-weekly payment cycles with automatic calculation
- Vendor vs direct gig payment routing
- Travel and bonus adjustment tracking
- Multi-method payment support (bank transfer, UPI, wallet)

### Quality Control Workflow
- Evidence validation with GPS/EXIF checking
- Pass/Reject/Rework workflow with reason codes
- QC reviewer assignment and workload balancing
- Quality standards and scoring criteria

### Notification System
- Multi-channel notifications (email, SMS, WhatsApp, push, IVR)
- Template-based messaging with variable substitution
- User preference management
- Delivery tracking and retry logic

## Security Features

### Row Level Security (RLS)
- Comprehensive RLS policies on all tables
- Role-based access control throughout
- Function-based access checks for complex scenarios
- Service role permissions for system operations

### Data Protection
- PII encryption at rest (configured in Supabase)
- Secure file storage with signed URLs
- Audit logging for all data modifications
- Image integrity validation

### Access Control
- Role-based permissions (super_admin, ops_team, vendor_team, qc_team, vendor, gig_worker, client)
- Entity-level access control (users can only see their own data)
- Cross-entity access rules (vendors can see their gig workers' data)
- Function-based access validation

## Performance Optimizations

### Indexes
- Strategic indexes on frequently queried fields
- Composite indexes for complex queries
- GIN indexes for array fields (coverage_pincodes)
- Partial indexes for filtered queries

### Functions
- Optimized allocation candidate selection
- Efficient capacity management functions
- Performance metrics calculation
- Payment processing functions

### Triggers
- Automatic timestamp updates
- Capacity management on case status changes
- Audit logging for data modifications
- Photo validation on upload

## Configuration Management

### System Configuration
- Centralized configuration table
- Environment-specific settings
- Validation rules for configuration values
- Sensitive data protection

### Allocation Configuration
- Configurable scoring weights
- Acceptance window settings
- Capacity rules and thresholds
- Quality thresholds

### Payment Configuration
- Payment cycle settings
- Vendor commission rates
- Supported payment methods
- Approval workflow settings

## Data Relationships

### Core Relationships
- Cases → Locations (many-to-one)
- Cases → Clients (many-to-one)
- Cases → Gig Partners (many-to-one, via assignment)
- Gig Partners → Vendors (many-to-one, optional)
- Submissions → Cases (one-to-many)
- QC Reviews → Submissions (one-to-many)

### Financial Relationships
- Payment Cycles → Payment Lines (one-to-many)
- Payment Lines → Cases (many-to-one)
- Payment Lines → Gig Partners/Vendors (many-to-one)
- Vendor Payouts → Vendors (many-to-one)

### Allocation Relationships
- Allocation Logs → Cases (many-to-one)
- Allocation Logs → Gig Partners (many-to-one)
- Capacity Tracking → Gig Partners (many-to-one)
- Performance Metrics → Gig Partners (many-to-one)

## Migration Strategy

### Phase 1: Core Infrastructure
1. Run core entities migration
2. Run RLS policies migration
3. Test basic functionality

### Phase 2: Allocation Engine
1. Run allocation and capacity migration
2. Configure allocation parameters
3. Test allocation engine

### Phase 3: Quality Control
1. Run quality control migration
2. Configure QC standards
3. Test QC workflow

### Phase 4: Payment System
1. Run payment system migration
2. Configure payment parameters
3. Test payment processing

### Phase 5: Communication
1. Run communication system migration
2. Configure notification templates
3. Test notification system

## Monitoring and Maintenance

### Performance Monitoring
- Query performance analysis
- Index usage monitoring
- Capacity utilization tracking
- Allocation engine performance

### Data Integrity
- Foreign key constraint validation
- Data consistency checks
- Audit log monitoring
- Performance metrics validation

### Security Monitoring
- RLS policy effectiveness
- Access pattern analysis
- Audit log review
- Permission validation

## Future Enhancements

### Scalability
- Table partitioning for high-volume tables
- Materialized views for complex reporting
- Connection pooling optimization
- Caching strategies

### Advanced Features
- Machine learning integration for allocation optimization
- Advanced analytics and forecasting
- Real-time dashboards
- API rate limiting and throttling

### Integration
- External service integrations
- Webhook support
- API versioning
- Third-party authentication

---

*This schema provides a solid foundation for the Background Verification Platform with room for future enhancements and scaling.*

