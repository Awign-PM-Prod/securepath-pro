-- Add timestamp tracking fields to form_submission_files table
-- This migration adds captured_at and upload_type fields for better audit trails

-- Add captured_at column for storing when image was captured
ALTER TABLE public.form_submission_files 
ADD COLUMN IF NOT EXISTS captured_at TIMESTAMP WITH TIME ZONE;

-- Add upload_type column to distinguish between camera captures and file uploads
ALTER TABLE public.form_submission_files 
ADD COLUMN IF NOT EXISTS upload_type TEXT CHECK (upload_type IN ('camera', 'file_upload'));

-- Add index for better query performance on timestamps
CREATE INDEX IF NOT EXISTS idx_form_submission_files_captured_at 
ON public.form_submission_files(captured_at);

CREATE INDEX IF NOT EXISTS idx_form_submission_files_upload_type 
ON public.form_submission_files(upload_type);

-- Add comment for documentation
COMMENT ON COLUMN public.form_submission_files.captured_at IS 'Timestamp when image was captured (for camera captures)';
COMMENT ON COLUMN public.form_submission_files.upload_type IS 'Type of upload: camera or file_upload';

-- Update existing records to have upload_type based on filename pattern
UPDATE public.form_submission_files 
SET upload_type = CASE 
  WHEN file_name LIKE 'camera-capture%' THEN 'camera'
  ELSE 'file_upload'
END
WHERE upload_type IS NULL;

-- Set captured_at to uploaded_at for existing camera captures
UPDATE public.form_submission_files 
SET captured_at = uploaded_at
WHERE file_name LIKE 'camera-capture%' 
AND captured_at IS NULL;
