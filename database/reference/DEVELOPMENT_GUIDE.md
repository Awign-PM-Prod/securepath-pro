# Database Development Guide

## Quick Start

### 1. Database Setup
```bash
# Run core migrations first
psql -f database/migrations/core/

# Run feature migrations
psql -f database/migrations/features/

# Apply RLS policies
psql -f database/rls/policies/
```

### 2. Test Data Setup
```bash
# Create test users and data
psql -f database/test-data/setup_test_data_final.sql

# Create test cases
psql -f database/test-data/sample_cases_data.sql

# Create test gig workers
psql -f database/test-data/sample_gig_workers_data.sql
```

### 3. Function Testing
```bash
# Test allocation functions
psql -f database/functions/allocation/test_allocation_function.sql

# Test vendor functions
psql -f database/functions/vendors/test_vendor_data.sql
```

## Folder Structure

```
database/
├── migrations/
│   ├── core/           # Core schema migrations
│   ├── features/       # Feature-specific migrations
│   └── fixes/          # Bug fix migrations
├── functions/
│   ├── allocation/     # Allocation engine functions
│   ├── capacity/       # Capacity management functions
│   ├── users/          # User management functions
│   ├── vendors/        # Vendor management functions
│   └── forms/          # Form system functions
├── rls/
│   ├── policies/       # RLS policy definitions
│   └── fixes/          # RLS policy fixes
├── fixes/
│   ├── allocation/     # Allocation-related fixes
│   ├── cases/          # Case-related fixes
│   ├── vendors/        # Vendor-related fixes
│   ├── capacity/       # Capacity-related fixes
│   └── rls/            # RLS-related fixes
├── test-data/
│   ├── setup_*.sql     # Test data setup scripts
│   ├── sample_*.sql    # Sample data scripts
│   ├── test_*.sql      # Test scripts
│   └── debug_*.sql     # Debug scripts
└── reference/
    ├── SCHEMA_REFERENCE.md    # Complete schema reference
    ├── RLS_POLICIES.md        # RLS policies reference
    ├── UUID_REFERENCE.md      # Test UUIDs and data
    └── DEVELOPMENT_GUIDE.md   # This file
```

## Development Workflow

### 1. Schema Changes
1. Create migration in `database/migrations/features/`
2. Test migration on development database
3. Update `SCHEMA_REFERENCE.md` if needed
4. Commit and deploy

### 2. Function Development
1. Create function in appropriate `database/functions/` subfolder
2. Test function with `test_*.sql` scripts
3. Document function in `SCHEMA_REFERENCE.md`
4. Add to deployment pipeline

### 3. RLS Policy Changes
1. Create policy in `database/rls/policies/`
2. Test with different user roles
3. Update `RLS_POLICIES.md`
4. Apply to production carefully

### 4. Bug Fixes
1. Create fix script in appropriate `database/fixes/` subfolder
2. Test fix thoroughly
3. Document the issue and solution
4. Apply to production

## Common Tasks

### Adding a New Table
1. Create migration file:
```sql
-- database/migrations/features/YYYYMMDD_create_new_table.sql
CREATE TABLE new_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Users can read own records" ON new_table
  FOR SELECT USING (auth.uid() = user_id);
```

2. Update `SCHEMA_REFERENCE.md`
3. Add test data in `database/test-data/`

### Adding a New Function
1. Create function file:
```sql
-- database/functions/category/new_function.sql
CREATE OR REPLACE FUNCTION new_function(param1 text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Function logic here
  RETURN jsonb_build_object('success', true);
END;
$$;
```

2. Create test file:
```sql
-- database/test-data/test_new_function.sql
SELECT new_function('test_value');
```

3. Update `SCHEMA_REFERENCE.md`

### Adding RLS Policy
1. Create policy file:
```sql
-- database/rls/policies/table_name_policies.sql
CREATE POLICY "Policy name" ON table_name
  FOR SELECT USING (condition);
```

2. Update `RLS_POLICIES.md`
3. Test with different user roles

