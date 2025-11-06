# Negative Forms Implementation Guide

## Overview
This implementation adds support for negative case forms in the gig worker dashboard. When a gig worker clicks "Submit" on an accepted case, they now see a popup asking "Positive/Negative". Selecting "Negative" opens a separate form template specifically designed for negative cases.

## What Was Implemented

### 1. Database Changes
- **File**: `database/migrations/add_is_negative_to_form_templates.sql`
- Added `is_negative` boolean column to `form_templates` table
- Updated unique constraint to allow both positive and negative templates per contract type
- Created index for better query performance

### 2. Code Changes

#### Form Service (`src/services/formService.ts`)
- Updated `getFormTemplate()` method to accept `isNegative` parameter
- Now filters templates by `is_negative` flag when fetching

#### Dynamic Form Component (`src/components/DynamicForm.tsx`)
- Added `isNegative` prop to `DynamicFormProps` interface
- Passes `isNegative` flag to `formService.getFormTemplate()`

#### Gig Worker Dashboard (`src/pages/GigWorkerDashboard.tsx`)
- Added `isNegativeForm` state to track if current form is negative
- Updated `openFormForCase()` to accept `isNegative` parameter
- Updated `handleNegativeSelection()` to open negative form
- Updated dialog title to show "Submit Negative Case" for negative forms
- Passes `isNegative` prop to `DynamicForm` component

## Next Steps

### Step 1: Run the SQL Migration
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `database/migrations/add_is_negative_to_form_templates.sql`
4. Run the query
5. Verify the column was added successfully

### Step 2: Create Universal Negative Form Template
**Important**: There is only ONE universal negative form template that is used for ALL contract types when a case is negative.

Run the SQL script to create the universal template:

1. **Using SQL Script (Recommended)**
   - Open Supabase SQL Editor
   - Copy and paste the contents of `database/migrations/create_universal_negative_template.sql`
   - Run the query
   - This will:
     - Create a special contract type called "negative_case"
     - Create one universal negative form template
     - Add standard negative case fields

2. **Manual Creation (Alternative)**
   If you prefer to create it manually:
   ```sql
   -- First, create the special contract type for negative cases
   INSERT INTO contract_type_config (type_key, type_name, description, is_active)
   VALUES (
     'negative_case',
     'Negative Case (Universal)',
     'Universal form template for all negative cases',
     true
   ) ON CONFLICT (type_key) DO NOTHING;
   
   -- Then create the template (get the contract type ID and user ID first)
   -- Use the Form Builder UI to add fields, or add them via SQL
   ```

### Step 3: Test the Implementation
1. Log in as a gig worker
2. Go to the "Accepted" tab
3. Click "Submit" on any accepted case
4. You should see the "Positive/Negative" popup
5. Click "Negative"
6. The negative form template should load (if created)
7. If no negative template exists, you'll see an error message

## Universal Negative Template
There is **only ONE** universal negative form template that is used for **ALL** contract types. When a gig worker selects "Negative" for any case (regardless of whether it's business_address_check, residential_address_check, employment_verification, etc.), they will see the same negative form.

The universal template is tied to a special contract type called `negative_case`.

## Notes
- Negative forms always start fresh (no draft loading)
- Positive forms continue to work as before
- The `is_negative` flag defaults to `false` for backward compatibility
- Existing positive templates are unaffected

## Troubleshooting

### Error: "No negative form template found"
- Solution: Create a negative form template for that contract type

### Error: "No form template found"
- Solution: Ensure you have at least one active template (positive or negative) for the contract type

### Template not showing up
- Check that `is_active = true` in the database
- Verify `is_negative` is set correctly (true for negative, false for positive)
- Ensure the contract_type_id matches

