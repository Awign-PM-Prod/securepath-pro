-- =====================================================
-- Quality Control & Submissions Migration
-- Background Verification Platform - Phase 1
-- =====================================================

-- Create enums for QC
CREATE TYPE public.qc_result AS ENUM (
  'pass',
  'reject',
  'rework'
);

CREATE TYPE public.qc_reason_code AS ENUM (
  'insufficient_evidence',
  'poor_photo_quality',
  'incorrect_location',
  'missing_required_fields',
  'data_inconsistency',
  'gps_mismatch',
  'time_stamp_issue',
  'other'
);

CREATE TYPE public.submission_status AS ENUM (
  'draft',
  'submitted',
  'qc_pending',
  'qc_passed',
  'qc_rejected',
  'qc_rework',
  'completed'
);

-- =====================================================
-- SUBMISSIONS
-- =====================================================

CREATE TABLE public.submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  gig_partner_id UUID NOT NULL REFERENCES public.gig_partners(id),
  vendor_id UUID REFERENCES public.vendors(id),
  
  -- Submission details
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status submission_status NOT NULL DEFAULT 'submitted',
  
  -- Location verification
  submission_lat DECIMAL(10, 8),
  submission_lng DECIMAL(11, 8),
  submission_address TEXT,
  gps_accuracy_meters DECIMAL(8,2),
  location_verified BOOLEAN NOT NULL DEFAULT false,
  
  -- Answers and data
  answers JSONB NOT NULL DEFAULT '{}', -- Structured answers to case questions
  notes TEXT,
  
  -- Device and technical info
  device_info JSONB NOT NULL DEFAULT '{}', -- {device_type, os, app_version, etc.}
  submission_ip TEXT,
  user_agent TEXT,
  
  -- Offline sync
  is_offline_submission BOOLEAN NOT NULL DEFAULT false,
  synced_at TIMESTAMP WITH TIME ZONE,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- SUBMISSION PHOTOS
-- =====================================================

CREATE TABLE public.submission_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  
  -- Photo details
  photo_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT NOT NULL,
  
  -- Location data
  photo_lat DECIMAL(10, 8),
  photo_lng DECIMAL(11, 8),
  photo_address TEXT,
  
  -- EXIF data
  exif_data JSONB NOT NULL DEFAULT '{}', -- {camera_make, camera_model, timestamp, gps, etc.}
  taken_at TIMESTAMP WITH TIME ZONE,
  
  -- Validation
  is_gps_valid BOOLEAN,
  is_timestamp_valid BOOLEAN,
  is_photo_quality_good BOOLEAN,
  validation_notes TEXT,
  
  -- Processing
  is_processed BOOLEAN NOT NULL DEFAULT false,
  processing_errors TEXT[],
  
  -- Audit
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- QC REVIEWS
-- =====================================================

CREATE TABLE public.qc_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id),
  reviewer_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Review details
  reviewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  result qc_result NOT NULL,
  reason_code qc_reason_code,
  comments TEXT,
  
  -- Quality scores (0-100)
  photo_quality_score INTEGER CHECK (photo_quality_score >= 0 AND photo_quality_score <= 100),
  location_accuracy_score INTEGER CHECK (location_accuracy_score >= 0 AND location_accuracy_score <= 100),
  data_completeness_score INTEGER CHECK (data_completeness_score >= 0 AND data_completeness_score <= 100),
  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
  
  -- Specific issues
  issues_found TEXT[],
  improvement_suggestions TEXT,
  
  -- Rework details
  rework_instructions TEXT,
  rework_deadline TIMESTAMP WITH TIME ZONE,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- QC WORKFLOW TRACKING
-- =====================================================

