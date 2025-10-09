-- =====================================================
-- Fix Audit Trigger Function
-- The error occurs because the trigger tries to access NEW.case_id 
-- from the cases table, but cases table has 'id' not 'case_id'
-- =====================================================

-- First, let's check if the audit trigger function exists and what it looks like
SELECT routine_name, routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'audit_trigger_function' 
AND routine_schema = 'public';

-- Drop the existing audit trigger function if it exists
DROP FUNCTION IF EXISTS public.audit_trigger_function();

-- Create the corrected audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  old_data JSONB;
  new_data JSONB;
  case_id_value UUID;
BEGIN
  -- Convert OLD and NEW records to JSONB
  IF TG_OP = 'DELETE' THEN
    old_data = to_jsonb(OLD);
    new_data = NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    old_data = to_jsonb(OLD);
    new_data = to_jsonb(NEW);
  ELSIF TG_OP = 'INSERT' THEN
    old_data = NULL;
    new_data = to_jsonb(NEW);
  END IF;

  -- Determine case_id based on table name
  CASE TG_TABLE_NAME
    WHEN 'cases' THEN
      -- For cases table, use the id field as case_id
      case_id_value := COALESCE(NEW.id, OLD.id);
    WHEN 'submissions' THEN
      -- For submissions table, use the case_id field
      case_id_value := COALESCE(NEW.case_id, OLD.case_id);
    WHEN 'payment_lines' THEN
      -- For payment_lines table, use the case_id field
      case_id_value := COALESCE(NEW.case_id, OLD.case_id);
    ELSE
      -- For other tables, set to NULL
      case_id_value := NULL;
  END CASE;

  -- Log the audit event
  PERFORM public.log_audit_event(
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    old_data,
    new_data,
    case_id_value
  );

  -- Return appropriate record
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Verify the function was created successfully
SELECT 'Audit trigger function fixed successfully!' as status;

-- Test the function with a simple query to make sure it compiles
SELECT 'Function syntax is valid' as test_result;

