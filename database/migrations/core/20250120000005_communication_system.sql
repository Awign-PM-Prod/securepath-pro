-- =====================================================
-- Communication & Notification System Migration
-- Background Verification Platform - Phase 1
-- =====================================================

-- Create enums for communication
CREATE TYPE public.notification_channel AS ENUM (
  'email',
  'sms',
  'whatsapp',
  'push',
  'ivr'
);

CREATE TYPE public.notification_status AS ENUM (
  'pending',
  'sent',
  'delivered',
  'failed',
  'cancelled'
);

CREATE TYPE public.notification_priority AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);

CREATE TYPE public.email_intake_status AS ENUM (
  'pending',
  'processing',
  'success',
  'failed',
  'quarantined'
);

-- =====================================================
-- EMAIL INTAKE SYSTEM
-- =====================================================

CREATE TABLE public.email_intake_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id TEXT NOT NULL, -- External email ID
  message_id TEXT, -- Email Message-ID header
  
  -- Email details
  sender_email TEXT NOT NULL,
  sender_domain TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Processing details
  status email_intake_status NOT NULL DEFAULT 'pending',
  processed_at TIMESTAMP WITH TIME ZONE,
  case_id UUID REFERENCES public.cases(id),
  
  -- Parsing results
  parsed_data JSONB NOT NULL DEFAULT '{}', -- Extracted case data
  attachments JSONB NOT NULL DEFAULT '{}', -- Attachment details
  parsing_errors TEXT[],
  
  -- Security
  is_trusted_sender BOOLEAN NOT NULL DEFAULT false,
  client_id UUID REFERENCES public.clients(id),
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- NOTIFICATION TEMPLATES
-- =====================================================

CREATE TABLE public.notification_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_name TEXT NOT NULL UNIQUE,
  template_type TEXT NOT NULL, -- 'allocation', 'acceptance_reminder', 'qc_result', 'payment', etc.
  
  -- Template content
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '{}', -- Available template variables
  
  -- Channel settings
  channels notification_channel[] NOT NULL DEFAULT '{}',
  priority notification_priority NOT NULL DEFAULT 'medium',
  
  -- Localization
  language TEXT NOT NULL DEFAULT 'en',
  region TEXT NOT NULL DEFAULT 'IN',
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  
  -- Audit
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- NOTIFICATIONS
-- =====================================================

CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES public.notification_templates(id),
  
  -- Recipient details
  recipient_type TEXT NOT NULL, -- 'user', 'gig_partner', 'vendor', 'client'
  recipient_id UUID NOT NULL, -- References appropriate table
  recipient_contact TEXT NOT NULL, -- Email, phone, etc.
  
  -- Notification content
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '{}',
  
  -- Channel and delivery
  channel notification_channel NOT NULL,
  priority notification_priority NOT NULL DEFAULT 'medium',
  status notification_status NOT NULL DEFAULT 'pending',
  
  -- Scheduling
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  
  -- Delivery details
  external_id TEXT, -- Provider's message ID
  delivery_response JSONB NOT NULL DEFAULT '{}',
  failure_reason TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  
  -- Context
  case_id UUID REFERENCES public.cases(id),
  related_entity_type TEXT, -- 'case', 'payment', 'allocation', etc.
  related_entity_id UUID,
  
  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- COMMUNICATION PREFERENCES
-- =====================================================

CREATE TABLE public.communication_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Channel preferences
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  sms_enabled BOOLEAN NOT NULL DEFAULT true,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT true,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  ivr_enabled BOOLEAN NOT NULL DEFAULT false,
  
  -- Notification type preferences
  allocation_notifications BOOLEAN NOT NULL DEFAULT true,
  acceptance_reminders BOOLEAN NOT NULL DEFAULT true,
  qc_results BOOLEAN NOT NULL DEFAULT true,
  payment_notifications BOOLEAN NOT NULL DEFAULT true,
  system_alerts BOOLEAN NOT NULL DEFAULT true,
  
  -- Timing preferences
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  
  -- Language preferences
  preferred_language TEXT NOT NULL DEFAULT 'en',
  preferred_region TEXT NOT NULL DEFAULT 'IN',
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(user_id)
);