CREATE TABLE public.qc_workflow (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES public.submissions(id),
  
  -- Workflow state
  current_stage TEXT NOT NULL, -- 'pending', 'in_review', 'passed', 'rejected', 'rework'
  assigned_to UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE,
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  sla_deadline TIMESTAMP WITH TIME ZONE,
  
  -- Priority and routing
  priority INTEGER NOT NULL DEFAULT 5, -- 1-10, 1 being highest
  auto_assigned BOOLEAN NOT NULL DEFAULT true,
  
  -- Notes
  internal_notes TEXT,
  external_notes TEXT,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- QC REASON CODES CONFIGURATION
-- =====================================================

CREATE TABLE public.qc_reason_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code qc_reason_code NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  requires_comment BOOLEAN NOT NULL DEFAULT false,
  severity_level INTEGER NOT NULL DEFAULT 1, -- 1-5, 5 being most severe
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default QC reason codes
INSERT INTO public.qc_reason_codes (code, name, description, requires_comment, severity_level) VALUES
('insufficient_evidence', 'Insufficient Evidence', 'Not enough photos or evidence provided', true, 3),
('poor_photo_quality', 'Poor Photo Quality', 'Photos are blurry, dark, or unclear', false, 2),
('incorrect_location', 'Incorrect Location', 'GPS coordinates do not match case location', true, 4),
('missing_required_fields', 'Missing Required Fields', 'Required form fields not filled', false, 2),
('data_inconsistency', 'Data Inconsistency', 'Conflicting information in submission', true, 3),
('gps_mismatch', 'GPS Mismatch', 'GPS location does not match case address', true, 4),
('time_stamp_issue', 'Timestamp Issue', 'Photo timestamps do not match submission time', false, 2),
('other', 'Other', 'Other quality issues not covered above', true, 1);

-- =====================================================
-- QC QUALITY STANDARDS
-- =====================================================

CREATE TABLE public.qc_quality_standards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  standard_name TEXT NOT NULL,
  standard_type TEXT NOT NULL, -- 'photo_quality', 'location_accuracy', 'data_completeness'
  
  -- Criteria
  min_score INTEGER NOT NULL DEFAULT 70,
  max_score INTEGER NOT NULL DEFAULT 100,
  criteria_description TEXT NOT NULL,
  
  -- Validation rules
  validation_rules JSONB NOT NULL DEFAULT '{}',
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default quality standards
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Try to get admin user ID
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'deepanshu.shahara@awign.com' LIMIT 1;
  
  -- If no admin user found, get any super_admin user
  IF admin_user_id IS NULL THEN
    SELECT p.user_id INTO admin_user_id 
    FROM public.profiles p 
    WHERE p.role = 'super_admin' AND p.is_active = true 
    LIMIT 1;
  END IF;
  
  -- If still no user found, get any user
  IF admin_user_id IS NULL THEN
    SELECT id INTO admin_user_id FROM auth.users LIMIT 1;
  END IF;
  
  -- Insert quality standards only if we have a valid user ID
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO public.qc_quality_standards (standard_name, standard_type, min_score, criteria_description, created_by) VALUES
    ('Photo Quality Standard', 'photo_quality', 75, 'Photos must be clear, well-lit, and show required details', admin_user_id),
    ('Location Accuracy Standard', 'location_accuracy', 80, 'GPS coordinates must be within 100 meters of case location', admin_user_id),
    ('Data Completeness Standard', 'data_completeness', 90, 'All required fields must be completed accurately', admin_user_id);
  END IF;
END $$;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Submissions indexes
CREATE INDEX idx_submissions_case_id ON public.submissions(case_id);
CREATE INDEX idx_submissions_gig_partner_id ON public.submissions(gig_partner_id);
CREATE INDEX idx_submissions_status ON public.submissions(status);
CREATE INDEX idx_submissions_submitted_at ON public.submissions(submitted_at);
CREATE INDEX idx_submissions_location ON public.submissions(submission_lat, submission_lng);

-- Submission photos indexes
CREATE INDEX idx_submission_photos_submission_id ON public.submission_photos(submission_id);
CREATE INDEX idx_submission_photos_location ON public.submission_photos(photo_lat, photo_lng);
CREATE INDEX idx_submission_photos_taken_at ON public.submission_photos(taken_at);
CREATE INDEX idx_submission_photos_processed ON public.submission_photos(is_processed);

-- QC reviews indexes
CREATE INDEX idx_qc_reviews_submission_id ON public.qc_reviews(submission_id);
CREATE INDEX idx_qc_reviews_case_id ON public.qc_reviews(case_id);
CREATE INDEX idx_qc_reviews_reviewer_id ON public.qc_reviews(reviewer_id);
CREATE INDEX idx_qc_reviews_result ON public.qc_reviews(result);
CREATE INDEX idx_qc_reviews_reviewed_at ON public.qc_reviews(reviewed_at);

-- QC workflow indexes
CREATE INDEX idx_qc_workflow_case_id ON public.qc_workflow(case_id);
CREATE INDEX idx_qc_workflow_assigned_to ON public.qc_workflow(assigned_to);
CREATE INDEX idx_qc_workflow_stage ON public.qc_workflow(current_stage);
CREATE INDEX idx_qc_workflow_priority ON public.qc_workflow(priority);
CREATE INDEX idx_qc_workflow_active ON public.qc_workflow(is_active);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_workflow ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_reason_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_quality_standards ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- QC FUNCTIONS
-- =====================================================

-- Function to validate photo GPS against case location
CREATE OR REPLACE FUNCTION public.validate_photo_gps(
  p_photo_lat DECIMAL(10, 8),
  p_photo_lng DECIMAL(11, 8),
  p_case_lat DECIMAL(10, 8),
  p_case_lng DECIMAL(11, 8),
  p_tolerance_meters INTEGER DEFAULT 100
)
RETURNS BOOLEAN AS $$
DECLARE
  distance_meters DECIMAL(8,2);
BEGIN
  -- Calculate distance using Haversine formula
  distance_meters := (
    6371000 * acos(
      cos(radians(p_case_lat)) * 
      cos(radians(p_photo_lat)) * 
      cos(radians(p_photo_lng) - radians(p_case_lng)) + 
      sin(radians(p_case_lat)) * 
      sin(radians(p_photo_lat))
    )
  );
  
  RETURN distance_meters <= p_tolerance_meters;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate overall QC score
CREATE OR REPLACE FUNCTION public.calculate_qc_score(
  p_photo_quality INTEGER,
  p_location_accuracy INTEGER,
  p_data_completeness INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  weights JSONB;
  photo_weight DECIMAL(3,2);
  location_weight DECIMAL(3,2);
  data_weight DECIMAL(3,2);
  weighted_score DECIMAL(5,2);
BEGIN
  -- Get weights from configuration (default if not found)
  SELECT COALESCE(config_value, '{"photo_quality": 0.4, "location_accuracy": 0.4, "data_completeness": 0.2}'::JSONB)
  INTO weights
  FROM public.allocation_config 
  WHERE config_key = 'qc_scoring_weights';
  
  photo_weight := (weights->>'photo_quality')::DECIMAL(3,2);
  location_weight := (weights->>'location_accuracy')::DECIMAL(3,2);
  data_weight := (weights->>'data_completeness')::DECIMAL(3,2);
  
  -- Calculate weighted score
  weighted_score := (p_photo_quality * photo_weight) + 
                   (p_location_accuracy * location_weight) + 
                   (p_data_completeness * data_weight);
  
  RETURN ROUND(weighted_score)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-assign QC reviewer
CREATE OR REPLACE FUNCTION public.auto_assign_qc_reviewer(
  p_case_id UUID
)
RETURNS UUID AS $$
DECLARE
  reviewer_id UUID;
  case_priority INTEGER;
BEGIN
  -- Get case priority (convert enum to integer)
  SELECT 
    CASE priority
      WHEN 'urgent' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 4
    END
  INTO case_priority
  FROM public.cases 
  WHERE id = p_case_id;
  
  -- Find available QC reviewer with least workload
  SELECT u.id INTO reviewer_id
  FROM auth.users u
  JOIN public.profiles p ON u.id = p.user_id
  WHERE p.role = 'qc_team' 
    AND p.is_active = true
  ORDER BY (
    SELECT COUNT(*) 
    FROM public.qc_workflow qw 
    WHERE qw.assigned_to = u.id 
      AND qw.is_active = true 
      AND qw.current_stage IN ('pending', 'in_review')
  ) ASC
  LIMIT 1;
  
  RETURN reviewer_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create QC workflow entry
CREATE OR REPLACE FUNCTION public.create_qc_workflow(
  p_case_id UUID,
  p_submission_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  workflow_id UUID;
  reviewer_id UUID;
  sla_hours INTEGER;
BEGIN
  -- Get SLA hours for QC (default 24 hours)
  SELECT COALESCE(config_value->>'qc_sla_hours', '24')::INTEGER
  INTO sla_hours
  FROM public.allocation_config 
  WHERE config_key = 'qc_sla_settings';
  
  -- Auto-assign reviewer
  reviewer_id := public.auto_assign_qc_reviewer(p_case_id);
  
  -- Create workflow entry
  INSERT INTO public.qc_workflow (
    case_id,
    submission_id,
    current_stage,
    assigned_to,
    assigned_at,
    started_at,
    sla_deadline,
    priority,
    auto_assigned
  ) VALUES (
    p_case_id,
    p_submission_id,
    'pending',
    reviewer_id,
    now(),
    now(),
    now() + INTERVAL '1 hour' * sla_hours,
    CASE 
      WHEN (SELECT priority FROM public.cases WHERE id = p_case_id) = 'urgent' THEN 1
      WHEN (SELECT priority FROM public.cases WHERE id = p_case_id) = 'high' THEN 2
      WHEN (SELECT priority FROM public.cases WHERE id = p_case_id) = 'medium' THEN 3
      ELSE 4
    END,
    true
  ) RETURNING id INTO workflow_id;
  
  RETURN workflow_id;
END;
$$ LANGUAGE plpgsql;

-- Function to process QC result
CREATE OR REPLACE FUNCTION public.process_qc_result(
  p_qc_review_id UUID,
  p_result qc_result,
  p_reason_code qc_reason_code DEFAULT NULL,
  p_comments TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  review_record RECORD;
  case_id UUID;
  submission_id UUID;
  workflow_id UUID;
BEGIN
  -- Get review details
  SELECT qr.*, s.case_id, s.id as submission_id
  INTO review_record
  FROM public.qc_reviews qr
  JOIN public.submissions s ON qr.submission_id = s.id
  WHERE qr.id = p_qc_review_id;
  
  case_id := review_record.case_id;
  submission_id := review_record.submission_id;
  
  -- Update case status based on QC result
  IF p_result = 'pass' THEN
    UPDATE public.cases 
    SET 
      status = 'qc_passed',
      status_updated_at = now(),
      updated_at = now()
    WHERE id = case_id;
    
    -- Update submission status
    UPDATE public.submissions 
    SET 
      status = 'qc_passed',
      updated_at = now()
    WHERE id = submission_id;
    
  ELSIF p_result = 'reject' THEN
    UPDATE public.cases 
    SET 
      status = 'qc_rejected',
      status_updated_at = now(),
      updated_at = now()
    WHERE id = case_id;
    
    -- Update submission status
    UPDATE public.submissions 
    SET 
      status = 'qc_rejected',
      updated_at = now()
    WHERE id = submission_id;
    
  ELSIF p_result = 'rework' THEN
    UPDATE public.cases 
    SET 
      status = 'qc_rework',
      status_updated_at = now(),
      updated_at = now()
    WHERE id = case_id;
    
    -- Update submission status
    UPDATE public.submissions 
    SET 
      status = 'qc_rework',
      updated_at = now()
    WHERE id = submission_id;
  END IF;
  
  -- Update QC workflow
  UPDATE public.qc_workflow 
  SET 
    current_stage = p_result::TEXT,
    completed_at = now(),
    updated_at = now()
  WHERE case_id = case_id AND is_active = true;
  
  -- If rework, create new workflow entry
  IF p_result = 'rework' THEN
    PERFORM public.create_qc_workflow(case_id, submission_id);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Trigger to create QC workflow when submission is created
CREATE OR REPLACE FUNCTION public.handle_submission_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Create QC workflow entry
  PERFORM public.create_qc_workflow(NEW.case_id, NEW.id);
  
  -- Update case status to QC pending
  UPDATE public.cases 
  SET 
    status = 'qc_pending',
    status_updated_at = now(),
    updated_at = now()
  WHERE id = NEW.case_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_submission_created_trigger
  AFTER INSERT ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_submission_created();

-- Trigger to validate photo GPS when photo is uploaded
CREATE OR REPLACE FUNCTION public.validate_photo_on_upload()
RETURNS TRIGGER AS $$
DECLARE
  case_record RECORD;
  is_gps_valid BOOLEAN;
BEGIN
  -- Get case location
  SELECT c.*, l.lat, l.lng
  INTO case_record
  FROM public.cases c
  JOIN public.locations l ON c.location_id = l.id
  WHERE c.id = (SELECT case_id FROM public.submissions WHERE id = NEW.submission_id);
  
  -- Validate GPS if both locations exist
  IF case_record.lat IS NOT NULL AND case_record.lng IS NOT NULL AND 
     NEW.photo_lat IS NOT NULL AND NEW.photo_lng IS NOT NULL THEN
    
    is_gps_valid := public.validate_photo_gps(
      NEW.photo_lat, NEW.photo_lng,
      case_record.lat, case_record.lng,
      100 -- 100 meter tolerance
    );
    
    NEW.is_gps_valid := is_gps_valid;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_photo_on_upload_trigger
  BEFORE INSERT ON public.submission_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_photo_on_upload();

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Submissions policies
CREATE POLICY "Users can view their own submissions"
  ON public.submissions FOR SELECT
  USING (gig_partner_id IN (SELECT id FROM public.gig_partners WHERE user_id = auth.uid()));

CREATE POLICY "QC team can view all submissions"
  ON public.submissions FOR SELECT
  USING (public.has_role('qc_team'));

CREATE POLICY "Ops team can view all submissions"
  ON public.submissions FOR SELECT
  USING (public.has_role('ops_team'));

-- QC reviews policies
CREATE POLICY "QC team can manage reviews"
  ON public.qc_reviews FOR ALL
  USING (public.has_role('qc_team'));

CREATE POLICY "Users can view reviews for their submissions"
  ON public.qc_reviews FOR SELECT
  USING (submission_id IN (
    SELECT id FROM public.submissions 
    WHERE gig_partner_id IN (
      SELECT id FROM public.gig_partners WHERE user_id = auth.uid()
    )
  ));

-- QC workflow policies
CREATE POLICY "QC team can manage workflow"
  ON public.qc_workflow FOR ALL
  USING (public.has_role('qc_team'));

CREATE POLICY "Ops team can view workflow"
  ON public.qc_workflow FOR SELECT
  USING (public.has_role('ops_team'));
