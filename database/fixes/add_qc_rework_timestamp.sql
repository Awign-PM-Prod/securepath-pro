-- Add QC rework timestamp to case metadata when QC marks case for rework
-- This ensures we can track when QC marked a case for rework for the 30-minute timer

-- Create a function to handle QC rework marking
CREATE OR REPLACE FUNCTION public.handle_qc_rework_marking()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if QC_Response changed to 'Rework'
  IF NEW."QC_Response" = 'Rework' AND (OLD."QC_Response" IS NULL OR OLD."QC_Response" != 'Rework') THEN
    -- Update metadata to store the QC rework timestamp
    NEW.metadata = COALESCE(NEW.metadata, '{}'::jsonb) || 
                   jsonb_build_object('qc_rework_time', now()::text);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set QC rework timestamp
DROP TRIGGER IF EXISTS trigger_handle_qc_rework_marking ON public.cases;
CREATE TRIGGER trigger_handle_qc_rework_marking
  BEFORE UPDATE ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_qc_rework_marking();

-- Test the trigger
SELECT 
  'QC rework timestamp trigger created successfully' as status,
  'QC rework time will now be stored in metadata when QC marks cases for rework' as message;