-- =====================================================
-- SYSTEM CONFIGURATION
-- =====================================================

CREATE TABLE public.system_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_category TEXT NOT NULL, -- 'allocation', 'qc', 'payment', 'notification', 'email_intake'
  config_key TEXT NOT NULL,
  config_value JSONB NOT NULL,
  description TEXT,
  
  -- Validation
  value_type TEXT NOT NULL DEFAULT 'json', -- 'json', 'string', 'number', 'boolean'
  validation_rules JSONB NOT NULL DEFAULT '{}',
  
  -- Environment
  environment TEXT NOT NULL DEFAULT 'production', -- 'development', 'staging', 'production'
  is_sensitive BOOLEAN NOT NULL DEFAULT false,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  effective_until TIMESTAMP WITH TIME ZONE,
  
  -- Audit
  created_by UUID NOT NULL REFERENCES auth.users(id),
  updated_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(config_category, config_key, environment)
);

-- =====================================================
-- AUDIT LOGS
-- =====================================================

CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Entity details
  entity_type TEXT NOT NULL, -- 'case', 'user', 'payment', 'allocation', etc.
  entity_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'status_change', etc.
  
  -- Change details
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[],
  
  -- Context
  case_id UUID REFERENCES public.cases(id),
  user_id UUID REFERENCES auth.users(id),
  ip_address INET,
  user_agent TEXT,
  
  -- Additional metadata
  metadata JSONB NOT NULL DEFAULT '{}',
  
  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- CLIENT CONTRACTS
-- =====================================================

CREATE TABLE public.client_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id),
  
  -- Contract details
  contract_number TEXT NOT NULL,
  contract_name TEXT NOT NULL,
  contract_type TEXT NOT NULL, -- 'standard', 'premium', 'custom'
  
  -- Terms
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  terms JSONB NOT NULL DEFAULT '{}', -- Contract terms and conditions
  
  -- SLA settings
  default_tat_hours INTEGER NOT NULL DEFAULT 24,
  priority_tat_hours JSONB NOT NULL DEFAULT '{}', -- {priority: hours}
  
  -- Rate settings
  rate_card_id UUID REFERENCES public.rate_cards(id),
  rate_override_policy TEXT NOT NULL DEFAULT 'standard', -- 'standard', 'flexible', 'fixed'
  
  -- Delivery settings
  report_delivery_method TEXT NOT NULL DEFAULT 'email',
  report_delivery_config JSONB NOT NULL DEFAULT '{}',
  
  -- Escalation
  escalation_contacts JSONB NOT NULL DEFAULT '[]',
  escalation_rules JSONB NOT NULL DEFAULT '{}',
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Audit
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Email intake logs indexes
CREATE INDEX idx_email_intake_logs_sender ON public.email_intake_logs(sender_email);
CREATE INDEX idx_email_intake_logs_status ON public.email_intake_logs(status);
CREATE INDEX idx_email_intake_logs_received_at ON public.email_intake_logs(received_at);
CREATE INDEX idx_email_intake_logs_case_id ON public.email_intake_logs(case_id);

-- Notifications indexes
CREATE INDEX idx_notifications_recipient ON public.notifications(recipient_type, recipient_id);
CREATE INDEX idx_notifications_status ON public.notifications(status);
CREATE INDEX idx_notifications_channel ON public.notifications(channel);
CREATE INDEX idx_notifications_scheduled_at ON public.notifications(scheduled_at);
CREATE INDEX idx_notifications_case_id ON public.notifications(case_id);

-- Communication preferences indexes
CREATE INDEX idx_communication_preferences_user_id ON public.communication_preferences(user_id);

