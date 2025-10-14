# Database Organization

This directory contains all database-related files organized for easy development and maintenance.

## 📁 Structure

```
database/
├── migrations/          # Database migrations
│   ├── core/           # Core schema migrations
│   ├── features/       # Feature-specific migrations
│   └── fixes/          # Bug fix migrations
├── functions/          # Database functions
│   ├── allocation/     # Allocation engine functions
│   ├── capacity/       # Capacity management functions
│   ├── users/          # User management functions
│   ├── vendors/        # Vendor management functions
│   └── forms/          # Form system functions
├── rls/               # Row Level Security
│   ├── policies/      # RLS policy definitions
│   └── fixes/         # RLS policy fixes
├── fixes/             # Bug fixes and patches
│   ├── allocation/    # Allocation-related fixes
│   ├── cases/         # Case-related fixes
│   ├── vendors/       # Vendor-related fixes
│   ├── capacity/      # Capacity-related fixes
│   └── rls/           # RLS-related fixes
├── test-data/         # Test data and debugging
└── reference/         # Development reference docs
    ├── SCHEMA_REFERENCE.md    # Complete schema reference
    ├── RLS_POLICIES.md        # RLS policies reference
    ├── UUID_REFERENCE.md      # Test UUIDs and data
    └── DEVELOPMENT_GUIDE.md   # Development guide
```

## 🚀 Quick Start

### 1. Setup Database
```bash
# Run core migrations
psql -f database/migrations/core/

# Run feature migrations
psql -f database/migrations/features/

# Apply RLS policies
psql -f database/rls/policies/
```

### 2. Setup Test Data
```bash
# Create test users and data
psql -f database/test-data/setup_test_data_final.sql
```

### 3. Test Functions
```bash
# Test allocation system
psql -f database/functions/allocation/test_allocation_function.sql
```

## 📚 Reference Documentation

- **[Schema Reference](reference/SCHEMA_REFERENCE.md)** - Complete database schema documentation
- **[RLS Policies](reference/RLS_POLICIES.md)** - Row Level Security policies reference
- **[UUID Reference](reference/UUID_REFERENCE.md)** - Test UUIDs and development data
- **[Development Guide](reference/DEVELOPMENT_GUIDE.md)** - Development workflow and best practices

## 🔧 Common Tasks

### Adding a New Table
1. Create migration in `migrations/features/`
2. Update `reference/SCHEMA_REFERENCE.md`
3. Add RLS policies in `rls/policies/`
4. Test with data in `test-data/`

### Adding a New Function
1. Create function in appropriate `functions/` subfolder
2. Create test script in `test-data/`
3. Document in `reference/SCHEMA_REFERENCE.md`

### Fixing a Bug
1. Create fix script in appropriate `fixes/` subfolder
2. Test fix thoroughly
3. Document the issue and solution

## 🧪 Testing

### Unit Tests
```bash
# Test individual functions
psql -f database/test-data/test_function_name.sql
```

### Integration Tests
```bash
# Test complete workflows
psql -f database/test-data/test_workflow.sql
```

### RLS Tests
```bash
# Test with different user roles
psql -f database/test-data/test_rls_policies.sql
```

## 🐛 Debugging

### Common Issues
- **RLS Policy Issues**: Check `reference/RLS_POLICIES.md`
- **Function Errors**: Use debug scripts in `test-data/debug_*.sql`
- **Foreign Key Issues**: Check constraint definitions

### Debug Scripts
- `test-data/debug_*.sql` - Debug specific issues
- `test-data/check_*.sql` - Verify data integrity
- `test-data/simple_*.sql` - Simple test cases

## 📊 File Categories

### Migrations
- **Core**: Essential schema (tables, types, basic functions)
- **Features**: New features and enhancements
- **Fixes**: Bug fixes and patches

### Functions
- **Allocation**: Auto-allocation engine functions
- **Capacity**: Capacity management functions
- **Users**: User creation and management
- **Vendors**: Vendor management functions
- **Forms**: Dynamic form system functions

### RLS
- **Policies**: Row Level Security policy definitions
- **Fixes**: RLS policy fixes and updates

### Fixes
- **Allocation**: Allocation-related bug fixes
- **Cases**: Case management fixes
- **Vendors**: Vendor-related fixes
- **Capacity**: Capacity tracking fixes
- **RLS**: RLS policy fixes

### Test Data
- **Setup**: Test data creation scripts
- **Sample**: Sample data for testing
- **Test**: Function and workflow tests
- **Debug**: Debugging and troubleshooting scripts

## 🔒 Security

### RLS Policies
All tables have Row Level Security enabled with role-based access control:
- **Super Admin**: Full access
- **Ops Team**: Full access
- **Vendors**: Access to their data and gig workers
- **Gig Workers**: Access to their data and assigned cases
- **Clients**: Access to their cases only

### Function Security
- System functions use `SECURITY DEFINER`
- User functions validate permissions
- Sensitive operations require proper role checks

## 📈 Performance

### Indexing
- Performance-critical queries are indexed
- Composite indexes for complex queries
- GIN indexes for array operations

### Optimization
- Regular `ANALYZE` and `VACUUM`
- Query performance monitoring
- Index usage analysis

## 🚀 Deployment

### Migration Order
1. Core migrations (tables, types, functions)
2. Feature migrations (new features)
3. RLS policies
4. Test data (development only)

### Production
1. Backup before migration
2. Run during maintenance window
3. Monitor for errors
4. Verify functionality

## 📝 Naming Conventions

### Files
- `YYYYMMDD_description.sql` - Migrations
- `function_name.sql` - Functions
- `table_name_policies.sql` - RLS policies
- `test_description.sql` - Test scripts
- `debug_description.sql` - Debug scripts
- `fix_description.sql` - Bug fixes

### Functions
- `snake_case` naming
- Descriptive function names
- Clear parameter names
- Proper return types

### Tables
- `snake_case` naming
- Plural table names
- Clear column names
- Proper constraints

## 🤝 Contributing

### Adding New Files
1. Place in appropriate folder
2. Follow naming conventions
3. Add to this README if needed
4. Update reference documentation

### Making Changes
1. Test on development first
2. Document changes
3. Update reference docs
4. Test thoroughly

### Code Review
1. Check file organization
2. Verify naming conventions
3. Test functionality
4. Review documentation

## 📞 Support

### Getting Help
1. Check reference documentation
2. Review error logs
3. Test with minimal data
4. Ask team for assistance

### Common Resources
- [Schema Reference](reference/SCHEMA_REFERENCE.md)
- [RLS Policies](reference/RLS_POLICIES.md)
- [Development Guide](reference/DEVELOPMENT_GUIDE.md)
- [UUID Reference](reference/UUID_REFERENCE.md)

---

**Last Updated**: October 2025  
**Maintained By**: Development Team  
**Version**: 1.0.0
