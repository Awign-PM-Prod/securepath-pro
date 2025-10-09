# Database Setup Guide

## Current Issue
The case creation is failing because the database migrations haven't been run yet, or there are missing tables/data.

## Step-by-Step Solution

### 1. Run Database Migrations
Run these migrations in your Supabase SQL Editor in this order:

1. `20250120000014_fix_pincode_tier_enum_safe.sql` - Adds new enum values
2. `20250120000015_update_pincode_tiers_data.sql` - Updates existing data
3. `20250120000016_remove_contract_fields.sql` - Removes old contract fields
4. `20250120000017_update_contract_type_enum.sql` - Updates contract type enum
5. `20250120000018_create_contract_type_config.sql` - Creates contract type config table
6. `20250120000019_update_cases_table_for_new_structure.sql` - Updates cases table
7. `20250120000020_create_contract_type_config_table.sql` - Creates contract type config table
8. `20250120000021_update_client_contracts_for_new_structure.sql` - Updates client contracts

### 2. Check Database Status
Run `check_database_status.sql` to verify all tables and data are correct.

### 3. Setup Basic Data
Run `setup_basic_data.sql` to insert sample data for testing.

### 4. Test Case Creation
After running the migrations and setup scripts, try creating a case again.

## Expected Results
- All tables should exist with correct structure
- Pincode tiers should have data with new enum values (tier1, tier2, tier3)
- Client contracts should have the new structure
- Case creation should work without errors

## Troubleshooting
If you still get errors:
1. Check the Supabase logs for detailed error messages
2. Verify RLS policies are correctly set up
3. Ensure all foreign key constraints are satisfied
4. Check that the user has the correct role permissions