## Testing

### Unit Testing
```sql
-- Test individual functions
SELECT function_name('test_input');

-- Test with different user contexts
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "user-id"}';
SELECT * FROM table_name;
```

### Integration Testing
```sql
-- Test complete workflows
BEGIN;
  -- Setup test data
  -- Execute workflow
  -- Verify results
  -- Cleanup
ROLLBACK;
```

### RLS Testing
```sql
-- Test as different users
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "gig-worker-id"}';
SELECT * FROM cases; -- Should only see assigned cases

SET LOCAL "request.jwt.claims" TO '{"sub": "vendor-id"}';
SELECT * FROM cases; -- Should see vendor cases
```

## Debugging

### Common Issues

#### 1. RLS Policy Issues
```sql
-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'table_name';

-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'table_name';

-- Test with policy disabled
ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;
-- Test queries
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
```

#### 2. Function Errors
```sql
-- Check function definition
SELECT prosrc FROM pg_proc WHERE proname = 'function_name';

-- Test function with debug output
CREATE OR REPLACE FUNCTION debug_function()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE NOTICE 'Debug: Starting function';
  -- Add debug statements
  RAISE NOTICE 'Debug: Function completed';
END;
$$;
```

#### 3. Foreign Key Issues
```sql
-- Check foreign key constraints
SELECT 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';
```

### Debug Scripts
Use scripts in `database/test-data/debug_*.sql` for common debugging tasks.

## Performance

### Indexing
```sql
-- Check existing indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'table_name';

-- Add indexes for common queries
CREATE INDEX idx_table_column ON table_name(column_name);
CREATE INDEX idx_table_composite ON table_name(col1, col2);
```

### Query Optimization
```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM table_name WHERE condition;

-- Check table statistics
SELECT 
  schemaname,
  tablename,
  n_tup_ins,
  n_tup_upd,
  n_tup_del
FROM pg_stat_user_tables;
```

## Security

### RLS Best Practices
1. Always enable RLS on new tables
2. Test policies with different user roles
3. Use SECURITY DEFINER for system functions
4. Avoid circular references in policies
5. Document all policy changes

### Function Security
1. Use SECURITY DEFINER for system functions
2. Validate user permissions in functions
3. Avoid exposing sensitive data
4. Use parameterized queries

### Data Protection
1. Encrypt sensitive data at rest
2. Use proper access controls
3. Audit all data access
4. Regular security reviews

## Deployment

### Migration Order
1. Core migrations (tables, types, functions)
2. Feature migrations (new features)
3. RLS policies
4. Test data (development only)

### Rollback Strategy
1. Always test migrations on development first
2. Keep rollback scripts ready
3. Test rollback procedures
4. Document rollback steps

### Production Deployment
1. Backup database before migration
2. Run migrations during maintenance window
3. Monitor for errors
4. Verify functionality after deployment

## Monitoring

### Key Metrics
- Query performance
- RLS policy effectiveness
- Function execution times
- Database size and growth
- Error rates

### Logging
- Enable query logging for debugging
- Monitor RLS policy violations
- Track function errors
- Audit data access

## Maintenance

### Regular Tasks
1. Update statistics: `ANALYZE;`
2. Vacuum tables: `VACUUM;`
3. Check for unused indexes
4. Monitor database size
5. Review RLS policies

### Backup Strategy
1. Regular full backups
2. Point-in-time recovery
3. Test restore procedures
4. Document backup schedule

## Troubleshooting

### Common Error Messages

#### "permission denied for table"
- Check RLS policies
- Verify user role
- Check function permissions

#### "relation does not exist"
- Check migration order
- Verify table creation
- Check schema references

#### "foreign key constraint fails"
- Check data integrity
- Verify foreign key values
- Check constraint definitions

#### "function does not exist"
- Check function creation
- Verify schema references
- Check function permissions

### Getting Help
1. Check this reference guide
2. Review error logs
3. Test with minimal data
4. Check Supabase documentation
5. Ask team for help