-- System configs indexes
CREATE INDEX idx_system_configs_category ON public.system_configs(config_category);
CREATE INDEX idx_system_configs_key ON public.system_configs(config_key);
CREATE INDEX idx_system_configs_environment ON public.system_configs(environment);
CREATE INDEX idx_system_configs_active ON public.system_configs(is_active);

-- Audit logs indexes
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_case_id ON public.audit_logs(case_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at);

-- Client contracts indexes
CREATE INDEX idx_client_contracts_client_id ON public.client_contracts(client_id);
CREATE INDEX idx_client_contracts_active ON public.client_contracts(is_active);
CREATE INDEX idx_client_contracts_dates ON public.client_contracts(start_date, end_date);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.email_intake_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contracts ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- NOTIFICATION FUNCTIONS
-- =====================================================

-- Function to send notification
CREATE OR REPLACE FUNCTION public.send_notification(
  p_template_name TEXT,
  p_recipient_type TEXT,
  p_recipient_id UUID,
  p_recipient_contact TEXT,
  p_variables JSONB DEFAULT '{}',
  p_channel notification_channel DEFAULT 'email',
  p_priority notification_priority DEFAULT 'medium',
  p_case_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  template_record RECORD;
  notification_id UUID;
  processed_subject TEXT;
  processed_body TEXT;
BEGIN
  -- Get template
  SELECT * INTO template_record
  FROM public.notification_templates
  WHERE template_name = p_template_name
    AND is_active = true
    AND effective_from <= CURRENT_DATE
    AND (effective_until IS NULL OR effective_until >= CURRENT_DATE);
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found: %', p_template_name;
  END IF;
  
  -- Process template variables (simple placeholder replacement)
  processed_subject := template_record.subject_template;
  processed_body := template_record.body_template;
  
  -- Replace variables in subject and body
  -- Simple approach: iterate through known common variables
  IF p_variables ? 'case_number' THEN
    processed_subject := replace(processed_subject, '{{case_number}}', p_variables->>'case_number');
    processed_body := replace(processed_body, '{{case_number}}', p_variables->>'case_number');
  END IF;
  
  IF p_variables ? 'location' THEN
    processed_subject := replace(processed_subject, '{{location}}', p_variables->>'location');
    processed_body := replace(processed_body, '{{location}}', p_variables->>'location');
  END IF;
  
  IF p_variables ? 'due_date' THEN
    processed_subject := replace(processed_subject, '{{due_date}}', p_variables->>'due_date');
    processed_body := replace(processed_body, '{{due_date}}', p_variables->>'due_date');
  END IF;
  
  IF p_variables ? 'rate' THEN
    processed_subject := replace(processed_subject, '{{rate}}', p_variables->>'rate');
    processed_body := replace(processed_body, '{{rate}}', p_variables->>'rate');
  END IF;
  
  IF p_variables ? 'time_remaining' THEN
    processed_subject := replace(processed_subject, '{{time_remaining}}', p_variables->>'time_remaining');
    processed_body := replace(processed_body, '{{time_remaining}}', p_variables->>'time_remaining');
  END IF;
  
  IF p_variables ? 'result' THEN
    processed_subject := replace(processed_subject, '{{result}}', p_variables->>'result');
    processed_body := replace(processed_body, '{{result}}', p_variables->>'result');
  END IF;
  
  IF p_variables ? 'comments' THEN
    processed_subject := replace(processed_subject, '{{comments}}', p_variables->>'comments');
    processed_body := replace(processed_body, '{{comments}}', p_variables->>'comments');
  END IF;
  
  IF p_variables ? 'cycle_tag' THEN
    processed_subject := replace(processed_subject, '{{cycle_tag}}', p_variables->>'cycle_tag');
    processed_body := replace(processed_body, '{{cycle_tag}}', p_variables->>'cycle_tag');
  END IF;
  
  IF p_variables ? 'amount' THEN
    processed_subject := replace(processed_subject, '{{amount}}', p_variables->>'amount');
    processed_body := replace(processed_body, '{{amount}}', p_variables->>'amount');
  END IF;
  
  -- Create notification
  INSERT INTO public.notifications (
    template_id,
    recipient_type,
    recipient_id,
    recipient_contact,
    subject,
    body,
    variables,
    channel,
    priority,
    case_id
  ) VALUES (
    template_record.id,
    p_recipient_type,
    p_recipient_id,
    p_recipient_contact,
    processed_subject,
    processed_body,
    p_variables,
    p_channel,
    p_priority,
    p_case_id
  ) RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- Function to process email intake
CREATE OR REPLACE FUNCTION public.process_email_intake(
  p_email_id TEXT,
  p_sender_email TEXT,
  p_subject TEXT,
  p_body TEXT,
  p_attachments JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  intake_log_id UUID;
  client_record RECORD;
  parsed_data JSONB;
  case_id UUID;
BEGIN
  -- Extract domain from sender email
  DECLARE
    sender_domain TEXT := split_part(p_sender_email, '@', 2);
  BEGIN
    -- Check if sender is trusted
    SELECT c.* INTO client_record
    FROM public.clients c
    WHERE sender_domain = ANY(c.allowed_sender_domains)
      AND c.is_active = true;
    
    -- Create email intake log
    INSERT INTO public.email_intake_logs (
      email_id,
      sender_email,
      sender_domain,
      recipient_email,
      subject,
      received_at,
      parsed_data,
      attachments,
      is_trusted_sender,
      client_id
    ) VALUES (
      p_email_id,
      p_sender_email,
      sender_domain,
      'tickets@bgverification.com', -- Default recipient
      p_subject,
      now(),
      parsed_data,
      p_attachments,
      (client_record.id IS NOT NULL),
      client_record.id
    ) RETURNING id INTO intake_log_id;
    
    -- If trusted sender, attempt to parse and create case
    IF client_record.id IS NOT NULL THEN
      -- Simple parsing logic (would be more sophisticated in production)
      parsed_data := jsonb_build_object(
        'title', p_subject,
        'description', p_body,
        'priority', 'medium',
        'source', 'email'
      );
      
      -- Update intake log with parsed data
      UPDATE public.email_intake_logs
      SET 
        parsed_data = parsed_data,
        status = 'success',
        processed_at = now()
      WHERE id = intake_log_id;
      
      -- Here you would create the case using the parsed data
      -- This would call the case creation function
      
    ELSE
      -- Mark as quarantined for manual review
      UPDATE public.email_intake_logs
      SET 
        status = 'quarantined',
        parsing_errors = ARRAY['Untrusted sender domain: ' || sender_domain]
      WHERE id = intake_log_id;
    END IF;
    
    RETURN intake_log_id;
  END;
END;
$$ LANGUAGE plpgsql;

-- Function to log audit event
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_action TEXT,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_case_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  audit_id UUID;
  changed_fields TEXT[];
BEGIN
  -- Calculate changed fields
  IF p_old_values IS NOT NULL AND p_new_values IS NOT NULL THEN
    SELECT ARRAY(
      SELECT key FROM jsonb_each(p_new_values)
      WHERE p_old_values->key IS DISTINCT FROM p_new_values->key
    ) INTO changed_fields;
  END IF;
  
  -- Create audit log entry
  INSERT INTO public.audit_logs (
    entity_type,
    entity_id,
    action,
    old_values,
    new_values,
    changed_fields,
    case_id,
    user_id,
    metadata
  ) VALUES (
    p_entity_type,
    p_entity_id,
    p_action,
    p_old_values,
    p_new_values,
    changed_fields,
    p_case_id,
    auth.uid(),
    p_metadata
  ) RETURNING id INTO audit_id;
  
  RETURN audit_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS FOR AUDIT LOGGING
-- =====================================================

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  old_data JSONB;
  new_data JSONB;
BEGIN
  -- Convert OLD and NEW to JSONB
  IF TG_OP = 'DELETE' THEN
    old_data := to_jsonb(OLD);
    new_data := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    old_data := to_jsonb(OLD);
    new_data := to_jsonb(NEW);
  ELSIF TG_OP = 'INSERT' THEN
    old_data := NULL;
    new_data := to_jsonb(NEW);
  END IF;
  
  -- Log the audit event
  PERFORM public.log_audit_event(
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    old_data,
    new_data,
    CASE 
      WHEN TG_TABLE_NAME = 'cases' THEN COALESCE(NEW.id, OLD.id)
      WHEN TG_TABLE_NAME = 'submissions' THEN COALESCE(NEW.case_id, OLD.case_id)
      WHEN TG_TABLE_NAME = 'payment_lines' THEN COALESCE(NEW.case_id, OLD.case_id)
      ELSE NULL
    END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to key tables
CREATE TRIGGER audit_cases_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_submissions_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_payment_lines_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.payment_lines
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Email intake logs policies
CREATE POLICY "Ops team can manage email intake"
  ON public.email_intake_logs FOR ALL
  USING (public.has_role('ops_team') OR public.has_role('super_admin'));

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (
    (recipient_type = 'user' AND recipient_id = auth.uid()) OR
    (recipient_type = 'gig_partner' AND recipient_id IN (
      SELECT id FROM public.gig_partners WHERE user_id = auth.uid()
    )) OR
    (recipient_type = 'vendor' AND recipient_id IN (
      SELECT v.id FROM public.vendors v
      JOIN public.profiles p ON v.created_by = p.user_id
      WHERE p.user_id = auth.uid()
    ))
  );

CREATE POLICY "System can manage notifications"
  ON public.notifications FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Communication preferences policies
CREATE POLICY "Users can manage their own preferences"
  ON public.communication_preferences FOR ALL
  USING (user_id = auth.uid());

-- System configs policies
CREATE POLICY "Super admin can manage system configs"
  ON public.system_configs FOR ALL
  USING (public.has_role('super_admin'));

-- Audit logs policies
CREATE POLICY "Super admin can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.has_role('super_admin'));

-- Client contracts policies
CREATE POLICY "Ops team can manage client contracts"
  ON public.client_contracts FOR ALL
  USING (public.has_role('ops_team') OR public.has_role('super_admin'));

CREATE POLICY "Clients can view their own contracts"
  ON public.client_contracts FOR SELECT
  USING (client_id IN (
    SELECT c.id FROM public.clients c
    JOIN public.profiles p ON c.created_by = p.user_id
    WHERE p.user_id = auth.uid()
  ));

-- =====================================================
-- INSERT DEFAULT NOTIFICATION TEMPLATES
-- =====================================================

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
  
  -- Insert notification templates only if we have a valid user ID
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO public.notification_templates (template_name, template_type, subject_template, body_template, variables, channels, created_by) VALUES
    ('case_allocated', 'allocation', 'New Case Assigned - {{case_number}}', 'A new case has been assigned to you. Case: {{case_number}}, Location: {{location}}, Due: {{due_date}}', '{"case_number": "string", "location": "string", "due_date": "string", "rate": "number"}', '{"email", "push"}', admin_user_id),
    ('acceptance_reminder', 'allocation', 'Case Acceptance Reminder - {{case_number}}', 'Please accept or reject the assigned case within {{time_remaining}} minutes. Case: {{case_number}}', '{"case_number": "string", "time_remaining": "number"}', '{"sms", "whatsapp", "push"}', admin_user_id),
    ('qc_result', 'qc', 'QC Result - {{case_number}}', 'Your submission for case {{case_number}} has been {{result}}. {{comments}}', '{"case_number": "string", "result": "string", "comments": "string"}', '{"email", "push"}', admin_user_id),
    ('payment_disbursed', 'payment', 'Payment Disbursed - {{cycle_tag}}', 'Your payment for cycle {{cycle_tag}} has been disbursed. Amount: ₹{{amount}}', '{"cycle_tag": "string", "amount": "number"}', '{"email", "sms"}', admin_user_id);
  END IF;
END $$;
