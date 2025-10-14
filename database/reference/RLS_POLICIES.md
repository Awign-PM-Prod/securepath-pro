# Row Level Security (RLS) Policies Reference

## Overview
All tables have RLS enabled with role-based access control. Users can only access data they're authorized to see.

## Core Principles

### 1. User Access
- Users can read their own profile
- Users can read their own gig worker/vendor records
- Users can read cases assigned to them

### 2. Role-Based Access
- **Super Admin**: Full access to all data
- **Ops Team**: Full access to all data
- **Vendor Team**: Access to vendor data and assigned cases
- **QC Team**: Access to cases and submissions for QC
- **Vendors**: Access to their data and their gig workers
- **Gig Workers**: Access to their data and assigned cases
- **Clients**: Access to their cases only

## Table Policies

### 1. profiles
```sql
-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);
```

### 2. gig_partners
```sql
-- Gig workers can read their own record
CREATE POLICY "Gig workers can read own record" ON gig_partners
  FOR SELECT USING (auth.uid() = user_id);

-- Vendors can read their gig workers
CREATE POLICY "Vendors can read their gig workers" ON gig_partners
  FOR SELECT USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Ops team has full access
CREATE POLICY "Ops team full access" ON gig_partners
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'ops_team')
    )
  );
```

### 3. vendors
```sql
-- Vendors can read their own record
CREATE POLICY "Vendors can read own record" ON vendors
  FOR SELECT USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Ops team has full access
CREATE POLICY "Ops team full access" ON vendors
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'ops_team')
    )
  );
```

### 4. cases
```sql
-- Gig workers can read assigned cases
CREATE POLICY "Gig workers can read assigned cases" ON cases
  FOR SELECT USING (
    current_assignee_id IN (
      SELECT id FROM gig_partners WHERE user_id = auth.uid()
    )
  );

-- Vendors can read their assigned cases
CREATE POLICY "Vendors can read assigned cases" ON cases
  FOR SELECT USING (
    current_vendor_id IN (
      SELECT id FROM vendors WHERE profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Ops team has full access
CREATE POLICY "Ops team full access" ON cases
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'ops_team')
    )
  );
```

### 5. allocation_logs
```sql
-- Users can read allocations for their cases
CREATE POLICY "Users can read own allocations" ON allocation_logs
  FOR SELECT USING (
    case_id IN (
      SELECT id FROM cases WHERE 
        current_assignee_id IN (
          SELECT id FROM gig_partners WHERE user_id = auth.uid()
        )
        OR current_vendor_id IN (
          SELECT id FROM vendors WHERE profile_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid()
          )
        )
    )
  );

-- Ops team has full access
CREATE POLICY "Ops team full access" ON allocation_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'ops_team')
    )
  );
```

### 6. submissions
```sql
-- Gig workers can read their submissions
CREATE POLICY "Gig workers can read own submissions" ON submissions
  FOR SELECT USING (
    gig_partner_id IN (
      SELECT id FROM gig_partners WHERE user_id = auth.uid()
    )
  );

-- Vendors can read submissions for their cases
CREATE POLICY "Vendors can read case submissions" ON submissions
  FOR SELECT USING (
    case_id IN (
      SELECT id FROM cases WHERE current_vendor_id IN (
        SELECT id FROM vendors WHERE profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
      )
    )
  );

-- QC team can read all submissions
CREATE POLICY "QC team can read all submissions" ON submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'qc_team'
    )
  );
```

### 7. capacity_tracking
```sql
-- Gig workers can read their capacity
CREATE POLICY "Gig workers can read own capacity" ON capacity_tracking
  FOR SELECT USING (
    gig_partner_id IN (
      SELECT id FROM gig_partners WHERE user_id = auth.uid()
    )
  );

-- Vendors can read their gig workers' capacity
CREATE POLICY "Vendors can read gig workers capacity" ON capacity_tracking
  FOR SELECT USING (
    gig_partner_id IN (
      SELECT id FROM gig_partners WHERE vendor_id IN (
        SELECT id FROM vendors WHERE profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
      )
    )
  );
```

### 8. notifications
```sql
-- Users can read their notifications
CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT USING (
    recipient_id = auth.uid()
  );

-- Ops team can read all notifications
CREATE POLICY "Ops team can read all notifications" ON notifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'ops_team')
    )
  );
```

### 9. form_submissions
```sql
-- Gig workers can read their form submissions
CREATE POLICY "Gig workers can read own form submissions" ON form_submissions
  FOR SELECT USING (
    gig_partner_id IN (
      SELECT id FROM gig_partners WHERE user_id = auth.uid()
    )
  );

-- Vendors can read form submissions for their cases
CREATE POLICY "Vendors can read case form submissions" ON form_submissions
  FOR SELECT USING (
    case_id IN (
      SELECT id FROM cases WHERE current_vendor_id IN (
        SELECT id FROM vendors WHERE profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
      )
    )
  );
```

### 10. audit_logs
```sql
-- Ops team can read all audit logs
CREATE POLICY "Ops team can read audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'ops_team')
    )
  );
```

## Storage Policies

### case-attachments bucket
```sql
-- Users can upload to their assigned cases
CREATE POLICY "Users can upload case attachments" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'case-attachments' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can read their case attachments
CREATE POLICY "Users can read case attachments" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'case-attachments' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

### submission-photos bucket
```sql
-- Gig workers can upload submission photos
CREATE POLICY "Gig workers can upload submission photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'submission-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can read submission photos for their cases
CREATE POLICY "Users can read submission photos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'submission-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

## Function Security

### SECURITY DEFINER Functions
Functions that bypass RLS for system operations:
- `get_allocation_candidates()` - Allocation engine
- `allocate_case_to_candidate()` - Case assignment
- `assign_case_to_gig_worker()` - Vendor assignment
- `update_capacity_on_submission()` - Capacity updates
- `setup_gig_worker_password()` - User creation

### Function Access
- All RPC functions are accessible to authenticated users
- Functions validate permissions internally
- Sensitive operations require proper role checks

## Common RLS Patterns

### 1. Self Access
```sql
auth.uid() = user_id
```

### 2. Role-Based Access
```sql
EXISTS (
  SELECT 1 FROM profiles 
  WHERE user_id = auth.uid() 
  AND role IN ('super_admin', 'ops_team')
)
```

### 3. Related Entity Access
```sql
entity_id IN (
  SELECT id FROM related_table WHERE condition
)
```

### 4. Vendor-Gig Worker Relationship
```sql
vendor_id IN (
  SELECT id FROM vendors WHERE profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
)
```

## Testing RLS

### Test Queries
```sql
-- Test as different users
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "user-id-here"}';

-- Test table access
SELECT * FROM cases;
SELECT * FROM gig_partners;
SELECT * FROM allocation_logs;
```

### Common Issues
1. **Infinite Recursion**: Avoid circular references in policies
2. **Performance**: Use indexes on policy conditions
3. **Function Access**: Use SECURITY DEFINER for system functions
4. **Storage Policies**: Match bucket structure in policies

## Maintenance

### Adding New Tables
1. Enable RLS: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
2. Create policies for each role
3. Test with different user contexts
4. Add to this reference

### Updating Policies
1. Test in development first
2. Use `CREATE OR REPLACE POLICY`
3. Verify no data access issues
4. Update documentation
